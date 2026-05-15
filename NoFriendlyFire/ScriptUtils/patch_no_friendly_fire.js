const fs = require("fs");
const path = require("path");
const cp = require("child_process");

const repoRoot = path.resolve(__dirname, "..", "..");
const modRoot = path.resolve(__dirname, "..");
const tools = {
  uassetgui: path.join(repoRoot, "UAssetGUI.exe"),
  retoc: path.join(repoRoot, "retoc", "retoc.exe"),
};

const contentRoot = path.join(repoRoot, "FarFarWest_Unpacked_RetocLegacy", "FarFarWest", "Content");
const sourceAsset = path.join(contentRoot, "Player", "BP_Player.uasset");
const sourceDir = path.join(modRoot, "ScriptUtils", "source");
const patchedDir = path.join(modRoot, "ScriptUtils", "patched");
const stageRoot = path.join(modRoot, "ModStage");
const stagedAsset = path.join(stageRoot, "FarFarWest", "Content", "Player", "BP_Player.uasset");
const buildDir = path.join(modRoot, "ModBuild");
const buildBaseName = "pakchunk99-NoFriendlyFire-Windows_P";
const buildBase = path.join(buildDir, buildBaseName);
const ueVersion = "UE5_7";

const exportIndex = "35";
const ubergraphName = "ExecuteUbergraph_BP_Player";

// Data offsets are relative to the base64 ScriptBytecode Data field in export 35.
// This patch edits only the target of an existing JumpIfNot instruction:
// player-controlled causer + Causer != Self now goes to the original no-damage path.
const prologueDataOffset = 0x10329;
const originalPrologue = Buffer.from(
  "076d5700000001000000fe0000000000000015000000140001000000ad000000000000001500000068d9feffff00010000002c03000000000000150000001716072c5900000001000000ad0000000000000015000000",
  "hex"
);
const branchOpcodeDataOffset = 0x10369;
const branchTargetDataOffset = 0x1036a;
const originalFriendlyFireScriptOffset = 0x592c;
const noDamageScriptOffset = 0x576d;
const selfComparisonOperandDataOffset = 0x10367;
const conditionDataOffset = 0x1036e;
const expectedConditionBytes = Buffer.from("0001000000ad0000000000000015000000", "hex");
const selfToken = 0x17;
const noObjectToken = 0x2a;
const playerStateCastBranchOpcodeDataOffset = 0x108f4;
const playerStateCastConditionDataOffset = 0x108f9;
const playerStateCastSuccessJumpOpcodeDataOffset = 0x1090a;
const playerStateCastSuccessJumpTargetDataOffset = 0x1090b;
const expectedPlayerStateCastConditionBytes = Buffer.from("0001000000220300000b00000015000000", "hex");

function run(command, args, options = {}) {
  console.log(`> ${[command, ...args].map((arg) => (/\s/.test(arg) ? `"${arg}"` : arg)).join(" ")}`);
  cp.execFileSync(command, args, { stdio: "inherit", ...options });
}

function requireFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing required file: ${filePath}`);
  }
}

function cleanDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
}

function cleanBuildOutputs() {
  fs.mkdirSync(buildDir, { recursive: true });
  for (const ext of [".pak", ".ucas", ".utoc"]) {
    fs.rmSync(`${buildBase}${ext}`, { force: true });
  }
}

function assertBytes(data, offset, expected, label) {
  const actual = data.subarray(offset, offset + expected.length);
  if (!actual.equals(expected)) {
    throw new Error(
      `${label} mismatch at data offset 0x${offset.toString(16)}\n` +
        `expected ${expected.toString("hex")}\n` +
        `actual   ${actual.toString("hex")}`
    );
  }
}

function loadExport(jsonPath, exportName) {
  const json = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
  const assetExports = json.Exports || json.exports || [];
  const assetExport = assetExports.find((entry) => entry.ObjectName === exportName || entry.Name === exportName);
  if (!assetExport) {
    throw new Error(`Could not find export ${exportName} in ${jsonPath}`);
  }
  return { json, assetExport };
}

function saveJson(jsonPath, json) {
  fs.mkdirSync(path.dirname(jsonPath), { recursive: true });
  fs.writeFileSync(jsonPath, JSON.stringify(json, null, 2));
}

function main() {
  requireFile(tools.uassetgui);
  requireFile(tools.retoc);
  requireFile(sourceAsset);

  cleanDir(sourceDir);
  cleanDir(patchedDir);
  cleanDir(stageRoot);
  cleanBuildOutputs();

  const sourceJson = path.join(sourceDir, "BP_Player_35.json");
  const patchedJson = path.join(patchedDir, "BP_Player_35.json");

  run(tools.uassetgui, ["tojson", sourceAsset, sourceJson, exportIndex]);

  const { json, assetExport } = loadExport(sourceJson, ubergraphName);
  const data = Buffer.from(assetExport.Data, "base64");

  assertBytes(data, prologueDataOffset, originalPrologue, "ExecuteUbergraph prologue");

  if (data[branchOpcodeDataOffset] !== 0x07) {
    throw new Error(
      `Expected JumpIfNot opcode 0x07 at data offset 0x${branchOpcodeDataOffset.toString(16)}, ` +
        `found 0x${data[branchOpcodeDataOffset].toString(16)}`
    );
  }

  const currentTarget = data.readUInt32LE(branchTargetDataOffset);
  if (currentTarget !== originalFriendlyFireScriptOffset) {
    throw new Error(
      `Expected friendly-fire branch target 0x${originalFriendlyFireScriptOffset.toString(16)} at ` +
        `data offset 0x${branchTargetDataOffset.toString(16)}, found 0x${currentTarget.toString(16)}`
    );
  }

  assertBytes(data, conditionDataOffset, expectedConditionBytes, "Causer != Self branch condition");
  if (data[selfComparisonOperandDataOffset] !== selfToken) {
    throw new Error(
      `Expected Self token 0x${selfToken.toString(16)} at data offset 0x${selfComparisonOperandDataOffset.toString(16)}, ` +
        `found 0x${data[selfComparisonOperandDataOffset].toString(16)}`
    );
  }

  data[selfComparisonOperandDataOffset] = noObjectToken;
  data.writeUInt32LE(noDamageScriptOffset, branchTargetDataOffset);

  if (data[playerStateCastBranchOpcodeDataOffset] !== 0x07) {
    throw new Error(
      `Expected PlayerState cast JumpIfNot opcode 0x07 at data offset 0x${playerStateCastBranchOpcodeDataOffset.toString(16)}, ` +
        `found 0x${data[playerStateCastBranchOpcodeDataOffset].toString(16)}`
    );
  }
  if (data.readUInt32LE(playerStateCastBranchOpcodeDataOffset + 1) !== noDamageScriptOffset) {
    throw new Error(
      `Expected PlayerState cast failure target 0x${noDamageScriptOffset.toString(16)} at data offset 0x${(playerStateCastBranchOpcodeDataOffset + 1).toString(16)}, ` +
        `found 0x${data.readUInt32LE(playerStateCastBranchOpcodeDataOffset + 1).toString(16)}`
    );
  }
  assertBytes(data, playerStateCastConditionDataOffset, expectedPlayerStateCastConditionBytes, "PlayerState cast branch condition");
  if (data[playerStateCastSuccessJumpOpcodeDataOffset] !== 0x06) {
    throw new Error(
      `Expected PlayerState cast success Jump opcode 0x06 at data offset 0x${playerStateCastSuccessJumpOpcodeDataOffset.toString(16)}, ` +
        `found 0x${data[playerStateCastSuccessJumpOpcodeDataOffset].toString(16)}`
    );
  }
  const currentPlayerStateTarget = data.readUInt32LE(playerStateCastSuccessJumpTargetDataOffset);
  if (currentPlayerStateTarget !== originalFriendlyFireScriptOffset) {
    throw new Error(
      `Expected PlayerState causer damage target 0x${originalFriendlyFireScriptOffset.toString(16)} at ` +
        `data offset 0x${playerStateCastSuccessJumpTargetDataOffset.toString(16)}, found 0x${currentPlayerStateTarget.toString(16)}`
    );
  }

  data.writeUInt32LE(noDamageScriptOffset, playerStateCastSuccessJumpTargetDataOffset);
  assetExport.Data = data.toString("base64");
  saveJson(patchedJson, json);

  fs.mkdirSync(path.dirname(stagedAsset), { recursive: true });
  run(tools.uassetgui, ["fromjson", patchedJson, stagedAsset]);

  run(tools.retoc, ["to-zen", "--version", ueVersion, stageRoot, `${buildBase}.utoc`]);

  for (const ext of [".pak", ".ucas", ".utoc"]) {
    requireFile(`${buildBase}${ext}`);
  }

  console.log("");
  console.log("NoFriendlyFire rebuilt with branch-target-only BP_Player patch.");
  console.log(
    `Patched existing JumpIfNot target at data 0x${branchTargetDataOffset.toString(16)} ` +
      `from 0x${originalFriendlyFireScriptOffset.toString(16)} to 0x${noDamageScriptOffset.toString(16)}.`
  );
  console.log(
    `Patched player-causer self comparison operand at data 0x${selfComparisonOperandDataOffset.toString(16)} ` +
      `from Self to NoObject, so self-caused player spell damage takes the same no-damage branch.`
  );
  console.log(
    `Patched existing PlayerState-causer Jump target at data 0x${playerStateCastSuccessJumpTargetDataOffset.toString(16)} ` +
      `from 0x${originalFriendlyFireScriptOffset.toString(16)} to 0x${noDamageScriptOffset.toString(16)}.`
  );
  console.log(`Output: ${buildBase}.pak/.ucas/.utoc`);
}

main();
