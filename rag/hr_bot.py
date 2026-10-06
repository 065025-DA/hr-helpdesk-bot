"""
hr_bot.py - the "brain" of the HR helpdesk bot.

handle_message() looks at the employee's message and picks ONE route, in this order:
  1. Safety      - harassment, distress, prompt tricks, other people's private data
  2. Ticket      - "what is the status of ticket ...", "raise a ticket"
  3. Leave       - "what is my leave balance?"  (reads the CSV, no AI model)
  4. Policy Q&A  - everything else: RAG over the HR documents (route_query, HR only)

The first three are plain rules (fast, free, predictable, and safe for sensitive topics).
Only policy questions go to the AI model.
"""
import re

from rag import leave_tool, tickets

EMP_ID = re.compile(r"\bNB\d{4}\b", re.I)
TICKET_ID = re.compile(r"\bHR-\d{8}-\d{3}\b", re.I)

# ------------------------------------------------------------------ fixed replies
HARASSMENT_REPLY = (
    "I'm sorry you are dealing with this. Sexual harassment complaints are handled in confidence by our Internal "
    "Committee (ICC), not by this chatbot, so please do not share details of the incident here.\n\n"
    "- Write to the ICC at icc@northbridge.example. You can also ask to be helped in writing the complaint.\n"
    "- You have 3 months from the incident to complain (the ICC can extend this by 3 months).\n"
    "- The ICC keeps your identity and the inquiry confidential. Retaliation is not allowed.\n"
    "- If you feel unsafe right now, move to a safe place and call 112.\n\n"
    "(Source: HR-05 POSH Policy, Sections 3 to 8)"
)
DISTRESS_REPLY = (
    "I'm really sorry you're going through this. You don't have to handle it alone.\n\n"
    "- Our Employee Assistance Programme gives free, confidential counselling to you and your family, 24x7. "
    "Your employer does not receive session details.\n"
    "- You can also write to hrhelpdesk@northbridge.example (extension 1800) and ask for a private conversation with HR.\n"
    "- If you are in immediate danger or thinking about harming yourself, please call 112 right now, "
    "or call Tele-MANAS on 14416 (free, 24x7), or tell someone near you.\n\n"
    "(Source: HR-01 Employee Handbook, Section 10)"
)
INJECTION_REPLY = "I can only help with questions about Northbridge HR policies, your leave balance, and HR tickets."
PRIVACY_REPLY = ("I can't share another person's personal data such as salary, ratings or leave balance. "
                 "I can only show you your own leave balance. For salary questions about yourself, "
                 "write to payroll@northbridge.example.")
APPROVE_REPLY = ("I can't approve or change leave. To apply, use the Northbridge People portal under \"My Leave\"; "
                 "your reporting manager approves within 3 working days (HR-02, Section 3). "
                 "If your request is urgent, please contact your manager directly.")
LEGAL_REPLY = ("I can't give legal advice. If you have a work-related concern, you can raise a grievance: Level 1 is your manager, "
               "Level 2 is your HR Business Partner, Level 3 is the Grievance Committee (HR-10, Section 3). "
               "You can also write to hrhelpdesk@northbridge.example.")
TAX_REPLY = ("I can't give tax advice. Tax declarations are made in April and proofs are submitted in December to January "
             "(HR-06, Section 3). For your own tax questions, write to payroll@northbridge.example.")
NEED_ID_REPLY = "Sure, I can check that. Please sign in with your employee ID (for example NB1001) in the box above."

HARASSMENT = re.compile(r"harass|molest|touched me|touching me|groped|stalk|sexual(ly)? (assault|abus|advance|comment)|"
                        r"inappropriate(ly)? (touch|comment|message)|eve[- ]?teas|\bposh\b|\bicc\b", re.I)
DISTRESS = re.compile(r"suicid|kill myself|end my life|want to die|self[- ]?harm|hopeless|can'?t cope|cannot cope|"
                      r"feel (very |so )?(low|depressed|anxious)|depress|panic attack|burn(ed|t)? ?out|breakdown", re.I)
INJECTION = re.compile(r"ignore (all |your |the |previous |above )+(instructions|rules)|system prompt|"
                       r"reveal (your |the )?(prompt|instructions|rules)|you are now|jailbreak|developer mode", re.I)
