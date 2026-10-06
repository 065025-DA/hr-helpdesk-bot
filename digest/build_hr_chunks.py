"""
build_hr_chunks.py

Reads every HR-*.docx in data/hr_docs/ and writes data/chunks.pkl, the file that
digest/embed_and_upsert.py uploads to Qdrant.

Each chunk is a small piece of ONE section of ONE policy, and starts with a header line like
    HR-02 Leave Policy | Section: 7. Earned Leave (EL) > 7.2 Applying for EL
so that (a) the search engine knows where the text came from and (b) the chatbot can cite it.

Run (inside Docker, from the project folder):
    docker run --rm -v "$PWD":/app -w /app rag-app sh -c "pip install -q python-docx && python digest/build_hr_chunks.py"
Test without Qdrant/LlamaIndex:  python digest/build_hr_chunks.py --dry-run
"""
import pickle
import re
import sys
from pathlib import Path

from docx import Document
from docx.table import Table
from docx.text.paragraph import Paragraph

ROOT = Path(__file__).resolve().parent.parent
DOCS_DIR = ROOT / "data" / "hr_docs"
OUT_PATH = ROOT / "data" / "chunks.pkl"
MAX_CHARS = 900  # keeps each chunk inside the embedding model's ~256-token limit
DRY_RUN = "--dry-run" in sys.argv

try:
    from llama_index.core.schema import TextNode
except ImportError:  # only for --dry-run on a machine without LlamaIndex
    class TextNode:  # minimal stand-in
        def __init__(self, text, metadata):
            self.text, self.metadata = text, metadata

        def get_content(self):
            return self.text


def iter_blocks(doc):
    """Yield paragraphs and tables in the order they appear in the document."""
    for child in doc.element.body.iterchildren():
        if child.tag.endswith("}p"):
            yield Paragraph(child, doc)
        elif child.tag.endswith("}tbl"):
            yield Table(child, doc)


def table_lines(table):
    """Turn each table row into one self-contained sentence-like line: 'Header: value; Header: value'."""
    rows = [[c.text.strip() for c in r.cells] for r in table.rows]
    if len(rows) < 2:
        return []
    head, body = rows[0], rows[1:]
    return [" ; ".join(f"{h}: {v}" for h, v in zip(head, r) if v) for r in body]


def pack(lines, header):
    """Greedy-pack lines into chunks of at most MAX_CHARS (the header is repeated in every chunk)."""
    chunks, cur = [], ""
    for ln in lines:
        if cur and len(header) + len(cur) + len(ln) + 2 > MAX_CHARS:
            chunks.append(cur)
            cur = ""
        cur = (cur + "\n" + ln) if cur else ln
    if cur:
        chunks.append(cur)
    return chunks


def chunks_for_doc(path):
    doc = Document(str(path))
    code = re.match(r"(HR-\d+)", path.stem).group(1)
    paras = [p for p in doc.paragraphs if p.text.strip()]
    title = paras[1].text.strip() if len(paras) > 1 else path.stem  # line 0 is the company name
    doc_label = f"{code} {title}"

    sections = []  # list of [h1, h2, lines]
    h1, h2, lines = "Overview", "", []
    skipped_meta_table = False

    def flush():
        if lines:
            sections.append((h1, h2, list(lines)))

    for blk in iter_blocks(doc):
        if isinstance(blk, Table):
            if not skipped_meta_table:  # first table = the document-details box
                skipped_meta_table = True
                continue
            lines.extend(table_lines(blk))
            continue
        text = blk.text.strip()
        if not text:
            continue
        style = blk.style.name if blk.style is not None else ""
        if style == "Heading 1":
            if text == "Revision History":
                break
            flush()
            h1, h2, lines = text, "", []
        elif style == "Heading 2":
            flush()
            h2, lines = text, []
        elif text in (title, "NORTHBRIDGE DYNAMICS PVT. LTD."):
            continue
        else:
            is_bullet = blk._p.pPr is not None and blk._p.pPr.numPr is not None
            lines.append(("- " + text) if is_bullet else text)
    flush()

    nodes = []
    for h1_, h2_, ln in sections:
        place = h1_ + (f" > {h2_}" if h2_ else "")
        header = f"{doc_label} | Section: {place}"
        for i, body in enumerate(pack(ln, header)):
            text = f"{header}\n{body}"
            nodes.append(TextNode(text=text, metadata={
                "department": "hr",
                "source_file": f"{code} {title}",
                "section_heading": place,
                "doc_id": code,
            }))
    return nodes


def main():
    files = sorted(DOCS_DIR.glob("HR-*.docx"))
    if not files:
        sys.exit(f"No HR-*.docx files found in {DOCS_DIR}")
    all_nodes = []
    for f in files:
        n = chunks_for_doc(f)
        print(f"{f.name}: {len(n)} chunks")
        all_nodes.extend(n)
    print(f"\nTotal: {len(all_nodes)} chunks. Longest: {max(len(n.get_content()) for n in all_nodes)} characters.")
    if DRY_RUN:
        print("\n--- sample chunk ---\n" + all_nodes[len(all_nodes) // 3].get_content())
        return
    OUT_PATH.parent.mkdir(exist_ok=True)
    with open(OUT_PATH, "wb") as f:
        pickle.dump(all_nodes, f)
    print(f"Saved {OUT_PATH}")


if __name__ == "__main__":
    main()
