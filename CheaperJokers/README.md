# Cheap-er Jokers

Far Far West mod: halves Joker slot cost by rarity, rounding up.

Original rarity costs:

```text
5, 5, 4, 3, 2, 1
```

Patched costs:

```text
3, 3, 2, 2, 1, 1
```

## Build

From this folder:

```powershell
node ScriptUtils\patch_cheaper_jokers.js
..\retoc\retoc.exe pack-raw RawChunks\raw_mod ModBuild\pakchunk99-CheaperJokers-Windows_P.utoc
& 'C:\UE_5.7\Engine\Binaries\Win64\UnrealPak.exe' "$PWD\ModBuild\pakchunk99-CheaperJokers-Windows_P.pak" -Create="$PWD\ScriptUtils\CheaperJokers_PakList.txt"
```

Install this triplet into `FarFarWest\Content\Paks\~mods`:

```text
ModBuild/pakchunk99-CheaperJokers-Windows_P.pak
ModBuild/pakchunk99-CheaperJokers-Windows_P.ucas
ModBuild/pakchunk99-CheaperJokers-Windows_P.utoc
```
