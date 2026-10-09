import pytest
from app.verifier.core import verify_equivalence, VerifierError

def test_equivalent_fractions():
    res = verify_equivalence("3/4", "0.75")
    assert res["is_correct"] is True
    assert res["reason"] == "symbolic_equivalence"

def test_equivalent_ratios():
    res = verify_equivalence("6:8", "3/4")
    assert res["is_correct"] is True
    
    res = verify_equivalence("75%", "3:4")
    assert res["is_correct"] is True
    
    res = verify_equivalence("6:8", "75%")
    assert res["is_correct"] is True

def test_not_equivalent():
    res = verify_equivalence("2/3", "3/4")
    assert res["is_correct"] is False
    assert res["reason"] == "not_equivalent"

def test_cannot_verify_invalid_syntax():
    res = verify_equivalence("2+/3", "2/3")
    assert res["is_correct"] is False
    assert "cannot_verify" in res["reason"]
    
def test_cannot_verify_unparseable():
    res = verify_equivalence("not a math expression", "1")
    assert res["is_correct"] is False
    assert "cannot_verify" in res["reason"]

def test_tolerance_check():
    # within tolerance
    res = verify_equivalence("3.1415", "3.14", tolerance=0.01)
    assert res["is_correct"] is True
    assert res["reason"] == "tolerance_match"
    
    # outside tolerance
    res = verify_equivalence("3.1415", "3.14", tolerance=0.001)
    assert res["is_correct"] is False
    assert res["reason"] == "tolerance_mismatch"