_ROLE = r"(ceo|md|cfo|cto|chro|director|boss|colleague|co-?worker|teammate|someone|somebody|everyone|everybody)"
_PRIVATE_THING = r"(salary|ctc|payslip|pay ?slip|rating|ratings|appraisal|leave balance)"
# Asking for ANOTHER person's private data (the CEO's salary, a colleague's rating, Rahul's payslip ...)
OTHER_DATA = re.compile(
    rf"\b{_ROLE}['\u2019]?s?\s+{_PRIVATE_THING}\b"
    r"|\bmanager['\u2019]?s?\s+(salary|ctc|payslip)\b"
    r"|\b(his|her|their)\s+(salary|ctc|payslip|leave balance)\b"
    rf"|\b{_PRIVATE_THING}\s+(of|for)\s+(the\s+|my\s+)?{_ROLE}\b"
    rf"|\b{_PRIVATE_THING}\s+(of|for)\s+(him|her|them)\b", re.I)
OTHER_NAME = re.compile(    # a person's name: "salary of Rahul", "Priya's payslip"  (generic words such as Band/Manager are excluded)
    r"\b(?i:salary|ctc|payslip|rating|appraisal|leave balance)\s+(?i:of|for)\s+"
    r"(?!Band\b|Grade\b|Level\b|The\b|An?\b|Employees?\b|Managers?\b|Directors?\b|Interns?\b|B\d)[A-Z][a-z]{2,}"
    r"|\b(?!The\b|My\b|Your\b|Our\b)[A-Z][a-z]{2,}['\u2019]s\s+(?i:salary|ctc|payslip|rating|appraisal|leave balance)\b")
LEGAL = re.compile(r"\bsue\b|lawyer|legal action|labou?r (court|commissioner)|\bcourt\b|wrongful(ly)? terminat", re.I)
TAX = re.compile(r"save (income )?tax|tax sav|\b80c\b|\bitr\b|tax (planning|advice|regime)", re.I)
APPROVE = re.compile(r"\b(approve|sanction|grant)\b.{0,25}\bleave|\b(apply|book|cancel)\b.{0,15}\bleave\b.{0,15}\bfor me\b", re.I)
TICKET_REQ = re.compile(r"\b(raise|create|open|log|file|submit)\b.{0,25}\bticket\b|\bticket\b.{0,15}\b(for me|please)\b", re.I)
TICKET_STATUS = re.compile(r"\bstatus\b.{0,30}\bticket\b|\bticket\b.{0,30}\bstatus\b|\bticket\b.{0,6}HR-\d{8}-\d{3}", re.I)
BALANCE = re.compile(r"\b(balance|left|remaining|remain)\b|how many .{0,25}(do i have|have i got|are left)|do i have (?!to\b)", re.I)
LEAVE_WORDS = re.compile(r"\b(leave|leaves|cl|sl|el|earned|casual|sick|comp[- ]?off|floating|lop|loss of pay)\b", re.I)
POLICY_ONLY = re.compile(r"\b(carry|forward|encash|policy|rule|accrue|lapse|certificate|notice|probation|maternity|paternity|"
                         r"marriage|bereavement|adoption|during|holiday)\b", re.I)


NOT_IN_DOCS = "not_in_documents"   # the signal the model is told to give when the documents do not contain the answer
NOT_FOUND_MESSAGE = ("I couldn't find this in the HR policy documents, so I can't answer it reliably. "
                     "I can raise an HR ticket so the HR team can reply to you directly.")
PARTIAL_NOTE = "\n\nIf this doesn't fully answer your question, I can raise an HR ticket for you."
# Phrases where the assistant itself says it does not know / could not find the answer
NOT_FOUND_PHRASES = (
    "i don't know", "i do not know", "couldn't find", "could not find", "can't find", "cannot find", "unable to find",
    "not able to find", "no information", "don't have information", "do not have information", "don't have enough",
    "do not have enough", "insufficient information", "cannot answer", "can't answer", "unable to answer",
)
# "the documents/policy do not mention/specify/contain ...", "... is not specified in the documents"
NOT_FOUND_REGEX = re.compile(
    r"\b(excerpts?|documents?|polic(y|ies)|handbook|text|context|material)\b.{0,25}\b(do not|does not|don't|doesn't|did not|didn't)\b"
    r".{0,12}\b(contain|mention|specify|say|include|provide|cover|address|state|have|describe)\b"
    r"|\bnot (specified|mentioned|covered|addressed|provided|stated|described) in (the |these |any |our )?"
    r"(\w+ ){0,2}(excerpts?|documents?|polic(y|ies)|handbook|context)\b", re.I)
