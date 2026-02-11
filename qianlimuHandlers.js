const { ipcMain, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

let mainWindow;
let openChildWindows;
let qianlimuWindow = null;
let distributedServer = null;

function initialize(config) {
    mainWindow = config.mainWindow;
    openChildWindows = config.openChildWindows;
    distributedServer = config.distributedServer;

    ipcMain.on('open-qianlimu-window', () => {
        createQianlimuWindow();
    });

    ipcMain.on('close-qianlimu-window', () => {
        if (qianlimuWindow && !qianlimuWindow.isDestroyed()) {
            qianlimuWindow.close();
        }
    });

    ipcMain.handle('qianlimu:save-screenshot', async (event, { commandId, base64Data }) => {
        try {
            const screenshotsDir = path.join(process.cwd(), 'assets', 'screenshots');
            if (!fs.existsSync(screenshotsDir)) {
                fs.mkdirSync(screenshotsDir, { recursive: true });
            }
            
            const fileName = `${commandId}.jpg`;
            const filePath = path.join(screenshotsDir, fileName);
            const base64Image = base64Data.split(';base64,').pop();
            
            fs.writeFileSync(filePath, base64Image, { encoding: 'base64' });
            
            // 返回相对路径
            return { success: true, path: `assets/screenshots/${fileName}` };
        } catch (err) {
            console.error('[Qianlimu] Failed to save screenshot via IPC:', err);
            return { success: false, error: err.message };
        }
    });
}

function setDistributedServer(server) {
    distributedServer = server;
}

function createQianlimuWindow() {
    if (qianlimuWindow && !qianlimuWindow.isDestroyed()) {
        qianlimuWindow.focus();
        return;
    }

    // 更新插件状态为已启动
    try {
        const statePath = path.join(__dirname, '../../VCPDistributedServer/Plugin/qianlimu/ui-state.json');
        if (fs.existsSync(statePath)) {
            const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
            state["千里目状态"] = "已启动";
            delete state["界面状态"]; // 移除旧字段
            fs.writeFileSync(statePath, JSON.stringify(state, null, 2), 'utf8');
            
            // 通知分布式服务器刷新占位符
            if (distributedServer && typeof distributedServer.forceRefreshStaticPlaceholders === 'function') {
                distributedServer.forceRefreshStaticPlaceholders('QianlimuState');
            }
        }
    } catch (e) {
        console.error('[Qianlimu] Failed to update UI state on open:', e);
    }

    if (!distributedServer || !distributedServer.port) {
        console.error('[Qianlimu] Distributed server not ready, cannot open window.');
        return;
    }

    qianlimuWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        title: '千里目 - 智能地理教学系统',
        frame: false,
        webPreferences: {
            preload: path.join(__dirname, '../../preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        },
        show: false,
    });

    // 加载分布式服务器集成的千里目页面
    qianlimuWindow.loadURL(`http://localhost:${distributedServer.port}/qianlimu/index.html`);

    openChildWindows.push(qianlimuWindow);

    qianlimuWindow.once('ready-to-show', () => {
        qianlimuWindow.show();
    });

    qianlimuWindow.on('closed', () => {
        openChildWindows = openChildWindows.filter(win => win !== qianlimuWindow);
        qianlimuWindow = null;
        
        // 更新插件状态为未启动
        try {
            const statePath = path.join(__dirname, '../../VCPDistributedServer/Plugin/qianlimu/ui-state.json');
            if (fs.existsSync(statePath)) {
                const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
                state["千里目状态"] = "未启动";
                state["已加载组"] = []; // UI 关闭时清空已加载组
                delete state["界面状态"]; // 移除旧字段
                // 移除最后更新时间，保持简洁
                delete state["最后更新时间"];
                fs.writeFileSync(statePath, JSON.stringify(state, null, 2), 'utf8');

                // 通知分布式服务器刷新占位符
                if (distributedServer && typeof distributedServer.forceRefreshStaticPlaceholders === 'function') {
                    distributedServer.forceRefreshStaticPlaceholders('QianlimuState');
                }
            }
        } catch (e) {
            console.error('[Qianlimu] Failed to update UI state on close:', e);
        }
    });
}

module.exports = {
    initialize,
    setDistributedServer,
    openWindow: createQianlimuWindow,
    stopServer: () => {} // 保持接口兼容，但集成模式下无需操作
};