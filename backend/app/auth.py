from datetime import datetime, timedelta, timezone
import bcrypt
import jwt
from jwt import PyJWTError as JWTError
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.users import User
import os
import hmac
import logging
import hashlib
from dotenv import load_dotenv

load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM  = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "480"))

if not SECRET_KEY:
    raise RuntimeError("SECRET_KEY environment variable is not set")
if len(SECRET_KEY) < 32:
    logging.getLogger(__name__).warning("SECRET_KEY is shorter than 32 characters; use a long random value")
if ALGORITHM not in ("HS256", "HS384", "HS512"):
    raise RuntimeError("ALGORITHM must be HS256, HS384 or HS512")

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")

# bcrypt only reads the first 72 bytes; cut explicitly (what passlib did) so
# existing hashes keep matching and newer bcrypt versions don't raise.
def _pw_bytes(password: str) -> bytes:
    return (password or "").encode("utf-8")[:72]

def verify_password(plain, hashed):
    try:
        return bcrypt.checkpw(_pw_bytes(plain), (hashed or "").encode("utf-8"))
    except ValueError:  # not a bcrypt hash
        return False

def hash_password(password):
    return bcrypt.hashpw(_pw_bytes(password), bcrypt.gensalt()).decode("utf-8")

def password_fingerprint(password_hash: str) -> str:
    """Short keyed digest of the stored hash. Changes whenever the password
    changes, so tokens issued before a password change stop working."""
    return hmac.new(SECRET_KEY.encode(), password_hash.encode(), hashlib.sha256).hexdigest()[:16]

def create_access_token(data: dict):
    to_encode = data.copy()
    expire    = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def issue_token(user: User) -> str:
    return create_access_token(data={
        "sub":  str(user.user_id),
        "role": user.role.name,
        "pwf":  password_fingerprint(user.password_hash),
    })

def get_current_user(
    token: str = Depends(oauth2_scheme),
    db:    Session = Depends(get_db)
):
    credentials_exception = HTTPException(
        status_code = status.HTTP_401_UNAUTHORIZED,
        detail      = "Could not validate credentials",
        headers     = {"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = int(payload.get("sub"))
        fingerprint = payload.get("pwf")
        if not fingerprint:
            raise credentials_exception
    except (JWTError, TypeError, ValueError):
        raise credentials_exception

    # Look up by user_id, never by username: usernames can be changed and reused,
    # which would let an old token resolve to a different person.
    user = db.query(User).filter(User.user_id == user_id).first()
    if user is None or not user.active:
        raise credentials_exception
    if not hmac.compare_digest(fingerprint, password_fingerprint(user.password_hash)):
        raise credentials_exception
    return user

def require_role(*roles):
    def checker(current_user: User = Depends(get_current_user)):
        if current_user.role.name not in roles:
            raise HTTPException(
                status_code = status.HTTP_403_FORBIDDEN,
                detail      = "You do not have permission to perform this action"
            )
        return current_user
    return checker