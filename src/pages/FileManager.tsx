import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowLeft, faFolder, faFolderOpen, faFile, faFileCode,
  faFileCsv, faFileImage, faFileArchive, faFilePdf,
  faPlus, faFolderPlus, faUpload, faDownload, faTrash,
  faSync, faCut, faCopy, faPaste, faEdit, faChevronRight,
  faHome, faTimes, faExclamationTriangle, faServer, faCode,
  faLock, faEllipsisV
} from '@fortawesome/free-solid-svg-icons';
import Editor from '@monaco-editor/react';
import { useAuth } from '../contexts/AuthContext';
import { getHostingService, HostingService } from '../lib/api';
import { useFileManager, OpenFile } from '../hooks/useFileManager';
import { FileEntry, getLanguageFromPath, isBinaryFile, isImageFile, getDownloadUrl } from '../services/fileManagerService';
import './FileManager.css';

// File icon helper
function getFileIcon(entry: FileEntry) {
  if (entry.type === 'directory') return faFolderOpen;
  const ext = entry.name.split('.').pop()?.toLowerCase() || '';
  if (['js', 'ts', 'jsx', 'tsx', 'php', 'py', 'rb', 'java', 'go', 'rs', 'c', 'cpp', 'sh'].includes(ext)) return faFileCode;
  if (['png', 'jpg', 'jpeg', 'gif', 'bmp', 'ico', 'webp', 'svg'].includes(ext)) return faFileImage;
  if (['zip', 'tar', 'gz', 'bz2', '7z', 'rar'].includes(ext)) return faFileArchive;
  if (ext === 'pdf') return faFilePdf;
  if (ext === 'csv') return faFileCsv;
  return faFile;
}

function getFileIconClass(entry: FileEntry): string {
  if (entry.type === 'directory') return 'folder';
  const ext = entry.name.split('.').pop()?.toLowerCase() || '';
  if (['js', 'jsx'].includes(ext)) return 'file-js';
  if (['ts', 'tsx'].includes(ext)) return 'file-ts';
  if (['html', 'htm'].includes(ext)) return 'file-html';
  if (['css', 'scss', 'less'].includes(ext)) return 'file-css';
  if (ext === 'php') return 'file-php';
  if (ext === 'py') return 'file-py';
  if (['json', 'yml', 'yaml'].includes(ext)) return 'file-json';
  if (['md', 'mdx'].includes(ext)) return 'file-md';
  if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(ext)) return 'file-img';
  return 'file';
}

