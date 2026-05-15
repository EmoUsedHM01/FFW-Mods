const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const scriptUtilsDir = path.join(root, "ScriptUtils");

const enemyChunkId = "f566afc6572a67ca00000001";
const rawInputDir = path.join(root, "RawChunks", "original");
const rawOutputRoot = path.join(root, "RawChunks", "raw_mod_enemy_pre_ui");
const rawOutputDir = path.join(rawOutputRoot, "chunks");
const jsonOutputDir = path.join(scriptUtilsDir, "patched_enemy_pre_ui");
const stageRoot = path.join(root, "ModStageEnemyPreUi");
const pakListPath = path.join(scriptUtilsDir, "WeakspotEveryHit_EnemyPreUi_PakList.txt");

const rawExportBase = 0x1f159;

const patches = [
  {
    name: "F_HitMarkerRequest temp bool destination -> Critical",
    jsonOffset: 0x10d,
    rawOffset: rawExportBase + 0x10d,
    expected: Buffer.from([0x35, 0x00, 0x00, 0x00]),
    replacement: Buffer.from([0x01, 0x01, 0x00, 0x00]),
  },
  {
    name: "F_HitMarkerRequest assignment expression -> EX_True",
    jsonOffset: 0x119,
    rawOffset: rawExportBase + 0x119,
    expected: Buffer.from([0x19]),
    replacement: Buffer.from([0x27]),
  },
  {
    name: "F_HitMarkerRequest skip dead original expression",
    jsonOffset: 0x11a,
    rawOffset: rawExportBase + 0x11a,
    expected: Buffer.from([0x20, 0xf9, 0xfe, 0xff, 0xff]),
    replacement: Buffer.from([0x06, 0x6b, 0x00, 0x00, 0x00]),
  },
];

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
  for (const patch of patches) {
    const expected = patch.rawExpected || patch.expected;
    patchBytes(data, patch.rawOffset, expected, patch.replacement, patch.name);
    console.log(`${patch.name}: raw 0x${patch.rawOffset.toString(16)} ${expected.toString("hex")} -> ${patch.replacement.toString("hex")}`);
  }
  fs.writeFileSync(output, data);
}

{
  const input = path.join(scriptUtilsDir, "BP_Enemy_35.json");
  const output = path.join(jsonOutputDir, "BP_Enemy_35.json");
  const asset = JSON.parse(fs.readFileSync(input, "utf8"));
  const exportEntry = asset.Exports.find((entry) => entry.ObjectName === "F_HitMarkerRequest");
  if (!exportEntry || typeof exportEntry.Data !== "string") {
    throw new Error("BP_Enemy_35.json: F_HitMarkerRequest raw export not found");
  }

  const data = Buffer.from(exportEntry.Data, "base64");
  for (const patch of patches) {
    patchBytes(data, patch.jsonOffset, patch.expected, patch.replacement, patch.name);
    console.log(`${patch.name}: json 0x${patch.jsonOffset.toString(16)} ${patch.expected.toString("hex")} -> ${patch.replacement.toString("hex")}`);
  }
  exportEntry.Data = data.toString("base64");
  fs.writeFileSync(output, JSON.stringify(asset, null, 2));
}

fs.mkdirSync(path.dirname(stagedAsset.sourceBase), { recursive: true });

const pakList = [];
for (const ext of [".uasset", ".uexp"]) {
  pakList.push(`"${stagedAsset.sourceBase.replaceAll("\\", "/")}${ext}" "${stagedAsset.mountBase}${ext}"`);
}
fs.writeFileSync(pakListPath, `${pakList.join("\n")}\n`);
console.log(`wrote ${pakListPath}`);
