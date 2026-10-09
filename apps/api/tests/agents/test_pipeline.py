import pytest
from app.agents.pipeline import create_pipeline

def test_pipeline_execution():
    pipeline = create_pipeline()
    
    initial_state = {
        "question_data": {
            "steps": ["step1", "step2"]
        },
        "student_ans": "3/4",
        "expected_ans": "0.75"
    }
    
    final_state = pipeline.run(initial_state)
    
    # ProblemContextAgent tests
    assert "question_spec" in final_state
    assert final_state["steps"] == ["step1", "step2"]
    
    # MathVerifierAgent tests
    assert "verifier_result" in final_state
    assert final_state["verifier_result"]["is_correct"] is True
    
    # StudentStateAgent tests
    assert "student_state" in final_state
    assert "understanding_level" in final_state["student_state"]
    assert "barriers" in final_state["student_state"]
    
    # No error
    assert "error" not in final_state

def test_pipeline_missing_data():
    pipeline = create_pipeline()
    
    final_state = pipeline.run({})
    
    assert final_state["verifier_result"]["is_correct"] is False
    assert final_state["verifier_result"]["reason"] == "missing_data"
