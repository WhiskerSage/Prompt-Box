import Database from 'better-sqlite3';
import path from 'path';
import { app } from 'electron';
import fs from 'fs';

const isDev = process.env.NODE_ENV === 'development';
const basePath = app.getPath('userData');
const dbPath = path.join(basePath, 'data', 'prompt-manager.db');


let db: any;

// Initialize Database Schema
export const initDB = () => {
  // Ensure the database directory exists
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  console.log('Database path:', dbPath);
  db = new Database(dbPath);

  db.exec(`
    CREATE TABLE IF NOT EXISTS prompt_items (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL CHECK (type IN ('folder', 'prompt')),
      name TEXT NOT NULL,
      content TEXT,
      parent_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (parent_id) REFERENCES prompt_items(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_prompt_items_parent_id ON prompt_items(parent_id);
    CREATE INDEX IF NOT EXISTS idx_prompt_items_type ON prompt_items(type);
  `);

  // Check if root exists, if not create it
  const root = db.prepare('SELECT id FROM prompt_items WHERE id = ?').get('root');
  if (!root) {
    db.prepare('INSERT INTO prompt_items (id, type, name, content) VALUES (?, ?, ?, ?)').run('root', 'folder', '我的提示词', null);
  }
};

// Types
export interface PromptItem {
  id: string;
  type: 'folder' | 'prompt';
  name: string;
  content?: string;
  parentId?: string;
  createdAt: string;
  updatedAt: string;
}

// DAO Methods
const mapRow = (row: any): PromptItem => {
  if (!row) return row;
  return {
    ...row,
    parentId: row.parent_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

export const getItems = (parentId: string = 'root'): PromptItem[] => {
  const rows = db.prepare('SELECT * FROM prompt_items WHERE parent_id = ? ORDER BY type DESC, name ASC').all(parentId);
  return rows.map(mapRow);
};

export const getAllItems = (): PromptItem[] => {
  const rows = db.prepare('SELECT * FROM prompt_items ORDER BY type DESC, name ASC').all();
  return rows.map(mapRow);
};

export const createItem = (item: PromptItem) => {
  console.log('Creating item:', item);
  const stmt = db.prepare(`
    INSERT INTO prompt_items (id, type, name, content, parent_id, created_at, updated_at)
    VALUES (@id, @type, @name, @content, @parentId, @createdAt, @updatedAt)
  `);
  return stmt.run(item);
};

export const updateItem = (id: string, updates: Partial<PromptItem>) => {
  console.log('Updating item:', id, updates);
  const keys = Object.keys(updates).filter(k => k !== 'id');
  if (keys.length === 0) return;

  const sets = keys.map(key => {
    const colName = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`); 
    return `${colName} = @${key}`;
  });
  
  const stmt = db.prepare(`UPDATE prompt_items SET ${sets.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = @id`);
  return stmt.run({ ...updates, id });
};

export const deleteItem = (id: string) => {
  return db.prepare('DELETE FROM prompt_items WHERE id = ?').run(id);
};

export const getItem = (id: string): PromptItem | undefined => {
    const row = db.prepare('SELECT * FROM prompt_items WHERE id = ?').get(id);
    return mapRow(row);
}
