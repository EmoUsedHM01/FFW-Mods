const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const scriptUtilsDir = path.join(root, "ScriptUtils");
const jsonInput = path.join(scriptUtilsDir, "DT_PlayerJokers_35.json");
const jsonOutputDir = path.join(scriptUtilsDir, "patched");
const stageRoot = path.join(root, "ModStage");
const buildDir = path.join(root, "ModBuild");
const pakListPath = path.join(scriptUtilsDir, "UnrestrictiveJokers_PakList.txt");
const buildBase = path.join(buildDir, "pakchunk99-UnrestrictiveJokers-Windows_P");

const assetName = "DT_PlayerJokers";
const assetDir = "Progress";

const missionOnlyRows = [
  "jokerCamper",
  "jokerGiant",
  "jokerDwarf",
  "jokerExtraDash",
];

const buyableRestrictedRows = [
  "jokerBellShot",
  "jokerPickPick",
  "jokerShroomGrave",
  "jokerCactusDay",
  "jokerAntiGravityFalls",
  "jokerAimingBurst",
  "jokerHomingBurst",
  "jokerRushBlast",
  "jokerOverBlast",
  "jokerMindShot",
  "jokerFocusShot",
  "jokerElementalSpin",
  "jokerFrenzySpin",
  "jokerMarkAce",
  "jokerFanningAce",
  "jokerOverDraw",
  "jokerUltraDraw",
  "jokerSwampTrick",
  "jokerEcoTrick",
  "jokerJumpStar",
  "jokerScavengerStar",
  "jokerEagleLever",
  "jokerStackedLever",
  "jokerLingeringThrow",
  "jokerChonkyThrow",
  "jokerFistFight",
  "jokerGoldProspector",
  "jokerSoulReaper",
  "jokerHoarder",
  "jokerCdrFire",
  "jokerCdrElec",
  "jokerCdrAcid",
  "jokerCdrVoodoo",
  "jokerCdrCactus",
];

const expectedHeader = 0x2780;
const trueBoolByte = Buffer.from([1]);
const propertyIndexes = {
  canBeBought: 9,
  canBeGambled: 10,
};
const propertySizes = new Map([
  [2, 1],
  [3, 8],
  [4, 4],
  [5, 1],
  [6, 4],
  [7, 4],
  [8, 8],
  [9, 1],
  [10, 1],
  [11, 1],
  [12, 1],
  [13, 4],
  [14, 16],
  [16, 8],
  [17, 1],
]);

function cleanDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
}

function cStringEnd(buffer, offset) {
  let end = offset;
  while (end < buffer.length && buffer[end] !== 0) end++;
  return end + 1;
}

function findRowStart(data, nameMap, rowName) {
  for (let offset = 0; offset + 20 < data.length; offset++) {
    const nameIndex = data.readUInt32LE(offset);
    const nameNumber = data.readUInt32LE(offset + 4);
    if (nameNumber === 0 && nameMap[nameIndex] === rowName) {
      return offset;
    }
  }
  throw new Error(`${assetName}: row ${rowName} not found`);
}

function advanceTextProperty(data, cursor, rowName, propertyIndex) {
  const marker = Buffer.from("ST_UI_Tweaks_", "ascii");
  const markerOffset = data.indexOf(marker, cursor);
  if (markerOffset < 0 || markerOffset - cursor > 32) {
    throw new Error(`${rowName}: text marker not found near property ${propertyIndex} at 0x${cursor.toString(16)}`);
  }
  return cStringEnd(data, markerOffset);
}

function parseRow(data, nameMap, rowName) {
  const rowStart = findRowStart(data, nameMap, rowName);
  const headerOffset = rowStart + 8;
  const header = data.readUInt16LE(headerOffset);
  if (header !== expectedHeader) {
    throw new Error(`${rowName}: expected unversioned header 0x${expectedHeader.toString(16)}, found 0x${header.toString(16)}`);
  }

  const zeroMaskOffset = headerOffset + 2;
  const zeroMask = data.readUInt32LE(zeroMaskOffset);
  let cursor = headerOffset + 6;
  const properties = [];

  for (let propertyIndex = 0; propertyIndex < 18; propertyIndex++) {
    const isZero = (zeroMask & (1 << propertyIndex)) !== 0;
    const property = { index: propertyIndex, isZero, offset: cursor };
    properties[propertyIndex] = property;

    if (isZero) continue;

    if (propertyIndex === 0 || propertyIndex === 1) {
      cursor = advanceTextProperty(data, cursor, rowName, propertyIndex);
    } else if (propertyIndex === 15) {
      const itemCount = data.readInt32LE(cursor);
      property.itemCount = itemCount;
      cursor += 4 + itemCount * 8;
    } else {
      const size = propertySizes.get(propertyIndex);
      if (!size) throw new Error(`${rowName}: no serialized size for property ${propertyIndex}`);
      cursor += size;
    }

    property.endOffset = cursor;
  }

  return {
    rowName,
    zeroMaskOffset,
    zeroMask,
    properties,
  };
}

