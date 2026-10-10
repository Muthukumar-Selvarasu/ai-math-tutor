from fastapi import FastAPI

from app.routers import session

app = FastAPI(title="SolvePath API")

app.include_router(session.router, prefix="/api", tags=["sessions"])

@app.get("/health")
async def health_check():
    return {"status": "ok"}
