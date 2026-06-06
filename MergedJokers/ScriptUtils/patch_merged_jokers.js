const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const scriptUtilsDir = path.join(root, "ScriptUtils");
const jsonInput = path.join(scriptUtilsDir, "DT_PlayerJokers_35.json");
const jsonOutputDir = path.join(scriptUtilsDir, "patched");
const stageRoot = path.join(root, "ModStage");
const buildDir = path.join(root, "ModBuild");
const pakListPath = path.join(scriptUtilsDir, "MergedJokers_PakList.txt");
const buildBase = path.join(buildDir, "pakchunk99-MergedJokers-Windows_P");

const assetName = "DT_PlayerJokers";
const assetDir = "Progress";
const expectedHeader = 0x2780;
const targetMax = 10;
const minimumExpectedRows = 90;
const textMarker = Buffer.from("ST_UI", "ascii");
const trueBoolByte = Buffer.from([1]);

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

function endCString(buffer, offset, limit, label) {
  let end = offset;
  while (end < limit && buffer[end] !== 0) end++;
  if (end >= limit) {
    throw new Error(`${label}: unterminated string at 0x${offset.toString(16)}`);
  }
  return end + 1;
}

function cStringEnd(buffer, offset) {
  let end = offset;
  while (end < buffer.length && buffer[end] !== 0) end++;
  return end + 1;
}

function findMaxAvailableAfterSerializedText(data, row, nextOffset) {
  const candidates = [];

  for (let offset = row.offset; offset + 4 < nextOffset; offset++) {
    const length = data.readInt32LE(offset);
    if (length < 2 || length > 512 || offset + 4 + length > nextOffset) continue;

    const textStart = offset + 4;
    const textEnd = textStart + length;
    if (data[textEnd - 1] !== 0) continue;

    let printable = true;
    for (let index = textStart; index < textEnd - 1; index++) {
      if (data[index] < 32 || data[index] > 126) {
        printable = false;
        break;
      }
    }
    if (!printable) continue;

    const maxOffset = textEnd + 9;
    if (maxOffset + 4 > nextOffset || data[textEnd] !== 1) continue;

    const value = data.readDoubleLE(textEnd + 1);
    const current = data.readInt32LE(maxOffset);
    if (Number.isFinite(value) && value >= 0 && value <= 100 && current >= 1 && current <= 64) {
      candidates.push({ maxOffset, current });
    }
  }

  if (candidates.length === 0) {
    throw new Error(`${row.rowName}: maxAvailable field not found`);
  }

  return candidates[candidates.length - 1];
}

function findAllJokerRows(data, nameMap) {
  const rows = [];
  for (let offset = 0; offset + 20 < data.length; offset++) {
    const nameIndex = data.readUInt32LE(offset);
    const nameNumber = data.readUInt32LE(offset + 4);
    const rowName = nameMap[nameIndex];
    if (
      nameNumber === 0 &&
      typeof rowName === "string" &&
      rowName.startsWith("joker") &&
      data.readUInt16LE(offset + 8) === expectedHeader
    ) {
      rows.push({ rowName, offset });
    }
  }

  rows.sort((a, b) => a.offset - b.offset);
  if (rows.length < minimumExpectedRows) {
    throw new Error(`${assetName}: expected at least ${minimumExpectedRows} Joker-table rows, found ${rows.length}`);
  }
  return rows;
}

