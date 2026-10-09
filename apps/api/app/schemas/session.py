from pydantic import BaseModel, ConfigDict
from typing import Optional, List, Dict, Any
from uuid import UUID
from datetime import datetime

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
    turns: Optional[List[TurnResponse]] = []
    
    model_config = ConfigDict(from_attributes=True)

class SessionAttemptCreate(BaseModel):
    response_type: str  # text, fraction, etc
    response_value: str
    confidence_rating: Optional[int] = None
    response_duration_ms: Optional[int] = None
