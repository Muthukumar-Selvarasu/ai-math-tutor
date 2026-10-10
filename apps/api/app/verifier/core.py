
import sympy
from pydantic import BaseModel


class VerifierResult(BaseModel):
    is_correct: bool
    is_equivalent: bool
    status: str  # 'verified' or 'cannot_verify'
    error_reason: str | None = None
    feedback: str | None = None

def preprocess_expression(expr_str: str) -> str:
    """Preprocess strings to handle percentages and ratios."""
    if not isinstance(expr_str, str):
        return str(expr_str)
    
    expr_str = expr_str.strip()
    
    # Handle percentages: "75%" -> "75/100"
    if expr_str.endswith("%"):
        try:
            val = float(expr_str[:-1])
            return f"{val}/100"
        except ValueError:
            pass
            
    # Handle ratios: "6:8" -> "6/8"
    if ":" in expr_str:
        parts = expr_str.split(":")
        if len(parts) == 2:
            return f"({parts[0]})/({parts[1]})"
            
    return expr_str

def verify_equivalence(student_response: str, expected_answer: str, tolerance: float | None = None) -> VerifierResult:
    """
    Verifies if a student response is mathematically equivalent to the expected answer.
    Never fails silently; uses fail-loud error handling to return 'cannot_verify' for unparseable input.
    """
    try:
        student_expr_str = preprocess_expression(student_response)
        expected_expr_str = preprocess_expression(expected_answer)
        
        # Parse expressions using sympy
        student_expr = sympy.sympify(student_expr_str)
        expected_expr = sympy.sympify(expected_expr_str)
        
        # If tolerance is provided, evaluate numerically
        if tolerance is not None:
            student_val = float(student_expr.evalf())
            expected_val = float(expected_expr.evalf())
            is_eq = abs(student_val - expected_val) <= tolerance
            return VerifierResult(
                is_correct=is_eq,
                is_equivalent=is_eq,
                status="verified"
            )
            
        # Symbolic equivalence
        diff = sympy.simplify(student_expr - expected_expr)
        is_eq = (diff == 0)
        
        return VerifierResult(
            is_correct=is_eq,
            is_equivalent=is_eq,
            status="verified"
        )
        
    except (sympy.SympifyError, TypeError, ValueError) as e:
        return VerifierResult(
            is_correct=False,
            is_equivalent=False,
            status="cannot_verify",
            error_reason=f"Failed to parse or evaluate expression: {e!s}"
        )
    except Exception as e:
        # Fail loud on unexpected errors
        raise RuntimeError(f"Unexpected verifier exception: {e!s}") from e
