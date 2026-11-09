from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register("item-types", views.ItemTypeViewSet, basename="item-type")
router.register("inventory", views.InventoryViewSet, basename="inventory")
router.register("players", views.PlayerViewSet, basename="player")
router.register("listings", views.ListingViewSet, basename="listing")
router.register("trades", views.TradeViewSet, basename="trade")
router.register("transactions", views.TransactionViewSet, basename="transaction")

urlpatterns = [
    path("auth/register/", views.register),
    path("auth/login/", views.login),
    path("auth/logout/", views.logout),
    path("me/", views.me),
    path("", include(router.urls)),
]
