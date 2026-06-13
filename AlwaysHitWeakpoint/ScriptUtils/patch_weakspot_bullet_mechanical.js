const fs = require("fs");
const path = require("path");
const cp = require("child_process");

const repoRoot = path.resolve(__dirname, "..", "..");
const modRoot = path.resolve(__dirname, "..");
const scriptUtilsDir = path.join(modRoot, "ScriptUtils");

const tools = {
  uassetgui: path.join(repoRoot, "UAssetGUI.exe"),
  retoc: path.join(repoRoot, "retoc", "retoc.exe"),
  unrealPak: "C:\\UE_5.7\\Engine\\Binaries\\Win64\\UnrealPak.exe",
};

const contentRoot = path.join(repoRoot, "FarFarWest_Unpacked_RetocLegacy", "FarFarWest", "Content");
const sourceDir = path.join(scriptUtilsDir, "source_bullet_mechanical");
const jsonOutputDir = path.join(scriptUtilsDir, "patched_bullet_mechanical");
const stageRoot = path.join(modRoot, "ModStageBulletMechanical");
const buildDir = path.join(modRoot, "ModBuild");
const rawOutputRoot = path.join(modRoot, "RawChunks", "raw_mod_bullet_mechanical");
const rawOutputDir = path.join(rawOutputRoot, "chunks");
const toZenProbeRawDir = path.join(modRoot, "RawChunks", "tozen_probe_bullet_mechanical");
const pakListPath = path.join(scriptUtilsDir, "WeakspotEveryHit_BulletMechanical_PakList.txt");
const buildBaseName = "pakchunk99-WeakspotEveryHit-BulletMechanicalProc-Windows_P";
const buildBase = path.join(buildDir, buildBaseName);
const releaseBaseName = "pakchunk99-AlwaysHitWeakpoints-Windows_P";
const releaseBase = path.join(buildDir, releaseBaseName);
const toZenProbeBase = path.join(buildDir, "pakchunk99-WeakspotEveryHit-BulletMechanicalProc-ToZenProbe-Windows_P");
const ueVersion = "UE5_7";
const exportIndex = "35";

const assetSpecs = [
  {
    key: "enemy",
    assetName: "BP_Enemy",
    sourceAsset: path.join(contentRoot, "Enemies", "BP_Enemy.uasset"),
    sourceJson: path.join(sourceDir, "BP_Enemy_35.json"),
    patchedJson: path.join(jsonOutputDir, "BP_Enemy_35.json"),
    stagedAsset: path.join(stageRoot, "FarFarWest", "Content", "Enemies", "BP_Enemy.uasset"),
    mountBase: "../../../FarFarWest/Content/Enemies/BP_Enemy",
  },
  {
    key: "bullet",
    assetName: "BP_PlayerBullet",
    sourceAsset: path.join(contentRoot, "Items", "Assets", "BP_PlayerBullet.uasset"),
    sourceJson: path.join(sourceDir, "BP_PlayerBullet_35.json"),
    patchedJson: path.join(jsonOutputDir, "BP_PlayerBullet_35.json"),
    stagedAsset: path.join(stageRoot, "FarFarWest", "Content", "Items", "Assets", "BP_PlayerBullet.uasset"),
    mountBase: "../../../FarFarWest/Content/Items/Assets/BP_PlayerBullet",
  },
];

