import type { DeviceId } from "./devices";
export type Style = "photo" | "minimal";
export type MaterialStyle = "realistic" | "clay" | "glow";
export interface CustomColors {
  solid: string | null;
  gradient: { color1: string; color2: string; angle: number } | null;
  frame: string | null;
}
export type Background = "gradient" | "solid" | "image";
export interface Settings {
  device: DeviceId;
  offsetX: number;
  offsetY: number;
  style: Style;
  material: MaterialStyle;
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
  shadowDistance: number;
  reflection: number;
  bodyReflection: number;
  metalRoughness: number;
  environmentContrast: number;
  metalFinish: "aluminum" | "steel";
  transparentExport: boolean;
  fit: "cover" | "contain";
  ratio: string;
}
export const initial: Settings = {
  device: "17-pro-max",
  offsetX: 0,
  offsetY: 0,
  style: "photo",
  material: "realistic",
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
  shadowDistance: 45,
  reflection: 20,
  bodyReflection: 60,
  metalRoughness: 34,
  environmentContrast: 55,
  metalFinish: "aluminum",
  transparentExport: false,
  fit: "cover",
  ratio: "1:1",
};
export const palettes = [
  ["#dfe9dd", "#a4b6a3"],
  ["#ede8df", "#c7b8a7"],
  ["#e0e1f0", "#aaa5c6"],
  ["#e8d8d0", "#c59987"],
  ["#dae7ee", "#98b8c5"],
  ["#444b49", "#202a29"],
];
export const frameColors = [
  ["#c9cebc", "鼠尾草"],
  ["#dad6e6", "薰衣草"],
  ["#b7d2e6", "雾蓝"],
  ["#e7e8e4", "白色"],
  ["#454946", "黑色"],
];
// Each preset is a complete composition, so applying it never inherits the
// previous preset's zoom, offset or perspective when building a keyframe.
export const poses = [
  { name: "经典视角", rx: -9, ry: -22, rz: 10, scale: 90, perspective: 35 },
  { name: "正面展示", rx: 0, ry: 0, rz: 0, scale: 90, perspective: 35 },
  { name: "轻盈悬浮", rx: 18, ry: 28, rz: -18, scale: 90, perspective: 35 },
  { name: "俯瞰视角", rx: 38, ry: -20, rz: 28, scale: 90, perspective: 35 },
  { name: "侧立向左", rx: 0, ry: -35, rz: 0, scale: 100, perspective: 35 },
  { name: "侧立向右", rx: 0, ry: 35, rz: 0, scale: 100, perspective: 35 },
  { name: "正面放大", rx: 0, ry: 0, rz: 0, scale: 135, perspective: 28 },
  { name: "正面远景", rx: 0, ry: 0, rz: 0, scale: 65, perspective: 35 },
  { name: "垂直俯视", rx: 48, ry: 0, rz: 0, scale: 105, perspective: 45 },
  { name: "低位仰视", rx: -35, ry: 15, rz: 0, scale: 105, perspective: 45 },
  { name: "横向平放", rx: 22, ry: -12, rz: 90, scale: 100, perspective: 35 },
  { name: "斜向平躺", rx: 62, ry: -18, rz: 35, scale: 110, perspective: 40 },
  { name: "左侧轮廓", rx: 0, ry: -72, rz: 0, scale: 100, perspective: 35 },
  { name: "右侧轮廓", rx: 0, ry: 72, rz: 0, scale: 100, perspective: 35 },
  { name: "背面展示", rx: 0, ry: 180, rz: 0, scale: 95, perspective: 35 },
  { name: "背面倾斜", rx: 15, ry: 150, rz: -12, scale: 100, perspective: 35 },
].map((p) => ({ ...p, offsetX: 0, offsetY: 0 }));
