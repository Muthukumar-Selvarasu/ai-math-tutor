from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, Dict, Any, List
from uuid import UUID

class AcceptedAnswerSpec(BaseModel):
    value: str
    format: str  # e.g. fraction, decimal, ratio, percentage, integer
    tolerance: Optional[float] = None

class QuestionBase(BaseModel):
    title: str
    content: str
    skill_id: UUID
    subskill: Optional[str] = None
    difficulty: int = 1
    validation_status: str = "draft"
    publication_status: str = "draft"
    accepted_answer_spec: Optional[AcceptedAnswerSpec] = None
    misconception_tags: Optional[Dict[str, Any]] = None
    solution_path: Optional[Dict[str, Any]] = None
    socratic_prompt_metadata: Optional[Dict[str, Any]] = None
    diagram_requirement_flag: bool = False
    version_number: int = 1

class QuestionCreate(QuestionBase):
    pass

class QuestionResponse(QuestionBase):
    id: UUID
    
    model_config = ConfigDict(from_attributes=True)

class QuestionImportItem(BaseModel):
    title: str
    content: str
    skill_name: str
    subskill: Optional[str] = None
    difficulty: int = 1
    accepted_answer_spec: AcceptedAnswerSpec
    misconception_tags: Optional[Dict[str, Any]] = None
    solution_path: Optional[Dict[str, Any]] = None
    socratic_prompt_metadata: Optional[Dict[str, Any]] = None
    diagram_requirement_flag: bool = False
