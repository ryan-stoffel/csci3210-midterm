from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from django.db.models import OuterRef, Prefetch, Q, Subquery
from rest_framework import mixins, status, viewsets
from rest_framework.authtoken.models import Token
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.permissions import AllowAny
from rest_framework.request import Request
from rest_framework.response import Response

from . import services
from .models import Bid, InventoryItem, ItemType, Listing, TradeOffer, Transaction
from .permissions import IsAdminOrReadOnly
from .serializers import (
    BidCreateSerializer, InventoryItemSerializer, ItemTypeSerializer, ListingCreateSerializer,
    ListingDetailSerializer, ListingFilterSerializer, ListingSerializer, PlayerSerializer, ProfileSerializer,
    RegisterSerializer, TradeCreateSerializer, TradeOfferSerializer, TransactionSerializer,
)


def _session(user: User, code: int = status.HTTP_200_OK) -> Response:
    token, _ = Token.objects.get_or_create(user=user)
    return Response({"token": token.key, "user": ProfileSerializer(user).data}, status=code)


@api_view(["POST"])
@permission_classes([AllowAny])
def register(request: Request) -> Response:
    data = RegisterSerializer(data=request.data)
    data.is_valid(raise_exception=True)
    user = services.register_player(**data.validated_data)
    return _session(user, status.HTTP_201_CREATED)


@api_view(["POST"])
@permission_classes([AllowAny])
def login(request: Request) -> Response:
    user = authenticate(username=request.data.get("username", ""), password=request.data.get("password", ""))
    if user is None:
        raise AuthenticationFailed("Wrong username or password.")
    return _session(user)


@api_view(["POST"])
def logout(request: Request) -> Response:
    Token.objects.filter(user=request.user).delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(["GET"])
def me(request: Request) -> Response:
    services.settle_expired_auctions()
    return Response(ProfileSerializer(request.user).data)


class SettlesAuctions:
    """Closes auctions past their end time before the view reads market state."""

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        services.settle_expired_auctions()


class ItemTypeViewSet(viewsets.ModelViewSet):
    """Item catalog. Players read it, staff manage it."""

    queryset = ItemType.objects.all()
    serializer_class = ItemTypeSerializer
    permission_classes = [IsAdminOrReadOnly]
    pagination_class = None


class InventoryViewSet(SettlesAuctions, viewsets.ReadOnlyModelViewSet):
    serializer_class = InventoryItemSerializer
    pagination_class = None

    def get_queryset(self):
        active = Listing.objects.filter(item=OuterRef("pk"), status=Listing.Status.ACTIVE)
        return (
            InventoryItem.objects.filter(owner=self.request.user)
            .select_related("item_type")
            .annotate(active_listing_id=Subquery(active.values("pk")[:1]))
        )


class PlayerViewSet(viewsets.ReadOnlyModelViewSet):
    """Other players with the items they can trade, for building barter offers."""

    serializer_class = PlayerSerializer
    lookup_field = "username"
    pagination_class = None

    def get_queryset(self):
        tradable = InventoryItem.objects.select_related("item_type").exclude(listings__status=Listing.Status.ACTIVE)
        return (
            User.objects.filter(is_active=True, profile__isnull=False)
            .exclude(pk=self.request.user.pk)
            .prefetch_related(Prefetch("items", queryset=tradable, to_attr="tradable_items"))
            .order_by("username")
        )


