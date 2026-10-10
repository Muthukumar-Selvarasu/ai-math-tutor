from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient

from app.core.auth import require_roles

app = FastAPI()

@app.get("/student")
def student_route(user=Depends(require_roles(["student", "teacher", "admin"]))):
    return {"status": "ok"}

@app.get("/teacher")
def teacher_route(user=Depends(require_roles(["teacher", "admin"]))):
    return {"status": "ok"}

@app.get("/admin")
def admin_route(user=Depends(require_roles(["admin"]))):
    return {"status": "ok"}

client = TestClient(app)

def test_unauthenticated_request():
    response = client.get("/student")
    assert response.status_code == 401

def test_role_authorized():
    response = client.get("/student", headers={"X-User-Id": "123", "X-User-Role": "student"})
    assert response.status_code == 200

def test_role_forbidden():
    # Student trying to access teacher route
    response = client.get("/teacher", headers={"X-User-Id": "123", "X-User-Role": "student"})
    assert response.status_code == 403

def test_parent_role():
    # Parent role should have no access in MVP
    response = client.get("/student", headers={"X-User-Id": "123", "X-User-Role": "parent"})
    assert response.status_code == 403
