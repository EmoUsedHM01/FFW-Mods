# More Enemies

Far Far West pak mod that multiplies standard enemy spawns.

## What it changes

- Storm event spawn delays are divided by the selected multiplier, so storm-style timed spawns happen more often.
- Horde spawn lists used by POIs, patrol-style groups, and similar finite enemy groups are expanded by the selected multiplier.

The default build creates `x2`, `x3`, `x4`, `x5`, and `x10` variants. The variant list is controlled by `DEFAULT_MULTIPLIERS` near the top of `ScriptUtils/patch_more_enemies.js`.

## Build

From this folder:

```powershell
node .\ScriptUtils\patch_more_enemies.js
```

To build specific variants only, pass the multipliers:

```powershell
node .\ScriptUtils\patch_more_enemies.js 2 3 4 5 10
```

The script exports the source assets with `UAssetGUI`, patches the exported data, rebuilds staged assets, and packages them with:

```powershell
..\retoc\retoc.exe to-zen --version UE5_7
```

## Install

Copy one generated triplet from `ModBuild` into the game's `FarFarWest\Content\Paks\~mods` folder.

For `x2`:

- `pakchunk99-MoreEnemiesX2-Windows_P.pak`
- `pakchunk99-MoreEnemiesX2-Windows_P.ucas`
- `pakchunk99-MoreEnemiesX2-Windows_P.utoc`

For `x3`:

- `pakchunk99-MoreEnemiesX3-Windows_P.pak`
- `pakchunk99-MoreEnemiesX3-Windows_P.ucas`
- `pakchunk99-MoreEnemiesX3-Windows_P.utoc`

For `x4`:

- `pakchunk99-MoreEnemiesX4-Windows_P.pak`
- `pakchunk99-MoreEnemiesX4-Windows_P.ucas`
- `pakchunk99-MoreEnemiesX4-Windows_P.utoc`

For `x5`:

- `pakchunk99-MoreEnemiesX5-Windows_P.pak`
- `pakchunk99-MoreEnemiesX5-Windows_P.ucas`
- `pakchunk99-MoreEnemiesX5-Windows_P.utoc`

For `x10`:

- `pakchunk99-MoreEnemiesX10-Windows_P.pak`
- `pakchunk99-MoreEnemiesX10-Windows_P.ucas`
- `pakchunk99-MoreEnemiesX10-Windows_P.utoc`

Keep each variant's three files together. Install only one multiplier variant at a time.
