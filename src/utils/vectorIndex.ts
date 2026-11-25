import { FolderNode, SemanticFileMatch, SemanticFolderMatch, VaultFile } from '../types/files';

const VECTOR_DIM = 192;
const VECTOR_DB_NAME = 'desksort-vector-index';
const VECTOR_STORE = 'embeddings';

export interface VectorRecord {
  id: string;
  kind: 'file' | 'folder';
  vector: number[];
  updatedAt: number;
}

const CONCEPT_GROUPS: string[][] = [
  ['student', 'students', 'exam', 'exams', 'midterm', 'final', 'quiz', 'test', 'paper', 'papers', 'grading', 'rubric', 'syllabus', 'academic', 'course', 'classroom'],
  ['tax', 'taxes', 'invoice', 'receipt', 'w2', '1099', 'financial', 'accounting', 'ledger', 'budget', 'expense', 'bank', 'payroll'],
  ['legal', 'contract', 'nda', 'agreement', 'passport', 'license', 'identity', 'compliance', 'policy', 'confidential'],
  ['code', 'script', 'python', 'typescript', 'javascript', 'react', 'api', 'server', 'sql', 'engineering', 'repo', 'json'],
  ['spreadsheet', 'csv', 'xlsx', 'table', 'dataset', 'rows', 'analytics', 'metrics'],
  ['presentation', 'slides', 'deck', 'keynote', 'pptx', 'lecture', 'pitch'],
  ['image', 'photo', 'screenshot', 'png', 'jpg', 'diagram', 'mockup', 'design', 'visual', 'media'],
  ['archive', 'zip', 'tar', 'backup', 'old', 'installer', 'dmg', 'compressed'],
  ['notes', 'meeting', 'journal', 'todo', 'memo', 'draft', 'markdown'],
];

function fnv1aHash(str: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function computeLocalEmbedding(text: string): number[] {
  const vec = new Float64Array(VECTOR_DIM);
  const clean = text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
  const tokens = clean.split(/\s+/).filter((t) => t.length >= 2);

  for (const tok of tokens) {
    const idx = fnv1aHash(`w:${tok}`) % VECTOR_DIM;
    vec[idx] += 2.0;

    // Character trigram features for morphological robustness (e.g. exam / exams / examination)
    if (tok.length >= 3) {
      for (let i = 0; i <= tok.length - 3; i++) {
        const tri = tok.slice(i, i + 3);
        const triIdx = fnv1aHash(`g:${tri}`) % VECTOR_DIM;
        vec[triIdx] += 0.45;
      }
    }

    // Concept cluster projection
    for (let gIdx = 0; gIdx < CONCEPT_GROUPS.length; gIdx++) {
      if (CONCEPT_GROUPS[gIdx].includes(tok)) {
        const cIdx = (160 + gIdx * 3) % VECTOR_DIM;
        vec[cIdx] += 2.4;
      }
    }
  }

  let norm = 0;
  for (let i = 0; i < VECTOR_DIM; i++) {
    norm += vec[i] * vec[i];
  }
  norm = Math.sqrt(norm) || 1;
  const out = new Array<number>(VECTOR_DIM);
  for (let i = 0; i < VECTOR_DIM; i++) {
    out[i] = Number((vec[i] / norm).toFixed(5));
  }
  return out;
}

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
  }
  return Math.max(0, Math.min(1, dot));
}

function openVectorDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(VECTOR_DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(VECTOR_STORE)) {
        db.createObjectStore(VECTOR_STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function upsertVectorIndex(
  files: VaultFile[],
  folders: FolderNode[]
): Promise<Map<string, VectorRecord>> {
  const db = await openVectorDB();
  const records: VectorRecord[] = [];
  const now = Date.now();

  for (const file of files) {
    const corpus = `${file.name} ${file.extension} ${file.categoryFlag} ${file.folderName} ${file.tags.join(' ')} ${file.summary} ${file.sensitivityReason}`;
    records.push({
      id: `file:${file.id}`,
      kind: 'file',
      vector: computeLocalEmbedding(corpus),
      updatedAt: now,
    });
  }

  for (const folder of folders) {
    const memberText = files
      .filter((f) => f.folderName === folder.name)
      .map((f) => `${f.name} ${f.tags.join(' ')}`)
      .join(' ');
    const corpus = `${folder.name} ${folder.description} ${folder.categoryFlag} ${memberText}`;
    records.push({
      id: `folder:${folder.id}`,
      kind: 'folder',
      vector: computeLocalEmbedding(corpus),
      updatedAt: now,
    });
  }

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(VECTOR_STORE, 'readwrite');
    const store = tx.objectStore(VECTOR_STORE);
    for (const r of records) {
      store.put(r);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });

  const map = new Map<string, VectorRecord>();
  for (const r of records) map.set(r.id, r);
  return map;
}

export async function getVectorIndexCount(): Promise<number> {
  const db = await openVectorDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(VECTOR_STORE, 'readonly');
    const store = tx.objectStore(VECTOR_STORE);
    const req = store.count();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export function queryLocalVectorStore(
  query: string,
  files: VaultFile[],
  folders: FolderNode[],
  vectors: Map<string, VectorRecord>
): { files: SemanticFileMatch[]; folders: SemanticFolderMatch[] } {
  const qVec = computeLocalEmbedding(query);

  const fileMatches: SemanticFileMatch[] = [];
  for (const file of files) {
    const rec = vectors.get(`file:${file.id}`);
    const vec =
      rec?.vector ??
      computeLocalEmbedding(
        `${file.name} ${file.extension} ${file.categoryFlag} ${file.folderName} ${file.tags.join(' ')} ${file.summary}`
      );
    const sim = cosineSimilarity(qVec, vec);
    if (sim >= 0.22) {
      fileMatches.push({
        file,
        score: Math.round(sim * 100),
        reason: `Vector similarity ${Math.round(sim * 100)}% across tags & summary`,
      });
    }
  }
  fileMatches.sort((a, b) => b.score - a.score);

  const folderMatches: SemanticFolderMatch[] = [];
  for (const folder of folders) {
    const rec = vectors.get(`folder:${folder.id}`);
    const vec =
      rec?.vector ??
      computeLocalEmbedding(`${folder.name} ${folder.description} ${folder.categoryFlag}`);
    const sim = cosineSimilarity(qVec, vec);
    if (sim >= 0.24) {
      folderMatches.push({
        folder,
        fileCount: files.filter((f) => f.folderName === folder.name && f.status !== 'archived').length,
        score: Math.round(sim * 100),
        reason: `Folder vector similarity ${Math.round(sim * 100)}%`,
      });
    }
  }
  folderMatches.sort((a, b) => b.score - a.score);

  return { files: fileMatches, folders: folderMatches };
}
