# All Spells

Far Far West mod: sets every non-starting spell's `requiredMinimumLevel` to `1`, so all spells across Acid, Cactus, Electric, Fire, and Voodoo are available from the start.

## Build

From this folder:

```powershell
node ScriptUtils\patch_all_spells.js
```

The script exports current spell assets from
`..\FarFarWest_Unpacked_RetocLegacy\FarFarWest\Content\Spells`, patches the
required levels, stages the cooked assets, derives fresh raw override chunks
with `retoc to-zen`, and writes the final pak/ucas/utoc triplet.

Install this triplet into `FarFarWest\Content\Paks\~mods`:

```text
ModBuild/pakchunk99-AllSpells-Windows_P.pak
ModBuild/pakchunk99-AllSpells-Windows_P.ucas
ModBuild/pakchunk99-AllSpells-Windows_P.utoc
```

## Notes

Five spells already had level requirement `1` in the June 6, 2026 game files;
the patch changes the other 20 spell assets.
