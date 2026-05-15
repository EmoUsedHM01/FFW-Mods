# Merged Jokers

Far Far West merged mod for `DT_PlayerJokers`.

## Changes

- Sets every non-upgrade Joker `maxAvailable` value to 10.
- Leaves Weapon and Hero stat upgrade rows, such as `jokerUpgradeDamage` and `jokerUpgradeHeroSpeed`, unchanged.
- Makes these enabled mission-only Unique Jokers buyable and available through Gamba:
  - `jokerCamper`
  - `jokerGiant`
  - `jokerDwarf`
  - `jokerExtraDash`
- Enables Gamba for enabled purchase-only rows that were blocked from Gamba, including:
  - `jokerShroomGrave`
  - `jokerCactusDay`
  - `jokerFistFight`

Use this instead of installing `NoJokerCaps` and `UnrestrictiveJokers` separately.

## Build

From this folder:

```powershell
node ScriptUtils\patch_merged_jokers.js
..\UAssetGUI.exe fromjson ScriptUtils\patched\DT_PlayerJokers_35.json ModStage\FarFarWest\Content\Progress\DT_PlayerJokers.uasset 35
& 'C:\UE_5.7\Engine\Binaries\Win64\UnrealPak.exe' "$PWD\ModBuild\pakchunk99-MergedJokers-Windows_P.pak" -Create="$PWD\ScriptUtils\MergedJokers_PakList.txt"
..\retoc\retoc.exe to-zen ModBuild\pakchunk99-MergedJokers-Windows_P.pak ModBuild\pakchunk99-MergedJokers-Windows_P.utoc --version UE5_7
```

Install this triplet into `FarFarWest\Content\Paks\~mods`:

```text
ModBuild/pakchunk99-MergedJokers-Windows_P.pak
ModBuild/pakchunk99-MergedJokers-Windows_P.ucas
ModBuild/pakchunk99-MergedJokers-Windows_P.utoc
```

## Compatibility

This overrides `FarFarWest/Content/Progress/DT_PlayerJokers`. Do not install it alongside `NoJokerCaps`, `UnrestrictiveJokers`, or any other mod that overrides the same asset unless their changes are already merged.
