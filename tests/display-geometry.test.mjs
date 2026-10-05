import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as THREE from "three";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";
import { bakeGeometry } from "../src/model-geometry.ts";
import {
  frontGlassContour,
  createInsetDisplayGeometry,
} from "../src/display-geometry.ts";
test("Air display follows the original glass with a uniform, contained bezel and upright UVs", () => {
  const model = new OBJLoader().parse(
    fs.readFileSync(
      new URL("../public/models/iphone-air/iPhone_Air.obj", import.meta.url),
      "utf8",
    ),
  );
  model.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(model),
    center = bounds.getCenter(new THREE.Vector3()),
    scale = 6.6 / bounds.getSize(new THREE.Vector3()).y;
  let glass;
  model.traverse((o) => {
    if (o.isMesh && o.material.name === "Glass_-_Heavy_Color")
      glass = o.geometry;
  });
  assert(glass);
  const source = bakeGeometry(
    glass,
    new THREE.Matrix4()
      .makeScale(scale, scale, scale)
      .multiply(
        new THREE.Matrix4().makeTranslation(-center.x, -center.y, -center.z),
      ),
  );
  const { contour, z } = frontGlassContour(source),
    display = createInsetDisplayGeometry(source, 0.055),
    p = display.attributes.position,
    uv = display.attributes.uv;
  assert(contour.length > 20, "retain measured corner detail");
  assert(p.count >= contour.length);
  for (let i = 0; i < p.count; i++) {
    const point = new THREE.Vector2(p.getX(i), p.getY(i));
    let nearest = Infinity;
    for (let j = 0; j < contour.length; j++) {
      const a = contour[j],
        b = contour[(j + 1) % contour.length],
        edge = b.clone().sub(a),
        q = point.clone().sub(a);
      const distance = (edge.x * q.y - edge.y * q.x) / edge.length();
      assert(distance >= 0.055 - 1e-5, "screen stays inside every bezel edge");
      nearest = Math.min(nearest, distance);
    }
    assert(
      Math.abs(nearest - 0.055) < 1e-5,
      "same inset on straight edges and corners",
    );
    assert(Math.abs(p.getZ(i) - (z + 0.001)) < 1e-6);
    assert(
      uv.getX(i) >= -1e-6 &&
        uv.getX(i) <= 1 + 1e-6 &&
        uv.getY(i) >= -1e-6 &&
        uv.getY(i) <= 1 + 1e-6,
    );
  }
  const top = Array.from({ length: p.count }, (_, i) => i).sort(
    (a, b) => p.getY(b) - p.getY(a),
  )[0];
  assert(Math.abs(uv.getY(top) - 1) < 1e-6);
  source.dispose();
  display.dispose();
  model.traverse((o) => {
    if (o.isMesh) {
      o.geometry.dispose();
      (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) =>
        m.dispose(),
      );
    }
  });
});
