const fs = require("fs");
const path = require("path");
const { execFileSync, spawnSync } = require("child_process");

const DEFAULT_MULTIPLIERS = [2, 3, 4, 5, 10];
const requestedMultipliers = process.argv.slice(2).map((value) => Number.parseInt(value, 10));
const multipliers = requestedMultipliers.length > 0 ? requestedMultipliers : DEFAULT_MULTIPLIERS;
const UE_VERSION = "UE5_7";

const root = path.resolve(__dirname, "..");
const workspace = path.resolve(root, "..");
const scriptUtilsDir = path.join(root, "ScriptUtils");
const sourceJsonDir = path.join(scriptUtilsDir, "source");
const patchedJsonDir = path.join(scriptUtilsDir, "patched");
const stageRoot = path.join(root, "ModStage");
const buildDir = path.join(root, "ModBuild");

const contentRoot = path.join(workspace, "FarFarWest_Unpacked_RetocLegacy", "FarFarWest", "Content");
const uassetGui = path.join(workspace, "UAssetGUI.exe");
const retoc = path.join(workspace, "retoc", "retoc.exe");

const stormBaseDelays = [2, 10, 40, 60];

const eventAssets = [
  "BP_Event_Storm",
  "BP_Event_Marauders_Raid",
  "BP_Event_Cryptic_Boss",
  "BP_Event_Cryptic_Buffalos",
  "BP_Event_Cryptic_GoToTrain",
  "BP_Event_Cryptic_Kamikazes",
  "BP_Event_Cryptic_Lich",
  "BP_Event_Cryptic_Memory",
  "BP_Event_Cryptic_Objective",
  "BP_Event_Cryptic_Objective_Intermitent",
  "BP_Event_Cryptic_Payload",
  "BP_Event_Cryptic_Revolvers",
  "BP_Event_Cryptic_Totem_A",
  "BP_Event_Cryptic_Tuto",
  "BP_Event_Cryptic_WaitForTrain",
];

const hordeAssets = [
  "BP_Horde_Cryptic_Horseman",
  "BP_Horde_Cryptic_NecromancerSmash",
  "BP_Horde_Cryptic_Wander_Assassins",
  "BP_Horde_Cryptic_Wander_Assassins_NoDeadeye",
  "BP_Horde_Cryptic_Wander_Buffalos",
  "BP_Horde_Cryptic_Wander_Grenadiers",
  "BP_Horde_Cryptic_Wander_RavenKamikazes",
  "BP_Horde_Cryptic_Wander_Revolvers",
  "BP_Horde_Cryptic_Wander_Shielders",
  "BP_Horde_Halloween2025",
  { assetName: "BP_Horde_HellFire", assetDir: path.join("Modifiers", "Assets", "HellFire") },
];

const assets = [
  ...eventAssets.map((assetName) => ({ assetName, assetDir: "Events", patchKind: "event" })),
  ...hordeAssets.map((asset) => {
    if (typeof asset === "string") {
      return { assetName: asset, assetDir: path.join("Enemies", "Hordes"), patchKind: "horde" };
    }
    return { patchKind: "horde", ...asset };
  }),
];

function cleanDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
}

function ensureTool(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`missing tool: ${filePath}`);
  }
}

function runTool(command, args) {
  execFileSync(command, args, { stdio: "inherit" });
}

function formatStatus(result) {
  if (result.signal) {
    return `signal ${result.signal}`;
  }
  return `exit ${result.status}`;
}

function runToolWithGeneratedOutput(command, args, expectedFiles) {
  const result = spawnSync(command, args, { stdio: "inherit" });
  if (result.error) {
    throw result.error;
  }
  if (result.status === 0) {
    return;
  }

  const missingFiles = expectedFiles.filter((filePath) => {
    if (!fs.existsSync(filePath)) {
      return true;
    }
    return fs.statSync(filePath).size === 0;
  });

  if (missingFiles.length === 0) {
    console.warn(`${path.basename(command)} returned ${formatStatus(result)} after writing output; continuing`);
    return;
  }

  throw new Error(`${path.basename(command)} failed with ${formatStatus(result)}; missing ${missingFiles.join(", ")}`);
}

function jsonPathFor(dir, assetName) {
  return path.join(dir, `${assetName}_35.json`);
}

function assetPath(asset) {
  return path.join(contentRoot, asset.assetDir, `${asset.assetName}.uasset`);
}

function stagePath(asset, activeStageRoot) {
  return path.join(activeStageRoot, "FarFarWest", "Content", asset.assetDir, `${asset.assetName}.uasset`);
}

function variantStageRoot(multiplier) {
  return path.join(stageRoot, `x${multiplier}`);
}

function buildBaseFor(multiplier) {
  return path.join(buildDir, `pakchunk99-MoreEnemiesX${multiplier}-Windows_P`);
}

