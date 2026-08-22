import { TIERS, TIER_UNLOCKS, tierForPoints } from "./scoring.js";

export const FELTS = Object.freeze({
  Wood: { a: "#20694e", b: "#134130", c: "#0a2a1f" },
  Stone: { a: "#1d5f6e", b: "#123742", c: "#0a232b" },
  Resin: { a: "#2f6b57", b: "#1b4b3c", c: "#123128" },
  Bamboo: { a: "#4d6b28", b: "#354b1c", c: "#233312" },
  Bone: { a: "#0f4a38", b: "#0a3428", c: "#072019" },
  Porcelain: { a: "#1f3f6e", b: "#142d50", c: "#0c1b30" },
  Rosewood: { a: "#5a3822", b: "#422819", c: "#2a1a0f" },
  Jade: { a: "#1f6b4e", b: "#15503a", c: "#0c2b1f" },
  "Cloisonné": { a: "#173a5c", b: "#102943", c: "#081a2b" },
  Lacquer: { a: "#241a17", b: "#17100e", c: "#0a0706" },
});

export function equippedFeltName(points, equipped) {
  const stored = equipped && equipped.felt;
  if (stored && FELTS[stored] && points >= TIER_UNLOCKS[stored].feltThreshold) return stored;
  return tierForPoints(points).name;
}

export function feltCssVars(name) {
  const felt = FELTS[name] || FELTS[TIERS[0].name];
  return `--felt-a:${felt.a};--felt-b:${felt.b};--felt-c:${felt.c};`;
}
