export interface LocalFileEntry {
  file: File;
  relativePath: string;
  handle?: FileSystemFileHandle;
}

export function supportsFileSystemAccess(): boolean {
  return (
    typeof window !== 'undefined' &&
    'showDirectoryPicker' in window &&
    window.self === window.top
  );
}

export async function pickLocalDesktopDirectory(): Promise<{
  dirHandle: FileSystemDirectoryHandle;
  entries: LocalFileEntry[];
} | null> {
  const picker = (window as unknown as {
    showDirectoryPicker?: (opts?: { mode?: 'read' | 'readwrite' }) => Promise<FileSystemDirectoryHandle>;
  }).showDirectoryPicker;

  if (!picker) return null;

  const dirHandle = await picker({ mode: 'readwrite' });
  const entries: LocalFileEntry[] = [];

  for await (const [name, handle] of (dirHandle as unknown as {
    entries: () => AsyncIterable<[string, FileSystemHandle]>;
  }).entries()) {
    if (name.startsWith('.')) continue;
    if (handle.kind === 'file') {
      const fileHandle = handle as FileSystemFileHandle;
      const file = await fileHandle.getFile();
      entries.push({
        file,
        relativePath: name,
        handle: fileHandle,
      });
    }
  }

  return { dirHandle, entries };
}

export async function moveHandleToSubfolder(
  rootDir: FileSystemDirectoryHandle,
  fileHandle: FileSystemFileHandle,
  targetFolderName: string
): Promise<boolean> {
  try {
    const subDir = await rootDir.getDirectoryHandle(targetFolderName, { create: true });
    const movable = fileHandle as unknown as {
      move?: (dir: FileSystemDirectoryHandle) => Promise<void>;
    };
    if (typeof movable.move === 'function') {
      await movable.move(subDir);
      return true;
    }
    const file = await fileHandle.getFile();
    const newFileHandle = await subDir.getFileHandle(file.name, { create: true });
    const writable = await newFileHandle.createWritable();
    await writable.write(await file.arrayBuffer());
    await writable.close();
    await rootDir.removeEntry(file.name);
    return true;
  } catch {
    return false;
  }
}
