from pydantic import BaseModel
from typing import Optional


class UserCreate(BaseModel):
    full_name: str
    username: str
    password: str
    employee_code: Optional[str] = None
    role_id: int


class UserResponse(BaseModel):
    user_id: int
    full_name: str
    username: str
    employee_code: Optional[str]
    role: str
    active: bool

    class Config:
        from_attributes = True


class PasswordChange(BaseModel):
    old_password: str
    new_password: str