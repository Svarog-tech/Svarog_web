import { useState, useCallback, useEffect, useRef } from 'react';
import {
  FileEntry, listDirectory, readFile, saveFile, createFile, createDirectory,
  deleteEntry, renameEntry, uploadFile, getLanguageFromPath, isBinaryFile
} from '../services/fileManagerService';

export interface OpenFile {
  path: string;
  content: string;
  originalContent: string;
  language: string;
  isDirty: boolean;
}

export interface ContextMenuState {
  x: number;
  y: number;
  target: FileEntry | null;
}

interface UseFileManagerReturn {
  // Navigation
  currentPath: string;
  entries: FileEntry[];
  loading: boolean;
  error: string | null;

  // Editor
  openFiles: OpenFile[];
  activeFileIndex: number;

  // Selection
  selectedItems: Set<string>;

  // Context menu
  contextMenu: ContextMenuState | null;

  // Tree
  expandedFolders: Set<string>;
  treeCache: Record<string, FileEntry[]>;

  // Actions
  clearError: () => void;
  navigateTo: (path: string) => Promise<void>;
  openFileInEditor: (path: string) => Promise<void>;
  closeFile: (index: number) => void;
  setActiveFile: (index: number) => void;
  saveActiveFile: () => Promise<void>;
  updateFileContent: (index: number, content: string) => void;
  handleCreateFile: (name: string) => Promise<void>;
  handleCreateDirectory: (name: string) => Promise<void>;
  handleDelete: (path: string, type: 'file' | 'directory') => Promise<void>;
  handleRename: (fromPath: string, newName: string) => Promise<void>;
  handleUpload: (files: FileList) => Promise<void>;
  selectItem: (name: string, multi?: boolean) => void;
  clearSelection: () => void;
  showContextMenu: (x: number, y: number, target: FileEntry | null) => void;
  hideContextMenu: () => void;
  toggleFolder: (path: string) => Promise<void>;
  refresh: () => Promise<void>;
}

