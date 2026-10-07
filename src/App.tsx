import { Timeline } from "./Timeline";
import { createId } from "./id";
import { publicAsset } from "./assets";
import {
  capturePose,
  curves,
  sample,
  nearestAngle,
  type Keyframe,
} from "./animation";
import { loadVideo, releaseVideo } from "./media";
import { workspaceTheme, imageTheme } from "./theme";
import { devices, type DeviceId } from "./devices";
import { useEffect, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  Download,
  ImagePlus,
  Maximize,
  Minus,
  Plus,
  RotateCcw,
  Smartphone,
  Upload,
  X,
  SlidersHorizontal,
} from "lucide-react";
import {
  Section,
  Select,
  Slider,
  Toggle,
  ResetButton,
  CustomColorSlot,
} from "./Controls";
import { Viewport } from "./Viewport";
import type { ViewportHandle } from "./Viewport";
import { initial, palettes, poses, frameColors } from "./types";
import type { Settings, CustomColors } from "./types";
import { loadImage } from "./scene";
import {
  loadProject,
  saveProject,
  saveAsset,
  removeAsset,
  type SavedProject,
} from "./project-storage";
export default function App() {
  const [restored, setRestored] = useState(false);
  const [customColors, setCustomColors] = useState<CustomColors>({
    solid: null,
    gradient: null,
    frame: null,
  });
  const [assetIds, setAssetIds] = useState<SavedProject["assets"]>({
    screen: null,
    bg: null,
  });
  const saveFailed = useRef(false);
  const [mediaType, setMediaType] = useState<"image" | "video">("image");
  const [pasteTarget, setPasteTarget] = useState<"screen" | "bg">("screen");
  const [time, setTime] = useState(0),
    [duration, setDuration] = useState(5);
  const [playing, setPlaying] = useState(false),
    [loop, setLoop] = useState(true);
  const [frames, setFrames] = useState<Keyframe[]>([]),
    [selected, setSelected] = useState<string | null>(null);
  const clock = useRef(0),
    uploads = useRef({ screen: 0, bg: 0 });
  const urls = useRef({ screen: "", bg: "" });
  const [moveMode, setMoveMode] = useState(false);
  const [imageColor, setImageColor] = useState("#c5cbbd");
  const [s, setS] = useState<Settings>(initial),
    [screenshot, setScreenshot] = useState(""),
    [fileName, setFileName] = useState("示例截图"),
    [imageInfo, setImageInfo] = useState("1206 × 2622"),
    [toast, setToast] = useState(""),
    [exporting, setExporting] = useState(false),
    [quality, setQuality] = useState(1),
    [selectedPose, setSelectedPose] = useState(0),
    [sideOpen, setSideOpen] = useState(true);
  const screenInput = useRef<HTMLInputElement>(null),
    bgInput = useRef<HTMLInputElement>(null),
    viewport = useRef<ViewportHandle>(null),
    toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const update = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setPlaying(false);
    setS((v) => ({ ...v, [key]: value }));
  };
  function customizeColor(key: "color1" | "color2" | "frame", color: string) {
    update(key, color);
    setCustomColors((saved) =>
      key === "frame"
        ? { ...saved, frame: color }
        : s.bgType === "solid"
          ? { ...saved, solid: color }
          : {
              ...saved,
              gradient: {
                color1: key === "color1" ? color : s.color1,
                color2: key === "color2" ? color : s.color2,
                angle: s.gradientAngle,
              },
            },
    );
  }
  const notify = (message: string) => {
    setToast(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 4000);
  };
  useEffect(() => {
    let cancelled = false;
    void loadProject()
      .then((saved) => {
        if (cancelled) return;
        if (saved) {
          const { project, screen, bg } = saved;
          const previous = project.settings;
          setCustomColors(
            project.customColors ?? {
              solid: palettes.some(([color]) => color === previous.color1)
                ? null
                : previous.color1,
              gradient: palettes.some(
                ([a, b]) =>
                  a === previous.color1 &&
                  b === previous.color2 &&
                  previous.gradientAngle === initial.gradientAngle,
              )
                ? null
                : {
                    color1: previous.color1,
                    color2: previous.color2,
                    angle: previous.gradientAngle,
                  },
              frame: frameColors.some(([color]) => color === previous.frame)
                ? null
                : previous.frame,
            },
          );
          const screenUrl = screen ? URL.createObjectURL(screen) : "";
          const bgUrl = bg ? URL.createObjectURL(bg) : "";
          urls.current = { screen: screenUrl, bg: bgUrl };
          setS({
            ...initial,
            ...project.settings,
            material:
              project.settings.material ??
              (project.settings.style === "minimal" ? "clay" : "realistic"),
            bgImage: bgUrl,
          });
          setAssetIds({
            screen: screen ? project.assets.screen : null,
            bg: bg ? project.assets.bg : null,
          });
          setScreenshot(screenUrl);
          setMediaType(screen ? project.mediaType : "image");
          setFileName(screen ? project.fileName : "示例截图");
          setImageInfo(screen ? project.imageInfo : "1206 × 2622");
          setImageColor(project.imageColor);
          clock.current = Math.max(0, Math.min(project.duration, project.time));
          setTime(clock.current);
          setDuration(project.duration);
          setLoop(project.loop);
          setFrames(project.frames);
          setSelected(project.selected);
          setQuality(project.quality);
          setSelectedPose(project.selectedPose);
          setPasteTarget(project.pasteTarget);
          setMoveMode(project.moveMode);
          setSideOpen(project.sideOpen);
          if ((project.assets.screen && !screen) || (project.assets.bg && !bg))
            notify("部分本地素材已丢失，请重新导入。");
        }
        setRestored(true);
      })
      .catch(() => {
        if (!cancelled) {
          setRestored(true);
          notify("无法恢复上次内容，已打开默认画布。");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const snapshot: SavedProject = {
    version: 1,
    settings: s,
    customColors,
    assets: assetIds,
    mediaType,
    fileName,
    imageInfo,
    imageColor,
    time,
    duration,
    loop,
    frames,
    selected,
    quality,
    selectedPose,
    pasteTarget,
    moveMode,
    sideOpen,
  };
  const persistence = useRef({ restored, snapshot });
  persistence.current = { restored, snapshot };
  const persist = () => {
    const current = persistence.current;
    if (!current.restored) return;
    try {
      saveProject(current.snapshot);
      saveFailed.current = false;
    } catch {
      if (!saveFailed.current)
        notify("本地保存失败，请检查浏览器存储空间；本次修改可能无法保留。");
      saveFailed.current = true;
    }
  };
  useEffect(() => {
    // Save edits immediately; checkpoint continuous playback without writing every frame.
    if (!playing) persist();
  }, [
    restored,
    customColors,
    s,
    assetIds,
    mediaType,
    fileName,
    imageInfo,
    imageColor,
    time,
    duration,
    loop,
    frames,
    selected,
    quality,
    selectedPose,
    pasteTarget,
    moveMode,
    sideOpen,
    playing,
  ]);
  useEffect(() => {
    const flush = () => persist();
    const hidden = () => {
      if (document.visibilityState === "hidden") flush();
    };
    const timer = window.setInterval(flush, 250);
    window.addEventListener("pagehide", flush);
    window.addEventListener("beforeunload", flush);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      clearInterval(timer);
      window.removeEventListener("pagehide", flush);
      window.removeEventListener("beforeunload", flush);
      document.removeEventListener("visibilitychange", hidden);
    };
  }, []);
  function seek(t: number) {
    setPlaying(false);
    clock.current = t;
    setTime(t);
    const pose = sample(frames, t);
    if (pose) setS((v) => ({ ...v, ...pose }));
  }
  useEffect(() => {
    if (!playing) return;
    let raf = 0,
      last = performance.now();
    const tick = (now: number) => {
      const elapsed = (now - last) / 1000;
      if (elapsed < 1 / 30) {
        raf = requestAnimationFrame(tick);
        return;
      }
      last = now;
      let t = clock.current + elapsed;
      if (t >= duration) {
        if (loop) t %= duration;
        else {
          t = duration;
          setPlaying(false);
        }
      }
      clock.current = t;
      setTime(t);
      const pose = sample(frames, t);
      if (pose) setS((v) => ({ ...v, ...pose }));
      if (t < duration || loop) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, duration, loop, frames]);
  useEffect(
    () => () => {
      Object.values(urls.current).forEach(
        (url) => url && URL.revokeObjectURL(url),
      );
      clearTimeout(toastTimer.current);
    },
    [],
  );
  function changeFrame(id: string, patch: Partial<Keyframe>) {
    setPlaying(false);
    setFrames((old) => {
      if (
        patch.time !== undefined &&
        old.some((k) => k.id !== id && Math.abs(k.time - patch.time!) < 0.025)
      )
        return old;
      return old
        .map((k) => (k.id === id ? { ...k, ...patch } : k))
        .sort((a, b) => a.time - b.time);
    });
  }
  function addFrame() {
    setPlaying(false);
    const frameTime = Math.min(duration, Math.round(time * 10) / 10);
    clock.current = frameTime;
    setTime(frameTime);
    const existing = frames.find((k) => Math.abs(k.time - frameTime) < 0.025);
    const key: Keyframe = {
      id: existing?.id ?? createId(),
      time: existing?.time ?? frameTime,
      pose: capturePose(s),
      curve: structuredClone(existing?.curve ?? curves["平滑进出"]),
    };
    setFrames((v) =>
      [...v.filter((k) => k.id !== key.id), key].sort(
        (a, b) => a.time - b.time,
      ),
    );
    setSelected(key.id);
  }
  async function upload(file: File, target: "screen" | "bg") {
    if (!restored) return;
    const video = file.type.startsWith("video/");
    if (
      (!video &&
        !["image/png", "image/jpeg", "image/webp"].includes(file.type)) ||
      (video && target === "bg")
    ) {
      notify(
        target === "bg"
          ? "背景请使用 PNG、JPG 或 WebP 图片。"
          : "请选择 PNG、JPG、WebP 图片或 MP4、WebM 视频。",
      );
      return;
    }
    if (file.size > (video ? 250 : 25) * 1024 * 1024) {
      notify(video ? "视频不能超过 250 MB。" : "图片不能超过 25 MB。");
      return;
    }
    const request = ++uploads.current[target],
      url = URL.createObjectURL(file);
    try {
      let info = "",
        theme = "";
      if (video) {
        const v = await loadVideo(url);
        info = `${v.videoWidth} × ${v.videoHeight} · ${v.duration.toFixed(1)} s`;
        releaseVideo(v);
      } else {
        const img = await loadImage(url);
        if (img.width * img.height > 64_000_000)
          throw new Error("图片像素过大，请缩小到 6400 万像素以内。");
        info = `${img.width} × ${img.height}`;
        if (target === "bg") theme = imageTheme(img);
      }
      if (request !== uploads.current[target]) {
        URL.revokeObjectURL(url);
        return;
      }
      let assetId: string | null = null;
      try {
        assetId = await saveAsset(file);
      } catch {
        // Import still works when browser storage is unavailable; report the limitation.
      }
      if (request !== uploads.current[target]) {
        URL.revokeObjectURL(url);
        if (assetId) void removeAsset(assetId).catch(() => {});
        return;
      }
      setAssetIds((ids) => ({ ...ids, [target]: assetId }));
      const previous = urls.current[target];
      urls.current[target] = url;
      if (target === "screen") {
        setPlaying(false);
        setMediaType(video ? "video" : "image");
        setScreenshot(url);
        setFileName(file.name || "剪贴板图片");
        setImageInfo(info);
      } else {
        setImageColor(theme);
        setS((v) => ({ ...v, bgImage: url, bgType: "image" }));
      }
      if (previous) URL.revokeObjectURL(previous);
      notify(
        !assetId
          ? "素材已导入，但本地保存失败；重新打开后需重新导入。"
          : target === "screen"
            ? video
              ? "屏幕视频已导入，可通过时间轴播放"
              : "屏幕截图已更新"
            : "背景图片已更新",
      );
    } catch (e) {
      URL.revokeObjectURL(url);
      if (request === uploads.current[target]) notify((e as Error).message);
    }
  }
  const pasteHandler = useRef({ upload, pasteTarget });
  pasteHandler.current = { upload, pasteTarget };
  useEffect(() => {
    const handle = (e: ClipboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest('input, textarea, [contenteditable="true"]')) return;
      const file = Array.from(e.clipboardData?.items ?? [])
        .find(
          (i) =>
            i.kind === "file" &&
            (i.type.startsWith("image/") || i.type.startsWith("video/")),
        )
        ?.getAsFile();
      if (file) {
        e.preventDefault();
        void pasteHandler.current.upload(
          file,
          pasteHandler.current.pasteTarget,
        );
      }
    };
    window.addEventListener("paste", handle);
    return () => window.removeEventListener("paste", handle);
  }, []);
  async function paste(target: "screen" | "bg") {
    setPasteTarget(target);
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const type = item.types.find((t) => t.startsWith("image/"));
        if (type) {
          const blob = await item.getType(type);
          await upload(new File([blob], "剪贴板图片", { type }), target);
          return;
        }
      }
      notify("剪贴板中没有图片，请复制图片后使用 ⌘V / Ctrl+V。");
    } catch {
      notify(
        `已选择${target === "screen" ? "屏幕" : "背景"}，请按 ⌘V / Ctrl+V 粘贴图片。`,
      );
    }
  }
  function togglePlayback() {
    if (exporting || !restored) return;
    if (!playing && clock.current >= duration) {
      clock.current = 0;
      setTime(0);
      const pose = sample(frames, 0);
      if (pose) setS((v) => ({ ...v, ...pose }));
    }
    setPlaying((v) => !v);
  }
  const transport = useRef({ togglePlayback, exporting });
  transport.current = { togglePlayback, exporting };
  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      if (
        e.code !== "Space" ||
        e.altKey ||
        e.ctrlKey ||
        e.metaKey ||
        e.shiftKey ||
        e.isComposing
      )
        return;
      const target = e.target as HTMLElement;
      // Preserve normal typing and native form controls. Buttons and the canvas
      // use the transport shortcut, avoiding a second synthetic button click.
      if (
        target.closest(
          'input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"],[role="combobox"]',
        )
      )
        return;
      e.preventDefault();
      if (!e.repeat && !transport.current.exporting)
        transport.current.togglePlayback();
    };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, []);
  async function exportVideo() {
    setPlaying(false);
    setExporting(true);
    try {
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => resolve()),
      );
      await viewport.current?.exportVideo(frames, duration);
      notify("动画已导出（无音轨）。");
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setExporting(false);
    }
  }
  async function exportImage() {
    setPlaying(false);
    setExporting(true);
    try {
      await viewport.current?.exportPNG(quality);
      notify("PNG 已导出");
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setExporting(false);
    }
  }
  const dims = s.ratio.split(":").map(Number);
  const activePose = poses.findIndex((p) =>
    (
      ["rx", "ry", "rz", "scale", "perspective", "offsetX", "offsetY"] as const
    ).every((key) =>
      ["rx", "ry", "rz"].includes(key)
        ? Math.abs(nearestAngle(p[key], s[key]) - s[key]) < 0.001
        : p[key] === s[key],
    ),
  );
  const exportW = Math.round(1600 * quality * Math.min(1, dims[0] / dims[1])),
    exportH = Math.round((exportW * dims[1]) / dims[0]);
  return (
    <div
      className="app"
      style={workspaceTheme(
        s.bgType === "image" && s.bgImage
          ? imageColor
          : s.bgType === "gradient"
            ? s.color2
            : s.color1,
      )}
    >
      <header className="app-header">
        <div className="brand-group">
          <a href="/" className="brand" aria-label="Frame Studio 首页">
            <span>
              frame<span className="brand-light">studio</span>
            </span>
          </a>
          <a
            className="icon-button github-link"
            href="https://github.com/Gackson/frame-studio"
            target="_blank"
            rel="noopener noreferrer"
            title="在 GitHub 查看 Frame Studio"
            aria-label="在 GitHub 查看 Frame Studio"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M12 .75a11.25 11.25 0 0 0-3.56 21.92c.56.1.77-.24.77-.54v-2.09c-3.13.68-3.79-1.33-3.79-1.33-.51-1.3-1.25-1.65-1.25-1.65-1.02-.7.08-.69.08-.69 1.13.08 1.72 1.16 1.72 1.16 1 1.72 2.63 1.22 3.27.93.1-.72.39-1.22.71-1.5-2.5-.28-5.13-1.25-5.13-5.56 0-1.23.44-2.23 1.16-3.02-.12-.28-.5-1.43.11-2.98 0 0 .95-.3 3.1 1.15a10.8 10.8 0 0 1 5.63 0c2.15-1.45 3.09-1.15 3.09-1.15.62 1.55.23 2.7.12 2.98.72.79 1.15 1.79 1.15 3.02 0 4.32-2.63 5.28-5.14 5.56.4.35.76 1.03.76 2.08v3.09c0 .3.2.65.77.54A11.25 11.25 0 0 0 12 .75Z" />
            </svg>
          </a>
        </div>
        <div className="header-actions">
          <label className="export-background">
            <input
              type="checkbox"
              checked={s.transparentExport}
              onChange={(e) => update("transparentExport", e.target.checked)}
            />
            透明背景
          </label>
          <select
            className="quality-select"
            aria-label="导出倍率"
            value={quality}
            onChange={(e) => setQuality(Number(e.target.value))}
          >
            <option value={1}>1× PNG</option>
            <option value={2}>2× PNG</option>
            <option value={3}>3× PNG</option>
          </select>
          <button
            className="export-button"
            onClick={exportImage}
            disabled={exporting || !restored}
          >
            <Download size={15} />
            {exporting ? "正在导出…" : "导出图片"}
          </button>
          <button
            className="video-export-button"
            disabled={exporting || !restored}
            onClick={exportVideo}
          >
            导出动画
          </button>
        </div>
      </header>
      <div
        className="editor"
        inert={exporting || !restored}
        aria-busy={!restored}
      >
        <aside
          className={`inspector ${sideOpen ? "" : "collapsed"}`}
          onPointerDownCapture={() => setPlaying(false)}
        >
          <Section title="设备机型">
            <Select
              className="device-select"
              aria-label="设备机型"
              value={s.device}
              onChange={(e) =>
                setS((v) => ({ ...v, device: e.target.value as DeviceId }))
              }
            >
              {Object.entries(devices).map(([id, d]) => (
                <option key={id} value={id}>
                  {d.name}
                </option>
              ))}
            </Select>
            <a
              className="model-attribution"
              href={`${publicAsset("models/attribution.html")}#${s.device}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`查看 ${devices[s.device].name} 模型署名与许可`}
            >
              CC BY 4.0: {devices[s.device].author}
            </a>
          </Section>
          <Section title="屏幕内容">
            <div className="paste-actions">
              <button onClick={() => paste("screen")}>粘贴到屏幕</button>
              <button
                aria-pressed={pasteTarget === "screen"}
                onClick={() => setPasteTarget("screen")}
              >
                ⌘V / Ctrl+V {pasteTarget === "screen" ? "✓" : ""}
              </button>
            </div>
            <button
              className="upload-zone"
              title="点击或拖入；PNG/JPG/WebP ≤ 25 MB，MP4/WebM ≤ 250 MB"
              onClick={() => {
                setPasteTarget("screen");
                screenInput.current?.click();
              }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (e.dataTransfer.files[0])
                  upload(e.dataTransfer.files[0], "screen");
              }}
            >
              <span className="upload-icon">
                <ImagePlus size={21} />
              </span>
              <strong>导入图片 / 视频</strong>
            </button>
            <div className="asset-row">
              <div className="asset-thumbnail">
                {screenshot ? (
                  mediaType === "video" ? (
                    <video src={screenshot} muted playsInline />
                  ) : (
                    <img src={screenshot} alt="已上传截图缩略图" />
                  )
                ) : (
                  <img src={publicAsset("alpine.jpg")} alt="山野示例缩略图" />
                )}
              </div>
              <div>
                <strong title={fileName}>{fileName}</strong>
                <span>{imageInfo}</span>
              </div>
              <button
                className="icon-button"
                title="替换截图"
                aria-label="替换截图"
                onClick={() => {
                  setPasteTarget("screen");
                  screenInput.current?.click();
                }}
              >
                <Upload size={14} />
              </button>
            </div>
            <div className="inline-setting">
              <span>截图适配</span>
              <Select
                aria-label="截图适配"
                value={s.fit}
                onChange={(e) =>
                  update("fit", e.target.value as Settings["fit"])
                }
              >
                <option value="cover">填满屏幕</option>
                <option value="contain">完整显示</option>
              </Select>
            </div>
          </Section>
          <Section title="渲染风格">
            <div className="style-options">
              <button
                className={
                  s.style === "photo" ? "style-choice selected" : "style-choice"
                }
                aria-pressed={s.style === "photo"}
                onClick={() => update("style", "photo")}
              >
                <span>3D</span>
                {s.style === "photo" && (
                  <Check className="style-check" size={12} />
                )}
              </button>
              <button
                className={
                  s.style === "minimal"
                    ? "style-choice selected"
                    : "style-choice"
                }
                aria-pressed={s.style === "minimal"}
                onClick={() => {
                  setPlaying(false);
                  setS((v) => ({
                    ...v,
                    style: "minimal",
                    material: v.material === "glow" ? "glow" : "clay",
                  }));
                }}
              >
                <span>2.5D</span>
                {s.style === "minimal" && (
                  <Check className="style-check" size={12} />
                )}
              </button>
            </div>
          </Section>
          <Section
            title="角度与构图"
            action={
              <ResetButton
                onClick={() => {
                  setS((v) => ({
                    ...v,
                    offsetX: 0,
                    offsetY: 0,
                    rx: initial.rx,
                    ry: initial.ry,
                    rz: initial.rz,
                    perspective: 35,
                    scale: 90,
                  }));
                  setSelectedPose(0);
                }}
              />
            }
          >
            <div className="pose-picker">
              <div className="pose-grid" role="group" aria-label="构图预设">
                {poses.map((p, i) => (
                  <button
                    key={p.name}
                    className={`pose-choice ${activePose === i ? "active" : ""}`}
                    aria-label={p.name}
                    title={p.name}
                    aria-pressed={activePose === i}
                    onClick={() => {
                      setPlaying(false);
                      const { name: _name, ...composition } = p;
                      setS((v) => ({
                        ...v,
                        ...composition,
                        rx: nearestAngle(p.rx, v.rx),
                        ry: nearestAngle(p.ry, v.ry),
                        rz: nearestAngle(p.rz, v.rz),
                      }));
                      setSelectedPose(i);
                    }}
                  >
                    <Smartphone
                      size={23}
                      style={{
                        transform: `perspective(80px) rotateX(${p.rx}deg) rotateY(${p.ry}deg) rotateZ(${-p.rz}deg) scale(${p.scale / 100})`,
                      }}
                    />
                    <span>{p.name}</span>
                  </button>
                ))}
              </div>
            </div>
            <Slider
              label="水平旋转"
              continuous
              value={s.ry}
              min={-180}
              max={180}
              onChange={(v) => {
                update("ry", v);
                setSelectedPose(-1);
              }}
            />
            <Slider
              label="俯仰角度"
              continuous
              value={s.rx}
              min={-180}
              max={180}
              onChange={(v) => {
                update("rx", v);
                setSelectedPose(-1);
              }}
            />
            <Slider
              label="画面倾斜"
              continuous
              value={s.rz}
              min={-180}
              max={180}
              onChange={(v) => {
                update("rz", v);
                setSelectedPose(-1);
              }}
            />
            <Slider
              label={s.style === "minimal" ? "透视（正交视图）" : "相机透视"}
              value={s.perspective}
              min={10}
              max={75}
              onChange={(v) => update("perspective", v)}
              disabled={s.style === "minimal"}
            />
            <Slider
              label="模型大小"
              value={s.scale}
              min={35}
              max={150}
              unit="%"
              onChange={(v) => update("scale", v)}
            />
          </Section>
          <Section
            title="位置"
            action={
              <ResetButton
                label="重置位置"
                onClick={() => {
                  setPlaying(false);
                  setS((v) => ({ ...v, offsetX: 0, offsetY: 0 }));
                }}
              />
            }
          >
            <Slider
              label="水平位置"
              value={s.offsetX}
              min={-45}
              max={45}
              unit="%"
              onChange={(v) => update("offsetX", v)}
            />
            <Slider
              label="垂直位置"
              value={s.offsetY}
              min={-45}
              max={45}
              unit="%"
              onChange={(v) => update("offsetY", v)}
            />
          </Section>
          <Section title="背景">
            <div className="paste-actions">
              <button onClick={() => paste("bg")}>粘贴到背景</button>
              <button
                aria-pressed={pasteTarget === "bg"}
                onClick={() => setPasteTarget("bg")}
              >
                ⌘V / Ctrl+V {pasteTarget === "bg" ? "✓" : ""}
              </button>
            </div>
            <div className="segmented">
              {(
                [
                  ["gradient", "渐变"],
                  ["solid", "纯色"],
                  ["image", "图片"],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  className={s.bgType === key ? "active" : ""}
                  aria-pressed={s.bgType === key}
                  onClick={() => {
                    setPasteTarget("bg");
                    update("bgType", key);
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            {s.bgType === "image" ? (
              <>
                <button
                  className="background-upload"
                  onClick={() => {
                    setPasteTarget("bg");
                    bgInput.current?.click();
                  }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (e.dataTransfer.files[0])
                      upload(e.dataTransfer.files[0], "bg");
                  }}
                >
                  {s.bgImage ? (
                    <img src={s.bgImage} alt="自定义背景" />
                  ) : (
                    <ImagePlus size={22} />
                  )}
                  <span>{s.bgImage ? "更换背景图片" : "上传背景图片"}</span>
                </button>
                {s.bgImage && (
                  <button
                    className="text-button"
                    onClick={() => {
                      ++uploads.current.bg;
                      URL.revokeObjectURL(s.bgImage);
                      urls.current.bg = "";
                      setAssetIds((ids) => ({ ...ids, bg: null }));
                      setS((v) => ({ ...v, bgImage: "", bgType: "gradient" }));
                    }}
                  >
                    移除图片
                  </button>
                )}
              </>
            ) : (
              <>
                <div className="swatches">
                  {palettes.map(([a, b], i) => (
                    <button
                      key={a}
                      title={
                        ["青苔", "砂岩", "暮紫", "陶土", "雾蓝", "深林"][i]
                      }
                      aria-label={`${["青苔", "砂岩", "暮紫", "陶土", "雾蓝", "深林"][i]}配色`}
                      className={
                        s.color1 === a &&
                        (s.bgType === "solid" || s.color2 === b)
                          ? "chosen"
                          : ""
                      }
                      style={{
                        background:
                          s.bgType === "solid"
                            ? a
                            : `linear-gradient(135deg,${a},${b})`,
                      }}
                      onClick={() =>
                        setS((v) => ({ ...v, color1: a, color2: b }))
                      }
                    >
                      {s.color1 === a &&
                        (s.bgType === "solid" || s.color2 === b) && (
                          <Check size={14} />
                        )}
                    </button>
                  ))}
                  <CustomColorSlot
                    label={
                      s.bgType === "solid"
                        ? "使用自定义背景色"
                        : "使用自定义渐变"
                    }
                    color={
                      s.bgType === "solid"
                        ? customColors.solid
                        : customColors.gradient
                          ? `linear-gradient(${customColors.gradient.angle}deg, ${customColors.gradient.color1}, ${customColors.gradient.color2})`
                          : null
                    }
                    selected={
                      s.bgType === "solid"
                        ? s.color1 === customColors.solid
                        : !!customColors.gradient &&
                          s.color1 === customColors.gradient.color1 &&
                          s.color2 === customColors.gradient.color2 &&
                          s.gradientAngle === customColors.gradient.angle
                    }
                    onSelect={() => {
                      setPlaying(false);
                      if (s.bgType === "solid" && customColors.solid)
                        update("color1", customColors.solid);
                      else if (customColors.gradient) {
                        const { color1, color2, angle } = customColors.gradient;
                        setS((v) => ({
                          ...v,
                          color1,
                          color2,
                          gradientAngle: angle,
                        }));
                      }
                    }}
                  />
                </div>
                <div className="color-fields">
                  <label>
                    <input
                      type="color"
                      aria-label="背景颜色一"
                      value={s.color1}
                      onChange={(e) => customizeColor("color1", e.target.value)}
                    />
                    <span>{s.color1.toUpperCase()}</span>
                  </label>
                  {s.bgType === "gradient" && (
                    <label>
                      <input
                        type="color"
                        aria-label="背景颜色二"
                        value={s.color2}
                        onChange={(e) =>
                          customizeColor("color2", e.target.value)
                        }
                      />
                      <span>{s.color2.toUpperCase()}</span>
                    </label>
                  )}
                </div>
                {s.bgType === "gradient" && (
                  <Slider
                    label="渐变方向"
                    value={s.gradientAngle}
                    min={0}
                    max={360}
                    onChange={(angle) => {
                      update("gradientAngle", angle);
                      setCustomColors((saved) => ({
                        ...saved,
                        gradient: { color1: s.color1, color2: s.color2, angle },
                      }));
                    }}
                  />
                )}
              </>
            )}
          </Section>
          <Section title="材质与光影">
            <div className="inline-setting">
              <span>表面材质</span>
              <Select
                aria-label="表面材质"
                value={s.material === "realistic" ? s.metalFinish : s.material}
                onChange={(e) => {
                  const value = e.target.value;
                  setPlaying(false);
                  setS((v) =>
                    value === "clay" || value === "glow"
                      ? { ...v, material: value }
                      : {
                          ...v,
                          material: "realistic",
                          metalFinish: value as Settings["metalFinish"],
                          metalRoughness: value === "steel" ? 20 : 34,
                        },
                  );
                }}
              >
                <option value="aluminum" disabled={s.style === "minimal"}>
                  阳极氧化铝
                </option>
                <option value="steel" disabled={s.style === "minimal"}>
                  抛光不锈钢
                </option>
                <option value="clay">Clay</option>
                <option value="glow">Glow</option>
              </Select>
            </div>
            <div className="inline-setting">
              <span>机身颜色</span>
              <div className="frame-colors">
                {frameColors.map(([c, name]) => (
                  <button
                    key={c}
                    title={name}
                    aria-label={`${name}机身`}
                    aria-pressed={s.frame === c}
                    className={s.frame === c ? "chosen" : ""}
                    style={{ background: c }}
                    onClick={() => update("frame", c)}
                  >
                    {s.frame === c && <Check size={11} />}
                  </button>
                ))}
                <CustomColorSlot
                  label="使用自定义机身色"
                  color={customColors.frame}
                  selected={s.frame === customColors.frame}
                  onSelect={() =>
                    customColors.frame && update("frame", customColors.frame)
                  }
                />
              </div>
            </div>
            <div className="inline-setting">
              <label htmlFor="body-color">自定义机身色</label>
              <input
                id="body-color"
                type="color"
                aria-label="自定义机身色"
                value={s.frame}
                onChange={(e) => customizeColor("frame", e.target.value)}
              />
            </div>
            <Slider
              label="金属粗糙度"
              value={s.metalRoughness}
              min={10}
              max={85}
              unit="%"
              onChange={(v) => update("metalRoughness", v)}
              disabled={s.material !== "realistic"}
            />
            <Slider
              label="环境对比度"
              value={s.environmentContrast}
              min={0}
              max={100}
              unit="%"
              onChange={(v) => update("environmentContrast", v)}
              disabled={s.material !== "realistic"}
            />
            <Slider
              label="悬浮阴影"
              value={s.shadow}
              min={0}
              max={100}
              unit="%"
              onChange={(v) => update("shadow", v)}
            />
            <Slider
              label="阴影距离"
              value={s.shadowDistance}
              min={0}
              max={100}
              unit="%"
              onChange={(v) => update("shadowDistance", v)}
            />
            <Slider
              label="玻璃反光"
              value={s.reflection}
              min={0}
              max={100}
              unit="%"
              onChange={(v) => update("reflection", v)}
              disabled={s.material !== "realistic"}
            />
            <Slider
              label="机身反光"
              value={s.bodyReflection}
              min={0}
              max={100}
              unit="%"
              onChange={(v) => update("bodyReflection", v)}
              disabled={s.material !== "realistic"}
            />
          </Section>
          <Section title="导出设置">
            <Toggle
              label="透明背景（仅样机）"
              value={s.transparentExport}
              onChange={() => update("transparentExport", !s.transparentExport)}
            />
          </Section>
        </aside>
        <main className="workspace">
          <div className="workspace-toolbar">
            <div className="canvas-label">
              <button
                className="icon-button sidebar-toggle"
                aria-label="显示或隐藏设置"
                onClick={() => setSideOpen(!sideOpen)}
              >
                <SlidersHorizontal size={16} />
              </button>
              <span className="canvas-icon">
                <Smartphone size={15} />
              </span>
              <select
                className="preview-device-select"
                aria-label="预览机型"
                value={s.device}
                onChange={(e) => update("device", e.target.value as DeviceId)}
              >
                {Object.entries(devices).map(([id, device]) => (
                  <option key={id} value={id}>
                    {device.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="toolbar-right">
              <label className="ratio-control">
                <Maximize size={13} />
                <select
                  aria-label="画布比例"
                  value={s.ratio}
                  onChange={(e) => update("ratio", e.target.value)}
                >
                  <option value="4:3">4 : 3</option>
                  <option value="1:1">1 : 1</option>
                  <option value="16:9">16 : 9</option>
                  <option value="3:4">3 : 4</option>
                  <option value="9:16">9 : 16</option>
                </select>
                <ChevronDown size={12} />
              </label>
              <button
                className="icon-button"
                title="重置所有设置"
                aria-label="重置所有设置"
                onClick={() => {
                  setPlaying(false);
                  setFrames([]);
                  setSelected(null);
                  clock.current = 0;
                  setTime(0);
                  setS({ ...initial });
                  ++uploads.current.bg;
                  if (urls.current.bg) URL.revokeObjectURL(urls.current.bg);
                  urls.current.bg = "";
                  setAssetIds((ids) => ({ ...ids, bg: null }));
                  setSelectedPose(0);
                  notify("已恢复默认构图与样式");
                }}
              >
                <RotateCcw size={15} />
              </button>
            </div>
          </div>
          <div className="canvas-area">
            <div
              className="artboard-wrap"
              style={{ "--ratio": dims[0] / dims[1] } as React.CSSProperties}
            >
              {restored && (
                <Viewport
                  key={s.device}
                  ref={viewport}
                  moveMode={moveMode}
                  onMove={(offsetX, offsetY) =>
                    setS((v) => ({
                      ...v,
                      offsetX: Math.round(offsetX * 10) / 10,
                      offsetY: Math.round(offsetY * 10) / 10,
                    }))
                  }
                  settings={s}
                  screenshot={screenshot}
                  mediaType={mediaType}
                  time={time}
                  playing={playing}
                  onRotate={(rx, ry) => {
                    setPlaying(false);
                    setS((v) => ({
                      ...v,
                      rx: Math.round(rx),
                      ry: Math.round(ry),
                    }));
                    setSelectedPose(-1);
                  }}
                  onZoom={(delta) =>
                    setS((v) => ({
                      ...v,
                      scale: Math.max(35, Math.min(150, v.scale + delta)),
                    }))
                  }
                  onDrop={(file) => upload(file, "screen")}
                  onError={notify}
                />
              )}
            </div>
          </div>
          <div className="workspace-bottom">
            <div className="interaction-hint">
              <button
                className={`canvas-tool ${!moveMode ? "active" : ""}`}
                aria-pressed={!moveMode}
                onClick={() => setMoveMode(false)}
              >
                旋转
              </button>
              <button
                className={`canvas-tool ${moveMode ? "active" : ""}`}
                aria-pressed={moveMode}
                onClick={() => setMoveMode(true)}
              >
                移动
              </button>
            </div>
            <div className="zoom-control">
              <button
                className="icon-button"
                aria-label="缩小模型"
                onClick={() => update("scale", Math.max(35, s.scale - 5))}
              >
                <Minus size={14} />
              </button>
              <button
                className="zoom-value"
                title="恢复默认缩放"
                onClick={() => update("scale", 90)}
              >
                {s.scale}%
              </button>
              <button
                className="icon-button"
                aria-label="放大模型"
                onClick={() => update("scale", Math.min(150, s.scale + 5))}
              >
                <Plus size={14} />
              </button>
            </div>
            <span className="export-dimensions">
              {exportW} × {exportH} px
            </span>
          </div>
          <Timeline
            time={time}
            duration={duration}
            playing={playing}
            loop={loop}
            frames={frames}
            selected={selected}
            onSeek={seek}
            onDuration={(d) => {
              if (frames.some((k) => k.time > d)) {
                notify("请先移动或删除超出新时长的关键帧。");
                return;
              }
              setDuration(d);
              seek(Math.min(time, d));
            }}
            onPlay={togglePlayback}
            onLoop={() => setLoop((v) => !v)}
            onAdd={addFrame}
            onSelect={(k) => {
              setSelected(k.id);
              seek(k.time);
            }}
            onChange={changeFrame}
            onDelete={() => {
              setFrames((v) => v.filter((k) => k.id !== selected));
              setSelected(null);
            }}
          />
        </main>
      </div>
      <input
        ref={screenInput}
        className="visually-hidden"
        type="file"
        accept="image/png,image/jpeg,image/webp,video/mp4,video/webm,video/quicktime"
        aria-label="上传屏幕截图"
        onChange={(e) => {
          if (e.target.files?.[0]) upload(e.target.files[0], "screen");
          e.target.value = "";
        }}
      />
      <input
        ref={bgInput}
        className="visually-hidden"
        type="file"
        accept="image/png,image/jpeg,image/webp"
        aria-label="上传背景图片"
        onChange={(e) => {
          if (e.target.files?.[0]) upload(e.target.files[0], "bg");
          e.target.value = "";
        }}
      />
      {exporting && (
        <div className="export-progress" role="status">
          正在导出，请保持页面可见… 动画以 30 fps 实时录制，无音轨。
        </div>
      )}
      {toast && (
        <div className="toast" role="status">
          <Check size={16} />
          {toast}
          <button
            className="icon-button"
            aria-label="关闭提示"
            onClick={() => setToast("")}
          >
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
