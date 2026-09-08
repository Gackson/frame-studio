import { devices, type DeviceId } from "./devices";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { bakeGeometry } from "./model-geometry";
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
  const island: THREE.Mesh[] = [];
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
      oZRkkORNzkufnGD: "color2",
      yhcAXNGcJWCqtIS: "color2",
      PaletteMaterial002: "color3",
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
    let material: THREE.Material;
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
      // These small meshes used to receive their own bright specular light even at 0%.
      // Keep the opaque cutout truly black; only the display carries studio reflections.
      material = new THREE.MeshBasicMaterial({
        color: kind === "2112" ? "#030405" : "#081014",
        toneMapped: false,
      });
    } else {
      const m = source.clone();
      // Keep only textures actually used on non-screen geometry. Clone ownership is
      // explicit so loading/unmounting does not leak GPU resources.
      for (const key of [
        "map",
        "roughnessMap",
        "metalnessMap",
        "normalMap",
        "alphaMap",
        "aoMap",
      ] as const) {
        if (m[key]) m[key] = m[key]!.clone();
      }
      if (["color", "color2", "color3"].includes(kind)) {
        m.metalness = kind === "color2" ? 0.05 : 0.75;
        m.roughness = kind === "color2" ? 0.5 : 0.32;
      } else if (kind === "Black2") {
        m.color.set("#0a0c0d");
        m.metalness = 0;
        m.roughness = 0.55;
      } else if (kind === "2112") {
        m.color.set("#030405");
        m.metalness = 0;
        m.roughness = 0.7;
      } else if (kind === "Lens" || kind === "Lens2") {
        m.color.set(kind === "Lens" ? "#102634" : "#0c1720");
        m.metalness = 0.18;
        m.roughness = 0.16;
      }
      m.envMapIntensity =
        kind === "2112" ? 0.04 : kind === "Black2" ? 0.25 : 0.8;
      finishes.push({ material: m, kind });
      material = m;
    }
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = source.name;
    if (kind === "2112" || kind === "Lens2") island.push(mesh);
    group.add(mesh);
  });
  originalGeometries.forEach((g) => g.dispose());
  originalTextures.forEach((t) => t.dispose());
  originalMaterials.forEach((m) => m.dispose());
  if (!screenFound) throw new Error("模型缺少屏幕网格，无法贴入截图。");
  return {
    group,
    update(settings) {
      const photo = settings.style === "photo";
      finishes.forEach(({ material, kind }) => {
        if (["color", "color2", "color3"].includes(kind)) {
          material.color.set(settings.frame);
          if (kind === "color2") material.color.multiplyScalar(0.88);
          material.metalness = photo && kind !== "color2" ? 0.75 : 0.05;
          material.roughness = photo ? (kind === "color2" ? 0.5 : 0.32) : 0.8;
        }
        material.envMapIntensity = photo
          ? kind === "Black2"
            ? 0.25
            : 0.8
          : 0.25;
      });
      island.forEach((mesh) => {
        mesh.visible = settings.island;
      });
    },
  };
}
