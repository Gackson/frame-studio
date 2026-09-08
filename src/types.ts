import type { DeviceId } from "./devices";
export type Style = "photo" | "minimal";
export type Background = "gradient" | "solid" | "image";
export interface Settings {
  device: DeviceId;
  offsetX: number;
  offsetY: number;
  style: Style;
  rx: number;
  ry: number;
  rz: number;
  perspective: number;
  scale: number;
  bgType: Background;
  color1: string;
  color2: string;
  gradientAngle: number;
  bgImage: string;
  frame: string;
  shadow: number;
  reflection: number;
  island: boolean;
  fit: "cover" | "contain";
  ratio: string;
}
export const initial: Settings = {
  device: "17-pro-max",
  offsetX: 0,
  offsetY: 0,
  style: "photo",
  rx: -9,
  ry: -22,
  rz: 10,
  perspective: 35,
  scale: 90,
  bgType: "gradient",
  color1: "#dfe9dd",
  color2: "#a4b6a3",
  gradientAngle: 140,
  bgImage: "",
  frame: "#e7e8e4",
  shadow: 35,
  reflection: 45,
  island: true,
  fit: "cover",
  ratio: "4:3",
};
export const palettes = [
  ["#dfe9dd", "#a4b6a3"],
  ["#ede8df", "#c7b8a7"],
  ["#e0e1f0", "#aaa5c6"],
  ["#e8d8d0", "#c59987"],
  ["#dae7ee", "#98b8c5"],
  ["#444b49", "#202a29"],
];
export const poses = [
  { name: "经典视角", rx: -9, ry: -22, rz: 10 },
  { name: "正面展示", rx: 0, ry: 0, rz: 0 },
  { name: "轻盈悬浮", rx: 18, ry: 28, rz: -18 },
  { name: "俯瞰视角", rx: 38, ry: -20, rz: 28 },
];
