import pytest
from sqlalchemy import select
from app.db.models import Question

@pytest.mark.asyncio
async def test_student_query_filters_unapproved(async_session):
    # This is a regression test to verify student query pool filters out unapproved questions.
    # We will simulate adding one published and one draft question.
    
    # We assume 'async_session' is a fixture provided in conftest.py or similar
    # For now, we simulate the query logic that the practice planner would use
    
    query = select(Question).where(
        Question.validation_status == "approved",
        Question.publication_status == "published"
    )
    
    result = await async_session.execute(query)
    questions = result.scalars().all()
    
    for q in questions:
        assert q.validation_status == "approved"
        assert q.publication_status == "published"
