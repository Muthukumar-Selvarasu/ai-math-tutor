from fastapi import Depends, HTTPException, Request, status
from typing import Callable, List, Optional
import os

# For MVP, we will simulate a JWT token check based on Headers since we don't have Auth0 setup
# In real prod, this will use pyjwt to verify against AUTH_JWKS_URL

class UserContext:
    def __init__(self, user_id: str, role: str):
        self.user_id = user_id
        self.role = role

def get_current_user(request: Request) -> UserContext:
    # MVP simulation: Read 'X-User-Role' and 'X-User-Id' headers
    user_id = request.headers.get("X-User-Id")
    role = request.headers.get("X-User-Role")
    
    # If unauthenticated request
    if not user_id or not role:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required"
        )
        
    return UserContext(user_id=user_id, role=role)

def require_roles(allowed_roles: List[str]) -> Callable:
    def role_checker(user: UserContext = Depends(get_current_user)):
        if user.role not in allowed_roles:
            # Here we would normally log the access violation to the audit table
            # AuditLogger.log(user_id=user.user_id, action="access_denied", details={"required": allowed_roles})
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required roles: {allowed_roles}"
            )
        return user
    return role_checker
