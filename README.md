# hosepen - ComfyUI实时绘画插件

🐎 在 ComfyUI 中随时打开画板进行实时绘画！

## 简介

hosepen 是一个轻量级的 ComfyUI 插件，提供实时绘画功能和图像导入导出节点。无需额外依赖，开箱即用。

## 核心功能

- 🐎 **悬浮按钮** - 右下角可拖拽的马图标，随时打开画板
- 🎨 **实时绘画** - 白色背景的画板，支持自由绘画
- 🌈 **颜色选择** - 自由选择画笔颜色
- 📏 **粗细调节** - 调节画笔粗细（1-20px）
- 💾 **保存功能** - 将绘画保存为PNG图片到ComfyUI输入目录
- 🗑️ **清空画布** - 一键清空重新绘画
- 📋 **剪贴板支持** - Ctrl+V 粘贴图像，Ctrl+C 复制图像
- 📥 **图像导入** - 从其他节点导入图像到画板
- 📤 **图像导出** - 从画板导出图像到工作流

## 安装

将插件放到 ComfyUI 的 `custom_nodes` 目录下，重启即可。

```bash
cd ComfyUI/custom_nodes
git clone https://github.com/yourusername/comfy_hosepen.git
```

或手动下载后解压到 `custom_nodes/comfy_hosepen` 目录。

## 使用

### 浮动画板

1. **打开画板**：点击右下角 🐎 按钮
2. **选择颜色**：点击颜色选择器选择画笔颜色
3. **调节粗细**：拖动滑块调节画笔粗细
4. **开始绘画**：在白色画布上自由绘画
5. **保存作品**：点击"💾 保存"按钮，图片会保存到 `ComfyUI/input/hosepen/` 目录
6. **清空画布**：点击"🗑️ 清空"按钮清空画布

### 快捷键

#### 工具切换
- **B** - 画笔模式 🖌️
- **E** - 橡皮擦模式 🧹
- **V** - 移动模式 🔄
- **T** - 缩放模式 📏
- **R** - 旋转模式 🔄

#### 操作快捷键
- **Space** - 按住空格键进入平移模式（拖动画布）
- **Ctrl + V** - 从剪贴板粘贴图像 📋
- **Ctrl + C** - 复制图像到剪贴板 📄
- **Ctrl + Z** - 撤销
- **Ctrl + Y** 或 **Ctrl + Shift + Z** - 重做
- **Ctrl + 0** - 重置视图
- **ESC** - 关闭画板窗口

### 图层操作

#### 多图层选择
- **单击复选框** - 选中/取消选中单个图层
- **Ctrl + 单击复选框** - 多选图层（可同时选中多个图层）
- **选中多个图层后** - 可以同时对多个图层进行变换操作（移动、缩放、旋转、镜像等）

#### 图层管理
- **➕ 新建图层** - 创建新的空白图层
- **🗑️ 删除图层** - 删除选中的图层
- **👁️ 显示/隐藏** - 切换图层可见性
- **透明度滑块** - 调节图层透明度（0-100%）
- **拖拽排序** - 拖动图层项可调整图层顺序

### ComfyUI节点

插件提供三个节点，位于 `hosepen` 分类下：

#### 1. Hosepen Drawing
占位节点，用于标识 hosepen 功能。

#### 2. Hosepen Image Input
将工作流中的图像导入到画板：
- **输入**：`images` (IMAGE) - 任意图像节点的输出
- **功能**：将图像发送到画板，可在画板上继续编辑

#### 3. Hosepen Image Output
从画板导出图像到工作流：
- **输出**：`image` (IMAGE) - 可连接到任意图像处理节点
- **功能**：加载 `input/hosepen/` 目录中保存的图像
- **选择**：可从下拉列表选择已保存的图像文件

## 工作流示例

```
LoadImage → HosepenImageInput → (在画板编辑) → 保存
                                                    ↓
                                          HosepenImageOutput → SaveImage
```

## 特性

- ✨ **流畅绘画** - 实时响应，流畅的绘画体验
- 🎯 **精确控制** - 可调节画笔粗细和颜色
- 📱 **拖拽移动** - 按钮和窗口都可以拖拽移动
- 💫 **美观界面** - 现代化的UI设计，白色背景清爽舒适
- 🔄 **工作流集成** - 无缝集成到 ComfyUI 工作流中
- 💾 **自动保存** - 图像自动保存到指定目录，便于管理

## 文件结构

```
comfy_hosepen/
├── __init__.py          # 插件入口和路由注册
├── nodes.py             # ComfyUI节点定义
├── server.py            # 服务端API
├── web/
│   └── hosepen.js       # 前端画板界面
└── README.md
```

## 更新日志

### v1.0.0 (2024-11-24)
- 初始版本发布
- 支持实时绘画功能
- 支持颜色和粗细调节
- 支持保存和清空画布
- 窗口和按钮可拖拽移动
- 提供图像导入导出节点
- 集成到 ComfyUI 工作流

## 许可证

MIT License

- **个人使用**：完全免费
- **商用平台方和机构**：使用本插件需通知作者

## 联系方式

