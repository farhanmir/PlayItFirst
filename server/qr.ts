/**
 * QR helpers adapted from Gitzilla's server/qr.ts pattern (vendored qrcode encoder).
 * Generates SVG join codes for phone multiplayer without external network calls.
 */
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

interface QR {
  addData(data: string, mode: "Byte"): void;
  make(): void;
  getModuleCount(): number;
  isDark(row: number, column: number): boolean;
}

const qrcode = require("./vendor/qrcode.cjs") as (version: number, correction: "M") => QR;

function encode(text: string): QR {
  const qr = qrcode(0, "M");
  qr.addData(Buffer.from(text, "utf8").toString("latin1"), "Byte");
  qr.make();
  return qr;
}

export function qrSvg(text: string): string {
  const qr = encode(text);
  const count = qr.getModuleCount();
  const size = count + 8;
  const cells: string[] = [];
  for (let row = 0; row < count; row++) {
    for (let col = 0; col < count; col++) {
      if (qr.isDark(row, col)) cells.push(`M${col + 4},${row + 4}h1v1h-1z`);
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size * 6}" height="${size * 6}" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges"><rect width="${size}" height="${size}" fill="#fff"/><path d="${cells.join("")}" fill="#1a120c"/></svg>`;
}
