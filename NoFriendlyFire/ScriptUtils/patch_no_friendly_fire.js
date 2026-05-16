const fs = require("fs");
const path = require("path");
const cp = require("child_process");

const repoRoot = path.resolve(__dirname, "..", "..");
const modRoot = path.resolve(__dirname, "..");
const tools = {
  uassetgui: path.join(repoRoot, "UAssetGUI.exe"),
  retoc: path.join(repoRoot, "retoc", "retoc.exe"),
  unrealPak: "C:\\UE_5.7\\Engine\\Binaries\\Win64\\UnrealPak.exe",
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
const toZenProbeBase = path.join(buildDir, "pakchunk99-NoFriendlyFire-ToZenProbe-Windows_P");
const obsoleteRawTestBase = path.join(buildDir, "pakchunk99-NoFriendlyFire-Raw-Windows_P");
const rawOutputRoot = path.join(modRoot, "RawChunks", "raw_mod");
const rawOutputDir = path.join(rawOutputRoot, "chunks");
const toZenProbeRawDir = path.join(modRoot, "RawChunks", "tozen_probe");
const pakListPath = path.join(modRoot, "ScriptUtils", "NoFriendlyFire_PakList.txt");
const ueVersion = "UE5_7";

const exportIndex = "35";
const ubergraphName = "ExecuteUbergraph_BP_Player";

// Data offsets are relative to the base64 ScriptBytecode Data field in export 35.
// This patch edits only existing instructions:
// - player-controlled causer + Causer != Self now goes to the original no-damage path
// - Causer is compared against NoObject instead of Self so self-spell damage uses that path too
const prologueDataOffset = 0x10329;
const originalPrologue = Buffer.from(
  "076d5700000001000000fe0000000000000015000000140001000000ad000000000000001500000068d9feffff00010000002c03000000000000150000001716072c5900000001000000ad0000000000000015000000",
  "hex"
);
const branchOpcodeDataOffset = 0x10369;
const branchTargetDataOffset = 0x1036a;
const originalFriendlyFireScriptOffset = 0x592c;
const noDamageScriptOffset = 0x5627;
const selfComparisonOperandDataOffset = 0x10367;
const conditionDataOffset = 0x1036e;
const expectedConditionBytes = Buffer.from("0001000000ad0000000000000015000000", "hex");
const selfToken = 0x17;
const noObjectToken = 0x2a;
const playerStateCastBranchOpcodeDataOffset = 0x108f4;
const playerStateCastConditionDataOffset = 0x108f9;
const playerStateCastSuccessJumpOpcodeDataOffset = 0x1090a;
const playerStateCastSuccessJumpTargetDataOffset = 0x1090b;
const playerStateCastFailureScriptOffset = 0x576d;
const expectedPlayerStateCastConditionBytes = Buffer.from("0001000000220300000b00000015000000", "hex");


function run(command, args, options = {}) {
  console.log(`> ${[command, ...args].map((arg) => (/\s/.test(arg) ? `"${arg}"` : arg)).join(" ")}`);
  cp.execFileSync(command, args, { stdio: "inherit", ...options });
}

function capture(command, args, options = {}) {
  return cp.execFileSync(command, args, { encoding: "utf8", ...options });
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
  for (const base of [buildBase, toZenProbeBase, obsoleteRawTestBase]) {
    for (const ext of [".pak", ".ucas", ".utoc"]) {
      fs.rmSync(`${base}${ext}`, { force: true });
    }
  }
}

function cleanProbeOutputs() {
  for (const ext of [".pak", ".ucas", ".utoc"]) {
    fs.rmSync(`${toZenProbeBase}${ext}`, { force: true });
  }
}

function writeRawManifest() {
  fs.writeFileSync(
    path.join(rawOutputRoot, "manifest.json"),
    JSON.stringify({ chunk_paths: {}, version: "ReplaceIoChunkHashWithIoHash", mount_point: "../../../" }, null, 2)
  );
}

function findExportBundleChunkIds(utocPath) {
  const output = capture(tools.retoc, ["list", utocPath]);
  const matches = output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.includes(" ExportBundleData"));

  if (matches.length < 1) {
    throw new Error(`Expected at least one ExportBundleData chunk in ${utocPath}, found none.`);
  }

  return matches.map((match) => {
    const parts = match.split(/\s+/);
    if (parts.length < 2 || !/^[0-9a-f]+$/i.test(parts[1])) {
      throw new Error(`Could not parse ExportBundleData chunk id from: ${match}`);
    }
    return parts[1];
  });
}

