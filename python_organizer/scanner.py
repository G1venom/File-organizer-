"""Local file scanner and lightweight local AI document classifier/tagger."""

from __future__ import annotations

import hashlib
import mimetypes
import os
import re
import shutil
from collections import Counter
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable, Optional

try:
    from pypdf import PdfReader  # type: ignore
except ImportError:
    PdfReader = None

try:
    import docx  # type: ignore
except ImportError:
    docx = None

try:
    from sentence_transformers import SentenceTransformer, util  # type: ignore
except ImportError:
    SentenceTransformer = None
    util = None


CATEGORY_PROTOTYPES: dict[str, str] = {
    "Exam & Academic": "student exam paper midterm final quiz rubric syllabus grading coursework lecture notes",
    "Financial": "tax return invoice receipt w2 1099 bank statement ledger budget payroll expense",
    "Legal & ID": "contract nda legal agreement passport driver license policy compliance insurance",
    "Code & Script": "python typescript javascript source code script function api server database",
    "Spreadsheet": "csv excel spreadsheet table financial data numbers analytics dataset",
    "Presentation": "slide deck keynote powerpoint presentation slides pitch lecture",
    "Image & Media": "screenshot photo diagram mockup graphic png jpg video audio media",
    "Archive": "zip compressed archive backup installer dmg tar gz package",
    "Notes": "meeting notes journal todo draft memo summary markdown text",
}

FOLDER_MAP: dict[str, str] = {
    "Exam & Academic": "Academic & Exams",
    "Financial": "Financial & Tax",
    "Legal & ID": "Legal & Identity",
    "Code & Script": "Engineering & Code",
    "Spreadsheet": "Data & Spreadsheets",
    "Presentation": "Presentations",
    "Image & Media": "Design & Media",
    "Archive": "Archives & Installers",
    "Notes": "Personal Notes",
    "Document": "General Documents",
}

STOP_WORDS = {
    "the", "and", "for", "with", "that", "this", "from", "your", "have", "has",
    "are", "was", "were", "will", "into", "about", "file", "document", "page",
}

SENSITIVE_KEYWORDS = {
    "exam", "midterm", "final", "answer key", "student", "grade", "grades",
    "tax", "w2", "1099", "invoice", "bank", "ssn", "passport", "license",
    "confidential", "nda", "contract", "medical", "salary", "payroll",
}


@dataclass
class ScannedDocument:
    id: str
    name: str
    path: str
    extension: str
    mime_type: str
    size_bytes: int
    category_flag: str
    suggested_folder: str
    tags: list[str] = field(default_factory=list)
    is_sensitive: bool = False
    sensitivity_reason: str = ""
    summary: str = ""
    extracted_text: str = ""
    sha256: str = ""
    modified_at: str = ""
    classification_model: str = "all-MiniLM-L6-v2"

    def to_metadata(self) -> dict[str, str | int | bool]:
        return {
            "id": self.id,
            "name": self.name,
            "path": self.path,
            "extension": self.extension,
            "mime_type": self.mime_type,
            "size_bytes": self.size_bytes,
            "category_flag": self.category_flag,
            "suggested_folder": self.suggested_folder,
            "tags": ", ".join(self.tags),
            "is_sensitive": self.is_sensitive,
            "sensitivity_reason": self.sensitivity_reason,
            "summary": self.summary,
            "sha256": self.sha256,
            "modified_at": self.modified_at,
            "classification_model": self.classification_model,
        }

    def to_dict(self) -> dict:
        return asdict(self)


