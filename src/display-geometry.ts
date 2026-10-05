import * as THREE from "three";

/** Measured front-glass outline. The OBJ's flat face contains interior vertices
 * too, so take its convex boundary rather than approximating it with a radius. */
export function frontGlassContour(source: THREE.BufferGeometry) {
  source.computeBoundingBox();
  const z = source.boundingBox!.max.z;
  const position = source.attributes.position;
  const unique = new Map<string, THREE.Vector2>();
  for (let i = 0; i < position.count; i++) {
    if (Math.abs(position.getZ(i) - z) > 1e-5) continue;
    const p = new THREE.Vector2(position.getX(i), position.getY(i));
    unique.set(`${Math.round(p.x * 1e6)},${Math.round(p.y * 1e6)}`, p);
  }
  const points = [...unique.values()].sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (a: THREE.Vector2, b: THREE.Vector2, c: THREE.Vector2) =>
    (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  const half = (list: THREE.Vector2[]) => {
    const result: THREE.Vector2[] = [];
    for (const p of list) {
      while (
        result.length >= 2 &&
        cross(result[result.length - 2], result[result.length - 1], p) <= 1e-9
      )
        result.pop();
      result.push(p);
    }
    return result.slice(0, -1);
  };
  const contour = [...half(points), ...half([...points].reverse())];
  if (contour.length < 3) throw new Error("Air 模型缺少有效的屏幕轮廓。");
  return { contour, z };
}

export function createInsetDisplayGeometry(
  source: THREE.BufferGeometry,
  inset: number,
) {
  const { contour, z } = frontGlassContour(source);
  // Offset adjacent boundary lines inward by the same distance. Unlike scaling
  // a rounded rectangle, this retains a consistent bezel around all four corners.
  const inside = contour.map((p, i) => {
    const previous = contour[(i + contour.length - 1) % contour.length],
      next = contour[(i + 1) % contour.length];
    const a = p.clone().sub(previous).normalize(),
      b = next.clone().sub(p).normalize();
    const n1 = new THREE.Vector2(-a.y, a.x),
      n2 = new THREE.Vector2(-b.y, b.x);
    return p.clone().add(
      n1
        .clone()
        .add(n2)
        .multiplyScalar(inset / (1 + n1.dot(n2))),
    );
  });
  const geometry = new THREE.ShapeGeometry(new THREE.Shape(inside));
  geometry.computeBoundingBox();
  const bounds = geometry.boundingBox!;
  const position = geometry.attributes.position,
    uv = new Float32Array(position.count * 2);
  for (let i = 0; i < position.count; i++) {
    uv[i * 2] =
      (position.getX(i) - bounds.min.x) / (bounds.max.x - bounds.min.x);
    uv[i * 2 + 1] =
      (position.getY(i) - bounds.min.y) / (bounds.max.y - bounds.min.y);
    position.setZ(i, z + 0.001);
  }
  geometry.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}
