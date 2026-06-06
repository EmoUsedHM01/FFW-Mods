const fs = require("fs");
const path = require("path");
const cp = require("child_process");

const modRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(modRoot, "..");

const tools = {
  uassetgui: path.join(repoRoot, "UAssetGUI.exe"),
  retoc: path.join(repoRoot, "retoc", "retoc.exe"),
  unrealPak: "C:\\UE_5.7\\Engine\\Binaries\\Win64\\UnrealPak.exe",
};

const ueVersion = "UE5_7";
const assetName = "UI_Equipment_Item";
const assetDir = path.join("Interfaces", "Equipment");
const exportIndex = "35";
const exportName = "F_UpdatePriceAndUpgradesAmount";
const buildBaseName = "pakchunk99-UncappedStatPoints-Windows_P";
const toZenProbeBaseName = "pakchunk99-UncappedStatPoints-ToZenProbe-Windows_P";

const contentRoot = path.join(repoRoot, "FarFarWest_Unpacked_RetocLegacy", "FarFarWest", "Content");
const sourceAsset = path.join(contentRoot, assetDir, `${assetName}.uasset`);
const scriptUtilsDir = path.join(modRoot, "ScriptUtils");
const sourceDir = path.join(scriptUtilsDir, "source");
const patchedDir = path.join(scriptUtilsDir, "patched");
const sourceJson = path.join(sourceDir, `${assetName}_${exportIndex}.json`);
const patchedJson = path.join(patchedDir, `${assetName}_${exportIndex}.json`);
const stageRoot = path.join(modRoot, "ModStage");
const stagedAsset = path.join(stageRoot, "FarFarWest", "Content", assetDir, `${assetName}.uasset`);
const buildDir = path.join(modRoot, "ModBuild");
const buildBase = path.join(buildDir, buildBaseName);
const toZenProbeBase = path.join(buildDir, toZenProbeBaseName);
const rawOutputRoot = path.join(modRoot, "RawChunks", "raw_mod");
const rawOutputDir = path.join(rawOutputRoot, "chunks");
const toZenProbeRawDir = path.join(modRoot, "RawChunks", "tozen_probe");
const pakListPath = path.join(scriptUtilsDir, "UncappedStatPoints_PakList.txt");

const intConst20 = Buffer.from("1d14000000", "hex");
const intConst60 = Buffer.from("1d3c000000", "hex");
const expectedPatchCount = 2;

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
}

function findAll(data, needle) {
  const offsets = [];
  let offset = data.indexOf(needle);
  while (offset >= 0) {
    offsets.push(offset);
    offset = data.indexOf(needle, offset + 1);
  }
  return offsets;
}

function loadExport(jsonPath, wantedExportName) {
  const json = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
  const exports = json.Exports || json.exports || [];
  const assetExport = exports.find((entry) => entry.ObjectName === wantedExportName || entry.Name === wantedExportName);
  if (!assetExport || typeof assetExport.Data !== "string") {
    throw new Error(`${assetName}: ${wantedExportName} raw export not found in ${jsonPath}`);
  }
  return { json, assetExport };
}

function patchStatCaps(assetExport) {
  const data = Buffer.from(assetExport.Data, "base64");
  const offsets = findAll(data, intConst20);

  if (offsets.length !== expectedPatchCount) {
    throw new Error(
      `${exportName}: expected ${expectedPatchCount} stat-cap constants ${intConst20.toString("hex")}, ` +
        `found ${offsets.length}: ${offsets.map((offset) => `0x${offset.toString(16)}`).join(", ")}`
    );
  }

  for (const offset of offsets) {
    intConst60.copy(data, offset);
    console.log(
      `${exportName}: stat cap 20 -> 60 at data 0x${offset.toString(16)} ` +
        `${intConst20.toString("hex")} -> ${intConst60.toString("hex")}`
    );
  }

  assetExport.Data = data.toString("base64");
  return offsets;
}

function saveJson(jsonPath, json) {
  fs.mkdirSync(path.dirname(jsonPath), { recursive: true });
  fs.writeFileSync(jsonPath, JSON.stringify(json, null, 2));
}

function findExportBundleChunkIds(utocPath) {
  const output = capture(tools.retoc, ["list", utocPath]);
  const matches = output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.includes(" ExportBundleData"));

  if (matches.length < 1) {
    throw new Error(`Expected at least one ExportBundleData chunk in ${utocPath}, found none.`);
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
  const stagedBase = path.join(stageRoot, "FarFarWest", "Content", assetDir, assetName);
  const mountBase = `../../../FarFarWest/Content/${assetDir.replaceAll("\\", "/")}/${assetName}`;
  fs.writeFileSync(
    pakListPath,
    [`"${stagedBase.replaceAll("\\", "/")}.uasset" "${mountBase}.uasset"`, `"${stagedBase.replaceAll("\\", "/")}.uexp" "${mountBase}.uexp"`].join("\n") + "\n"
  );
}

function verifyPatchedJson(offsets) {
  const { assetExport } = loadExport(patchedJson, exportName);
  const data = Buffer.from(assetExport.Data, "base64");
  const remaining20 = findAll(data, intConst20);
  const patched60 = findAll(data, intConst60);

  if (remaining20.length !== 0) {
    throw new Error(`${exportName}: found unpatched 20 constants at ${remaining20.map((offset) => `0x${offset.toString(16)}`).join(", ")}`);
  }

  for (const offset of offsets) {
    if (!data.subarray(offset, offset + intConst60.length).equals(intConst60)) {
      throw new Error(`${exportName}: expected patched 60 constant at 0x${offset.toString(16)}`);
    }
  }

  console.log(`${exportName}: verified ${patched60.length} patched 60 constants, no remaining 20 constants`);
}

function main() {
  requireFile(tools.uassetgui);
  requireFile(tools.retoc);
  requireFile(tools.unrealPak);
  requireFile(sourceAsset);

  cleanDir(sourceDir);
  cleanDir(patchedDir);
  cleanDir(stageRoot);
  cleanDir(rawOutputDir);
  fs.rmSync(toZenProbeRawDir, { recursive: true, force: true });
  cleanBuildOutputs();

  run(tools.uassetgui, ["tojson", sourceAsset, sourceJson, exportIndex]);

  const { json, assetExport } = loadExport(sourceJson, exportName);
  const offsets = patchStatCaps(assetExport);
  saveJson(patchedJson, json);
  verifyPatchedJson(offsets);

  fs.mkdirSync(path.dirname(stagedAsset), { recursive: true });
  run(tools.uassetgui, ["fromjson", patchedJson, stagedAsset, exportIndex]);

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

  console.log("");
  console.log("UncappedStatPoints rebuilt from current UI_Equipment_Item.");
  console.log(`Raw override chunks: ${exportBundleChunkIds.join(", ")}`);
  console.log(`Output: ${buildBase}.pak/.ucas/.utoc`);
}

main();