class LightweightLocalClassifier:
    """Uses SentenceTransformer all-MiniLM-L6-v2 when installed, with local keyword fallback."""

    def __init__(self, model_name: str = "all-MiniLM-L6-v2") -> None:
        self.model_name = model_name
        self._model = None
        self._proto_embeddings = None
        self._proto_labels = list(CATEGORY_PROTOTYPES.keys())
        if SentenceTransformer is not None:
            try:
                self._model = SentenceTransformer(model_name, local_files_only=False)
                self._proto_embeddings = self._model.encode(
                    list(CATEGORY_PROTOTYPES.values()),
                    convert_to_tensor=True,
                )
            except Exception:
                self._model = None

    def classify_and_tag(
        self, file_name: str, extension: str, text_content: str
    ) -> tuple[str, str, list[str], bool, str, str, str]:
        ext = extension.lower().lstrip(".")
        combined = f"{file_name} {text_content[:3000]}".strip()
        lower = combined.lower()

        category = self._classify_extension_hint(ext, lower)
        model_used = "local-heuristic-nlp"

        if self._model is not None and util is not None and self._proto_embeddings is not None:
            try:
                doc_emb = self._model.encode(combined[:1500], convert_to_tensor=True)
                scores = util.cos_sim(doc_emb, self._proto_embeddings)[0]
                best_idx = int(scores.argmax().item())
                best_score = float(scores[best_idx].item())
                if best_score >= 0.22:
                    category = self._proto_labels[best_idx]
                model_used = self.model_name
            except Exception:
                pass

        suggested_folder = FOLDER_MAP.get(category, "General Documents")
        tags = self._extract_tags(file_name, ext, category, lower)
        is_sensitive, reason = self._detect_sensitivity(lower, category)
        summary = self._build_summary(file_name, category, suggested_folder, text_content)
        return category, suggested_folder, tags, is_sensitive, reason, summary, model_used

    @staticmethod
    def _classify_extension_hint(ext: str, lower: str) -> str:
        if any(k in lower for k in ("exam", "midterm", "final", "quiz", "student", "rubric", "syllabus")):
            return "Exam & Academic"
        if any(k in lower for k in ("invoice", "receipt", "tax", "w2", "1099", "ledger", "payroll")):
            return "Financial"
        if any(k in lower for k in ("contract", "nda", "passport", "agreement", "legal")):
            return "Legal & ID"
        if ext in {"py", "ts", "tsx", "js", "jsx", "go", "rs", "java", "cpp", "c", "sql", "sh", "json", "yaml"}:
            return "Code & Script"
        if ext in {"csv", "xlsx", "xls", "ods"}:
            return "Spreadsheet"
        if ext in {"ppt", "pptx", "key", "odp"}:
            return "Presentation"
        if ext in {"png", "jpg", "jpeg", "webp", "gif", "svg", "mp4", "mov", "mp3", "wav"}:
            return "Image & Media"
        if ext in {"zip", "tar", "gz", "rar", "7z", "dmg", "pkg"}:
            return "Archive"
        if ext in {"md", "txt", "rtf"}:
            return "Notes"
        return "Document"

    @staticmethod
    def _extract_tags(file_name: str, ext: str, category: str, lower: str) -> list[str]:
        tags: list[str] = []
        if ext:
            tags.append(ext)
        cat_slug = category.lower().split("&")[0].strip().replace(" ", "-")
        if cat_slug and cat_slug not in tags:
            tags.append(cat_slug)

        tokens = re.findall(r"[a-z]{4,18}", lower)
        counts = Counter(t for t in tokens if t not in STOP_WORDS)
        for token, _ in counts.most_common(6):
            if token not in tags:
                tags.append(token)
            if len(tags) >= 6:
                break

        year = re.search(r"\b(202\d)\b", lower)
        if year and year.group(1) not in tags and len(tags) < 6:
            tags.append(year.group(1))
        return tags[:6]

    @staticmethod
    def _detect_sensitivity(lower: str, category: str) -> tuple[bool, str]:
        hits = [kw for kw in SENSITIVE_KEYWORDS if kw in lower]
        if hits:
            if category == "Exam & Academic":
                return True, "Exam & Student Data"
            if category == "Financial":
                return True, "Financial Record"
            if category == "Legal & ID":
                return True, "Confidential Legal / ID"
            return True, f"Sensitive keyword: {hits[0]}"
        return False, ""

    @staticmethod
    def _build_summary(file_name: str, category: str, folder: str, text_content: str) -> str:
        clean = re.sub(r"\s+", " ", text_content).strip()
        if len(clean) >= 24:
            return f"{category} file '{file_name}' in {folder}: {clean[:180]}"
        return f"{category} file '{file_name}' designated for folder {folder}."


