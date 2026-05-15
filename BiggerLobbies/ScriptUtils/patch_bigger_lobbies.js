const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const workspace = path.resolve(root, "..");
const scriptUtilsDir = path.join(root, "ScriptUtils");
const jsonOutputDir = path.join(scriptUtilsDir, "patched");
const toZenDir = path.join(scriptUtilsDir, "to_zen");
const rawInputDir = path.join(root, "RawChunks", "original");
const rawOutputRoot = path.join(root, "RawChunks", "raw_mod");
const rawOutputDir = path.join(rawOutputRoot, "chunks");
const stageRoot = path.join(root, "ModStage");
const buildDir = path.join(root, "ModBuild");
const pakListPath = path.join(scriptUtilsDir, "BiggerLobbies_PakList.txt");
const buildBase = path.join(buildDir, "pakchunk99-BiggerLobbies-Windows_P");

const int4 = Buffer.from("04000000", "hex");
const int16 = Buffer.from("10000000", "hex");
const kismetInt5 = Buffer.from("1d05000000", "hex");
const kismetInt17 = Buffer.from("1d11000000", "hex");
const kismetInt3 = Buffer.from("1d03000000", "hex");
const kismetInt15 = Buffer.from("1d0f000000", "hex");
const kismetRocketSelectDefault2 = Buffer.from("00010000005c010000020000000c000000", "hex");
const kismetRocketTempInt11 = Buffer.from("0001000000c30100000b0000000c000000", "hex");
const kismetRocketSelectDefault0 = Buffer.from("00010000005c010000000000000c000000", "hex");
const kismetRocketTempInt5 = Buffer.from("0001000000c3010000050000000c000000", "hex");
const kismetPumpkinSelectDefault2 = Buffer.from("0001000000b60000000200000004000000", "hex");
const kismetPumpkinTempReal5 = Buffer.from("0001000000f20000000500000004000000", "hex");
const kismetKwartPillarSelectDefault = Buffer.from("0001000000b80000000000000009000000", "hex");
const kismetKwartPillarTempInt2 = Buffer.from("0001000000f50000000200000009000000", "hex");
const kismetDrillGaugeSelectDefault = Buffer.from("0001000000d70000000000000016000000", "hex");
const kismetDrillGaugeTempReal = Buffer.from("0001000000200100000000000016000000", "hex");
const kismetMemoryRecipeSelectDefaultInit = Buffer.from("0001000000ea0000000000000017000000", "hex");
const kismetMemoryRecipeTempInt = Buffer.from("0001000000440100000000000017000000", "hex");
const kismetMemoryRecipeSelectDefaultOnRep = Buffer.from("0001000000ea0000000000000035000000", "hex");
const kismetMemoryRecipeTempReal = Buffer.from("0001000000460100000000000035000000", "hex");

