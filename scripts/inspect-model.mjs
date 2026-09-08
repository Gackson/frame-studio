import fs from "node:fs";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { Box3, Vector3, Matrix4 } from "three";
import assert from "node:assert/strict";
import { bakeGeometry } from "../src/model-geometry.ts";
const file = fs.readFileSync("public/models/iphone-17-pro-max.glb");
const len = file.readUInt32LE(12),
  json = JSON.parse(file.subarray(20, 20 + len));
json.materials = json.materials.map((m) => ({ name: m.name }));
delete json.textures;
delete json.images;
const j = Buffer.from(JSON.stringify(json)),
  pad = Buffer.alloc((4 - (j.length % 4)) % 4, 32),
  bin = file.subarray(20 + len);
const out = Buffer.alloc(20 + j.length + pad.length + bin.length);
file.copy(out, 0, 0, 12);
out.writeUInt32LE(out.length, 8);
out.writeUInt32LE(j.length + pad.length, 12);
out.writeUInt32LE(0x4e4f534a, 16);
j.copy(out, 20);
pad.copy(out, 20 + j.length);
bin.copy(out, 20 + j.length + pad.length);
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const gltf = await loader.parseAsync(
  out.buffer.slice(out.byteOffset, out.byteOffset + out.length),
  "",
);
gltf.scene.rotation.y = Math.PI;
gltf.scene.updateMatrixWorld(true);
const bounds = new Box3().setFromObject(gltf.scene);
console.log("bounds", bounds.min.toArray(), bounds.max.toArray());
gltf.scene.traverse((o) => {
  if (o.isMesh) {
    const b = new Box3().setFromObject(o);
    console.log(
      o.material.name,
      o.geometry.attributes.position.count,
      b.min.toArray().map((v) => v.toFixed(5)),
      b.max.toArray().map((v) => v.toFixed(5)),
    );
  }
});

const center = bounds.getCenter(new Vector3());
const normalization = new Matrix4()
  .makeScale(
    6.9 / bounds.getSize(new Vector3()).y,
    6.9 / bounds.getSize(new Vector3()).y,
    6.9 / bounds.getSize(new Vector3()).y,
  )
  .multiply(new Matrix4().makeTranslation(-center.x, -center.y, -center.z));
const bakedBounds = new Box3();
let screen,
  triangles = 0;
gltf.scene.traverse((o) => {
  if (!o.isMesh) return;
  const g = bakeGeometry(
    o.geometry,
    normalization.clone().multiply(o.matrixWorld),
  );
  g.computeBoundingBox();
  bakedBounds.union(g.boundingBox);
  triangles += (g.index?.count ?? g.attributes.position.count) / 3;
  for (const v of g.attributes.position.array) assert(Number.isFinite(v));
  if (o.material.name === "17ProMax_Screen") screen = g.boundingBox.clone();
});
assert(
  Math.abs(bakedBounds.getSize(new Vector3()).y - 6.9) < 0.00001,
  "Normalized handset height must remain 6.9",
);
assert(screen, "Screen must exist");
assert(screen.min.z > 0, "Display must face the camera");
const ratio = screen.getSize(new Vector3()).x / screen.getSize(new Vector3()).y;
assert(
  Math.abs(ratio - 1320 / 2868) < 0.01,
  "Display aspect ratio must match iPhone 17 Pro Max",
);
assert(triangles > 25000, "High-detail mesh must be preserved");
console.log(
  `PASS: ${Math.round(triangles)} triangles; geometry finite; normalized height 6.9; screen orientation and aspect correct.`,
);
