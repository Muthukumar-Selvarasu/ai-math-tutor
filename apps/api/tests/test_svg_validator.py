import pytest
from app.core.svg_validator import sanitize_svg

def test_sanitize_svg_valid():
    valid_svg = '<svg width="100" height="100"><circle cx="50" cy="50" r="40" stroke="green" stroke-width="4" fill="yellow" /></svg>'
    assert sanitize_svg(valid_svg) is True

def test_sanitize_svg_invalid_missing_svg_tag():
    invalid_svg = '<circle cx="50" cy="50" r="40" />'
    assert sanitize_svg(invalid_svg) is False

def test_sanitize_svg_malicious_script():
    malicious = '<svg><script>alert(1);</script></svg>'
    assert sanitize_svg(malicious) is False
    
def test_sanitize_svg_malicious_onload():
    malicious = '<svg onload="alert(1)"></svg>'
    assert sanitize_svg(malicious) is False

def test_sanitize_svg_javascript_href():
    malicious = '<svg><a href="javascript:alert(1)">Link</a></svg>'
    assert sanitize_svg(malicious) is False
