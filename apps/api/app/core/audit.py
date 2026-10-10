import uuid
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import AuditEvent


class AuditLogger:
    @staticmethod
    async def log_event(
        session: AsyncSession,
        action: str,
        user_id: uuid.UUID | None = None,
        details: dict[str, Any] | None = None
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
