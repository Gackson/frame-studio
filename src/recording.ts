import { Vector2 } from "three";
import { sample, type Keyframe } from "./animation";
import { PhoneScene, paintBackground } from "./scene";
import type { Settings } from "./types";
export async function seekVideo(v: HTMLVideoElement, time: number) {
  const target = Math.min(time, Math.max(0, v.duration - 0.001));
  if (Math.abs(v.currentTime - target) < 0.01 && !v.seeking) return;
  await new Promise<void>((resolve, reject) => {
    const done = () => {
        cleanup();
        resolve();
      },
      fail = () => {
        cleanup();
        reject(new Error("视频帧加载超时，请重试。"));
      };
    const timer = setTimeout(fail, 10000);
    const cleanup = () => {
      clearTimeout(timer);
      v.removeEventListener("seeked", done);
      v.removeEventListener("error", fail);
    };
    v.addEventListener("seeked", done);
    v.addEventListener("error", fail);
    v.currentTime = target;
  });
}
/** Real-time, silent composition recording using the browser's supported codec. */
export async function recordAnimation(
  p: PhoneScene,
  settings: Settings,
  frames: Keyframe[],
  duration: number,
  background: HTMLImageElement | null,
  video: HTMLVideoElement | null,
) {
  if (typeof MediaRecorder === "undefined")
    throw new Error("当前浏览器不支持动画导出，请使用新版 Chrome / Safari。");
  const mime = [
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/mp4",
  ].find((t) => MediaRecorder.isTypeSupported(t));
  if (!mime) throw new Error("浏览器没有可用的视频编码器。");
  const [rw, rh] = settings.ratio.split(":").map(Number),
    w = Math.round((1280 * Math.min(1, rw / rh)) / 2) * 2,
    h = Math.round((w * rh) / rw / 2) * 2;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  const size = p.renderer.getSize(new Vector2()),
    ratio = p.renderer.getPixelRatio(),
    oldTime = video?.currentTime ?? 0;
  const stream = canvas.captureStream(30),
    recorder = new MediaRecorder(stream, {
      mimeType: mime,
      videoBitsPerSecond: 8_000_000,
    });
  let raf = 0;
  const chunks: Blob[] = [];
  try {
    if (video) {
      video.pause();
      await seekVideo(video, 0);
      p.updateTexture();
    }
    p.renderer.setPixelRatio(1);
    p.resize(w, h);
    const draw = (t: number) => {
      const s = { ...settings, ...sample(frames, t) };
      p.update(s);
      if (video) p.updateTexture();
      paintBackground(ctx, w, h, s, background);
      ctx.drawImage(p.renderer.domElement, 0, 0, w, h);
    };
    draw(0);
    await new Promise<void>((resolve, reject) => {
      const cleanup = () => {
        cancelAnimationFrame(raf);
        document.removeEventListener("visibilitychange", visibility);
      };
      const fail = (message: string) => {
        cleanup();
        if (recorder.state !== "inactive") recorder.stop();
        reject(new Error(message));
      };
      const visibility = () => {
        if (document.hidden) fail("导出已中止：请保持页面可见，再次导出。");
      };
      document.addEventListener("visibilitychange", visibility);
      recorder.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data);
      };
      recorder.onerror = () => fail("视频编码失败，请降低动画时长后重试。");
      recorder.onstop = () => {
        cleanup();
        resolve();
      };
      recorder.start();
      const start = performance.now();
      if (video)
        void video.play().catch(() => fail("屏幕视频无法播放，请重试。"));
      const tick = (now: number) => {
        try {
          const t = Math.min(duration, (now - start) / 1000);
          draw(t);
          if (t >= duration) {
            video?.pause();
            recorder.stop();
          } else raf = requestAnimationFrame(tick);
        } catch {
          fail("动画渲染失败，请重试。");
        }
      };
      raf = requestAnimationFrame(tick);
    });
    const url = URL.createObjectURL(new Blob(chunks, { type: mime }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `frame-studio-${settings.device}.${mime.startsWith("video/mp4") ? "mp4" : "webm"}`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } finally {
    cancelAnimationFrame(raf);
    if (recorder.state !== "inactive") recorder.stop();
    stream.getTracks().forEach((t) => t.stop());
    if (video) {
      video.pause();
      await seekVideo(video, oldTime).catch(() => {});
      p.updateTexture();
    }
    p.renderer.setPixelRatio(ratio);
    p.resize(size.x, size.y);
    p.update(settings);
  }
}