PARTIAL_PHRASES = ("don't fully", "do not fully", "doesn't fully", "does not fully", "not fully", "only partially",
                   "partially answer", "only partly")


def _get(obj, name, default=None):
    """Read a field from either an object or a dict (different versions of route_query return different things)."""
    if isinstance(obj, dict):
        return obj.get(name, default)
    return getattr(obj, name, default)


def _strip_source_citation(text):
    """Remove a trailing '(Source: ...)' / 'Sources: ...' line from an answer."""
    last = None
    for last in re.finditer(r"\(?\s*\bsources?\s*:", text, re.I):
        pass
    if last and last.start() > len(text) - 400:
        return text[:last.start()].rstrip()
    return text


_WS = "\\s\u00a0\u202f\u2009"


def _fix_numbers(text):
    """The model sometimes breaks numbers like 5,00,000 into '5 ,00 000'. Put them back together."""
    text = re.sub(rf"(?<=\d)[{_WS}]+,(?=\d)", ",", text)                 # '5 ,00' -> '5,00'
    text = re.sub(rf",(\d{{2}})[{_WS}]+(?=\d{{3}}\b)", r",\1,", text)      # ',00 000' -> ',00,000'
    text = re.sub(r"(?<=\d)[\u00a0\u202f\u2009](?=\d{3}\b)", ",", text)    # '25<narrow space>000' -> '25,000'
    return text


FOLLOW_UP_START = re.compile(r"^\s*(and|also|what about|how about|then|so|but|what if)\b", re.I)
FOLLOW_UP_WORD = re.compile(r"\b(it|its|they|them|their)\b", re.I)


def _with_context(msg, history):
    """'And for a manager (B5)?' alone cannot be searched. Add the previous question so the search has the topic."""
    if not history or len(msg.split()) > 9:
        return msg
    if not (FOLLOW_UP_START.search(msg) or FOLLOW_UP_WORD.search(msg)):
        return msg
    prev = _last_user_question(history, None)
    if not prev or prev.strip().lower() == msg.strip().lower():
        return msg
    return f"{prev.strip()} {msg.strip()}"


def _call_router(route_query, msg, history):
    """Call route_query with only the options this project's version supports."""
    import inspect
    params = inspect.signature(route_query).parameters
    kwargs = {}
    if "history" in params:
        kwargs["history"] = (history or [])[-6:]
    if "department_filter" in params:
        kwargs["department_filter"] = ["hr"]
    return route_query(msg, **kwargs)


def _reply(answer, intent, **extra):
    base = dict(answer=answer, intent=intent, sources=[], departments_used=[], needs_human=False,
                classification_confident=True, ticket_offer=None, ticket=None)
    base.update(extra)
    return base


def _ticket_offer(question):
    category, priority = tickets.classify(question)
    return {"question": question, "category": category, "priority": priority}


def _last_user_question(history, current):
    for turn in reversed(history or []):
        if isinstance(turn, dict) and turn.get("role") == "user" and turn.get("text"):
            return str(turn["text"])
    return current


def is_balance_question(msg):
    """True for 'what is my leave balance', 'how many casual leaves are left', 'can I take EL next week'.
    False for rule questions such as 'how many casual leaves do I get in a year'."""
    if POLICY_ONLY.search(msg):
        return False
    if re.search(r"\bcan i (take|use|avail)\b", msg, re.I) and LEAVE_WORDS.search(msg):
        return True
    if re.search(r"\b(lop|loss of pay) days\b", msg, re.I):
        return True
    return bool(BALANCE.search(msg) and LEAVE_WORDS.search(msg))


