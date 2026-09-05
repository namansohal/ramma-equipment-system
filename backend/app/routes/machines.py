from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.machines import Machine
from app.auth import get_current_user
from app.models.users import User

router = APIRouter(prefix="/machines", tags=["Machines"])


@router.get("/")
def get_machines(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    machines = db.query(Machine).filter(Machine.active == True).order_by(Machine.machine_id).all()
    return [
        {"machine_id": m.machine_id, "code": m.code, "name": m.name}
        for m in machines
    ]