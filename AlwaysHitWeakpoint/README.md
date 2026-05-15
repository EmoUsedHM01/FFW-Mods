# AlwaysHitWeakpoint

Far Far West mod: body hits count mechanically as weakspot hits for player bullets, with weakspot-colored damage text.

## Current Working Build

Use this triplet:

```text
ModBuild/pakchunk99-WeakspotEveryHit-BulletMechanicalProc-Windows_P.pak
ModBuild/pakchunk99-WeakspotEveryHit-BulletMechanicalProc-Windows_P.ucas
ModBuild/pakchunk99-WeakspotEveryHit-BulletMechanicalProc-Windows_P.utoc
```

Installed active names should share one base name, for example:

```text
pakchunk99-WeakspotEveryHit-Windows_P.pak
pakchunk99-WeakspotEveryHit-Windows_P.ucas
pakchunk99-WeakspotEveryHit-Windows_P.utoc
```

## Layout

```text
ScriptUtils/                  Patch scripts, source JSON exports, patched JSON, pak lists
RawChunks/               Original and patched IoStore chunks
ModBuild/                Built .pak/.ucas/.utoc artifacts
ModStage*/               Staged legacy .uasset/.uexp files for UnrealPak
IoCooked/                Extracted cooked source assets used during analysis
```

Global tools remain one folder up:

```text
../UAssetGUI.exe
../retoc/retoc.exe
C:/UE_5.7/Engine/Binaries/Win64/UnrealPak.exe
```

## Rebuild Current Test

Run from this folder:

```powershell
node ScriptUtils\patch_weakspot_bullet_mechanical.js
..\UAssetGUI.exe fromjson ScriptUtils\patched_bullet_mechanical\BP_Enemy_35.json ModStageBulletMechanical\FarFarWest\Content\Enemies\BP_Enemy.uasset 35
..\UAssetGUI.exe fromjson ScriptUtils\patched_bullet_mechanical\BP_PlayerBullet_35.json ModStageBulletMechanical\FarFarWest\Content\Items\Assets\BP_PlayerBullet.uasset 35
..\retoc\retoc.exe pack-raw RawChunks\raw_mod_bullet_mechanical ModBuild\pakchunk99-WeakspotEveryHit-BulletMechanicalProc-Windows_P.utoc
& 'C:\UE_5.7\Engine\Binaries\Win64\UnrealPak.exe' "$PWD\ModBuild\pakchunk99-WeakspotEveryHit-BulletMechanicalProc-Windows_P.pak" -Create="$PWD\ScriptUtils\WeakspotEveryHit_BulletMechanical_PakList.txt"
```

## Current Patch Points

```text
BP_Enemy.F_ShowDamagesAmount
  json 0x874, raw 0x238c6
  Critical -> CallFunc_IsValid_ReturnValue
  0001000000010100000000000056000000 -> 0001000000a70000000000000056000000

BP_PlayerBullet.F_ApplyDamages
  json 0x1095, raw 0xaa57
  output Critical source: isCritical -> CallFunc_IsValid_ReturnValue
  00010000000a0100000000000008000000 -> 0001000000640000000000000008000000

BP_PlayerBullet.F_ApplyDamages
  json 0x1ec7, raw 0xb889
  F_HitMarkerRequest Critical param: isCritical -> CallFunc_IsValid_ReturnValue
  00010000000a0100000000000008000000 -> 0001000000640000000000000008000000

BP_PlayerBullet.F_ApplyDamages
  json 0x2249, raw 0xbc0b
  F_ApplyImpactDamages Critical param: isCritical -> CallFunc_IsValid_ReturnValue
  00010000000a0100000000000008000000 -> 0001000000640000000000000008000000
```

## Notes

Failed branch/jump experiments are kept for reference but should not be reused directly. UE's async loader parses bytecode linearly, so dead bytes after a runtime jump can still crash package loading.
