# Bigger Lobbies

Far Far West mod: raises session/lobby capacity from 4 players to 16.

## Changes

- `BP_Manager_Multiplayer`: default Steam session `maxPlayers` is `16`.
- `BP_PlayerState`: auto-kick now triggers at player count `17` instead of `5`.
- `DefaultGame.ini`: `[/Script/Engine.GameSession] MaxPlayers=16`.
- `UI_Menu_Container_CurrentSession`: invite-slot loop last index `3` -> `15`.
- Ghost Train: the current game build moved this scaling to `F_LerpWithPlayerAmount`, which already clamps player amount to 4, so the old train bytecode patch is no longer packaged.
- `BP_TntMissileLauncher`: Rocket Launch player-count selects above 4 reuse the 4-player window/scale tuning.
- `BP_CursedPumpkin`: player-count select above 4 reuses the 4-player tuning.
- `BP_KwartPillarButton`: player-count select above 4 reuses the 4-player tuning.
- `BP_Gauge_DrillMachine`: player-count select above 4 reuses the 4-player tuning.
- `BP_MemoryObjective_RandomRecipe`: recipe pool player-count selects above 4 reuse the 4-player tuning.

## Build

From this folder:

```powershell
node ScriptUtils\patch_bigger_lobbies.js
..\UAssetGUI.exe fromjson ScriptUtils\patched\BP_Manager_Multiplayer_35.json ModStage\FarFarWest\Content\Gamework\BP_Manager_Multiplayer.uasset 35
..\UAssetGUI.exe fromjson ScriptUtils\patched\BP_PlayerState_35.json ModStage\FarFarWest\Content\Player\BP_PlayerState.uasset 35
..\UAssetGUI.exe fromjson ScriptUtils\patched\UI_Menu_Container_CurrentSession_35.json ModStage\FarFarWest\Content\Interfaces\MainMenu\UI_Menu_Container_CurrentSession.uasset 35
..\UAssetGUI.exe fromjson ScriptUtils\patched\BP_TntMissileLauncher_35.json ModStage\FarFarWest\Content\Objectives\Assets\TntMissile\BP_TntMissileLauncher.uasset 35
..\UAssetGUI.exe fromjson ScriptUtils\patched\BP_CursedPumpkin_35.json ModStage\FarFarWest\Content\Objectives\Assets\Pumpkins\BP_CursedPumpkin.uasset 35
..\UAssetGUI.exe fromjson ScriptUtils\patched\BP_KwartPillarButton_35.json ModStage\FarFarWest\Content\Objectives\Assets\Batteries\BP_KwartPillarButton.uasset 35
..\UAssetGUI.exe fromjson ScriptUtils\patched\BP_Gauge_DrillMachine_35.json ModStage\FarFarWest\Content\Objectives\Assets\DrillingMachine\BP_Gauge_DrillMachine.uasset 35
..\UAssetGUI.exe fromjson ScriptUtils\patched\BP_MemoryObjective_RandomRecipe_35.json ModStage\FarFarWest\Content\Objectives\Assets\Alkemisto\BP_MemoryObjective_RandomRecipe.uasset 35
..\retoc\retoc.exe pack-raw RawChunks\raw_mod ModBuild\pakchunk99-BiggerLobbies-Windows_P.utoc
& 'C:\UE_5.7\Engine\Binaries\Win64\UnrealPak.exe' "$PWD\ModBuild\pakchunk99-BiggerLobbies-Windows_P.pak" -Create="$PWD\ScriptUtils\BiggerLobbies_PakList.txt"
```

Install this triplet into `FarFarWest\Content\Paks\~mods`:

```text
ModBuild/pakchunk99-BiggerLobbies-Windows_P.pak
ModBuild/pakchunk99-BiggerLobbies-Windows_P.ucas
ModBuild/pakchunk99-BiggerLobbies-Windows_P.utoc
```
