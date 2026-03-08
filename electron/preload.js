const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  openFile: () => ipcRenderer.invoke('file:open'),
  saveFile: (args) => ipcRenderer.invoke('file:save', args),
  saveImage: (args) => ipcRenderer.invoke('file:saveImage', args),
  savePDF: (args) => ipcRenderer.invoke('file:savePDF', args),
  saveSQL: (args) => ipcRenderer.invoke('file:saveSQL', args),
});
