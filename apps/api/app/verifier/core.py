from typing import Any, Dict, Optional, Union
import sympy
from sympy.parsing.sympy_parser import parse_expr, standard_transformations, implicit_multiplication_application
import re

class VerifierError(Exception):
    """Exception raised when verifier fails unexpectedly."""
    pass

def preprocess_expression(expr_str: str) -> str:
    """Preprocess student input into a sympy parsable format."""
    expr_str = expr_str.strip()
    # Handle ratios (a:b -> a/b)
    if ':' in expr_str:
        parts = expr_str.split(':')
        if len(parts) == 2:
            return f"({parts[0]})/({parts[1]})"
    
    # Handle percentages (75% -> 75/100)
    if expr_str.endswith('%'):
        return f"({expr_str[:-1]})/100"
        
    return expr_str

def parse_student_expr(expr_str: str) -> sympy.Expr:
    """Parses a string into a SymPy expression safely."""
    try:
        clean_expr = preprocess_expression(expr_str)
        transformations = (standard_transformations + (implicit_multiplication_application,))
        return parse_expr(clean_expr, transformations=transformations, evaluate=False)
    except Exception as e:
        raise ValueError(f"cannot_verify: {str(e)}") from e

def verify_equivalence(student_ans: str, expected_ans: str, tolerance: Optional[float] = None) -> Dict[str, Any]:
    """
    Deterministically verifies if the student_ans is mathematically equivalent to expected_ans.
    Returns a dict with status and details.
    """
    try:
        student_expr = parse_student_expr(student_ans)
        expected_expr = parse_student_expr(expected_ans)
        
        # Check numerical tolerance if specified
        if tolerance is not None:
            student_val = float(student_expr.evalf())
            expected_val = float(expected_expr.evalf())
            is_equiv = abs(student_val - expected_val) <= tolerance
            return {
                "is_correct": is_equiv,
                "reason": "tolerance_match" if is_equiv else "tolerance_mismatch",
                "student_val": student_val,
                "expected_val": expected_val
            }
            
        # Symbolic equivalence check
        diff = sympy.simplify(student_expr - expected_expr)
        if diff == 0:
            return {
                "is_correct": True,
                "reason": "symbolic_equivalence"
            }
            
        return {
            "is_correct": False,
            "reason": "not_equivalent"
        }
    except ValueError as ve:
        if str(ve).startswith("cannot_verify"):
            return {
                "is_correct": False,
                "reason": str(ve)
            }
        raise ve
    except Exception as e:
        # Fail loud on unexpected errors
        raise VerifierError(f"Unexpected verifier exception: {str(e)}") from e
