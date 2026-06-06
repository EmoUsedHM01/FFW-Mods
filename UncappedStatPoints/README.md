# Uncapped Stat Points

Far Far West mod: raises the equipment stat point cap from 20 to 60. Prestige still adds its normal +5, so prestige-capped items reach 65.

## Build

From this folder:

```powershell
node ScriptUtils\patch_uncapped_stat_points.js
```

The script exports `UI_Equipment_Item` from
`..\FarFarWest_Unpacked_RetocLegacy\FarFarWest\Content\Interfaces\Equipment`,
patches the two stat cap constants from 20 to 60, stages the patched asset, and
rebuilds the full `.pak`/`.ucas`/`.utoc` triplet.

Install this triplet into `FarFarWest\Content\Paks\~mods`:

```text
ModBuild/pakchunk99-UncappedStatPoints-Windows_P.pak
ModBuild/pakchunk99-UncappedStatPoints-Windows_P.ucas
ModBuild/pakchunk99-UncappedStatPoints-Windows_P.utoc
```
