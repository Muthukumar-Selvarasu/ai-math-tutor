from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class TurnCreate(BaseModel):
    role: str
    content: str
    
class TurnResponse(BaseModel):
    id: UUID
    session_id: UUID
    role: str
    content: str
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)

class SessionCreate(BaseModel):
    question_id: UUID
    
class SessionResponse(BaseModel):
    id: UUID
    user_id: UUID
    question_id: UUID
    status: str
    created_at: datetime
    turns: list[TurnResponse] | None = []
    
    model_config = ConfigDict(from_attributes=True)

class SessionAttemptCreate(BaseModel):
    response_type: str  # text, fraction, etc
    response_value: str
    confidence_rating: int | None = None
    response_duration_ms: int | None = None
