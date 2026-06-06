const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const scriptUtilsDir = path.join(root, "ScriptUtils");
const jsonInput = path.join(scriptUtilsDir, "DT_PlayerJokers_35.json");
const jsonOutputDir = path.join(scriptUtilsDir, "patched");
const stageRoot = path.join(root, "ModStage");
const buildDir = path.join(root, "ModBuild");
const pakListPath = path.join(scriptUtilsDir, "NoJokerCaps_PakList.txt");
const buildBase = path.join(buildDir, "pakchunk99-NoJokerCaps-Windows_P");

const assetName = "DT_PlayerJokers";
const assetDir = "Progress";
const targetMax = 10;
const minimumExpectedRows = 90;
const expectedHeader = 0x2780;
const textMarker = Buffer.from("ST_UI", "ascii");

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

function findJokerRows(data, nameMap) {
  const rows = [];
  for (let offset = 0; offset + 20 < data.length; offset++) {
    const nameIndex = data.readUInt32LE(offset);
    const nameNumber = data.readUInt32LE(offset + 4);
    const rowName = nameMap[nameIndex];
    if (
      nameNumber === 0 &&
      typeof rowName === "string" &&
      rowName.startsWith("joker") &&
      !rowName.startsWith("jokerUpgrade") &&
      data.readUInt16LE(offset + 8) === expectedHeader
    ) {
      rows.push({ rowName, offset });
    }
  }

  rows.sort((a, b) => a.offset - b.offset);
  if (rows.length < minimumExpectedRows) {
    throw new Error(`${assetName}: expected at least ${minimumExpectedRows} non-upgrade Joker rows, found ${rows.length}`);
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
    // Upgrade Joker rows omit description text. Their maxAvailable field follows
    // the remaining name-text bytes and the serialized double value.
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

const data = Buffer.from(exportEntry.Data, "base64");
const rows = findJokerRows(data, asset.NameMap);
let changed = 0;

for (let index = 0; index < rows.length; index++) {
  const row = rows[index];
  const nextOffset = rows[index + 1]?.offset ?? data.length;
  const { maxOffset, current } = findMaxAvailableOffset(data, row, nextOffset);
  if (current !== targetMax) {
    data.writeInt32LE(targetMax, maxOffset);
    changed++;
  }
  console.log(`${row.rowName}: maxAvailable ${current} -> ${targetMax} at 0x${maxOffset.toString(16)}`);
}

exportEntry.Data = data.toString("base64");

fs.writeFileSync(path.join(jsonOutputDir, `${assetName}_35.json`), JSON.stringify(asset, null, 2));
writePakList();

console.log(`patched ${changed}/${rows.length} Joker rows`);
console.log(`wrote ${path.join(jsonOutputDir, `${assetName}_35.json`)}`);
console.log(`wrote ${pakListPath}`);
