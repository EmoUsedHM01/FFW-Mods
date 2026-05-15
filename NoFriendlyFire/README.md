# No Friendly Fire

Far Far West pak mod that blocks player-to-player damage.

## What It Changes

`BP_Player.F_ServerDamages` now redirects player-caused damage branches to the original no-damage return path:

- player-controlled pawn causer, used by bullets, direct spell hits, and self spell damage
- `BP_PlayerState` causer, used by spell damage paths

The pawn path reuses the existing `Causer != Self` branch by changing the comparison operand from `Self` to `NoObject`, so self-caused player damage takes the same no-damage branch as ally-caused player damage. This stops player-caused friendly-fire health damage before the normal damage feedback path, including the red damage flash, without inserting new Blueprint bytecode or changing bytecode length.

Enemy, trap, and environmental damage are left on the original `BP_Player` damage path because those cases do not take the redirected player-causer branches.

## Build

From this folder:

```powershell
node .\ScriptUtils\patch_no_friendly_fire.js
```

The script exports `BP_Player` with `UAssetGUI`, patches the damage-event bytecode, rebuilds the staged cooked asset, and packages the mod with:

```powershell
..\retoc\retoc.exe to-zen --version UE5_7
```

## Install

Copy the generated triplet from `ModBuild` into the game's `FarFarWest\Content\Paks\~mods` folder:

- `pakchunk99-NoFriendlyFire-Windows_P.pak`
- `pakchunk99-NoFriendlyFire-Windows_P.ucas`
- `pakchunk99-NoFriendlyFire-Windows_P.utoc`

Keep all three files together.
