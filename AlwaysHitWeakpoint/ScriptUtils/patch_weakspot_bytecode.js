const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname);
const mods = [
  {
    file: "BP_Enemy_35.json",
    exportName: "F_HitMarkerRequest",
    callIndexes: [0],
  },
  {
    file: "BP_PlayerBullet_35.json",
    exportName: "F_ApplyDamages",
    callIndexes: [1, 2],
  },
  {
    file: "BP_ArrowProjectile_35.json",
    exportName: "F_IsCritical",
    callIndexes: [0, 1],
  },
  {
    file: "BP_SheriffStarProjectile_35.json",
    exportName: "F_IsCritical",
    callIndexes: [0, 1],
  },
];

function findArrayContainsCalls(asset, exportData) {
  const importIndex = asset.Imports.findIndex((entry) => entry.ObjectName === "Array_Contains");
  if (importIndex < 0) {
    throw new Error("Array_Contains import not found");
  }

  const importRef = -(importIndex + 1);
  const pattern = Buffer.alloc(5);
  pattern[0] = 0x1c; // EX_FinalFunction
  pattern.writeInt32LE(importRef, 1);

  const calls = [];
  for (let pos = 0; pos <= exportData.length - pattern.length; pos += 1) {
    let matched = true;
    for (let i = 0; i < pattern.length; i += 1) {
      if (exportData[pos + i] !== pattern[i]) {
        matched = false;
        break;
      }
    }
    if (!matched) {
      continue;
    }

    const end = exportData.indexOf(0x16, pos + pattern.length); // EX_EndFunctionParms
    if (end < 0) {
      throw new Error(`Could not find end of Array_Contains call at 0x${pos.toString(16)}`);
    }
    calls.push({ start: pos, end });
  }
  return calls;
}

function patchCall(exportData, call) {
  exportData[call.start] = 0x27; // EX_True
  exportData.fill(0x0b, call.start + 1, call.end + 1); // EX_Nothing padding
}

fs.mkdirSync(path.join(root, "patched"), { recursive: true });

for (const mod of mods) {
  const input = path.join(root, mod.file);
  const output = path.join(root, "patched", mod.file);
  const asset = JSON.parse(fs.readFileSync(input, "utf8"));
  const exportEntry = asset.Exports.find((entry) => entry.ObjectName === mod.exportName);
  if (!exportEntry || typeof exportEntry.Data !== "string") {
    throw new Error(`${mod.file}: raw export ${mod.exportName} not found`);
  }

  const data = Buffer.from(exportEntry.Data, "base64");
  const calls = findArrayContainsCalls(asset, data);
  for (const index of mod.callIndexes) {
    if (!calls[index]) {
      throw new Error(`${mod.file}: Array_Contains call index ${index} not found`);
    }
    patchCall(data, calls[index]);
  }

  exportEntry.Data = data.toString("base64");
  fs.writeFileSync(output, JSON.stringify(asset, null, 2));

  const patched = mod.callIndexes.map((index) => calls[index])
    .map((call) => `0x${call.start.toString(16)}..0x${call.end.toString(16)}`)
    .join(", ");
  console.log(`${mod.file} ${mod.exportName}: patched ${patched}`);
}
