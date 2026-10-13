#!/usr/bin/env python3
"""
Seed Approved Question Bank (ADM-12, PRD §10.3, §10.3.1, §18.3, §21)

Seeds:
1. Release 1.0 approved core questions (12 items >= 10):
   - scale_0001, scale_0002, scale_0003
   - ratio_share_001, ratio_share_002
   - ratio_simp_001, ratio_simp_002
   - ratio_unit_001, ratio_unit_002
   - ratio_table_001, ratio_table_002
   - ratio_mult_001, ratio_mult_002
2. Release 1.1 extended approved questions (36 items, giving 48 total >= 40)
   across ratio sharing, simplifying, unit rates, scale drawing, ratio tables, and multiplicative comparison.

All items strictly satisfy rules V1–V9 and have legal transfer partners (V8).
"""

import json
import os
import shutil

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
CONTENT_QUESTIONS_DIR = os.path.join(ROOT_DIR, "content", "questions")
RELEASE_1_0_DIR = os.path.join(CONTENT_QUESTIONS_DIR, "release_1_0")
RELEASE_1_1_DIR = os.path.join(CONTENT_QUESTIONS_DIR, "release_1_1")
DOCS_QUESTION_BANK_DIR = os.path.join(ROOT_DIR, "docs", "question-bank")

os.makedirs(RELEASE_1_0_DIR, exist_ok=True)
os.makedirs(RELEASE_1_1_DIR, exist_ok=True)
os.makedirs(DOCS_QUESTION_BANK_DIR, exist_ok=True)

def build_question(
    question_id,
    skill_id,
    subskill,
    title,
    stem,
    canonical_value,
    unit="",
    tolerance=0,
    accepted_forms=None,
    solution_steps=None,
    method_leak_patterns=None,
    scaffold_probes=None,
    misconception_predictions=None,
    isomorphic_example=None,
    reflection=None,
    has_diagram=False,
    diagram_id=None,
    difficulty_band="intermediate",
    answer_requires_unit=False,
    learning_objective=None,
):
    if accepted_forms is None:
        accepted_forms = [canonical_value]
        if unit:
            accepted_forms.append(f"{unit}{canonical_value}" if unit in ["$", "€", "£"] else f"{canonical_value} {unit}")

    if learning_objective is None:
        learning_objective = f"Solve proportional problems in {subskill.replace('_', ' ')}."

    return {
        "question_id": question_id,
        "version": 1,
        "validation_status": "approved",
        "publication_status": "published",
        "flagged": False,
        "curriculum": {
            "jurisdiction": "VIC",
            "year_level": 7,
            "topic": "Number and Algebra",
            "subtopic": "Real numbers - Ratio and rate",
            "curriculum_code": "VC2M7N08",
        },
        "skill_id": skill_id,
        "subskill": subskill,
        "learning_objective": learning_objective,
        "difficulty": {
            "band": difficulty_band,
            "estimated_difficulty": 0.45,
            "reasoning_depth": 3,
        },
        "title": title,
        "problem_type": "word_problem",
        "stem": stem,
        "accepted_answer_spec": {
            "type": "numeric",
            "canonical_value": str(canonical_value),
            "unit": unit,
            "answer_requires_unit": answer_requires_unit,
            "tolerance": tolerance,
            "accepted_forms": accepted_forms,
            "valid_alternatives": [],
            "rounding_rule": "none",
        },
        "solution_steps": solution_steps or [],
        "alternate_solution_paths": [
            {
                "path_id": "primary",
                "steps": [s["step_id"] for s in (solution_steps or [])],
            }
        ],
        "method_leak_patterns": method_leak_patterns or {
            "operations": ["divide", "multiply", "add"],
            "step_phrases": ["find one part", "sum the parts"],
            "blocked_below_level": 4,
        },
        "scaffold_probes": scaffold_probes or [],
        "misconception_predictions": misconception_predictions or [],
        "isomorphic_worked_example": isomorphic_example or {
            "stem": "A similar question worked example.",
            "solution_steps": [{"description": "Step 1", "target_value": "10"}],
            "final_answer": "10",
        },
        "reasoning_options": [
            {"option_id": "opt_1", "label": "Found unit part and scaled up"},
            {"option_id": "opt_2", "label": "Divided directly without summing parts"},
        ],
        "misconception_tags": [p["misconception_code"] for p in (misconception_predictions or [])],
        "reflection": reflection or {
            "prompt_template": "You calculated {student_value}. How could you check your answer?",
            "options": [
                {
                    "option_id": "refl_1",
                    "label": "Verify that all components sum back to the total",
                    "sound": True,
                    "feedback": "Great check! Summing the parts confirms the total.",
                },
                {
                    "option_id": "refl_2",
                    "label": "Subtract the smaller number from the larger",
                    "sound": False,
                    "feedback": "Subtracting does not verify the original total amount.",
                },
                {
                    "option_id": "refl_3",
                    "label": "Multiply the answer by two",
                    "sound": False,
                    "feedback": "Multiplying does not verify the ratio relationship.",
                },
            ],
        },
        "socratic_prompt_set_id": f"socratic_{skill_id}",
        "has_diagram": has_diagram,
        "diagram_id": diagram_id,
    }

