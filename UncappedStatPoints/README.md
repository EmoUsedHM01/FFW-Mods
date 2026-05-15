# Uncapped Stat Points

Far Far West mod: raises the equipment stat point cap from 20 to 60. Prestige still adds its normal +5, so prestige-capped items reach 65.

## Build

From this folder:

```powershell
node ScriptUtils\patch_uncapped_stat_points.js
..\UAssetGUI.exe fromjson ScriptUtils\patched\UI_Equipment_Item_35.json ModStage\FarFarWest\Content\Interfaces\Equipment\UI_Equipment_Item.uasset 35
..\retoc\retoc.exe pack-raw RawChunks\raw_mod ModBuild\pakchunk99-UncappedStatPoints-Windows_P.utoc
& 'C:\UE_5.7\Engine\Binaries\Win64\UnrealPak.exe' "$PWD\ModBuild\pakchunk99-UncappedStatPoints-Windows_P.pak" -Create="$PWD\ScriptUtils\UncappedStatPoints_PakList.txt"
```

Install this triplet into `FarFarWest\Content\Paks\~mods`:

```text
ModBuild/pakchunk99-UncappedStatPoints-Windows_P.pak
ModBuild/pakchunk99-UncappedStatPoints-Windows_P.ucas
ModBuild/pakchunk99-UncappedStatPoints-Windows_P.utoc
```