function getDefaultExport(assetJson, assetName) {
  const exportName = `Default__${assetName}_C`;
  const exportEntry = assetJson.Exports.find((entry) => entry.ObjectName === exportName);
  if (!exportEntry || typeof exportEntry.Data !== "string") {
    throw new Error(`${assetName}: ${exportName} raw export not found`);
  }
  return exportEntry;
}

function writeDoubleList(values) {
  const buffer = Buffer.alloc(values.length * 8);
  values.forEach((value, index) => buffer.writeDoubleLE(value, index * 8));
  return buffer;
}

function replaceOnce(buffer, expected, replacement, label) {
  const offset = buffer.indexOf(expected);
  if (offset < 0) {
    throw new Error(`${label}: expected ${expected.toString("hex")} not found`);
  }
  if (buffer.indexOf(expected, offset + 1) >= 0) {
    throw new Error(`${label}: expected bytes matched more than once`);
  }
  replacement.copy(buffer, offset);
  return offset;
}

function canClassArrayAt(data, offset) {
  if (offset + 4 > data.length) {
    return false;
  }

  const count = data.readInt32LE(offset);
  if (count <= 0 || count > 200) {
    return false;
  }

  const refsStart = offset + 4;
  const refsEnd = refsStart + count * 4;
  if (refsEnd > data.length) {
    return false;
  }

  for (let index = 0; index < count; index++) {
    if (data.readInt32LE(refsStart + index * 4) >= 0) {
      return false;
    }
  }

  return true;
}

function parseClassArrayRuns(data, start, maxRuns) {
  let offset = start;
  const runs = [];

  while (runs.length < maxRuns && canClassArrayAt(data, offset)) {
    const count = data.readInt32LE(offset);
    const refsStart = offset + 4;
    const refs = [];

    for (let index = 0; index < count; index++) {
      refs.push(data.readInt32LE(refsStart + index * 4));
    }

    runs.push({ countOffset: offset, count, refs });
    offset = refsStart + count * 4;
  }

  return { start, end: offset, runs };
}

function findBestHordeRuns(data) {
  let best = { score: -1, start: 0, end: 0, runs: [] };

  for (let start = 0; start < Math.min(12, data.length); start++) {
    const parsed = parseClassArrayRuns(data, start, 5);
    const refCount = parsed.runs.reduce((total, run) => total + run.count, 0);
    const score = parsed.runs.length * 100 + refCount;
    if (score > best.score) {
      best = { ...parsed, score };
    }
  }

  return best;
}

function patchHordeData(assetName, data, multiplier) {
  const parsed = findBestHordeRuns(data);
  if (parsed.runs.length === 0) {
    throw new Error(`${assetName}: no horde arrays found`);
  }

  const parts = [data.subarray(0, parsed.start)];
  let before = 0;
  let after = 0;

  for (const run of parsed.runs) {
    const refs = [];
    for (let repeat = 0; repeat < multiplier; repeat++) {
      refs.push(...run.refs);
    }

    const runBuffer = Buffer.alloc(4 + refs.length * 4);
    runBuffer.writeInt32LE(refs.length, 0);
    refs.forEach((ref, index) => runBuffer.writeInt32LE(ref, 4 + index * 4));
    parts.push(runBuffer);

    before += run.count;
    after += refs.length;
  }

  parts.push(data.subarray(parsed.end));
  return {
    data: Buffer.concat(parts),
    changed: true,
    summary: `${parsed.runs.length} spawn arrays ${before} entries -> ${after}`,
  };
}

function parseEventRuns(data, start) {
  let offset = start;
  const runs = [];
  const delays = [];

  while (runs.length < 4 && canClassArrayAt(data, offset)) {
    const count = data.readInt32LE(offset);
    runs.push({ countOffset: offset, count });
    offset = offset + 4 + count * 4;

    if (offset + 8 <= data.length) {
      const value = data.readDoubleLE(offset);
      if (Number.isFinite(value) && value >= 0.05 && value <= 120) {
        delays.push({ offset, value });
        offset += 8;
      }
    }
  }

  return { start, end: offset, runs, delays };
}

function findBestEventRuns(data) {
  let best = { score: -1, start: 0, end: 0, runs: [], delays: [] };

  for (let start = 0; start < Math.min(20, data.length); start++) {
    const parsed = parseEventRuns(data, start);
    const refCount = parsed.runs.reduce((total, run) => total + run.count, 0);
    const score = parsed.delays.length * 1000 + parsed.runs.length * 100 + refCount;
    if (score > best.score) {
      best = { ...parsed, score };
    }
  }

  return best;
}

