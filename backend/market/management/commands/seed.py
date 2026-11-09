"""Demo data: `python manage.py seed` creates players, inventories, listings, bids and a trade offer.

Every movement goes through market.services so balances and the ledger stay consistent.
"""

from datetime import timedelta

from django.contrib.auth.models import User
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from market import services
from market.models import InventoryItem, ItemType, Listing, Profile

PASSWORD = "tradehub-demo"
PLAYERS = ["alice", "bob", "cara"]


class Command(BaseCommand):
    help = "Create demo players (password: tradehub-demo), an admin, and an active market."

    def handle(self, *args, **options):
        if User.objects.filter(username__in=PLAYERS).exists():
            raise CommandError("Demo players already exist. Delete db.sqlite3 and migrate to reseed.")

        admin = User.objects.create_superuser("admin", password=PASSWORD)
        Profile.objects.create(user=admin, gold=0)
        alice, bob, cara = (services.register_player(name, PASSWORD) for name in PLAYERS)

        types = {t.name: t for t in ItemType.objects.all()}

        def give(user, *names):
            return [InventoryItem.objects.create(owner=user, item_type=types[n]) for n in names]

        sword, cloak, feather = give(alice, "Emberforged Longsword", "Stormweave Cloak", "Phoenix Feather")
        dagger, skin, ore = give(bob, "Voidglass Dagger", "Neon Drift Skin", "Silver Ore")
        plate, mantle, shard = give(cara, "Sunscale Plate", "Starlit Mantle Skin", "Glacier Shard")

        services.create_listing(alice, sword.pk, "auction", 500, 24)
        services.create_listing(alice, cloak.pk, "fixed", 240, None)
        services.create_listing(bob, dagger.pk, "fixed", 190, None)
        services.create_listing(bob, skin.pk, "auction", 120, 2)
        services.create_listing(cara, plate.pk, "auction", 900, 48)
        services.create_listing(cara, shard.pk, "fixed", 140, None)
        services.create_listing(cara, mantle.pk, "fixed", 1250, None)

        sword_listing = Listing.objects.get(item=sword, status="active")
        services.place_bid(bob, sword_listing.pk, 500)
        services.place_bid(cara, sword_listing.pk, 540)
        services.place_bid(bob, sword_listing.pk, 600)
        skin_listing = Listing.objects.get(item=skin, status="active")
        services.place_bid(alice, skin_listing.pk, 130)

        services.buy_now(alice, Listing.objects.get(item=shard, status="active").pk)

        # One auction already past its end time with a bid, so the first request settles it.
        quick = give(bob, "Crimson Tide Skin")[0]
        ended = services.create_listing(bob, quick.pk, "auction", 300, 1)
        services.place_bid(cara, ended.pk, 320)
        Listing.objects.filter(pk=ended.pk).update(ends_at=timezone.now() - timedelta(minutes=1))

        services.propose_trade(bob, alice, {ore.pk}, {feather.pk}, "Silver for your feather? I'll add more later.")

        self.stdout.write(self.style.SUCCESS(f"Seeded players {', '.join(PLAYERS)} and admin. Password: {PASSWORD}"))
