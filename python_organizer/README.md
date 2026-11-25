# DeskSort Local Python + ChromaDB Module

Local Python scanner, lightweight `all-MiniLM-L6-v2` document classifier/tagger, and persistent **ChromaDB** vector store.

## Setup

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r python_organizer/requirements.txt
```

## Usage

### 1. Scan & Index Local Files into ChromaDB
```bash
python -m python_organizer.cli scan ~/Desktop --recursive
```

### 2. Auto-Organize & Declutter Desktop Folders
```bash
python -m python_organizer.cli organize ~/Desktop --dry-run
python -m python_organizer.cli organize ~/Desktop
```

### 3. Semantic Natural-Language Search
```bash
python -m python_organizer.cli search "my student exam papers"
```
