from sqlalchemy import Column, Integer, ForeignKey
from app.database import Base


class ExpenseStockLink(Base):
    __tablename__ = "expense_stock_links"

    expense_id   = Column(Integer, ForeignKey("expenses.expense_id"), primary_key=True)
    stock_txn_id = Column(Integer, ForeignKey("stock_transactions.stock_txn_id"), primary_key=True)


class MainbookExpenseLink(Base):
    __tablename__ = "mainbook_expense_links"

    transaction_id = Column(Integer, ForeignKey("mainbook_transactions.transaction_id"), primary_key=True)
    expense_id     = Column(Integer, ForeignKey("expenses.expense_id"), primary_key=True)

class MainbookMomoLink(Base):
    """Mainbook money sent to MOMO, and the MOMO 'money in' entry it created."""
    __tablename__ = "mainbook_momo_links"

    transaction_id = Column(Integer, ForeignKey("mainbook_transactions.transaction_id"), primary_key=True)
    momo_id        = Column(Integer, ForeignKey("momo_transactions.momo_id"), primary_key=True)
