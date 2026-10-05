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

/** The 15 model packs its camera plate, lens covers and logo into one palette
 * material. Identify the broad, shallow camera plate by connected geometry;
 * assigning the whole palette a body color would also paint over the lenses. */
export function separateCameraPlate(
  geometry: THREE.BufferGeometry,
  includeLogo = false,
): boolean {
  const position = geometry.attributes.position;
  const parent = Array.from({ length: position.count }, (_, i) => i);
  const root = (i: number): number => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]];
      i = parent[i];
    }
    return i;
  };
  const join = (a: number, b: number) => {
    parent[root(a)] = root(b);
  };
  const coincident = new Map<string, number>();
  for (let i = 0; i < position.count; i++) {
    const key = [position.getX(i), position.getY(i), position.getZ(i)]
      .map((v) => Math.round(v * 1e5))
      .join(",");
    const other = coincident.get(key);
    if (other !== undefined) join(i, other);
    else coincident.set(key, i);
  }
  const indices = geometry.index
    ? Array.from(geometry.index.array)
    : parent.map((_, i) => i);
  for (let i = 0; i < indices.length; i += 3) {
    join(indices[i], indices[i + 1]);
    join(indices[i], indices[i + 2]);
  }
  const bounds = new Map<number, THREE.Box3>();
  const point = new THREE.Vector3();
  for (let i = 0; i < position.count; i++) {
    const id = root(i);
    if (!bounds.has(id)) bounds.set(id, new THREE.Box3());
    bounds.get(id)!.expandByPoint(point.fromBufferAttribute(position, i));
  }
  const plates = new Set<number>();
  const logos = new Set<number>();
  bounds.forEach((b, id) => {
    const size = b.getSize(new THREE.Vector3());
    if (b.min.y > 1 && size.x > 1 && size.y > 1 && size.z < 0.02)
      plates.add(id);
    else if (
      includeLogo &&
      b.min.y > -1 &&
      b.max.y < 1 &&
      b.min.x > -0.6 &&
      b.max.x < 0.6 &&
      b.max.z < 0 &&
      size.z < 0.01
    )
      logos.add(id);
  });
  const detail: number[] = [],
    plate: number[] = [],
    logo: number[] = [];
  for (let i = 0; i < indices.length; i += 3) {
    const dest = plates.has(root(indices[i]))
      ? plate
      : logos.has(root(indices[i]))
        ? logo
        : detail;
    dest.push(indices[i], indices[i + 1], indices[i + 2]);
  }
  if (!plate.length || !detail.length) return false;
  geometry.setIndex([...detail, ...plate, ...logo]);
  geometry.clearGroups();
  geometry.addGroup(0, detail.length, 0);
  geometry.addGroup(detail.length, plate.length, 1);
  if (logo.length)
    geometry.addGroup(detail.length + plate.length, logo.length, 2);
  return true;
}