const assets = [
  {
    assetName: "BP_Manager_Multiplayer",
    assetDir: "Gamework",
    jsonInput: path.join(scriptUtilsDir, "BP_Manager_Multiplayer_35.json"),
    chunkId: "9891acd0db03f7ab00000001",
    exports: [{
      exportName: "Default__BP_Manager_Multiplayer_C",
      patches: [
      {
        name: "session max players default 4 -> 16",
        jsonOffset: 0x13,
        expected: int4,
        replacement: int16,
      },
      ],
    }],
  },
  {
    assetName: "BP_PlayerState",
    assetDir: "Player",
    jsonInput: path.join(scriptUtilsDir, "Player__BP_PlayerState_35.json"),
    chunkId: "2460252a2573bb6700000001",
    exports: [{
      exportName: "F_AutoKickIsRules",
      patches: [
      {
        name: "auto-kick threshold 5 players -> 17 players",
        jsonOffset: 0x360,
        expected: kismetInt5,
        replacement: kismetInt17,
      },
      ],
    }],
  },
  {
    assetName: "UI_Menu_Container_CurrentSession",
    assetDir: "Interfaces/MainMenu",
    jsonInput: path.join(scriptUtilsDir, "UI_Menu_Container_CurrentSession_35.json"),
    chunkId: "469cbdfc920be3a200000001",
    exports: [{
      exportName: "ExecuteUbergraph_UI_Menu_Container_CurrentSession",
      patches: [
      {
        name: "invite-slot loop last index 3 -> 15",
        jsonOffset: 0xc64,
        expected: kismetInt3,
        replacement: kismetInt15,
      },
      ],
    }],
  },
  {
    assetName: "BP_TntMissileLauncher",
    assetDir: "Objectives/Assets/TntMissile",
    jsonInput: path.join(scriptUtilsDir, "BP_TntMissileLauncher_35.json"),
    chunkId: "9021321bca0cd2fe00000001",
    exports: [{
      exportName: "ExecuteUbergraph_BP_TntMissileLauncher",
      patches: [
      {
        name: "Rocket Launch first player-count select default -> 4-player slot",
        jsonOffset: 0x3111,
        expected: kismetRocketSelectDefault2,
        replacement: kismetRocketTempInt11,
      },
      {
        name: "Rocket Launch second player-count select default -> 4-player slot",
        jsonOffset: 0x3385,
        expected: kismetRocketSelectDefault0,
        replacement: kismetRocketTempInt5,
      },
      ],
    }],
  },
  {
    assetName: "BP_CursedPumpkin",
    assetDir: "Objectives/Assets/Pumpkins",
    jsonInput: path.join(scriptUtilsDir, "BP_CursedPumpkin_35.json"),
    chunkId: "008a14e2264f07a000000001",
    exports: [{
      exportName: "ExecuteUbergraph_BP_CursedPumpkin",
      patches: [
      {
        name: "Cursed Pumpkin player-count select default -> 4-player slot",
        jsonOffset: 0x179a,
        expected: kismetPumpkinSelectDefault2,
        replacement: kismetPumpkinTempReal5,
      },
      ],
    }],
  },
  {
    assetName: "BP_KwartPillarButton",
    assetDir: "Objectives/Assets/Batteries",
    jsonInput: path.join(scriptUtilsDir, "BP_KwartPillarButton_35.json"),
    chunkId: "5c8f3cf0fa88ffbd00000001",
    exports: [{
      exportName: "F_AssignWrongs",
      patches: [
      {
        name: "Kwart Pillar player-count select default -> 4-player slot",
        jsonOffset: 0x4d4,
        expected: kismetKwartPillarSelectDefault,
        replacement: kismetKwartPillarTempInt2,
      },
      ],
    }],
  },
  {
    assetName: "BP_Gauge_DrillMachine",
    assetDir: "Objectives/Assets/DrillingMachine",
    jsonInput: path.join(scriptUtilsDir, "BP_Gauge_DrillMachine_35.json"),
    chunkId: "f086748469919ac800000001",
    exports: [{
      exportName: "F_GetValueOverTimeBaseOnPlayerCount",
      patches: [
      {
        name: "Drill Machine gauge player-count select default -> 4-player slot",
        jsonOffset: 0x461,
        expected: kismetDrillGaugeSelectDefault,
        replacement: kismetDrillGaugeTempReal,
      },
      ],
    }],
  },
  {
    assetName: "BP_MemoryObjective_RandomRecipe",
    assetDir: "Objectives/Assets/Alkemisto",
    jsonInput: path.join(scriptUtilsDir, "BP_MemoryObjective_RandomRecipe_35.json"),
    chunkId: "9c47e518e1c0d80800000001",
    exports: [
    {
      exportName: "F_InitRecipe",
      patches: [
      {
        name: "Memory Recipe init player-count select default -> 4-player slot",
        jsonOffset: 0x9c2,
        expected: kismetMemoryRecipeSelectDefaultInit,
        replacement: kismetMemoryRecipeTempInt,
      },
      ],
    },
    {
      exportName: "OnRep_dirtyUpdateRecipePool",
      patches: [
      {
        name: "Memory Recipe replicated pool player-count select default -> 4-player slot",
        jsonOffset: 0x8a9,
        expected: kismetMemoryRecipeSelectDefaultOnRep,
        replacement: kismetMemoryRecipeTempReal,
      },
      ],
    },
    ],
  },
];

function cleanDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
}

function patchBytes(buffer, offset, expected, replacement, label) {
  const found = buffer.subarray(offset, offset + expected.length);
  if (!found.equals(expected)) {
    throw new Error(
      `${label}: expected ${expected.toString("hex")} at 0x${offset.toString(16)}, found ${found.toString("hex")}`
    );
  }
  replacement.copy(buffer, offset);
}

function patchBytesResizing(buffer, offset, expected, replacement, label) {
  const found = buffer.subarray(offset, offset + expected.length);
  if (!found.equals(expected)) {
    throw new Error(
      `${label}: expected ${expected.toString("hex")} at 0x${offset.toString(16)}, found ${found.toString("hex")}`
    );
  }
  return Buffer.concat([buffer.subarray(0, offset), replacement, buffer.subarray(offset + expected.length)]);
}

