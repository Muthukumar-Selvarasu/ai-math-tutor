import uuid
from datetime import datetime
from typing import Optional, List
from sqlalchemy import String, Integer, DateTime, ForeignKey, Text, Float, JSON, Boolean
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from pgvector.sqlalchemy import Vector

class Base(DeclarativeBase):
    pass

class User(Base):
    __tablename__ = "users"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    role: Mapped[str] = mapped_column(String(50), default="student")
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)

class Role(Base):
    __tablename__ = "roles"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(50), unique=True)

class Skill(Base):
    __tablename__ = "skills"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255))
    description: Mapped[Optional[str]] = mapped_column(Text)
    embedding: Mapped[Optional[List[float]]] = mapped_column(Vector(1536))

class Question(Base):
    __tablename__ = "questions"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    title: Mapped[str] = mapped_column(String(255))
    content: Mapped[str] = mapped_column(Text)
    skill_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("skills.id"))
    subskill: Mapped[Optional[str]] = mapped_column(String(255))
    difficulty: Mapped[int] = mapped_column(Integer, default=1)
    validation_status: Mapped[str] = mapped_column(String(50), default="draft")
    publication_status: Mapped[str] = mapped_column(String(50), default="draft")
    accepted_answer_spec: Mapped[Optional[dict]] = mapped_column(JSON)
    misconception_tags: Mapped[Optional[dict]] = mapped_column(JSON)
    solution_path: Mapped[Optional[dict]] = mapped_column(JSON)
    socratic_prompt_metadata: Mapped[Optional[dict]] = mapped_column(JSON)
    diagram_requirement_flag: Mapped[bool] = mapped_column(default=False)
    version_number: Mapped[int] = mapped_column(Integer, default=1)
    embedding: Mapped[Optional[List[float]]] = mapped_column(Vector(1536))

class LearnerModel(Base):
    __tablename__ = "learner_models"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    skill_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("skills.id"))
    mastery_score: Mapped[float] = mapped_column(Float, default=0.5)
    confidence_score: Mapped[float] = mapped_column(Float, default=0.1)
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    last_updated: Mapped[datetime] = mapped_column(default=datetime.utcnow)

class Session(Base):
    __tablename__ = "sessions"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    question_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("questions.id"))
    status: Mapped[str] = mapped_column(String(50), default="active")
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)

class Turn(Base):
    __tablename__ = "turns"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    session_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("sessions.id"))
    role: Mapped[str] = mapped_column(String(50))  # user, assistant, system
    content: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)

class AuditEvent(Base):
    __tablename__ = "audit_events"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("users.id"))
    action: Mapped[str] = mapped_column(String(255))
    details: Mapped[Optional[dict]] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)
