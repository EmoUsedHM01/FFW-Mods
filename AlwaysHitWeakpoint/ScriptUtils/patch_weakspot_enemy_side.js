const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const scriptUtilsDir = path.join(root, "ScriptUtils");

const rawInputDir = path.join(root, "RawChunks", "original");
const rawOutputRoot = path.join(root, "RawChunks", "raw_mod_enemy_side");
const rawOutputDir = path.join(rawOutputRoot, "chunks");
const jsonOutputDir = path.join(scriptUtilsDir, "patched_enemy_side");
const stageRoot = path.join(root, "ModStageEnemySide");
const pakListPath = path.join(scriptUtilsDir, "WeakspotEveryHit_EnemySide_PakList.txt");

const boolFalseToTrueRaw = [
  {
    id: "2ee165222bd1131e00000001",
    name: "BP_PlayerBullet.F_ApplyDamages",
    offsets: [0xa39c, 0xaa19, 0xb3fc],
  },
  {
    id: "c888831310d62c0a00000001",
    name: "BP_ArrowProjectile.F_IsCritical",
    offsets: [0x8251],
  },
  {
    id: "5b24f4b5fe8312c300000001",
    name: "BP_SheriffStarProjectile.F_IsCritical",
    offsets: [0xac55, 0xb00b],
  },
];

const boolFalseToTrueJson = [
  {
    file: "BP_PlayerBullet_35.json",
    exportName: "F_ApplyDamages",
    offsets: [0x9da, 0x1057, 0x1a3a],
  },
  {
    file: "BP_ArrowProjectile_35.json",
    exportName: "F_IsCritical",
    offsets: [0x8ca],
  },
  {
    file: "BP_SheriffStarProjectile_35.json",
    exportName: "F_IsCritical",
    offsets: [0x8fb, 0xcb1],
  },
];

const nameIndexPatchesRaw = [
  {
    id: "f566afc6572a67ca00000001",
    name: "BP_Enemy.F_HitMarkerRequest Receive=true destination -> Critical=true",
    offset: 0x1f2f9,
    expected: 634,
    replacement: 257,
  },
];

const nameIndexPatchesJson = [
  {
    file: "BP_Enemy_35.json",
    exportName: "F_HitMarkerRequest",
    name: "BP_Enemy.F_HitMarkerRequest Receive=true destination -> Critical=true",
    offset: 0x1a0,
    expected: 634,
    replacement: 257,
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
  {
    sourceBase: path.join(stageRoot, "FarFarWest", "Content", "Items", "Assets", "BP_ArrowProjectile"),
    mountBase: "../../../FarFarWest/Content/Items/Assets/BP_ArrowProjectile",
  },
  {
    sourceBase: path.join(stageRoot, "FarFarWest", "Content", "Items", "Assets", "SheriffStar", "BP_SheriffStarProjectile"),
    mountBase: "../../../FarFarWest/Content/Items/Assets/SheriffStar/BP_SheriffStarProjectile",
  },
];

function cleanDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
}

function flipFalseTokens(buffer, offsets, label) {
  for (const offset of offsets) {
    if (buffer[offset] !== 0x28) {
      throw new Error(`${label}: expected EX_False at 0x${offset.toString(16)}, found 0x${buffer[offset].toString(16)}`);
    }
    buffer[offset] = 0x27;
  }
}

function patchNameIndex(buffer, patch) {
  const found = buffer.readUInt32LE(patch.offset);
  if (found !== patch.expected) {
    throw new Error(`${patch.name}: expected name index ${patch.expected} at 0x${patch.offset.toString(16)}, found ${found}`);
  }
  buffer.writeUInt32LE(patch.replacement, patch.offset);
}

cleanDir(rawOutputDir);
fs.writeFileSync(
  path.join(rawOutputRoot, "manifest.json"),
  JSON.stringify({ chunk_paths: {}, version: "ReplaceIoChunkHashWithIoHash", mount_point: "../../../" }, null, 2)
);

const rawIds = new Set([
  ...boolFalseToTrueRaw.map((patch) => patch.id),
  ...nameIndexPatchesRaw.map((patch) => patch.id),
]);

for (const id of rawIds) {
  const input = path.join(rawInputDir, id);
  const output = path.join(rawOutputDir, id);
  const data = fs.readFileSync(input);

  for (const patch of boolFalseToTrueRaw.filter((entry) => entry.id === id)) {
    flipFalseTokens(data, patch.offsets, patch.name);
    console.log(`${patch.name}: raw false->true at ${patch.offsets.map((offset) => `0x${offset.toString(16)}`).join(", ")}`);
  }

  for (const patch of nameIndexPatchesRaw.filter((entry) => entry.id === id)) {
    patchNameIndex(data, patch);
    console.log(`${patch.name}: raw name index ${patch.expected}->${patch.replacement} at 0x${patch.offset.toString(16)}`);
  }

  fs.writeFileSync(output, data);
}

cleanDir(jsonOutputDir);
const jsonFiles = new Set([
  ...boolFalseToTrueJson.map((patch) => patch.file),
  ...nameIndexPatchesJson.map((patch) => patch.file),
]);

for (const file of jsonFiles) {
  const input = path.join(scriptUtilsDir, file);
  const output = path.join(jsonOutputDir, file);
  const asset = JSON.parse(fs.readFileSync(input, "utf8"));

  for (const patch of boolFalseToTrueJson.filter((entry) => entry.file === file)) {
    const exportEntry = asset.Exports.find((entry) => entry.ObjectName === patch.exportName);
    if (!exportEntry || typeof exportEntry.Data !== "string") {
      throw new Error(`${patch.file}: raw export ${patch.exportName} not found`);
    }
    const data = Buffer.from(exportEntry.Data, "base64");
    flipFalseTokens(data, patch.offsets, `${patch.file}.${patch.exportName}`);
    exportEntry.Data = data.toString("base64");
    console.log(`${patch.file}.${patch.exportName}: json false->true at ${patch.offsets.map((offset) => `0x${offset.toString(16)}`).join(", ")}`);
  }

  for (const patch of nameIndexPatchesJson.filter((entry) => entry.file === file)) {
    const exportEntry = asset.Exports.find((entry) => entry.ObjectName === patch.exportName);
    if (!exportEntry || typeof exportEntry.Data !== "string") {
      throw new Error(`${patch.file}: raw export ${patch.exportName} not found`);
    }
    const data = Buffer.from(exportEntry.Data, "base64");
    patchNameIndex(data, patch);
    exportEntry.Data = data.toString("base64");
    console.log(`${patch.name}: json name index ${patch.expected}->${patch.replacement} at 0x${patch.offset.toString(16)}`);
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
