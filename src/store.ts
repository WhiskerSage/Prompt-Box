import { create } from 'zustand';
import { PromptItem } from './types';

interface AppState {
  items: PromptItem[];
  selectedId: string | null;
  selectedItem: PromptItem | null;
  expandedFolders: Set<string>;
  searchQuery: string;
  
  // Actions
  loadItems: () => Promise<void>;
  selectItem: (id: string | null) => void;
  toggleFolder: (id: string) => void;
  setSearchQuery: (query: string) => void;
  createItem: (type: 'folder' | 'prompt', parentId?: string) => Promise<void>;
  importItems: (items: PromptItem[]) => Promise<void>;
  updateItem: (id: string, updates: Partial<PromptItem>) => Promise<void>;
  moveItem: (id: string, targetParentId: string) => Promise<void>;
  deleteItem: (id: string) => Promise<void>;
}

export const useAppStore = create<AppState>((set, get) => ({
  items: [],
  selectedId: null,
  selectedItem: null,
  expandedFolders: new Set(['root']),
  searchQuery: '',

  loadItems: async () => {
    const items = await window.electron.getAllItems();
    set({ items });
  },

  selectItem: (id) => {
    const item = id ? get().items.find(i => i.id === id) || null : null;
    set({ selectedId: id, selectedItem: item });
  },

  toggleFolder: (id) => {
    const expanded = new Set(get().expandedFolders);
    if (expanded.has(id)) {
      expanded.delete(id);
    } else {
      expanded.add(id);
    }
    set({ expandedFolders: expanded });
  },

  setSearchQuery: (query) => set({ searchQuery: query }),

  createItem: async (type, parentId = 'root') => {
    const id = crypto.randomUUID();
    const newItem: PromptItem = {
      id,
      type,
      name: type === 'folder' ? '新建文件夹' : '新建提示词',
      content: '',
      parentId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    await window.electron.createItem(newItem);
    await get().loadItems();
    
    // Auto select and expand if needed
    if (type === 'folder') {
        get().toggleFolder(id);
    } else {
        get().selectItem(id);
    }
  },

  importItems: async (importData: PromptItem[]) => {
    // Map old IDs to new IDs to avoid conflicts
    const idMap = new Map<string, string>();
    const newItems: PromptItem[] = [];

    // First pass: Generate new IDs and map them
    importData.forEach(item => {
        const newId = crypto.randomUUID();
        idMap.set(item.id, newId);
    });

    // Second pass: Create new items with updated IDs and ParentIDs
    importData.forEach(item => {
        const newId = idMap.get(item.id)!;
        // If parent is in the import set, use new ID; otherwise keep original (if importing into existing structure)
        // For now, we assume imported items are self-contained or linked to 'root'
        // But if we are importing a backup, the root parentId is likely 'root' or null.
        
        let newParentId = item.parentId;
        if (item.parentId && idMap.has(item.parentId)) {
            newParentId = idMap.get(item.parentId);
        } else if (!item.parentId || item.parentId === 'root') {
            // If it was a root item, it stays root. 
            // OR: we could import into a new folder? For now, keep as root.
            newParentId = 'root'; 
        }

        newItems.push({
            ...item,
            id: newId,
            parentId: newParentId,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        });
    });

    // Insert all items
    // Since we generated new IDs, we don't need to worry about order for creation existence, 
    // BUT we do need to worry about FK constraints if we insert child before parent.
    // However, our SQLite schema has ON DELETE CASCADE but doesn't strictly enforce insert order unless we enable PRAGMA foreign_keys = ON; 
    // better-sqlite3 usually doesn't enable it by default unless configured.
    // To be safe, let's sort by dependency depth or just retry? 
    // Actually, simplest is to sort so that items with 'root' parent come first.
    
    // Simple topological sort
    const sortedItems: PromptItem[] = [];
    const addedIds = new Set<string>();
    
    // Add roots first
    newItems.filter(i => i.parentId === 'root').forEach(i => {
        sortedItems.push(i);
        addedIds.add(i.id);
    });

    // Repeatedly add children
    let changed = true;
    while (changed) {
        changed = false;
        newItems.forEach(item => {
            if (!addedIds.has(item.id) && item.parentId && addedIds.has(item.parentId)) {
                sortedItems.push(item);
                addedIds.add(item.id);
                changed = true;
            }
        });
    }

    // Add any remaining (orphans or disconnected cycles? shouldn't happen in valid tree)
    newItems.forEach(item => {
        if (!addedIds.has(item.id)) {
             sortedItems.push(item);
        }
    });

    for (const item of sortedItems) {
        await window.electron.createItem(item);
    }
    
    await get().loadItems();
    alert(`成功导入 ${newItems.length} 个项目`);
  },

  updateItem: async (id, updates) => {
    await window.electron.updateItem(id, updates);
    await get().loadItems();
    
    // Update selected item if it's the one being updated
    if (get().selectedId === id) {
       const updatedItem = get().items.find(i => i.id === id) || null;
       set({ selectedItem: updatedItem });
    }
  },

  moveItem: async (id, targetParentId) => {
    const { items } = get();
    const item = items.find(i => i.id === id);
    if (!item) return;

    // 1. Cannot move to itself
    if (id === targetParentId) return;

    // 2. Cannot move to its own descendant (prevent cycle)
    let current = items.find(i => i.id === targetParentId);
    while (current) {
        if (current.id === id) {
            console.warn("Cannot move folder into its own child");
            return;
        }
        if (current.parentId === 'root' || !current.parentId) break;
        current = items.find(i => i.id === current?.parentId);
    }

    await window.electron.updateItem(id, { parentId: targetParentId });
    await get().loadItems();
  },

  deleteItem: async (id) => {
    if (!confirm('确定要删除吗？这将删除该项目及其所有子项目。')) return;
    
    await window.electron.deleteItem(id);
    await get().loadItems();
    
    if (get().selectedId === id) {
      set({ selectedId: null, selectedItem: null });
    }
  },
}));
