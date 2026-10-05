import { test } from "node:test";
import assert from "node:assert/strict";
import { sample, ease, capturePose, curves } from "../src/animation.ts";
const pose = (v) => ({
  rx: v,
  ry: v,
  rz: v,
  offsetX: v,
  offsetY: v,
  scale: 90 + v,
  perspective: 35 + v,
});
const frame = (time, v, curve = curves["线性"]) => ({
  id: String(time),
  time,
  pose: pose(v),
  curve,
});
test("empty track and out-of-range times hold correct values", () => {
  assert.equal(sample([], 0), null);
  const frames = [frame(4, 80), frame(1, 0)];
  assert.deepEqual(sample(frames, -1), pose(0));
  assert.deepEqual(sample(frames, 6), pose(80));
  assert.deepEqual(sample([frame(3, 20)], 0), pose(20));
  assert.equal(frames[0].time, 4);
});
test("all composition channels interpolate with the outgoing frame curve", () => {
  const midpoint = sample([frame(0, 0), frame(4, 80)], 2);
  for (const [key, value] of Object.entries(pose(40)))
    assert(Math.abs(midpoint[key] - value) < 0.0001);
  const eased = sample([frame(0, 0, curves["缓入"]), frame(4, 80)], 2);
  assert(eased.ry > 20 && eased.ry < 30);
  assert.deepEqual(sample([frame(0, 0), frame(4, 80)], 4), pose(80));
});
test("bezier endpoints and monotonicity are stable, including degenerate handles", () => {
  for (const curve of [
    ...Object.values(curves).filter(Array.isArray),
    [0, 0, 0, 1],
    [1, 0, 1, 1],
  ]) {
    assert.equal(ease(0, curve), 0);
    assert.equal(ease(1, curve), 1);
    let prev = 0;
    for (let i = 1; i <= 100; i++) {
      const value = ease(i / 100, curve);
      assert(value >= prev);
      assert(value >= 0 && value <= 1);
      prev = value;
    }
  }
});
test("pose capture snapshots animation channels only", () => {
  const settings = { ...pose(3), device: "iphone-air", color1: "#fff" };
  const captured = capturePose(settings);
  settings.rx = 100;
  assert.deepEqual(captured, pose(3));
  assert(!("device" in captured));
});

test("spring interpolates the delta within one interval, overshoots and settles exactly", () => {
  const spring = curves["弹性回弹"];
  const frames = [frame(0, 10, spring), frame(2, 30), frame(4, 50)];
  assert.deepEqual(sample(frames, 0), pose(10));
  assert.deepEqual(sample(frames, 2), pose(30));
  const values = Array.from(
    { length: 201 },
    (_, i) => sample(frames, i / 100).ry,
  );
  assert(Math.max(...values) > 30);
  assert(values.slice(40).some((v, i, a) => i && v < a[i - 1]));
  assert(
    Math.abs(sample(frames, 3).ry - 40) < 0.0001,
    "next interval keeps its own linear curve",
  );
  const t = 0.3,
    e = ease(t, spring);
  assert(Math.abs(sample(frames, t * 2).ry - (10 + 20 * e)) < 1e-9);
});
test("spring controls produce finite endpoints and preserve constant channels", () => {
  for (const damping of [3, 8, 12])
    for (const frequency of [1, 2.5, 4]) {
      const curve = { type: "spring", damping, frequency };
      assert.equal(ease(0, curve), 0);
      assert.equal(ease(1, curve), 1);
      for (let i = 0; i <= 100; i++)
        assert(Number.isFinite(ease(i / 100, curve)));
    }
  assert.deepEqual(
    sample([frame(0, 0, curves["弹性轻柔"]), frame(1, 0)], 0.4),
    pose(0),
  );
  assert.notEqual(
    ease(0.2, { type: "spring", damping: 3, frequency: 2 }),
    ease(0.2, { type: "spring", damping: 12, frequency: 2 }),
  );
});

test("rotation keeps signed full turns across ±180 and multiple revolutions", () => {
  const a = frame(0, 0),
    b = frame(2, 0);
  a.pose = { ...a.pose, rx: 175, ry: -175, rz: 0 };
  b.pose = { ...b.pose, rx: 185, ry: -185, rz: 720 };
  const middle = sample([a, b], 1);
  assert(Math.abs(middle.rx - 180) < 1e-4);
  assert(Math.abs(middle.ry + 180) < 1e-4);
  assert(Math.abs(middle.rz - 360) < 1e-4);
  assert.equal(sample([a, b], 2).rz, 720);
});