export function useFileManager(serviceId: number, hestiaUsername: string): UseFileManagerReturn {
  const homePath = `/home/${hestiaUsername}`;
  const [currentPath, setCurrentPath] = useState(homePath);
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openFiles, setOpenFiles] = useState<OpenFile[]>([]);
  const [activeFileIndex, setActiveFileIndex] = useState(-1);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set([homePath]));
  const [treeCache, setTreeCache] = useState<Record<string, FileEntry[]>>({});
  const savingRef = useRef(false);

  // Načti adresář
  const navigateTo = useCallback(async (path: string) => {
    try {
      setLoading(true);
      setError(null);
      const result = await listDirectory(serviceId, path);
      setEntries(result.entries);
      setCurrentPath(result.path);
      setSelectedItems(new Set());
      // Cache pro strom
      setTreeCache(prev => ({ ...prev, [result.path]: result.entries }));
    } catch (err: any) {
      setError(err.message || 'Nepodařilo se načíst adresář');
    } finally {
      setLoading(false);
    }
  }, [serviceId]);

  // Otevři soubor v editoru
  const openFileInEditor = useCallback(async (filePath: string) => {
    if (isBinaryFile(filePath)) {
      // Binární soubory neotevíráme v editoru
      return;
    }

    // Už je otevřený?
    const existingIndex = openFiles.findIndex(f => f.path === filePath);
    if (existingIndex >= 0) {
      setActiveFileIndex(existingIndex);
      return;
    }

    try {
      setLoading(true);
      const result = await readFile(serviceId, filePath);
      if (result.too_large) {
        setError('Soubor je příliš velký pro editor (max 5 MB). Použijte stažení.');
        return;
      }
      const newFile: OpenFile = {
        path: filePath,
        content: result.content,
        originalContent: result.content,
        language: getLanguageFromPath(filePath),
        isDirty: false,
      };
      setOpenFiles(prev => {
        const updated = [...prev, newFile];
        setActiveFileIndex(updated.length - 1);
        return updated;
      });
    } catch (err: any) {
      setError(err.message || 'Nepodařilo se otevřít soubor');
    } finally {
      setLoading(false);
    }
  }, [serviceId, openFiles]);

  // Zavři soubor
  const closeFile = useCallback((index: number) => {
    setOpenFiles(prev => {
      const updated = prev.filter((_, i) => i !== index);
      setActiveFileIndex(prevActive => {
        if (updated.length === 0) return -1;
        if (prevActive >= updated.length) return updated.length - 1;
        if (prevActive > index) return prevActive - 1;
        return prevActive;
      });
      return updated;
    });
  }, []);

  // Nastav aktivní soubor
  const setActiveFile = useCallback((index: number) => {
    setActiveFileIndex(index);
  }, []);

  // Aktualizuj obsah souboru (při editaci)
  const updateFileContent = useCallback((index: number, content: string) => {
    setOpenFiles(prev => prev.map((f, i) =>
      i === index ? { ...f, content, isDirty: content !== f.originalContent } : f
    ));
  }, []);

  // Ulož aktivní soubor
  const saveActiveFile = useCallback(async () => {
    if (activeFileIndex < 0 || activeFileIndex >= openFiles.length) return;
    if (savingRef.current) return;

    const file = openFiles[activeFileIndex];
    if (!file.isDirty) return;

    try {
      savingRef.current = true;
      await saveFile(serviceId, file.path, file.content);
      setOpenFiles(prev => prev.map((f, i) =>
        i === activeFileIndex ? { ...f, originalContent: f.content, isDirty: false } : f
      ));
    } catch (err: any) {
      setError(err.message || 'Nepodařilo se uložit soubor');
    } finally {
      savingRef.current = false;
    }
  }, [serviceId, activeFileIndex, openFiles]);

  // SECURITY: Validace názvu souboru/složky
  const validateName = useCallback((name: string): string | null => {
    if (!name || name.length === 0) return 'Název nesmí být prázdný';
    if (name.length > 255) return 'Název je příliš dlouhý (max 255 znaků)';
    if (name.includes('/') || name.includes('\\') || name.includes('\0')) return 'Název obsahuje nepovolené znaky';
    if (name.includes('..')) return 'Název nesmí obsahovat ".."';
    if (name.startsWith('.') && name.length === 1) return 'Neplatný název';
    return null;
  }, []);

  // Vytvoř soubor
  const handleCreateFile = useCallback(async (name: string) => {
    const nameError = validateName(name);
    if (nameError) {
      setError(nameError);
      return;
    }
    const filePath = `${currentPath}/${name}`;
    try {
      await createFile(serviceId, filePath);
      await navigateTo(currentPath);
    } catch (err: any) {
      setError(err.message || 'Nepodařilo se vytvořit soubor');
    }
  }, [serviceId, currentPath, navigateTo, validateName]);

  // Vytvoř složku
  const handleCreateDirectory = useCallback(async (name: string) => {
    const nameError = validateName(name);
    if (nameError) {
      setError(nameError);
      return;
    }
    const dirPath = `${currentPath}/${name}`;
    try {
      await createDirectory(serviceId, dirPath);
      await navigateTo(currentPath);
    } catch (err: any) {
      setError(err.message || 'Nepodařilo se vytvořit složku');
    }
  }, [serviceId, currentPath, navigateTo, validateName]);

  // Smaž
  const handleDelete = useCallback(async (path: string, type: 'file' | 'directory') => {
    try {
      await deleteEntry(serviceId, path, type);
      // Zavři soubor pokud je otevřený
      const openIndex = openFiles.findIndex(f => f.path === path);
      if (openIndex >= 0) {
        closeFile(openIndex);
      }
      await navigateTo(currentPath);
    } catch (err: any) {
      setError(err.message || 'Nepodařilo se smazat');
    }
  }, [serviceId, currentPath, navigateTo, openFiles, closeFile]);

  // Přejmenuj
  const handleRename = useCallback(async (fromPath: string, newName: string) => {
    const nameError = validateName(newName);
    if (nameError) {
      setError(nameError);
      return;
    }
    const parentDir = fromPath.substring(0, fromPath.lastIndexOf('/'));
    const toPath = `${parentDir}/${newName}`;
    try {
      await renameEntry(serviceId, fromPath, toPath);
      // Aktualizuj otevřené soubory
      setOpenFiles(prev => prev.map(f =>
        f.path === fromPath ? { ...f, path: toPath } : f
      ));
      await navigateTo(currentPath);
    } catch (err: any) {
      setError(err.message || 'Nepodařilo se přejmenovat');
    }
  }, [serviceId, currentPath, navigateTo, validateName]);

  // Upload
  const handleUpload = useCallback(async (files: FileList) => {
    try {
      for (let i = 0; i < files.length; i++) {
        await uploadFile(serviceId, currentPath, files[i]);
      }
      await navigateTo(currentPath);
    } catch (err: any) {
      setError(err.message || 'Nepodařilo se nahrát soubor');
    }
  }, [serviceId, currentPath, navigateTo]);

  // Selekce
  const selectItem = useCallback((name: string, multi = false) => {
    setSelectedItems(prev => {
      if (multi) {
        const next = new Set(prev);
        if (next.has(name)) next.delete(name);
        else next.add(name);
        return next;
      }
      return new Set([name]);
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedItems(new Set());
  }, []);

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Context menu
  const showContextMenu = useCallback((x: number, y: number, target: FileEntry | null) => {
    setContextMenu({ x, y, target });
  }, []);

  const hideContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  // Tree expand/collapse
  const toggleFolder = useCallback(async (folderPath: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(folderPath)) {
        next.delete(folderPath);
      } else {
        next.add(folderPath);
      }
      return next;
    });
    // Načti obsah pokud není v cache
    if (!treeCache[folderPath]) {
      try {
        const result = await listDirectory(serviceId, folderPath);
        setTreeCache(prev => ({ ...prev, [folderPath]: result.entries }));
      } catch {
        // Tiše selže
      }
    }
  }, [serviceId, treeCache]);

  // Refresh
  const refresh = useCallback(async () => {
    await navigateTo(currentPath);
  }, [currentPath, navigateTo]);

  // Initial load
  useEffect(() => {
    if (serviceId && hestiaUsername) {
      navigateTo(homePath);
    }
  }, [serviceId, hestiaUsername, homePath, navigateTo]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ctrl+S: Save
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        saveActiveFile();
      }
      // Ctrl+W: Close tab
      if ((e.ctrlKey || e.metaKey) && e.key === 'w') {
        e.preventDefault();
        if (activeFileIndex >= 0) {
          closeFile(activeFileIndex);
        }
      }
      // Escape: Close context menu
      if (e.key === 'Escape') {
        hideContextMenu();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [saveActiveFile, activeFileIndex, closeFile, hideContextMenu]);

  return {
    currentPath, entries, loading, error,
    openFiles, activeFileIndex,
    selectedItems,
    contextMenu,
    expandedFolders, treeCache,
    clearError,
    navigateTo, openFileInEditor, closeFile, setActiveFile, saveActiveFile,
    updateFileContent,
    handleCreateFile, handleCreateDirectory, handleDelete, handleRename, handleUpload,
    selectItem, clearSelection,
    showContextMenu, hideContextMenu,
    toggleFolder, refresh,
  };
}
