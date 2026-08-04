const { app, BrowserWindow, dialog, ipcMain, Menu, Tray } = require('electron');
const fs = require('fs/promises');
const path = require('path');
let mainWindow;
let tray;
let isQuitting = false;
let activityLabel = '待命';

const isSupportedEndpoint = value => {
  const url = new URL(value);
  return url.protocol === 'https:' && /\/(models|chat\/completions|images\/(generations|edits))$/.test(url.pathname);
};

async function createRequest(payload) {
  const request = JSON.parse(payload);
  if (!isSupportedEndpoint(request.url)) throw new Error('Unsupported API endpoint');
  const headers = request.headers || {};
  const options = { method: request.method || 'GET', headers };
  if (request.bodyType === 'json') options.body = request.body || '';
  if (request.bodyType === 'multipart') {
    const form = new FormData();
    for (const field of request.fields || []) {
      if (field.fileData) {
        const split = field.fileData.indexOf(',');
        const encoded = split >= 0 ? field.fileData.slice(split + 1) : field.fileData;
        const bytes = Buffer.from(encoded, 'base64');
        form.append(field.name, new Blob([bytes], { type: field.mimeType || 'image/png' }), field.fileName || 'upload.png');
      } else form.append(field.name, field.value || '');
    }
    options.body = form;
    delete options.headers['Content-Type'];
  }
  const response = await fetch(request.url, options);
  return { status: response.status, body: await response.text() };
}

async function sourceToBuffer(source) {
  if (source.startsWith('data:')) {
    const comma = source.indexOf(',');
    if (comma < 0) throw new Error('Invalid image data');
    return Buffer.from(source.slice(comma + 1), 'base64');
  }
  const response = await fetch(source);
  if (!response.ok) throw new Error(`Image download failed: HTTP ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

function createWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) { mainWindow.show(); mainWindow.focus(); return; }
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 960,
    minHeight: 680,
    backgroundColor: '#ffd51a',
    icon: path.join(__dirname, 'icon.ico'),
    autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: false }
  });
  mainWindow.loadFile(path.join(__dirname, '..', 'index.html'));
  mainWindow.on('close', event => { if (!isQuitting) { event.preventDefault(); mainWindow.hide(); } });
  mainWindow.on('minimize', event => { event.preventDefault(); mainWindow.hide(); });
}

function showMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) createWindow();
  else { mainWindow.show(); mainWindow.focus(); }
}

function refreshTray() {
  if (!tray) return;
  tray.setToolTip(`Prompt Pop - ${activityLabel}`);
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: `状态：${activityLabel}`, enabled: false },
    { type: 'separator' },
    { label: '显示 Prompt Pop', click: showMainWindow },
    { label: '退出', click: () => { isQuitting = true; app.quit(); } }
  ]));
}

app.whenReady().then(() => {
  tray = new Tray(path.join(__dirname, 'icon.ico'));
  refreshTray();
  tray.on('click', showMainWindow);
  ipcMain.handle('prompt-pop:request', (_, payload) => createRequest(payload));
  ipcMain.on('prompt-pop:activity', (_, active) => { activityLabel = active ? '正在生成' : '待命'; refreshTray(); });
  ipcMain.handle('prompt-pop:save-image', async (_, source, filename) => {
    const filePath = path.join(app.getPath('pictures'), 'Prompt Pop', filename);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, await sourceToBuffer(source));
    return filePath;
  });
  ipcMain.handle('prompt-pop:save-text', async (_, text, filename) => {
    const result = await dialog.showSaveDialog({
      title: '导出 Prompt Pop 配置',
      defaultPath: path.join(app.getPath('downloads'), filename),
      filters: [{ name: 'Text file', extensions: ['txt'] }]
    });
    if (result.canceled || !result.filePath) throw new Error('已取消导出');
    const filePath = result.filePath;
    await fs.writeFile(filePath, text, 'utf8');
    return filePath;
  });
  ipcMain.handle('prompt-pop:pick-config', async () => {
    const result = await dialog.showOpenDialog({ properties: ['openFile'], filters: [{ name: 'Prompt Pop config', extensions: ['txt'] }] });
    if (result.canceled || !result.filePaths[0]) return '';
    return fs.readFile(result.filePaths[0], 'utf8');
  });
  createWindow();
  app.on('activate', showMainWindow);
});

app.on('before-quit', () => { isQuitting = true; });