def handle_message(message, employee_id=None, history=None):
    msg = (message or "").strip()
    signed_in = (employee_id or "").strip().upper() or None

    # 1. Safety and privacy
    if INJECTION.search(msg):
        return _reply(INJECTION_REPLY, "refusal")
    if DISTRESS.search(msg):
        return _reply(DISTRESS_REPLY, "distress")
    if HARASSMENT.search(msg):
        return _reply(HARASSMENT_REPLY, "harassment")
    others = {i.upper() for i in EMP_ID.findall(msg)} - ({signed_in} if signed_in else set())
    if others or OTHER_DATA.search(msg) or OTHER_NAME.search(msg):
        return _reply(PRIVACY_REPLY, "privacy")
    if APPROVE.search(msg):
        return _reply(APPROVE_REPLY, "refusal")
    if LEGAL.search(msg):
        return _reply(LEGAL_REPLY, "refusal")
    if TAX.search(msg):
        return _reply(TAX_REPLY, "refusal")

    # 2. Tickets
    m = TICKET_ID.search(msg)
    if m and TICKET_STATUS.search(msg):
        if not signed_in:
            return _reply(NEED_ID_REPLY, "need_signin")
        t = tickets.get_ticket(m.group(0), signed_in)
        if not t:
            return _reply(f"I couldn't find ticket {m.group(0).upper()} under your employee ID. "
                          "Please check the number, or write to hrhelpdesk@northbridge.example.", "ticket_status")
        return _reply(f"Ticket {t['ticket_id']}: status is **{t['status']}** "
                      f"(category: {t['category']}, priority: {t['priority']}, raised on {t['created_at'][:10]}).", "ticket_status")
    if TICKET_REQ.search(msg):
        q = _last_user_question(history, msg)
        return _reply("I can raise an HR ticket for you. Please check the details below and confirm.",
                      "ticket_offer", ticket_offer=_ticket_offer(q))

    # 3. Leave balance
    if is_balance_question(msg):
        if not signed_in:
            return _reply(NEED_ID_REPLY, "need_signin")
        row = leave_tool.get_employee(signed_in)
        if not row:
            return _reply(f"I couldn't find employee ID {signed_in}. Please check it and sign in again, "
                          "or I can raise an HR ticket.", "leave_balance", ticket_offer=_ticket_offer(msg))
        return _reply(leave_tool.format_balance(row), "leave_balance", ticket_offer=_ticket_offer(
            "My leave balance looks wrong. Please check."))

    # 4. Policy Q&A (RAG, HR documents only)
    from rag.router_agent import route_query  # imported here so the other routes can be tested without the AI stack
    query = _with_context(msg, history)
    result = _call_router(route_query, query, history)
    answer = _fix_numbers((_get(result, "answer", "") or "").strip())
    sources = _get(result, "sources", []) or []
    low = answer.lower().replace("\u2019", "'")          # curly apostrophe -> straight
    reported = _get(result, "needs_human", None)          # newer versions of route_query report this themselves

    said_not_found = NOT_IN_DOCS in low or any(p in low for p in NOT_FOUND_PHRASES) or bool(NOT_FOUND_REGEX.search(low))
    said_partial = any(p in low for p in PARTIAL_PHRASES)
    not_found = bool(reported) or (not sources) or NOT_IN_DOCS in low or (said_not_found and len(answer) < 450)

    offer = None
    if not_found:
        # The bot does not know: say so, show NO sources, and route the question to HR as a ticket.
        answer, sources, needs_human = NOT_FOUND_MESSAGE, [], True
        offer = _ticket_offer(query)
    elif said_not_found or said_partial:
        # A longer answer that admits it is incomplete: keep the text, but show no sources and offer a ticket.
        answer, sources, needs_human = _strip_source_citation(answer) + PARTIAL_NOTE, [], True
        offer = _ticket_offer(query)
    else:
        needs_human = False
        if tickets.classify(query)[1] == "P1":     # urgent topics (e.g. salary not credited) always get a ticket offer
            answer, sources = _strip_source_citation(answer), []
            offer = _ticket_offer(query)
    return _reply(answer, "policy", sources=sources, departments_used=_get(result, "departments_used", ["hr"]),
                  needs_human=needs_human, classification_confident=_get(result, "classification_confident", True),
                  ticket_offer=offer)
