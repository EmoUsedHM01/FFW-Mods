# Cheap Jokers

Far Far West mod: changes Joker slot cost by rarity so every Joker requires 1 slot.

## Build

From this folder:

```powershell
node ScriptUtils\patch_cheap_jokers.js
..\UAssetGUI.exe fromjson ScriptUtils\patched\BPFL_PlayerDatas_35.json ModStage\FarFarWest\Content\Gamework\BPFL_PlayerDatas.uasset 35
..\retoc\retoc.exe pack-raw RawChunks\raw_mod ModBuild\pakchunk99-CheapJokers-Windows_P.utoc
& 'C:\UE_5.7\Engine\Binaries\Win64\UnrealPak.exe' "$PWD\ModBuild\pakchunk99-CheapJokers-Windows_P.pak" -Create="$PWD\ScriptUtils\CheapJokers_PakList.txt"
```

Install this triplet into `FarFarWest\Content\Paks\~mods`:

```text
ModBuild/pakchunk99-CheapJokers-Windows_P.pak
ModBuild/pakchunk99-CheapJokers-Windows_P.ucas
ModBuild/pakchunk99-CheapJokers-Windows_P.utoc
```
