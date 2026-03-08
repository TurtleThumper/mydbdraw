const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const path = require('path');
const fs = require('fs');

const isDev = process.env.NODE_ENV !== 'production';

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#0f1117',
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#0f1117',
      symbolColor: '#a0aec0',
      height: 36
    },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  if (isDev) {
    win.loadURL('http://localhost:5173');
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(() => {
  createWindow();
  Menu.setApplicationMenu(null);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// File I/O handlers
ipcMain.handle('file:open', async () => {
  const { filePaths } = await dialog.showOpenDialog({
    title: 'Open DBML File',
    filters: [{ name: 'DBML Files', extensions: ['dbml'] }, { name: 'JSON Projects', extensions: ['json'] }],
    properties: ['openFile']
  });
  if (!filePaths.length) return null;
  const content = fs.readFileSync(filePaths[0], 'utf-8');
  return { path: filePaths[0], content };
});

ipcMain.handle('file:save', async (_, { filePath, content }) => {
  if (filePath) {
    fs.writeFileSync(filePath, content, 'utf-8');
    return filePath;
  }
  const { filePath: newPath } = await dialog.showSaveDialog({
    title: 'Save Project',
    defaultPath: 'schema.dbml',
    filters: [{ name: 'DBML Files', extensions: ['dbml'] }]
  });
  if (!newPath) return null;
  fs.writeFileSync(newPath, content, 'utf-8');
  return newPath;
});

ipcMain.handle('file:saveImage', async (_, { dataUrl, defaultName }) => {
  const { filePath } = await dialog.showSaveDialog({
    title: 'Export Image',
    defaultPath: defaultName || 'diagram.png',
    filters: [{ name: 'PNG Image', extensions: ['png'] }]
  });
  if (!filePath) return false;
  const base64 = dataUrl.replace(/^data:image\/png;base64,/, '');
  fs.writeFileSync(filePath, base64, 'base64');
  return true;
});

ipcMain.handle('file:savePDF', async (_, { dataUrl, defaultName }) => {
  const { filePath } = await dialog.showSaveDialog({
    title: 'Export PDF',
    defaultPath: defaultName || 'diagram.pdf',
    filters: [{ name: 'PDF File', extensions: ['pdf'] }]
  });
  if (!filePath) return false;
  const base64 = dataUrl.replace(/^data:application\/pdf;base64,/, '');
  fs.writeFileSync(filePath, base64, 'base64');
  return true;
});

ipcMain.handle('file:saveSQL', async (_, { sql, defaultName }) => {
  const { filePath } = await dialog.showSaveDialog({
    title: 'Export SQL',
    defaultPath: defaultName || 'schema.sql',
    filters: [{ name: 'SQL File', extensions: ['sql'] }]
  });
  if (!filePath) return false;
  fs.writeFileSync(filePath, sql, 'utf-8');
  return true;
});
