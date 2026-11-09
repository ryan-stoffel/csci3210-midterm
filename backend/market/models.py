from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models
from django.db.models import Count, F, OuterRef, Q, Subquery
from django.db.models.functions import Coalesce

User = settings.AUTH_USER_MODEL


class Profile(models.Model):
    """One-to-one wallet for a user. `gold` is spendable gold; gold held by live bids is already removed."""

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="profile")
    gold = models.PositiveIntegerField(default=0)

    def __str__(self) -> str:
        return f"{self.user} ({self.gold}g)"


class ItemType(models.Model):
    """Catalog entry. Every owned item is an instance of one of these."""

    class Category(models.TextChoices):
        WEAPON = "weapon"
        ARMOR = "armor"
        SKIN = "skin"
        RESOURCE = "resource"
        CONSUMABLE = "consumable"

    class Rarity(models.IntegerChoices):
        COMMON = 1
        UNCOMMON = 2
        RARE = 3
        EPIC = 4
        LEGENDARY = 5

    name = models.CharField(max_length=80, unique=True)
    category = models.CharField(max_length=20, choices=Category.choices)
    rarity = models.PositiveSmallIntegerField(choices=Rarity.choices)
    description = models.TextField(blank=True)
    base_value = models.PositiveIntegerField(validators=[MinValueValidator(1)])

    class Meta:
        ordering = ["-rarity", "name"]

    def __str__(self) -> str:
        return self.name


class InventoryItem(models.Model):
    """A single owned item. Ownership moves between users on sales and trades."""

    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name="items")
    item_type = models.ForeignKey(ItemType, on_delete=models.PROTECT, related_name="instances")
    acquired_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-item_type__rarity", "item_type__name", "id"]

    def __str__(self) -> str:
        return f"{self.item_type} #{self.pk}"


class ListingQuerySet(models.QuerySet):
    def with_market_data(self):
        """Annotate the top bid, its bidder, bid count and current price in one query (no per-row lookups)."""
        top = Bid.objects.filter(listing=OuterRef("pk")).order_by("-amount", "created_at")
        return (
            self.select_related("seller", "buyer", "item__item_type")
            .annotate(
                top_amount=Subquery(top.values("amount")[:1]),
                top_bidder_id=Subquery(top.values("bidder_id")[:1]),
                top_bidder_name=Subquery(top.values("bidder__username")[:1]),
                bid_count=Count("bids"),
            )
            .annotate(current_price=Coalesce(F("top_amount"), F("price")))
        )


class Listing(models.Model):
    """An item offered on the market, either at a fixed price or as a timed auction."""

    class Kind(models.TextChoices):
        FIXED = "fixed"
        AUCTION = "auction"

    class Status(models.TextChoices):
        ACTIVE = "active"
        SOLD = "sold"
        CANCELLED = "cancelled"
        EXPIRED = "expired"

    seller = models.ForeignKey(User, on_delete=models.CASCADE, related_name="listings")
    item = models.ForeignKey(InventoryItem, on_delete=models.CASCADE, related_name="listings")
    kind = models.CharField(max_length=10, choices=Kind.choices)
    # Fixed listings: the sale price. Auctions: the minimum opening bid.
    price = models.PositiveIntegerField(validators=[MinValueValidator(1)])
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.ACTIVE)
    buyer = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL, related_name="purchases")
    created_at = models.DateTimeField(auto_now_add=True)
    ends_at = models.DateTimeField(null=True, blank=True)
    closed_at = models.DateTimeField(null=True, blank=True)

    objects = ListingQuerySet.as_manager()

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            # An item can only be on the market once at a time.
            models.UniqueConstraint(fields=["item"], condition=Q(status="active"), name="one_active_listing_per_item"),
            models.CheckConstraint(
                condition=Q(kind="fixed") | Q(ends_at__isnull=False), name="auction_has_end_time"
            ),
        ]

    def __str__(self) -> str:
        return f"{self.kind} {self.item} by {self.seller}"


class Bid(models.Model):
    listing = models.ForeignKey(Listing, on_delete=models.CASCADE, related_name="bids")
    bidder = models.ForeignKey(User, on_delete=models.CASCADE, related_name="bids")
    amount = models.PositiveIntegerField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-amount", "created_at"]

    def __str__(self) -> str:
        return f"{self.bidder} bid {self.amount} on #{self.listing_id}"


class TradeOffer(models.Model):
    """A barter proposal: swap `offered_items` (sender's) for `requested_items` (recipient's)."""

    class Status(models.TextChoices):
        PENDING = "pending"
        ACCEPTED = "accepted"
        DECLINED = "declined"
        CANCELLED = "cancelled"

    sender = models.ForeignKey(User, on_delete=models.CASCADE, related_name="trades_sent")
    recipient = models.ForeignKey(User, on_delete=models.CASCADE, related_name="trades_received")
    offered_items = models.ManyToManyField(InventoryItem, related_name="offered_in", blank=True)
    requested_items = models.ManyToManyField(InventoryItem, related_name="requested_in", blank=True)
    message = models.CharField(max_length=200, blank=True)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)
    created_at = models.DateTimeField(auto_now_add=True)
    resolved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.CheckConstraint(condition=~Q(sender=models.F("recipient")), name="no_self_trade"),
        ]


class Transaction(models.Model):
    """Ledger row. `amount` is the signed gold change for `user` (0 for item-only events)."""

    class Kind(models.TextChoices):
        GRANT = "grant"
        BID_HOLD = "bid_hold"
        BID_REFUND = "bid_refund"
        PURCHASE = "purchase"
        SALE = "sale"
        AUCTION_WON = "auction_won"
        TRADE = "trade"

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="transactions")
    kind = models.CharField(max_length=20, choices=Kind.choices)
    amount = models.IntegerField(default=0)
    balance_after = models.PositiveIntegerField()
    listing = models.ForeignKey(Listing, null=True, blank=True, on_delete=models.SET_NULL)
    trade = models.ForeignKey(TradeOffer, null=True, blank=True, on_delete=models.SET_NULL)
    note = models.CharField(max_length=200)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]
