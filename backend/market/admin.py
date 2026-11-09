from django.contrib import admin

from .models import Bid, InventoryItem, ItemType, Listing, Profile, TradeOffer, Transaction

admin.site.register([Profile, ItemType, InventoryItem, Listing, Bid, TradeOffer, Transaction])
