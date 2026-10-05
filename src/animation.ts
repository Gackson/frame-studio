import type { Settings } from "./types";
export const animatedKeys = [
  "rx",
  "ry",
  "rz",
  "offsetX",
  "offsetY",
  "scale",
  "perspective",
] as const;
export type Pose = Pick<Settings, (typeof animatedKeys)[number]>;
/** Choose a preset's nearest equivalent orientation without discarding full turns. */
export function nearestAngle(angle: number, reference: number) {
  return angle + 360 * Math.round((reference - angle) / 360);
}
export type BezierCurve = [number, number, number, number];
export interface SpringCurve {
  type: "spring";
  damping: number;
  frequency: number;
}
export type Curve = BezierCurve | SpringCurve;
export interface Keyframe {
  id: string;
  time: number;
  pose: Pose;
  curve: Curve;
}
export const curves: Record<string, Curve> = {
  线性: [0, 0, 1, 1],
  平滑进出: [0.42, 0, 0.58, 1],
  缓入: [0.42, 0, 1, 1],
  缓出: [0, 0, 0.58, 1],
  弹性轻柔: { type: "spring", damping: 8, frequency: 1.5 },
  弹性回弹: { type: "spring", damping: 5, frequency: 2.5 },
};
export function capturePose(s: Settings): Pose {
  return Object.fromEntries(animatedKeys.map((k) => [k, s[k]])) as Pose;
}
export function ease(t: number, curve: Curve) {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  if (!Array.isArray(curve)) {
    const damping = Math.max(3, Math.min(12, curve.damping));
    const w = Math.max(1, Math.min(4, curve.frequency)) * Math.PI * 2;
    const response = (v: number) =>
      1 -
      Math.exp(-damping * v) *
        (Math.cos(w * v) + (damping / w) * Math.sin(w * v));
    // Normalize the damped response so the interval meets both keyframes exactly.
    return response(t) / response(1);
  }
  const [x1, y1, x2, y2] = curve;
  const cubic = (v: number, a: number, b: number) =>
    3 * (1 - v) ** 2 * v * a + 3 * (1 - v) * v * v * b + v ** 3;
  let lo = 0,
    hi = 1;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (cubic(mid, x1, x2) < t) lo = mid;
    else hi = mid;
  }
  return cubic((lo + hi) / 2, y1, y2);
}
export function sample(frames: Keyframe[], time: number): Pose | null {
  const sorted = [...frames].sort((a, b) => a.time - b.time);
  if (!sorted.length) return null;
  if (time <= sorted[0].time) return sorted[0].pose;
  for (let i = 1; i < sorted.length; i++) {
    const a = sorted[i - 1],
      b = sorted[i];
    if (time <= b.time) {
      const t = ease((time - a.time) / (b.time - a.time), a.curve);
      const pose = Object.fromEntries(
        animatedKeys.map((k) => [k, a.pose[k] + (b.pose[k] - a.pose[k]) * t]),
      ) as Pose;
      // Overshoot is intentional; only constrain values that could invert geometry
      // or make the perspective camera invalid.
      pose.scale = Math.max(1, pose.scale);
      pose.perspective = Math.max(1, Math.min(120, pose.perspective));
      return pose;
    }
  }
  return sorted[sorted.length - 1].pose;
}
