const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const scriptUtilsDir = path.join(root, "ScriptUtils");

const rawInputDir = path.join(root, "RawChunks", "original");
const rawOutputRoot = path.join(root, "RawChunks", "raw_mod_bullet_mechanical");
const rawOutputDir = path.join(rawOutputRoot, "chunks");
const jsonOutputDir = path.join(scriptUtilsDir, "patched_bullet_mechanical");
const stageRoot = path.join(root, "ModStageBulletMechanical");
const pakListPath = path.join(scriptUtilsDir, "WeakspotEveryHit_BulletMechanical_PakList.txt");

const chunks = {
  enemy: "f566afc6572a67ca00000001",
  bullet: "2ee165222bd1131e00000001",
};

const bases = {
  enemyShowDamagesAmount: 0x22ecb,
  bulletApplyDamages: 0x99dd,
};

const isCriticalRef = Buffer.from("00010000000a0100000000000008000000", "hex");
const isValidRef = Buffer.from("0001000000640000000000000008000000", "hex");

const patches = [
  {
    asset: "enemy",
    file: "BP_Enemy_35.json",
    exportName: "F_ShowDamagesAmount",
    name: "F_ShowDamagesAmount SelectColor pick bool Critical -> IsValid",
    jsonOffset: 0x874,
    rawOffset: bases.enemyShowDamagesAmount + 0x874,
    expected: Buffer.from("0001000000020100000000000056000000", "hex"),
    replacement: Buffer.from("0001000000a80000000000000056000000", "hex"),
  },
  {
    asset: "bullet",
    file: "BP_PlayerBullet_35.json",
    exportName: "F_ApplyDamages",
    name: "F_ApplyDamages output Critical source isCritical -> IsValid",
    jsonOffset: 0x1095,
    rawOffset: bases.bulletApplyDamages + 0x1095,
    expected: isCriticalRef,
    replacement: isValidRef,
  },
  {
    asset: "bullet",
    file: "BP_PlayerBullet_35.json",
    exportName: "F_ApplyDamages",
    name: "F_ApplyDamages F_HitMarkerRequest Critical param isCritical -> IsValid",
    jsonOffset: 0x1ec7,
    rawOffset: bases.bulletApplyDamages + 0x1ec7,
    expected: isCriticalRef,
    replacement: isValidRef,
  },
  {
    asset: "bullet",
    file: "BP_PlayerBullet_35.json",
    exportName: "F_ApplyDamages",
    name: "F_ApplyDamages F_ApplyImpactDamages Critical param isCritical -> IsValid",
    jsonOffset: 0x2249,
    rawOffset: bases.bulletApplyDamages + 0x2249,
    expected: isCriticalRef,
    replacement: isValidRef,
  },
];

const stagedAssets = [
  {
    sourceBase: path.join(stageRoot, "FarFarWest", "Content", "Enemies", "BP_Enemy"),
    mountBase: "../../../FarFarWest/Content/Enemies/BP_Enemy",
  },
  {
    sourceBase: path.join(stageRoot, "FarFarWest", "Content", "Items", "Assets", "BP_PlayerBullet"),
    mountBase: "../../../FarFarWest/Content/Items/Assets/BP_PlayerBullet",
  },
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

cleanDir(rawOutputDir);
cleanDir(jsonOutputDir);
cleanDir(stageRoot);

fs.writeFileSync(
  path.join(rawOutputRoot, "manifest.json"),
  JSON.stringify({ chunk_paths: {}, version: "ReplaceIoChunkHashWithIoHash", mount_point: "../../../" }, null, 2)
);

for (const [asset, chunkId] of Object.entries(chunks)) {
  const input = path.join(rawInputDir, chunkId);
  const output = path.join(rawOutputDir, chunkId);
  const data = fs.readFileSync(input);
  for (const patch of patches.filter((entry) => entry.asset === asset)) {
    patchBytes(data, patch.rawOffset, patch.expected, patch.replacement, patch.name);
    console.log(`${patch.name}: raw 0x${patch.rawOffset.toString(16)} ${patch.expected.toString("hex")} -> ${patch.replacement.toString("hex")}`);
  }
  fs.writeFileSync(output, data);
}

for (const file of [...new Set(patches.map((patch) => patch.file))]) {
  const input = path.join(scriptUtilsDir, file);
  const output = path.join(jsonOutputDir, file);
  const asset = JSON.parse(fs.readFileSync(input, "utf8"));
  for (const patch of patches.filter((entry) => entry.file === file)) {
    const exportEntry = asset.Exports.find((entry) => entry.ObjectName === patch.exportName);
    if (!exportEntry || typeof exportEntry.Data !== "string") {
      throw new Error(`${file}: ${patch.exportName} raw export not found`);
    }
    const data = Buffer.from(exportEntry.Data, "base64");
    patchBytes(data, patch.jsonOffset, patch.expected, patch.replacement, patch.name);
    exportEntry.Data = data.toString("base64");
    console.log(`${patch.name}: json 0x${patch.jsonOffset.toString(16)} ${patch.expected.toString("hex")} -> ${patch.replacement.toString("hex")}`);
  }
  fs.writeFileSync(output, JSON.stringify(asset, null, 2));
}

for (const asset of stagedAssets) {
  fs.mkdirSync(path.dirname(asset.sourceBase), { recursive: true });
}

const pakList = [];
for (const asset of stagedAssets) {
  for (const ext of [".uasset", ".uexp"]) {
    pakList.push(`"${asset.sourceBase.replaceAll("\\", "/")}${ext}" "${asset.mountBase}${ext}"`);
  }
}
fs.writeFileSync(pakListPath, `${pakList.join("\n")}\n`);
console.log(`wrote ${pakListPath}`);
