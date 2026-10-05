import { useRef } from "react";
import { CurveParameter } from "./CurveParameter";
import type { PointerEvent as ReactPointerEvent } from "react";
import {
  curves,
  ease,
  type Curve,
  type BezierCurve,
  type Keyframe,
} from "./animation";
import {
  Play,
  Pause,
  SkipBack,
  DiamondPlus,
  Trash2,
  Repeat2,
} from "lucide-react";
interface Props {
  time: number;
  duration: number;
  playing: boolean;
  loop: boolean;
  frames: Keyframe[];
  selected: string | null;
  onSeek(t: number): void;
  onDuration(t: number): void;
  onPlay(): void;
  onLoop(): void;
  onAdd(): void;
  onSelect(k: Keyframe): void;
  onChange(id: string, patch: Partial<Keyframe>): void;
  onDelete(): void;
}
export function Timeline(p: Props) {
  const selected = p.frames.find((k) => k.id === p.selected);
  const ordered = [...p.frames].sort((a, b) => a.time - b.time);
  const next = selected
    ? ordered[ordered.findIndex((k) => k.id === selected.id) + 1]
    : undefined;
  const interval = selected && next ? { start: selected, end: next } : null;
  const curve = interval?.start.curve ?? curves["平滑进出"];
  const points = Array.from({ length: 101 }, (_, i) => ease(i / 100, curve));
  const low = Math.min(0, ...points),
    high = Math.max(1, ...points);
  const y = (v: number) => 80 - ((v - low) / (high - low)) * 70;
  const graph = points
    .map((v, i) => `${i ? "L" : "M"}${10 + i} ${y(v)}`)
    .join(" ");
  const setCurve = (c: Curve) =>
    interval && p.onChange(interval.start.id, { curve: c });
  const gesture = useRef<{
    pointerId: number;
    startX: number;
    moved: boolean;
    frameId?: string;
    segmentId?: string;
    time?: number;
  } | null>(null);
  const snap = (t: number) =>
    Math.max(0, Math.min(p.duration, Math.round(t * 10) / 10));
  const pointerTime = (e: ReactPointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return snap(((e.clientX - rect.left) / rect.width) * p.duration);
  };
  const ticks = Array.from(
    { length: Math.floor(p.duration * 2) + 1 },
    (_, i) => i * 0.5,
  );
  if (ticks[ticks.length - 1] !== p.duration) ticks.push(p.duration);
  return (
    <section className="timeline" aria-label="动画时间轴">
      <div className="timeline-toolbar">
        <strong>动画时间轴</strong>
        <button
          className="icon-button"
          aria-label="回到起点"
          onClick={() => p.onSeek(0)}
        >
          <SkipBack size={15} />
        </button>
        <button
          className="icon-button"
          title="空格：播放 / 暂停"
          aria-keyshortcuts="Space"
          aria-label={p.playing ? "暂停" : "播放"}
          onClick={p.onPlay}
        >
          {p.playing ? <Pause size={16} /> : <Play size={16} />}
        </button>
        <button
          className={`icon-button ${p.loop ? "active" : ""}`}
          aria-label="循环播放"
          aria-pressed={p.loop}
          onClick={p.onLoop}
        >
          <Repeat2 size={16} />
        </button>
        <output aria-label="当前时间">{p.time.toFixed(2)} s</output>
        <label>
          时长{" "}
          <input
            aria-label="动画时长"
            type="number"
            min={1}
            max={60}
            step={0.5}
            value={p.duration}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (n >= 1 && n <= 60) p.onDuration(Math.round(n * 2) / 2);
            }}
          />{" "}
          s
        </label>
        <button className="timeline-add" onClick={p.onAdd}>
          <DiamondPlus size={14} />{" "}
          {p.frames.some((k) => Math.abs(k.time - p.time) < 0.025)
            ? "更新关键帧"
            : "添加关键帧"}
        </button>
      </div>
      <div className="timeline-body">
        <div className="timeline-tracks">
          <div className="timeline-scroll">
            <div
              className="timeline-surface"
              style={{ minWidth: p.duration * 100 }}
              aria-label="时间轴拖动区域"
              onPointerDown={(e) => {
                if (e.button !== 0) return;
                e.preventDefault();
                const target = e.target as HTMLElement;
                const frameId =
                  target.closest<HTMLElement>("[data-keyframe]")?.dataset
                    .keyframe;
                const segmentId =
                  target.closest<HTMLElement>("[data-segment]")?.dataset
                    .segment;
                gesture.current = {
                  pointerId: e.pointerId,
                  startX: e.clientX,
                  moved: false,
                  frameId,
                  segmentId,
                };
                e.currentTarget.setPointerCapture(e.pointerId);
                if (!frameId && !segmentId) {
                  e.currentTarget
                    .querySelector<HTMLElement>('[role="slider"]')
                    ?.focus({ preventScroll: true });
                  p.onSeek(pointerTime(e));
                }
              }}
              onPointerMove={(e) => {
                const g = gesture.current;
                if (!g || g.pointerId !== e.pointerId) return;
                if (Math.abs(e.clientX - g.startX) > 3) g.moved = true;
                if (!g.moved) return;
                g.time = pointerTime(e);
                if (g.frameId) p.onChange(g.frameId, { time: g.time });
                else p.onSeek(g.time);
              }}
              onPointerUp={(e) => {
                const g = gesture.current;
                if (!g || g.pointerId !== e.pointerId) return;
                if (g.frameId || (!g.moved && g.segmentId)) {
                  const frame = p.frames.find(
                    (k) => k.id === (g.frameId ?? g.segmentId),
                  );
                  if (frame) p.onSelect(frame);
                }
                gesture.current = null;
                e.currentTarget.releasePointerCapture(e.pointerId);
              }}
              onPointerCancel={() => {
                gesture.current = null;
              }}
              onLostPointerCapture={() => {
                gesture.current = null;
              }}
            >
              <div
                className="time-ruler"
                role="slider"
                tabIndex={0}
                aria-label="时间轴播放头"
                aria-valuemin={0}
                aria-valuemax={p.duration}
                aria-valuenow={p.time}
                aria-valuetext={`${p.time.toFixed(2)} 秒`}
                onKeyDown={(e) => {
                  const next =
                    e.key === "ArrowLeft"
                      ? snap(p.time - 0.1)
                      : e.key === "ArrowRight"
                        ? snap(p.time + 0.1)
                        : e.key === "Home"
                          ? 0
                          : e.key === "End"
                            ? p.duration
                            : null;
                  if (next !== null) {
                    e.preventDefault();
                    p.onSeek(next);
                  }
                }}
              >
                {ticks.map((t, i) => (
                  <span
                    key={t}
                    style={{
                      left: `${(t / p.duration) * 100}%`,
                      transform:
                        i === 0
                          ? "none"
                          : i === ticks.length - 1
                            ? "translateX(-100%)"
                            : "translateX(-50%)",
                    }}
                  >
                    {t.toFixed(1)}s
                  </span>
                ))}
              </div>
              <div
                className="keyframe-track"
                aria-label="构图关键帧轨道"
                style={{ backgroundSize: `${50 / p.duration}% 100%` }}
              >
                {ordered.slice(0, -1).map((k, i) => (
                  <button
                    key={`interval-${k.id}`}
                    data-segment={k.id}
                    className={`transition-segment ${interval?.start.id === k.id ? "active" : ""}`}
                    style={{
                      left: `${(k.time / p.duration) * 100}%`,
                      width: `${((ordered[i + 1].time - k.time) / p.duration) * 100}%`,
                    }}
                    aria-label={`过渡区间 ${k.time.toFixed(2)} 到 ${ordered[i + 1].time.toFixed(2)} 秒`}
                    aria-pressed={interval?.start.id === k.id}
                    onClick={(e) => {
                      if (e.detail === 0) p.onSelect(k);
                    }}
                    title="点击编辑曲线，拖动定位"
                  >
                    {Object.keys(curves).find(
                      (name) =>
                        JSON.stringify(curves[name]) ===
                        JSON.stringify(k.curve),
                    ) ?? "自定义"}
                  </button>
                ))}
                <i
                  className="playhead"
                  style={{ left: `${(p.time / p.duration) * 100}%` }}
                />
                {p.frames.map((k) => (
                  <button
                    key={k.id}
                    data-keyframe={k.id}
                    className={`keyframe ${k.id === p.selected ? "selected" : ""}`}
                    style={{ left: `${(k.time / p.duration) * 100}%` }}
                    aria-label={`关键帧 ${k.time.toFixed(2)} 秒`}
                    title="拖动移动关键帧"
                    onClick={(e) => {
                      if (e.detail === 0) p.onSelect(k);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
                        e.preventDefault();
                        e.stopPropagation();
                        p.onChange(k.id, {
                          time: snap(
                            k.time + (e.key === "ArrowRight" ? 0.1 : -0.1),
                          ),
                        });
                      }
                    }}
                  >
                    ◆
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="curve-editor">
          <svg viewBox="0 0 120 90" aria-label="动画曲线预览">
            <path
              d={`M10 ${y(1)}H110 M10 ${y(0)}H110`}
              fill="none"
              stroke="currentColor"
              opacity=".2"
            />
            <path d={graph} fill="none" stroke="currentColor" strokeWidth="2" />
          </svg>
          <div>
            <p className="interval-label">
              {interval
                ? `区间 ${interval.start.time.toFixed(2)} → ${interval.end.time.toFixed(2)} s`
                : ordered.length < 2
                  ? "无过渡区间"
                  : "无后续区间"}
            </p>
            <select
              aria-label="动画曲线"
              disabled={!interval}
              value={
                Object.keys(curves).find(
                  (k) => JSON.stringify(curves[k]) === JSON.stringify(curve),
                ) ?? "自定义"
              }
              onChange={(e) => setCurve(curves[e.target.value])}
            >
              {Object.keys(curves).map((k) => (
                <option key={k}>{k}</option>
              ))}
              <option value="自定义" disabled>
                自定义
              </option>
            </select>
            <div
              className="curve-values"
              key={`${interval?.start.id ?? "none"}-${Array.isArray(curve) ? "bezier" : "spring"}`}
            >
              {Array.isArray(curve) ? (
                curve.map((v, i) => (
                  <CurveParameter
                    key={i}
                    label={["X1", "Y1", "X2", "Y2"][i]}
                    name={`曲线 ${["X1", "Y1", "X2", "Y2"][i]}`}
                    value={v}
                    min={i % 2 === 0 ? 0 : -1}
                    max={i % 2 === 0 ? 1 : 2}
                    step={0.01}
                    disabled={!interval}
                    onChange={(value) => {
                      const c = [...curve] as BezierCurve;
                      c[i] = value;
                      setCurve(c);
                    }}
                  />
                ))
              ) : (
                <>
                  <CurveParameter
                    label="阻尼"
                    name="弹性阻尼"
                    value={curve.damping}
                    min={3}
                    max={12}
                    step={0.1}
                    disabled={!interval}
                    onChange={(damping) => setCurve({ ...curve, damping })}
                  />
                  <CurveParameter
                    label="振荡"
                    name="弹性振荡"
                    value={curve.frequency}
                    min={1}
                    max={4}
                    step={0.05}
                    disabled={!interval}
                    onChange={(frequency) => setCurve({ ...curve, frequency })}
                  />
                </>
              )}
            </div>
            <div className="keyframe-edit">
              <label>
                帧时间{" "}
                <input
                  aria-label="关键帧时间"
                  disabled={!selected}
                  type="number"
                  step={0.1}
                  min={0}
                  max={p.duration}
                  value={selected?.time ?? 0}
                  onChange={(e) =>
                    selected &&
                    p.onChange(selected.id, {
                      time: snap(Number(e.target.value)),
                    })
                  }
                />
              </label>
              <button
                className="icon-button"
                aria-label="删除关键帧"
                disabled={!selected}
                onClick={p.onDelete}
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
