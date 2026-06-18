# AlwaysHitWeakpoint

Far Far West mod: body hits count mechanically as weakspot hits for player bullets, with weakspot-colored damage text.

## Current Working Build

Use this triplet:

```text
ModBuild/pakchunk99-AlwaysHitWeakpoints-Windows_P.pak
ModBuild/pakchunk99-AlwaysHitWeakpoints-Windows_P.ucas
ModBuild/pakchunk99-AlwaysHitWeakpoints-Windows_P.utoc
```

The script also keeps the internal analysis triplet:

```text
ModBuild/pakchunk99-WeakspotEveryHit-BulletMechanicalProc-Windows_P.pak
ModBuild/pakchunk99-WeakspotEveryHit-BulletMechanicalProc-Windows_P.ucas
ModBuild/pakchunk99-WeakspotEveryHit-BulletMechanicalProc-Windows_P.utoc
```

## Layout

```text
ScriptUtils/                  Patch scripts, source JSON exports, patched JSON, pak lists
RawChunks/               Derived raw IoStore override chunks
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
```

The script exports current assets from `../FarFarWest_Unpacked_RetocLegacy`, patches JSON bytecode, rebuilds staged legacy assets, converts the stage to Zen, extracts the derived `ExportBundleData` chunks, and packages the final mod.

## Current Patch Points

```text
BP_Enemy.F_ShowDamagesAmount
  json 0x874
  Critical -> CallFunc_IsValid_ReturnValue
  0001000000110100000000000057000000 -> 0001000000ad0000000000000057000000

BP_PlayerBullet.F_ApplyDamages
  json 0x1095
  output Critical source: isCritical -> CallFunc_IsValid_ReturnValue
  0001000000120100000000000008000000 -> 0001000000670000000000000008000000

BP_PlayerBullet.F_ApplyDamages
  json 0x1ec7
  F_HitMarkerRequest Critical param: isCritical -> CallFunc_IsValid_ReturnValue
  0001000000120100000000000008000000 -> 0001000000670000000000000008000000

BP_PlayerBullet.F_ApplyDamages
  json 0x2249
  F_ApplyImpactDamages Critical param: isCritical -> CallFunc_IsValid_ReturnValue
  0001000000120100000000000008000000 -> 0001000000670000000000000008000000
```

Raw offsets and trailing ref bytes are no longer hard-coded. The rebuild derives the current Zen chunks with `retoc to-zen` and copies the resulting `ExportBundleData` chunks into `RawChunks/raw_mod_bullet_mechanical`.

## Notes

Failed branch/jump experiments are kept for reference but should not be reused directly. UE's async loader parses bytecode linearly, so dead bytes after a runtime jump can still crash package loading.