function writePakList() {
  const assets = [
    ["Player", "BP_Player"],
  ];
  const lines = [];
  for (const [assetDir, assetName] of assets) {
    const stagedBase = path.join(stageRoot, "FarFarWest", "Content", assetDir, assetName);
    const mountDir = assetDir.replaceAll("\\", "/");
    const mountBase = `../../../FarFarWest/Content/${mountDir}/${assetName}`;
    for (const ext of [".uasset", ".uexp"]) {
      lines.push(`"${`${stagedBase}${ext}`.replaceAll("\\", "/")}" "${mountBase}${ext}"`);
    }
  }
  fs.writeFileSync(pakListPath, `${lines.join("\n")}\n`);
}

function cleanFinalOutputs() {
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

function patchPlayer(assetExport) {
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
  if (data.readUInt32LE(playerStateCastBranchOpcodeDataOffset + 1) !== playerStateCastFailureScriptOffset) {
    throw new Error(
      `Expected PlayerState cast failure target 0x${playerStateCastFailureScriptOffset.toString(16)} at data offset 0x${(playerStateCastBranchOpcodeDataOffset + 1).toString(16)}, ` +
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
}

function main() {
  requireFile(tools.uassetgui);
  requireFile(tools.retoc);
  requireFile(tools.unrealPak);
  requireFile(sourceAsset);

  cleanDir(sourceDir);
  cleanDir(patchedDir);
  cleanDir(stageRoot);
  cleanDir(rawOutputDir);
  fs.rmSync(toZenProbeRawDir, { recursive: true, force: true });
  cleanBuildOutputs();

  const sourceJson = path.join(sourceDir, "BP_Player_35.json");
  const patchedJson = path.join(patchedDir, "BP_Player_35.json");

  run(tools.uassetgui, ["tojson", sourceAsset, sourceJson, exportIndex]);

  const { json, assetExport } = loadExport(sourceJson, ubergraphName);
  patchPlayer(assetExport);
  saveJson(patchedJson, json);

  fs.mkdirSync(path.dirname(stagedAsset), { recursive: true });
  run(tools.uassetgui, ["fromjson", patchedJson, stagedAsset]);

  run(tools.retoc, ["to-zen", "--version", ueVersion, stageRoot, `${toZenProbeBase}.utoc`]);
  const exportBundleChunkIds = findExportBundleChunkIds(`${toZenProbeBase}.utoc`);
  run(tools.retoc, ["unpack-raw", `${toZenProbeBase}.utoc`, toZenProbeRawDir]);

  writeRawManifest();
  for (const exportBundleChunkId of exportBundleChunkIds) {
    fs.copyFileSync(
      path.join(toZenProbeRawDir, "chunks", exportBundleChunkId),
      path.join(rawOutputDir, exportBundleChunkId)
    );
  }

  cleanFinalOutputs();
  run(tools.retoc, ["pack-raw", rawOutputRoot, `${buildBase}.utoc`]);
  writePakList();
  run(tools.unrealPak, [`${buildBase}.pak`, `-Create=${pakListPath}`]);
  cleanProbeOutputs();

  for (const ext of [".pak", ".ucas", ".utoc"]) {
    requireFile(`${buildBase}${ext}`);
  }

  console.log("");
  console.log("NoFriendlyFire rebuilt with BP_Player endpoint branch patches.");
  console.log(`Raw override chunks: ${exportBundleChunkIds.join(", ")}`);
  console.log(
    `Patched existing JumpIfNot target at data 0x${branchTargetDataOffset.toString(16)} ` +
      `from 0x${originalFriendlyFireScriptOffset.toString(16)} to 0x${noDamageScriptOffset.toString(16)}.`
  );
  console.log(
    `Patched existing player-causer comparison operand at data 0x${selfComparisonOperandDataOffset.toString(16)} ` +
      `from Self 0x${selfToken.toString(16)} to NoObject 0x${noObjectToken.toString(16)}.`
  );
  console.log(
    `Patched existing PlayerState-causer Jump target at data 0x${playerStateCastSuccessJumpTargetDataOffset.toString(16)} ` +
      `from 0x${originalFriendlyFireScriptOffset.toString(16)} to 0x${noDamageScriptOffset.toString(16)}.`
  );
  console.log(`Output: ${buildBase}.pak/.ucas/.utoc`);
}

main();
