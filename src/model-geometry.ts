import * as THREE from "three";

/** Expand meshopt's normalized integer coordinates before applying a world transform.
 * Integer-backed attributes would silently clip/truncate the transformed handset. */
export function bakeGeometry(
  source: THREE.BufferGeometry,
  transform: THREE.Matrix4,
) {
  const geometry = source.clone();
  for (const name of ["position", "normal", "tangent"]) {
    const attribute = geometry.getAttribute(name);
    if (!attribute) continue;
    const data = new Float32Array(attribute.count * attribute.itemSize);
    for (let i = 0; i < attribute.count; i++) {
      for (let component = 0; component < attribute.itemSize; component++) {
        data[i * attribute.itemSize + component] = attribute.getComponent(
          i,
          component,
        );
      }
    }
    geometry.setAttribute(
      name,
      new THREE.BufferAttribute(data, attribute.itemSize),
    );
  }
  geometry.applyMatrix4(transform);
  return geometry;
}
