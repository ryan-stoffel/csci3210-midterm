from datetime import timedelta

from django.utils import timezone
from rest_framework.test import APITestCase

from . import services
from .models import InventoryItem, ItemType, Listing, Profile, Transaction

PASSWORD = "a-long-test-password"


class MarketTests(APITestCase):
    def setUp(self):
        self.alice = services.register_player("alice", PASSWORD)
        self.bob = services.register_player("bob", PASSWORD)
        self.cara = services.register_player("cara", PASSWORD)
        self.sword = InventoryItem.objects.create(owner=self.alice, item_type=ItemType.objects.get(name="Oak Staff"))

    def gold(self, user) -> int:
        return Profile.objects.get(user=user).gold

    def as_user(self, user):
        self.client.force_authenticate(user)

    def test_register_and_login_return_token_and_starter_wallet(self):
        res = self.client.post("/api/auth/register/", {"username": "dave", "password": PASSWORD})
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.data["user"]["gold"], 1000)
        self.assertEqual(InventoryItem.objects.filter(owner__username="dave").count(), services.STARTER_ITEM_COUNT)

        res = self.client.post("/api/auth/login/", {"username": "dave", "password": "wrong"})
        self.assertEqual(res.status_code, 401)
        res = self.client.get("/api/me/", HTTP_AUTHORIZATION=f"Token {self.client.post('/api/auth/login/', {'username': 'dave', 'password': PASSWORD}).data['token']}")
        self.assertEqual(res.data["username"], "dave")

    def test_requests_without_token_are_rejected(self):
        self.assertEqual(self.client.get("/api/listings/").status_code, 401)

    def test_buy_now_moves_gold_and_item(self):
        listing = services.create_listing(self.alice, self.sword.pk, "fixed", 300, None)
        self.as_user(self.bob)
        res = self.client.post(f"/api/listings/{listing.pk}/buy/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual((self.gold(self.alice), self.gold(self.bob)), (1300, 700))
        self.sword.refresh_from_db()
        self.assertEqual(self.sword.owner, self.bob)
        # Second purchase of the same listing is a conflict, not a double sale.
        self.as_user(self.cara)
        self.assertEqual(self.client.post(f"/api/listings/{listing.pk}/buy/").status_code, 409)
        self.assertEqual(self.gold(self.cara), 1000)

    def test_cannot_buy_without_enough_gold(self):
        listing = services.create_listing(self.alice, self.sword.pk, "fixed", 5000, None)
        self.as_user(self.bob)
        self.assertEqual(self.client.post(f"/api/listings/{listing.pk}/buy/").status_code, 400)
        self.assertEqual(self.gold(self.bob), 1000)

    def test_outbid_refunds_previous_bidder_and_settlement_pays_seller(self):
        listing = services.create_listing(self.alice, self.sword.pk, "auction", 100, 1)
        self.as_user(self.bob)
        self.assertEqual(self.client.post(f"/api/listings/{listing.pk}/bid/", {"amount": 100}).status_code, 201)
        self.assertEqual(self.gold(self.bob), 900)

        self.as_user(self.cara)
        low = self.client.post(f"/api/listings/{listing.pk}/bid/", {"amount": 104})
        self.assertEqual(low.status_code, 400)  # needs +5%
        res = self.client.post(f"/api/listings/{listing.pk}/bid/", {"amount": 105})
        self.assertEqual(res.data["current_price"], 105)
        self.assertEqual((self.gold(self.bob), self.gold(self.cara)), (1000, 895))

        Listing.objects.filter(pk=listing.pk).update(ends_at=timezone.now() - timedelta(seconds=1))
        self.assertEqual(services.settle_expired_auctions(), 1)
        self.sword.refresh_from_db()
        self.assertEqual(self.sword.owner, self.cara)
        self.assertEqual((self.gold(self.alice), self.gold(self.cara)), (1105, 895))

    def test_seller_guards(self):
        listing = services.create_listing(self.alice, self.sword.pk, "auction", 100, 1)
        self.as_user(self.alice)
        self.assertEqual(self.client.post(f"/api/listings/{listing.pk}/bid/", {"amount": 100}).status_code, 403)
        self.as_user(self.bob)
        self.assertEqual(self.client.post(f"/api/listings/{listing.pk}/cancel/").status_code, 403)
        services.place_bid(self.bob, listing.pk, 100)
        self.as_user(self.alice)
        self.assertEqual(self.client.post(f"/api/listings/{listing.pk}/cancel/").status_code, 409)

    def test_item_cannot_be_listed_twice(self):
        services.create_listing(self.alice, self.sword.pk, "fixed", 10, None)
        self.as_user(self.alice)
        res = self.client.post("/api/listings/", {"item_id": self.sword.pk, "kind": "fixed", "price": 10})
        self.assertEqual(res.status_code, 409)

    def test_listing_filters_validate_and_apply(self):
        services.create_listing(self.alice, self.sword.pk, "fixed", 50, None)
        self.as_user(self.bob)
        self.assertEqual(self.client.get("/api/listings/?min_price=60&max_price=10").status_code, 400)
        self.assertEqual(self.client.get("/api/listings/?category=weapon&max_price=60").data["count"], 1)
        self.assertEqual(self.client.get("/api/listings/?category=armor").data["count"], 0)

    def test_trade_swaps_items_and_rejects_stale_offers(self):
        bob_item = InventoryItem.objects.filter(owner=self.bob).first()
        self.as_user(self.alice)
        res = self.client.post("/api/trades/", {
            "recipient": "bob", "offered_item_ids": [self.sword.pk], "requested_item_ids": [bob_item.pk],
        }, format="json")
        self.assertEqual(res.status_code, 201)
        trade_id = res.data["id"]
        self.assertEqual(self.client.post(f"/api/trades/{trade_id}/accept/").status_code, 403)

        self.as_user(self.bob)
        self.assertEqual(self.client.post(f"/api/trades/{trade_id}/accept/").data["status"], "accepted")
        self.sword.refresh_from_db()
        bob_item.refresh_from_db()
        self.assertEqual((self.sword.owner, bob_item.owner), (self.bob, self.alice))
        self.assertEqual(Transaction.objects.filter(kind="trade").count(), 2)

        # Alice no longer owns the staff, so an old offer containing it cannot be accepted.
        stale = services.propose_trade(self.bob, self.cara, {self.sword.pk}, set(), "")
        InventoryItem.objects.filter(pk=self.sword.pk).update(owner=self.alice)
        self.as_user(self.cara)
        self.assertEqual(self.client.post(f"/api/trades/{stale.pk}/accept/").status_code, 409)

    def test_only_staff_can_edit_catalog(self):
        self.as_user(self.alice)
        body = {"name": "Test Blade", "category": "weapon", "rarity": 1, "base_value": 5}
        self.assertEqual(self.client.post("/api/item-types/", body).status_code, 403)
        self.alice.is_staff = True
        self.alice.save()
        self.assertEqual(self.client.post("/api/item-types/", body).status_code, 201)