class LocalFileScanner:
    """Scans local files, extracts text, classifies type, and generates semantic metadata."""

    def __init__(self, model_name: str = "all-MiniLM-L6-v2") -> None:
        self.classifier = LightweightLocalClassifier(model_name=model_name)

    def extract_text(self, path: Path) -> str:
        ext = path.suffix.lower()
        try:
            if ext in {".txt", ".md", ".csv", ".json", ".py", ".ts", ".tsx", ".js", ".jsx", ".html", ".css", ".sql", ".yaml", ".yml", ".log"}:
                return path.read_text(encoding="utf-8", errors="ignore")[:12000]
            if ext == ".pdf":
                if PdfReader is not None:
                    reader = PdfReader(str(path))
                    chunks = [page.extract_text() or "" for page in reader.pages[:8]]
                    return "\n".join(chunks)[:12000]
                raw = path.read_bytes().decode("latin-1", errors="ignore")
                literals = re.findall(r"\(([^()\\]{3,160})\)", raw)
                return " ".join(literals)[:8000]
            if ext == ".docx" and docx is not None:
                document = docx.Document(str(path))
                return "\n".join(p.text for p in document.paragraphs)[:12000]
        except Exception:
            return ""
        return ""

    def scan_file(self, file_path: str | Path) -> ScannedDocument:
        path = Path(file_path).expanduser().resolve()
        stat = path.stat()
        raw_bytes = path.read_bytes()
        sha256 = hashlib.sha256(raw_bytes).hexdigest()
        ext = path.suffix.lower().lstrip(".")
        mime_type, _ = mimetypes.guess_type(str(path))
        extracted = self.extract_text(path)

        (
            category,
            suggested_folder,
            tags,
            is_sensitive,
            sensitivity_reason,
            summary,
            model_used,
        ) = self.classifier.classify_and_tag(path.name, ext, extracted)

        doc_id = hashlib.sha1(str(path).encode("utf-8")).hexdigest()[:16]
        modified_at = datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat()

        return ScannedDocument(
            id=doc_id,
            name=path.name,
            path=str(path),
            extension=ext,
            mime_type=mime_type or "application/octet-stream",
            size_bytes=stat.st_size,
            category_flag=category,
            suggested_folder=suggested_folder,
            tags=tags,
            is_sensitive=is_sensitive,
            sensitivity_reason=sensitivity_reason,
            summary=summary,
            extracted_text=extracted[:4000],
            sha256=sha256,
            modified_at=modified_at,
            classification_model=model_used,
        )

    def scan_directory(
        self,
        root_dir: str | Path,
        recursive: bool = False,
        ignore_hidden: bool = True,
    ) -> list[ScannedDocument]:
        root = Path(root_dir).expanduser().resolve()
        if not root.exists() or not root.is_dir():
            raise FileNotFoundError(f"Directory not found: {root}")

        results: list[ScannedDocument] = []
        iterator: Iterable[Path] = root.rglob("*") if recursive else root.iterdir()
        for entry in iterator:
            if not entry.is_file():
                continue
            if ignore_hidden and any(part.startswith(".") for part in entry.relative_to(root).parts):
                continue
            results.append(self.scan_file(entry))
        return results


def auto_organize_directory(
    root_dir: str | Path,
    dry_run: bool = False,
    scanner: Optional[LocalFileScanner] = None,
) -> list[dict[str, str]]:
    """Flags files on the desktop/root folder, creates designated subfolders, and moves files."""
    root = Path(root_dir).expanduser().resolve()
    active_scanner = scanner or LocalFileScanner()
    scanned = active_scanner.scan_directory(root, recursive=False)
    actions: list[dict[str, str]] = []

    for doc in scanned:
        target_dir = root / doc.suggested_folder
        destination = target_dir / doc.name
        if destination.exists() and destination != Path(doc.path):
            stem = Path(doc.name).stem
            suffix = Path(doc.name).suffix
            destination = target_dir / f"{stem}_{doc.sha256[:6]}{suffix}"

        if not dry_run:
            target_dir.mkdir(parents=True, exist_ok=True)
            shutil.move(doc.path, str(destination))
            doc.path = str(destination)

        actions.append(
            {
                "file": doc.name,
                "category_flag": doc.category_flag,
                "folder": doc.suggested_folder,
                "destination": str(destination),
                "tags": ", ".join(doc.tags),
                "dry_run": str(dry_run),
            }
        )

    return actions
