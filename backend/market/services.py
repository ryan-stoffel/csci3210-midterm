"""Every gold or item movement goes through this module.

Each public function runs in one database transaction and locks the rows it changes with
select_for_update, so two players acting on the same listing or wallet at once cannot
double-spend gold or sell one item twice. Profiles are always locked in user-id order to
avoid deadlocks.
"""

import random
from datetime import timedelta

from django.conf import settings
from django.contrib.auth.models import User
from django.db import transaction
from django.db.models import Sum
from django.utils import timezone
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError

from .exceptions import Conflict
from .models import Bid, InventoryItem, ItemType, Listing, Profile, TradeOffer, Transaction

STARTER_ITEM_COUNT = 3


def min_next_bid(price: int, top_amount: int | None) -> int:
    """Opening bid is the listing price. After that each bid must beat the top bid by 5% (at least 1 gold)."""
    if top_amount is None:
        return price
    return top_amount + max(1, top_amount * 5 // 100)


def held_gold(user: User) -> int:
    """Gold the user has tied up as the top bidder on live auctions."""
    total = (
        Listing.objects.with_market_data()
        .filter(status=Listing.Status.ACTIVE, kind=Listing.Kind.AUCTION, top_bidder_id=user.id)
        .aggregate(total=Sum("top_amount"))["total"]
    )
    return total or 0


def _lock_profiles(*user_ids: int) -> dict[int, Profile]:
    rows = Profile.objects.select_for_update().filter(user_id__in=set(user_ids)).order_by("user_id")
    return {p.user_id: p for p in rows}


def _move_gold(profile: Profile, amount: int, kind: str, note: str, listing=None, trade=None) -> None:
    """Apply a signed gold change and write the ledger row. Caller must hold the profile lock."""
    if profile.gold + amount < 0:
        raise ValidationError({"detail": f"Not enough gold. You have {profile.gold}g but need {-amount}g."})
    profile.gold += amount
    profile.save(update_fields=["gold"])
    Transaction.objects.create(
        user_id=profile.user_id, kind=kind, amount=amount, balance_after=profile.gold,
        listing=listing, trade=trade, note=note,
    )


def _log_item_event(user_id: int, kind: str, note: str, listing=None, trade=None) -> None:
    gold = Profile.objects.get(user_id=user_id).gold
    Transaction.objects.create(
        user_id=user_id, kind=kind, amount=0, balance_after=gold, listing=listing, trade=trade, note=note
    )


def _get_listing_for_update(listing_id: int) -> Listing:
    listing = Listing.objects.select_for_update().select_related("item__item_type").filter(pk=listing_id).first()
    if listing is None:
        raise NotFound("Listing not found.")
    return listing


@transaction.atomic
def register_player(username: str, password: str) -> User:
    """Create the account, its wallet, and a few random common/uncommon starter items."""
    user = User.objects.create_user(username=username, password=password)
    profile = Profile.objects.create(user=user, gold=0)
    _move_gold(profile, settings.STARTING_GOLD, Transaction.Kind.GRANT, "Starting gold")
    starters = list(ItemType.objects.filter(rarity__lte=ItemType.Rarity.UNCOMMON))
    for item_type in random.sample(starters, min(STARTER_ITEM_COUNT, len(starters))):
        InventoryItem.objects.create(owner=user, item_type=item_type)
    return user


@transaction.atomic
def create_listing(user: User, item_id: int, kind: str, price: int, duration_hours: int | None = None) -> Listing:
    item = InventoryItem.objects.select_for_update().filter(pk=item_id, owner=user).first()
    if item is None:
        raise ValidationError({"item_id": "You do not own that item."})
    if Listing.objects.filter(item=item, status=Listing.Status.ACTIVE).exists():
        raise Conflict("That item is already listed.")
    ends_at = timezone.now() + timedelta(hours=duration_hours) if kind == Listing.Kind.AUCTION else None
    return Listing.objects.create(seller=user, item=item, kind=kind, price=price, ends_at=ends_at)


@transaction.atomic
def place_bid(user: User, listing_id: int, amount: int) -> Bid:
    """Hold the bid amount from the bidder and refund the previous top bidder in the same transaction."""
    listing = _get_listing_for_update(listing_id)
    if listing.kind != Listing.Kind.AUCTION:
        raise Conflict("Fixed-price listings cannot be bid on. Use Buy now.")
    if listing.status != Listing.Status.ACTIVE or listing.ends_at <= timezone.now():
        raise Conflict("This auction has ended.")
    if listing.seller_id == user.id:
        raise PermissionDenied("You cannot bid on your own listing.")

    top = listing.bids.first()
    minimum = min_next_bid(listing.price, top.amount if top else None)
    if amount < minimum:
        raise ValidationError({"amount": f"Bid must be at least {minimum}g."})

    item_name = listing.item.item_type.name
    profiles = _lock_profiles(user.id, *([top.bidder_id] if top else []))
    if top:
        _move_gold(profiles[top.bidder_id], top.amount, Transaction.Kind.BID_REFUND,
                   f"Outbid on {item_name}", listing=listing)
    _move_gold(profiles[user.id], -amount, Transaction.Kind.BID_HOLD, f"Bid on {item_name}", listing=listing)
    return Bid.objects.create(listing=listing, bidder=user, amount=amount)


@transaction.atomic
def buy_now(user: User, listing_id: int) -> Listing:
    listing = _get_listing_for_update(listing_id)
    if listing.kind != Listing.Kind.FIXED:
        raise Conflict("Auctions cannot be bought outright. Place a bid instead.")
    if listing.status != Listing.Status.ACTIVE:
        raise Conflict("This listing is no longer available.")
    if listing.seller_id == user.id:
        raise PermissionDenied("You cannot buy your own listing.")

    item_name = listing.item.item_type.name
    profiles = _lock_profiles(user.id, listing.seller_id)
    _move_gold(profiles[user.id], -listing.price, Transaction.Kind.PURCHASE, f"Bought {item_name}", listing=listing)
    _move_gold(profiles[listing.seller_id], listing.price, Transaction.Kind.SALE, f"Sold {item_name}", listing=listing)
    InventoryItem.objects.filter(pk=listing.item_id).update(owner=user)
    listing.status, listing.buyer, listing.closed_at = Listing.Status.SOLD, user, timezone.now()
    listing.save(update_fields=["status", "buyer", "closed_at"])
    return listing


@transaction.atomic
def cancel_listing(user: User, listing_id: int) -> Listing:
    listing = _get_listing_for_update(listing_id)
    if listing.seller_id != user.id:
        raise PermissionDenied("Only the seller can cancel this listing.")
    if listing.status != Listing.Status.ACTIVE:
        raise Conflict("This listing is already closed.")
    if listing.bids.exists():
        raise Conflict("Auctions with bids cannot be cancelled.")
    listing.status, listing.closed_at = Listing.Status.CANCELLED, timezone.now()
    listing.save(update_fields=["status", "closed_at"])
    return listing


def settle_expired_auctions() -> int:
    """Close every auction past its end time. Returns how many were settled.

    ponytail: runs at the start of API requests (see views.SettlesAuctions). Move to a
    scheduled job if request volume makes the extra query matter.
    """
    due = Listing.objects.filter(
        status=Listing.Status.ACTIVE, kind=Listing.Kind.AUCTION, ends_at__lte=timezone.now()
    ).values_list("pk", flat=True)
    return sum(_settle(pk) for pk in list(due))


@transaction.atomic
def _settle(listing_id: int) -> bool:
    listing = _get_listing_for_update(listing_id)
    if listing.status != Listing.Status.ACTIVE:
        return False  # settled by a concurrent request
    listing.closed_at = timezone.now()
    top = listing.bids.first()
    if top is None:
        listing.status = Listing.Status.EXPIRED
        listing.save(update_fields=["status", "closed_at"])
        return True

    item_name = listing.item.item_type.name
    profiles = _lock_profiles(listing.seller_id, top.bidder_id)
    # The winner's gold was already held when they bid, so only the seller is paid here.
    _move_gold(profiles[listing.seller_id], top.amount, Transaction.Kind.SALE,
               f"Auction sold {item_name}", listing=listing)
    Transaction.objects.create(
        user_id=top.bidder_id, kind=Transaction.Kind.AUCTION_WON, amount=0,
        balance_after=profiles[top.bidder_id].gold, listing=listing, note=f"Won {item_name} for {top.amount}g",
    )
    InventoryItem.objects.filter(pk=listing.item_id).update(owner_id=top.bidder_id)
    listing.status, listing.buyer_id = Listing.Status.SOLD, top.bidder_id
    listing.save(update_fields=["status", "buyer", "closed_at"])
    return True


def _check_tradable(items: list[InventoryItem], owner_id: int, ids: set[int], field: str) -> None:
    if {i.pk for i in items} != ids or any(i.owner_id != owner_id for i in items):
        raise ValidationError({field: "Some items are not owned by the expected player."})
    if Listing.objects.filter(item__in=items, status=Listing.Status.ACTIVE).exists():
        raise ValidationError({field: "Listed items cannot be traded. Cancel the listing first."})


@transaction.atomic
def propose_trade(sender: User, recipient: User, offered_ids: set[int], requested_ids: set[int], message: str) -> TradeOffer:
    offered = list(InventoryItem.objects.filter(pk__in=offered_ids))
    requested = list(InventoryItem.objects.filter(pk__in=requested_ids))
    _check_tradable(offered, sender.id, offered_ids, "offered_item_ids")
    _check_tradable(requested, recipient.id, requested_ids, "requested_item_ids")
    trade = TradeOffer.objects.create(sender=sender, recipient=recipient, message=message)
    trade.offered_items.set(offered)
    trade.requested_items.set(requested)
    return trade


def _get_trade_for_update(trade_id: int, user: User) -> TradeOffer:
    trade = TradeOffer.objects.select_for_update().filter(pk=trade_id).first()
    if trade is None or user.id not in (trade.sender_id, trade.recipient_id):
        raise NotFound("Trade offer not found.")
    if trade.status != TradeOffer.Status.PENDING:
        raise Conflict(f"This offer was already {trade.status}.")
    return trade


@transaction.atomic
def accept_trade(user: User, trade_id: int) -> TradeOffer:
    """Swap item ownership. Re-checks ownership under lock because items may have moved since the offer."""
    trade = _get_trade_for_update(trade_id, user)
    if trade.recipient_id != user.id:
        raise PermissionDenied("Only the recipient can accept this offer.")
    offered_ids = set(trade.offered_items.values_list("pk", flat=True))
    requested_ids = set(trade.requested_items.values_list("pk", flat=True))
    items = {i.pk: i for i in InventoryItem.objects.select_for_update().filter(pk__in=offered_ids | requested_ids)}
    try:
        _check_tradable([items[i] for i in offered_ids if i in items], trade.sender_id, offered_ids, "offered_item_ids")
        _check_tradable([items[i] for i in requested_ids if i in items], trade.recipient_id, requested_ids, "requested_item_ids")
    except ValidationError:
        raise Conflict("Items in this offer have changed hands or been listed. It can no longer be accepted.")

    InventoryItem.objects.filter(pk__in=offered_ids).update(owner_id=trade.recipient_id)
    InventoryItem.objects.filter(pk__in=requested_ids).update(owner_id=trade.sender_id)
    trade.status, trade.resolved_at = TradeOffer.Status.ACCEPTED, timezone.now()
    trade.save(update_fields=["status", "resolved_at"])
    summary = f"{len(offered_ids)} item(s) for {len(requested_ids)} item(s)"
    _log_item_event(trade.sender_id, Transaction.Kind.TRADE, f"Trade with {user.username}: {summary}", trade=trade)
    _log_item_event(trade.recipient_id, Transaction.Kind.TRADE, f"Trade with {trade.sender.username}: {summary}", trade=trade)
    return trade


@transaction.atomic
def close_trade(user: User, trade_id: int, status: str) -> TradeOffer:
    """Recipient declines, or sender cancels, a pending offer."""
    trade = _get_trade_for_update(trade_id, user)
    allowed = trade.recipient_id if status == TradeOffer.Status.DECLINED else trade.sender_id
    if user.id != allowed:
        who = "recipient" if status == TradeOffer.Status.DECLINED else "sender"
        raise PermissionDenied(f"Only the {who} can do that.")
    trade.status, trade.resolved_at = status, timezone.now()
    trade.save(update_fields=["status", "resolved_at"])
    return trade
