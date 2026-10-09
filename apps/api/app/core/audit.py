import uuid
from typing import Any, Dict, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.models import AuditEvent

class AuditLogger:
    @staticmethod
    async def log_event(
        session: AsyncSession,
        action: str,
        user_id: Optional[uuid.UUID] = None,
        details: Optional[Dict[str, Any]] = None
    ) -> AuditEvent:
        """
        Append-only audit trail logger.
        """
        event = AuditEvent(
            id=uuid.uuid4(),
            user_id=user_id,
            action=action,
            details=details or {}
        )
        session.add(event)
        # Flush to ensure it's in the transaction
        await session.flush()
        return event
