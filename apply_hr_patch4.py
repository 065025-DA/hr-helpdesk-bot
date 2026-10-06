"""
apply_hr_patch4.py - two more rules for the AI model:
   1. Use ONLY what the HR documents explicitly say (no guessing, e.g. "twins count as two children").
      If a situation is not explicitly covered -> NOT_IN_DOCUMENTS -> the bot offers an HR ticket.
   2. Copy numbers exactly as written (Rs. 5,00,000), never with spaces inside.
Run once from the project folder:   python3 apply_hr_patch4.py     (safe to run twice)
"""
from pathlib import Path

p = Path("rag/query_engine.py")
s = p.read_text()

SIGNAL = ("- If the excerpts do not contain the answer at all, reply with exactly the single word NOT_IN_DOCUMENTS "
          "and nothing else (no explanation, no sources).\n")
NEW = ("- Use ONLY what the excerpts explicitly state. Do not infer, extrapolate or reason beyond them. If the question is "
       "about a specific situation the excerpts do not explicitly address (for example twins, an exception or a special case), "
       "reply with exactly the single word NOT_IN_DOCUMENTS and nothing else.\n"
       "- Copy numbers exactly as written in the excerpts (for example Rs. 5,00,000) and never put spaces inside a number.\n")
ANCHOR = "- If the excerpts don't fully answer the question, say so explicitly rather than guessing.\n"

if "Use ONLY what the excerpts explicitly state" in s:
    print("OK    rules already in rag/query_engine.py")
elif SIGNAL in s:
    p.write_text(s.replace(SIGNAL, SIGNAL + NEW, 1)); print("DONE  new rules added after the NOT_IN_DOCUMENTS rule")
elif ANCHOR in s:
    p.write_text(s.replace(ANCHOR, ANCHOR + SIGNAL + NEW, 1)); print("DONE  NOT_IN_DOCUMENTS and new rules added")
else:
    print("NOTE  could not find the usual line in rag/query_engine.py. The bot still works; tell your helper.")
