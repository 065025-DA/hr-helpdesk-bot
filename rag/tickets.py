"""
tickets.py - Feature 3: HR ticket fallback.

A ticket is a small record: ticket_id, employee_id, question, category, priority, status, created_at.
Storage:
  - If QDRANT_URL is set (normal case, also works on Vercel): tickets are stored in a separate
    Qdrant collection called "hr_tickets" (we only use it as a simple database).
  - If not (quick local test): tickets are kept in a JSON file in the temp folder.
"""
import json
import os
import re
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

IST = timezone(timedelta(hours=5, minutes=30))
COLLECTION = "hr_tickets"

# From HR-12 section 6
RESPONSE_TIMES = {"P1": "4 business hours", "P2": "1 business day", "P3": "2 business days"}

# (regex, category, priority): first match wins
_RULES = [
    (r"(salary|pay ?slip|payslip).{0,40}(not|didn'?t|never|missing|short|wrong|late)|"
     r"(not|didn'?t|never).{0,30}(receive|credit).{0,20}salary", "Payroll and Salary", "P1"),
    (r"harass|discriminat|bully|bullied|unfair(ly)? treat|threat|abus", "Grievance and Conduct", "P1"),
    (r"insurance|claim|hospital|mediclaim", "Benefits and Insurance", "P2"),
    (r"letter|certificate|form 16", "Letters and Certificates", "P2"),
    (r"leave balance|attendance|regulari[sz]|leave.{0,20}(wrong|incorrect|mismatch)", "Leave and Attendance", "P2"),
    (r"salary|payroll|reimburse|tax|increment", "Payroll and Salary", "P2"),
    (r"joining|onboarding|bgv|background (check|verification)|offer", "Onboarding and Joining", "P2"),
    (r"rating|promotion|appraisal|performance review", "Performance and Promotion", "P2"),
    (r"resign|notice period|f&f|full and final|settlement|relieving|exit", "Exit and Settlement", "P2"),
]


def classify(text):
    t = (text or "").lower()
    for pattern, category, priority in _RULES:
        if re.search(pattern, t):
            return category, priority
    return "Policy Clarification", "P3"


# ---------------------------------------------------------------- storage backends
class _FileStore:
    path = Path(os.getenv("TMPDIR", "/tmp")) / "hr_tickets.json"

    def _read(self):
        return json.loads(self.path.read_text()) if self.path.exists() else []

    def count_for_date(self, d):
        return sum(1 for t in self._read() if t["ticket_date"] == d)

    def save(self, t):
        data = self._read()
        data.append(t)
        self.path.write_text(json.dumps(data))

    def get(self, ticket_id):
        return next((t for t in self._read() if t["ticket_id"] == ticket_id), None)


class _QdrantStore:
    def __init__(self):
        from qdrant_client import QdrantClient
        from qdrant_client.models import Distance, PayloadSchemaType, VectorParams
        from rag.config import QDRANT_URL, QDRANT_API_KEY
        self.c = QdrantClient(url=QDRANT_URL, api_key=QDRANT_API_KEY)
        if COLLECTION not in [x.name for x in self.c.get_collections().collections]:
            self.c.create_collection(COLLECTION, vectors_config=VectorParams(size=1, distance=Distance.DOT))
        for field in ("ticket_id", "ticket_date", "employee_id"):
            self.c.create_payload_index(COLLECTION, field, PayloadSchemaType.KEYWORD)

    @staticmethod
    def _flt(key, value):
        from qdrant_client.models import FieldCondition, Filter, MatchValue
        return Filter(must=[FieldCondition(key=key, match=MatchValue(value=value))])

    def count_for_date(self, d):
        return self.c.count(COLLECTION, count_filter=self._flt("ticket_date", d), exact=True).count

    def save(self, t):
        from qdrant_client.models import PointStruct
        self.c.upsert(COLLECTION, points=[PointStruct(id=str(uuid.uuid4()), vector=[1.0], payload=t)])

    def get(self, ticket_id):
        pts, _ = self.c.scroll(COLLECTION, scroll_filter=self._flt("ticket_id", ticket_id), limit=1)
        return pts[0].payload if pts else None


_store = None


def _get_store():
    global _store
    if _store is None:
        _store = _QdrantStore() if os.getenv("QDRANT_URL") and os.getenv("HR_TICKET_BACKEND") != "file" else _FileStore()
    return _store


# ---------------------------------------------------------------- public functions
def create_ticket(question, employee_id=None, category=None, priority=None):
    auto_cat, auto_pri = classify(question)
    category, priority = category or auto_cat, priority or auto_pri
    now = datetime.now(IST)
    day = now.strftime("%Y%m%d")
    store = _get_store()
    ticket = {
        "ticket_id": f"HR-{day}-{store.count_for_date(day) + 1:03d}",
        "ticket_date": day,
        "employee_id": (employee_id or "unknown").upper(),
        "question": (question or "")[:1000],
        "category": category,
        "priority": priority,
        "status": "Open",
        "created_at": now.isoformat(timespec="seconds"),
    }
    store.save(ticket)
    ticket["first_response_within"] = RESPONSE_TIMES[priority]
    return ticket


def get_ticket(ticket_id, employee_id=None):
    t = _get_store().get(ticket_id.strip().upper())
    # Privacy: an employee can only see their own tickets
    if t and employee_id and t["employee_id"] != employee_id.upper():
        return None
    return t
