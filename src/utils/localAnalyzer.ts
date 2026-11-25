import {
  FileCategoryFlag,
  FolderNode,
  SemanticFileMatch,
  SemanticFolderMatch,
  SemanticSearchOutput,
  VaultFile,
} from '../types/files';

export interface LocalAnalysisResult {
  categoryFlag: FileCategoryFlag;
  suggestedFolder: string;
  tags: string[];
  isSensitive: boolean;
  sensitivityReason: string;
  summary: string;
}

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'that', 'this', 'from', 'your', 'are', 'was',
  'were', 'have', 'has', 'had', 'not', 'but', 'all', 'can', 'will', 'just',
  'into', 'about', 'file', 'files', 'folder', 'folders', 'document', 'documents',
  'my', 'me', 'our', 'or', 'of', 'in', 'on', 'to', 'a', 'an', 'is', 'it', 'by',
]);

const SEMANTIC_SYNONYMS: Record<string, string[]> = {
  student: ['students', 'class', 'pupil', 'cohort', 'roster', 'grading', 'submission', 'academic', 'course', 'semester'],
  students: ['student', 'class', 'pupil', 'cohort', 'roster', 'grading', 'submission', 'academic', 'course', 'semester'],
  exam: ['exams', 'midterm', 'final', 'quiz', 'test', 'paper', 'papers', 'assessment', 'rubric', 'question', 'academic'],
  exams: ['exam', 'midterm', 'final', 'quiz', 'test', 'paper', 'papers', 'assessment', 'rubric', 'question', 'academic'],
  paper: ['papers', 'pdf', 'exam', 'essay', 'worksheet', 'manuscript', 'document', 'question'],
  papers: ['paper', 'pdf', 'exam', 'essay', 'worksheet', 'manuscript', 'document', 'question'],
  pdf: ['pdfs', 'document', 'printable', 'scan'],
  pdfs: ['pdf', 'document', 'printable', 'scan'],
  tax: ['taxes', 'irs', 'w2', '1099', 'invoice', 'receipt', 'deduction', 'financial', 'accounting', 'fiscal'],
  invoice: ['invoices', 'receipt', 'billing', 'payment', 'financial', 'expense'],
  money: ['financial', 'tax', 'budget', 'invoice', 'expense', 'ledger', 'payroll', 'bank'],
  code: ['script', 'source', 'python', 'typescript', 'javascript', 'react', 'engineering', 'repo', 'api'],
  image: ['photo', 'screenshot', 'png', 'jpg', 'diagram', 'design', 'mockup', 'visual'],
  screenshot: ['screen', 'capture', 'image', 'png', 'ui', 'design'],
  contract: ['agreement', 'nda', 'legal', 'policy', 'signed', 'identity', 'passport', 'license'],
  legal: ['contract', 'agreement', 'nda', 'compliance', 'policy', 'id', 'passport'],
  old: ['archive', 'archived', '2023', '2024', '2025', 'legacy', 'backup'],
  slides: ['presentation', 'deck', 'keynote', 'pptx', 'lecture'],
};

export function extractReadableText(bytes: Uint8Array, extension: string, mimeType: string): string {
  const textExtensions = new Set([
    'txt', 'md', 'csv', 'json', 'ts', 'tsx', 'js', 'jsx', 'py', 'html', 'css',
    'xml', 'yaml', 'yml', 'sql', 'sh', 'log', 'env', 'tex', 'rtf',
  ]);

  if (textExtensions.has(extension.toLowerCase()) || mimeType.startsWith('text/')) {
    return new TextDecoder('utf-8', { fatal: false }).decode(bytes).slice(0, 12000);
  }

  if (extension.toLowerCase() === 'pdf' || mimeType === 'application/pdf') {
    const raw = new TextDecoder('latin1').decode(bytes);
    const matches: string[] = [];
    const literalRegex = /\(([^()\\]{3,160})\)/g;
    let m: RegExpExecArray | null;
    while ((m = literalRegex.exec(raw)) !== null && matches.length < 180) {
      const cleaned = m[1].replace(/[^\x20-\x7E]/g, ' ').trim();
      if (cleaned.length >= 3 && /[a-zA-Z]{2,}/.test(cleaned)) {
        matches.push(cleaned);
      }
    }
    const extracted = matches.join(' ').replace(/\s+/g, ' ').trim();
    if (extracted.length > 20) {
      return extracted.slice(0, 8000);
    }
  }

  return '';
}

