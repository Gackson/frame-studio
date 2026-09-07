# Frame Studio

浏览器里的 iPhone 17 样机工作台。React + TypeScript + Vite + Three.js，无后端。

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
- PNG 导出 1× / 2× / 3×，最长边分别为 1600 / 3200 / 4800 px，包含背景和阴影。
- 数字输入、键盘方向键和原生范围控件可操作角度。

## 模型与素材

这是按 iPhone 17 外形比例程序化构建的轻量展示模型，包含圆角机身、侧键、双摄与灵动岛，并非 Apple 官方 CAD，也不是离线路径追踪级渲染。尺寸参考 Apple 官方规格：71.5 × 149.6 × 7.95 mm。

- Apple 规格：https://www.apple.com/iphone-17/specs/
- Three.js（MIT）：https://threejs.org/ 。复用 RoomEnvironment / PMREM 和原生几何、材质、相机。
- Lucide（ISC）：https://lucide.dev/
- 示例摄影：Unsplash https://unsplash.com/photos/aerial-photography-of-lake-surrounded-by-trees-and-mountains-4ulffa5pD08 （图片资源 photo-1470770841072-f978cf4d019e）。仅用于内置示例。
- 示例屏幕由 Canvas 绘制，为虚构旅行应用。

当前编辑状态仅保留在本次页面会话中，刷新会重置。上传图片最大 25 MB、6400 万像素。需要支持 WebGL 2 的现代浏览器。
