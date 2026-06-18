# All Spells

Far Far West mod: sets every serialized non-starting spell `requiredMinimumLevel` to `1`, so all spells across the current game archetypes are available from the start.

## Build

From this folder:

```powershell
node ScriptUtils\patch_all_spells.js
```

The script discovers and exports current `BP_Item_SpellCast_*.uasset` files from
`..\FarFarWest_Unpacked_RetocLegacy\FarFarWest\Content\Spells`, patches the
serialized required levels, stages the cooked assets, derives fresh raw override
chunks with `retoc to-zen`, and writes the final pak/ucas/utoc triplet.

Install this triplet into `FarFarWest\Content\Paks\~mods`:

```text
ModBuild/pakchunk99-AllSpells-Windows_P.pak
ModBuild/pakchunk99-AllSpells-Windows_P.ucas
ModBuild/pakchunk99-AllSpells-Windows_P.utoc
```

## Notes

The June 18, 2026 game update contains 30 spell cast assets. The script patches
the 20 assets that serialize level requirements above `1`; the five old starter
spells are already level `1`, and the five Ice spells do not serialize a
separate requirement value to patch.
