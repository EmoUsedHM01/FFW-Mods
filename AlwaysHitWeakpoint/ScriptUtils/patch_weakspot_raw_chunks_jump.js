const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const inputDir = path.join(root, "RawChunks", "original");
const outputDir = path.join(root, "RawChunks", "patched_jump");

const patches = [
  {
    id: "f566afc6572a67ca00000001",
    name: "BP_Enemy.F_HitMarkerRequest",
    scriptStart: 0x1f159,
    ranges: [[0x1f28c, 0x1f2b3]],
  },
  {
    id: "2ee165222bd1131e00000001",
    name: "BP_PlayerBullet.F_ApplyDamages",
    scriptStart: 0x99c2,
    ranges: [[0xb154, 0xb1a1], [0xb5e8, 0xb635]],
  },
  {
    id: "c888831310d62c0a00000001",
    name: "BP_ArrowProjectile.F_IsCritical",
    scriptStart: 0x7987,
    ranges: [[0x81c3, 0x8210], [0x83f7, 0x8444]],
  },
  {
    id: "5b24f4b5fe8312c300000001",
    name: "BP_SheriffStarProjectile.F_IsCritical",
    scriptStart: 0xa35a,
    ranges: [[0xabcb, 0xac18], [0xaf83, 0xafd0]],
  },
];

fs.rmSync(outputDir, { recursive: true, force: true });
fs.mkdirSync(outputDir, { recursive: true });

for (const patch of patches) {
  const input = path.join(inputDir, patch.id);
  const output = path.join(outputDir, patch.id);
  const data = fs.readFileSync(input);

  for (const [start, end] of patch.ranges) {
    if (data[start] !== 0x1c || data[end] !== 0x16) {
      throw new Error(`${patch.name}: unexpected opcode range 0x${start.toString(16)}..0x${end.toString(16)}`);
    }

    const jumpTarget = end + 1 - patch.scriptStart;
    if (jumpTarget < 0) {
      throw new Error(`${patch.name}: invalid jump target for 0x${start.toString(16)}`);
    }

    data[start] = 0x27; // EX_True, used by the original expression site.
    data[start + 1] = 0x06; // EX_Jump, executed immediately after the expression to skip padding.
    data.writeInt32LE(jumpTarget, start + 2);
    data.fill(0x0b, start + 6, end + 1); // EX_Nothing padding.
  }

  fs.writeFileSync(output, data);
  console.log(`${patch.name}: patched ${patch.ranges.map(([s, e]) => `0x${s.toString(16)}..0x${e.toString(16)}`).join(", ")}`);
}