function formatSize(bytes: number): string {
  if (bytes === 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

const FileManager: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [service, setService] = useState<HostingService | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);

  // Dialogs
  const [dialog, setDialog] = useState<{
    type: 'newFile' | 'newFolder' | 'rename' | 'delete' | null;
    target?: FileEntry;
  }>({ type: null });
  const [dialogValue, setDialogValue] = useState('');
  const uploadRef = useRef<HTMLInputElement>(null);

  // Load service
  useEffect(() => {
    if (user && id) {
      (async () => {
        try {
          const data = await getHostingService(Number(id));
          setService(data);
        } catch {
          setPageError('Nepodařilo se načíst službu');
        } finally {
          setPageLoading(false);
        }
      })();
    }
  }, [user, id]);

  const fm = useFileManager(
    service ? service.id : 0,
    service?.hestia_username || ''
  );

  // Dialog handlers
  const openDialog = useCallback((type: 'newFile' | 'newFolder' | 'rename' | 'delete', target?: FileEntry) => {
    setDialog({ type, target });
    setDialogValue(type === 'rename' && target ? target.name : '');
  }, []);

  const closeDialog = useCallback(() => {
    setDialog({ type: null });
    setDialogValue('');
  }, []);

  const handleDialogSubmit = useCallback(async () => {
    if (!dialogValue.trim() && dialog.type !== 'delete') return;
    try {
      switch (dialog.type) {
        case 'newFile':
          await fm.handleCreateFile(dialogValue.trim());
          break;
        case 'newFolder':
          await fm.handleCreateDirectory(dialogValue.trim());
          break;
        case 'rename':
          if (dialog.target) {
            await fm.handleRename(`${fm.currentPath}/${dialog.target.name}`, dialogValue.trim());
          }
          break;
        case 'delete':
          if (dialog.target) {
            await fm.handleDelete(`${fm.currentPath}/${dialog.target.name}`, dialog.target.type);
          }
          break;
      }
    } finally {
      closeDialog();
    }
  }, [dialog, dialogValue, fm, closeDialog]);

  // File list event handlers
  const handleEntryClick = useCallback((entry: FileEntry, e: React.MouseEvent) => {
    fm.selectItem(entry.name, e.ctrlKey || e.metaKey);
  }, [fm]);

  const handleEntryDoubleClick = useCallback((entry: FileEntry) => {
    if (entry.type === 'directory') {
      fm.navigateTo(`${fm.currentPath}/${entry.name}`);
    } else {
      fm.openFileInEditor(`${fm.currentPath}/${entry.name}`);
    }
  }, [fm]);

  const handleContextMenu = useCallback((e: React.MouseEvent, entry: FileEntry | null) => {
    e.preventDefault();
    fm.showContextMenu(e.clientX, e.clientY, entry);
  }, [fm]);

  const handleUploadChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      fm.handleUpload(e.target.files);
      e.target.value = '';
    }
  }, [fm]);

  // Sort entries: directories first, then files
  const sortedEntries = [...fm.entries].sort((a, b) => {
    if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  // Breadcrumb segments
  const breadcrumbSegments = fm.currentPath.split('/').filter(Boolean);

  // Active file
  const activeFile: OpenFile | null = fm.activeFileIndex >= 0 ? fm.openFiles[fm.activeFileIndex] : null;

  if (pageLoading) {
    return (
      <div className="fm-loading">
        <div className="loading-spinner"></div>
        <p>Načítání...</p>
      </div>
    );
  }

  if (pageError || !service) {
    return (
      <div className="fm-loading">
        <FontAwesomeIcon icon={faExclamationTriangle} style={{ fontSize: '2rem', color: '#ef4444' }} />
        <p>{pageError || 'Služba nenalezena'}</p>
        <Link to={`/services/${id}`} className="fm-back-btn">Zpět na službu</Link>
      </div>
    );
  }

  if (!service.hestia_created || !service.hestia_username) {
    return (
      <div className="fm-loading">
        <FontAwesomeIcon icon={faServer} style={{ fontSize: '2rem', color: 'var(--text-secondary)' }} />
        <p>HestiaCP účet ještě nebyl vytvořen</p>
        <Link to={`/services/${id}`} className="fm-back-btn">Zpět na službu</Link>
      </div>
    );
  }

  return (
    <div className="fm-page">
      {/* Top Bar */}
      <div className="fm-topbar">
        <div className="fm-topbar-left">
          <Link to={`/services/${id}`} className="fm-back-btn">
            <FontAwesomeIcon icon={faArrowLeft} />
            Zpět
          </Link>
          <h1 className="fm-topbar-title">
            Správce souborů — {service.hestia_domain || service.plan_name}
          </h1>
        </div>

        <div className="fm-toolbar">
          <button className="fm-toolbar-btn" onClick={() => openDialog('newFile')} title="Nový soubor">
            <FontAwesomeIcon icon={faPlus} />
            <span>Soubor</span>
          </button>
          <button className="fm-toolbar-btn" onClick={() => openDialog('newFolder')} title="Nová složka">
            <FontAwesomeIcon icon={faFolderPlus} />
            <span>Složka</span>
          </button>
          <div className="fm-toolbar-sep" />
          <button className="fm-toolbar-btn" onClick={() => uploadRef.current?.click()} title="Nahrát soubor">
            <FontAwesomeIcon icon={faUpload} />
            <span>Nahrát</span>
          </button>
          <input
            ref={uploadRef}
            type="file"
            multiple
            style={{ display: 'none' }}
            onChange={handleUploadChange}
          />
          <div className="fm-toolbar-sep" />
          {fm.selectedItems.size > 0 && (
            <>
              <button
                className="fm-toolbar-btn"
                onClick={() => {
                  const name = Array.from(fm.selectedItems)[0];
                  const entry = fm.entries.find(e => e.name === name);
                  if (entry) openDialog('rename', entry);
                }}
                title="Přejmenovat"
              >
                <FontAwesomeIcon icon={faEdit} />
              </button>
              <button
                className="fm-toolbar-btn danger"
                onClick={() => {
                  const name = Array.from(fm.selectedItems)[0];
                  const entry = fm.entries.find(e => e.name === name);
                  if (entry) openDialog('delete', entry);
                }}
                title="Smazat"
              >
                <FontAwesomeIcon icon={faTrash} />
              </button>
              <div className="fm-toolbar-sep" />
            </>
          )}
          <button className="fm-toolbar-btn" onClick={fm.refresh} title="Obnovit">
            <FontAwesomeIcon icon={faSync} />
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {fm.error && (
        <div className="fm-error-banner">
          <span><FontAwesomeIcon icon={faExclamationTriangle} /> {fm.error}</span>
          <button className="fm-error-close" onClick={() => fm.clearError()}>
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>
      )}

      {/* Main Layout */}
      <div className="fm-main">
        {/* Sidebar — File Tree */}
        <div className="fm-sidebar">
          <div className="fm-sidebar-header">Soubory</div>
          <div className="fm-tree">
            <TreeNode
              serviceId={service.id}
              name={service.hestia_username}
              path={`/home/${service.hestia_username}`}
              type="directory"
              depth={0}
              fm={fm}
              onFileClick={(path) => fm.openFileInEditor(path)}
              onDirClick={(path) => fm.navigateTo(path)}
              onContextMenu={handleContextMenu}
            />
          </div>
        </div>

        {/* Content */}
        <div className="fm-content">
          {/* Breadcrumb */}
          <div className="fm-breadcrumb">
            <button
              className="fm-breadcrumb-item"
              onClick={() => fm.navigateTo(`/home/${service.hestia_username}`)}
            >
              <FontAwesomeIcon icon={faHome} />
            </button>
            {breadcrumbSegments.map((segment, i) => {
              const segmentPath = '/' + breadcrumbSegments.slice(0, i + 1).join('/');
              const isLast = i === breadcrumbSegments.length - 1;
              return (
                <React.Fragment key={segmentPath}>
                  <span className="fm-breadcrumb-sep">
                    <FontAwesomeIcon icon={faChevronRight} />
                  </span>
                  <button
                    className={`fm-breadcrumb-item ${isLast ? 'active' : ''}`}
                    onClick={() => fm.navigateTo(segmentPath)}
                  >
                    {segment}
                  </button>
                </React.Fragment>
              );
            })}
          </div>

          {/* Editor Tabs */}
          {fm.openFiles.length > 0 && (
            <div className="fm-tabs">
              {fm.openFiles.map((file, i) => {
                const fileName = file.path.split('/').pop() || file.path;
                return (
                  <button
                    key={file.path}
                    className={`fm-tab ${i === fm.activeFileIndex ? 'active' : ''}`}
                    onClick={() => fm.setActiveFile(i)}
                  >
                    {file.isDirty && <span className="fm-tab-dirty" />}
                    <span className="fm-tab-name">{fileName}</span>
                    <span
                      className="fm-tab-close"
                      onClick={(e) => { e.stopPropagation(); fm.closeFile(i); }}
                    >
                      <FontAwesomeIcon icon={faTimes} />
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Editor or File List */}
          {activeFile ? (
            <div className="fm-editor-area">
              <Editor
                height="100%"
                language={activeFile.language}
                value={activeFile.content}
                theme="vs-dark"
                onChange={(value) => fm.updateFileContent(fm.activeFileIndex, value || '')}
                options={{
                  minimap: { enabled: true },
                  fontSize: 14,
                  wordWrap: 'on',
                  lineNumbers: 'on',
                  renderWhitespace: 'selection',
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                  tabSize: 2,
                }}
              />
            </div>
          ) : (
            <div className="fm-filelist">
              {fm.loading ? (
                <div className="fm-empty">
                  <div className="loading-spinner"></div>
                  <p>Načítání...</p>
                </div>
              ) : sortedEntries.length === 0 ? (
                <div className="fm-empty">
                  <FontAwesomeIcon icon={faFolder} />
                  <p>Prázdný adresář</p>
                </div>
              ) : (
                <table className="fm-filelist-table">
                  <thead>
                    <tr>
                      <th>Název</th>
                      <th>Velikost</th>
                      <th>Oprávnění</th>
                      <th>Změněno</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedEntries.map(entry => (
                      <tr
                        key={entry.name}
                        className={fm.selectedItems.has(entry.name) ? 'selected' : ''}
                        onClick={(e) => handleEntryClick(entry, e)}
                        onDoubleClick={() => handleEntryDoubleClick(entry)}
                        onContextMenu={(e) => handleContextMenu(e, entry)}
                      >
                        <td>
                          <div className="fm-file-name-cell">
                            <span className={`fm-file-icon fm-tree-icon ${getFileIconClass(entry)}`}>
                              <FontAwesomeIcon icon={getFileIcon(entry)} />
                            </span>
                            {entry.name}
                          </div>
                        </td>
                        <td className="fm-file-size">
                          {entry.type === 'directory' ? '—' : formatSize(entry.size)}
                        </td>
                        <td className="fm-file-perms">{entry.permissions}</td>
                        <td className="fm-file-date">{entry.modified}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Status Bar */}
      <div className="fm-statusbar">
        <div className="fm-statusbar-left">
          <span>{fm.currentPath}</span>
          <span>{fm.entries.length} položek</span>
        </div>
        <div className="fm-statusbar-right">
          {activeFile && (
            <>
              <span>{activeFile.language}</span>
              <span>{activeFile.isDirty ? 'Neuloženo' : 'Uloženo'}</span>
              <span>Ctrl+S pro uložení</span>
            </>
          )}
        </div>
      </div>

      {/* Context Menu */}
      {fm.contextMenu && (
        <>
          <div className="fm-context-overlay" onClick={fm.hideContextMenu} />
          <div
            className="fm-context-menu"
            style={{ left: fm.contextMenu.x, top: fm.contextMenu.y }}
          >
            {fm.contextMenu.target ? (
              <>
                {fm.contextMenu.target.type === 'file' && (
                  <button
                    className="fm-context-item"
                    onClick={() => {
                      fm.openFileInEditor(`${fm.currentPath}/${fm.contextMenu!.target!.name}`);
                      fm.hideContextMenu();
                    }}
                  >
                    <FontAwesomeIcon icon={faCode} /> Otevřít v editoru
                  </button>
                )}
                {fm.contextMenu.target.type === 'directory' && (
                  <button
                    className="fm-context-item"
                    onClick={() => {
                      fm.navigateTo(`${fm.currentPath}/${fm.contextMenu!.target!.name}`);
                      fm.hideContextMenu();
                    }}
                  >
                    <FontAwesomeIcon icon={faFolderOpen} /> Otevřít
                  </button>
                )}
                {fm.contextMenu.target.type === 'file' && (
                  <a
                    className="fm-context-item"
                    href={getDownloadUrl(service.id, `${fm.currentPath}/${fm.contextMenu.target.name}`)}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={fm.hideContextMenu}
                    style={{ textDecoration: 'none', color: 'inherit' }}
                  >
                    <FontAwesomeIcon icon={faDownload} /> Stáhnout
                  </a>
                )}
                <div className="fm-context-sep" />
                <button
                  className="fm-context-item"
                  onClick={() => {
                    openDialog('rename', fm.contextMenu!.target!);
                    fm.hideContextMenu();
                  }}
                >
                  <FontAwesomeIcon icon={faEdit} /> Přejmenovat
                </button>
                <button
                  className="fm-context-item danger"
                  onClick={() => {
                    openDialog('delete', fm.contextMenu!.target!);
                    fm.hideContextMenu();
                  }}
                >
                  <FontAwesomeIcon icon={faTrash} /> Smazat
                </button>
              </>
            ) : (
              <>
                <button
                  className="fm-context-item"
                  onClick={() => { openDialog('newFile'); fm.hideContextMenu(); }}
                >
                  <FontAwesomeIcon icon={faPlus} /> Nový soubor
                </button>
                <button
                  className="fm-context-item"
                  onClick={() => { openDialog('newFolder'); fm.hideContextMenu(); }}
                >
                  <FontAwesomeIcon icon={faFolderPlus} /> Nová složka
                </button>
                <div className="fm-context-sep" />
                <button
                  className="fm-context-item"
                  onClick={() => { uploadRef.current?.click(); fm.hideContextMenu(); }}
                >
                  <FontAwesomeIcon icon={faUpload} /> Nahrát soubor
                </button>
              </>
            )}
          </div>
        </>
      )}

      {/* Dialogs */}
      {dialog.type && (
        <div className="fm-dialog-overlay" onClick={closeDialog}>
          <div className="fm-dialog" onClick={e => e.stopPropagation()}>
            {dialog.type === 'newFile' && (
              <>
                <h3>Nový soubor</h3>
                <input
                  className="fm-dialog-input"
                  placeholder="index.html"
                  value={dialogValue}
                  onChange={e => setDialogValue(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleDialogSubmit()}
                  autoFocus
                />
                <div className="fm-dialog-actions">
                  <button className="fm-dialog-btn secondary" onClick={closeDialog}>Zrušit</button>
                  <button className="fm-dialog-btn primary" onClick={handleDialogSubmit}>Vytvořit</button>
                </div>
              </>
            )}
            {dialog.type === 'newFolder' && (
              <>
                <h3>Nová složka</h3>
                <input
                  className="fm-dialog-input"
                  placeholder="nova-slozka"
                  value={dialogValue}
                  onChange={e => setDialogValue(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleDialogSubmit()}
                  autoFocus
                />
                <div className="fm-dialog-actions">
                  <button className="fm-dialog-btn secondary" onClick={closeDialog}>Zrušit</button>
                  <button className="fm-dialog-btn primary" onClick={handleDialogSubmit}>Vytvořit</button>
                </div>
              </>
            )}
            {dialog.type === 'rename' && (
              <>
                <h3>Přejmenovat</h3>
                <input
                  className="fm-dialog-input"
                  value={dialogValue}
                  onChange={e => setDialogValue(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleDialogSubmit()}
                  autoFocus
                />
                <div className="fm-dialog-actions">
                  <button className="fm-dialog-btn secondary" onClick={closeDialog}>Zrušit</button>
                  <button className="fm-dialog-btn primary" onClick={handleDialogSubmit}>Přejmenovat</button>
                </div>
              </>
            )}
            {dialog.type === 'delete' && dialog.target && (
              <>
                <h3>Smazat {dialog.target.type === 'directory' ? 'složku' : 'soubor'}</h3>
                <p style={{ color: 'var(--text-secondary)', margin: '0 0 0.5rem 0', fontSize: '0.875rem' }}>
                  Opravdu chcete smazat <strong>{dialog.target.name}</strong>?
                  {dialog.target.type === 'directory' && ' Včetně veškerého obsahu.'}
                </p>
                <div className="fm-dialog-warning">
                  <FontAwesomeIcon icon={faExclamationTriangle} />
                  Tuto akci nelze vrátit zpět.
                </div>
                <div className="fm-dialog-actions">
                  <button className="fm-dialog-btn secondary" onClick={closeDialog}>Zrušit</button>
                  <button className="fm-dialog-btn danger" onClick={handleDialogSubmit}>Smazat</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================
// TREE NODE COMPONENT (recursive)
// ============================================

interface TreeNodeProps {
  serviceId: number;
  name: string;
  path: string;
  type: 'file' | 'directory';
  depth: number;
  fm: ReturnType<typeof useFileManager>;
  onFileClick: (path: string) => void;
  onDirClick: (path: string) => void;
  onContextMenu: (e: React.MouseEvent, entry: FileEntry | null) => void;
}

const TreeNode: React.FC<TreeNodeProps> = ({
  serviceId, name, path, type, depth, fm, onFileClick, onDirClick, onContextMenu
}) => {
  const isExpanded = fm.expandedFolders.has(path);
  const isActive = fm.currentPath === path;
  const children = fm.treeCache[path] || [];

  const handleClick = () => {
    if (type === 'directory') {
      fm.toggleFolder(path);
      onDirClick(path);
    } else {
      onFileClick(path);
    }
  };

  const entry: FileEntry = {
    name, type, size: 0, permissions: '', owner: '', group: '', modified: ''
  };

  return (
    <>
      <div
        className={`fm-tree-item ${isActive ? 'active' : ''}`}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        onClick={handleClick}
        onContextMenu={(e) => onContextMenu(e, entry)}
      >
        {type === 'directory' && (
          <span className={`fm-tree-expand ${isExpanded ? 'expanded' : ''}`}>
            <FontAwesomeIcon icon={faChevronRight} />
          </span>
        )}
        {type !== 'directory' && <span style={{ width: 16 }} />}
        <span className={`fm-tree-icon ${getFileIconClass(entry)}`}>
          <FontAwesomeIcon icon={type === 'directory' ? (isExpanded ? faFolderOpen : faFolder) : getFileIcon(entry)} />
        </span>
        <span className="fm-tree-name">{name}</span>
      </div>
      {type === 'directory' && isExpanded && children
        .sort((a, b) => {
          if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
          return a.name.localeCompare(b.name);
        })
        .map(child => (
          <TreeNode
            key={child.name}
            serviceId={serviceId}
            name={child.name}
            path={`${path}/${child.name}`}
            type={child.type}
            depth={depth + 1}
            fm={fm}
            onFileClick={onFileClick}
            onDirClick={onDirClick}
            onContextMenu={onContextMenu}
          />
        ))
      }
    </>
  );
};

export default FileManager;
