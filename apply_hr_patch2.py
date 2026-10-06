"""
apply_hr_patch2.py - tells the AI model to answer NOT_IN_DOCUMENTS when the HR documents do not contain the answer,
so the bot can reliably send that question to an HR ticket.
Run once from the project folder:   python3 apply_hr_patch2.py     (safe to run twice)
"""
from pathlib import Path

p = Path("rag/query_engine.py")
s = p.read_text()
new_rule = ("- If the excerpts do not contain the answer at all, reply with exactly the single word NOT_IN_DOCUMENTS "
            "and nothing else (no explanation, no sources).\n")
anchor = "- If the excerpts don't fully answer the question, say so explicitly rather than guessing.\n"

if "NOT_IN_DOCUMENTS" in s:
    print("OK    rule already in rag/query_engine.py")
elif anchor in s:
    p.write_text(s.replace(anchor, anchor + new_rule, 1))
    print("DONE  NOT_IN_DOCUMENTS rule added to rag/query_engine.py")
else:
    print("NOTE  could not find the usual line in rag/query_engine.py. That is OK: the bot also recognises "
          "'I don't know' style answers by itself. Tell your helper if tickets are still not offered.")
