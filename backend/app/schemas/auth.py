from pydantic import BaseModel


class LoginRequest(BaseModel):
    username: str
    password: str
    subdomain: str | None = None


class UserOut(BaseModel):
    id: int
    full_name: str
    role: str


class TokenResponse(BaseModel):
    access_token: str
    user: UserOut
