import pytest
import sympy
from app.verifier.core import verify_equivalence, preprocess_expression

def test_preprocess_expression():
    assert preprocess_expression("75%") == "75.0/100"
    assert preprocess_expression("6:8") == "(6)/(8)"
    assert preprocess_expression("3/4") == "3/4"

def test_verify_equivalence_fractions_decimals():
    res = verify_equivalence("3/4", "0.75")
    assert res.is_equivalent is True
    assert res.status == "verified"

def test_verify_equivalence_percentages():
    res = verify_equivalence("75%", "3/4")
    assert res.is_equivalent is True
    assert res.status == "verified"

def test_verify_equivalence_ratios():
    res = verify_equivalence("6:8", "3/4")
    assert res.is_equivalent is True
    assert res.status == "verified"

    res2 = verify_equivalence("6:8", "0.75")
    assert res2.is_equivalent is True
    assert res2.status == "verified"

def test_verify_equivalence_algebraic():
    res = verify_equivalence("x + x", "2*x")
    assert res.is_equivalent is True
    assert res.status == "verified"

def test_verify_equivalence_incorrect():
    res = verify_equivalence("3/4", "0.8")
    assert res.is_equivalent is False
    assert res.status == "verified"

def test_verify_equivalence_tolerance():
    res = verify_equivalence("3.1415", "3.14", tolerance=0.01)
    assert res.is_equivalent is True
    assert res.status == "verified"
    
    res2 = verify_equivalence("3.1415", "3.10", tolerance=0.01)
    assert res2.is_equivalent is False
    assert res2.status == "verified"

def test_verify_equivalence_cannot_verify():
    res = verify_equivalence("abc xyz", "3/4")
    assert res.is_equivalent is False
    assert res.status == "cannot_verify"
    assert res.error_reason is not None

def test_verify_equivalence_unexpected_exception():
    # To test unexpected exception, we could patch sympy.sympify to raise RuntimeError
    pass
