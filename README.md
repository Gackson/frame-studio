# Frame Studio

浏览器里的 iPhone 17 Pro Max 样机工作台。React + TypeScript + Vite + Three.js，无后端。

## 启动

```sh
npm install
npm run dev -- --host 127.0.0.1 --port 5188
```

生产构建：`npm run build`。将 `dist/` 部署到任意静态托管服务。

## 使用

- 上传 PNG / JPG / WebP 截图，也可以拖入画布；图片完全在本地处理。
- 拖动手机进行三轴中的俯仰和水平旋转，侧栏调整画面倾斜、相机视角、模型大小。
- 摄影模式：PBR 金属机身、环境照明、玻璃反光、透视相机。
- 2.5D 简约模式：低金属度哑光材质、无玻璃反光、正交相机。正交投影没有透视畸变，因此此模式的透视滑块禁用。
- 支持纯色、双颜色渐变、上传图片背景，以及五种画布比例。
- PNG 导出 1× / 2× / 3×，最长边分别为 1600 / 3200 / 4800 px，默认包含背景和阴影；勾选透明背景后仅导出样机。
- 数字输入、键盘方向键和原生范围控件可操作角度。

- 按住 Shift 拖动可移动手机，或在画布下方切换“移动”；滚轮仍用于缩放。选择角度预设或重置时，位置也回到中心。
- 机身反光与玻璃反光独立调节；不再叠加可切换的灵动岛模型。
- UI 色调随背景配色变化；图片背景使用平均色。
- 截图纹理保留原图分辨率（受 GPU 和 8192 边长限制），开启最大各向异性过滤和高分屏渲染。

## 模型与素材

现在使用 **Taufiq K 的 iPhone 17 Pro Max 现成 GLB 模型**（CC BY 4.0），约 3 万三角面、2.1 MB。保留原始镜组、侧键、接口、接缝和机身网格；不再使用原先的程序化简化模型。

模型采用 Origami 公开署名的 glTF 转换版本。本项目更换屏幕 UV 和显示材质，校准金属、玻璃与镜头，统一模型坐标。完整来源和许可说明在 `public/models/ATTRIBUTION.md`，界面底部也有署名入口。

另提供 polyman Studio 的独立 iPhone 15 Pro Max 模型（CC BY 4.0）和基于 17 Pro Max 网格的 17 Pro 尺寸适配版。后者并非独立精确模型。详见模型署名文件。

屏幕采用发光 OLED 内容加 MeshPhysicalMaterial 的介电反射，反光来自 PMREM 摄影棚环境，随观察角度变化。黑色边框为非金属低反射材质，不再叠加原来的固定渐变玻璃层。简约模式关闭屏幕反射。

- 原作者及模型：https://sketchfab.com/3d-models/iphone-17-pro-max-e7c5674931ae4b0ea1b4eaaabb159fdb
- 许可：https://creativecommons.org/licenses/by/4.0/
- GLB 分发来源：https://origami.ltd/models/product/iphone-17-pro-max.glb
- Three.js（MIT）：https://threejs.org/ 。复用 RoomEnvironment / PMREM 和原生几何、材质、相机。
- Lucide（ISC）：https://lucide.dev/
- 示例摄影：Unsplash https://images.unsplash.com/photo-1470770841072-f978cf4d019e （图片资源 photo-1470770841072-f978cf4d019e）。仅用于内置示例。
- 示例屏幕由 Canvas 绘制，为虚构旅行应用。

当前编辑状态仅保留在本次页面会话中，刷新会重置。上传图片最大 25 MB、6400 万像素。需要支持 WebGL 2 的现代浏览器。