export function redactSensitiveText(text: string): string {
  return text
    .replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[REDACTED_SSN]')
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[REDACTED_EMAIL]')
    .replace(/\b(?:\d[ -]*?){13,16}\b/g, '[REDACTED_CARD]');
}

export function analyzeFileLocally(
  fileName: string,
  extension: string,
  mimeType: string,
  extractedText: string
): LocalAnalysisResult {
  const lowerName = fileName.toLowerCase();
  const ext = extension.toLowerCase();
  const combined = `${lowerName} ${extractedText.toLowerCase()}`;

  let categoryFlag: FileCategoryFlag = 'Document';
  let suggestedFolder = 'General Documents';
  let isSensitive = false;
  let sensitivityReason = '';
  const tags = new Set<string>();

  if (ext) tags.add(ext);

  const hasAny = (terms: string[]) => terms.some((t) => combined.includes(t));

  if (hasAny(['exam', 'midterm', 'final', 'quiz', 'student', 'grading', 'rubric', 'syllabus', 'lecture', 'assignment', 'coursework', 'answer key'])) {
    categoryFlag = 'Exam & Academic';
    suggestedFolder = 'Academic & Exams';
    tags.add('academic');
    if (hasAny(['exam', 'midterm', 'final', 'quiz', 'test'])) tags.add('exam');
    if (hasAny(['student', 'roster', 'grade', 'grading', 'score'])) {
      tags.add('students');
      tags.add('grading');
    }
    if (hasAny(['answer key', 'exam', 'midterm', 'final', 'student', 'grade'])) {
      isSensitive = true;
      sensitivityReason = 'Exam & Student Data';
    }
  } else if (hasAny(['invoice', 'receipt', 'tax', 'w2', '1099', 'expense', 'ledger', 'payroll', 'bank', 'statement', 'budget', 'quarterly'])) {
    categoryFlag = 'Financial';
    suggestedFolder = 'Financial & Tax';
    tags.add('financial');
    if (hasAny(['tax', 'w2', '1099'])) tags.add('tax');
    if (hasAny(['invoice', 'receipt'])) tags.add('invoice');
    isSensitive = true;
    sensitivityReason = 'Financial Record';
  } else if (hasAny(['contract', 'nda', 'agreement', 'passport', 'license', 'legal', 'confidential', 'ssn', 'medical', 'insurance'])) {
    categoryFlag = 'Legal & ID';
    suggestedFolder = 'Legal & Identity';
    tags.add('legal');
    if (hasAny(['nda', 'contract', 'agreement'])) tags.add('contract');
    isSensitive = true;
    sensitivityReason = 'Confidential Legal / ID';
  } else if (['ts', 'tsx', 'js', 'jsx', 'py', 'go', 'rs', 'java', 'cpp', 'c', 'sh', 'sql', 'json', 'yaml', 'yml', 'html', 'css'].includes(ext)) {
    categoryFlag = 'Code & Script';
    suggestedFolder = 'Engineering & Code';
    tags.add('code');
    if (ext === 'py') tags.add('python');
    if (ext === 'ts' || ext === 'tsx') tags.add('typescript');
  } else if (['csv', 'xlsx', 'xls', 'ods', 'numbers'].includes(ext)) {
    categoryFlag = 'Spreadsheet';
    suggestedFolder = 'Data & Spreadsheets';
    tags.add('spreadsheet');
    tags.add('dataset');
  } else if (['ppt', 'pptx', 'key', 'odp'].includes(ext) || hasAny(['deck', 'slides', 'keynote', 'presentation'])) {
    categoryFlag = 'Presentation';
    suggestedFolder = 'Presentations';
    tags.add('slides');
  } else if (
    mimeType.startsWith('image/') ||
    mimeType.startsWith('video/') ||
    mimeType.startsWith('audio/') ||
    ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'fig', 'mp4', 'mov', 'mp3', 'wav'].includes(ext)
  ) {
    categoryFlag = 'Image & Media';
    suggestedFolder = 'Design & Media';
    tags.add('media');
    if (lowerName.includes('screenshot') || lowerName.includes('screen shot')) {
      tags.add('screenshot');
    }
  } else if (['zip', 'tar', 'gz', 'rar', '7z', 'dmg', 'pkg', 'iso'].includes(ext)) {
    categoryFlag = 'Archive';
    suggestedFolder = 'Archives & Installers';
    tags.add('archive');
  } else if (['md', 'txt', 'rtf'].includes(ext) || hasAny(['notes', 'meeting', 'minutes', 'journal', 'todo'])) {
    categoryFlag = 'Notes';
    suggestedFolder = 'Personal Notes';
    tags.add('notes');
  }

  // Extract additional high-signal tokens from filename and content
  const words = combined
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !STOP_WORDS.has(w) && !/^\d+$/.test(w));

  const freq = new Map<string, number>();
  for (const w of words) {
    freq.set(w, (freq.get(w) ?? 0) + 1);
  }
  const topWords = Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([w]) => w);

  for (const w of topWords) {
    if (tags.size < 6) tags.add(w);
  }

  const yearMatch = combined.match(/\b(202[0-9])\b/);
  if (yearMatch && tags.size < 6) {
    tags.add(yearMatch[1]);
  }

  const summary =
    extractedText.trim().length > 24
      ? `${categoryFlag} (${ext.toUpperCase() || 'FILE'}) analyzed locally: ${extractedText
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 140)}...`
      : `${categoryFlag} (${ext.toUpperCase() || 'FILE'}) organized under ${suggestedFolder}.`;

  return {
    categoryFlag,
    suggestedFolder,
    tags: Array.from(tags).slice(0, 6),
    isSensitive,
    sensitivityReason,
    summary,
  };
}

