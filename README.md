# ChinoiPet 国风桌宠

<p align="center">
  <strong>一只透明置顶、会互动、会提醒你的国风桌面宠物。</strong>
</p>

<p align="center">
  <a href="https://github.com/MinibeanAI/ChinoiPet/actions/workflows/build.yml"><img alt="Build" src="https://github.com/MinibeanAI/ChinoiPet/actions/workflows/build.yml/badge.svg" /></a>
  <img alt="Version" src="https://img.shields.io/badge/version-0.1.0-blue" />
  <img alt="Platform" src="https://img.shields.io/badge/platform-macOS%20%7C%20Windows-7c3aed" />
  <img alt="Electron" src="https://img.shields.io/badge/Electron-38-47848f" />
  <a href="LICENSE"><img alt="License" src="https://img.shields.io/badge/license-MIT-green" /></a>
</p>

ChinoiPet 是一个基于 Electron + React + Vite 的桌面宠物应用。它以透明置顶小窗呈现，可以拖动、点击互动，并通过喝水、休息和日历提醒陪你工作。

> 当前系统日历读取仅支持 macOS；Windows 支持桌宠本体、互动动作和基础提醒。

## 功能特性

- 透明置顶桌宠窗口，适合常驻桌面边缘
- 点击互动动作：撒娇、亲吻、招手、甩袖等
- 自动提醒：喝水、休息、日程开始前提醒
- macOS 系统 Calendar 读取与提前提醒
- 托盘菜单和右键菜单快捷操作
- 支持 macOS DMG 与 Windows NSIS 安装包打包
- 角色素材与动画随仓库提供，fork 后可直接运行

## 预览

当前仓库未提交截图/GIF。你可以运行应用后自行截图，后续放到 `README.md` 或 GitHub Release 页面中。

## 快速开始

环境要求：

- Node.js 20 或更新版本
- npm 10 或更新版本

```bash
git clone https://github.com/MinibeanAI/ChinoiPet.git
cd ChinoiPet
npm install
npm run dev
```

## 常用命令

```bash
# 本地开发
npm run dev

# 类型检查并构建 renderer
npm run build

# 构建后直接启动 Electron
npm run start

# 检查素材、序列、Lottie 与构建
npm run verify
```

## 打包发布

macOS:

```bash
npm run dist:mac
```

Windows:

```bash
npm run dist:win
```

打包产物会生成到 `release/` 目录。该目录是本地生成物，不会提交到 Git。

### macOS 签名/公证

macOS 正式分发建议配置 Apple Developer 证书和 notarytool。未配置签名/公证时，也可以先使用未签名版本做本地测试。

如果未签名/未公证 DMG 被系统拦截，可尝试：

1. 从 DMG 拖动应用到“应用程序(Applications)”文件夹
2. 在“应用程序”里找到“国风桌宠”，右键 → 打开（Open）→ 再次确认打开
3. 若仍被拦：系统设置 → 隐私与安全性 → 在底部找到“已阻止某应用” → 点“仍要打开”
4. 若提示“已损坏”，可在终端执行一次：

```bash
sudo xattr -rd com.apple.quarantine "/Applications/国风桌宠.app"
```

## 平台支持

| 平台 | 运行 | 打包 | 系统日历读取 | 说明 |
| --- | --- | --- | --- | --- |
| macOS | 支持 | DMG | 支持 | Calendar 权限需用户授权 |
| Windows | 支持 | NSIS | 暂不支持 | 可运行桌宠与基础提醒 |
| Linux | 未验证 | 未配置 | 暂不支持 | 后续可补 Electron Builder target |

## 项目结构

```text
electron/       Electron 主进程与 preload
src/            React renderer、样式、动画加载逻辑
src/assets/     角色图片、Lottie、序列帧素材
scripts/        素材检查、预览、打包辅助脚本
build/          打包图标与 macOS entitlement 资源
```

## Fork 后怎么跑

这个仓库已经排除了本地缓存和生成物。其他人 fork 或 clone 后只需要：

```bash
npm install
npm run dev
```

如果要生成安装包，再运行对应平台的 `dist:*` 命令即可。

## 常见问题

### 为什么 Windows 没有系统日历提醒？

当前日历读取通过 macOS Calendar 和 AppleScript 实现。Windows 版本会保留桌宠、互动和基础提醒能力，但不会读取系统日历。

### 为什么仓库里没有 `dist/`、`release/` 和 `node_modules/`？

这些都是生成物或依赖缓存。提交源码、配置、锁文件和必要素材即可，克隆后通过 `npm install` 和打包命令重新生成。

### Build badge 为什么可能一开始是灰色或失败？

Build badge 来自 GitHub Actions。首次推送 workflow 后，GitHub 需要运行一次 CI 才会显示真实状态。

## 技术栈

- Electron 38
- React 19
- Vite 7
- TypeScript 5
- electron-builder
- lottie-react

## 授权

- 代码：MIT（见 [`LICENSE`](LICENSE)）
- 角色美术/动画/素材：CC BY-NC 4.0（非商用，见 [`LICENSE-ASSETS`](LICENSE-ASSETS)）

如需商用授权请联系作者。
