import pytest
import uuid
from app.core.audit import AuditLogger
from app.db.models import AuditEvent
from sqlalchemy import select

@pytest.mark.asyncio
async def test_audit_log_event(async_session):
    user_id = uuid.uuid4()
    await AuditLogger.log_event(
        session=async_session,
        action="test_action",
        user_id=user_id,
        details={"key": "value"}
    )
    
    result = await async_session.execute(select(AuditEvent))
    events = result.scalars().all()
    
    assert len(events) == 1
    assert events[0].action == "test_action"
    assert events[0].user_id == user_id
    assert events[0].details == {"key": "value"}