function patchAsset(assetSpec) {
  const asset = JSON.parse(fs.readFileSync(assetSpec.jsonInput, "utf8"));
  const rawInput = path.join(rawInputDir, assetSpec.chunkId);
  const rawOutput = path.join(rawOutputDir, assetSpec.chunkId);
  const rawData = assetSpec.rawMode === "generated-by-to-zen" ? null : fs.readFileSync(rawInput);

  for (const exportSpec of assetSpec.exports) {
    const exportEntry = asset.Exports.find((entry) => entry.ObjectName === exportSpec.exportName);
    if (!exportEntry || typeof exportEntry.Data !== "string") {
      throw new Error(`${assetSpec.assetName}: ${exportSpec.exportName} raw export not found`);
    }

    const originalExportData = Buffer.from(exportEntry.Data, "base64");
    let patchedExportData = Buffer.from(originalExportData);

    for (const patch of exportSpec.patches) {
      if (patch.expected.length === patch.replacement.length) {
        patchBytes(
          patchedExportData,
          patch.jsonOffset,
          patch.expected,
          patch.replacement,
          `${assetSpec.assetName} ${patch.name} json`
        );
      } else {
        patchedExportData = patchBytesResizing(
          patchedExportData,
          patch.jsonOffset,
          patch.expected,
          patch.replacement,
          `${assetSpec.assetName} ${patch.name} json`
        );
      }
      console.log(
        `${assetSpec.assetName}: ${patch.name} json 0x${patch.jsonOffset.toString(16)} ` +
          `${patch.expected.toString("hex")} -> ${patch.replacement.toString("hex")}`
      );
    }

    exportEntry.Data = patchedExportData.toString("base64");

    if (assetSpec.rawMode === "generated-by-to-zen") {
      console.log(`${assetSpec.assetName}: raw chunk is generated by retoc to-zen after fromjson`);
      continue;
    }

    const rawExportOffset = rawData.indexOf(originalExportData);
    if (rawExportOffset < 0) {
      throw new Error(`${assetSpec.assetName}: ${exportSpec.exportName} original export data not found in raw chunk ${assetSpec.chunkId}`);
    }
    if (rawData.indexOf(originalExportData, rawExportOffset + 1) >= 0) {
      throw new Error(`${assetSpec.assetName}: ${exportSpec.exportName} original export data matched more than once in raw chunk ${assetSpec.chunkId}`);
    }

    for (const patch of exportSpec.patches) {
      const rawOffset = rawExportOffset + patch.jsonOffset;
      patchBytes(rawData, rawOffset, patch.expected, patch.replacement, `${assetSpec.assetName} ${patch.name} raw`);
      console.log(
        `${assetSpec.assetName}: ${patch.name} raw 0x${rawOffset.toString(16)} ` +
          `${patch.expected.toString("hex")} -> ${patch.replacement.toString("hex")}`
      );
    }
  }

  fs.writeFileSync(path.join(jsonOutputDir, `${assetSpec.assetName}_35.json`), JSON.stringify(asset, null, 2));
  if (rawData) {
    fs.writeFileSync(rawOutput, rawData);
  }
}

function writePatchedConfig() {
  const source = path.join(workspace, "FarFarWest_Unpacked_PakFiles", "FarFarWest", "Config", "DefaultGame.ini");
  const target = path.join(stageRoot, "FarFarWest", "Config", "DefaultGame.ini");
  const original = fs.readFileSync(source, "utf8");
  const patched = original.replace("[/Script/Engine.GameSession]\r\nMaxPlayers=10", "[/Script/Engine.GameSession]\r\nMaxPlayers=16");
  if (patched === original) {
    throw new Error("DefaultGame.ini: MaxPlayers=10 setting not found");
  }
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, patched);
  console.log("DefaultGame.ini: GameSession MaxPlayers 10 -> 16");
}

function writePakList() {
  const lines = [];
  for (const asset of assets) {
    const sourceBase = path.join(stageRoot, "FarFarWest", "Content", asset.assetDir, asset.assetName);
    const mountBase = `../../../FarFarWest/Content/${asset.assetDir}/${asset.assetName}`;
    fs.mkdirSync(path.dirname(sourceBase), { recursive: true });
    lines.push(`"${sourceBase.replaceAll("\\", "/")}.uasset" "${mountBase}.uasset"`);
    lines.push(`"${sourceBase.replaceAll("\\", "/")}.uexp" "${mountBase}.uexp"`);
  }

  const configSource = path.join(stageRoot, "FarFarWest", "Config", "DefaultGame.ini");
  lines.push(`"${configSource.replaceAll("\\", "/")}" "../../../FarFarWest/Config/DefaultGame.ini"`);
  fs.writeFileSync(pakListPath, lines.join("\n") + "\n");
}

cleanDir(jsonOutputDir);
cleanDir(toZenDir);
cleanDir(rawOutputDir);
cleanDir(stageRoot);
fs.mkdirSync(buildDir, { recursive: true });
for (const extension of [".pak", ".ucas", ".utoc"]) {
  fs.rmSync(`${buildBase}${extension}`, { force: true });
}

fs.writeFileSync(
  path.join(rawOutputRoot, "manifest.json"),
  JSON.stringify({ chunk_paths: {}, version: "ReplaceIoChunkHashWithIoHash", mount_point: "../../../" }, null, 2)
);

for (const asset of assets) {
  patchAsset(asset);
}
writePatchedConfig();
writePakList();

console.log(`wrote ${jsonOutputDir}`);
console.log(`wrote ${rawOutputRoot}`);
console.log(`wrote ${pakListPath}`);