const patches = [
  {
    asset: "enemy",
    exportName: "F_ShowDamagesAmount",
    name: "F_ShowDamagesAmount SelectColor pick bool Critical -> IsValid",
    offset: 0x874,
    expectedName: "Critical",
    replacementName: "CallFunc_IsValid_ReturnValue",
  },
  {
    asset: "bullet",
    exportName: "F_ApplyDamages",
    name: "F_ApplyDamages output Critical source isCritical -> IsValid",
    offset: 0x1095,
    expectedName: "isCritical",
    replacementName: "CallFunc_IsValid_ReturnValue",
  },
  {
    asset: "bullet",
    exportName: "F_ApplyDamages",
    name: "F_ApplyDamages F_HitMarkerRequest Critical param isCritical -> IsValid",
    offset: 0x1ec7,
    expectedName: "isCritical",
    replacementName: "CallFunc_IsValid_ReturnValue",
  },
  {
    asset: "bullet",
    exportName: "F_ApplyDamages",
    name: "F_ApplyDamages F_ApplyImpactDamages Critical param isCritical -> IsValid",
    offset: 0x2249,
    expectedName: "isCritical",
    replacementName: "CallFunc_IsValid_ReturnValue",
  },
];

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
  for (const base of [buildBase, releaseBase, toZenProbeBase]) {
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

function patchNameReference(buffer, offset, expectedIndex, replacementIndex, label) {
  const prefix = Buffer.from("0001000000", "hex");
  const foundPrefix = buffer.subarray(offset, offset + prefix.length);
  if (!foundPrefix.equals(prefix)) {
    throw new Error(
      `${label}: expected name ref prefix ${prefix.toString("hex")} at 0x${offset.toString(16)}, ` +
        `found ${foundPrefix.toString("hex")}`
    );
  }

  const foundIndex = buffer.readUInt32LE(offset + prefix.length);
  if (foundIndex !== expectedIndex) {
    throw new Error(
      `${label}: expected name index ${expectedIndex} at 0x${(offset + prefix.length).toString(16)}, ` +
        `found ${foundIndex}`
    );
  }

  buffer.writeUInt32LE(replacementIndex, offset + prefix.length);
}

function loadJsonExport(jsonPath, exportName) {
  const asset = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
  const exportEntry = (asset.Exports || []).find((entry) => entry.ObjectName === exportName);
  if (!exportEntry || typeof exportEntry.Data !== "string") {
    throw new Error(`${path.basename(jsonPath)}: raw export ${exportName} not found`);
  }
  return { asset, exportEntry };
}

function nameIndex(asset, name, jsonPath) {
  const index = (asset.NameMap || []).indexOf(name);
  if (index < 0) {
    throw new Error(`${path.basename(jsonPath)}: name ${name} not found in NameMap`);
  }
  return index;
}

function patchJson(spec) {
  const { asset, exportEntry } = loadJsonExport(spec.sourceJson, patches.find((patch) => patch.asset === spec.key).exportName);
  const patchesForAsset = patches.filter((patch) => patch.asset === spec.key);

  for (const patch of patchesForAsset) {
    const currentExport = exportEntry.ObjectName === patch.exportName
      ? exportEntry
      : (asset.Exports || []).find((entry) => entry.ObjectName === patch.exportName);
    if (!currentExport || typeof currentExport.Data !== "string") {
      throw new Error(`${path.basename(spec.sourceJson)}: raw export ${patch.exportName} not found`);
    }

    const data = Buffer.from(currentExport.Data, "base64");
    const expectedIndex = nameIndex(asset, patch.expectedName, spec.sourceJson);
    const replacementIndex = nameIndex(asset, patch.replacementName, spec.sourceJson);

    const before = data.subarray(patch.offset, patch.offset + 17).toString("hex");
    patchNameReference(data, patch.offset, expectedIndex, replacementIndex, patch.name);
    const after = data.subarray(patch.offset, patch.offset + 17).toString("hex");
    currentExport.Data = data.toString("base64");
    console.log(
      `${patch.name}: json 0x${patch.offset.toString(16)} ` +
        `${patch.expectedName}->${patch.replacementName} ` +
        `(${before} -> ${after})`
    );
  }

  fs.mkdirSync(path.dirname(spec.patchedJson), { recursive: true });
  fs.writeFileSync(spec.patchedJson, JSON.stringify(asset, null, 2));
}

function findExportBundleChunkIds(utocPath) {
  const output = capture(tools.retoc, ["list", utocPath]);
  const matches = output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.includes(" ExportBundleData"));

  if (matches.length !== assetSpecs.length) {
    throw new Error(`Expected ${assetSpecs.length} ExportBundleData chunks in ${utocPath}, found ${matches.length}.`);
  }

  return matches.map((match) => {
    const parts = match.split(/\s+/);
    if (parts.length < 2 || !/^[0-9a-f]+$/i.test(parts[1])) {
      throw new Error(`Could not parse ExportBundleData chunk id from: ${match}`);
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

function writePakList() {
  const lines = [];
  for (const spec of assetSpecs) {
    const stagedBase = spec.stagedAsset.replace(/\.uasset$/i, "");
    for (const ext of [".uasset", ".uexp"]) {
      lines.push(`"${`${stagedBase}${ext}`.replaceAll("\\", "/")}" "${spec.mountBase}${ext}"`);
    }
  }
  fs.writeFileSync(pakListPath, `${lines.join("\n")}\n`);
}

function writeReleaseCopies() {
  for (const ext of [".pak", ".ucas", ".utoc"]) {
    fs.copyFileSync(`${buildBase}${ext}`, `${releaseBase}${ext}`);
  }
}

function main() {
  requireFile(tools.uassetgui);
  requireFile(tools.retoc);
  requireFile(tools.unrealPak);
  for (const spec of assetSpecs) {
    requireFile(spec.sourceAsset);
  }

  cleanDir(sourceDir);
  cleanDir(jsonOutputDir);
  cleanDir(stageRoot);
  cleanDir(rawOutputDir);
  cleanBuildOutputs();

  for (const spec of assetSpecs) {
    run(tools.uassetgui, ["tojson", spec.sourceAsset, spec.sourceJson, exportIndex]);
    patchJson(spec);
    fs.mkdirSync(path.dirname(spec.stagedAsset), { recursive: true });
    run(tools.uassetgui, ["fromjson", spec.patchedJson, spec.stagedAsset]);
  }

  run(tools.retoc, ["to-zen", "--version", ueVersion, stageRoot, `${toZenProbeBase}.utoc`]);
  const exportBundleChunkIds = findExportBundleChunkIds(`${toZenProbeBase}.utoc`);
  run(tools.retoc, ["unpack-raw", `${toZenProbeBase}.utoc`, toZenProbeRawDir]);

  writeRawManifest();
  for (const exportBundleChunkId of exportBundleChunkIds) {
    fs.copyFileSync(
      path.join(toZenProbeRawDir, "chunks", exportBundleChunkId),
      path.join(rawOutputDir, exportBundleChunkId)
    );
  }

  run(tools.retoc, ["pack-raw", rawOutputRoot, `${buildBase}.utoc`]);
  writePakList();
  run(tools.unrealPak, [`${buildBase}.pak`, `-Create=${pakListPath}`]);
  cleanProbeOutputs();

  for (const ext of [".pak", ".ucas", ".utoc"]) {
    requireFile(`${buildBase}${ext}`);
  }
  writeReleaseCopies();
  for (const ext of [".pak", ".ucas", ".utoc"]) {
    requireFile(`${releaseBase}${ext}`);
  }

  console.log("");
  console.log("AlwaysHitWeakpoint rebuilt with current BP_Enemy and BP_PlayerBullet assets.");
  console.log(`Raw override chunks: ${exportBundleChunkIds.join(", ")}`);
  console.log(`Output: ${buildBase}.pak/.ucas/.utoc`);
  console.log(`Release copy: ${releaseBase}.pak/.ucas/.utoc`);
}

main();
