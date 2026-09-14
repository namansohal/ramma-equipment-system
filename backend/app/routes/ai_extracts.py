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

        prompt = """You are looking at a receipt, invoice, or handwritten note about a business expense.
Extract the following fields and return ONLY valid JSON, no markdown, no explanation:
{
  "date": "YYYY-MM-DD or null if not visible",
  "amount": numeric value only (no currency symbol) or null,
  "description": "short description of what was purchased or paid for, or null",
  "vendor": "shop or supplier name if visible, or null"
}
If you cannot confidently read a field, set it to null. Do not guess."""

        response = client.models.generate_content(
            model="gemini-2.0-flash",
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

        return {
            "date": extracted.get("date"),
            "amount": extracted.get("amount"),
            "description": extracted.get("description"),
            "vendor": extracted.get("vendor"),
        }

    except json.JSONDecodeError:
        raise HTTPException(status_code=502, detail="Could not read data from the image. Try a clearer photo.")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI extraction failed: {str(e)}")