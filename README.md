# FFW Mods

Prebuilt Far Far West mods, rebuilt for **0.3.0.0 - CL 2812** on October 22, 2026.

## Installation

Open the desired mod folder and copy its matching `.pak`, `.ucas`, and `.utoc`
files into `FarFarWest/Content/Paks/~mods`. Files are directly inside each mod
folder in this repository. Keep all three together and replace older versions.

These are pak/IoStore mods, not DLLs. Remove the matching triplet to uninstall.

## Available Mods

- AllSpells
- AlwaysHitWeakpoint
- MergedJokers
- MoreEnemies (x2, x3, x4, x5, x10; install only one multiplier)
- NoFriendlyFire
- NoJokerCaps
- UncappedStatPoints
- UnrestrictiveJokers

Use MergedJokers instead of combining NoJokerCaps and UnrestrictiveJokers: all
three override the same data table. Do not install conflicting table overrides.

## Verification

All 12 bundles pass Retoc container verification and UnrealPak integrity checks.
`release-manifest.json` records SHA-256 hashes for the 36 release files.
Build and static verification do not substitute for gameplay testing; these
builds have not been tested in-game on 0.3.0.0.

NoFriendlyFire now redirects player-caused damage to a validated function return
to address ally weapon damage. Its four explosion-row edits preserve the prior
Gold Ore/wall approach. Test teammate bullets/melee, self/ally spells, Gold Ore
and wall destruction, and enemy/environmental damage before relying on it.

AlwaysHitWeakpoint and UncappedStatPoints now retain generated container headers
alongside their asset overrides.