- **邮箱**：15734666@qq.com
- **B站**：蓝波球的球

---

**Made with 🐎 by Horse Team**

---

# hosepen - ComfyUI Real-time Drawing Plugin

🐎 Open a drawing board anytime in ComfyUI for real-time drawing!

## Introduction

hosepen is a lightweight ComfyUI plugin that provides real-time drawing functionality and image import/export nodes. No extra dependencies required, ready to use out of the box.

## Core Features

- 🐎 **Floating Button** - Draggable horse icon in the bottom-right corner, open the canvas anytime
- 🎨 **Real-time Drawing** - White background canvas for free drawing
- 🌈 **Color Picker** - Choose any brush color
- 📏 **Size Adjustment** - Adjust brush size (1-20px)
- 💾 **Save Function** - Save drawings as PNG images to ComfyUI input directory
- 🗑️ **Clear Canvas** - Clear canvas with one click
- 📋 **Clipboard Support** - Ctrl+V to paste images, Ctrl+C to copy images
- 📥 **Image Import** - Import images from other nodes to the canvas
- 📤 **Image Export** - Export images from canvas to workflow

## Installation

Place the plugin in ComfyUI's `custom_nodes` directory and restart.

```bash
cd ComfyUI/custom_nodes
git clone https://github.com/yourusername/comfy_hosepen.git
```

Or manually download and extract to `custom_nodes/comfy_hosepen` directory.

## Usage

### Floating Canvas

1. **Open Canvas**: Click the 🐎 button in the bottom-right corner
2. **Choose Color**: Click the color picker to select brush color
3. **Adjust Size**: Drag the slider to adjust brush size
4. **Start Drawing**: Draw freely on the white canvas
5. **Save Work**: Click "💾 Save" button, images will be saved to `ComfyUI/input/hosepen/` directory
6. **Clear Canvas**: Click "🗑️ Clear" button to clear canvas

### Keyboard Shortcuts

#### Tool Switching
- **B** - Brush mode 🖌️
- **E** - Eraser mode 🧹
- **V** - Move mode 🔄
- **T** - Scale mode 📏
- **R** - Rotate mode 🔄

#### Operation Shortcuts
- **Space** - Hold Space to enter pan mode (drag canvas)
- **Ctrl + V** - Paste image from clipboard 📋
- **Ctrl + C** - Copy image to clipboard 📄
- **Ctrl + Z** - Undo
- **Ctrl + Y** or **Ctrl + Shift + Z** - Redo
- **Ctrl + 0** - Reset view
- **ESC** - Close canvas window

### Layer Operations

#### Multi-layer Selection
- **Click checkbox** - Select/deselect a single layer
- **Ctrl + Click checkbox** - Multi-select layers (select multiple layers simultaneously)
- **After selecting multiple layers** - Apply transformations to multiple layers at once (move, scale, rotate, flip, etc.)

#### Layer Management
- **➕ New Layer** - Create a new blank layer
- **🗑️ Delete Layer** - Delete selected layer
- **👁️ Show/Hide** - Toggle layer visibility
- **Opacity Slider** - Adjust layer opacity (0-100%)
- **Drag to Reorder** - Drag layer items to adjust layer order

### ComfyUI Nodes

The plugin provides three nodes under the `hosepen` category:

#### 1. Hosepen Drawing
Placeholder node to identify hosepen functionality.

#### 2. Hosepen Image Input
Import images from workflow to canvas:
- **Input**: `images` (IMAGE) - Output from any image node
- **Function**: Send images to canvas for further editing

#### 3. Hosepen Image Output
Export images from canvas to workflow:
- **Output**: `image` (IMAGE) - Can connect to any image processing node
- **Function**: Load images saved in `input/hosepen/` directory
- **Selection**: Choose from dropdown list of saved image files

## Workflow Example

```
LoadImage → HosepenImageInput → (Edit in canvas) → Save
                                                      ↓
                                            HosepenImageOutput → SaveImage
```

## Features

- ✨ **Smooth Drawing** - Real-time response, smooth drawing experience
- 🎯 **Precise Control** - Adjustable brush size and color
- 📱 **Draggable** - Both button and window can be dragged
- 💫 **Beautiful UI** - Modern UI design, clean white background
- 🔄 **Workflow Integration** - Seamlessly integrated into ComfyUI workflow
- 💾 **Auto Save** - Images automatically saved to designated directory for easy management

## File Structure

```
comfy_hosepen/
├── __init__.py          # Plugin entry and route registration
├── nodes.py             # ComfyUI node definitions
├── server.py            # Server-side API
├── web/
│   └── hosepen.js       # Frontend canvas interface
└── README.md
```

## Changelog

### v1.0.0 (2024-11-24)
- Initial release
- Real-time drawing support
- Color and size adjustment
- Save and clear canvas
- Draggable window and button
- Image import/export nodes
- Integrated into ComfyUI workflow

## License

MIT License

- **Personal Use**: Completely free
- **Commercial Platforms**: Please notify the author before use

## Contact

- **Email**: 15734666@qq.com
- **Bilibili**: 蓝波球的球

---

**Made with 🐎 by Horse Team**
