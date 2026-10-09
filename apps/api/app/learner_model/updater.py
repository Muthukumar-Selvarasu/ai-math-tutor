import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime

from app.db.models import LearnerModel, User, Skill

async def update_learner_mastery(
    db: AsyncSession,
    user_id: uuid.UUID,
    skill_id: uuid.UUID,
    outcome: str
) -> LearnerModel:
    """
    Updates the learner model mastery score based on the outcome of a transfer question.
    outcome: 'correct', 'incorrect', 'skipped'
    """
    result = await db.execute(
        select(LearnerModel)
        .where(LearnerModel.user_id == user_id, LearnerModel.skill_id == skill_id)
    )
    learner_model = result.scalar_one_or_none()

    if not learner_model:
        learner_model = LearnerModel(
            user_id=user_id,
            skill_id=skill_id,
            mastery_score=0.5,
            confidence_score=0.1,
            attempts=0
        )
        db.add(learner_model)

    if outcome == 'skipped':
        # Skipped transfer does not raise confidence or mastery
        learner_model.last_updated = datetime.utcnow()
        await db.commit()
        await db.refresh(learner_model)
        return learner_model
        
    learner_model.attempts += 1
    
    # Simple Bayesian Knowledge Tracing style update
    # If correct, mastery increases and confidence increases.
    # If incorrect, mastery decreases slightly, confidence increases (since we have more evidence).
    
    alpha = 0.2  # learning rate
    
    if outcome == 'correct':
        learner_model.mastery_score = min(1.0, learner_model.mastery_score + alpha * (1.0 - learner_model.mastery_score))
    elif outcome == 'incorrect':
        learner_model.mastery_score = max(0.0, learner_model.mastery_score - alpha * learner_model.mastery_score)
        
    # Confidence increases asymptotically to 1.0 based on attempts
    learner_model.confidence_score = min(1.0, 1.0 - (1.0 / (learner_model.attempts + 1)))
    
    learner_model.last_updated = datetime.utcnow()
    
    await db.commit()
    await db.refresh(learner_model)
    return learner_model
