"""Local ChromaDB vector database for indexing file metadata, summaries, and semantic search."""

from __future__ import annotations

from pathlib import Path
from typing import Any, Optional

import chromadb
from chromadb.utils import embedding_functions

from .scanner import ScannedDocument


class LocalChromaVectorDB:
    """Persistent local ChromaDB store for natural-language file & folder retrieval."""

    def __init__(
        self,
        persist_directory: str | Path = "./desksort_chroma_db",
        model_name: str = "all-MiniLM-L6-v2",
    ) -> None:
        self.persist_directory = str(Path(persist_directory).expanduser().resolve())
        self.client = chromadb.PersistentClient(path=self.persist_directory)

        try:
            self.embedding_fn = embedding_functions.SentenceTransformerEmbeddingFunction(
                model_name=model_name
            )
        except Exception:
            self.embedding_fn = embedding_functions.DefaultEmbeddingFunction()

        self.files_collection = self.client.get_or_create_collection(
            name="desksort_files",
            embedding_function=self.embedding_fn,
            metadata={"hnsw:space": "cosine"},
        )
        self.folders_collection = self.client.get_or_create_collection(
            name="desksort_folders",
            embedding_function=self.embedding_fn,
            metadata={"hnsw:space": "cosine"},
        )

    def index_documents(self, documents: list[ScannedDocument]) -> int:
        if not documents:
            return 0

        ids: list[str] = []
        texts: list[str] = []
        metadatas: list[dict[str, Any]] = []

        folder_Rollup: dict[str, list[str]] = {}

        for doc in documents:
            semantic_text = "\n".join(
                [
                    f"Filename: {doc.name}",
                    f"Category: {doc.category_flag}",
                    f"Folder: {doc.suggested_folder}",
                    f"Tags: {', '.join(doc.tags)}",
                    f"Summary: {doc.summary}",
                    f"Excerpt: {doc.extracted_text[:1000]}",
                ]
            )
            ids.append(doc.id)
            texts.append(semantic_text)
            metadatas.append(doc.to_metadata())

            folder_Rollup.setdefault(doc.suggested_folder, []).append(
                f"{doc.name} ({', '.join(doc.tags)})"
            )

        self.files_collection.upsert(ids=ids, documents=texts, metadatas=metadatas)

        folder_ids: list[str] = []
        folder_texts: list[str] = []
        folder_metas: list[dict[str, Any]] = []
        for folder_name, items in folder_Rollup.items():
            fid = folder_name.lower().replace(" ", "_")
            folder_ids.append(fid)
            folder_texts.append(
                f"Folder: {folder_name}. Contains {len(items)} files: {'; '.join(items[:20])}"
            )
            folder_metas.append({"folder_name": folder_name, "file_count": len(items)})

        if folder_ids:
            self.folders_collection.upsert(
                ids=folder_ids, documents=folder_texts, metadatas=folder_metas
            )

        return len(documents)

    def semantic_search(
        self,
        query: str,
        n_results: int = 8,
        category_filter: Optional[str] = None,
    ) -> dict[str, Any]:
        """Query files and folders using natural language descriptions like 'my student exam papers'."""
        if not query.strip():
            return {"query": query, "files": [], "folders": []}

        where_clause = {"category_flag": category_filter} if category_filter else None
        file_count = max(1, min(n_results, self.files_collection.count() or 1))
        folder_count = max(1, min(4, self.folders_collection.count() or 1))

        file_results = (
            self.files_collection.query(
                query_texts=[query],
                n_results=file_count,
                where=where_clause,
            )
            if self.files_collection.count() > 0
            else {"ids": [[]], "distances": [[]], "metadatas": [[]], "documents": [[]]}
        )

        folder_results = (
            self.folders_collection.query(
                query_texts=[query],
                n_results=folder_count,
            )
            if self.folders_collection.count() > 0
            else {"ids": [[]], "distances": [[]], "metadatas": [[]]}
        )

        matched_files = []
        for idx, doc_id in enumerate(file_results["ids"][0]):
            distance = float(file_results["distances"][0][idx])
            similarity = round(max(0.0, 1.0 - distance) * 100, 1)
            meta = file_results["metadatas"][0][idx]
            matched_files.append(
                {
                    "id": doc_id,
                    "similarity_score": similarity,
                    "name": meta.get("name"),
                    "folder": meta.get("suggested_folder"),
                    "category_flag": meta.get("category_flag"),
                    "tags": meta.get("tags"),
                    "summary": meta.get("summary"),
                    "path": meta.get("path"),
                }
            )

        matched_folders = []
        for idx, _fid in enumerate(folder_results["ids"][0]):
            distance = float(folder_results["distances"][0][idx])
            similarity = round(max(0.0, 1.0 - distance) * 100, 1)
            meta = folder_results["metadatas"][0][idx]
            matched_folders.append(
                {
                    "folder_name": meta.get("folder_name"),
                    "file_count": meta.get("file_count"),
                    "similarity_score": similarity,
                }
            )

        return {
            "query": query,
            "files": matched_files,
            "folders": matched_folders,
        }
