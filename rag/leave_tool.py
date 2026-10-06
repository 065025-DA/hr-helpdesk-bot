"""
leave_tool.py - Feature 2: leave-balance lookup.

This is NOT done by the AI model. It reads the employee's own row from
rag/hr_data/employee_leave_balances.csv and formats it. (The file lives inside rag/
so that Vercel includes it when you deploy.)
In a real company this would call the HRMS / HR database instead of a CSV.
"""
import csv
from pathlib import Path

DATA_PATH = Path(__file__).parent / "hr_data" / "employee_leave_balances.csv"
_rows = None


def _load():
    global _rows
    if _rows is None:
        with open(DATA_PATH, newline="", encoding="utf-8") as f:
            _rows = {r["employee_id"].strip().upper(): r for r in csv.DictReader(f)}
    return _rows


def get_employee(employee_id):
    """Return the employee's row (a dict) or None if the ID does not exist."""
    if not employee_id:
        return None
    return _load().get(str(employee_id).strip().upper())


def all_employees():
    """List of (employee_id, name, department) for the sign-in drop-down. DEMO ONLY: a real system would never list staff."""
    return [{"employee_id": r["employee_id"], "name": r["name"], "department": r["department"]}
            for r in _load().values()]


def _n(x):
    """25.0 -> '25', 27.5 -> '27.5'"""
    return f"{float(x):g}"


def format_balance(row):
    first = row["name"].split()[0]
    lines = [
        f"Hi {first}, here is your leave balance as of {row['balance_as_of']}:",
        "",
        f"- Casual Leave (CL): {_n(row['cl_balance'])} days left (of {_n(row['cl_entitled'])})",
        f"- Sick Leave (SL): {_n(row['sl_balance'])} days left (of {_n(row['sl_entitled'])})",
        f"- Earned Leave (EL): {_n(row['el_balance'])} days "
        f"({_n(row['el_carried_forward'])} carried forward + {_n(row['el_accrued_2026'])} earned this year - {_n(row['el_used'])} used)",
        f"- Comp-off: {_n(row['comp_off_balance'])} days",
        f"- Floating holidays: {_n(row['floating_holidays_balance'])} left (of {_n(row['floating_holidays_entitled'])})",
    ]
    if float(row["lop_days_2026"]) > 0:
        lines.append(f"- Loss of Pay days this year: {_n(row['lop_days_2026'])}")
    if row["employment_status"].lower() == "probation":
        lines += ["", "Note: you are on probation. Earned Leave can be used only after confirmation; "
                      "in an emergency you can take up to 3 days with your manager's approval (HR-02, Section 7.4)."]
    if float(row["comp_off_balance"]) > 0:
        lines += ["", "Comp-off must be used within 60 days of earning it (HR-02, Section 12)."]
    lines += ["", "If this looks wrong, I can raise an HR ticket for HR Operations to check."]
    return "\n".join(lines)
