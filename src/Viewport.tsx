import { devices } from "./devices";
import { Vector2 } from "three";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import type { Settings } from "./types";
import { PhoneScene, demoScreen, loadImage, paintBackground } from "./scene";
import { LoaderCircle, ImagePlus, AlertCircle } from "lucide-react";
export interface ViewportHandle {
  exportPNG: (multiplier: number) => Promise<void>;
}
interface Props {
  settings: Settings;
  screenshot: string;
  onMove: (x: number, y: number) => void;
  moveMode: boolean;
  onRotate: (x: number, y: number) => void;
  onZoom: (delta: number) => void;
  onDrop: (file: File) => void;
  onError: (message: string) => void;
}
export const Viewport = forwardRef<ViewportHandle, Props>(function Viewport(
  { settings, screenshot, onRotate, onMove, moveMode, onZoom, onDrop, onError },
  ref,
) {
  const canvas = useRef<HTMLCanvasElement>(null),
    bg = useRef<HTMLCanvasElement>(null),
    host = useRef<HTMLDivElement>(null),
    engine = useRef<PhoneScene | null>(null),
    background = useRef<HTMLImageElement | null>(null),
    latest = useRef(settings);
  latest.current = settings;
  const [ready, setReady] = useState(false),
    [error, setError] = useState(""),
    [drag, setDrag] = useState(false);
  const pointer = useRef<{
    x: number;
    y: number;
    rx: number;
    ry: number;
    moving: boolean;
    ox: number;
    oy: number;
  } | null>(null);
  useEffect(() => {
    let destroyed = false;
    let ro: ResizeObserver;
    try {
      const p = new PhoneScene(canvas.current!, latest.current);
      engine.current = p;
      ro = new ResizeObserver(([e]) => {
        const { width, height } = e.contentRect;
        p.resize(width, height);
        bg.current!.width = Math.round(width * 2);
        bg.current!.height = Math.round(height * 2);
        paintBackground(
          bg.current!.getContext("2d")!,
          bg.current!.width,
          bg.current!.height,
          latest.current,
          background.current,
        );
      });
      ro.observe(host.current!);
      Promise.all([p.ready, demoScreen()])
        .then(([, c]) => {
          if (!destroyed) {
            if (!p.image) p.setImage(c);
            setReady(true);
          }
        })
        .catch(() => {
          if (!destroyed) setError("精细模型加载失败，请刷新重试。");
        });
    } catch {
      setError(
        "当前浏览器无法启动 3D 渲染。请开启硬件加速，或使用新版 Chrome / Safari。",
      );
    }
    return () => {
      destroyed = true;
      ro?.disconnect();
      engine.current?.dispose();
      engine.current = null;
    };
  }, []);
  useEffect(() => {
    engine.current?.update(settings);
    if (bg.current)
      paintBackground(
        bg.current.getContext("2d")!,
        bg.current.width,
        bg.current.height,
        settings,
        background.current,
      );
  }, [settings]);
  useEffect(() => {
    let canceled = false;
    if (!screenshot) return;
    loadImage(screenshot)
      .then((im) => {
        if (!canceled) engine.current?.setImage(im);
      })
      .catch((e) => onError(e.message));
    return () => {
      canceled = true;
    };
  }, [screenshot]);
  useEffect(() => {
    let canceled = false;
    if (!settings.bgImage) {
      background.current = null;
      return;
    }
    loadImage(settings.bgImage)
      .then((im) => {
        if (!canceled) {
          background.current = im;
          const b = bg.current!;
          paintBackground(
            b.getContext("2d")!,
            b.width,
            b.height,
            latest.current,
            im,
          );
        }
      })
      .catch((e) => onError(e.message));
    return () => {
      canceled = true;
    };
  }, [settings.bgImage]);
  useImperativeHandle(
    ref,
    () => ({
      async exportPNG(multiplier) {
        const p = engine.current;
        if (!p || !ready) throw new Error("样机还在加载，请稍后再试。");
        const [rw, rh] = latest.current.ratio.split(":").map(Number);
        const w = Math.round(1600 * multiplier * Math.min(1, rw / rh)),
          h = Math.round((w * rh) / rw);
        if (Math.max(w, h) > 8192)
          throw new Error("导出尺寸过大，请降低导出倍率。");
        const output = document.createElement("canvas");
        output.width = w;
        output.height = h;
        const ctx = output.getContext("2d")!;
        paintBackground(ctx, w, h, latest.current, background.current);
        const oldRatio = p.renderer.getPixelRatio();
        const size = p.renderer.getSize(new Vector2());
        try {
          p.renderer.setPixelRatio(1);
          p.resize(w, h);
          ctx.drawImage(p.renderer.domElement, 0, 0, w, h);
        } finally {
          p.renderer.setPixelRatio(oldRatio);
          p.resize(size.x, size.y);
        }
        await new Promise<void>((resolve, reject) =>
          output.toBlob((blob) => {
            if (!blob) {
              reject(new Error("导出失败，请重试。"));
              return;
            }
            const url = URL.createObjectURL(blob),
              a = document.createElement("a");
            a.href = url;
            a.download = `frame-studio-${latest.current.style}-${w}x${h}.png`;
            a.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            resolve();
          }, "image/png"),
        );
      },
    }),
    [ready],
  );
  return (
    <div
      ref={host}
      className={`artboard ${drag ? "drag-over" : ""}`}
      style={{ aspectRatio: settings.ratio.replace(":", "/") }}
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        if (e.dataTransfer.files[0]) onDrop(e.dataTransfer.files[0]);
      }}
      onWheel={(e) => onZoom(e.deltaY > 0 ? -2 : 2)}
    >
      <canvas ref={bg} className="background-canvas" aria-hidden="true" />
      <canvas
        ref={canvas}
        aria-label={`${devices[settings.device].name} 交互式样机，拖动旋转，Shift 加拖动移动，方向键微调`}
        tabIndex={0}
        className={`three-canvas ${moveMode ? "move-mode" : ""}`}
        onPointerDown={(e) => {
          pointer.current = {
            x: e.clientX,
            y: e.clientY,
            rx: settings.rx,
            ry: settings.ry,
            moving: moveMode || e.shiftKey,
            ox: settings.offsetX,
            oy: settings.offsetY,
          };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          const p = pointer.current;
          if (p?.moving) {
            const rect = e.currentTarget.getBoundingClientRect();
            onMove(
              Math.max(
                -45,
                Math.min(45, p.ox + ((e.clientX - p.x) / rect.width) * 100),
              ),
              Math.max(
                -45,
                Math.min(45, p.oy + ((e.clientY - p.y) / rect.height) * 100),
              ),
            );
          } else if (p)
            onRotate(
              Math.max(-180, Math.min(180, p.rx + (e.clientY - p.y) * 0.32)),
              Math.max(-180, Math.min(180, p.ry + (e.clientX - p.x) * 0.32)),
            );
        }}
        onPointerUp={() => {
          pointer.current = null;
        }}
        onPointerCancel={() => {
          pointer.current = null;
        }}
        onKeyDown={(e) => {
          if (
            ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)
          ) {
            e.preventDefault();
            if (e.shiftKey || moveMode) {
              onMove(
                Math.max(
                  -45,
                  Math.min(
                    45,
                    settings.offsetX +
                      (e.key === "ArrowLeft"
                        ? -1
                        : e.key === "ArrowRight"
                          ? 1
                          : 0),
                  ),
                ),
                Math.max(
                  -45,
                  Math.min(
                    45,
                    settings.offsetY +
                      (e.key === "ArrowUp"
                        ? -1
                        : e.key === "ArrowDown"
                          ? 1
                          : 0),
                  ),
                ),
              );
              return;
            }
            onRotate(
              Math.max(
                -180,
                Math.min(
                  180,
                  settings.rx +
                    (e.key === "ArrowUp" ? -2 : e.key === "ArrowDown" ? 2 : 0),
                ),
              ),
              Math.max(
                -180,
                Math.min(
                  180,
                  settings.ry +
                    (e.key === "ArrowLeft"
                      ? -2
                      : e.key === "ArrowRight"
                        ? 2
                        : 0),
                ),
              ),
            );
          }
        }}
      />
      {!ready && !error && (
        <div className="canvas-message">
          <LoaderCircle className="spin" size={20} />
          正在布置摄影棚…
        </div>
      )}
      {error && (
        <div className="canvas-message error">
          <AlertCircle />
          {error}
        </div>
      )}
      {drag && (
        <div className="drop-overlay">
          <ImagePlus size={32} />
          <span>松开，替换屏幕截图</span>
        </div>
      )}
    </div>
  );
});
