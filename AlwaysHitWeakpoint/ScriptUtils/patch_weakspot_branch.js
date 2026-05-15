const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const scriptUtilsDir = path.join(root, "ScriptUtils");

const rawInputDir = path.join(root, "RawChunks", "original");
const rawOutputRoot = path.join(root, "RawChunks", "raw_mod_branch");
const rawOutputDir = path.join(rawOutputRoot, "chunks");
const jsonOutputDir = path.join(scriptUtilsDir, "patched_branch");
const stageRoot = path.join(root, "ModStageBranch");
const pakListPath = path.join(scriptUtilsDir, "WeakspotEveryHit_Branch_PakList.txt");

const falseToTrueRaw = [
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

const falseToTrueJson = [
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

const jumpSkipRaw = [
  {
    id: "2ee165222bd1131e00000001",
    name: "BP_PlayerBullet.F_ApplyDamages hitCriticalBones false branch",
    opcodeOffset: 0xb84b,
    argOffset: 0xb84c,
    expectedOpcode: 0x07,
    expectedArg: 0xfce,
    replacementArg: 0,
  },
  {
    id: "c888831310d62c0a00000001",
    name: "BP_ArrowProjectile.F_IsCritical hitCriticalBones false branch",
    opcodeOffset: 0x8211,
    argOffset: 0x8212,
    expectedOpcode: 0x07,
    expectedArg: 0x243,
    replacementArg: 0,
  },
];

const jumpSkipJson = [
  {
    file: "BP_PlayerBullet_35.json",
    exportName: "F_ApplyDamages",
    name: "BP_PlayerBullet.F_ApplyDamages hitCriticalBones false branch",
    opcodeOffset: 0x1e89,
    argOffset: 0x1e8a,
    expectedOpcode: 0x07,
    expectedArg: 0xfce,
    replacementArg: 0,
  },
  {
    file: "BP_ArrowProjectile_35.json",
    exportName: "F_IsCritical",
    name: "BP_ArrowProjectile.F_IsCritical hitCriticalBones false branch",
    opcodeOffset: 0x88a,
    argOffset: 0x88b,
    expectedOpcode: 0x07,
    expectedArg: 0x243,
    replacementArg: 0,
  },
];

const stagedAssets = [
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

function patchJumpSkip(buffer, patch) {
  const opcode = buffer[patch.opcodeOffset];
  if (opcode !== patch.expectedOpcode) {
    throw new Error(`${patch.name}: expected opcode 0x${patch.expectedOpcode.toString(16)} at 0x${patch.opcodeOffset.toString(16)}, found 0x${opcode.toString(16)}`);
  }

  const arg = buffer.readUInt32LE(patch.argOffset);
  if (arg !== patch.expectedArg) {
    throw new Error(`${patch.name}: expected jump skip 0x${patch.expectedArg.toString(16)} at 0x${patch.argOffset.toString(16)}, found 0x${arg.toString(16)}`);
  }

  buffer.writeUInt32LE(patch.replacementArg, patch.argOffset);
}

function getExportData(asset, file, exportName) {
  const exportEntry = asset.Exports.find((entry) => entry.ObjectName === exportName);
  if (!exportEntry || typeof exportEntry.Data !== "string") {
    throw new Error(`${file}: raw export ${exportName} not found`);
  }
  return exportEntry;
}

cleanDir(rawOutputDir);
cleanDir(jsonOutputDir);
cleanDir(stageRoot);

fs.writeFileSync(
  path.join(rawOutputRoot, "manifest.json"),
  JSON.stringify({ chunk_paths: {}, version: "ReplaceIoChunkHashWithIoHash", mount_point: "../../../" }, null, 2)
);

const rawIds = new Set([
  ...falseToTrueRaw.map((patch) => patch.id),
  ...jumpSkipRaw.map((patch) => patch.id),
]);

for (const id of rawIds) {
  const input = path.join(rawInputDir, id);
  const output = path.join(rawOutputDir, id);
  const data = fs.readFileSync(input);

  for (const patch of falseToTrueRaw.filter((entry) => entry.id === id)) {
    flipFalseTokens(data, patch.offsets, patch.name);
    console.log(`${patch.name}: raw false->true at ${patch.offsets.map((offset) => `0x${offset.toString(16)}`).join(", ")}`);
  }

  for (const patch of jumpSkipRaw.filter((entry) => entry.id === id)) {
    patchJumpSkip(data, patch);
    console.log(`${patch.name}: raw jump skip 0x${patch.expectedArg.toString(16)}->0x${patch.replacementArg.toString(16)} at 0x${patch.argOffset.toString(16)}`);
  }

  fs.writeFileSync(output, data);
}

const jsonFiles = new Set([
  ...falseToTrueJson.map((patch) => patch.file),
  ...jumpSkipJson.map((patch) => patch.file),
]);

for (const file of jsonFiles) {
  const input = path.join(scriptUtilsDir, file);
  const output = path.join(jsonOutputDir, file);
  const asset = JSON.parse(fs.readFileSync(input, "utf8"));

  for (const patch of falseToTrueJson.filter((entry) => entry.file === file)) {
    const exportEntry = getExportData(asset, file, patch.exportName);
    const data = Buffer.from(exportEntry.Data, "base64");
    flipFalseTokens(data, patch.offsets, `${file}.${patch.exportName}`);
    exportEntry.Data = data.toString("base64");
    console.log(`${file}.${patch.exportName}: json false->true at ${patch.offsets.map((offset) => `0x${offset.toString(16)}`).join(", ")}`);
  }

  for (const patch of jumpSkipJson.filter((entry) => entry.file === file)) {
    const exportEntry = getExportData(asset, file, patch.exportName);
    const data = Buffer.from(exportEntry.Data, "base64");
    patchJumpSkip(data, patch);
    exportEntry.Data = data.toString("base64");
    console.log(`${patch.name}: json jump skip 0x${patch.expectedArg.toString(16)}->0x${patch.replacementArg.toString(16)} at 0x${patch.argOffset.toString(16)}`);
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
