// Deterministic Normaliser & PII Scrubber for SolvePath
// Standard-library only; implements rules from SPEC §2.10, §3.10 and PRD §14.5

const WORD_NUMERALS = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
  "twenty-four": 24,
  "twenty four": 24,
  thirty: 30,
  "thirty-six": 36,
  "thirty six": 36,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
  hundred: 100,
};

export function scrubPii(text) {
  if (!text || typeof text !== "string") return "";
  let scrubbed = text;
  // Emails
  scrubbed = scrubbed.replace(/[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+/g, "[REDACTED_EMAIL]");
  // Phone numbers (simple international / local format)
  scrubbed = scrubbed.replace(/(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g, "[REDACTED_PHONE]");
  // Recognized name patterns (best effort, SPEC §2.10, STU-13 AC 6)
  const NON_NAMES = new Set(["trying", "doing", "working", "looking", "thinking", "here", "just", "not", "unsure", "stuck", "ready", "going", "asking", "writing"]);
  scrubbed = scrubbed.replace(/\b(my name is|i am|i'm|call me|this is|My name is|I am|I'm|Call me|This is)\s+([A-Z][a-z]+)\b/g, (match, prefix, name) => {
    if (NON_NAMES.has(name.toLowerCase())) {
      return match;
    }
    return `${prefix} [STUDENT_NAME]`;
  });
  return scrubbed.trim();
}

export function normalise(raw, fieldKind = "answer") {
  if (raw === null || raw === undefined) {
    return {
      input_kind: "unparsed",
      canonical_value: null,
      canonical_expression: null,
      unit: "",
      parse_issue: "unparsed",
    };
  }

  let text = String(raw).trim();
  if (!text) {
    return {
      input_kind: "unparsed",
      canonical_value: null,
      canonical_expression: null,
      unit: "",
      parse_issue: "unparsed",
    };
  }

  // 1. Check for comma rules (SPEC §2.10)
  // Thousands comma pattern: e.g. 30,000 or 1,000,000 or $30,000.50
  if (text.includes(",")) {
    const thousandsCommaRegex = /^\$?\s*\d{1,3}(,\d{3})+(\.\d+)?(\s*[\w%$]+)?$/;
    if (thousandsCommaRegex.test(text)) {
      // Valid thousands comma: strip commas
      text = text.replace(/,/g, "");
    } else {
      // Comma outside 30,000 pattern (e.g. 7,5 or 1,50 or 3,14)
      return {
        input_kind: "unparsed",
        canonical_value: null,
        canonical_expression: null,
        unit: "",
        parse_issue: "comma_ambiguous",
      };
    }
  }

  // 2. Word numerals (e.g. "thirty-six", "five")
  const lowerText = text.toLowerCase().trim();
  if (WORD_NUMERALS[lowerText] !== undefined) {
    return {
      input_kind: "value",
      canonical_value: String(WORD_NUMERALS[lowerText]),
      canonical_expression: null,
      unit: "",
      parse_issue: "none",
    };
  }

  // 3. Strip leading currency / symbols
  let cleaned = text;
  let unit = "";
  if (cleaned.startsWith("$")) {
    unit = "$";
    cleaned = cleaned.slice(1).trim();
  } else if (cleaned.endsWith("%")) {
    unit = "%";
    cleaned = cleaned.slice(0, -1).trim();
  }

  // Strip trailing unit words like "dollars", "parts", "km", "m", "cm", "mm", "kg", "g", "l", "litres", "ml"
  const unitMatch = cleaned.match(/^(.*?)(?:\s+|(?<=\d|\.))(dollars|parts|km|m|cm|mm|kg|g|litres|litre|l|ml)$/i);
  if (unitMatch && unitMatch[1].trim()) {
    cleaned = unitMatch[1].trim();
    unit = unitMatch[2].toLowerCase();
    if (unit === "litres" || unit === "litre") unit = "l";
  }

  // 4. Ratio pattern (e.g. "2:3", "2 : 3", "2 to 3")
  const ratioMatch = cleaned.match(/^(\d+(?:\.\d+)?)\s*(?::|to)\s*(\d+(?:\.\d+)?)$/i);
  if (ratioMatch) {
    return {
      input_kind: "ratio",
      canonical_value: `${ratioMatch[1]}:${ratioMatch[2]}`,
      canonical_expression: null,
      unit: "",
      parse_issue: "none",
    };
  }

  // 5. Fraction pattern (e.g. "3/5", "1/2")
  // Note: '/' in answer field is fraction (SPEC §3.10)
  const fractionMatch = cleaned.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (fractionMatch && fieldKind === "answer") {
    return {
      input_kind: "fraction",
      canonical_value: `${fractionMatch[1]}/${fractionMatch[2]}`,
      canonical_expression: null,
      unit: "",
      parse_issue: "none",
    };
  }

  // 6. Arithmetic Expression pattern (e.g. "60 / 5", "12 * 3", "2 + 3", "7.5 × 4", "7.5x4", "7.5 ÷ 4")
  // Operators: +, -, *, x, ×, /, ÷
  const exprRegex = /^(\d+(?:\.\d+)?)\s*([\+\-\*\/x×÷])\s*(\d+(?:\.\d+)?)$/i;
  const exprMatch = cleaned.match(exprRegex);
  if (exprMatch) {
    let left = exprMatch[1];
    let op = exprMatch[2];
    let right = exprMatch[3];

    // Normalize operator
    if (op === "x" || op === "×") op = "*";
    if (op === "÷") op = "/";

    let evaluated = null;
    const lNum = parseFloat(left);
    const rNum = parseFloat(right);
    if (op === "+") evaluated = lNum + rNum;
    else if (op === "-") evaluated = lNum - rNum;
    else if (op === "*") evaluated = lNum * rNum;
    else if (op === "/") evaluated = rNum !== 0 ? lNum / rNum : null;

    return {
      input_kind: "expression",
      canonical_value: evaluated !== null ? String(evaluated) : null,
      canonical_expression: `${left} ${op} ${right}`,
      unit: unit,
      parse_issue: "none",
    };
  }

  // 7. Plain Numeric / Decimal (e.g. "36", "12.5")
  if (/^-?\d+(\.\d+)?$/.test(cleaned)) {
    return {
      input_kind: "value",
      canonical_value: cleaned,
      canonical_expression: null,
      unit: unit,
      parse_issue: "none",
    };
  }

  // 8. Otherwise: unparsed
  return {
    input_kind: "unparsed",
    canonical_value: null,
    canonical_expression: null,
    unit: "",
    parse_issue: "unparsed",
  };
}
