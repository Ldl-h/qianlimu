📦 千里目插件：终极打包、集成指南与免责声明

> **核心设计思路**：本插件采用“双插件”架构。`qianlimu` 负责业务逻辑（Cesium 控制、标绘、指令执行），`QianlimuState` 负责状态监控并向 AI 提供实时上下文（占位符）。通过分布式服务器的文件监听机制，实现 UI 状态变化后 AI 能够立即感知。

一、 必须提取并分享的文件

1. **业务插件核心**: `VCPDistributedServer/Plugin/qianlimu/`
2. **状态上报插件**: `VCPDistributedServer/Plugin/QianlimuState/` (关键：负责更新 AI 的 `{{VCPQianlimuState}}` 占位符)
3. **IPC 处理器**: `modules/ipc/qianlimuHandlers.js` (负责 Electron 窗口生命周期管理)
4. **静态资源**: `assets/qizi/` (棋子图标)

二、 散落在外的代码改动清单 (修改现有文件)
以下是必须手动合并到主项目中的代码改动：

1. 插件管理器底层支持
文件: VCPDistributedServer/Plugin.js

改动 A (约 428 行): 新增 triggerPluginUpdate 方法。
// 新增：主动触发特定插件的更新
async triggerPluginUpdate(pluginName) {
    const plugin = this.plugins.get(pluginName);
    const hasStaticEntry = plugin && plugin.pluginType === 'static' && plugin.entryPoint;
    if (plugin && hasStaticEntry) {
        await this._updateStaticPluginValue(plugin);
        return true;
    }
    return false;
}
逻辑说明: 允许外部（如 UI 状态改变时）强制让 AI 刷新占位符数据。
2. 分布式服务器核心逻辑
文件: VCPDistributedServer/VCPDistributedServer.js

改动 A (约 29, 38, 41 行): 构造函数中注入处理函数并初始化监听器。
this.handleQianlimuControl = config.handleQianlimuControl; // 注入控制句柄
this.pendingPlaceholderPush = null; // 节流定时器
this.watchers = []; // 存储文件监听器
改动 B (约 248-280 行): 新增文件监听和强制刷新逻辑。
添加 setupFileWatchers() 方法：监听 plugin-manifest.json 中指定的 watchFiles。
添加 forceRefreshStaticPlaceholders(pluginName) 方法：带 500ms 节流的刷新机制。
改动 C (约 516-523 行): 在 handleToolExecutionRequest 中识别特殊动作。
if (finalResult && finalResult._specialAction === 'open_qianlimu') {
    if (typeof this.handleQianlimuControl === 'function') {
        this.handleQianlimuControl();
    }
}
逻辑说明: 让服务器具备“感知文件变化并主动推送到 AI”以及“响应 AI 指令打开窗口”的能力。
3. 主进程入口集成
文件: main.js

改动 A (约 43 行): 引入处理器。
const qianlimuHandlers = require('./modules/ipc/qianlimuHandlers');
改动 B (约 861 行): 初始化。
qianlimuHandlers.initialize({ mainWindow, openChildWindows });
改动 C (约 887-895 行): 在分布式服务器启动时注入控制逻辑。
handleQianlimuControl: () => {
    const qianlimuHandlers = require('./modules/ipc/qianlimuHandlers');
    qianlimuHandlers.openWindow();
}
// 初始化后执行：
await distributedServer.initialize();
qianlimuHandlers.setDistributedServer(distributedServer);
逻辑说明: 建立主进程、分布式服务器、千里目窗口三者之间的通信链路。
4. 预加载脚本 (Bridge)
文件: preload.js

改动 A (约 335-338, 360 行): 暴露 API 给前端。
// Qianlimu Module
openQianlimuWindow: () => ipcRenderer.send('open-qianlimu-window'),
closeQianlimuWindow: () => ipcRenderer.send('close-qianlimu-window'),
// Qianlimu Screenshot
saveQianlimuScreenshot: (commandId, base64Data) => ipcRenderer.invoke('qianlimu:save-screenshot', { commandId, base64Data }),
逻辑说明: 让 Cesium 地图页面能够调用 Electron 的原生功能（如保存截图）。
5. UI 交互触发
文件: modules/event-listeners.js

