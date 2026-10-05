import * as THREE from "three";
import type { Settings } from "./types";
export function materialMode(s: Settings) {
  const mode = s.material ?? (s.style === "minimal" ? "clay" : "realistic");
  return s.style === "minimal" && mode === "realistic" ? "clay" : mode;
}

function stylize(m: THREE.MeshStandardMaterial, s: Settings) {
  const mode = materialMode(s);
  const toneMapped = mode !== "glow";
  if (m.toneMapped !== toneMapped) {
    m.toneMapped = toneMapped;
    m.needsUpdate = true;
  }
  m.emissive.set(0);
  m.emissiveIntensity = 1;
  if (mode === "realistic") return false;
  m.metalness = 0;
  m.roughness = 0.8;
  m.envMapIntensity = mode === "clay" ? 0.4 : 0;
  if (m instanceof THREE.MeshPhysicalMaterial) {
    m.specularIntensity = mode === "clay" ? 0.15 : 0;
    m.clearcoat = 0;
    m.anisotropy = 0;
  }
  if (mode === "glow") {
    // Preserve the chosen sRGB color without filmic desaturation. A small
    // diffuse component keeps the silhouette legible while flattening lighting.
    m.emissive.copy(m.color).multiplyScalar(0.88);
    m.color.multiplyScalar(0.12);
  }
  return true;
}

const detailDefaults = new WeakMap<
  THREE.MeshStandardMaterial,
  {
    color: THREE.Color;
    roughness: number;
    metalness: number;
  }
>();
export function updateDetailMaterial(
  m: THREE.MeshStandardMaterial,
  s: Settings,
  environment = 0.8,
) {
  let original = detailDefaults.get(m);
  if (!original) {
    original = {
      color: m.color.clone(),
      roughness: m.roughness,
      metalness: m.metalness,
    };
    detailDefaults.set(m, original);
  }
  m.color.copy(original.color);
  if (stylize(m, s)) return;
  m.metalness = original.metalness;
  m.roughness = original.roughness;
  m.envMapIntensity = (s.bodyReflection / 100) * environment;
  if (m instanceof THREE.MeshPhysicalMaterial)
    m.specularIntensity = s.bodyReflection / 100;
}
export function updateMetal(
  m: THREE.MeshPhysicalMaterial,
  s: Settings,
  back = false,
) {
  m.color.set(s.frame);
  if (stylize(m, s)) return;
  const strength = s.bodyReflection / 100;
  // Conductors retain their metalness as lighting changes. Glass back panels remain dielectric.
  m.metalness = back ? 0 : 1;
  const base = Math.max(0.1, Math.min(0.85, s.metalRoughness / 100));
  m.roughness = back ? 0.38 : Math.min(0.95, base + (1 - strength) * 0.2);
  // Keep a lit environment floor when reducing highlights. Turning a conductor's
  // entire environment off made it black regardless of the selected body color.
  m.envMapIntensity = back ? 0.65 : 0.75 + strength * 0.55;
  m.specularIntensity = back ? strength * 0.6 : 1;
  m.clearcoat = back ? 0.15 * strength : 0;
  m.clearcoatRoughness = 0.3;
  // The imported models contain UV seams / collapsed UVs, and 17 has no tangent
  // attribute. Screen-space tangent reconstruction caused speckle and triangle seams.
  m.anisotropy = 0;
}

export function updateLogo(m: THREE.MeshPhysicalMaterial, s: Settings) {
  m.color.set(s.frame);
  const luminance =
    m.color.r * 0.2126 + m.color.g * 0.7152 + m.color.b * 0.0722;
  if (luminance > 0.32) m.color.multiplyScalar(0.55);
  else m.color.lerp(new THREE.Color("#ffffff"), 0.24);
  if (stylize(m, s)) return;
  m.metalness = 0.35;
  m.roughness = 0.32;
  m.envMapIntensity = 0.65 + s.bodyReflection / 200;
  m.specularIntensity = 0.35;
  m.clearcoat = 0;
  m.anisotropy = 0;
}

/** Antenna separators and the side insert are dielectric parts, not bare metal.
 * Give them a subtle body-relative tint instead of the source black atlas. */
export function updateInlay(
  m: THREE.MeshPhysicalMaterial,
  s: Settings,
  cover = false,
) {
  m.color.set(s.frame).lerp(new THREE.Color("#777f87"), 0.22);
  const custom = stylize(m, s);
  m.metalness = 0;
  if (!custom) m.roughness = cover ? 0.3 : 0.58;
  m.anisotropy = 0;
  m.clearcoat = 0;
  if (!custom) {
    m.envMapIntensity = 0.5;
    m.specularIntensity = 0.25 + (0.25 * s.bodyReflection) / 100;
  }
  // Preserve the original transparent cover over the solid insert, rather than
  // turning two overlapping surfaces into competing opaque depth writes.
  m.transparent = cover;
  m.opacity = cover ? 0.3 : 1;
  m.depthWrite = !cover;
}
