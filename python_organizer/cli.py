"""Command-line interface & FastAPI local bridge for DeskSort Python ChromaDB module."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from .scanner import LocalFileScanner, auto_organize_directory
from .vector_store import LocalChromaVectorDB


def main() -> None:
    parser = argparse.ArgumentParser(
        prog="desksort-local",
        description="Local AI file scanner, organizer, and ChromaDB semantic search.",
    )
    parser.add_argument(
        "--db",
        default="./desksort_chroma_db",
        help="Path to persistent ChromaDB storage directory.",
    )
    sub = parser.add_subparsers(dest="command", required=True)

    scan_cmd = sub.add_parser("scan", help="Scan a directory and index metadata into ChromaDB.")
    scan_cmd.add_argument("directory", help="Target directory to scan (e.g. ~/Desktop)")
    scan_cmd.add_argument("--recursive", action="store_true")

    org_cmd = sub.add_parser("organize", help="Auto-flag and move files into designated folders.")
    org_cmd.add_argument("directory", help="Target directory to declutter")
    org_cmd.add_argument("--dry-run", action="store_true")

    search_cmd = sub.add_parser("search", help="Run semantic natural-language search.")
    search_cmd.add_argument("query", help="Natural language query, e.g. 'my student exam papers'")
    search_cmd.add_argument("-n", "--limit", type=int, default=8)
    search_cmd.add_argument("--category", default=None)

    args = parser.parse_args()
    db = LocalChromaVectorDB(persist_directory=Path(args.db))

    if args.command == "scan":
        scanner = LocalFileScanner()
        docs = scanner.scan_directory(args.directory, recursive=args.recursive)
        count = db.index_documents(docs)
        print(json.dumps({"indexed": count, "files": [d.to_dict() for d in docs]}, indent=2))
    elif args.command == "organize":
        scanner = LocalFileScanner()
        actions = auto_organize_directory(args.directory, dry_run=args.dry_run, scanner=scanner)
        docs = scanner.scan_directory(args.directory, recursive=True)
        db.index_documents(docs)
        print(json.dumps({"actions": actions}, indent=2))
    elif args.command == "search":
        results = db.semantic_search(args.query, n_results=args.limit, category_filter=args.category)
        print(json.dumps(results, indent=2))


if __name__ == "__main__":
    main()
