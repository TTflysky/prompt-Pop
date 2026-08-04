const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('PromptPopDesktop', {
  request: payload => ipcRenderer.invoke('prompt-pop:request', payload),
  saveImage: (source, filename) => ipcRenderer.invoke('prompt-pop:save-image', source, filename),
  saveText: (text, filename) => ipcRenderer.invoke('prompt-pop:save-text', text, filename),
  pickConfig: () => ipcRenderer.invoke('prompt-pop:pick-config'),
  setActivity: active => ipcRenderer.send('prompt-pop:activity', Boolean(active))
});
