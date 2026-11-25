import { FolderNode, VaultFile } from '../types/files';
import { encryptText } from './crypto';
import { analyzeFileLocally } from './localAnalyzer';

interface RawSampleFile {
  name: string;
  extension: string;
  mimeType: string;
  size: number;
  ageDays: number;
  pinned?: boolean;
  content: string;
}

const SAMPLE_DESKTOP_FILES: RawSampleFile[] = [
  {
    name: 'CS204_Midterm_Exam_Paper_Fall2026.pdf',
    extension: 'pdf',
    mimeType: 'application/pdf',
    size: 1842300,
    ageDays: 4,
    pinned: true,
    content:
      'Department of Computer Science CS204 Data Structures Midterm Exam Paper. Student instructions: answer all 5 sections. Covers AVL trees, hash tables, and graph traversal. Confidential exam key.',
  },
  {
    name: 'BIO101_Students_Final_Exam_Paper.pdf',
    extension: 'pdf',
    mimeType: 'application/pdf',
    size: 2410900,
    ageDays: 12,
    pinned: true,
    content:
      'BIO101 Cellular Biology Student Final Exam Paper. 60 multiple choice questions and 3 essay prompts on cellular respiration and genetics.',
  },
  {
    name: 'Student_Quiz_Scores_Cohort_B.csv',
    extension: 'csv',
    mimeType: 'text/csv',
    size: 68420,
    ageDays: 6,
    content:
      'student_id,name,midterm_score,quiz_1,quiz_2,final_grade\nS1042,Elena Vance,91,88,94,A\nS1043,Marcus Chen,84,82,87,B+\nS1044,Priya Nair,96,95,98,A+',
  },
  {
    name: '2024_Tax_Return_W2_Summary.pdf',
    extension: 'pdf',
    mimeType: 'application/pdf',
    size: 942100,
    ageDays: 185,
    content:
      'Federal Income Tax Return 2024 W2 Wage and Tax Statement. Employer gross wages, federal withholding, and deduction schedules.',
  },
  {
    name: 'Q3_Consulting_Invoice_2025.pdf',
    extension: 'pdf',
    mimeType: 'application/pdf',
    size: 412800,
    ageDays: 140,
    content:
      'Invoice #INV-2025-093 for systems architecture advisory. Net 30 payment terms, subtotal $4,800.00.',
  },
  {
    name: 'Screenshot 2026-11-18 at 14.22.09.png',
    extension: 'png',
    mimeType: 'image/png',
    size: 3190400,
    ageDays: 7,
    content: 'Desktop UI wireframe screenshot showing navigation sidebar and grid layout.',
  },
  {
    name: 'batch_rename_utility.py',
    extension: 'py',
    mimeType: 'text/x-python',
    size: 14200,
    ageDays: 19,
    content:
      'import os\nfrom pathlib import Path\ndef normalize_filenames(target_dir: str):\n    for p in Path(target_dir).iterdir():\n        print(p.name)',
  },
  {
    name: 'NDA_Partner_Agreement_Signed.pdf',
    extension: 'pdf',
    mimeType: 'application/pdf',
    size: 1290400,
    ageDays: 112,
    content:
      'Mutual Non-Disclosure Agreement signed between Acme Research Labs and Partner. Confidentiality obligations remain in effect for 5 years.',
  },
  {
    name: 'Faculty_Curriculum_Meeting_Notes.md',
    extension: 'md',
    mimeType: 'text/markdown',
    size: 9840,
    ageDays: 3,
    content:
      '# Faculty Curriculum Sync\n- Review student exam rubrics before finals week\n- Publish updated syllabus PDF to portal\n- Archive 2024 lecture slides',
  },
  {
    name: 'Legacy_Desktop_Backup_2023.zip',
    extension: 'zip',
    mimeType: 'application/zip',
    size: 48200100,
    ageDays: 420,
    content: 'Compressed legacy backup archive from 2023 workstation migration.',
  },
];

export async function generateSampleDesktopFiles(): Promise<{
  files: VaultFile[];
  folders: FolderNode[];
}> {
  const now = Date.now();
  const files: VaultFile[] = [];
  const folderMap = new Map<string, FolderNode>();

  for (let i = 0; i < SAMPLE_DESKTOP_FILES.length; i++) {
    const item = SAMPLE_DESKTOP_FILES[i];
    const analysis = analyzeFileLocally(item.name, item.extension, item.mimeType, item.content);
    const encrypted = await encryptText(item.content);
    const timestamp = now - item.ageDays * 24 * 60 * 60 * 1000;

    const id = `sample-${i + 1}-${item.name.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 10)}`;

    files.push({
      id,
      name: item.name,
      extension: item.extension,
      mimeType: item.mimeType,
      size: item.size,
      categoryFlag: analysis.categoryFlag,
      folderName: 'Desktop',
      suggestedFolder: analysis.suggestedFolder,
      status: 'desktop',
      tags: analysis.tags,
      isSensitive: analysis.isSensitive,
      sensitivityReason: analysis.sensitivityReason,
      summary: analysis.summary,
      pinned: Boolean(item.pinned),
      createdAt: timestamp,
      modifiedAt: timestamp,
      lastAccessedAt: timestamp,
      sha256: encrypted.sha256,
      ivBase64: encrypted.ivBase64,
      encryptedPayloadBase64: encrypted.encryptedPayloadBase64,
      analysisSource: 'local',
    });

    if (!folderMap.has(analysis.suggestedFolder)) {
      folderMap.set(analysis.suggestedFolder, {
        id: `folder-${analysis.suggestedFolder.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
        name: analysis.suggestedFolder,
        description: `Auto-designated folder for ${analysis.categoryFlag} files`,
        categoryFlag: analysis.categoryFlag,
        autoCreated: true,
        pinned: analysis.suggestedFolder === 'Academic & Exams',
        createdAt: now,
      });
    }
  }

  return {
    files,
    folders: Array.from(folderMap.values()),
  };
}