function findPatch(data, nameMap, rowName, propertyNames) {
  const row = parseRow(data, nameMap, rowName);
  let patchedZeroMask = row.zeroMask;
  const insertionGroups = [];
  const changedProperties = [];

  for (const propertyName of propertyNames) {
    const propertyIndex = propertyIndexes[propertyName];
    const property = row.properties[propertyIndex];
    const zeroBit = 1 << propertyIndex;

    if (!property.isZero) {
      if (data[property.offset] !== 1) {
        throw new Error(`${rowName}: ${propertyName} is serialized but is not true at 0x${property.offset.toString(16)}`);
      }
      continue;
    }

    patchedZeroMask &= ~zeroBit;
    let insertionGroup = insertionGroups.find((group) => group.offset === property.offset);
    if (!insertionGroup) {
      insertionGroup = { offset: property.offset, bytes: Buffer.alloc(0), propertyNames: [] };
      insertionGroups.push(insertionGroup);
    }
    insertionGroup.bytes = Buffer.concat([insertionGroup.bytes, trueBoolByte]);
    insertionGroup.propertyNames.push(propertyName);
    changedProperties.push(propertyName);
  }

  if (!changedProperties.length) return null;

  return {
    rowName,
    zeroMaskOffset: row.zeroMaskOffset,
    zeroMask: row.zeroMask,
    patchedZeroMask,
    insertionGroups: insertionGroups.sort((a, b) => b.offset - a.offset),
    changedProperties,
  };
}

function writePakList() {
  const sourceBase = path.join(stageRoot, "FarFarWest", "Content", assetDir, assetName);
  const mountBase = `../../../FarFarWest/Content/${assetDir}/${assetName}`;
  fs.mkdirSync(path.dirname(sourceBase), { recursive: true });
  fs.writeFileSync(
    pakListPath,
    [
      `"${sourceBase.replaceAll("\\", "/")}.uasset" "${mountBase}.uasset"`,
      `"${sourceBase.replaceAll("\\", "/")}.uexp" "${mountBase}.uexp"`,
    ].join("\n") + "\n"
  );
}

cleanDir(jsonOutputDir);
cleanDir(stageRoot);
fs.mkdirSync(buildDir, { recursive: true });
for (const extension of [".pak", ".ucas", ".utoc"]) {
  fs.rmSync(`${buildBase}${extension}`, { force: true });
}

const asset = JSON.parse(fs.readFileSync(jsonInput, "utf8"));
const exportEntry = asset.Exports.find((entry) => entry.ObjectName === assetName);
if (!exportEntry || typeof exportEntry.Data !== "string") {
  throw new Error(`${assetName}: raw export data not found`);
}

let data = Buffer.from(exportEntry.Data, "base64");
const patchTargets = [
  ...missionOnlyRows.map((rowName) => ({ rowName, propertyNames: ["canBeBought", "canBeGambled"] })),
  ...buyableRestrictedRows.map((rowName) => ({ rowName, propertyNames: ["canBeGambled"] })),
];
const patches = patchTargets
  .map(({ rowName, propertyNames }) => findPatch(data, asset.NameMap, rowName, propertyNames))
  .filter(Boolean)
  .sort((a, b) => Math.max(...b.insertionGroups.map((group) => group.offset)) - Math.max(...a.insertionGroups.map((group) => group.offset)));

let insertedByteCount = 0;
for (const patch of patches) {
  data.writeUInt32LE(patch.patchedZeroMask, patch.zeroMaskOffset);
  for (const insertionGroup of patch.insertionGroups) {
    data = Buffer.concat([data.subarray(0, insertionGroup.offset), insertionGroup.bytes, data.subarray(insertionGroup.offset)]);
    insertedByteCount += insertionGroup.bytes.length;
  }
  console.log(
    `${patch.rowName}: zero mask 0x${patch.zeroMask.toString(16)} -> 0x${patch.patchedZeroMask.toString(16)}, enabled ${patch.changedProperties.join(", ")}`
  );
}

exportEntry.Data = data.toString("base64");
exportEntry.SerialSize += insertedByteCount;

fs.writeFileSync(path.join(jsonOutputDir, `${assetName}_35.json`), JSON.stringify(asset, null, 2));
writePakList();

console.log(`inserted ${insertedByteCount} bool bytes`);
console.log(`wrote ${path.join(jsonOutputDir, `${assetName}_35.json`)}`);
console.log(`wrote ${pakListPath}`);
