# No Joker Caps

Far Far West mod: sets every non-upgrade Joker `maxAvailable` value to 10.

Weapon and Hero stat upgrade rows, such as `jokerUpgradeDamage` and `jokerUpgradeHeroSpeed`, are left unchanged.

## Build

From this folder:

```powershell
node ScriptUtils\patch_no_joker_caps.js
..\UAssetGUI.exe fromjson ScriptUtils\patched\DT_PlayerJokers_35.json ModStage\FarFarWest\Content\Progress\DT_PlayerJokers.uasset 35
& 'C:\UE_5.7\Engine\Binaries\Win64\UnrealPak.exe' "$PWD\ModBuild\pakchunk99-NoJokerCaps-Windows_P.pak" -Create="$PWD\ScriptUtils\NoJokerCaps_PakList.txt"
..\retoc\retoc.exe to-zen ModBuild\pakchunk99-NoJokerCaps-Windows_P.pak ModBuild\pakchunk99-NoJokerCaps-Windows_P.utoc --version UE5_7
```

Install this triplet into `FarFarWest\Content\Paks\~mods`:

```text
ModBuild/pakchunk99-NoJokerCaps-Windows_P.pak
ModBuild/pakchunk99-NoJokerCaps-Windows_P.ucas
ModBuild/pakchunk99-NoJokerCaps-Windows_P.utoc
```

## Compatibility

This overrides `FarFarWest/Content/Progress/DT_PlayerJokers`. It can run beside mods that touch other assets, such as `AlwaysHitWeakpoint` and `UncappedStatPoints`. It will conflict with any other mod that also overrides `DT_PlayerJokers` unless the changes are merged into one asset.
