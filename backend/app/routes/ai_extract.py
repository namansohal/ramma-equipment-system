import os
import json
import base64
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from google import genai
from app.auth import get_current_user
from app.models.users import User
from app.permissions import require_editor

router = APIRouter(prefix="/ai", tags=["AI Extraction"])

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")


@router.post("/extract-receipt")
async def extract_receipt(
    file: UploadFile = File(...),
    current_user: User = Depends(require_editor)
):
    if not GEMINI_API_KEY:
        raise HTTPException(status_code=500, detail="AI extraction is not configured on the server")

    contents = await file.read()
    if len(contents) > 8 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Image too large (max 8MB)")

    try:
        client = genai.Client(api_key=GEMINI_API_KEY)

        prompt = """You are looking at a photo of a receipt, invoice, or a handwritten ledger/cashbook page that may contain MULTIPLE separate transactions (one per line).

Read EVERY distinct line item / transaction you can find in the image. For each one, extract:
- date (YYYY-MM-DD format; if a line has no date but a date appears above it in the same block/day, reuse that date; if truly no date is visible anywhere, use null)
- description (what the line says, in your own words, short)
- amount (numeric value only, no currency symbols or commas)
- direction: "out" if it looks like money leaving (a debit/expense/payment), "in" if it looks like money coming in (a credit/receipt/income). If unclear, guess based on context (most ledger lines are "out").

Return ONLY a valid JSON array, no markdown, no explanation, in this exact shape:
[
  {"date": "2026-08-29", "description": "Carry Forward", "amount": 5910, "direction": "in"},
  {"date": "2026-08-29", "description": "Kia Konogo to observe", "amount": 5000, "direction": "out"}
]

If the image has only one transaction (like a single shop receipt), return an array with just one object.
Do not skip any line. Do not merge separate lines into one. If a numeric value is genuinely illegible, use null for that field but still include the row."""

        response = client.models.generate_content(
            model="gemini-3.6-flash",
            contents=[
                {"inline_data": {"mime_type": file.content_type or "image/jpeg", "data": base64.b64encode(contents).decode("utf-8")}},
                {"text": prompt},
            ],
        )

        raw_text = response.text.strip()
        if raw_text.startswith("```"):
            raw_text = raw_text.strip("`")
            if raw_text.startswith("json"):
                raw_text = raw_text[4:].strip()

        extracted = json.loads(raw_text)

        if isinstance(extracted, dict):
            extracted = [extracted]

        rows = []
        for item in extracted:
            rows.append({
                "date": item.get("date"),
                "description": item.get("description"),
                "amount": item.get("amount"),
                "direction": item.get("direction") if item.get("direction") in ("in", "out") else "out",
            })

        return {"rows": rows}

    except json.JSONDecodeError:
        raise HTTPException(status_code=502, detail="Could not read data from the image. Try a clearer photo.")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI extraction failed: {str(e)}")