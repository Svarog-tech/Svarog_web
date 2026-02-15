import { apiCall } from '../lib/supabase';

export interface FileEntry {
  name: string;
  type: 'file' | 'directory';
  size: number;
  permissions: string;
  owner: string;
  group: string;
  modified: string;
}

export interface DirectoryListing {
  path: string;
  entries: FileEntry[];
}

export interface FileContent {
  content: string;
  path: string;
  size: number;
  too_large?: boolean;
}

export async function listDirectory(serviceId: number, dirPath: string): Promise<DirectoryListing> {
  const result = await apiCall<{ path: string; entries: FileEntry[] }>(
    `/hosting-services/${serviceId}/files/list?path=${encodeURIComponent(dirPath)}`
  );
  return { path: result.path, entries: result.entries || [] };
}

export async function readFile(serviceId: number, filePath: string): Promise<FileContent> {
  const result = await apiCall<FileContent>(
    `/hosting-services/${serviceId}/files/read?path=${encodeURIComponent(filePath)}`
  );
  return result;
}

export async function saveFile(serviceId: number, filePath: string, content: string): Promise<void> {
  await apiCall(`/hosting-services/${serviceId}/files/save`, {
    method: 'POST',
    body: JSON.stringify({ path: filePath, content }),
  });
}

export async function createDirectory(serviceId: number, dirPath: string): Promise<void> {
  await apiCall(`/hosting-services/${serviceId}/files/create-directory`, {
    method: 'POST',
    body: JSON.stringify({ path: dirPath }),
  });
}

export async function createFile(serviceId: number, filePath: string): Promise<void> {
  await apiCall(`/hosting-services/${serviceId}/files/create-file`, {
    method: 'POST',
    body: JSON.stringify({ path: filePath }),
  });
}

export async function deleteEntry(serviceId: number, filePath: string, type: 'file' | 'directory'): Promise<void> {
  await apiCall(`/hosting-services/${serviceId}/files/delete`, {
    method: 'DELETE',
    body: JSON.stringify({ path: filePath, type }),
  });
}

export async function renameEntry(serviceId: number, fromPath: string, toPath: string): Promise<void> {
  await apiCall(`/hosting-services/${serviceId}/files/rename`, {
    method: 'POST',
    body: JSON.stringify({ fromPath, toPath }),
  });
}

export async function copyEntry(serviceId: number, fromPath: string, toPath: string): Promise<void> {
  await apiCall(`/hosting-services/${serviceId}/files/copy`, {
    method: 'POST',
    body: JSON.stringify({ fromPath, toPath }),
  });
}

export async function changePermissions(serviceId: number, filePath: string, permissions: string): Promise<void> {
  await apiCall(`/hosting-services/${serviceId}/files/chmod`, {
    method: 'POST',
    body: JSON.stringify({ path: filePath, permissions }),
  });
}

export async function uploadFile(serviceId: number, dirPath: string, file: File): Promise<void> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64 = (reader.result as string).split(',')[1];
        await apiCall(`/hosting-services/${serviceId}/files/upload`, {
          method: 'POST',
          body: JSON.stringify({
            path: dirPath,
            filename: file.name,
            content: base64,
          }),
        });
        resolve();
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

export function getDownloadUrl(serviceId: number, filePath: string): string {
  const API_URL = process.env.REACT_APP_API_URL || '';
  // SECURITY: Přidej auth token do URL, protože download endpoint vyžaduje autentizaci
  // Token se čte z localStorage (stejně jako v apiCall)
  const token = localStorage.getItem('accessToken') || '';
  return `${API_URL}/api/hosting-services/${serviceId}/files/download?path=${encodeURIComponent(filePath)}&token=${encodeURIComponent(token)}`;
}

// Detekce jazyka podle přípony souboru
const LANGUAGE_MAP: Record<string, string> = {
  js: 'javascript', jsx: 'javascript', ts: 'typescript', tsx: 'typescript',
  html: 'html', htm: 'html', css: 'css', scss: 'scss', less: 'less',
  json: 'json', xml: 'xml', svg: 'xml', md: 'markdown', mdx: 'markdown',
  py: 'python', php: 'php', rb: 'ruby', rs: 'rust', go: 'go',
  java: 'java', kt: 'kotlin', swift: 'swift', c: 'c', cpp: 'cpp', h: 'c',
  cs: 'csharp', sql: 'sql', sh: 'shell', bash: 'shell', zsh: 'shell',
  yml: 'yaml', yaml: 'yaml', toml: 'ini', ini: 'ini', conf: 'ini',
  env: 'ini', htaccess: 'ini', nginx: 'ini',
  txt: 'plaintext', log: 'plaintext', csv: 'plaintext',
  dockerfile: 'dockerfile', makefile: 'plaintext',
};

export function getLanguageFromPath(filePath: string): string {
  const fileName = filePath.split('/').pop() || '';
  const ext = fileName.includes('.') ? fileName.split('.').pop()?.toLowerCase() || '' : fileName.toLowerCase();
  return LANGUAGE_MAP[ext] || 'plaintext';
}

// Detekce binárních souborů
const BINARY_EXTENSIONS = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'bmp', 'ico', 'webp',
  'zip', 'tar', 'gz', 'bz2', 'xz', '7z', 'rar',
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
  'mp3', 'mp4', 'avi', 'mov', 'mkv', 'wav', 'ogg', 'flac',
  'ttf', 'otf', 'woff', 'woff2', 'eot',
  'exe', 'dll', 'so', 'dylib', 'bin',
  'sqlite', 'db',
]);

export function isBinaryFile(filePath: string): boolean {
  const ext = filePath.split('.').pop()?.toLowerCase() || '';
  return BINARY_EXTENSIONS.has(ext);
}

export function isImageFile(filePath: string): boolean {
  const ext = filePath.split('.').pop()?.toLowerCase() || '';
  return ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'ico', 'webp', 'svg'].includes(ext);
}
