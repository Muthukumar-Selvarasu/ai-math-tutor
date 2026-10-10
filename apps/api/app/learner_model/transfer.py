import hashlib
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Question


async def get_transfer_question(
    db: AsyncSession,
    original_question_id: uuid.UUID,
    student_id: uuid.UUID
) -> Question | None:
    """
    Retrieves a near-transfer question using pgvector.
    Finds top-5 matching approved questions with similar skill,
    then deterministically selects one based on student_id.
    """
    # 1. Fetch the original question to get its embedding and skill
    orig_q = await db.execute(select(Question).where(Question.id == original_question_id))
    original_question = orig_q.scalar_one_or_none()
    
    if not original_question or original_question.embedding is None:
        return None
        
    # 2. Retrieve top-5 candidates with the same skill, not the same question, approved and published
    # ordered by pgvector similarity (L2 distance)
    candidates_result = await db.execute(
        select(Question)
        .where(
            Question.skill_id == original_question.skill_id,
            Question.id != original_question_id,
            Question.validation_status == "approved",
            Question.publication_status == "published",
            Question.embedding.is_not(None)
        )
        .order_by(Question.embedding.l2_distance(original_question.embedding))
        .limit(5)
    )
    candidates = candidates_result.scalars().all()
    
    if not candidates:
        return None
        
    # 3. Deterministic selection without LLM randomness
    # We hash the student_id and original_question_id to pick a stable index.
    hash_input = f"{student_id}-{original_question_id}".encode()
    stable_hash = int(hashlib.md5(hash_input).hexdigest(), 16)
    selected_index = stable_hash % len(candidates)
    
    return candidates[selected_index]
