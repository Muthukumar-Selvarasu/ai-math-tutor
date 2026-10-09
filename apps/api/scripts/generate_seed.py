import json
import os

questions = []
for i in range(1, 41):
    questions.append({
        "title": f"Ratio Practice {i}",
        "content": f"If the ratio of apples to oranges is {i}:{i+1} and there are {i*2} apples, how many oranges are there?",
        "skill_name": "Ratio and proportional reasoning",
        "subskill": "Equivalent ratios",
        "difficulty": 1,
        "accepted_answer_spec": {
            "value": str((i+1)*2),
            "format": "integer"
        },
        "misconception_tags": {
            "additive_interpretation": f"Student might add 2 instead of multiplying by 2 (e.g. {i+1+2})."
        },
        "solution_path": {
            "steps": ["Find the multiplier for apples", "Apply the multiplier to oranges"]
        },
        "socratic_prompt_metadata": {
            "level_1": "What is the relationship between the ratio of apples and the actual number of apples?"
        },
        "diagram_requirement_flag": False
    })

seed_file = os.path.join(os.path.dirname(__file__), '..', 'data', 'seed_questions.json')
with open(seed_file, "w") as f:
    json.dump(questions, f, indent=2)
print(f"Generated {len(questions)} seed questions.")