class ListingViewSet(SettlesAuctions, mixins.CreateModelMixin, viewsets.ReadOnlyModelViewSet):
    """Marketplace. GET lists with filters, POST lists an item, plus bid / buy / cancel actions."""

    def get_serializer_class(self):
        return ListingDetailSerializer if self.action == "retrieve" else ListingSerializer

    def get_queryset(self):
        qs = Listing.objects.with_market_data()
        if self.action == "retrieve":
            return qs.prefetch_related(Prefetch("bids", queryset=Bid.objects.select_related("bidder")))
        if self.action != "list":
            return qs

        f = ListingFilterSerializer(data=self.request.query_params)
        f.is_valid(raise_exception=True)
        p = f.validated_data
        qs = qs.filter(status=p["status"])
        if p["mine"]:
            qs = qs.filter(seller=self.request.user)
        if "q" in p:
            qs = qs.filter(item__item_type__name__icontains=p["q"])
        if "category" in p:
            qs = qs.filter(item__item_type__category=p["category"])
        if "min_rarity" in p:
            qs = qs.filter(item__item_type__rarity__gte=p["min_rarity"])
        if "kind" in p:
            qs = qs.filter(kind=p["kind"])
        if "min_price" in p:
            qs = qs.filter(current_price__gte=p["min_price"])
        if "max_price" in p:
            qs = qs.filter(current_price__lte=p["max_price"])
        return qs.order_by(ListingFilterSerializer.SORTS[p["sort"]], "-id")

    def _detail(self, pk: int, code: int = status.HTTP_200_OK) -> Response:
        listing = Listing.objects.with_market_data().prefetch_related(
            Prefetch("bids", queryset=Bid.objects.select_related("bidder"))
        ).get(pk=pk)
        return Response(ListingDetailSerializer(listing).data, status=code)

    def create(self, request: Request, *args, **kwargs) -> Response:
        data = ListingCreateSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        listing = services.create_listing(request.user, **data.validated_data)
        return self._detail(listing.pk, status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def bid(self, request: Request, pk: str) -> Response:
        data = BidCreateSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        services.place_bid(request.user, int(pk), data.validated_data["amount"])
        return self._detail(int(pk), status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def buy(self, request: Request, pk: str) -> Response:
        services.buy_now(request.user, int(pk))
        return self._detail(int(pk))

    @action(detail=True, methods=["post"])
    def cancel(self, request: Request, pk: str) -> Response:
        services.cancel_listing(request.user, int(pk))
        return self._detail(int(pk))


class TradeViewSet(mixins.CreateModelMixin, viewsets.ReadOnlyModelViewSet):
    """Barter offers the user sent or received. ?box=incoming|outgoing narrows the list."""

    serializer_class = TradeOfferSerializer
    pagination_class = None

    def get_queryset(self):
        user = self.request.user
        items = InventoryItem.objects.select_related("item_type")
        qs = (
            TradeOffer.objects.filter(Q(sender=user) | Q(recipient=user))
            .select_related("sender", "recipient")
            .prefetch_related(Prefetch("offered_items", queryset=items), Prefetch("requested_items", queryset=items))
        )
        box = self.request.query_params.get("box")
        if box == "incoming":
            qs = qs.filter(recipient=user)
        elif box == "outgoing":
            qs = qs.filter(sender=user)
        return qs

    def _detail(self, pk: int, code: int = status.HTTP_200_OK) -> Response:
        return Response(TradeOfferSerializer(self.get_queryset().get(pk=pk)).data, status=code)

    def create(self, request: Request, *args, **kwargs) -> Response:
        data = TradeCreateSerializer(data=request.data, context={"request": request})
        data.is_valid(raise_exception=True)
        v = data.validated_data
        trade = services.propose_trade(
            request.user, v["recipient"], set(v["offered_item_ids"]), set(v["requested_item_ids"]), v["message"]
        )
        return self._detail(trade.pk, status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def accept(self, request: Request, pk: str) -> Response:
        services.accept_trade(request.user, int(pk))
        return self._detail(int(pk))

    @action(detail=True, methods=["post"])
    def decline(self, request: Request, pk: str) -> Response:
        services.close_trade(request.user, int(pk), TradeOffer.Status.DECLINED)
        return self._detail(int(pk))

    @action(detail=True, methods=["post"])
    def cancel(self, request: Request, pk: str) -> Response:
        services.close_trade(request.user, int(pk), TradeOffer.Status.CANCELLED)
        return self._detail(int(pk))


class TransactionViewSet(SettlesAuctions, viewsets.ReadOnlyModelViewSet):
    serializer_class = TransactionSerializer

    def get_queryset(self):
        return Transaction.objects.filter(user=self.request.user)
