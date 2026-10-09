import re

def sanitize_svg(svg_content: str) -> bool:
    """
    Validates and sanitizes an SVG. Returns True if valid and safe, False otherwise.
    Rejects SVGs with <script> tags or embedded iframes/links that are potentially malicious.
    """
    if not svg_content or not isinstance(svg_content, str):
        return False
        
    # Check for basic SVG structure
    if "<svg" not in svg_content.lower():
        return False
        
    # Check for malicious tags
    malicious_tags = [
        r"<script\b",
        r"<iframe\b",
        r"<object\b",
        r"<embed\b",
        r"javascript:",
        r"onload=",
        r"onerror="
    ]
    
    for tag in malicious_tags:
        if re.search(tag, svg_content, re.IGNORECASE):
            return False
            
    return True
