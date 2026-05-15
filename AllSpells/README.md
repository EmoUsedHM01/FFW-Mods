# All Spells

Far Far West mod: sets every non-starting spell's `requiredMinimumLevel` to `1`, so all spells across Acid, Cactus, Electric, Fire, and Voodoo are available from the start.

## Build

From this folder:

```powershell
node ScriptUtils\patch_all_spells.js
Get-ChildItem ScriptUtils\patched -Filter "*_35.json" | ForEach-Object { $assetName = $_.BaseName -replace "_35$",""; ..\UAssetGUI.exe fromjson $_.FullName (Join-Path "ModStage\FarFarWest\Content\Spells" ($assetName + ".uasset")) 35 }
..\retoc\retoc.exe pack-raw RawChunks\raw_mod ModBuild\pakchunk99-AllSpells-Windows_P.utoc
& 'C:\UE_5.7\Engine\Binaries\Win64\UnrealPak.exe' "$PWD\ModBuild\pakchunk99-AllSpells-Windows_P.pak" -Create="$PWD\ScriptUtils\AllSpells_PakList.txt"
```

Install this triplet into `FarFarWest\Content\Paks\~mods`:

```text
ModBuild/pakchunk99-AllSpells-Windows_P.pak
ModBuild/pakchunk99-AllSpells-Windows_P.ucas
ModBuild/pakchunk99-AllSpells-Windows_P.utoc
```

## Notes

Five spells already had level requirement `1`; the patch changes the other 20 spell assets.
