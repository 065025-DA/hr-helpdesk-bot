"""
apply_hr_patch.py - makes the 3 small changes the HR bot needs in your EXISTING project files.
Run once from the project folder (~/rag-app):   python3 apply_hr_patch.py
It is safe to run twice (it skips changes that are already there).
"""
from pathlib import Path

def edit(path, old, new, label):
    p = Path(path)
    if not p.exists():
        print(f"SKIP  {label}: {path} not found"); return
    s = p.read_text()
    if new in s:
        print(f"OK    {label}: already done"); return
    if old not in s:
        print(f"FAIL  {label}: could not find the expected text in {path} (tell your helper)"); return
    p.write_text(s.replace(old, new, 1)); print(f"DONE  {label}")

# 1. register the HR endpoints in the FastAPI app (must come before the static-files mount)
edit("rag/app.py",
     '_frontend_dist = Path(__file__).parent.parent / "frontend" / "dist"',
     'from rag.hr_routes import router as hr_router\napp.include_router(hr_router)\n\n_frontend_dist = Path(__file__).parent.parent / "frontend" / "dist"',
     "HR endpoints added to rag/app.py")

# 2. better answer rules: number first + cite the source (policy ID and section)
edit("rag/query_engine.py",
     "- Be concise and direct.\n",
     "- Be concise and direct. Give the answer first (the number, rule or yes/no), then the condition in one or two short sentences, in simple friendly language.\n"
     "- Each excerpt starts with a header like 'HR-02 Leave Policy | Section: 7. Earned Leave (EL)'. End your answer with the source in the form (Source: HR-02 Leave Policy, Section 7). Name only sources you used.\n"
     "- Never give legal, tax or medical advice, and never share any individual employee's personal data.\n",
     "answer rules in rag/query_engine.py")

# 3. use a NEW Qdrant collection so the old multi-department documents do not mix with the new HR documents
for f in ("rag/config.py", "digest/embed_and_upsert.py"):
    p = Path(f)
    if p.exists():
        s = p.read_text()
        if "enterprise_policy_docs" in s:
            p.write_text(s.replace("enterprise_policy_docs", "hr_helpdesk_docs")); print(f"DONE  collection renamed to hr_helpdesk_docs in {f}")
        else:
            print(f"OK    {f}: no old collection name found (check with: grep -rn COLLECTION rag digest)")
