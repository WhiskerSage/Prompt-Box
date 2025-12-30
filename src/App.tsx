import React, { useEffect, useState, useMemo, useRef } from 'react';
import { Folder, FileText, Plus, Search, Copy, Trash2, ChevronRight, ChevronDown, FolderOpen, Download, Upload, Edit3 } from 'lucide-react';
import { useAppStore } from './store';
import { PromptItem } from './types';
import clsx from 'clsx';
import debounce from 'lodash.debounce';

const TreeItem = ({ item, level = 0 }: { item: PromptItem; level?: number }) => {
  const { items, expandedFolders, selectedId, toggleFolder, selectItem, createItem, deleteItem, moveItem, updateItem } = useAppStore();
  const isExpanded = expandedFolders.has(item.id);
  const isSelected = selectedId === item.id;
  const [isDragOver, setIsDragOver] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(item.name);
  const inputRef = useRef<HTMLInputElement>(null);
  const clickCountRef = useRef(0);
  const clickTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (clickTimerRef.current) {
        clearTimeout(clickTimerRef.current);
      }
    };
  }, []);

  // Sync editName when item.name changes from outside
  useEffect(() => {
    if (!isEditing) {
      setEditName(item.name);
    }
  }, [item.name, isEditing]);

  // Focus input when editing starts
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleclick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isEditing) return; // Don't toggle when editing

    // Prevent single click action when double-clicking
    clickCountRef.current += 1;

    if (clickCountRef.current === 1) {
      clickTimerRef.current = setTimeout(() => {
        // This is a single click
        if (item.type === 'folder') {
          toggleFolder(item.id);
        } else {
          selectItem(item.id);
        }
        clickCountRef.current = 0;
      }, 250); // 250ms delay to detect double click
    }
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();

    // Clear single click timer
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
    }
    clickCountRef.current = 0;

    setIsEditing(true);
  };

  const startRename = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(true);
  };

  const saveRename = async () => {
    if (!isEditing) return; // Prevent multiple saves

    const trimmedName = editName.trim();
    if (trimmedName && trimmedName !== item.name) {
      await updateItem(item.id, { name: trimmedName });
    } else {
      setEditName(item.name); // Revert if empty or unchanged
    }
    setIsEditing(false);
  };

  const cancelRename = () => {
    setEditName(item.name);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveRename();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelRename();
    }
  };

  const handleInputBlur = () => {
    // Small delay to allow button clicks to register first
    setTimeout(() => {
      if (isEditing) {
        saveRename();
      }
    }, 100);
  };

  const handleAddChild = (e: React.MouseEvent, type: 'folder' | 'prompt') => {
    e.stopPropagation();
    createItem(type, item.id);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    deleteItem(item.id);
  };

  // Drag and Drop Handlers
  const handleDragStart = (e: React.DragEvent) => {
    // Prevent dragging when editing
    if (isEditing) {
      e.preventDefault();
      return;
    }

    // Use text/plain for better compatibility
    e.dataTransfer.setData('text/plain', JSON.stringify({ id: item.id, type: item.type }));
    e.dataTransfer.effectAllowed = 'move';
    e.stopPropagation();
  };

  const handleDragOver = (e: React.DragEvent) => {
    // Only allow dropping into folders
    if (item.type !== 'folder') {
        return; // Don't prevent default for non-folders
    }

    e.preventDefault(); // Necessary to allow dropping
    e.stopPropagation();

    if (!isDragOver) setIsDragOver(true);
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Fix: Prevent flickering when dragging over children elements
    // Only disable highlight if we are actually leaving the container
    const relatedTarget = e.relatedTarget as Node | null;
    if (relatedTarget && e.currentTarget.contains(relatedTarget)) {
        return;
    }

    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    // Only folders can accept drops
    if (item.type !== 'folder') {
        console.warn('Cannot drop on non-folder item');
        return;
    }

    try {
        const json = e.dataTransfer.getData('text/plain');
        if (!json) {
            console.warn('No drag data found');
            return;
        }

        const data = JSON.parse(json);
        console.log(`Drop data:`, data, `Target: ${item.id} (${item.name})`);

        if (!data.id) {
            console.warn('Invalid drag data: missing id');
            return;
        }

        if (data.id === item.id) {
            console.warn('Cannot drop item onto itself');
            return;
        }

        // Perform the move
        moveItem(data.id, item.id);

        // Auto expand target folder
        if (!expandedFolders.has(item.id)) {
            toggleFolder(item.id);
        }
    } catch (err) {
        console.error("Drop error:", err);
    }
  };

  return (
    <div>
      <div
        className={clsx(
          "flex items-center p-1.5 hover:bg-slate-200 rounded cursor-pointer text-sm group border border-transparent",
          !isEditing && "select-none",
          isSelected ? "bg-blue-100 text-blue-700" : "text-slate-700",
          isDragOver && "border-blue-500 bg-blue-50",
          isEditing && "bg-white"
        )}
        style={{ paddingLeft: `${level * 12 + 8}px` }}
        onClick={handleclick}
        onDoubleClick={handleDoubleClick}
        draggable={!isEditing}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <span className="mr-1 text-slate-400 w-4 flex justify-center">
           {item.type === 'folder' && (
             isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />
           )}
        </span>

        {item.type === 'folder' ? (
          isExpanded ? <FolderOpen size={16} className="mr-2 text-blue-500" /> : <Folder size={16} className="mr-2 text-blue-500" />
        ) : (
          <FileText size={16} className={clsx("mr-2", isSelected ? "text-blue-600" : "text-slate-400")} />
        )}

        {isEditing ? (
          <input
            ref={inputRef}
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleInputBlur}
            className="flex-1 px-1 py-0.5 bg-white border border-blue-400 rounded text-sm focus:outline-none select-text"
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onDoubleClick={(e) => e.stopPropagation()}
            autoFocus
          />
        ) : (
          <span className="flex-1 truncate">{item.name}</span>
        )}

        {/* Quick Actions on Hover */}
        {!isEditing && (
          <div className="hidden group-hover:flex items-center space-x-1 ml-2">
              {item.type === 'folder' && (
                  <>
                      <button onClick={(e) => handleAddChild(e, 'folder')} className="p-0.5 hover:bg-slate-300 rounded" title="新建文件夹"><Plus size={12} /></button>
                      <button onClick={(e) => handleAddChild(e, 'prompt')} className="p-0.5 hover:bg-slate-300 rounded" title="新建提示词"><FileText size={12} /></button>
                  </>
              )}
              <button onClick={startRename} className="p-0.5 hover:bg-slate-300 rounded" title="重命名"><Edit3 size={12} /></button>
              <button onClick={handleDelete} className="p-0.5 hover:bg-red-200 text-slate-400 hover:text-red-600 rounded" title="删除"><Trash2 size={12} /></button>
          </div>
        )}
      </div>

      {item.type === 'folder' && isExpanded && (
        <div>
          {items
            .filter(i => i.parentId === item.id)
            .map(child => (
              <TreeItem key={child.id} item={child} level={level + 1} />
            ))}
        </div>
      )}
    </div>
  );
};

