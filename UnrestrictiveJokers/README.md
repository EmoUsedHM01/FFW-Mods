# Unrestrictive Jokers

Far Far West mod: makes restricted Jokers available through normal out-of-mission sources.

## Changes

The mod updates `DT_PlayerJokers` so these enabled mission-only Unique Jokers can be bought and found through Gamba like other Jokers of their tier:

- `jokerCamper`
- `jokerGiant`
- `jokerDwarf`
- `jokerExtraDash`

It also enables Gamba for enabled purchase-only rows that were blocked from Gamba, including:

- `jokerShroomGrave`
- `jokerCactusDay`
- `jokerFistFight`

The script applies the same Gamba change to the other enabled rows with `canBeBought=true` and `canBeGambled=false`. Disabled and upgrade-only Joker rows are left unchanged.

## Build

From this folder:

```powershell
node ScriptUtils\patch_unrestrictive_jokers.js
& "$PWD\..\UAssetGUI.exe" fromjson "$PWD\ScriptUtils\patched\DT_PlayerJokers_35.json" "$PWD\ModStage\FarFarWest\Content\Progress\DT_PlayerJokers.uasset" 35
& 'C:\UE_5.7\Engine\Binaries\Win64\UnrealPak.exe' "$PWD\ModBuild\pakchunk99-UnrestrictiveJokers-Windows_P.pak" -Create="$PWD\ScriptUtils\UnrestrictiveJokers_PakList.txt"
..\retoc\retoc.exe to-zen ModBuild\pakchunk99-UnrestrictiveJokers-Windows_P.pak ModBuild\pakchunk99-UnrestrictiveJokers-Windows_P.utoc --version UE5_7
```

Install this triplet into `FarFarWest\Content\Paks\~mods`:

```text
ModBuild/pakchunk99-UnrestrictiveJokers-Windows_P.pak
ModBuild/pakchunk99-UnrestrictiveJokers-Windows_P.ucas
ModBuild/pakchunk99-UnrestrictiveJokers-Windows_P.utoc
```
