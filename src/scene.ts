import { devices } from "./devices";
import * as THREE from "three";
import { createStudioEnvironment, createDisplayMaterial } from "./studio";
import {
  loadPhoneModel,
  SCREEN_WIDTH,
  SCREEN_HEIGHT,
  type PhoneModel,
} from "./phone-model";
import type { Settings } from "./types";
import { materialMode } from "./metal";

export function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = () =>
      reject(new Error("图片无法读取，请尝试 PNG、JPG 或 WebP 格式。"));
    im.src = url;
  });
}
export function cover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | HTMLCanvasElement | HTMLVideoElement,
  x: number,
  y: number,
  w: number,
  h: number,
  contain = false,
) {
  const iw = img instanceof HTMLVideoElement ? img.videoWidth : img.width;
  const ih = img instanceof HTMLVideoElement ? img.videoHeight : img.height;
  const ratio = contain ? Math.min(w / iw, h / ih) : Math.max(w / iw, h / ih);
  ctx.drawImage(
    img,
    x + (w - iw * ratio) / 2,
    y + (h - ih * ratio) / 2,
    iw * ratio,
    ih * ratio,
  );
}
export async function demoScreen() {
  const c = document.createElement("canvas");
  c.width = 1206;
  c.height = 2622;
  const x = c.getContext("2d")!;
  x.fillStyle = "#f6f3e9";
  x.fillRect(0, 0, c.width, c.height);
  try {
    const im = await loadImage("/alpine.jpg");
    cover(x, im, 0, 0, 1206, 1720);
  } catch {
    const g = x.createLinearGradient(0, 0, 1206, 1700);
    g.addColorStop(0, "#9faf94");
    g.addColorStop(1, "#354c3c");
    x.fillStyle = g;
    x.fillRect(0, 0, 1206, 1720);
  }
  const shade = x.createLinearGradient(0, 0, 0, 1700);
  shade.addColorStop(0, "#10271c44");
  shade.addColorStop(0.5, "#17291c00");
  shade.addColorStop(1, "#15251fe8");
  x.fillStyle = shade;
  x.fillRect(0, 0, 1206, 1720);
  x.fillStyle = "#fffff5";
  x.font = "600 40px system-ui";
  x.fillText("9:41", 85, 95);
  x.fillText("▰", 1050, 95);
  x.font = "500 40px system-ui";
  x.fillText("elsewhere", 86, 250);
  x.font = "34px system-ui";
  x.fillText("↗", 1080, 250);
  x.font = "32px system-ui";
  x.fillText("LESS SCROLL. MORE SOUL.", 86, 1180);
  x.font = "100px Georgia";
  x.fillText("Find your", 80, 1320);
  x.fillText("somewhere.", 80, 1440);
  x.font = "34px system-ui";
  x.fillText("A little further from the everyday.", 86, 1540);
  x.fillStyle = "#394b3e";
  x.font = "28px system-ui";
  x.fillText("THE SLOW JOURNAL", 86, 1830);
  x.font = "72px Georgia";
  x.fillText("Take the scenic route.", 80, 1950);
  x.fillStyle = "#7a7b6d";
  x.font = "34px system-ui";
  x.fillText("Places to pause. Stories to bring home.", 86, 2035);
  x.strokeStyle = "#c8ccbc";
  x.lineWidth = 2;
  x.beginPath();
  x.moveTo(86, 2140);
  x.lineTo(1120, 2140);
  x.stroke();
  x.fillStyle = "#394b3e";
  x.font = "38px system-ui";
  x.fillText("Explore the collection", 86, 2250);
  x.fillText("↗", 1070, 2250);
  x.font = "28px system-ui";
  x.fillText("DISCOVER", 95, 2460);
  x.fillText("JOURNAL", 504, 2460);
  x.fillText("SAVED", 950, 2460);
  x.fillStyle = "#26382b";
  x.beginPath();
  x.roundRect(425, 2560, 356, 13, 7);
  x.fill();
  return c;
}
export class PhoneScene {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera();
  ortho = new THREE.OrthographicCamera();
  phone = new THREE.Group();
  screenCanvas = document.createElement("canvas");
  screenTexture: THREE.CanvasTexture;
  screenMat: THREE.MeshPhysicalMaterial;
  settings: Settings;
  image: HTMLImageElement | HTMLCanvasElement | HTMLVideoElement | null = null;
  env: THREE.WebGLRenderTarget;
  disposed = false;
  light: THREE.DirectionalLight;
  shadowsEnabled = true;
  shadowLight = new THREE.DirectionalLight("#ffffff", 0);
  shadowPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.ShadowMaterial({
      color: "#181818",
      opacity: 0.2,
      depthWrite: false,
    }),
  );
  private shadowBounds = new THREE.Box3();
  private shadowCenter = new THREE.Vector3();
  private shadowSize = new THREE.Vector3();
  model: PhoneModel | null = null;
  ready: Promise<void>;

  constructor(canvas: HTMLCanvasElement, settings: Settings) {
    this.settings = settings;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
    });
    this.renderer.setPixelRatio(Math.min(Math.max(devicePixelRatio, 1.5), 3));
    this.renderer.setClearColor(0, 0);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.VSMShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.env = createStudioEnvironment(
      this.renderer,
      settings.environmentContrast,
    );
    this.scene.environment = this.env.texture;
    this.scene.add(new THREE.HemisphereLight("#fff7ee", "#566558", 0.8));
    this.light = new THREE.DirectionalLight("#fffaf3", 1.6);
    this.light.position.set(-5, 7, 8);
    this.scene.add(this.light);
    const rim = new THREE.DirectionalLight("#d8e7ff", 0.2);
    rim.position.set(5, 1, -3);
    this.scene.add(rim, this.phone);
    // A transparent receiver catches the actual model silhouette. Its shallow
    // incline keeps the floor visible with both perspective and orthographic cameras.
    this.shadowPlane.rotation.x = -Math.PI / 2 + Math.atan(0.28);
    this.shadowPlane.receiveShadow = true;
    // Fade the finite catcher before its edges, keeping a broad penumbra without
    // exposing the VSM receiver/frustum boundary across the background.
    this.shadowPlane.material.onBeforeCompile = (shader) => {
      shader.vertexShader =
        "varying vec2 vFloorUv;\n" +
        shader.vertexShader.replace(
          "#include <begin_vertex>",
          "#include <begin_vertex>\n vFloorUv = uv;",
        );
      shader.fragmentShader =
        "varying vec2 vFloorUv;\n" +
        shader.fragmentShader.replace(
          "#include <tonemapping_fragment>",
          "gl_FragColor.a *= 1.0 - smoothstep(0.2, 0.48, length(vFloorUv - vec2(0.5)));\n#include <tonemapping_fragment>",
        );
    };
    this.shadowPlane.visible = false;
    this.shadowLight.castShadow = true;
    this.shadowLight.shadow.mapSize.set(512, 512);
    this.shadowLight.shadow.radius = 32;
    this.shadowLight.shadow.blurSamples = 24;
    this.shadowLight.shadow.bias = -0.0001;
    this.shadowLight.shadow.normalBias = 0.015;
    this.scene.add(this.shadowPlane, this.shadowLight, this.shadowLight.target);
    this.screenCanvas.width = devices[settings.device].screen[0];
    this.screenCanvas.height = devices[settings.device].screen[1];
    this.screenTexture = new THREE.CanvasTexture(this.screenCanvas);
    this.screenTexture.colorSpace = THREE.SRGBColorSpace;
    this.screenTexture.anisotropy =
      this.renderer.capabilities.getMaxAnisotropy();
    this.screenMat = createDisplayMaterial(this.screenTexture);
    this.ready = loadPhoneModel(this.screenMat, settings.device).then(
      (model) => {
        if (this.disposed) {
          disposeGroup(model.group);
          return;
        }
        this.model = model;
        model.group.traverse((object) => {
          if (object instanceof THREE.Mesh) object.castShadow = true;
        });
        this.phone.add(model.group);
        this.update(this.settings);
      },
    );
    this.update(settings);
  }
  setImage(im: HTMLImageElement | HTMLCanvasElement | HTMLVideoElement) {
    this.image = im;
    const native = devices[this.settings.device].screen;
    const resolution = Math.min(
      this.renderer.capabilities.maxTextureSize,
      8192,
      im instanceof HTMLVideoElement
        ? Math.min(1920, im.videoHeight)
        : Math.max(native[1], im.height, (im.width * native[1]) / native[0]),
    );
    const width = Math.round((resolution * native[0]) / native[1]),
      height = Math.round(resolution);
    if (
      width !== this.screenCanvas.width ||
      height !== this.screenCanvas.height
    ) {
      this.screenTexture.dispose();
      this.screenCanvas.width = width;
      this.screenCanvas.height = height;
      this.screenTexture = new THREE.CanvasTexture(this.screenCanvas);
      this.screenTexture.colorSpace = THREE.SRGBColorSpace;
      this.screenTexture.anisotropy =
        this.renderer.capabilities.getMaxAnisotropy();
      this.screenMat.emissiveMap = this.screenTexture;
      this.screenMat.needsUpdate = true;
    }
    this.updateTexture();
  }
  updateTexture() {
    if (!this.image) return;
    const ctx = this.screenCanvas.getContext("2d")!;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.fillStyle = "#151816";
    ctx.fillRect(0, 0, this.screenCanvas.width, this.screenCanvas.height);
    cover(
      ctx,
      this.image,
      0,
      0,
      this.screenCanvas.width,
      this.screenCanvas.height,
      this.settings.fit === "contain",
    );
    this.screenTexture.needsUpdate = true;
    this.render();
  }
  update(s: Settings) {
    const fitChanged = this.settings.fit !== s.fit;
    if (this.settings.environmentContrast !== s.environmentContrast) {
      const previous = this.env;
      this.env = createStudioEnvironment(this.renderer, s.environmentContrast);
      this.scene.environment = this.env.texture;
      previous.dispose();
    }
    this.settings = s;
    this.phone.rotation.set(
      THREE.MathUtils.degToRad(s.rx),
      THREE.MathUtils.degToRad(s.ry),
      THREE.MathUtils.degToRad(s.rz),
    );
    this.phone.scale.setScalar(s.scale / 100);
    const photo = materialMode(s) === "realistic";
    this.model?.update(s);
    this.scene.environmentIntensity = photo ? 1 : 0.4;
    this.light.intensity = photo ? 0.25 + s.bodyReflection / 200 : 0.7;
    this.screenMat.envMapIntensity = photo ? (s.reflection / 100) * 3 : 0;
    this.screenMat.specularIntensity = photo ? s.reflection / 100 : 0;
    if (fitChanged) this.updateTexture();
    this.render();
  }
  render() {
    if (this.disposed) return;
    const canvas = this.renderer.domElement;
    const aspect = canvas.width / canvas.height;
    const viewHeight = aspect < 1 ? 10.1 / aspect : 10.1;
    this.phone.position.set(
      (this.settings.offsetX / 100) * viewHeight * aspect,
      (-this.settings.offsetY / 100) * viewHeight,
      0,
    );
    this.camera.fov = this.settings.perspective;
    this.camera.aspect = aspect;
    this.camera.near = 0.1;
    this.camera.far = 200;
    this.camera.position.set(
      0,
      0,
      viewHeight /
        (2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2))),
    );
    this.camera.updateProjectionMatrix();
    this.ortho.left = (-viewHeight * aspect) / 2;
    this.ortho.right = (viewHeight * aspect) / 2;
    this.ortho.top = viewHeight / 2;
    this.ortho.bottom = -viewHeight / 2;
    this.ortho.near = 0.1;
    this.ortho.far = 200;
    this.ortho.position.set(0, 0, 30);
    this.ortho.updateProjectionMatrix();
    this.shadowPlane.visible =
      this.shadowsEnabled && this.settings.shadow > 0 && !!this.model;
    this.shadowLight.visible = this.shadowPlane.visible;
    if (this.shadowPlane.visible) {
      this.phone.updateMatrixWorld(true);
      this.shadowBounds.setFromObject(this.phone);
      this.shadowBounds.getCenter(this.shadowCenter);
      this.shadowBounds.getSize(this.shadowSize);
      const gap =
        ((0.1 + this.settings.shadowDistance * 0.024) * this.settings.scale) / 100;
      this.shadowPlane.position.set(
        this.shadowCenter.x,
        this.shadowBounds.min.y - gap,
        this.shadowBounds.min.z,
      );
      this.shadowPlane.material.opacity = this.settings.shadow / 260;
      this.shadowLight.position.set(
        this.shadowCenter.x - 3,
        this.shadowCenter.y + 10,
        this.shadowCenter.z + 4,
      );
      this.shadowLight.target.position.copy(this.shadowCenter);
      const extent = Math.max(4, this.shadowSize.length() * 0.85);
      this.shadowPlane.scale.set(extent * 1.5, extent * 1.5, 1);
      const camera = this.shadowLight.shadow.camera;
      camera.left = camera.bottom = -extent;
      camera.right = camera.top = extent;
      camera.near = 0.1;
      camera.far = 60;
      camera.updateProjectionMatrix();
    }
    this.renderer.render(
      this.scene,
      this.settings.style === "minimal" ? this.ortho : this.camera,
    );
  }
  resize(w: number, h: number) {
    this.renderer.setSize(w, h, false);
    this.render();
  }
  dispose() {
    this.disposed = true;
    disposeGroup(this.phone);
    this.screenTexture.dispose();
    this.screenMat.dispose();
    this.env.dispose();
    this.shadowPlane.geometry.dispose();
    this.shadowPlane.material.dispose();
    this.shadowLight.shadow.dispose();
    this.renderer.dispose();
  }
}
function disposeGroup(group: THREE.Object3D) {
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  group.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.geometry.dispose();
      (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) =>
        materials.add(m),
      );
    }
  });
  materials.forEach((m) => {
    Object.values(m).forEach((v) => {
      if (v instanceof THREE.Texture) textures.add(v);
    });
    m.dispose();
  });
  textures.forEach((t) => t.dispose());
}
export function paintBackground(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  s: Settings,
  img: HTMLImageElement | null,
) {
  ctx.clearRect(0, 0, w, h);
  if (s.bgType === "image" && img) {
    cover(ctx, img, 0, 0, w, h);
  } else if (s.bgType === "gradient") {
    const a = ((s.gradientAngle - 90) * Math.PI) / 180,
      dx = (Math.cos(a) * w) / 2,
      dy = (Math.sin(a) * h) / 2;
    const g = ctx.createLinearGradient(
      w / 2 - dx,
      h / 2 - dy,
      w / 2 + dx,
      h / 2 + dy,
    );
    g.addColorStop(0, s.color1);
    g.addColorStop(1, s.color2);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  } else {
    ctx.fillStyle = s.color1;
    ctx.fillRect(0, 0, w, h);
  }
}