改动 A (约 1105 行):
// 右键点击画布按钮 - 打开千里目
openCanvasBtn.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    window.electronAPI.openQianlimuWindow();
});
逻辑说明: 为用户提供一个“右键点击画布图标”即可打开地图的快捷入口。
6. 依赖与窗口管理
- **package.json**: 确保安装了 `mime-types` 和 `zod`。
- **modules/ipc/windowHandlers.js**: 新增了 `set-always-on-top` 处理（用于地图窗口置顶）。

三、 AI 占位符与主服务器集成说明

为了让 AI 知道插件的存在及其状态，必须确保以下机制生效：

1. **占位符定义**:
   在 `QianlimuState/plugin-manifest.json` 中定义了 `{{VCPQianlimuState}}`。主服务器在启动时会扫描所有插件的 `systemPromptPlaceholders`。

2. **占位符内容格式**:
   `state-reporter.js` 会生成如下格式的文本，并由主服务器注入到 AI 的系统提示词中：
   ```text
   千里目状态: [运行状态]
   所有分组: 分组A、分组B
   已加载: 当前加载的分组
   分组名:
   点之间的关系: "点A <-> 点B"
   点位: "点A": "描述内容", "点B": "描述内容"
   ```

3. **实时联动逻辑**:
   - **监听**: `VCPDistributedServer.js` 必须配置 `watchFiles`（在 `QianlimuState` 的 manifest 中定义），监听 `ui-state.json`。
   - **触发**: 当用户在地图上操作导致 `ui-state.json` 变化时，服务器捕获变化并调用 `QianlimuState` 插件，更新占位符。
   - **感知**: AI 通过 `{{VCPQianlimuState}}` 的变化，知道当前地图上有什么、哪些点是关联的，从而能够回答“地图上现在显示了什么”或“帮我定位到刚才标绘的点”。

4. **指令执行**:
   AI 通过 `qianlimu` 插件定义的 `invocationCommands`（如 `FlyTo`, `AddDrawing`）来控制插件。如果 AI 不知道如何操作，请检查 `qianlimu/plugin-manifest.json` 是否被正确加载。

四、免责声明 
1. 软件性质与授权:
  “千里目智能地理教学系统”（以下简称“本软件”）是一个基于 CesiumJS 开源引擎开发的插件。本软件的源代码以 [MIT] 协议开源分发。开发者仅提供技术实现与功能扩展，不提供任何地理数据服务。

3. 数据来源与版权:
  本软件使用 CesiumJS 渲染引擎，其版权归 CesiumGS, Inc. 所有。
  本软件默认连接至 Cesium Ion 平台。用户在使用过程中加载的任何地图瓦片、模型（包括但不限于 Google Photorealistic 3D Tiles、Bing Maps、Sentinel-2 等）的版权均归原数据提供商所有。
  本软件默认保留并显露 CesiumJS 及其数据提供商的版权标识（Credits）。用户若通过修改源代码、CSS 样式或使用第三方工具强制隐藏、遮盖版权标识，由此产生的合规性风险及法律责任由用户自行承担。

4. 访问令牌 (Access Token):
  用户需自行前往 Cesium 官网注册账号并获取 Token。
  用户应妥善保管自己的 Token，因 Token 泄露或滥用导致的账户封禁、费用产生或法律纠纷，与本软件开发者无关。
  本软件代码中提供的任何示例 ID 仅供功能演示，不保证其长期有效性。

5. 汉化与自定义功能:
  本软件中包含的“新中国周年计数”、“天干地支历法”、“二十四时辰显示”以及“量天尺”等汉化与自定义逻辑，属于本软件开发者的原创功能扩展。这些功能旨在提升体验，不代表对底层地图数据所有权的声明。

6. 责任限制:
  本软件主要用于个人学习研究。使用者在公开场合（如直播、出版、商业汇报）使用本软件时，应确保已获得相关地理数据提供商的授权。
  最终解释权：在法律允许的范围内，本软件开发者保留对本声明的最终解释权。
