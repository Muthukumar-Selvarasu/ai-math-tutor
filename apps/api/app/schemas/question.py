from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class AcceptedAnswerSpec(BaseModel):
    value: str
    format: str  # e.g. fraction, decimal, ratio, percentage, integer
    tolerance: float | None = None

class QuestionBase(BaseModel):
    title: str
    content: str
    skill_id: UUID
    subskill: str | None = None
    difficulty: int = 1
    validation_status: str = "draft"
    publication_status: str = "draft"
    accepted_answer_spec: AcceptedAnswerSpec | None = None
    misconception_tags: dict[str, Any] | None = None
    solution_path: dict[str, Any] | None = None
    socratic_prompt_metadata: dict[str, Any] | None = None
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
    subskill: str | None = None
    difficulty: int = 1
    accepted_answer_spec: AcceptedAnswerSpec
    misconception_tags: dict[str, Any] | None = None
    solution_path: dict[str, Any] | None = None
    socratic_prompt_metadata: dict[str, Any] | None = None
    diagram_requirement_flag: bool = False