function patchEventData(assetName, data, multiplier) {
  if (assetName === "BP_Event_Storm") {
    const expected = writeDoubleList(stormBaseDelays);
    const replacement = writeDoubleList(stormBaseDelays.map((value) => value / multiplier));
    const offset = replaceOnce(data, expected, replacement, `${assetName}: base storm delays`);
    return {
      data,
      changed: true,
      summary: `base delays at 0x${offset.toString(16)} divided by ${multiplier}`,
    };
  }

  const parsed = findBestEventRuns(data);
  if (parsed.delays.length === 0) {
    return {
      data,
      changed: false,
      summary: "no explicit spawn delay overrides",
    };
  }

  const patched = Buffer.from(data);
  for (const delay of parsed.delays) {
    patched.writeDoubleLE(delay.value / multiplier, delay.offset);
  }

  const before = parsed.delays.map((delay) => delay.value).join(", ");
  const after = parsed.delays.map((delay) => delay.value / multiplier).join(", ");
  return {
    data: patched,
    changed: true,
    summary: `spawn delays ${before} -> ${after}`,
  };
}

function exportSourceJson(asset) {
  const sourcePath = assetPath(asset);
  const outputPath = jsonPathFor(sourceJsonDir, asset.assetName);

  if (!fs.existsSync(sourcePath)) {
    throw new Error(`${asset.assetName}: source asset not found at ${sourcePath}`);
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  if (!fs.existsSync(outputPath)) {
    runTool(uassetGui, ["tojson", sourcePath, outputPath, "35"]);
  }
  return outputPath;
}

function patchAsset(asset, multiplier, activePatchedJsonDir) {
  const sourcePath = exportSourceJson(asset);
  const assetJson = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
  const defaultExport = getDefaultExport(assetJson, asset.assetName);
  const originalData = Buffer.from(defaultExport.Data, "base64");
  const result = asset.patchKind === "horde"
    ? patchHordeData(asset.assetName, originalData, multiplier)
    : patchEventData(asset.assetName, originalData, multiplier);

  if (!result.changed) {
    console.log(`${asset.assetName}: skipped, ${result.summary}`);
    return null;
  }

  defaultExport.Data = result.data.toString("base64");
  const outputPath = jsonPathFor(activePatchedJsonDir, asset.assetName);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(assetJson, null, 2));
  console.log(`${asset.assetName}: ${result.summary}`);
  return { ...asset, jsonPath: outputPath };
}

function stageAsset(asset, activeStageRoot) {
  const target = stagePath(asset, activeStageRoot);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const expectedFiles = [target];
  for (const extension of [".uexp", ".ubulk"]) {
    if (fs.existsSync(assetPath(asset).replace(/\.uasset$/i, extension))) {
      expectedFiles.push(target.replace(/\.uasset$/i, extension));
    }
  }
  runToolWithGeneratedOutput(uassetGui, ["fromjson", asset.jsonPath, target, "35"], expectedFiles);
}

function cleanBuildOutputs() {
  fs.mkdirSync(buildDir, { recursive: true });

  for (const entry of fs.readdirSync(buildDir)) {
    if (/^pakchunk99-MoreEnemies(?:X\d+)?-Windows_P\.(pak|ucas|utoc)$/.test(entry)) {
      fs.rmSync(path.join(buildDir, entry), { force: true });
    }
  }
}

function buildPak(multiplier, activeStageRoot) {
  const buildBase = buildBaseFor(multiplier);
  runTool(retoc, ["to-zen", "--version", UE_VERSION, activeStageRoot, `${buildBase}.utoc`]);
  return buildBase;
}

ensureTool(uassetGui);
ensureTool(retoc);

for (const multiplier of multipliers) {
  if (!Number.isInteger(multiplier) || multiplier < 1) {
    throw new Error(`invalid multiplier: ${multiplier}`);
  }
}

cleanDir(sourceJsonDir);
cleanDir(patchedJsonDir);
cleanDir(stageRoot);
cleanBuildOutputs();

for (const multiplier of multipliers) {
  console.log(`building More Enemies x${multiplier}`);
  const activePatchedJsonDir = path.join(patchedJsonDir, `x${multiplier}`);
  const activeStageRoot = variantStageRoot(multiplier);
  cleanDir(activePatchedJsonDir);
  cleanDir(activeStageRoot);

  const patchedAssets = assets.map((asset) => patchAsset(asset, multiplier, activePatchedJsonDir)).filter(Boolean);
  if (patchedAssets.length === 0) {
    throw new Error(`x${multiplier}: no assets were patched`);
  }

  for (const asset of patchedAssets) {
    stageAsset(asset, activeStageRoot);
  }

  const buildBase = buildPak(multiplier, activeStageRoot);
  console.log(`x${multiplier}: patched ${patchedAssets.length} assets`);
  console.log(`x${multiplier}: wrote ${buildBase}.pak`);
  console.log(`x${multiplier}: wrote ${buildBase}.ucas`);
  console.log(`x${multiplier}: wrote ${buildBase}.utoc`);
}
