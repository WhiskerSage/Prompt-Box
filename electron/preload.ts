import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electron', {
  getItems: (parentId?: string) => ipcRenderer.invoke('db:getItems', parentId),
  getAllItems: () => ipcRenderer.invoke('db:getAllItems'),
  getItem: (id: string) => ipcRenderer.invoke('db:getItem', id),
  createItem: (item: any) => ipcRenderer.invoke('db:createItem', item),
  updateItem: (id: string, updates: any) => ipcRenderer.invoke('db:updateItem', id, updates),
  deleteItem: (id: string) => ipcRenderer.invoke('db:deleteItem', id),
});
