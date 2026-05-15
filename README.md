# FFW Mods

This repository contains Far Far West mods. Each mod lives in its own folder, and the pre-built install files are inside that mod's `ModBuild` directory.

## Installing a Mod

1. Open the folder for the mod you want to install.
2. Open that mod's `ModBuild` folder.
3. Copy everything from `ModBuild` into the game's mods pak folder:

```text
FarFarWest/Content/Paks/~mods
```

If the `~mods` folder does not exist yet, create it inside `FarFarWest/Content/Paks`.

The install files are usually Unreal pak/io store files such as:

```text
*.pak
*.ucas
*.utoc
```

Keep each mod's files together. For example, if a mod has a `.pak`, `.ucas`, and `.utoc` file with matching names, copy all three.

## Available Mods

- `AllSpells`
- `AlwaysHitWeakpoint`
- `BiggerLobbies`
- `CheaperJokers`
- `CheapJokers`
- `MergedJokers`
- `MoreEnemies`
- `NoFriendlyFire`
- `NoJokerCaps`
- `UncappedStatPoints`
- `UnrestrictiveJokers`

## Uninstalling

Remove that mod's copied files from:

```text
FarFarWest/Content/Paks/~mods
```

The source, staging, and build helper files in this repository are not needed for normal installation.