function tokenizeQuery(query: string): string[] {
  return query
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 2 && !STOP_WORDS.has(t));
}

function expandTokens(tokens: string[]): Set<string> {
  const expanded = new Set<string>();
  for (const token of tokens) {
    expanded.add(token);
    const syns = SEMANTIC_SYNONYMS[token];
    if (syns) {
      for (const s of syns) expanded.add(s);
    }
    if (token.endsWith('s') && token.length > 3) {
      expanded.add(token.slice(0, -1));
    }
  }
  return expanded;
}

export function runLocalKeywordSearch(
  query: string,
  files: VaultFile[],
  folders: FolderNode[]
): SemanticSearchOutput {
  const q = query.trim().toLowerCase();
  if (!q) {
    return {
      query,
      mode: 'keyword',
      engine: 'local',
      interpretation: 'Showing all files and folders',
      matchedFiles: files.map((file) => ({ file, score: 100, reason: 'All items' })),
      matchedFolders: [],
    };
  }

  const tokens = tokenizeQuery(q);
  const matchedFiles: SemanticFileMatch[] = [];

  for (const file of files) {
    const hay = `${file.name} ${file.extension} ${file.folderName} ${file.categoryFlag} ${file.tags.join(' ')} ${file.summary}`.toLowerCase();
    let hits = 0;
    const reasons: string[] = [];

    if (file.name.toLowerCase().includes(q)) {
      hits += 50;
      reasons.push('Filename match');
    }
    if (file.tags.some((t) => t.toLowerCase().includes(q))) {
      hits += 35;
      reasons.push('Tag match');
    }
    if (file.folderName.toLowerCase().includes(q)) {
      hits += 25;
      reasons.push(`In folder "${file.folderName}"`);
    }
    for (const tok of tokens) {
      if (hay.includes(tok)) {
        hits += 15;
      }
    }

    if (hits > 0) {
      matchedFiles.push({
        file,
        score: Math.min(100, hits),
        reason: reasons.length > 0 ? reasons.join(' · ') : `Matched keyword "${q}"`,
      });
    }
  }

  matchedFiles.sort((a, b) => b.score - a.score);

  const matchedFolders: SemanticFolderMatch[] = [];
  for (const folder of folders) {
    const fHay = `${folder.name} ${folder.description} ${folder.categoryFlag}`.toLowerCase();
    if (fHay.includes(q) || tokens.some((t) => fHay.includes(t))) {
      const count = files.filter((f) => f.folderName === folder.name && f.status !== 'archived').length;
      matchedFolders.push({
        folder,
        fileCount: count,
        score: folder.name.toLowerCase().includes(q) ? 95 : 70,
        reason: `Folder matches "${query}"`,
      });
    }
  }

  return {
    query,
    mode: 'keyword',
    engine: 'local',
    interpretation: `Keyword & tag matches for "${query}"`,
    matchedFiles,
    matchedFolders,
  };
}

