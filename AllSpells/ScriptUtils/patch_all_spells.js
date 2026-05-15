const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const scriptUtilsDir = path.join(root, "ScriptUtils");
const jsonOutputDir = path.join(scriptUtilsDir, "patched");
const rawInputDir = path.join(root, "RawChunks", "original");
const rawOutputRoot = path.join(root, "RawChunks", "raw_mod");
const rawOutputDir = path.join(rawOutputRoot, "chunks");
const stageRoot = path.join(root, "ModStage");
const buildDir = path.join(root, "ModBuild");
const pakListPath = path.join(scriptUtilsDir, "AllSpells_PakList.txt");

const assets = [
  { assetName: "BP_Item_SpellCast_Acid_Bubble", chunkId: "7fe09e03b40943f600000001" },
  { assetName: "BP_Item_SpellCast_Acid_Contagion", chunkId: "2262e8f6b685866f00000001" },
  { assetName: "BP_Item_SpellCast_Acid_Geyser", chunkId: "acfa57cd47c4799000000001" },
  { assetName: "BP_Item_SpellCast_Acid_Rain", chunkId: "56db35ef2835a74200000001" },
  { assetName: "BP_Item_SpellCast_Acid_Thrower", chunkId: "654c4ffe2615f1a100000001" },
  { assetName: "BP_Item_SpellCast_Cactus_Betty", chunkId: "7cdf91ee3292c65300000001" },
  { assetName: "BP_Item_SpellCast_Cactus_Decoy", chunkId: "76a4ca1a9300a16f00000001" },
  { assetName: "BP_Item_SpellCast_Cactus_Turret", chunkId: "60bc8685c94a824000000001" },
  { assetName: "BP_Item_SpellCast_Cactus_Ulti", chunkId: "8c6fe709c3cd2a9f00000001" },
  { assetName: "BP_Item_SpellCast_Cactus_Wall", chunkId: "faf0189d0449e5d400000001" },
  { assetName: "BP_Item_SpellCast_Elec_Portal", chunkId: "4e461f17a497d30900000001" },
  { assetName: "BP_Item_SpellCast_Elec_Strike", chunkId: "bf6eaa2fa6b8f40f00000001" },
  { assetName: "BP_Item_SpellCast_Elec_SuperJump", chunkId: "ad34a76dfd25bd3700000001" },
  { assetName: "BP_Item_SpellCast_Elec_Swap", chunkId: "9e43d157982c7e6d00000001" },
  { assetName: "BP_Item_SpellCast_Elec_ThunderStrike", chunkId: "914718eecf6cde3200000001" },
  { assetName: "BP_Item_SpellCast_Fire_Ball", chunkId: "02bb72a157f936ea00000001" },
  { assetName: "BP_Item_SpellCast_Fire_Beam", chunkId: "4ab4152f366e661800000001" },
  { assetName: "BP_Item_SpellCast_Fire_Fingergun", chunkId: "a1d3b11a77a5973800000001" },
  { assetName: "BP_Item_SpellCast_Fire_Surcharge", chunkId: "568389af585cc1af00000001" },
  { assetName: "BP_Item_SpellCast_Fire_Wisp", chunkId: "25cea1dffb2534c000000001" },
  { assetName: "BP_Item_SpellCast_Voodoo_Corruption", chunkId: "6a941bea16782c9100000001" },
  { assetName: "BP_Item_SpellCast_Voodoo_Doll", chunkId: "b97572cc96e25f5a00000001" },
  { assetName: "BP_Item_SpellCast_Voodoo_Drain", chunkId: "3849ab9f98a1ab0900000001" },
  { assetName: "BP_Item_SpellCast_Voodoo_Heal", chunkId: "4ccab432ec2a88ec00000001" },
  { assetName: "BP_Item_SpellCast_Voodoo_HealArea", chunkId: "bd89d2b9ef71ebda00000001" },
];

const expectedLevels = new Set([1, 4, 7, 8, 12, 20, 35]);
const intOne = Buffer.from("01000000", "hex");

function cleanDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
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

function writePakList(entries) {
  const lines = [];
  for (const assetName of entries) {
    const sourceBase = path.join(stageRoot, "FarFarWest", "Content", "Spells", assetName);
    const mountBase = `../../../FarFarWest/Content/Spells/${assetName}`;
    fs.mkdirSync(path.dirname(sourceBase), { recursive: true });
    lines.push(`"${sourceBase.replaceAll("\\", "/")}.uasset" "${mountBase}.uasset"`);
    lines.push(`"${sourceBase.replaceAll("\\", "/")}.uexp" "${mountBase}.uexp"`);
  }
  fs.writeFileSync(pakListPath, lines.join("\n") + "\n");
}

cleanDir(jsonOutputDir);
cleanDir(rawOutputDir);
cleanDir(stageRoot);
fs.mkdirSync(buildDir, { recursive: true });

fs.writeFileSync(
  path.join(rawOutputRoot, "manifest.json"),
  JSON.stringify({ chunk_paths: {}, version: "ReplaceIoChunkHashWithIoHash", mount_point: "../../../" }, null, 2)
);

const changedAssets = [];

for (const { assetName, chunkId } of assets) {
  const jsonInput = path.join(scriptUtilsDir, `${assetName}_35.json`);
  const asset = JSON.parse(fs.readFileSync(jsonInput, "utf8"));
  const exportName = `Default__${assetName}_C`;
  const exportEntry = asset.Exports.find((entry) => entry.ObjectName === exportName);
  if (!exportEntry || typeof exportEntry.Data !== "string") {
    throw new Error(`${assetName}: ${exportName} raw export not found`);
  }

  const originalExportData = Buffer.from(exportEntry.Data, "base64");
  const { offset, value } = findLevelOffset(assetName, originalExportData);
  if (value === 1) {
    console.log(`${assetName}: requiredMinimumLevel already 1`);
    continue;
  }

  const patchedExportData = Buffer.from(originalExportData);
  intOne.copy(patchedExportData, offset);
  exportEntry.Data = patchedExportData.toString("base64");
  fs.writeFileSync(path.join(jsonOutputDir, `${assetName}_35.json`), JSON.stringify(asset, null, 2));

  const rawInput = path.join(rawInputDir, chunkId);
  const rawOutput = path.join(rawOutputDir, chunkId);
  const rawData = fs.readFileSync(rawInput);
  const rawExportOffset = rawData.indexOf(originalExportData);
  if (rawExportOffset < 0) {
    throw new Error(`${assetName}: original export data not found in raw chunk ${chunkId}`);
  }
  if (rawData.indexOf(originalExportData, rawExportOffset + 1) >= 0) {
    throw new Error(`${assetName}: original export data matched more than once in raw chunk ${chunkId}`);
  }

  const rawLevelOffset = rawExportOffset + offset;
  const rawValue = rawData.readInt32LE(rawLevelOffset);
  if (rawValue !== value) {
    throw new Error(`${assetName}: raw level mismatch at 0x${rawLevelOffset.toString(16)}: expected ${value}, found ${rawValue}`);
  }
  intOne.copy(rawData, rawLevelOffset);
  fs.writeFileSync(rawOutput, rawData);

  changedAssets.push(assetName);
  console.log(`${assetName}: requiredMinimumLevel ${value} -> 1 (json 0x${offset.toString(16)}, raw 0x${rawLevelOffset.toString(16)})`);
}

writePakList(changedAssets);

console.log(`patched ${changedAssets.length} spell assets`);
console.log(`wrote ${jsonOutputDir}`);
console.log(`wrote ${rawOutputRoot}`);
console.log(`wrote ${pakListPath}`);
