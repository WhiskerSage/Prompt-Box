import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'path';
import { initDB, getItems, createItem, updateItem, deleteItem, getAllItems, getItem } from './db';

// Global Error Handling
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  dialog.showErrorBox('应用发生错误', `发生了意外错误:\n${error.message}\n\n${error.stack}`);
});

// Initialize Database
try {
  initDB();
} catch (error: any) {
  console.error('Database initialization failed:', error);
  dialog.showErrorBox('数据库初始化失败', `无法初始化数据库:\n${error.message}`);
  app.quit();
}

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
// if (require('electron-squirrel-startup')) {
//   app.quit();
// }

let mainWindow: BrowserWindow | null = null;

const createWindow = () => {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // and load the index.html of the app.
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist_renderer/index.html'));
  }

  // IPC Handlers
  ipcMain.handle('db:getItems', (_, parentId) => getItems(parentId));
  ipcMain.handle('db:getAllItems', () => getAllItems());
  ipcMain.handle('db:getItem', (_, id) => getItem(id));
  ipcMain.handle('db:createItem', (_, item) => createItem(item));
  ipcMain.handle('db:updateItem', (_, id, updates) => updateItem(id, updates));
  ipcMain.handle('db:deleteItem', (_, id) => deleteItem(id));
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow);

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
