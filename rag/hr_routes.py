"""
hr_routes.py - the web addresses (API endpoints) of the HR helpdesk bot.

    POST /api/hr/signin        {employee_id}                     -> who is signing in (demo sign-in)
    POST /api/hr/chat          {message, employee_id, history}   -> the bot's reply
    POST /api/hr/tickets       {question, employee_id, ...}      -> creates an HR ticket
    GET  /api/hr/tickets/{id}?employee_id=NB1001                 -> ticket status

NOTE: the "sign-in" is only an employee-ID box. That is fine for a college demo; a real company
would use single sign-on (SSO) so nobody can type someone else's ID.
"""
import logging
import time
from typing import List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from rag import hr_bot, leave_tool, tickets

logger = logging.getLogger("hr-bot")
router = APIRouter(prefix="/api/hr")
MAX_CHARS = 1000


def _jsonable(x):
    """Turn numpy numbers and other odd objects into plain Python values so FastAPI can send them as JSON."""
    if x is None or isinstance(x, (str, int, bool)):
        return x
    if isinstance(x, float):
        return float(x)
    if isinstance(x, dict):
        return {str(k): _jsonable(v) for k, v in x.items()}
    if isinstance(x, (list, tuple, set)):
        return [_jsonable(v) for v in x]
    if hasattr(x, "item") and callable(x.item):      # numpy.float32, numpy.int64, ...
        try:
            return _jsonable(x.item())
        except Exception:
            pass
    if hasattr(x, "__dict__"):
        return _jsonable(vars(x))
    return str(x)


class SignInRequest(BaseModel):
    employee_id: str


class ChatRequest(BaseModel):
    message: str
    employee_id: Optional[str] = None
    history: Optional[List[dict]] = None


class TicketRequest(BaseModel):
    question: str
    employee_id: Optional[str] = None
    category: Optional[str] = None
    priority: Optional[str] = None


@router.post("/signin")
def signin(req: SignInRequest):
    row = leave_tool.get_employee(req.employee_id)
    if not row:
        raise HTTPException(status_code=404, detail="Employee ID not found. Please check it and try again.")
    return {"employee_id": row["employee_id"], "name": row["name"], "department": row["department"],
            "employment_status": row["employment_status"]}


@router.get("/employees")
def employees():
    """Employee IDs for the sign-in drop-down (demo only)."""
    return leave_tool.all_employees()


@router.post("/chat")
def chat(req: ChatRequest):
    message = req.message.strip()
    if not message:
        raise HTTPException(status_code=400, detail="Please type a question.")
    if len(message) > MAX_CHARS:
        raise HTTPException(status_code=400, detail=f"Please keep your question under {MAX_CHARS} characters.")
    start = time.time()
    try:
        result = hr_bot.handle_message(message, req.employee_id, req.history)
    except Exception:
        logger.exception("HR bot failed")
        raise HTTPException(status_code=500, detail="The HR assistant could not answer right now. "
                                                    "Please try again in a minute, or write to hrhelpdesk@northbridge.example.")
    result["response_time_seconds"] = round(time.time() - start, 2)
    return _jsonable(result)


@router.post("/tickets")
def create_ticket(req: TicketRequest):
    if not req.question.strip():
        raise HTTPException(status_code=400, detail="A ticket needs a description.")
    try:
        return tickets.create_ticket(req.question.strip(), req.employee_id, req.category, req.priority)
    except Exception:
        logger.exception("Ticket creation failed")
        raise HTTPException(status_code=500, detail="Could not create the ticket right now. "
                                                    "Please write to hrhelpdesk@northbridge.example.")


@router.get("/tickets/{ticket_id}")
def ticket_status(ticket_id: str, employee_id: Optional[str] = None):
    t = tickets.get_ticket(ticket_id, employee_id)
    if not t:
        raise HTTPException(status_code=404, detail="Ticket not found.")
    return t
