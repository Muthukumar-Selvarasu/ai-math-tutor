import pytest
import json
import os
from pydantic import ValidationError
from app.schemas.question import QuestionImportItem

def test_seed_questions_validation():
    seed_file = os.path.join(os.path.dirname(__file__), '..', '..', 'data', 'seed_questions.json')
    with open(seed_file, "r") as f:
        questions_data = json.load(f)
        
    assert len(questions_data) >= 40
    
    for q in questions_data:
        try:
            item = QuestionImportItem(**q)
            assert item.title is not None
            assert item.accepted_answer_spec is not None
        except ValidationError as e:
            pytest.fail(f"Validation failed for question {q.get('title')}: {e}")

def test_invalid_question_validation():
    invalid_q = {
        "title": "Invalid question",
        "content": "No answer spec",
        "skill_name": "Ratio"
    }
    with pytest.raises(ValidationError):
        QuestionImportItem(**invalid_q)
