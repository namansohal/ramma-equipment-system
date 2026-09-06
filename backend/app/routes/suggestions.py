from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import distinct
from app.database import get_db
from app.models.expenses import Expense
from app.models.mainbook import MainbookTransaction
from app.auth import get_current_user
from app.models.users import User

router = APIRouter(prefix="/suggestions", tags=["Suggestions"])


@router.get("/descriptions")
def get_description_suggestions(
    source: str = "expenses",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if source == "mainbook":
        rows = db.query(distinct(MainbookTransaction.description)).filter(
            MainbookTransaction.deleted_at == None
        ).limit(500).all()
    else:
        rows = db.query(distinct(Expense.description)).filter(
            Expense.deleted_at == None
        ).limit(500).all()

    descriptions = [r[0] for r in rows if r[0]]
    return descriptions