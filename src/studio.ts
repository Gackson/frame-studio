import * as THREE from "three";

/** Finite softboxes give the screen a real reflection that moves with the camera.
 * The same boxes illuminate the metal through PMREM; no texture is painted over the screenshot. */
export function createStudioEnvironment(renderer: THREE.WebGLRenderer) {
  const studio = new THREE.Scene();
  studio.background = new THREE.Color("#25282b");
  const box = (
    width: number,
    height: number,
    position: [number, number, number],
    intensity: number,
  ) => {
    const light = new THREE.Mesh(
      new THREE.PlaneGeometry(width, height),
      new THREE.MeshBasicMaterial({
        color: new THREE.Color().setScalar(intensity),
        side: THREE.DoubleSide,
      }),
    );
    light.position.set(...position);
    light.lookAt(0, 0, 0);
    studio.add(light);
  };
  box(5, 10, [-5, 3, 7], 3.0);
  box(2, 11, [6, 1, 4], 2.0);
  box(8, 3, [0, 7, -2], 2.4);
  box(4, 8, [-5, 0, -6], 1.4);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const target = pmrem.fromScene(studio, 0.035);
  pmrem.dispose();
  studio.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      object.geometry.dispose();
      (object.material as THREE.Material).dispose();
    }
  });
  return target;
}

export function createDisplayMaterial(texture: THREE.Texture) {
  return new THREE.MeshPhysicalMaterial({
    // OLED pixels are emissive. The dielectric surface reflects the studio independently.
    color: "#080808",
    emissive: "#ffffff",
    emissiveMap: texture,
    emissiveIntensity: 1,
    metalness: 0,
    roughness: 0.14,
    ior: 1.5,
    specularIntensity: 0.65,
    clearcoat: 0,
    envMapIntensity: 0.7,
    toneMapped: false,
  });
}
