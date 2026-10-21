# 秒薪浮窗 Windows 客户端

这是 macOS 应用的 Windows 移植。领域规则与 `WorkPrice/Domain`、`WorkPrice/State` 对齐：按真实时间区间计薪、每个工作片段保存当时的秒薪和加班策略、支持跨午夜班次、重启后恢复未结束的工作。界面是置顶浮窗，数据只写在本机，没有账号、没有遥测、运行时不需要网络。

macOS 工程保持原样。Windows 客户端在这个目录里，用 Electron 和 TypeScript 实现。

## 运行要求

- Windows 10 或 Windows 11，64 位
- 安装包：`windows/dist/WorkPrice-Setup-1.0.0.exe`
- 安装后从开始菜单或桌面快捷方式「秒薪浮窗」打开

数据文件在 `%APPDATA%\WorkPrice\workprice-data.json`。浮窗位置在同目录的 `window-bounds.json`。删除这些文件会回到默认设置。

## 开发要求

- Node.js 20 或更高版本
- 在 Windows 上可以直接打包
- 在 Linux 上交叉打包时需要本机的 NSIS 编译器（Debian/Ubuntu：`sudo apt-get install nsis`）。`npm run dist:win` 用 electron-builder 生成 Windows 应用目录，再用 `makensis` 打成安装包。不需要 Wine。

## 常用命令

在 `windows/` 目录执行：

```bash
npm install
npm test
npm start
npm run dist:win
```

- `npm test` 编译并用 Node 内置测试运行领域逻辑，覆盖 macOS XCTest 里的班次、计薪和状态场景。
- `npm start` 启动 Electron。在 Linux 上需要图形环境，可用 `xvfb-run -a npm start`。
- `npm run dist:win` 生成 64 位 NSIS 安装包，输出到 `windows/dist/WorkPrice-Setup-1.0.0.exe`。
  - 在 Windows 上由 electron-builder 直接调用 NSIS。
  - 在 Linux 上先由 electron-builder 生成 `dist/win-unpacked`，再由本机 `makensis` 编译 `build/installer.nsi`。安装程序会写入开始菜单、桌面快捷方式和当前用户的卸载项，默认安装到 `%LOCALAPPDATA%\Programs\WorkPrice`。卸载不会删除 `%APPDATA%\WorkPrice` 里的工作记录。

打包时如果签名工具找不到证书，脚本会关闭自动发现（`CSC_IDENTITY_AUTO_DISCOVERY=false`）。安装包不会做代码签名。

## 行为说明

- 浮窗默认在主屏幕工作区右下角，可拖动，位置会记住。关掉浮窗只是隐藏，退出请用托盘里的「退出秒薪」。
- 托盘菜单：开始工作 / 暂停休息、显示浮窗、隐藏浮窗、设置、退出。
- 设置项：秒薪、上班时间、下班时间、下班后是否继续计薪。非法值不会写入。
- 关闭「下班后继续计薪」后，下班后的工作计入无偿打工时长，金额停止增长。
- 上班时间晚于下班时间时按跨午夜班次处理，账目归入班次开始日。
- 修改秒薪或班次时，如果正在工作，会从当前时刻切开一段新记录。旧记录仍用旧秒薪。
