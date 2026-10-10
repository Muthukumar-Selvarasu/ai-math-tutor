from app.agents.pipeline import create_tutoring_pipeline


def test_tutoring_pipeline():
    pipeline = create_tutoring_pipeline()
    state = {
        "student_response": "I think it is 8 oranges",
        "question_id": "123"
    }
    
    final_state = pipeline.run(state)
    
    # Verify the pipeline ran and output was processed
    assert final_state["problem_context_loaded"] is True
    assert final_state["verifier_result"] == "correct"
    assert final_state["hint_level_allowed"] == 1
    
    # Since verifier was 8 (correct), but safety guard doesn't allow answer leak (8) if hint < 5
    # candidate_response generated is blocked and replaced or handled.
    # We mocked safety blocked to replace candidate response
    assert "safety_blocked" in final_state
    assert final_state["candidate_response"] is not None
