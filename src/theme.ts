import type { CSSProperties } from "react";
/** Derive a restrained UI palette; the artwork's brightness never affects text contrast. */
export function workspaceTheme(hex: string): CSSProperties {
  const values = hex
    .replace("#", "")
    .match(/.{2}/g)
    ?.map((v) => parseInt(v, 16) / 255) ?? [0.5, 0.5, 0.5];
  const [r, g, b] = values.map((v) =>
    v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4,
  );
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const labB = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  const h = ((Math.atan2(labB, a) * 180) / Math.PI + 360) % 360;
  const chroma = Math.min(0.045, Math.hypot(a, labB));
  return {
    "--accent": `oklch(39% ${chroma} ${h})`,
    "--soft": `oklch(94% ${chroma * 0.4} ${h})`,
    "--surface": `oklch(99% .004 ${h})`,
    "--line": `oklch(90% .011 ${h})`,
    "--muted": `oklch(51% .02 ${h})`,
    "--subtle": `oklch(59% .015 ${h})`,
    "--workspace": `oklch(96% .009 ${h})`,
    "--ink": `oklch(28% .017 ${h})`,
  } as CSSProperties;
}
export function imageTheme(image: HTMLImageElement): string {
  const canvas = document.createElement("canvas");
  canvas.width = 24;
  canvas.height = 24;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(image, 0, 0, 24, 24);
  const data = ctx.getImageData(0, 0, 24, 24).data;
  let r = 0,
    g = 0,
    b = 0,
    n = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue;
    r += data[i];
    g += data[i + 1];
    b += data[i + 2];
    n++;
  }
  return (
    "#" +
    [r, g, b]
      .map((c) =>
        Math.round(c / Math.max(n, 1))
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
}
