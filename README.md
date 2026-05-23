# 国风桌宠

一个透明置顶桌宠：支持拖动、点击互动动作、喝水/休息提醒、系统日历读取与提前提醒。系统日历读取目前仅支持 macOS，Windows 可运行桌宠与基础提醒功能。

## 快速开始

```bash
npm install
npm run dev
```

## 本地运行

```bash
npm run build
npm run start
```

## 打包

macOS:

```bash
npm run dist:mac
```

Windows:

```bash
npm run dist:win
```

打包产物会生成到 `release/` 目录。macOS 签名/公证需要本机配置 Apple Developer 证书与 notarytool；未配置时可使用未签名版本进行本地测试。

## 安装（macOS 未签名/未公证版本）

如果你使用的是未签名/未公证的 DMG，macOS 可能提示“无法打开”“来自身份不明的开发者”或“已损坏”，可按以下方式处理：

1. 从 DMG 拖动应用到“应用程序(Applications)”文件夹
2. 在“应用程序”里找到“国风桌宠”，右键 → 打开（Open）→ 再次确认打开
3. 若仍被拦：系统设置 → 隐私与安全性 → 在底部找到“已阻止某应用” → 点“仍要打开”
4. 若提示“已损坏”，可在终端执行一次（会要求管理员密码）：

```bash
sudo xattr -rd com.apple.quarantine "/Applications/国风桌宠.app"
```

## 授权（双协议）

- 代码：MIT（见 `LICENSE`）
- 角色美术/动画/素材：CC BY-NC 4.0（非商用，见 `LICENSE-ASSETS`）

如需商用授权请联系作者。
