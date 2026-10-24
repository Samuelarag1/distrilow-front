import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// public/ is served as is, and the service worker (public/sw.js) precaches
// the icons into every browser's storage. Each one used to be the same
// 1024x1024 image of 1.5 MB.
const PUBLIC_DIR = fileURLToPath(new URL("../public/", import.meta.url));
const MAX_PNG_BYTES = 100 * 1024;

const pngs = readdirSync(PUBLIC_DIR).filter((file) => file.endsWith(".png"));
const sizedIcons = pngs.filter((file) => /^icon-\d+x\d+\.png$/.test(file));

function pngDimensions(file: string) {
  // The IHDR chunk always starts at byte 16: width, then height.
  const header = readFileSync(PUBLIC_DIR + file).subarray(16, 24);
  return { width: header.readUInt32BE(0), height: header.readUInt32BE(4) };
}

describe("imágenes de public/", () => {
  it.each(pngs)("%s pesa 100 KB o menos", (file) => {
    expect(statSync(PUBLIC_DIR + file).size).toBeLessThanOrEqual(MAX_PNG_BYTES);
  });

  it.each(sizedIcons)("%s mide lo que dice su nombre", (file) => {
    const [, width, height] = file.match(/(\d+)x(\d+)/) ?? [];
    expect(pngDimensions(file)).toEqual({
      width: Number(width),
      height: Number(height),
    });
  });

  it("apple-touch-icon.png mide 180x180", () => {
    expect(pngDimensions("apple-touch-icon.png")).toEqual({
      width: 180,
      height: 180,
    });
  });
});
