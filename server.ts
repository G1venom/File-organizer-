import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const DATA_DIR = path.resolve(__dirname, 'data');
const ARCHIVE_FILE = path.join(DATA_DIR, 'cloud-archive.json');

interface CloudArchiveRecord {
  id: string;
  name: string;
  extension: string;
  mimeType: string;
  size: number;
  categoryFlag: string;
  folderName: string;
  tags: string[];
  isSensitive: boolean;
  summary: string;
  sha256: string;
  ivBase64: string;
  encryptedPayloadBase64: string;
  originalCreatedAt: number;
  archivedAt: number;
}

function ensureArchiveStore(): CloudArchiveRecord[] {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(ARCHIVE_FILE)) {
    fs.writeFileSync(ARCHIVE_FILE, '[]', 'utf8');
    return [];
  }
  try {
    const raw = fs.readFileSync(ARCHIVE_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeArchiveStore(records: CloudArchiveRecord[]): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(ARCHIVE_FILE, JSON.stringify(records, null, 2), 'utf8');
}

function getAiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '25mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      timestamp: Date.now(),
      aiConfigured: Boolean(getAiClient()),
    });
  });

  app.get('/api/archive', (_req, res) => {
    const records = ensureArchiveStore();
    res.json({ records });
  });

  app.post('/api/archive', (req, res) => {
    const body = req.body as Partial<CloudArchiveRecord>;
    if (!body.id || !body.name || !body.encryptedPayloadBase64 || !body.ivBase64) {
      res.status(400).json({ error: 'Missing required encrypted archive fields.' });
      return;
    }

    const records = ensureArchiveStore();
    const nextRecord: CloudArchiveRecord = {
      id: String(body.id),
      name: String(body.name),
      extension: String(body.extension ?? ''),
      mimeType: String(body.mimeType ?? 'application/octet-stream'),
      size: Number(body.size ?? 0),
      categoryFlag: String(body.categoryFlag ?? 'Document'),
      folderName: String(body.folderName ?? 'General'),
      tags: Array.isArray(body.tags) ? body.tags.map(String) : [],
      isSensitive: Boolean(body.isSensitive),
      summary: String(body.summary ?? ''),
      sha256: String(body.sha256 ?? ''),
      ivBase64: String(body.ivBase64),
      encryptedPayloadBase64: String(body.encryptedPayloadBase64),
      originalCreatedAt: Number(body.originalCreatedAt ?? Date.now()),
      archivedAt: Number(body.archivedAt ?? Date.now()),
    };

    const existingIdx = records.findIndex((r) => r.id === nextRecord.id);
    if (existingIdx >= 0) {
      records[existingIdx] = nextRecord;
    } else {
      records.unshift(nextRecord);
    }
    writeArchiveStore(records);
    res.status(201).json({ record: nextRecord });
  });

  app.delete('/api/archive/:id', (req, res) => {
    const { id } = req.params;
    const records = ensureArchiveStore();
    const target = records.find((r) => r.id === id);
    if (!target) {
      res.status(404).json({ error: 'Archived file not found.' });
      return;
    }
    const filtered = records.filter((r) => r.id !== id);
    writeArchiveStore(filtered);
    res.json({ restored: target });
  });

  app.post('/api/ai/analyze', async (req, res) => {
    const ai = getAiClient();
    if (!ai) {
      res.status(503).json({
        error: 'Gemini API key is not configured on the server. Using local privacy analyzer.',
      });
      return;
    }

    const { fileName, extension, mimeType, excerpt, existingFolders } = req.body as {
      fileName?: string;
      extension?: string;
      mimeType?: string;
      excerpt?: string;
      existingFolders?: string[];
    };

    if (!fileName) {
      res.status(400).json({ error: 'fileName is required.' });
      return;
    }

    try {
      const folderHint =
        Array.isArray(existingFolders) && existingFolders.length > 0
          ? `Existing folders: ${existingFolders.join(', ')}. Reuse an existing folder if it fits well, or propose a crisp new folder name (2-3 words max).`
          : 'Propose a clean, logical designated folder name (2-3 words max, e.g., Academic & Exams, Financial & Tax, Engineering & Code, Design & Media, Legal & Identity, Work & Reports).';

      const prompt = [
        'Analyze this file metadata and redacted text excerpt to flag its type, assign a designated folder, generate 3-6 concise lowercase tags, and detect if it contains sensitive material.',
        `File name: ${fileName}`,
        `Extension: ${extension ?? 'unknown'}`,
        `MIME type: ${mimeType ?? 'unknown'}`,
        folderHint,
        excerpt ? `Content excerpt (redacted): ${excerpt.slice(0, 2000)}` : 'No text excerpt provided.',
      ].join('\n');

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          systemInstruction:
            'You are a privacy-respecting desktop file organization classifier. Output concise, accurate folder names, flags, and lowercase tags without markdown.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              categoryFlag: {
                type: Type.STRING,
                description:
                  'One of: Document, Exam & Academic, Financial, Code & Script, Spreadsheet, Presentation, Image & Media, Archive, Legal & ID, Notes',
              },
              suggestedFolder: {
                type: Type.STRING,
                description: 'Designated folder name to declutter this file into.',
              },
              tags: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: '3 to 6 concise lowercase semantic tags.',
              },
              isSensitive: {
                type: Type.BOOLEAN,
                description: 'True if file appears to contain grades, exams, PII, tax, medical, or legal data.',
              },
              sensitivityReason: {
                type: Type.STRING,
                description: 'Short label like Exam Material, Financial Record, Personal ID, or empty string.',
              },
              summary: {
                type: Type.STRING,
                description: 'One-sentence description of what this file contains for semantic search.',
              },
            },
            required: ['categoryFlag', 'suggestedFolder', 'tags', 'isSensitive', 'sensitivityReason', 'summary'],
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim());
      res.json({ analysis: parsed });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'AI analysis failed';
      res.status(502).json({ error: message });
    }
  });

  app.post('/api/ai/semantic-search', async (req, res) => {
    const ai = getAiClient();
    if (!ai) {
      res.status(503).json({
        error: 'Gemini API key is not configured on the server. Using local semantic matcher.',
      });
      return;
    }

    const { query, files, folders } = req.body as {
      query?: string;
      files?: Array<{
        id: string;
        name: string;
        extension: string;
        categoryFlag: string;
        folderName: string;
        tags: string[];
        summary: string;
        status: string;
      }>;
      folders?: Array<{
        name: string;
        description: string;
        fileCount: number;
      }>;
    };

    if (!query || !query.trim()) {
      res.status(400).json({ error: 'query is required.' });
      return;
    }

    try {
      const prompt = [
        `User semantic search query: "${query}"`,
        'Match all relevant files AND relevant designated folders based on semantic intent (for example, "My students exams paper pdfs or the folder" should match exam PDFs, grading rubrics, and the Academic & Exams folder).',
        'Folders:',
        JSON.stringify(folders ?? []),
        'Files:',
        JSON.stringify((files ?? []).slice(0, 120)),
      ].join('\n');

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          systemInstruction:
            'You are a semantic desktop search engine. Return matched file IDs and matched folder names ordered from strongest semantic relevance to weakest, with a brief plain-English reason for each match. Only return IDs and folder names present in the provided input.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              matchedFiles: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    score: { type: Type.NUMBER, description: 'Relevance score 0 to 100' },
                    reason: { type: Type.STRING },
                  },
                  required: ['id', 'score', 'reason'],
                },
              },
              matchedFolders: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    score: { type: Type.NUMBER, description: 'Relevance score 0 to 100' },
                    reason: { type: Type.STRING },
                  },
                  required: ['name', 'score', 'reason'],
                },
              },
              interpretation: {
                type: Type.STRING,
                description: 'One short sentence summarizing what the user is looking for.',
              },
            },
            required: ['matchedFiles', 'matchedFolders', 'interpretation'],
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim());
      res.json({ result: parsed });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Semantic search failed';
      res.status(502).json({ error: message });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`DeskSort server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start DeskSort server:', err);
  process.exit(1);
});
