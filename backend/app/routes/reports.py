from fastapi import APIRouter, Depends, Query, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func, case
from datetime import date
from typing import Optional
from io import BytesIO
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment
from app.database import get_db
from app.models.expenses import Expense, ExpenseMachineLink
from app.models.mainbook import MainbookTransaction
from app.models.stock import StockTransaction
from app.models.spare_parts import SparePart
from app.models.machines import Machine
from app.auth import get_current_user
from app.models.users import User
from app.permissions import require_admin

router = APIRouter(prefix="/reports", tags=["Reports"])


def date_filter(query, model_date, from_date, to_date):
    if from_date:
        query = query.filter(model_date >= from_date)
    if to_date:
        query = query.filter(model_date <= to_date)
    return query


# ---------- JSON data endpoints (for on-screen preview) ----------
# All report endpoints require owner/manager (require_admin) — viewers have no report access at all.

@router.get("/expenses")
def expense_report(
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    q = db.query(Expense).filter(Expense.deleted_at == None)
    q = date_filter(q, Expense.txn_date, from_date, to_date)
    rows = q.order_by(Expense.txn_date).all()
    total = sum(float(e.debit or 0) for e in rows)
    return {
        "total": total,
        "count": len(rows),
        "rows": [
            {"date": str(e.txn_date), "description": e.description,
             "debit": float(e.debit or 0), "credit": float(e.credit or 0)}
            for e in rows
        ]
    }


@router.get("/machine-cost")
def machine_cost_report(
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    q = db.query(
        Machine.code,
        func.coalesce(func.sum(Expense.debit), 0).label("total")
    ).join(
        ExpenseMachineLink, ExpenseMachineLink.machine_id == Machine.machine_id
    ).join(
        Expense, Expense.expense_id == ExpenseMachineLink.expense_id
    ).filter(Expense.deleted_at == None)
    q = date_filter(q, Expense.txn_date, from_date, to_date)
    rows = q.group_by(Machine.code).order_by(Machine.code).all()
    return {"rows": [{"machine": r.code, "total": float(r.total)} for r in rows]}


@router.get("/stock")
def stock_report(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    results = db.query(
        StockTransaction.part_id,
        func.sum(case((StockTransaction.direction == "IN", StockTransaction.quantity),
                      else_=-StockTransaction.quantity)).label("available")
    ).filter(StockTransaction.deleted_at == None).group_by(StockTransaction.part_id).all()
    parts = {p.part_id: p.name for p in db.query(SparePart).all()}
    return {"rows": [{"part": parts.get(r.part_id), "available": float(r.available)} for r in results]}


@router.get("/mainbook")
def mainbook_report(
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    q = db.query(MainbookTransaction).filter(MainbookTransaction.deleted_at == None)
    q = date_filter(q, MainbookTransaction.txn_date, from_date, to_date)
    rows = q.order_by(MainbookTransaction.txn_date).all()
    return {
        "rows": [
            {"date": str(r.txn_date), "description": r.description,
             "debit": float(r.debit or 0), "credit": float(r.credit or 0),
             "balance": float(r.balance or 0)}
            for r in rows
        ]
    }


# ---------- Excel export ----------

_FORMULA_PREFIXES = ("=", "+", "-", "@", "\t", "\r")


def _excel_safe(value):
    """User-entered text starting with a formula character would become a live
    formula in the exported sheet. Prefix it with a quote so it stays text."""
    if isinstance(value, str) and value.startswith(_FORMULA_PREFIXES):
        return "'" + value
    return value


def make_excel(title, headers, data_rows):
    wb = Workbook()
    ws = wb.active
    ws.title = title[:31]

    header_font = Font(bold=True, color="FFFFFF")
    header_fill = PatternFill(start_color="B91C1C", end_color="B91C1C", fill_type="solid")

    ws.append([title])
    ws["A1"].font = Font(bold=True, size=14)
    ws.append([])

    ws.append(headers)
    for col in range(1, len(headers) + 1):
        cell = ws.cell(row=3, column=col)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = Alignment(horizontal="left")

    for row in data_rows:
        ws.append([_excel_safe(v) for v in row])

    for col in ws.columns:
        max_len = max((len(str(c.value)) for c in col if c.value), default=10)
        ws.column_dimensions[col[0].column_letter].width = max_len + 4

    buf = BytesIO()
    wb.save(buf)
    buf.seek(0)
    return buf


@router.get("/export/{report_type}")
def export_report(
    report_type: str,
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    if report_type == "expenses":
        data = expense_report(from_date, to_date, db, current_user)
        headers = ["Date", "Description", "Debit (GHS)", "Credit (GHS)"]
        rows = [[r["date"], r["description"], r["debit"], r["credit"]] for r in data["rows"]]
        buf = make_excel("Expenses Report", headers, rows)
        fname = "expenses_report.xlsx"

    elif report_type == "machine-cost":
        data = machine_cost_report(from_date, to_date, db, current_user)
        headers = ["Machine", "Total Spend (GHS)"]
        rows = [[r["machine"], r["total"]] for r in data["rows"]]
        buf = make_excel("Machine Cost Report", headers, rows)
        fname = "machine_cost_report.xlsx"

    elif report_type == "stock":
        data = stock_report(db, current_user)
        headers = ["Part", "Available"]
        rows = [[r["part"], r["available"]] for r in data["rows"]]
        buf = make_excel("Stock Report", headers, rows)
        fname = "stock_report.xlsx"

    elif report_type == "mainbook":
        data = mainbook_report(from_date, to_date, db, current_user)
        headers = ["Date", "Description", "Debit (GHS)", "Credit (GHS)", "Balance (GHS)"]
        rows = [[r["date"], r["description"], r["debit"], r["credit"], r["balance"]] for r in data["rows"]]
        buf = make_excel("Mainbook Ledger", headers, rows)
        fname = "mainbook_report.xlsx"

    else:
        raise HTTPException(status_code=400, detail="Unknown report type")

    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={fname}"}
    )