function findMaxAvailableOffset(data, row, nextOffset) {
  const firstTextOffset = data.indexOf(textMarker, row.offset);
  if (firstTextOffset < 0 || firstTextOffset >= nextOffset) {
    return findMaxAvailableAfterSerializedText(data, row, nextOffset);
  }

  const afterFirstText = endCString(data, firstTextOffset, nextOffset, row.rowName);
  const secondTextOffset = data.indexOf(textMarker, afterFirstText);

  let maxOffset;
  if (secondTextOffset >= 0 && secondTextOffset < nextOffset) {
    const afterDescriptionText = endCString(data, secondTextOffset, nextOffset, row.rowName);
    maxOffset = afterDescriptionText + 9;
  } else {
    maxOffset = afterFirstText + 17;
  }

  if (maxOffset + 4 > nextOffset) {
    throw new Error(`${row.rowName}: maxAvailable offset outside row`);
  }

  const current = data.readInt32LE(maxOffset);
  if (current < 1 || current > 64) {
    throw new Error(`${row.rowName}: suspicious maxAvailable ${current} at 0x${maxOffset.toString(16)}`);
  }

  return { maxOffset, current };
}

function patchJokerCaps(data, rows) {
  let changed = 0;
  const nonUpgradeRows = rows.filter((row) => !row.rowName.startsWith("jokerUpgrade"));
  if (nonUpgradeRows.length < minimumExpectedRows) {
    throw new Error(`${assetName}: expected at least ${minimumExpectedRows} non-upgrade Joker rows, found ${nonUpgradeRows.length}`);
  }

  for (const row of nonUpgradeRows) {
    const rowIndex = rows.indexOf(row);
    const nextOffset = rows[rowIndex + 1]?.offset ?? data.length;
    const { maxOffset, current } = findMaxAvailableOffset(data, row, nextOffset);
    if (current !== targetMax) {
      data.writeInt32LE(targetMax, maxOffset);
      changed++;
    }
    console.log(`${row.rowName}: maxAvailable ${current} -> ${targetMax} at 0x${maxOffset.toString(16)}`);
  }

  console.log(`joker caps patched ${changed}/${nonUpgradeRows.length} non-upgrade rows`);
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

function patchUnrestrictiveJokers(data, nameMap) {
  const patchTargets = [
    ...missionOnlyRows.map((rowName) => ({ rowName, propertyNames: ["canBeBought", "canBeGambled"] })),
    ...buyableRestrictedRows.map((rowName) => ({ rowName, propertyNames: ["canBeGambled"] })),
  ];

  const patches = patchTargets
    .map(({ rowName, propertyNames }) => findPatch(data, nameMap, rowName, propertyNames))
    .filter(Boolean)
    .sort((a, b) => Math.max(...b.insertionGroups.map((group) => group.offset)) - Math.max(...a.insertionGroups.map((group) => group.offset)));

  let patchedData = data;
  let insertedByteCount = 0;
  for (const patch of patches) {
    patchedData.writeUInt32LE(patch.patchedZeroMask, patch.zeroMaskOffset);
    for (const insertionGroup of patch.insertionGroups) {
      patchedData = Buffer.concat([
        patchedData.subarray(0, insertionGroup.offset),
        insertionGroup.bytes,
        patchedData.subarray(insertionGroup.offset),
      ]);
      insertedByteCount += insertionGroup.bytes.length;
    }
    console.log(
      `${patch.rowName}: zero mask 0x${patch.zeroMask.toString(16)} -> 0x${patch.patchedZeroMask.toString(16)}, enabled ${patch.changedProperties.join(", ")}`
    );
  }

  console.log(`unrestrictive jokers patched ${patches.length}/${patchTargets.length} rows`);
  return { patchedData, insertedByteCount };
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
patchJokerCaps(data, findAllJokerRows(data, asset.NameMap));
const { patchedData, insertedByteCount } = patchUnrestrictiveJokers(data, asset.NameMap);
data = patchedData;

exportEntry.Data = data.toString("base64");
exportEntry.SerialSize += insertedByteCount;

fs.writeFileSync(path.join(jsonOutputDir, `${assetName}_35.json`), JSON.stringify(asset, null, 2));
writePakList();

console.log(`inserted ${insertedByteCount} bool bytes`);
console.log(`wrote ${path.join(jsonOutputDir, `${assetName}_35.json`)}`);
console.log(`wrote ${pakListPath}`);
