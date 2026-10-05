import { test } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import {
  updateMetal,
  updateInlay,
  updateDetailMaterial,
  updateLogo,
} from "../src/metal.ts";
import { separateCameraPlate } from "../src/model-geometry.ts";
const settings = {
  style: "photo",
  frame: "#b7d2e6",
  bodyReflection: 60,
  metalRoughness: 34,
  metalFinish: "aluminum",
};
test("Clay and Glow are nonmetallic in either projection and restore the native finish", () => {
  const m = new THREE.MeshPhysicalMaterial();
  for (const style of ["photo", "minimal"]) {
    updateMetal(m, { ...settings, style, material: "clay" });
    assert.equal(m.metalness, 0);
    assert.equal(m.emissive.getHex(), 0);
    assert.equal(m.toneMapped, true);
    updateMetal(m, { ...settings, style, material: "glow" });
    assert.equal(m.metalness, 0);
    assert.equal(m.envMapIntensity, 0);
    assert.equal(m.specularIntensity, 0);
    assert.equal(m.toneMapped, false);
    assert(
      Math.hypot(
        ...m.color
          .clone()
          .add(m.emissive)
          .toArray()
          .map((v, i) => v - new THREE.Color(settings.frame).toArray()[i]),
      ) < 1e-6,
    );
  }
  updateMetal(m, { ...settings, material: "realistic" });
  assert.equal(m.metalness, 1);
  assert.equal(m.emissive.getHex(), 0);
  assert.equal(m.color.getHexString(), "b7d2e6");
  assert.equal(m.toneMapped, true);
  updateMetal(m, { ...settings, style: "minimal", material: "realistic" });
  assert.equal(m.metalness, 0);
  m.dispose();
});
test("repeated Glow updates do not darken detail colors or lose native material properties", () => {
  const m = new THREE.MeshPhysicalMaterial({
    color: "#124487",
    metalness: 0.3,
    roughness: 0.24,
  });
  const original = m.color.clone();
  for (let i = 0; i < 20; i++)
    updateDetailMaterial(m, { ...settings, material: "glow" });
  assert(
    Math.hypot(
      ...m.color
        .clone()
        .add(m.emissive)
        .toArray()
        .map((v, i) => v - original.toArray()[i]),
    ) < 1e-6,
  );
  updateDetailMaterial(m, { ...settings, material: "clay" });
  assert.equal(m.metalness, 0);
  updateDetailMaterial(m, { ...settings, material: "realistic" });
  assert.equal(m.metalness, 0.3);
  assert.equal(m.roughness, 0.24);
  assert.equal(m.color.getHexString(), "124487");
  assert.equal(m.emissive.getHex(), 0);
  m.dispose();
});
test("metal retains its color and illumination at minimum highlight strength", () => {
  const m = new THREE.MeshPhysicalMaterial();
  updateMetal(m, { ...settings, bodyReflection: 0 });
  assert.equal(m.color.getHexString(), "b7d2e6");
  assert.equal(m.metalness, 1);
  assert(m.envMapIntensity > 0);
  const rough = m.roughness,
    intensity = m.envMapIntensity;
  updateMetal(m, { ...settings, bodyReflection: 100 });
  assert(m.roughness < rough);
  assert(m.envMapIntensity > intensity);
  assert.equal(m.anisotropy, 0);
  updateMetal(m, { ...settings, metalRoughness: 80 });
  assert(m.roughness >= 0.8);
  updateMetal(m, settings, true);
  assert.equal(m.metalness, 0);
  m.dispose();
});
test("camera plate grouping preserves lens and logo triangles and all geometry", () => {
  const g = new THREE.BufferGeometry();
  g.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(
      [
        0, 1.5, -0.17, 1.5, 1.5, -0.17, 1.5, 3, -0.17, 0, 3, -0.17, 0.2, 2,
        -0.26, 0.7, 2, -0.26, 0.5, 2.5, -0.26, 0, 0, -0.09, 0.3, 0, -0.09, 0.2,
        0.4, -0.09,
      ],
      3,
    ),
  );
  g.setIndex([0, 1, 2, 0, 2, 3, 4, 5, 6, 7, 8, 9]);
  const positions = Array.from(g.attributes.position.array);
  assert(separateCameraPlate(g));
  assert.equal(g.index.count, 12);
  assert.deepEqual(Array.from(g.attributes.position.array), positions);
  assert.deepEqual(g.groups, [
    { start: 0, count: 6, materialIndex: 0 },
    { start: 6, count: 6, materialIndex: 1 },
  ]);
  assert.deepEqual(Array.from(g.index.array).slice(0, 6), [4, 5, 6, 7, 8, 9]);
  g.dispose();
});

test("antenna and insert materials retain body-relative color with a transparent cover", () => {
  const m = new THREE.MeshPhysicalMaterial();
  for (const frame of ["#e7e8e4", "#b7d2e6", "#454946"]) {
    updateInlay(m, { ...settings, frame });
    assert(m.color.r > 0 && m.color.g > 0 && m.color.b > 0);
    assert.equal(m.metalness, 0);
    assert.equal(m.transparent, false);
    assert.equal(m.depthWrite, true);
  }
  updateInlay(m, settings, true);
  assert.equal(m.transparent, true);
  assert.equal(m.depthWrite, false);
  assert(m.opacity > 0 && m.opacity < 1);
  m.dispose();
});

test("logo follows the body palette and stays visible in light and dark finishes", () => {
  const m = new THREE.MeshPhysicalMaterial();
  for (const material of ["realistic", "clay", "glow"]) {
    const colors = [];
    for (const frame of ["#ffffff", "#111111", "#3478f6", "#e74030"]) {
      updateLogo(m, { ...settings, material, frame });
      const color =
        material === "glow" ? m.color.clone().add(m.emissive) : m.color;
      assert.notEqual(
        color.getHexString(),
        new THREE.Color(frame).getHexString(),
      );
      colors.push(color.getHexString());
    }
    assert.equal(new Set(colors).size, 4);
  }
  m.dispose();
});
