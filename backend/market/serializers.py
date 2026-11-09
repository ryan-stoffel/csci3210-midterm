from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from . import services
from .models import Bid, InventoryItem, ItemType, Listing, TradeOffer, Transaction

MAX_PRICE = 1_000_000


class RegisterSerializer(serializers.Serializer):
    username = serializers.RegexField(r"^[A-Za-z0-9_]{3,20}$", error_messages={
        "invalid": "Use 3-20 letters, numbers, or underscores."
    })
    password = serializers.CharField(write_only=True)

    def validate_username(self, value: str) -> str:
        if User.objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError("That username is taken.")
        return value

    def validate(self, attrs):
        validate_password(attrs["password"], User(username=attrs["username"]))
        return attrs


class ProfileSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    username = serializers.CharField()
    is_staff = serializers.BooleanField()
    gold = serializers.IntegerField(source="profile.gold")
    held_gold = serializers.SerializerMethodField()

    def get_held_gold(self, user: User) -> int:
        return services.held_gold(user)


class ItemTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = ItemType
        fields = ["id", "name", "category", "rarity", "description", "base_value"]


class InventoryItemSerializer(serializers.ModelSerializer):
    item_type = ItemTypeSerializer(read_only=True)
    # Annotated by InventoryViewSet. Null when the item is not on the market.
    active_listing_id = serializers.IntegerField(read_only=True, allow_null=True, default=None)

    class Meta:
        model = InventoryItem
        fields = ["id", "item_type", "acquired_at", "active_listing_id"]


class PlayerSerializer(serializers.ModelSerializer):
    """Another player and the items they can trade (prefetched as `tradable_items`)."""

    items = InventoryItemSerializer(many=True, source="tradable_items")

    class Meta:
        model = User
        fields = ["id", "username", "items"]


class BidSerializer(serializers.ModelSerializer):
    bidder = serializers.CharField(source="bidder.username")

    class Meta:
        model = Bid
        fields = ["id", "bidder", "amount", "created_at"]


class ListingSerializer(serializers.ModelSerializer):
    """Read shape for listings. Expects a queryset from Listing.objects.with_market_data()."""

    item = InventoryItemSerializer(read_only=True)
    seller = serializers.CharField(source="seller.username")
    buyer = serializers.CharField(source="buyer.username", allow_null=True, default=None)
    current_price = serializers.IntegerField()
    bid_count = serializers.IntegerField()
    top_bidder = serializers.CharField(source="top_bidder_name", allow_null=True)
    min_next_bid = serializers.SerializerMethodField()

    class Meta:
        model = Listing
        fields = [
            "id", "item", "seller", "buyer", "kind", "status", "price", "current_price", "bid_count",
            "top_bidder", "min_next_bid", "created_at", "ends_at", "closed_at",
        ]

    def get_min_next_bid(self, listing: Listing) -> int | None:
        if listing.kind != Listing.Kind.AUCTION:
            return None
        return services.min_next_bid(listing.price, listing.top_amount)


class ListingDetailSerializer(ListingSerializer):
    bids = BidSerializer(many=True, read_only=True)

    class Meta(ListingSerializer.Meta):
        fields = ListingSerializer.Meta.fields + ["bids"]


class ListingCreateSerializer(serializers.Serializer):
    item_id = serializers.IntegerField()
    kind = serializers.ChoiceField(choices=Listing.Kind.choices)
    price = serializers.IntegerField(min_value=1, max_value=MAX_PRICE)
    duration_hours = serializers.IntegerField(min_value=1, max_value=72, required=False, allow_null=True)

    def validate(self, attrs):
        if attrs["kind"] == Listing.Kind.AUCTION and not attrs.get("duration_hours"):
            raise serializers.ValidationError({"duration_hours": "Auctions need a duration (1-72 hours)."})
        return attrs


class ListingFilterSerializer(serializers.Serializer):
    """Validates marketplace query params so bad filters return 400 instead of a crash."""

    SORTS = {
        "newest": "-created_at",
        "price_asc": "current_price",
        "price_desc": "-current_price",
        "ending_soon": "ends_at",
        "rarity": "-item__item_type__rarity",
    }

    q = serializers.CharField(required=False, max_length=80)
    category = serializers.ChoiceField(choices=ItemType.Category.choices, required=False)
    min_rarity = serializers.ChoiceField(choices=ItemType.Rarity.choices, required=False)
    kind = serializers.ChoiceField(choices=Listing.Kind.choices, required=False)
    status = serializers.ChoiceField(choices=Listing.Status.choices, default=Listing.Status.ACTIVE)
    min_price = serializers.IntegerField(min_value=0, required=False)
    max_price = serializers.IntegerField(min_value=0, required=False)
    mine = serializers.BooleanField(default=False)
    sort = serializers.ChoiceField(choices=list(SORTS), default="newest")

    def validate(self, attrs):
        lo, hi = attrs.get("min_price"), attrs.get("max_price")
        if lo is not None and hi is not None and lo > hi:
            raise serializers.ValidationError({"max_price": "Max price must be at least the min price."})
        return attrs


class BidCreateSerializer(serializers.Serializer):
    amount = serializers.IntegerField(min_value=1, max_value=MAX_PRICE)


class TradeOfferSerializer(serializers.ModelSerializer):
    sender = serializers.CharField(source="sender.username")
    recipient = serializers.CharField(source="recipient.username")
    offered_items = InventoryItemSerializer(many=True, read_only=True)
    requested_items = InventoryItemSerializer(many=True, read_only=True)

    class Meta:
        model = TradeOffer
        fields = ["id", "sender", "recipient", "offered_items", "requested_items", "message", "status",
                  "created_at", "resolved_at"]


class TradeCreateSerializer(serializers.Serializer):
    recipient = serializers.SlugRelatedField(slug_field="username", queryset=User.objects.all())
    offered_item_ids = serializers.ListField(child=serializers.IntegerField(), max_length=10, default=list)
    requested_item_ids = serializers.ListField(child=serializers.IntegerField(), max_length=10, default=list)
    message = serializers.CharField(max_length=200, required=False, allow_blank=True, default="")

    def validate_recipient(self, value: User) -> User:
        if value == self.context["request"].user:
            raise serializers.ValidationError("You cannot trade with yourself.")
        return value

    def validate(self, attrs):
        if not attrs["offered_item_ids"] and not attrs["requested_item_ids"]:
            raise serializers.ValidationError({"detail": "Pick at least one item to offer or request."})
        return attrs


class TransactionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Transaction
        fields = ["id", "kind", "amount", "balance_after", "note", "listing", "trade", "created_at"]
