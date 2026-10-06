import os
import json
import base64
import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from pydantic import BaseModel
from google import genai
from app.auth import get_current_user
from app.models.users import User
from app.permissions import require_editor

router = APIRouter(prefix="/ai", tags=["AI Extraction"])
logger = logging.getLogger(__name__)

MAX_UPLOAD_BYTES = 8 * 1024 * 1024
ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"}
MAX_CHAT_MESSAGES = 40
MAX_CHAT_CHARS = 60_000
ALLOWED_MODES = {"expense", "runtime", "spare_parts"}

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    system: Optional[str] = None


@router.post("/chat")
async def ai_chat(
    data: ChatRequest,
    current_user: User = Depends(get_current_user)
):
    # General-purpose chat on the company's API key: owner only.
    if current_user.role.name != "owner":
        raise HTTPException(status_code=403, detail="Only the owner can use AI chat")
    if not GEMINI_API_KEY:
        raise HTTPException(status_code=500, detail="AI not configured on the server")
    total_chars = sum(len(m.content) for m in data.messages) + len(data.system or "")
    if not data.messages or len(data.messages) > MAX_CHAT_MESSAGES or total_chars > MAX_CHAT_CHARS:
        raise HTTPException(status_code=400, detail="Conversation is empty or too long")
    try:
        client = genai.Client(api_key=GEMINI_API_KEY)
        contents = []
        for m in data.messages:
            contents.append({
                "role": "user" if m.role == "user" else "model",
                "parts": [{"text": m.content}]
            })
        if data.system and contents:
            contents[0]["parts"][0]["text"] = f"{data.system}\n\n{contents[0]['parts'][0]['text']}"
        response = client.models.generate_content(
            model="gemini-3.5-flash-lite",
            contents=contents,
        )
        return {"reply": response.text}
    except Exception:
        logger.exception("AI chat failed")
        raise HTTPException(status_code=502, detail="AI chat failed. Please try again.")


@router.post("/extract-receipt")
async def extract_receipt(
    file: UploadFile = File(...),
    mode: str = Form("expense"),
    current_user: User = Depends(require_editor)
):
    if not GEMINI_API_KEY:
        raise HTTPException(status_code=500, detail="AI extraction is not configured on the server")

    if mode not in ALLOWED_MODES:
        raise HTTPException(status_code=400, detail="Unknown extraction mode")
    content_type = (file.content_type or "").lower()
    if content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=400, detail="Please upload a JPEG, PNG, WEBP or HEIC image")

    # Read one byte past the limit so oversized uploads are rejected without
    # holding the whole file in memory.
    contents = await file.read(MAX_UPLOAD_BYTES + 1)
    if len(contents) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=400, detail="Image too large (max 8MB)")

    try:
        client = genai.Client(api_key=GEMINI_API_KEY)

        if mode == "runtime":
            prompt = """You are looking at a photo of a handwritten machine runtime/shift logbook page.
It may contain MULTIPLE rows, one per machine or per shift entry.

Read EVERY distinct row you can find. For each one, extract:
- machine_code (e.g. "H8", "H11", "H17" — the machine identifier as written)
- customer_name (if a customer/site name is mentioned, else null)
- date (YYYY-MM-DD; if a date header applies to a block of rows below it, reuse that date for those rows; if none visible anywhere, use null)
- start_reading (numeric meter reading, or null if not visible)
- end_reading (numeric meter reading, or null if not visible)
- amount (numeric value if a money amount is written, or null)
- status_note (any other text on that line, like "8 shifts", "Booking finished", "Moved to new site" — short summary)

Return ONLY a valid JSON array, no markdown, no explanation, in this exact shape:
[
  {"machine_code": "H8", "customer_name": null, "date": "2026-09-01", "start_reading": null, "end_reading": null, "amount": null, "status_note": "Booking finished"}
]
Do not skip any row. If a field is genuinely illegible, use null for it but still include the row."""

        elif mode == "spare_parts":
            prompt = """You are looking at a photo of a spare parts list or inventory sheet.
It may be handwritten or printed, and typically has columns like: item name, supplier, quantity, price/unit price, and notes.

Read EVERY row in the list. For each one, extract:
- item (the part name or description as written — keep it as-is, don't correct spelling)
- supplier (supplier or shop name, or null if not visible)
- quantity (numeric quantity, or null if not visible or blank)
- unit_price (price per unit as a number, or null if not visible or blank)
- notes (any additional notes or comments on that row, or null)

Return ONLY a valid JSON array, no markdown, no explanation, in this exact shape:
[
  {"item": "Engine Oil HHUNDAI", "supplier": "Bhareth", "quantity": 20, "unit_price": 510, "notes": null},
  {"item": "Grease Bucket", "supplier": null, "quantity": null, "unit_price": null, "notes": null}
]
Do not skip any row even if most fields are blank — include it with nulls.
Do not merge rows. Each numbered line in the list is its own row."""

        else:
            prompt = """You are looking at a receipt, invoice, or a handwritten ledger/cashbook page that may contain MULTIPLE separate transactions (one per line).

Read EVERY distinct line item / transaction you can find in the image. For each one, extract:
- date (YYYY-MM-DD format; if a line has no date but a date appears above it in the same block/day, reuse that date; if truly no date is visible anywhere, use null)
- description (what the line says, in your own words, short)
- amount (numeric value only, no currency symbols or commas)
- direction: "out" if it looks like money leaving (a debit/expense/payment), "in" if it looks like money coming in (a credit/receipt/income). If unclear, guess "out".

Return ONLY a valid JSON array, no markdown, no explanation:
[
  {"date": "2026-08-29", "description": "Carry Forward", "amount": 5910, "direction": "in"}
]
Do not skip any line. If a numeric value is genuinely illegible, use null but still include the row."""

        response = client.models.generate_content(
            model="gemini-3.5-flash-lite",
            contents=[
                {"inline_data": {"mime_type": content_type, "data": base64.b64encode(contents).decode("utf-8")}},
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

        if mode == "runtime":
            return {"rows": [
                {
                    "machine_code": item.get("machine_code"),
                    "customer_name": item.get("customer_name"),
                    "date": item.get("date"),
                    "start_reading": item.get("start_reading"),
                    "end_reading": item.get("end_reading"),
                    "amount": item.get("amount"),
                    "status_note": item.get("status_note"),
                }
                for item in extracted
            ]}

        elif mode == "spare_parts":
            return {"rows": [
                {
                    "item": item.get("item"),
                    "supplier": item.get("supplier"),
                    "quantity": item.get("quantity"),
                    "unit_price": item.get("unit_price"),
                    "notes": item.get("notes"),
                }
                for item in extracted
            ]}

        else:
            return {"rows": [
                {
                    "date": item.get("date"),
                    "description": item.get("description"),
                    "amount": item.get("amount"),
                    "direction": item.get("direction") if item.get("direction") in ("in", "out") else "out",
                }
                for item in extracted
            ]}

    except json.JSONDecodeError:
        raise HTTPException(status_code=502, detail="Could not read data from the image. Try a clearer photo.")
    except Exception:
        logger.exception("AI extraction failed")
        raise HTTPException(status_code=502, detail="AI extraction failed. Please try again.")