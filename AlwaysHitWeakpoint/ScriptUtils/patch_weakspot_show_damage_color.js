const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const scriptUtilsDir = path.join(root, "ScriptUtils");

const enemyChunkId = "f566afc6572a67ca00000001";
const rawInputDir = path.join(root, "RawChunks", "original");
const rawOutputRoot = path.join(root, "RawChunks", "raw_mod_show_damage_color");
const rawOutputDir = path.join(rawOutputRoot, "chunks");
const jsonOutputDir = path.join(scriptUtilsDir, "patched_show_damage_color");
const stageRoot = path.join(root, "ModStageShowDamageColor");
const pakListPath = path.join(scriptUtilsDir, "WeakspotEveryHit_ShowDamageColor_PakList.txt");

const rawExportBase = 0x23052;

const patch = {
  name: "F_ShowDamagesAmount SelectColor pick bool Critical -> IsValid",
  jsonOffset: 0x874,
  rawOffset: rawExportBase + 0x874,
  expected: Buffer.from("0001000000010100000000000056000000", "hex"),
  replacement: Buffer.from("0001000000a70000000000000056000000", "hex"),
};

const stagedAsset = {
  sourceBase: path.join(stageRoot, "FarFarWest", "Content", "Enemies", "BP_Enemy"),
  mountBase: "../../../FarFarWest/Content/Enemies/BP_Enemy",
};

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

cleanDir(rawOutputDir);
cleanDir(jsonOutputDir);
cleanDir(stageRoot);

fs.writeFileSync(
  path.join(rawOutputRoot, "manifest.json"),
  JSON.stringify({ chunk_paths: {}, version: "ReplaceIoChunkHashWithIoHash", mount_point: "../../../" }, null, 2)
);

{
  const input = path.join(rawInputDir, enemyChunkId);
  const output = path.join(rawOutputDir, enemyChunkId);
  const data = fs.readFileSync(input);
  patchBytes(data, patch.rawOffset, patch.expected, patch.replacement, patch.name);
  fs.writeFileSync(output, data);
  console.log(`${patch.name}: raw 0x${patch.rawOffset.toString(16)} ${patch.expected.toString("hex")} -> ${patch.replacement.toString("hex")}`);
}

{
  const input = path.join(scriptUtilsDir, "BP_Enemy_35.json");
  const output = path.join(jsonOutputDir, "BP_Enemy_35.json");
  const asset = JSON.parse(fs.readFileSync(input, "utf8"));
  const exportEntry = asset.Exports.find((entry) => entry.ObjectName === "F_ShowDamagesAmount");
  if (!exportEntry || typeof exportEntry.Data !== "string") {
    throw new Error("BP_Enemy_35.json: F_ShowDamagesAmount raw export not found");
  }

  const data = Buffer.from(exportEntry.Data, "base64");
  patchBytes(data, patch.jsonOffset, patch.expected, patch.replacement, patch.name);
  exportEntry.Data = data.toString("base64");
  fs.writeFileSync(output, JSON.stringify(asset, null, 2));
  console.log(`${patch.name}: json 0x${patch.jsonOffset.toString(16)} ${patch.expected.toString("hex")} -> ${patch.replacement.toString("hex")}`);
}

fs.mkdirSync(path.dirname(stagedAsset.sourceBase), { recursive: true });

const pakList = [];
for (const ext of [".uasset", ".uexp"]) {
  pakList.push(`"${stagedAsset.sourceBase.replaceAll("\\", "/")}${ext}" "${stagedAsset.mountBase}${ext}"`);
}
fs.writeFileSync(pakListPath, `${pakList.join("\n")}\n`);
console.log(`wrote ${pakListPath}`);
