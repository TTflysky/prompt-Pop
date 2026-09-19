const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('PromptPopDesktop', {
  request: payload => ipcRenderer.invoke('prompt-pop:request', payload),
  saveImage: (source, filename) => ipcRenderer.invoke('prompt-pop:save-image', source, filename),
  saveText: (text, filename) => ipcRenderer.invoke('prompt-pop:save-text', text, filename),
  pickConfig: () => ipcRenderer.invoke('prompt-pop:pick-config'),
  getVersion: () => ipcRenderer.invoke('prompt-pop:version'),
  checkForUpdate: () => ipcRenderer.invoke('prompt-pop:check-update'),
  applyUpdate: () => ipcRenderer.invoke('prompt-pop:apply-update'),
  reloadUpdatedApp: () => ipcRenderer.invoke('prompt-pop:reload-updated-app'),
  getPresets: () => ipcRenderer.invoke('prompt-pop:get-presets'),
  savePresets: value => ipcRenderer.invoke('prompt-pop:save-presets', value),
  setActivity: active => ipcRenderer.send('prompt-pop:activity', Boolean(active))
});