function App() {
  const { items, loadItems, selectedItem, updateItem, createItem, moveItem, importItems, searchQuery, setSearchQuery } = useAppStore();
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [localContent, setLocalContent] = useState('');
  const [localName, setLocalName] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);
  const [isEditingContent, setIsEditingContent] = useState(false);
  
  // Template Variables State
  const [variables, setVariables] = useState<Record<string, string>>({});

  // Detect variables in content
  const detectedVariables = useMemo(() => {
    const regex = /{{\s*([a-zA-Z0-9_\u4e00-\u9fa5]+)\s*}}/g;
    const vars = new Set<string>();
    let match;
    while ((match = regex.exec(localContent)) !== null) {
      vars.add(match[1]);
    }
    return Array.from(vars);
  }, [localContent]);

  // Update variables state when detected variables change
  useEffect(() => {
      setVariables(prev => {
          const next = { ...prev };
          // Remove unused
          Object.keys(next).forEach(key => {
              if (!detectedVariables.includes(key)) {
                  delete next[key];
              }
          });
          // Add new
          detectedVariables.forEach(key => {
              if (next[key] === undefined) {
                  next[key] = '';
              }
          });
          return next;
      });
  }, [detectedVariables]);

  // Debounced update function
  const debouncedUpdate = useMemo(
    () => debounce((id: string, updates: Partial<PromptItem>) => {
      updateItem(id, updates);
    }, 500),
    [updateItem]
  );

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      debouncedUpdate.cancel();
    };
  }, [debouncedUpdate]);

  // Sync local state when selection changes
  useEffect(() => {
    // Flush pending updates before switching
    debouncedUpdate.flush();

    if (selectedItem) {
        setLocalContent(selectedItem.content || '');
        setLocalName(selectedItem.name);
    } else {
        setLocalContent('');
        setLocalName('');
    }
  }, [selectedItem?.id, debouncedUpdate]); // Only depend on ID to avoid unnecessary re-renders

  // Sync name when it changes externally (e.g., from tree rename)
  useEffect(() => {
    if (selectedItem && selectedItem.name !== localName && !isEditingName) {
      setLocalName(selectedItem.name);
    }
  }, [selectedItem?.name, isEditingName]);

  // Sync content when it changes externally
  useEffect(() => {
    if (selectedItem && selectedItem.content !== localContent && !isEditingContent) {
      setLocalContent(selectedItem.content || '');
    }
  }, [selectedItem?.content, isEditingContent]);

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setLocalContent(newValue);
    setIsEditingContent(true);
    if (selectedItem) {
        debouncedUpdate(selectedItem.id, { content: newValue });
    }
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setLocalName(newValue);
    setIsEditingName(true);
    if (selectedItem) {
        debouncedUpdate(selectedItem.id, { name: newValue });
    }
  };

  const handleNameBlur = () => {
    setIsEditingName(false);
  };

  const handleContentBlur = () => {
    setIsEditingContent(false);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (event) => {
          try {
              const json = event.target?.result as string;
              const data = JSON.parse(json);
              if (Array.isArray(data)) {
                  await importItems(data);
              } else {
                  alert('无效的文件格式');
              }
          } catch (err) {
              console.error(err);
              alert('导入失败：文件解析错误');
          }
      };
      reader.readAsText(file);
      // Reset input
      e.target.value = '';
  };

  useEffect(() => {
    if (!window.electron) {
      setError("Critical Error: Electron API not available. Preload script failed?");
      return;
    }
    loadItems().catch(err => {
      console.error("Failed to load items:", err);
      setError(`Load Failed: ${err.message}`);
    });
  }, []);

  if (error) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-red-50 text-red-800 p-8">
        <div className="max-w-lg">
          <h1 className="text-2xl font-bold mb-4">Application Error</h1>
          <p className="font-mono bg-red-100 p-4 rounded border border-red-200 whitespace-pre-wrap">{error}</p>
        </div>
      </div>
    );
  }

  // Root items
  const rootItems = items.filter(i => i.parentId === 'root');
  
  // Filtered items (flat list when searching)
  const filteredItems = searchQuery 
    ? items.filter(i => i.name.toLowerCase().includes(searchQuery.toLowerCase()) || i.content?.toLowerCase().includes(searchQuery.toLowerCase()))
    : null;

  const handleCopy = () => {
    if (selectedItem?.content) {
      let contentToCopy = selectedItem.content;

      // Replace variables if any are detected and filled
      if (detectedVariables.length > 0) {
        detectedVariables.forEach(varName => {
          const value = variables[varName];
          if (value) {
            const regex = new RegExp(`{{\\s*${varName}\\s*}}`, 'g');
            contentToCopy = contentToCopy.replace(regex, value);
          }
        });
      }

      navigator.clipboard.writeText(contentToCopy);
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 2000);
    }
  };

  return (
    <div className="flex h-screen w-screen bg-slate-50 text-slate-900 overflow-hidden">
      {/* Sidebar */}
      <div className="w-72 bg-slate-100 border-r border-slate-200 flex flex-col flex-shrink-0">
        <div className="p-3 border-b border-slate-200 flex items-center justify-between bg-slate-100">
          <h1 className="font-bold text-slate-700 flex items-center">
            <span className="w-6 h-6 bg-blue-600 rounded mr-2 flex items-center justify-center text-white text-xs">P</span>
            Prompt Box
          </h1>
          <div className="flex space-x-1">
             <label className="p-1.5 hover:bg-slate-200 rounded text-slate-500 cursor-pointer" title="导入数据">
                <Upload size={18} />
                <input type="file" accept=".json" className="hidden" onChange={handleImport} />
             </label>
             <button onClick={() => {
                // Export Logic (Temporary alert, should be implemented properly)
                const data = JSON.stringify(items, null, 2);
                const blob = new Blob([data], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `prompt-backup-${new Date().toISOString().split('T')[0]}.json`;
                a.click();
             }} className="p-1.5 hover:bg-slate-200 rounded text-slate-500" title="导出数据">
                <Download size={18} />
             </button>
             <button onClick={() => createItem('folder')} className="p-1.5 hover:bg-slate-200 rounded text-slate-500" title="新建根文件夹">
                <Folder size={18} />
             </button>
             <button onClick={() => createItem('prompt')} className="p-1.5 hover:bg-slate-200 rounded text-slate-500" title="新建根提示词">
                <FileText size={18} />
             </button>
          </div>
        </div>
        
        <div className="p-2 border-b border-slate-200 bg-white">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 text-slate-400" size={14} />
            <input 
              type="text" 
              placeholder="搜索提示词..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-slate-100 border-transparent rounded text-sm focus:bg-white focus:border-blue-400 focus:outline-none transition-all"
            />
          </div>
        </div>

        <div
          className="flex-1 overflow-y-auto p-2"
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
            e.dataTransfer.dropEffect = 'move';
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            try {
                const json = e.dataTransfer.getData('text/plain');
                if (!json) {
                    console.warn('No drag data found in root drop');
                    return;
                }

                const data = JSON.parse(json);
                if (!data.id) {
                    console.warn('Invalid drag data in root drop: missing id');
                    return;
                }

                console.log(`Dropping ${data.id} (${data.type}) to Root`);
                moveItem(data.id, 'root');
            } catch (err) {
                console.error("Root Drop error:", err);
            }
          }}
        >
          {filteredItems ? (
             <div className="space-y-1">
                {filteredItems.map(item => (
                    <div 
                        key={item.id}
                        onClick={() => useAppStore.getState().selectItem(item.id)}
                        className="flex items-center p-2 hover:bg-slate-200 rounded cursor-pointer text-sm text-slate-700"
                    >
                        {item.type === 'folder' ? <Folder size={16} className="mr-2 text-blue-500" /> : <FileText size={16} className="mr-2 text-slate-400" />}
                        <span>{item.name}</span>
                    </div>
                ))}
                {filteredItems.length === 0 && <div className="text-center text-slate-400 text-sm mt-4">无搜索结果</div>}
             </div>
          ) : (
            <div className="space-y-0.5">
                {rootItems.map(item => (
                <TreeItem key={item.id} item={item} />
                ))}
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 bg-white">
        {selectedItem ? (
            <>
                {/* Toolbar */}
                <div className="h-16 border-b border-slate-100 flex items-center px-6 justify-between flex-shrink-0">
                <div className="flex-1 mr-4">
                    <input
                        type="text"
                        value={localName}
                        onChange={handleNameChange}
                        onFocus={() => setIsEditingName(true)}
                        onBlur={handleNameBlur}
                        className="text-xl font-semibold text-slate-800 w-full bg-transparent focus:outline-none focus:bg-slate-50 rounded px-1 -ml-1"
                    />
                    <div className="text-xs text-slate-400 mt-0.5 px-1">
                        {new Date(selectedItem.updatedAt).toLocaleString()}
                    </div>
                </div>
                <div className="flex items-center space-x-3">
                    {selectedItem.type === 'prompt' && (
                        <button 
                            onClick={handleCopy}
                            className={clsx(
                                "flex items-center px-4 py-2 rounded transition-all shadow-sm text-sm font-medium",
                                copyFeedback ? "bg-green-600 text-white" : "bg-blue-600 text-white hover:bg-blue-700"
                            )}
                        >
                            {copyFeedback ? (
                                <>
                                    <span className="mr-1.5">✓</span> 已复制
                                </>
                            ) : (
                                <>
                                    <Copy size={16} className="mr-1.5" /> 复制内容
                                </>
                            )}
                        </button>
                    )}
                </div>
                </div>

                {/* Editor Area */}
                {selectedItem.type === 'prompt' ? (
                    <div className="flex-1 relative group flex flex-col">
                        {detectedVariables.length > 0 && (
                            <div className="bg-blue-50 border-b border-blue-100 p-3 grid grid-cols-2 gap-3 flex-shrink-0">
                                {detectedVariables.map(v => (
                                    <div key={v} className="flex items-center">
                                        <span className="text-xs font-mono text-blue-600 mr-2 bg-blue-100 px-1.5 py-0.5 rounded">{v}</span>
                                        <input 
                                            type="text" 
                                            placeholder="输入变量值..."
                                            value={variables[v] || ''}
                                            onChange={(e) => setVariables(prev => ({...prev, [v]: e.target.value}))}
                                            className="flex-1 text-sm border border-blue-200 rounded px-2 py-1 focus:outline-none focus:border-blue-400"
                                        />
                                    </div>
                                ))}
                            </div>
                        )}
                        <textarea
                            className="w-full h-full p-8 resize-none focus:outline-none text-slate-700 text-lg leading-relaxed font-mono bg-transparent"
                            placeholder="在这里输入提示词内容..."
                            value={localContent}
                            onChange={handleContentChange}
                            onFocus={() => setIsEditingContent(true)}
                            onBlur={handleContentBlur}
                            spellCheck={false}
                        />
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-300">
                        <Folder size={64} className="mb-4 opacity-50" />
                        <p>这是一个文件夹</p>
                        <p className="text-sm mt-2">请在左侧创建或选择一个提示词</p>
                    </div>
                )}
                
                {/* Status Bar */}
                <div className="h-8 border-t border-slate-100 bg-slate-50 flex items-center px-4 text-xs text-slate-400 justify-between flex-shrink-0">
                    <span>{selectedItem.type === 'prompt' ? `${selectedItem.content?.length || 0} 字符` : '文件夹'}</span>
                    <span>ID: {selectedItem.id.slice(0, 8)}</span>
                </div>
            </>
        ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-300 bg-slate-50/50">
                <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mb-4 shadow-sm">
                    <span className="text-2xl font-bold text-slate-400">P</span>
                </div>
                <h3 className="text-lg font-medium text-slate-600 mb-2">欢迎使用 Prompt Box</h3>
                <p className="text-sm text-slate-400 max-w-xs text-center">
                    从左侧选择一个提示词开始，或者点击 "+" 创建新的内容
                </p>
            </div>
        )}
      </div>
    </div>
  )
}

export default App