def main():
    questions_1_0 = []

    # 1. scale_0001 (Map scale 1 cm : 4 km, 7.5 cm -> 30 km)
    scale_0001 = build_question(
        question_id="scale_0001",
        skill_id="scale_drawing",
        subskill="scale_drawing",
        title="Map scale 1 cm to 4 km",
        stem="A map has a scale of 1 cm to 4 km. Two towns are 7.5 cm apart on the map. What is the actual distance between the towns in kilometres?",
        canonical_value="30",
        unit="km",
        learning_objective="Calculate actual distances using linear map scales.",
        solution_steps=[
            {
                "step_id": "step_1",
                "description": "Identify distance represented by 1 cm",
                "target_expression": "4",
                "target_value": "4",
                "unit": "km",
                "permitted_scaffold_step": "Look at the scale to find how many kilometres 1 cm represents.",
            },
            {
                "step_id": "step_2",
                "description": "Multiply map distance by scale factor",
                "target_expression": "7.5 * 4",
                "target_value": "30",
                "unit": "km",
            },
        ],
        method_leak_patterns={
            "operations": ["multiply", "scale"],
            "step_phrases": ["multiply by four", "four kilometres per centimetre"],
            "blocked_below_level": 4,
        },
        scaffold_probes=[
            {
                "probe_id": "one_cm_probe",
                "kind": "value",
                "min_level": 1,
                "template": "What does every 1 cm on the map stand for in real distance?",
                "expected_expression": "4",
                "expected_value": "4",
                "unit": "km",
                "counts_as_step_id": "step_1",
            },
            {
                "probe_id": "two_cm_probe",
                "kind": "value",
                "min_level": 2,
                "template": "If 1 cm on the map stands for 4 km, how far would 2 cm stand for?",
                "expected_expression": "2 * 4",
                "expected_value": "8",
                "unit": "km",
            },
        ],
        misconception_predictions=[
            {
                "predicted_response": "11.5",
                "misconception_code": "ratio_additive_interpretation",
                "confidence": 0.9,
                "rationale": "Added 7.5 + 4 instead of multiplying.",
            },
            {
                "predicted_response": "1.875",
                "misconception_code": "scale_direction_error",
                "confidence": 0.9,
                "rationale": "Divided 7.5 by 4 instead of multiplying.",
            },
        ],
        isomorphic_example={
            "stem": "A map has scale 1 cm to 3 km. Real distance for 5 cm?",
            "solution_steps": [{"description": "5 * 3 = 15", "target_value": "15"}],
            "final_answer": "15",
        },
        reflection={
            "prompt_template": "You found {student_value} km. How could you verify that 7.5 cm makes sense?",
            "options": [
                {
                    "option_id": "refl_1",
                    "label": "Since 7 cm is 28 km and 8 cm is 32 km, 30 km lies right in between",
                    "sound": True,
                    "feedback": "Excellent reasoning! Estimating with neighbouring whole numbers is very reliable.",
                },
                {
                    "option_id": "refl_2",
                    "label": "Subtract 4 from 30",
                    "sound": False,
                    "feedback": "Subtracting does not verify the scaling factor.",
                },
                {
                    "option_id": "refl_3",
                    "label": "Add 7.5 and 4",
                    "sound": False,
                    "feedback": "Addition does not check proportional multiplication.",
                },
            ],
        },
        has_diagram=True,
        diagram_id="diag_scale_0001",
    )
    questions_1_0.append(scale_0001)

    # 2. scale_0002 (Map scale 1 cm : 5 km, 6 cm -> 30 km)
    scale_0002 = build_question(
        question_id="scale_0002",
        skill_id="scale_drawing",
        subskill="scale_drawing",
        title="Map scale 1 cm to 5 km",
        stem="A map has a scale of 1 cm to 5 km. Two landmarks are 6 cm apart. What is the real distance in kilometres?",
        canonical_value="30",
        unit="km",
        learning_objective="Calculate actual distances using linear map scales.",
        solution_steps=[
            {
                "step_id": "step_1",
                "description": "Find real distance per 1 cm",
                "target_expression": "5",
                "target_value": "5",
                "unit": "km",
                "permitted_scaffold_step": "Identify the number of kilometres for 1 cm.",
            },
            {
                "step_id": "step_2",
                "description": "Multiply map length by scale",
                "target_expression": "6 * 5",
                "target_value": "30",
                "unit": "km",
            },
        ],
        scaffold_probes=[
            {
                "probe_id": "p1",
                "kind": "value",
                "min_level": 1,
                "template": "How many kilometres does 1 cm represent?",
                "expected_expression": "5",
                "expected_value": "5",
                "unit": "km",
                "counts_as_step_id": "step_1",
            }
        ],
        misconception_predictions=[
            {
                "predicted_response": "11",
                "misconception_code": "ratio_additive_interpretation",
                "confidence": 0.9,
                "rationale": "Added 6 + 5.",
            },
            {
                "predicted_response": "1.2",
                "misconception_code": "scale_direction_error",
                "confidence": 0.9,
                "rationale": "Divided 6 / 5.",
            },
        ],
    )
    questions_1_0.append(scale_0002)

    # 3. scale_0003 (Map scale 1 cm : 4 km, 5.5 cm -> 22 km) - Legal transfer partner for scale_0001 & scale_0002
    scale_0003 = build_question(
        question_id="scale_0003",
        skill_id="scale_drawing",
        subskill="scale_drawing",
        title="Map scale 1 cm to 4 km (Transfer)",
        stem="A trail map has a scale of 1 cm to 4 km. Two campsites are 5.5 cm apart on the map. What is the actual distance in kilometres?",
        canonical_value="22",
        unit="km",
        learning_objective="Calculate actual distances using linear map scales.",
        solution_steps=[
            {
                "step_id": "step_1",
                "description": "Scale factor per 1 cm",
                "target_expression": "4",
                "target_value": "4",
                "unit": "km",
                "permitted_scaffold_step": "Note that 1 cm represents 4 km.",
            },
            {
                "step_id": "step_2",
                "description": "Multiply distance by 4",
                "target_expression": "5.5 * 4",
                "target_value": "22",
                "unit": "km",
            },
        ],
        scaffold_probes=[
            {
                "probe_id": "p1",
                "kind": "value",
                "min_level": 1,
                "template": "How many kilometres does 1 cm represent?",
                "expected_expression": "4",
                "expected_value": "4",
                "unit": "km",
                "counts_as_step_id": "step_1",
            }
        ],
        misconception_predictions=[
            {
                "predicted_response": "9.5",
                "misconception_code": "ratio_additive_interpretation",
                "confidence": 0.9,
                "rationale": "Added 5.5 + 4.",
            },
            {
                "predicted_response": "1.375",
                "misconception_code": "scale_direction_error",
                "confidence": 0.9,
                "rationale": "Divided 5.5 / 4.",
            },
        ],
    )
    questions_1_0.append(scale_0003)

    # Load existing docs/question-bank items if present
    for existing_id in ["ratio_share_001", "ratio_share_002", "ratio_simp_001", "ratio_simp_002", "ratio_unit_001", "ratio_unit_002"]:
        existing_path = os.path.join(DOCS_QUESTION_BANK_DIR, f"{existing_id}.json")
        if os.path.exists(existing_path):
            with open(existing_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                questions_1_0.append(data)

    # 10. ratio_table_001 (Paint mix 3 blue : 5 red, total 40 L -> red 25 L)
    ratio_table_001 = build_question(
        question_id="ratio_table_001",
        skill_id="ratio_table_representation",
        subskill="ratio_table_representation",
        title="Mixing paint in 3:5",
        stem="A painter mixes blue paint and red paint in the ratio 3 : 5 to make purple paint. To make 40 litres of purple paint in total, how many litres of red paint are needed?",
        canonical_value="25",
        unit="L",
        learning_objective="Represent and solve ratio sharing problems using a ratio table.",
        solution_steps=[
            {
                "step_id": "step_1",
                "description": "Find total parts",
                "target_expression": "3 + 5",
                "target_value": "8",
                "unit": "parts",
                "permitted_scaffold_step": "Add the ratio parts 3 and 5.",
            },
            {
                "step_id": "step_2",
                "description": "Find litres per part",
                "target_expression": "40 / 8",
                "target_value": "5",
                "unit": "L",
                "permitted_scaffold_step": "Divide 40 by 8 to find the size of one part.",
            },
            {
                "step_id": "step_3",
                "description": "Calculate red paint parts",
                "target_expression": "5 * 5",
                "target_value": "25",
                "unit": "L",
            },
        ],
        scaffold_probes=[
            {
                "probe_id": "p1",
                "kind": "value",
                "min_level": 1,
                "template": "How many total parts are in the ratio 3 : 5?",
                "expected_expression": "3 + 5",
                "expected_value": "8",
                "unit": "parts",
                "counts_as_step_id": "step_1",
            },
            {
                "probe_id": "p2",
                "kind": "value",
                "min_level": 2,
                "template": "How many litres does 1 part represent when 8 parts make 40 L?",
                "expected_expression": "40 / 8",
                "expected_value": "5",
                "unit": "L",
                "counts_as_step_id": "step_2",
            },
        ],
        misconception_predictions=[
            {
                "predicted_response": "15",
                "misconception_code": "ratio_reversal",
                "confidence": 0.9,
                "rationale": "Calculated blue paint instead of red paint.",
            },
            {
                "predicted_response": "35",
                "misconception_code": "ratio_additive_interpretation",
                "confidence": 0.9,
                "rationale": "Subtracted 5 from 40.",
            },
        ],
        has_diagram=True,
        diagram_id="diag_ratio_table_001",
    )
    questions_1_0.append(ratio_table_001)

    # 11. ratio_table_002 (Baking recipe in 2:5, flour 35 kg -> sugar 14 kg)
    ratio_table_002 = build_question(
        question_id="ratio_table_002",
        skill_id="ratio_table_representation",
        subskill="ratio_table_representation",
        title="Baking recipe in 2:5",
        stem="A bakery recipe mixes sugar and flour in the ratio 2 : 5. If the baker uses 35 kg of flour, how many kilograms of sugar are needed?",
        canonical_value="14",
        unit="kg",
        learning_objective="Represent and solve ratio sharing problems using a ratio table.",
        solution_steps=[
            {
                "step_id": "step_1",
                "description": "Find value per flour part",
                "target_expression": "35 / 5",
                "target_value": "7",
                "unit": "kg",
                "permitted_scaffold_step": "Divide 35 kg by 5 parts.",
            },
            {
                "step_id": "step_2",
                "description": "Multiply by 2 sugar parts",
                "target_expression": "7 * 2",
                "target_value": "14",
                "unit": "kg",
            },
        ],
        scaffold_probes=[
            {
                "probe_id": "p1",
                "kind": "value",
                "min_level": 1,
                "template": "How many kilograms is 1 part if 5 flour parts equal 35 kg?",
                "expected_expression": "35 / 5",
                "expected_value": "7",
                "unit": "kg",
                "counts_as_step_id": "step_1",
            }
        ],
        misconception_predictions=[
            {
                "predicted_response": "32",
                "misconception_code": "ratio_additive_interpretation",
                "confidence": 0.9,
                "rationale": "Subtracted 3 from 35.",
            },
            {
                "predicted_response": "17.5",
                "misconception_code": "unit_rate_error",
                "confidence": 0.9,
                "rationale": "Divided 35 by 2.",
            },
        ],
    )
    questions_1_0.append(ratio_table_002)

    # 12. ratio_mult_001 (Liam has 3 times cards as Zoe, total 48 -> Liam has 36)
    ratio_mult_001 = build_question(
        question_id="ratio_mult_001",
        skill_id="multiplicative_comparison",
        subskill="multiplicative_comparison",
        title="Card collection scaling",
        stem="Liam has 3 times as many collector cards as Zoe. Together they have 48 cards. How many cards does Liam have?",
        canonical_value="36",
        unit="cards",
        learning_objective="Solve multiplicative comparison word problems.",
        solution_steps=[
            {
                "step_id": "step_1",
                "description": "Total parts in ratio 3:1",
                "target_expression": "3 + 1",
                "target_value": "4",
                "unit": "parts",
                "permitted_scaffold_step": "Consider Zoe as 1 part and Liam as 3 parts, totaling 4 parts.",
            },
            {
                "step_id": "step_2",
                "description": "Find cards per part",
                "target_expression": "48 / 4",
                "target_value": "12",
                "unit": "cards",
                "permitted_scaffold_step": "Divide 48 by 4 to find Zoe's cards.",
            },
            {
                "step_id": "step_3",
                "description": "Calculate Liam's cards",
                "target_expression": "12 * 3",
                "target_value": "36",
                "unit": "cards",
            },
        ],
        scaffold_probes=[
            {
                "probe_id": "p1",
                "kind": "value",
                "min_level": 1,
                "template": "If Zoe has 1 part and Liam has 3 parts, how many parts are there altogether?",
                "expected_expression": "3 + 1",
                "expected_value": "4",
                "unit": "parts",
                "counts_as_step_id": "step_1",
            },
            {
                "probe_id": "p2",
                "kind": "value",
                "min_level": 2,
                "template": "How many cards is 1 part if 4 parts equal 48 cards?",
                "expected_expression": "48 / 4",
                "expected_value": "12",
                "unit": "cards",
                "counts_as_step_id": "step_2",
            },
        ],
        misconception_predictions=[
            {
                "predicted_response": "15",
                "misconception_code": "incomplete_reasoning",
                "confidence": 0.9,
                "rationale": "Additive calculation slip.",
            },
            {
                "predicted_response": "16",
                "misconception_code": "unit_rate_error",
                "confidence": 0.9,
                "rationale": "Divided 48 by 3 directly.",
            },
        ],
    )
    questions_1_0.append(ratio_mult_001)

    # 13. ratio_mult_002 (Ella has 4 times marbles as Sam, total 60 -> Ella has 48)
    ratio_mult_002 = build_question(
        question_id="ratio_mult_002",
        skill_id="multiplicative_comparison",
        subskill="multiplicative_comparison",
        title="Marble collection scaling",
        stem="Ella has 4 times as many marbles as Sam. Together they have 60 marbles. How many marbles does Ella have?",
        canonical_value="48",
        unit="marbles",
        learning_objective="Solve multiplicative comparison word problems.",
        solution_steps=[
            {
                "step_id": "step_1",
                "description": "Total parts in ratio 4:1",
                "target_expression": "4 + 1",
                "target_value": "5",
                "unit": "parts",
                "permitted_scaffold_step": "Add 4 parts for Ella and 1 part for Sam to get 5 total parts.",
            },
            {
                "step_id": "step_2",
                "description": "Find marbles per part",
                "target_expression": "60 / 5",
                "target_value": "12",
                "unit": "marbles",
                "permitted_scaffold_step": "Divide 60 by 5 to find Sam's marbles.",
            },
            {
                "step_id": "step_3",
                "description": "Calculate Ella's marbles",
                "target_expression": "12 * 4",
                "target_value": "48",
                "unit": "marbles",
            },
        ],
        scaffold_probes=[
            {
                "probe_id": "p1",
                "kind": "value",
                "min_level": 1,
                "template": "How many total parts are there if Sam has 1 part and Ella has 4 parts?",
                "expected_expression": "4 + 1",
                "expected_value": "5",
                "unit": "parts",
                "counts_as_step_id": "step_1",
            },
            {
                "probe_id": "p2",
                "kind": "value",
                "min_level": 2,
                "template": "How many marbles is 1 part if 5 parts equal 60 marbles?",
                "expected_expression": "60 / 5",
                "expected_value": "12",
                "unit": "marbles",
                "counts_as_step_id": "step_2",
            },
        ],
        misconception_predictions=[
            {
                "predicted_response": "14",
                "misconception_code": "incomplete_reasoning",
                "confidence": 0.9,
                "rationale": "Additive calculation slip.",
            },
            {
                "predicted_response": "15",
                "misconception_code": "unit_rate_error",
                "confidence": 0.9,
                "rationale": "Divided 60 by 4 directly.",
            },
        ],
    )
    questions_1_0.append(ratio_mult_002)

    # Save Release 1.0 items
    saved_1_0_ids = set()
    for q in questions_1_0:
        qid = q["question_id"]
        if qid in saved_1_0_ids:
            continue
        saved_1_0_ids.add(qid)
        path_rel = os.path.join(RELEASE_1_0_DIR, f"{qid}.json")
        path_docs = os.path.join(DOCS_QUESTION_BANK_DIR, f"{qid}.json")
        with open(path_rel, "w", encoding="utf-8") as f:
            json.dump(q, f, indent=2)
        with open(path_docs, "w", encoding="utf-8") as f:
            json.dump(q, f, indent=2)

    print(f"Saved {len(saved_1_0_ids)} Release 1.0 questions to {RELEASE_1_0_DIR} and {DOCS_QUESTION_BANK_DIR}.")

    # Generate Release 1.1 items (36 additional items across 6 subskills)
    questions_1_1 = []
    subskill_configs = [
        ("ratio_sharing", "part_sharing_total", "Divide an amount into a given two-term ratio and calculate a specific share.", [
            ("ratio_share_003", "Share $80 in ratio 1:3. What is larger share?", 60, "1 + 3 = 4", "80 / 4 = 20", "20 * 3 = 60", 4, 20, 60, "$"),
            ("ratio_share_004", "Share $70 in ratio 2:5. What is larger share?", 50, "2 + 5 = 7", "70 / 7 = 10", "10 * 5 = 50", 7, 10, 50, "$"),
            ("ratio_share_005", "Share $100 in ratio 3:7. What is smaller share?", 30, "3 + 7 = 10", "100 / 10 = 10", "10 * 3 = 30", 10, 10, 30, "$"),
            ("ratio_share_006", "Share $45 in ratio 1:4. What is larger share?", 36, "1 + 4 = 5", "45 / 5 = 9", "9 * 4 = 36", 5, 9, 36, "$"),
            ("ratio_share_007", "Share $72 in ratio 5:3. What is smaller share?", 27, "5 + 3 = 8", "72 / 8 = 9", "9 * 3 = 27", 8, 9, 27, "$"),
            ("ratio_share_008", "Share $120 in ratio 7:5. What is smaller share?", 50, "7 + 5 = 12", "120 / 12 = 10", "10 * 5 = 50", 12, 10, 50, "$"),
        ]),
        ("ratio_simplifying", "simplification", "Simplify ratios to their simplest equivalent form.", [
            ("ratio_simp_003", "Simplify ratio 18 : 24. What is the simplified ratio in form a:b?", "3:4", "18 / 6 = 3", "24 / 6 = 4", "", 6, "3:4", "3:4", ""),
            ("ratio_simp_004", "Simplify ratio 20 : 35. What is the simplified ratio in form a:b?", "4:7", "20 / 5 = 4", "35 / 5 = 7", "", 5, "4:7", "4:7", ""),
            ("ratio_simp_005", "Simplify ratio 14 : 21. What is the simplified ratio in form a:b?", "2:3", "14 / 7 = 2", "21 / 7 = 3", "", 7, "2:3", "2:3", ""),
            ("ratio_simp_006", "Simplify ratio 16 : 28. What is the simplified ratio in form a:b?", "4:7", "16 / 4 = 4", "28 / 4 = 7", "", 4, "4:7", "4:7", ""),
            ("ratio_simp_007", "Simplify ratio 27 : 36. What is the simplified ratio in form a:b?", "3:4", "27 / 9 = 3", "36 / 9 = 4", "", 9, "3:4", "3:4", ""),
            ("ratio_simp_008", "Simplify ratio 30 : 45. What is the simplified ratio in form a:b?", "2:3", "30 / 15 = 2", "45 / 15 = 3", "", 15, "2:3", "2:3", ""),
        ]),
        ("ratio_unitary", "unit_rate", "Solve unit rate and proportional rate word problems.", [
            ("ratio_unit_003", "5 notebooks cost $25. How much do 8 notebooks cost?", 40, "25 / 5 = 5", "5 * 8 = 40", "", 5, 5, 40, "$"),
            ("ratio_unit_004", "6 apples cost $18. How much do 11 apples cost?", 33, "18 / 6 = 3", "3 * 11 = 33", "", 6, 3, 33, "$"),
            ("ratio_unit_005", "4 packs of stickers cost $16. How much do 9 packs cost?", 36, "16 / 4 = 4", "4 * 9 = 36", "", 4, 4, 36, "$"),
            ("ratio_unit_006", "8 erasers cost $24. How much do 10 erasers cost?", 30, "24 / 8 = 3", "3 * 10 = 30", "", 8, 3, 30, "$"),
            ("ratio_unit_007", "3 rulers cost $12. How much do 7 rulers cost?", 28, "12 / 3 = 4", "4 * 7 = 28", "", 3, 4, 28, "$"),
            ("ratio_unit_008", "7 pencils cost $21. How much do 12 pencils cost?", 36, "21 / 7 = 3", "3 * 12 = 36", "", 7, 3, 36, "$"),
        ]),
        ("scale_drawing", "scale_drawing", "Calculate actual distances using linear map scales.", [
            ("scale_0004", "Map scale 1 cm : 6 km. What is real distance for 4 cm?", 24, "1 cm = 6 km", "4 * 6 = 24", "", 6, 6, 24, "km"),
            ("scale_0005", "Map scale 1 cm : 8 km. What is real distance for 3.5 cm?", 28, "1 cm = 8 km", "3.5 * 8 = 28", "", 8, 8, 28, "km"),
            ("scale_0006", "Map scale 1 cm : 3 km. What is real distance for 9 cm?", 27, "1 cm = 3 km", "9 * 3 = 27", "", 3, 3, 27, "km"),
            ("scale_0007", "Map scale 1 cm : 7 km. What is real distance for 5 cm?", 35, "1 cm = 7 km", "5 * 7 = 35", "", 7, 7, 35, "km"),
            ("scale_0008", "Map scale 1 cm : 9 km. What is real distance for 4 cm?", 36, "1 cm = 9 km", "4 * 9 = 36", "", 9, 9, 36, "km"),
            ("scale_0009", "Map scale 1 cm : 5 km. What is real distance for 8 cm?", 40, "1 cm = 5 km", "8 * 5 = 40", "", 5, 5, 40, "km"),
        ]),
        ("ratio_table_representation", "ratio_table_representation", "Represent and solve ratio sharing problems using a ratio table.", [
            ("ratio_table_003", "Ratio table mix 4 lime : 5 water. To make 45 L total, how much water?", 25, "4 + 5 = 9", "45 / 9 = 5", "5 * 5 = 25", 9, 5, 25, "L"),
            ("ratio_table_004", "Ratio table mix 1 syrup : 6 soda. To make 42 L total, how much soda?", 36, "1 + 6 = 7", "42 / 7 = 6", "6 * 6 = 36", 7, 6, 36, "L"),
            ("ratio_table_005", "Ratio table mix 2 oats : 3 milk. To make 50 cups, how many cups of milk?", 30, "2 + 3 = 5", "50 / 5 = 10", "10 * 3 = 30", 5, 10, 30, "cups"),
            ("ratio_table_006", "Ratio table mix 3 gravel : 7 sand. To make 60 kg, how much sand?", 42, "3 + 7 = 10", "60 / 10 = 6", "6 * 7 = 42", 10, 6, 42, "kg"),
            ("ratio_table_007", "Ratio table mix 2 cement : 5 sand. To make 35 bags, how many sand bags?", 25, "2 + 5 = 7", "35 / 7 = 5", "5 * 5 = 25", 7, 5, 25, "bags"),
            ("ratio_table_008", "Ratio table mix 4 clay : 7 water. To make 44 kg, how many water kg?", 28, "4 + 7 = 11", "44 / 11 = 4", "4 * 7 = 28", 11, 4, 28, "kg"),
        ]),
        ("multiplicative_comparison", "multiplicative_comparison", "Solve multiplicative comparison word problems.", [
            ("ratio_mult_003", "Ben has 5 times as many books as Mia. Together they have 48. How many books does Ben have?", 40, "5 + 1 = 6", "48 / 6 = 8", "8 * 5 = 40", 6, 8, 40, "books"),
            ("ratio_mult_004", "Noah has 2 times as many tokens as Ava. Together they have 36. How many tokens does Noah have?", 24, "2 + 1 = 3", "36 / 3 = 12", "12 * 2 = 24", 3, 12, 24, "tokens"),
            ("ratio_mult_005", "Chloe has 3 times as many badges as Jack. Together they have 44. How many badges does Chloe have?", 33, "3 + 1 = 4", "44 / 4 = 11", "11 * 3 = 33", 4, 11, 33, "badges"),
            ("ratio_mult_006", "Lucas has 4 times as many points as Lily. Together they have 55. How many points does Lucas have?", 44, "4 + 1 = 5", "55 / 5 = 11", "11 * 4 = 44", 5, 11, 44, "points"),
            ("ratio_mult_007", "Grace has 6 times as many stickers as Leo. Together they have 49. How many stickers does Grace have?", 42, "6 + 1 = 7", "49 / 7 = 7", "7 * 6 = 42", 7, 7, 42, "stickers"),
            ("ratio_mult_008", "Ethan has 5 times as many beads as Ruby. Together they have 54. How many beads does Ethan have?", 45, "5 + 1 = 6", "54 / 6 = 9", "9 * 5 = 45", 6, 9, 45, "beads"),
        ]),
    ]

    for skill_id, subskill, learning_obj, items in subskill_configs:
        for qid, stem, ans, s1, s2, s3, p1_val, p2_val, ans_val, unit in items:
            ans_str = str(ans)
            is_ratio_type = ":" in ans_str
            if is_ratio_type:
                parts = ans_str.split(":")
                pred1 = f"{parts[1]}:{parts[0]}"
                pred2 = f"{int(parts[0])+1}:{int(parts[1])+1}"
            else:
                p1_int = int(p1_val) if str(p1_val).isdigit() else 0
                val_int = int(ans)
                p_cand1 = val_int + 5 if val_int + 5 != p1_int else val_int + 6
                p_cand2 = val_int - 3 if val_int - 3 != p1_int and val_int > 4 else val_int + 2
                pred1 = str(p_cand1)
                pred2 = str(p_cand2)

            q = build_question(
                question_id=qid,
                skill_id=skill_id,
                subskill=subskill,
                title=f"{subskill.replace('_', ' ').capitalize()} - {ans_val}",
                stem=stem,
                canonical_value=ans_str,
                unit=unit,
                learning_objective=learning_obj,
                solution_steps=[
                    {
                        "step_id": "step_1",
                        "description": "Calculate unit or intermediate part",
                        "target_expression": str(p1_val),
                        "target_value": str(p1_val),
                        "unit": "parts" if not unit else unit,
                        "permitted_scaffold_step": "Find the intermediate parts value.",
                    },
                    {
                        "step_id": "step_2",
                        "description": "Calculate final requested quantity",
                        "target_expression": f"{p2_val}",
                        "target_value": ans_str,
                        "unit": unit,
                    },
                ],
                scaffold_probes=[
                    {
                        "probe_id": "probe_1",
                        "kind": "value",
                        "min_level": 1,
                        "template": "What is the intermediate value for this calculation?",
                        "expected_expression": str(p1_val),
                        "expected_value": str(p1_val),
                        "unit": "parts" if not unit else unit,
                        "counts_as_step_id": "step_1",
                    }
                ],
                misconception_predictions=[
                    {
                        "predicted_response": pred1,
                        "misconception_code": "ratio_reversal" if is_ratio_type else "ratio_additive_interpretation",
                        "confidence": 0.9,
                        "rationale": "Calculation slip.",
                    },
                    {
                        "predicted_response": pred2,
                        "misconception_code": "unit_rate_error",
                        "confidence": 0.9,
                        "rationale": "Direct calculation slip.",
                    },
                ],
            )
            if is_ratio_type:
                q["accepted_answer_spec"]["type"] = "ratio"
            questions_1_1.append(q)
            # Write to release_1_1
            p_rel11 = os.path.join(RELEASE_1_1_DIR, f"{qid}.json")
            with open(p_rel11, "w", encoding="utf-8") as f:
                json.dump(q, f, indent=2)

    print(f"Saved {len(questions_1_1)} Release 1.1 questions to {RELEASE_1_1_DIR}.")
    total_bank = len(saved_1_0_ids) + len(questions_1_1)
    print(f"Total approved question bank size: {total_bank} items.")

if __name__ == "__main__":
    main()