export function runLocalSemanticSearch(
  query: string,
  files: VaultFile[],
  folders: FolderNode[]
): SemanticSearchOutput {
  const baseTokens = tokenizeQuery(query);
  const expanded = expandTokens(baseTokens);

  if (baseTokens.length === 0) {
    return runLocalKeywordSearch(query, files, folders);
  }

  const matchedFiles: SemanticFileMatch[] = [];
  for (const file of files) {
    const searchable = [
      file.name,
      file.extension,
      file.categoryFlag,
      file.folderName,
      file.tags.join(' '),
      file.summary,
      file.sensitivityReason,
    ]
      .join(' ')
      .toLowerCase();

    let score = 0;
    const hitTerms: string[] = [];

    for (const tok of baseTokens) {
      if (searchable.includes(tok)) {
        score += 24;
        hitTerms.push(tok);
      }
    }
    for (const syn of expanded) {
      if (!baseTokens.includes(syn) && searchable.includes(syn)) {
        score += 12;
        if (hitTerms.length < 4) hitTerms.push(syn);
      }
    }

    if (score >= 18) {
      matchedFiles.push({
        file,
        score: Math.min(99, score),
        reason: `Matches concepts: ${Array.from(new Set(hitTerms)).slice(0, 4).join(', ')}`,
      });
    }
  }

  matchedFiles.sort((a, b) => b.score - a.score);

  const matchedFolders: SemanticFolderMatch[] = [];
  for (const folder of folders) {
    const folderFiles = files.filter((f) => f.folderName === folder.name);
    const folderHay = `${folder.name} ${folder.description} ${folder.categoryFlag} ${folderFiles
      .map((f) => `${f.name} ${f.tags.join(' ')}`)
      .join(' ')}`.toLowerCase();

    let fScore = 0;
    const fHits: string[] = [];
    for (const tok of baseTokens) {
      if (folderHay.includes(tok)) {
        fScore += 26;
        fHits.push(tok);
      }
    }
    for (const syn of expanded) {
      if (!baseTokens.includes(syn) && folderHay.includes(syn)) {
        fScore += 14;
        if (fHits.length < 4) fHits.push(syn);
      }
    }

    if (fScore >= 24) {
      matchedFolders.push({
        folder,
        fileCount: folderFiles.filter((f) => f.status !== 'archived').length,
        score: Math.min(98, fScore),
        reason: `Folder & contents align with: ${Array.from(new Set(fHits)).slice(0, 3).join(', ')}`,
      });
    }
  }

  matchedFolders.sort((a, b) => b.score - a.score);

  return {
    query,
    mode: 'semantic',
    engine: 'local',
    interpretation: `Local private semantic match across ${expanded.size} related concepts (zero network egress).`,
    matchedFiles,
    matchedFolders,
  };
}
