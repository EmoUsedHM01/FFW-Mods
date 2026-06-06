const fs = require("fs");
const path = require("path");
const cp = require("child_process");

const modRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(modRoot, "..");
const scriptUtilsDir = path.join(modRoot, "ScriptUtils");

const tools = {
  uassetgui: path.join(repoRoot, "UAssetGUI.exe"),
  retoc: path.join(repoRoot, "retoc", "retoc.exe"),
  unrealPak: "C:\\UE_5.7\\Engine\\Binaries\\Win64\\UnrealPak.exe",
};

const ueVersion = "UE5_7";
const exportIndex = "35";
const assetDir = "Spells";
const contentRoot = path.join(repoRoot, "FarFarWest_Unpacked_RetocLegacy", "FarFarWest", "Content");
const stageRoot = path.join(modRoot, "ModStage");
const buildDir = path.join(modRoot, "ModBuild");
const buildBaseName = "pakchunk99-AllSpells-Windows_P";
const buildBase = path.join(buildDir, buildBaseName);
const toZenProbeBase = path.join(buildDir, "pakchunk99-AllSpells-ToZenProbe-Windows_P");
const rawOutputRoot = path.join(modRoot, "RawChunks", "raw_mod");
const rawOutputDir = path.join(rawOutputRoot, "chunks");
const toZenProbeRawDir = path.join(modRoot, "RawChunks", "tozen_probe");
const jsonOutputDir = path.join(scriptUtilsDir, "patched");
const pakListPath = path.join(scriptUtilsDir, "AllSpells_PakList.txt");

const assets = [
  "BP_Item_SpellCast_Acid_Bubble",
  "BP_Item_SpellCast_Acid_Contagion",
  "BP_Item_SpellCast_Acid_Geyser",
  "BP_Item_SpellCast_Acid_Rain",
  "BP_Item_SpellCast_Acid_Thrower",
  "BP_Item_SpellCast_Cactus_Betty",
  "BP_Item_SpellCast_Cactus_Decoy",
  "BP_Item_SpellCast_Cactus_Turret",
  "BP_Item_SpellCast_Cactus_Ulti",
  "BP_Item_SpellCast_Cactus_Wall",
  "BP_Item_SpellCast_Elec_Portal",
  "BP_Item_SpellCast_Elec_Strike",
  "BP_Item_SpellCast_Elec_SuperJump",
  "BP_Item_SpellCast_Elec_Swap",
  "BP_Item_SpellCast_Elec_ThunderStrike",
  "BP_Item_SpellCast_Fire_Ball",
  "BP_Item_SpellCast_Fire_Beam",
  "BP_Item_SpellCast_Fire_Fingergun",
  "BP_Item_SpellCast_Fire_Surcharge",
  "BP_Item_SpellCast_Fire_Wisp",
  "BP_Item_SpellCast_Voodoo_Corruption",
  "BP_Item_SpellCast_Voodoo_Doll",
  "BP_Item_SpellCast_Voodoo_Drain",
  "BP_Item_SpellCast_Voodoo_Heal",
  "BP_Item_SpellCast_Voodoo_HealArea",
];

const expectedLevels = new Set([1, 4, 7, 8, 12, 20, 35]);
const intOne = Buffer.from("01000000", "hex");

function run(command, args, options = {}) {
  console.log(`> ${[command, ...args].map((arg) => (/\s/.test(arg) ? `"${arg}"` : arg)).join(" ")}`);
  cp.execFileSync(command, args, { stdio: "inherit", ...options });
}

function capture(command, args, options = {}) {
  return cp.execFileSync(command, args, { encoding: "utf8", ...options });
}

function requireFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing required file: ${filePath}`);
  }
}

function cleanDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
}

function cleanBuildOutputs() {
  fs.mkdirSync(buildDir, { recursive: true });
  for (const base of [buildBase, toZenProbeBase]) {
    for (const ext of [".pak", ".ucas", ".utoc"]) {
      fs.rmSync(`${base}${ext}`, { force: true });
    }
  }
}

function cleanProbeOutputs() {
  for (const ext of [".pak", ".ucas", ".utoc"]) {
    fs.rmSync(`${toZenProbeBase}${ext}`, { force: true });
  }
  fs.rmSync(toZenProbeRawDir, { recursive: true, force: true });
}

function sourceAssetPath(assetName) {
  return path.join(contentRoot, assetDir, `${assetName}.uasset`);
}

function sourceJsonPath(assetName) {
  return path.join(scriptUtilsDir, `${assetName}_${exportIndex}.json`);
}

function patchedJsonPath(assetName) {
  return path.join(jsonOutputDir, `${assetName}_${exportIndex}.json`);
}

function stagedAssetPath(assetName) {
  return path.join(stageRoot, "FarFarWest", "Content", assetDir, `${assetName}.uasset`);
}

function findLevelOffset(assetName, data) {
  const marker = Buffer.from("_Name\0", "ascii");
  const nameEnd = data.lastIndexOf(marker) + marker.length;
  if (nameEnd < marker.length) {
    throw new Error(`${assetName}: title text marker not found`);
  }

  const candidates = [nameEnd + 5, nameEnd + 4];
  for (const offset of candidates) {
    if (offset + 4 > data.length) continue;
    const value = data.readInt32LE(offset);
    if (expectedLevels.has(value)) {
      return { offset, value };
    }
  }

  throw new Error(`${assetName}: requiredMinimumLevel not found near title text tail`);
}

function getDefaultExport(asset, assetName) {
  const exportName = `Default__${assetName}_C`;
  const exportEntry = asset.Exports.find((entry) => entry.ObjectName === exportName);
  if (!exportEntry || typeof exportEntry.Data !== "string") {
    throw new Error(`${assetName}: ${exportName} raw export not found`);
  }
  return exportEntry;
}

function patchAsset(assetName) {
  const jsonInput = sourceJsonPath(assetName);
  const asset = JSON.parse(fs.readFileSync(jsonInput, "utf8"));
  const exportEntry = getDefaultExport(asset, assetName);
  const data = Buffer.from(exportEntry.Data, "base64");
  const { offset, value } = findLevelOffset(assetName, data);

  if (value === 1) {
    console.log(`${assetName}: requiredMinimumLevel already 1`);
    return null;
  }

  intOne.copy(data, offset);
  exportEntry.Data = data.toString("base64");
  fs.writeFileSync(patchedJsonPath(assetName), JSON.stringify(asset, null, 2));

  console.log(`${assetName}: requiredMinimumLevel ${value} -> 1 (json 0x${offset.toString(16)})`);
  return { assetName, oldLevel: value, offset };
}

function verifyPatchedAsset(patch) {
  const asset = JSON.parse(fs.readFileSync(patchedJsonPath(patch.assetName), "utf8"));
  const exportEntry = getDefaultExport(asset, patch.assetName);
  const data = Buffer.from(exportEntry.Data, "base64");
  const value = data.readInt32LE(patch.offset);
  if (value !== 1) {
    throw new Error(`${patch.assetName}: verification failed at 0x${patch.offset.toString(16)}: found ${value}`);
  }
}

function findRawOverrideChunkIds(utocPath, expectedExportBundleCount) {
  const output = capture(tools.retoc, ["list", utocPath]);
  const matches = output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.includes(" ExportBundleData") || line.includes(" ContainerHeader"));

  const exportBundleMatches = matches.filter((line) => line.includes(" ExportBundleData"));
  if (exportBundleMatches.length !== expectedExportBundleCount) {
    throw new Error(
      `Expected ${expectedExportBundleCount} ExportBundleData chunks in ${utocPath}, found ${exportBundleMatches.length}.`
    );
  }

  if (matches.length === 0) {
    throw new Error(`Expected raw override chunks in ${utocPath}, found none.`);
  }

  return matches.map((match) => {
    const parts = match.split(/\s+/);
    if (parts.length < 2 || !/^[0-9a-f]+$/i.test(parts[1])) {
      throw new Error(`Could not parse chunk id from: ${match}`);
    }
    return parts[1];
  });
}

function writeRawManifest() {
  fs.writeFileSync(
    path.join(rawOutputRoot, "manifest.json"),
    JSON.stringify({ chunk_paths: {}, version: "ReplaceIoChunkHashWithIoHash", mount_point: "../../../" }, null, 2)
  );
}

function writePakList(changedAssets) {
  const lines = [];
  for (const { assetName } of changedAssets) {
    const stagedBase = stagedAssetPath(assetName).replace(/\.uasset$/i, "");
    const mountBase = `../../../FarFarWest/Content/${assetDir}/${assetName}`;
    for (const ext of [".uasset", ".uexp"]) {
      lines.push(`"${`${stagedBase}${ext}`.replaceAll("\\", "/")}" "${mountBase}${ext}"`);
    }
  }
  fs.writeFileSync(pakListPath, `${lines.join("\n")}\n`);
}

function main() {
  requireFile(tools.uassetgui);
  requireFile(tools.retoc);
  requireFile(tools.unrealPak);
  for (const assetName of assets) {
    requireFile(sourceAssetPath(assetName));
  }

  cleanDir(jsonOutputDir);
  cleanDir(stageRoot);
  cleanDir(rawOutputDir);
  fs.rmSync(toZenProbeRawDir, { recursive: true, force: true });
  cleanBuildOutputs();

  const changedAssets = [];

  for (const assetName of assets) {
    run(tools.uassetgui, ["tojson", sourceAssetPath(assetName), sourceJsonPath(assetName), exportIndex]);
    const patch = patchAsset(assetName);
    if (!patch) continue;

    verifyPatchedAsset(patch);
    changedAssets.push(patch);

    fs.mkdirSync(path.dirname(stagedAssetPath(assetName)), { recursive: true });
    run(tools.uassetgui, ["fromjson", patchedJsonPath(assetName), stagedAssetPath(assetName), exportIndex]);
  }

  if (changedAssets.length === 0) {
    throw new Error("No spell assets needed patching; refusing to build an empty mod.");
  }

  run(tools.retoc, ["to-zen", "--version", ueVersion, stageRoot, `${toZenProbeBase}.utoc`]);
  const rawOverrideChunkIds = findRawOverrideChunkIds(`${toZenProbeBase}.utoc`, changedAssets.length);
  run(tools.retoc, ["unpack-raw", `${toZenProbeBase}.utoc`, toZenProbeRawDir]);

  writeRawManifest();
  for (const rawOverrideChunkId of rawOverrideChunkIds) {
    fs.copyFileSync(
      path.join(toZenProbeRawDir, "chunks", rawOverrideChunkId),
      path.join(rawOutputDir, rawOverrideChunkId)
    );
  }

  run(tools.retoc, ["pack-raw", rawOutputRoot, `${buildBase}.utoc`]);
  writePakList(changedAssets);
  run(tools.unrealPak, [`${buildBase}.pak`, `-Create=${pakListPath}`]);
  cleanProbeOutputs();

  for (const ext of [".pak", ".ucas", ".utoc"]) {
    requireFile(`${buildBase}${ext}`);
  }

  console.log("");
  console.log(`AllSpells rebuilt from current game assets; patched ${changedAssets.length} spell assets.`);
  console.log(`Raw override chunks: ${rawOverrideChunkIds.join(", ")}`);
  console.log(`Output: ${buildBase}.pak/.ucas/.utoc`);
}

main();
