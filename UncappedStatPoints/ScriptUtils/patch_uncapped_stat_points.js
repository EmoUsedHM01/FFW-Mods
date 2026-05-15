const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const scriptUtilsDir = path.join(root, "ScriptUtils");

const jsonInput = path.join(root, "UI_Equipment_Item.json");
const jsonOutputDir = path.join(scriptUtilsDir, "patched");
const rawInputDir = path.join(root, "RawChunks", "original");
const rawOutputRoot = path.join(root, "RawChunks", "raw_mod");
const rawOutputDir = path.join(rawOutputRoot, "chunks");
const stageRoot = path.join(root, "ModStage");
const pakListPath = path.join(scriptUtilsDir, "UncappedStatPoints_PakList.txt");

const chunkId = "fa01240fdd86e30c00000001";
const assetName = "UI_Equipment_Item";
const exportName = "F_UpdatePriceAndUpgradesAmount";

const intConst20 = Buffer.from("1d14000000", "hex");
const intConst60 = Buffer.from("1d3c000000", "hex");

const patches = [
  {
    name: "normal max stat points 20 -> 60",
    jsonOffset: 0x1c8d,
    rawOffset: 0x1932c,
    expected: intConst20,
    replacement: intConst60,
  },
  {
    name: "confirm max stat points 20 -> 60",
    jsonOffset: 0x2574,
    rawOffset: 0x19c13,
    expected: intConst20,
    replacement: intConst60,
  },
];

function cleanDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
}

function patchBytes(buffer, offset, expected, replacement, label) {
  const found = buffer.subarray(offset, offset + expected.length);
  if (!found.equals(expected)) {
    throw new Error(
      `${label}: expected ${expected.toString("hex")} at 0x${offset.toString(16)}, found ${found.toString("hex")}`
    );
  }
  replacement.copy(buffer, offset);
}

cleanDir(jsonOutputDir);
cleanDir(rawOutputDir);
cleanDir(stageRoot);

fs.writeFileSync(
  path.join(rawOutputRoot, "manifest.json"),
  JSON.stringify({ chunk_paths: {}, version: "ReplaceIoChunkHashWithIoHash", mount_point: "../../../" }, null, 2)
);

const rawInput = path.join(rawInputDir, chunkId);
const rawOutput = path.join(rawOutputDir, chunkId);
const rawData = fs.readFileSync(rawInput);
for (const patch of patches) {
  patchBytes(rawData, patch.rawOffset, patch.expected, patch.replacement, `${patch.name} raw`);
  console.log(
    `${patch.name}: raw 0x${patch.rawOffset.toString(16)} ${patch.expected.toString("hex")} -> ${patch.replacement.toString("hex")}`
  );
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
  console.log(
    `${patch.name}: json 0x${patch.jsonOffset.toString(16)} ${patch.expected.toString("hex")} -> ${patch.replacement.toString("hex")}`
  );
}
exportEntry.Data = exportData.toString("base64");
fs.writeFileSync(path.join(jsonOutputDir, `${assetName}_35.json`), JSON.stringify(asset, null, 2));

const sourceBase = path.join(stageRoot, "FarFarWest", "Content", "Interfaces", "Equipment", assetName);
const mountBase = `../../../FarFarWest/Content/Interfaces/Equipment/${assetName}`;
fs.mkdirSync(path.dirname(sourceBase), { recursive: true });
fs.writeFileSync(
  pakListPath,
  [`"${sourceBase.replaceAll("\\", "/")}.uasset" "${mountBase}.uasset"`, `"${sourceBase.replaceAll("\\", "/")}.uexp" "${mountBase}.uexp"`].join("\n") + "\n"
);

console.log(`wrote ${path.join(jsonOutputDir, `${assetName}_35.json`)}`);
console.log(`wrote ${pakListPath}`);
