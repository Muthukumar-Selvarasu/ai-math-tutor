import asyncio
import json
import os
import sys
import uuid

from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

# Add app to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.db.models import Question, Skill
from app.schemas.question import QuestionImportItem


async def main():
    database_url = os.getenv("DATABASE_URL", "postgresql+asyncpg://postgres:postgres@localhost:5432/ai_math_tutor")
    engine = create_async_engine(database_url)
    async_session = async_sessionmaker(engine, expire_on_commit=False)

    seed_file = os.path.join(os.path.dirname(__file__), '..', 'data', 'seed_questions.json')
    if not os.path.exists(seed_file):
        print(f"Seed file not found: {seed_file}")
        sys.exit(1)

    with open(seed_file, "r") as f:
        try:
            questions_data = json.load(f)
        except json.JSONDecodeError as e:
            print(f"Failed to parse seed file: {e!s}")
            sys.exit(1)

    async with async_session() as session:
        for idx, q_data in enumerate(questions_data):
            try:
                item = QuestionImportItem(**q_data)
            except ValidationError as e:
                print(f"Validation failed for question index {idx}: {e}")
                sys.exit(1)

            # Find or create skill
            result = await session.execute(select(Skill).where(Skill.name == item.skill_name))
            skill = result.scalars().first()
            if not skill:
                skill = Skill(id=uuid.uuid4(), name=item.skill_name, description="Auto-created during import")
                session.add(skill)
                await session.flush()

            # Insert question
            question = Question(
                id=uuid.uuid4(),
                title=item.title,
                content=item.content,
                skill_id=skill.id,
                subskill=item.subskill,
                difficulty=item.difficulty,
                validation_status="approved",  # Seed questions are pre-approved
                publication_status="published",
                accepted_answer_spec=item.accepted_answer_spec.model_dump(),
                misconception_tags=item.misconception_tags,
                solution_path=item.solution_path,
                socratic_prompt_metadata=item.socratic_prompt_metadata,
                diagram_requirement_flag=item.diagram_requirement_flag,
            )
            session.add(question)
        
        await session.commit()
        print(f"Successfully imported {len(questions_data)} questions.")

if __name__ == "__main__":
    asyncio.run(main())
