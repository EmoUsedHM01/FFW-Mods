const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const scriptUtilsDir = path.join(root, "ScriptUtils");

const jsonInput = path.join(scriptUtilsDir, "BPFL_PlayerDatas_35.json");
const jsonOutputDir = path.join(scriptUtilsDir, "patched");
const rawInputDir = path.join(root, "RawChunks", "original");
const rawOutputRoot = path.join(root, "RawChunks", "raw_mod");
const rawOutputDir = path.join(rawOutputRoot, "chunks");
const stageRoot = path.join(root, "ModStage");
const buildDir = path.join(root, "ModBuild");
const pakListPath = path.join(scriptUtilsDir, "CheapJokers_PakList.txt");

const chunkId = "b15f3e3c3aa1db3c00000001";
const assetName = "BPFL_PlayerDatas";
const exportName = "F_GetRequiredSlotsOfRarity";
const assetDir = "Gamework";

const intConst1 = Buffer.from("1d01000000", "hex");

const patches = [
  { name: "rarity slot cost 5 -> 1 (case 0)", jsonOffset: 0x280, rawOffset: 0x3b03, expected: Buffer.from("1d05000000", "hex"), replacement: intConst1 },
  { name: "rarity slot cost 5 -> 1 (case 1)", jsonOffset: 0x2a7, rawOffset: 0x3b2a, expected: Buffer.from("1d05000000", "hex"), replacement: intConst1 },
  { name: "rarity slot cost 4 -> 1", jsonOffset: 0x2ce, rawOffset: 0x3b51, expected: Buffer.from("1d04000000", "hex"), replacement: intConst1 },
  { name: "rarity slot cost 3 -> 1", jsonOffset: 0x2f5, rawOffset: 0x3b78, expected: Buffer.from("1d03000000", "hex"), replacement: intConst1 },
  { name: "rarity slot cost 2 -> 1", jsonOffset: 0x31c, rawOffset: 0x3b9f, expected: Buffer.from("1d02000000", "hex"), replacement: intConst1 },
];

function cleanDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
}

function patchBytes(buffer, offset, expected, replacement, label) {
  const found = buffer.subarray(offset, offset + expected.length);
  if (!found.equals(expected)) {
    throw new Error(`${label}: expected ${expected.toString("hex")} at 0x${offset.toString(16)}, found ${found.toString("hex")}`);
  }
  replacement.copy(buffer, offset);
}

cleanDir(jsonOutputDir);
cleanDir(rawOutputDir);
cleanDir(stageRoot);
fs.mkdirSync(buildDir, { recursive: true });

fs.writeFileSync(
  path.join(rawOutputRoot, "manifest.json"),
  JSON.stringify({ chunk_paths: {}, version: "ReplaceIoChunkHashWithIoHash", mount_point: "../../../" }, null, 2)
);

const rawInput = path.join(rawInputDir, chunkId);
const rawOutput = path.join(rawOutputDir, chunkId);
const rawData = fs.readFileSync(rawInput);
for (const patch of patches) {
  patchBytes(rawData, patch.rawOffset, patch.expected, patch.replacement, `${patch.name} raw`);
  console.log(`${patch.name}: raw 0x${patch.rawOffset.toString(16)} ${patch.expected.toString("hex")} -> ${patch.replacement.toString("hex")}`);
}
fs.writeFileSync(rawOutput, rawData);

const asset = JSON.parse(fs.readFileSync(jsonInput, "utf8"));
const exportEntry = asset.Exports.find((entry) => entry.ObjectName === exportName);
if (!exportEntry || typeof exportEntry.Data !== "string") {
  throw new Error(`${assetName}: ${exportName} raw export not found`);
}

const exportData = Buffer.from(exportEntry.Data, "base64");
for (const patch of patches) {
  patchBytes(exportData, patch.jsonOffset, patch.expected, patch.replacement, `${patch.name} json`);
  console.log(`${patch.name}: json 0x${patch.jsonOffset.toString(16)} ${patch.expected.toString("hex")} -> ${patch.replacement.toString("hex")}`);
}
exportEntry.Data = exportData.toString("base64");
fs.writeFileSync(path.join(jsonOutputDir, `${assetName}_35.json`), JSON.stringify(asset, null, 2));

const sourceBase = path.join(stageRoot, "FarFarWest", "Content", assetDir, assetName);
const mountBase = `../../../FarFarWest/Content/${assetDir}/${assetName}`;
fs.mkdirSync(path.dirname(sourceBase), { recursive: true });
fs.writeFileSync(
  pakListPath,
  [`"${sourceBase.replaceAll("\\", "/")}.uasset" "${mountBase}.uasset"`, `"${sourceBase.replaceAll("\\", "/")}.uexp" "${mountBase}.uexp"`].join("\n") + "\n"
);

console.log(`wrote ${path.join(jsonOutputDir, `${assetName}_35.json`)}`);
console.log(`wrote ${pakListPath}`);
