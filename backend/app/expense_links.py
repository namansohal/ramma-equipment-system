"""Expenses created by another record (a spare-part purchase, a mainbook entry,
a loan or a loan repayment) must be deleted and restored together with it,
otherwise the books stop matching."""
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy.orm import Session
from app.models.audit import AuditLog
from app.models.links import ExpenseStockLink, MainbookExpenseLink
from app.models.loans import Loan, LoanRepayment
from app.models.mainbook import MainbookTransaction
from app.models.stock import StockTransaction


def _stock_txn(db, expense_id):
    link = db.query(ExpenseStockLink).filter(ExpenseStockLink.expense_id == expense_id).first()
    return link and db.query(StockTransaction).filter(StockTransaction.stock_txn_id == link.stock_txn_id).first()


def _mainbook_txn(db, expense_id):
    link = db.query(MainbookExpenseLink).filter(MainbookExpenseLink.expense_id == expense_id).first()
    return link and db.query(MainbookTransaction).filter(MainbookTransaction.transaction_id == link.transaction_id).first()


def delete_blocked_reason(db: Session, expense) -> Optional[str]:
    """Why this expense can't be deleted on its own from the Expenses page, or None."""
    st = _stock_txn(db, expense.expense_id)
    if st and st.deleted_at is None:
        return "This expense came from a spare-part purchase. Delete the purchase in Spare Parts → Recent transactions; that removes both."
    mb = _mainbook_txn(db, expense.expense_id)
    if mb and mb.deleted_at is None:
        return "This expense came from a Mainbook entry. Delete that Mainbook entry; that removes both."
    loan = db.query(Loan).filter(Loan.expense_id == expense.expense_id, Loan.deleted_at == None).first()
    if loan and db.query(LoanRepayment).filter(LoanRepayment.loan_id == loan.loan_id, LoanRepayment.deleted_at == None).first():
        return "This loan has repayments. Delete the repayment entries first."
    return None


def delete_linked(db: Session, expense, user_id: int):
    """Delete the loan / repayment that this expense represents."""
    now = datetime.now(timezone.utc)
    loan = db.query(Loan).filter(Loan.expense_id == expense.expense_id, Loan.deleted_at == None).first()
    if loan:
        loan.deleted_at, loan.deleted_by = now, user_id
        db.add(AuditLog(table_name="loans", record_id=loan.loan_id, action="DELETE",
                        old_value=f"amount={loan.amount} (its expense entry was deleted)", changed_by=user_id))
    rep = db.query(LoanRepayment).filter(LoanRepayment.expense_id == expense.expense_id, LoanRepayment.deleted_at == None).first()
    if rep:
        rep.deleted_at = now
        db.add(AuditLog(table_name="loans", record_id=rep.loan_id, action="UPDATE",
                        old_value=f"repayment of {rep.amount} removed (its expense entry was deleted)", changed_by=user_id))


def restore_blocked_reason(db: Session, expense) -> Optional[str]:
    mb = _mainbook_txn(db, expense.expense_id)
    if mb and mb.deleted_at is not None:
        return "This expense belongs to a deleted Mainbook entry. Restore the Mainbook entry instead; that restores both."
    rep = db.query(LoanRepayment).filter(LoanRepayment.expense_id == expense.expense_id).first()
    if rep:
        loan = db.query(Loan).filter(Loan.loan_id == rep.loan_id).first()
        if loan and loan.deleted_at is not None:
            return "This repayment belongs to a deleted loan. Restore the loan's expense entry first."
    return None


def restore_linked(db: Session, expense, user_id: int):
    """Bring back what was deleted together with this expense."""
    st = _stock_txn(db, expense.expense_id)
    if st and st.deleted_at is not None:
        st.deleted_at, st.deleted_by = None, None
        db.add(AuditLog(table_name="stock_transactions", record_id=st.stock_txn_id, action="RESTORE",
                        new_value=f"restored with expense {expense.expense_id}", changed_by=user_id))
    loan = db.query(Loan).filter(Loan.expense_id == expense.expense_id, Loan.deleted_at != None).first()
    if loan:
        loan.deleted_at, loan.deleted_by = None, None
        db.add(AuditLog(table_name="loans", record_id=loan.loan_id, action="RESTORE",
                        new_value=f"restored with expense {expense.expense_id}", changed_by=user_id))
    rep = db.query(LoanRepayment).filter(LoanRepayment.expense_id == expense.expense_id, LoanRepayment.deleted_at != None).first()
    if rep:
        rep.deleted_at = None
        db.add(AuditLog(table_name="loans", record_id=rep.loan_id, action="UPDATE",
                        new_value=f"repayment of {rep.amount} restored", changed_by=user_id))
