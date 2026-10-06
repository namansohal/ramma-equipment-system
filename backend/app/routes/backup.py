import io
import json
import zipfile
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from app.database import get_db, Base
from app.models.audit import AuditLog
from app.models.users import User
from app.auth import get_current_user

router = APIRouter(prefix="/backup", tags=["Backup"])

# Never written to a downloadable file.
EXCLUDED_COLUMNS = {("users", "password_hash")}


@router.get("/export")
def export_all(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Owner only: every table as JSON in one zip (password hashes left out)."""
    if current_user.role.name != "owner":
        raise HTTPException(status_code=403, detail="Only the owner can download a full backup")

    stamp = datetime.now(timezone.utc).strftime("%Y-%m-%d_%H%M")
    buf = io.BytesIO()
    counts = {}
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        for table in Base.metadata.sorted_tables:
            cols = [c.name for c in table.columns if (table.name, c.name) not in EXCLUDED_COLUMNS]
            rows = [dict(zip(cols, r)) for r in db.execute(table.select().with_only_columns(*[table.c[c] for c in cols])).all()]
            counts[table.name] = len(rows)
            z.writestr(f"{table.name}.json", json.dumps(rows, default=str, ensure_ascii=False, indent=1))
        z.writestr("manifest.json", json.dumps({
            "created_utc": stamp, "created_by": current_user.username, "row_counts": counts,
            "note": "Password hashes are not included; restored users need new passwords.",
        }, indent=1))

    db.add(AuditLog(table_name="backup", record_id=0, action="EXPORT",
                    new_value=f"{sum(counts.values())} rows in {len(counts)} tables", changed_by=current_user.user_id))
    db.commit()
    buf.seek(0)
    return StreamingResponse(buf, media_type="application/zip",
                             headers={"Content-Disposition": f"attachment; filename=ramma_backup_{stamp}.zip"})
