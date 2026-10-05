import * as THREE from "three";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";
import { bakeGeometry } from "./model-geometry";
import { createInsetDisplayGeometry } from "./display-geometry";
import { updateMetal, updateDetailMaterial, updateLogo } from "./metal";
import type { PhoneModel } from "./phone-model";
export async function loadAirModel(
  display: THREE.MeshPhysicalMaterial,
): Promise<PhoneModel> {
  const [source, logoMask] = await Promise.all([
    new OBJLoader().loadAsync("/models/iphone-air/iPhone_Air.obj"),
    new THREE.TextureLoader().loadAsync(
      "/models/iphone-air/back_metalness.jpeg",
    ),
  ]);
  const logo = new THREE.MeshPhysicalMaterial({
    name: "Air_Logo",
    alphaMap: logoMask,
    transparent: true,
    alphaTest: 0.05,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  // The supplied mask is white backing / black logo. Use the original UVs,
  // invert its alpha only, and tint the logo independently of the back panel.
  logo.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <alphamap_fragment>",
      "#ifdef USE_ALPHAMAP\n diffuseColor.a *= 1.0 - texture2D(alphaMap, vAlphaMapUv).g;\n#endif",
    );
  };
  source.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(source),
    center = bounds.getCenter(new THREE.Vector3());
  const scale = 6.6 / bounds.getSize(new THREE.Vector3()).y;
  const normalization = new THREE.Matrix4()
    .makeScale(scale, scale, scale)
    .multiply(
      new THREE.Matrix4().makeTranslation(-center.x, -center.y, -center.z),
    );
  const group = new THREE.Group();
  group.name = "iPhone Air";
  const metals: THREE.MeshPhysicalMaterial[] = [];
  const backs: THREE.MeshPhysicalMaterial[] = [];
  const details: THREE.MeshPhysicalMaterial[] = [];
  source.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    const geometry = bakeGeometry(
      o.geometry,
      normalization.clone().multiply(o.matrixWorld),
    );
    const originals = Array.isArray(o.material) ? o.material : [o.material];
    const mats = originals.map((original) => {
      const name = original.name;
      if (name === "Glass_-_Heavy_Color") {
        geometry.computeBoundingBox();
        const b = geometry.boundingBox!;
        const screen = new THREE.Mesh(
          createInsetDisplayGeometry(geometry, 0.055),
          display,
        );
        screen.name = "Air_Display";
        group.add(screen);
        const island = roundedPlane(
          0.88,
          0.25,
          0.125,
          new THREE.MeshBasicMaterial({ color: "#030405" }),
        );
        island.position.set(0, b.max.y - 0.3, b.max.z + 0.005);
        group.add(island);
        const bezel = new THREE.MeshPhysicalMaterial({
          color: "#060708",
          roughness: 0.19,
          metalness: 0,
          envMapIntensity: 0.4,
        });
        details.push(bezel);
        return bezel;
      }
      const m = new THREE.MeshPhysicalMaterial({
        name,
        roughness: 0.3,
        metalness: 0,
      });
      if (name.startsWith("Steel") || name.startsWith("Aluminum"))
        metals.push(m);
      else if (name.startsWith("Plastic")) {
        backs.push(m);
        const logoMesh = new THREE.Mesh(geometry.clone(), logo);
        logoMesh.name = "Air_Logo";
        group.add(logoMesh);
      } else if (name === "Glass_-_Frosted_Light") {
        m.color.set("#e8e4dc");
        m.roughness = 0.5;
      } else {
        m.color.set("#070c11");
        m.roughness = 0.12;
        m.ior = 1.5;
        m.envMapIntensity = 0.5;
      }
      if (!metals.includes(m) && !backs.includes(m)) details.push(m);
      return m;
    });
    const mesh = new THREE.Mesh(
      geometry,
      Array.isArray(o.material) ? mats : mats[0],
    );
    mesh.name = o.name;
    group.add(mesh);
    o.geometry.dispose();
    originals.forEach((m) => m.dispose());
  });
  return {
    group,
    update(s) {
      metals.forEach((m) => updateMetal(m, s));
      backs.forEach((m) => updateMetal(m, s, true));
      details.forEach((m) => updateDetailMaterial(m, s, 0.5));
      updateLogo(logo, s);
    },
  };
}

function roundedPlane(
  w: number,
  h: number,
  r: number,
  material: THREE.Material,
) {
  const x = -w / 2,
    y = -h / 2,
    shape = new THREE.Shape();
  shape.moveTo(x + r, y);
  shape.lineTo(x + w - r, y);
  shape.quadraticCurveTo(x + w, y, x + w, y + r);
  shape.lineTo(x + w, y + h - r);
  shape.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  shape.lineTo(x + r, y + h);
  shape.quadraticCurveTo(x, y + h, x, y + h - r);
  shape.lineTo(x, y + r);
  shape.quadraticCurveTo(x, y, x + r, y);
  const g = new THREE.ShapeGeometry(shape, 24),
    p = g.attributes.position,
    uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    uv[i * 2] = (p.getX(i) + w / 2) / w;
    uv[i * 2 + 1] = (p.getY(i) + h / 2) / h;
  }
  g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  return new THREE.Mesh(g, material);
}
