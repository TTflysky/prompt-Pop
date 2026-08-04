const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const fs = require('fs/promises');
const path = require('path');

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
  const window = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 960,
    minHeight: 680,
    backgroundColor: '#ffd51a',
    autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: false }
  });
  window.loadFile(path.join(__dirname, '..', 'index.html'));
}

app.whenReady().then(() => {
  ipcMain.handle('prompt-pop:request', (_, payload) => createRequest(payload));
  ipcMain.handle('prompt-pop:save-image', async (_, source, filename) => {
    const filePath = path.join(app.getPath('pictures'), 'Prompt Pop', filename);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, await sourceToBuffer(source));
    return filePath;
  });
  ipcMain.handle('prompt-pop:save-text', async (_, text, filename) => {
    const filePath = path.join(app.getPath('downloads'), filename);
    await fs.writeFile(filePath, text, 'utf8');
    return filePath;
  });
  ipcMain.handle('prompt-pop:pick-config', async () => {
    const result = await dialog.showOpenDialog({ properties: ['openFile'], filters: [{ name: 'Prompt Pop config', extensions: ['txt'] }] });
    if (result.canceled || !result.filePaths[0]) return '';
    return fs.readFile(result.filePaths[0], 'utf8');
  });
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
