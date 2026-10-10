import uuid

from fastapi import APIRouter, Depends, status

from app.core.auth import UserContext, get_current_user
from app.schemas.session import (
    SessionAttemptCreate,
    SessionCreate,
    SessionResponse,
    TurnResponse,
)

router = APIRouter()

# Dependency for DB session (Mocking since we don't have get_db in this snippet)
# from app.db.session import get_db

@router.post("/sessions", response_model=SessionResponse, status_code=status.HTTP_201_CREATED)
async def create_session(
    session_in: SessionCreate,
    user: UserContext = Depends(get_current_user),
    # db: AsyncSession = Depends(get_db)
):
    """
    Start a new tutoring session for a specific question.
    """

@router.get("/sessions/{session_id}", response_model=SessionResponse)
async def get_session(
    session_id: uuid.UUID,
    user: UserContext = Depends(get_current_user)
):
    """
    Get session state and history.
    """

@router.post("/sessions/{session_id}/turns", response_model=TurnResponse)
async def submit_turn(
    session_id: uuid.UUID,
    attempt: SessionAttemptCreate,
    user: UserContext = Depends(get_current_user)
):
    """
    Submit a student attempt and orchestrate the tutor's Socratic response.
    """

@router.get("/sessions/{session_id}/transfer_question")
async def get_session_transfer_question(
    session_id: uuid.UUID,
    user: UserContext = Depends(get_current_user)
):
    """
    Gets a near-transfer question for a completed session.
    """
    # In a real implementation this would use dependency injection for DB

@router.post("/sessions/{session_id}/transfer_outcome")
async def submit_transfer_outcome(
    session_id: uuid.UUID,
    outcome: dict, # e.g. {"status": "correct"}
    user: UserContext = Depends(get_current_user)
):
    """
    Submit outcome of transfer question to update learner model.
    """
