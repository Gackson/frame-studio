import { loadAirModel } from "./air-model";
import {
  updateMetal,
  updateInlay,
  updateDetailMaterial,
  updateLogo,
} from "./metal";
import { devices, type DeviceId } from "./devices";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { bakeGeometry, separateCameraPlate } from "./model-geometry";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import type { Settings } from "./types";

export const PHONE_NAME = "iPhone 17 Pro Max";
export const SCREEN_WIDTH = 1320;
export const SCREEN_HEIGHT = 2868;

export interface PhoneModel {
  group: THREE.Group;
  update(settings: Settings): void;
}

/** Taufiq K's CC BY 4.0 mesh, normalized once into our camera's coordinate system.
 * See public/models/ATTRIBUTION.md for upstream and derivative provenance. */
export async function loadPhoneModel(
  display: THREE.MeshPhysicalMaterial,
  device: DeviceId = "17-pro-max",
): Promise<PhoneModel> {
  if (device === "iphone-air") return loadAirModel(display);
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const config = devices[device];
  const draco = new DRACOLoader().setDecoderPath("/draco/");
  loader.setDRACOLoader(draco);
  const gltf = await loader
    .loadAsync(config.file)
    .finally(() => draco.dispose());
  gltf.scene.rotation.y = Math.PI;
  gltf.scene.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(gltf.scene);
  const center = bounds.getCenter(new THREE.Vector3());
  const scale = config.height / bounds.getSize(new THREE.Vector3()).y;
  const normalization = new THREE.Matrix4()
    .makeScale(scale * config.widthScale, scale, scale * config.depthScale)
    .multiply(
      new THREE.Matrix4().makeTranslation(-center.x, -center.y, -center.z),
    );
  const group = new THREE.Group();
  group.name = config.name;
  const finishes: { material: THREE.MeshStandardMaterial; kind: string }[] = [];

  const originalMaterials = new Set<THREE.Material>();
  const originalTextures = new Set<THREE.Texture>();
  const originalGeometries = new Set<THREE.BufferGeometry>();
  let screenFound = false;

  gltf.scene.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    const source = object.material as THREE.MeshStandardMaterial;
    originalMaterials.add(source);
    Object.values(source).forEach((value) => {
      if (value instanceof THREE.Texture) originalTextures.add(value);
    });
    originalGeometries.add(object.geometry);
    const geometry = bakeGeometry(
      object.geometry,
      normalization.clone().multiply(object.matrixWorld),
    );
    const aliases: Record<string, string> = {
      pIJKfZsazmcpEiU: "Screen",
      ujsvqBWRMnqdwPx: "2112",
      sxNzrmuTqVeaXdg: "Lens2",
      zFdeDaGNRwzccye: "Black2",
      dxCVrUCvYhjVxqy: "color",
      eShKpuMNVJTRrgg: "color", // Outer titanium frame, originally black in its base-color map.
      PpwUTnTFZJXxCoE: "color", // Camera rings share that same baked black map.
      oZRkkORNzkufnGD: "color2",
      yhcAXNGcJWCqtIS: "color2",
      PaletteMaterial002: "inlay", // Antenna separators use their own palette material.
      xdyiJLYTYRfJffH: "inlay", // Solid side insert.
      jpGaQNgTtEGkTfo: "inlayCover", // Transparent surface over that insert.
    };
    const kind =
      device === "15-pro-max"
        ? (aliases[source.name] ?? source.name)
        : source.name.replace("17ProMax_", "");

    // Remove the imported cover glass. The OLED surface below supplies the calibrated
    // dielectric reflection, avoiding two competing reflective planes and transmission artifacts.
    if (kind === "glass") {
      geometry.dispose();
      return;
    }
    let material: THREE.Material | THREE.Material[];
    if (kind === "Screen") {
      screenFound = true;
      geometry.computeBoundingBox();
      const b = geometry.boundingBox!;
      const positions = geometry.attributes.position;
      const uv = new Float32Array(positions.count * 2);
      for (let i = 0; i < positions.count; i++) {
        uv[2 * i] = (positions.getX(i) - b.min.x) / (b.max.x - b.min.x);
        uv[2 * i + 1] = (positions.getY(i) - b.min.y) / (b.max.y - b.min.y);
      }
      geometry.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
      material = display;
    } else if (kind === "2112" || kind === "Lens2") {
      // These original meshes close the island and camera openings in the bezel.
      // Keep their depth-tested opaque coverage, without reflective glass or textures.
      material = new THREE.MeshBasicMaterial({
        color: kind === "Lens2" ? "#080b10" : "#030405",
        side: THREE.DoubleSide,
        toneMapped: false,
      });
    } else {
      // Standard materials have an unadjustable dielectric highlight. Promote them
      // to Physical so the reflection control also governs direct-light specular.
      const m =
        source instanceof THREE.MeshPhysicalMaterial
          ? source.clone()
          : new THREE.MeshPhysicalMaterial();
      if (!(source instanceof THREE.MeshPhysicalMaterial)) {
        THREE.MeshStandardMaterial.prototype.copy.call(m, source);
        m.defines = { STANDARD: "", PHYSICAL: "" };
      }
      // Keep only textures actually used on non-screen geometry. Clone ownership is
      // explicit so loading/unmounting does not leak GPU resources.
      const calibratedSurface =
        device === "15-pro-max" &&
        [
          "eShKpuMNVJTRrgg",
          "PpwUTnTFZJXxCoE",
          "dxCVrUCvYhjVxqy",
          "PaletteMaterial002",
          "xdyiJLYTYRfJffH",
          "jpGaQNgTtEGkTfo",
        ].includes(source.name);
      for (const key of [
        "map",
        "roughnessMap",
        "metalnessMap",
        "normalMap",
        "alphaMap",
        "aoMap",
      ] as const) {
        if (calibratedSurface) m[key] = null;
        else if (m[key]) m[key] = m[key]!.clone();
      }
      if (["color", "color2", "color3"].includes(kind)) {
        m.metalness = kind === "color2" ? 0.05 : 0.75;
        m.roughness = kind === "color2" ? 0.5 : 0.32;
      } else if (kind === "Black2") {
        m.color.set("#0a0c0d");
        m.metalness = 0;
        m.roughness = 0.55;
      } else if (kind === "Lens") {
        m.color.set("#102634");
        m.metalness = 0.18;
        m.roughness = 0.16;
      }
      m.envMapIntensity = kind === "Black2" ? 0.25 : 0.8;
      finishes.push({ material: m, kind });
      material = m;
      if (
        device === "15-pro-max" &&
        source.name === "PaletteMaterial003" &&
        separateCameraPlate(geometry, true)
      ) {
        const plate = new THREE.MeshPhysicalMaterial({
          name: "15ProMax_CameraPlate",
          roughness: 0.38,
          metalness: 0,
        });
        finishes.push({ material: plate, kind: "color2" });
        const logo = new THREE.MeshPhysicalMaterial({ name: "15ProMax_Logo" });
        finishes.push({ material: logo, kind: "Logo" });
        material = [m, plate, logo];
      }
    }
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = source.name;

    group.add(mesh);
  });
  originalGeometries.forEach((g) => g.dispose());
  originalTextures.forEach((t) => t.dispose());
  originalMaterials.forEach((m) => m.dispose());
  if (!screenFound) throw new Error("模型缺少屏幕网格，无法贴入截图。");
  return {
    group,
    update(settings) {
      finishes.forEach(({ material, kind }) => {
        if (["color", "color2", "color3"].includes(kind)) {
          updateMetal(
            material as THREE.MeshPhysicalMaterial,
            settings,
            kind === "color2",
          );
        } else if (kind === "Logo") {
          updateLogo(material as THREE.MeshPhysicalMaterial, settings);
        } else if (kind === "inlay" || kind === "inlayCover") {
          updateInlay(
            material as THREE.MeshPhysicalMaterial,
            settings,
            kind === "inlayCover",
          );
        } else {
          updateDetailMaterial(
            material,
            settings,
            kind === "Black2" ? 0.12 : 0.8,
          );
        }
      });
    },
  };
}
