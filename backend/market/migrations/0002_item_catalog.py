"""Starting item catalog. Staff can add more through the API or Django admin."""

from django.db import migrations

CATALOG = [
    # name, category, rarity (1 common .. 5 legendary), base value, description
    ("Oak Staff", "weapon", 1, 20, "A sturdy walking staff that doubles as a weapon."),
    ("Leather Jerkin", "armor", 1, 25, "Light armor stitched from tanned hide."),
    ("Copper Ingot", "resource", 1, 8, "Smelted copper, the base of most crafting."),
    ("Moonpetal Herb", "resource", 1, 12, "A pale flower that only opens at night."),
    ("Healing Draught", "consumable", 1, 15, "Restores a little health."),
    ("Ashwood Shortbow", "weapon", 2, 60, "Light bow carved from fire-hardened ash."),
    ("Silver Ore", "resource", 2, 40, "Raw silver, prized by enchanters."),
    ("Elixir of Swiftness", "consumable", 2, 55, "Doubles movement speed for a short time."),
    ("Ironbark Buckler", "armor", 2, 70, "A small shield faced with petrified bark."),
    ("Voidglass Dagger", "weapon", 3, 180, "A black glass blade that hums near magic."),
    ("Stormweave Cloak", "armor", 3, 220, "Woven with thread that holds a static charge."),
    ("Neon Drift Skin", "skin", 3, 150, "Glowing trim for any outfit."),
    ("Glacier Shard", "resource", 3, 130, "Ice that never melts."),
    ("Emberforged Longsword", "weapon", 4, 600, "Forged in a volcano vent. Always warm."),
    ("Crimson Tide Skin", "skin", 4, 450, "A deep red finish with a wave pattern."),
    ("Phoenix Feather", "resource", 5, 1500, "Used in the rarest resurrection recipes."),
    ("Sunscale Plate", "armor", 5, 1800, "Golden scale armor that reflects light."),
    ("Starlit Mantle Skin", "skin", 5, 1200, "A night sky that moves as you do."),
]


def add_catalog(apps, schema_editor):
    ItemType = apps.get_model("market", "ItemType")
    ItemType.objects.bulk_create(
        ItemType(name=n, category=c, rarity=r, base_value=v, description=d) for n, c, r, v, d in CATALOG
    )


def remove_catalog(apps, schema_editor):
    apps.get_model("market", "ItemType").objects.filter(name__in=[row[0] for row in CATALOG]).delete()


class Migration(migrations.Migration):
    dependencies = [("market", "0001_initial")]
    operations = [migrations.RunPython(add_catalog, remove_catalog)]
