export interface PromptItem {
  id: string;
  type: 'folder' | 'prompt';
  name: string;
  content?: string;
  parentId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ElectronAPI {
  getItems: (parentId?: string) => Promise<PromptItem[]>;
  getAllItems: () => Promise<PromptItem[]>;
  getItem: (id: string) => Promise<PromptItem>;
  createItem: (item: PromptItem) => Promise<void>;
  updateItem: (id: string, updates: Partial<PromptItem>) => Promise<void>;
  deleteItem: (id: string) => Promise<void>;
}

declare global {
  interface Window {
    electron: ElectronAPI;
  }
}
