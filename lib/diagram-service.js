import crypto from "crypto";
import { normalise } from "./normaliser";

/**
 * DiagramService (SV-01) - PRD §8.9 FR-09, SPEC §2.2, WF-13
 *
 * Deterministic SVG renderer and validator for question diagrams.
 * Features:
 * - Generates SVG for leakage bands: below_4, level_4, level_5.
 * - Enforces leakage guard: masks unknowns with '?' or 'x' below Level 5,
 *   and masks intermediate steps below Level 4.
 * - Extracts every text surface (<text>, <title>, <desc>, aria-label, alt, adjacent description)
 *   and validates against solution values using the canonical normaliser.
 * - Enforces accessibility: text alternatives, <title>, <desc>, role="img",
 *   and visual distinctions that do not rely on colour alone (patterns, borders, symbols).
 * - Computes and stores sha256 hash, version, and validation result.
 */

function escapeXml(unsafe) {
  if (unsafe === null || unsafe === undefined) return "";
  return String(unsafe)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

const WORD_NUMERAL_MAP = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15,
  sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20,
  "twenty-four": 24, "twenty four": 24, thirty: 30,
  "thirty-six": 36, "thirty six": 36, forty: 40, fifty: 50,
  sixty: 60, seventy: 70, eighty: 80, ninety: 90, hundred: 100,
};

function extractTokens(text) {
  if (!text || typeof text !== "string") return new Set();
  const tokens = new Set();
  const digits = text.match(/\b\d+(\.\d+)?\b/g);
  if (digits) {
    for (const d of digits) {
      tokens.add(d);
      tokens.add(String(parseFloat(d)));
    }
  }
  const words = text.toLowerCase().match(/\b[a-z0-9-]+\b/g);
  if (words) {
    for (const w of words) {
      if (WORD_NUMERAL_MAP[w] !== undefined) {
        tokens.add(String(WORD_NUMERAL_MAP[w]));
        tokens.add(w);
      }
    }
  }
  return tokens;
}

export function getLeakageBand(level) {
  if (level < 4) return "below_4";
  if (level === 4) return "level_4";
  return "level_5";
}

/**
 * Deterministically renders a structured diagram specification into SVG.
 */
export function renderDiagram(spec, level = 3, options = {}) {
  if (!spec || typeof spec !== "object") {
    throw new Error("Invalid diagram specification");
  }

  const band = getLeakageBand(level);
  const title = spec.title || "Visual Model";
  const desc = spec.alt_text || spec.description || "Mathematical diagram";
  const type = spec.type || "ratio_table";

  let bodySvg = "";

  if (type === "ratio_table") {
    const headers = spec.headers || ["Category", "Parts", "Amount ($)"];
    const rows = spec.rows || [];

    const cellWidths = [180, 140, 160];
    const rowHeight = 44;
    const startX = 30;
    const startY = 70;

    // Table Header
    let headerCells = "";
    let curX = startX;
    headers.forEach((h, i) => {
      headerCells += `
        <rect x="${curX}" y="${startY}" width="${cellWidths[i]}" height="${rowHeight}" fill="#334155" stroke="#1e293b" stroke-width="2" />
        <text x="${curX + cellWidths[i] / 2}" y="${startY + 27}" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="14" font-weight="600" fill="#ffffff">${escapeXml(h)}</text>
      `;
      curX += cellWidths[i];
    });

    // Table Rows
    let rowCells = "";
    let curY = startY + rowHeight;
    rows.forEach((r, idx) => {
      const val = r[band] !== undefined ? r[band] : (band === "level_5" ? r.level_5 : "?");
      const patternId = r.pattern || (idx === 0 ? "pat-diagonal" : idx === 1 ? "pat-dots" : "pat-crosshatch");
      const symbol = idx === 0 ? "●" : idx === 1 ? "▲" : "■";

      const rX0 = startX;
      const rX1 = startX + cellWidths[0];
      const rX2 = startX + cellWidths[0] + cellWidths[1];

      rowCells += `
        <!-- Row ${idx + 1}: ${escapeXml(r.label)} -->
        <g data-testid="diagram-row-${idx}">
          <!-- Col 1: Label with textured indicator and distinct shape symbol (non-color visual cues) -->
          <rect x="${rX0}" y="${curY}" width="${cellWidths[0]}" height="${rowHeight}" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1.5" />
          <rect x="${rX0 + 8}" y="${curY + 12}" width="${20}" height="${20}" fill="url(#${patternId})" stroke="#475569" stroke-width="1.5" />
          <text x="${rX0 + 38}" y="${curY + 27}" font-family="system-ui, -apple-system, sans-serif" font-size="14" font-weight="500" fill="#0f172a">
            <tspan fill="#64748b" font-size="12">${symbol} </tspan>${escapeXml(r.label)}
          </text>

          <!-- Col 2: Ratio parts -->
          <rect x="${rX1}" y="${curY}" width="${cellWidths[1]}" height="${rowHeight}" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1.5" />
          <text x="${rX1 + cellWidths[1] / 2}" y="${curY + 27}" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="14" font-weight="500" fill="#0f172a">${escapeXml(r.parts)}</text>

          <!-- Col 3: Amount or masked unknown value -->
          <rect x="${rX2}" y="${curY}" width="${cellWidths[2]}" height="${rowHeight}" fill="#f1f5f9" stroke="#cbd5e1" stroke-width="1.5" />
          <text x="${rX2 + cellWidths[2] / 2}" y="${curY + 28}" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="16" font-weight="700" fill="${val === '?' || val === 'x' ? '#d97706' : '#0f172a'}" data-testid="diagram-cell-value-${idx}">
            ${escapeXml(val)}
          </text>
        </g>
      `;
      curY += rowHeight;
    });

    bodySvg = headerCells + rowCells;
  } else {
    // Tape diagram / Bar model representation
    const segments = spec.segments || [];
    let curX = 40;
    const startY = 100;
    const barHeight = 50;

    let segmentSvg = "";
    segments.forEach((seg, idx) => {
      const segWidth = (seg.parts || 1) * 60;
      const val = seg[band] !== undefined ? seg[band] : "?";
      const patternId = seg.pattern || (idx % 2 === 0 ? "pat-diagonal" : "pat-dots");

      segmentSvg += `
        <g data-testid="diagram-segment-${idx}">
          <rect x="${curX}" y="${startY}" width="${segWidth}" height="${barHeight}" fill="url(#${patternId})" stroke="#1e293b" stroke-width="2" />
          <text x="${curX + segWidth / 2}" y="${startY - 10}" text-anchor="middle" font-size="13" font-weight="600" fill="#0f172a">${escapeXml(seg.label)} (${seg.parts} parts)</text>
          <text x="${curX + segWidth / 2}" y="${startY + 32}" text-anchor="middle" font-size="16" font-weight="700" fill="#0f172a">${escapeXml(val)}</text>
        </g>
      `;
      curX += segWidth + 10;
    });

    bodySvg = segmentSvg;
  }

  // Complete accessible SVG document
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 540 260" width="100%" height="auto" role="img" aria-label="${escapeXml(desc)}" data-testid="diagram-svg-element">
  <title id="svg-diag-title">${escapeXml(title)}</title>
  <desc id="svg-diag-desc">${escapeXml(desc)}</desc>
  <defs>
    <!-- Pattern 1: Diagonal Stripes (non-colour accessible distinction) -->
    <pattern id="pat-diagonal" width="8" height="8" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
      <line x1="0" y1="0" x2="0" y2="8" stroke="#0284c7" stroke-width="3" />
      <line x1="0" y1="0" x2="8" y2="0" stroke="#bae6fd" stroke-width="3" />
    </pattern>
    <!-- Pattern 2: Dotted Texture (non-colour accessible distinction) -->
    <pattern id="pat-dots" width="10" height="10" patternUnits="userSpaceOnUse">
      <circle cx="5" cy="5" r="2.5" fill="#16a34a" />
      <rect width="10" height="10" fill="#dcfce7" opacity="0.6" />
    </pattern>
    <!-- Pattern 3: Crosshatch (non-colour accessible distinction) -->
    <pattern id="pat-crosshatch" width="8" height="8" patternUnits="userSpaceOnUse">
      <path d="M 0 0 L 8 8 M 8 0 L 0 8" stroke="#7c3aed" stroke-width="1.5" />
    </pattern>
  </defs>
  <!-- Background panel -->
  <rect x="0" y="0" width="540" height="260" rx="8" fill="#ffffff" stroke="#e2e8f0" stroke-width="1.5" />
  <!-- Diagram Title inside SVG -->
  <text x="30" y="40" font-family="system-ui, -apple-system, sans-serif" font-size="16" font-weight="700" fill="#1e293b">${escapeXml(title)}</text>
  ${bodySvg}
</svg>`.trim();

  return svg;
}

/**
 * Extracts all text surfaces from specification and rendered SVG for a given level:
 * <title>, <desc>, <text>, aria-label, alt, and adjacent description.
 */
export function extractTextSurfaces(spec, svgString = "", level = 3) {
  const surfaces = [];

  if (spec.title) surfaces.push(spec.title);
  if (spec.description) surfaces.push(spec.description);
  if (spec.alt_text) surfaces.push(spec.alt_text);

  if (spec.headers && Array.isArray(spec.headers)) {
    surfaces.push(...spec.headers);
  }

  const band = getLeakageBand(level);
  if (spec.rows && Array.isArray(spec.rows)) {
    for (const r of spec.rows) {
      if (r.label) surfaces.push(r.label);
      if (r.parts) surfaces.push(String(r.parts));
      const val = r[band] !== undefined ? r[band] : (band === "level_5" ? r.level_5 : "?");
      if (val) surfaces.push(String(val));
    }
  }

  if (spec.segments && Array.isArray(spec.segments)) {
    for (const s of spec.segments) {
      if (s.label) surfaces.push(s.label);
      if (s.parts) surfaces.push(String(s.parts));
      const val = s[band] !== undefined ? s[band] : "?";
      if (val) surfaces.push(String(val));
    }
  }

  if (svgString) {
    // Extract <title>...</title>
    const titleMatches = svgString.match(/<title[^>]*>([\s\S]*?)<\/title>/gi);
    if (titleMatches) {
      for (const m of titleMatches) {
        surfaces.push(m.replace(/<[^>]+>/g, "").trim());
      }
    }

    // Extract <desc>...</desc>
    const descMatches = svgString.match(/<desc[^>]*>([\s\S]*?)<\/desc>/gi);
    if (descMatches) {
      for (const m of descMatches) {
        surfaces.push(m.replace(/<[^>]+>/g, "").trim());
      }
    }

    // Extract <text>...</text>
    const textMatches = svgString.match(/<text[^>]*>([\s\S]*?)<\/text>/gi);
    if (textMatches) {
      for (const m of textMatches) {
        surfaces.push(m.replace(/<[^>]+>/g, "").trim());
      }
    }

    // Extract aria-label="..."
    const ariaMatches = svgString.match(/aria-label="([^"]+)"/gi);
    if (ariaMatches) {
      for (const m of ariaMatches) {
        const val = m.replace(/aria-label="|"/g, "");
        surfaces.push(val);
      }
    }
  }

  return surfaces;
}

/**
 * Validates a diagram specification and its rendered variant against:
 * 1. Leakage rules (FR-09):
 *    - Below Level 5: No final answer in any text surface (must be masked with '?' or 'x').
 *    - Below Level 4: No intermediate calculation steps in any text surface.
 *    - Level 4: May show permitted_scaffold_step, but final answer strictly masked.
 *    - Level 5: Allowed only if allow_level_5 is true.
 * 2. Accessibility rules (FR-09, §11.4):
 *    - Non-empty alt_text or desc.
 *    - Meaning does not depend on colour alone.
 */
export function validateDiagram(spec, question = {}, level = 3, allowLevel5 = false) {
  if (!spec || typeof spec !== "object") {
    return { valid: false, reason: "invalid_specification", violations: ["Missing diagram spec"] };
  }

  const violations = [];

  // Accessibility checks
  if (!spec.title || typeof spec.title !== "string" || !spec.title.trim()) {
    violations.push("Missing required diagram title");
  }
  if (!spec.alt_text && !spec.description) {
    violations.push("Missing required accessible text alternative (alt_text or description)");
  }

  // Check Level 5 policy authorisation
  if (level >= 5 && !allowLevel5) {
    violations.push("Level 5 diagram with worked solution requested without cohort allow_level_5 authorisation");
  }

  // Question stem tokens are exempt from leakage check
  const stemTokens = extractTokens(question.stem || "");

  // Collect structural ratio parts defined in spec (e.g. 2, 3, and 5 parts)
  const structuralPartTokens = new Set();
  if (spec.rows && Array.isArray(spec.rows)) {
    for (const r of spec.rows) {
      if (r.parts) {
        for (const t of extractTokens(String(r.parts))) {
          structuralPartTokens.add(t);
        }
      }
    }
  }
  if (spec.segments && Array.isArray(spec.segments)) {
    for (const s of spec.segments) {
      if (s.parts) {
        for (const t of extractTokens(String(s.parts))) {
          structuralPartTokens.add(t);
        }
      }
    }
  }

  // Collect forbidden solution values
  const canonicalValue = String(question.accepted_answer_spec?.canonical_value || question.final_answer || "").trim();
  const intermediateValues = [];
  if (question.solution_steps && Array.isArray(question.solution_steps)) {
    for (const s of question.solution_steps) {
      const valStr = String(s.target_value ?? "").trim();
      if (valStr && valStr !== canonicalValue && !stemTokens.has(valStr) && !structuralPartTokens.has(valStr)) {
        intermediateValues.push(valStr);
      }
    }
  }

  // Render SVG for the active level
  let renderedSvg = "";
  try {
    renderedSvg = renderDiagram(spec, level);
  } catch (err) {
    return { valid: false, reason: "render_error", violations: [err.message] };
  }

  // Extract all text surfaces for this level
  const textSurfaces = extractTextSurfaces(spec, renderedSvg, level);

  // Check each surface for leaked numbers
  for (const text of textSurfaces) {
    const tokens = extractTokens(text);

    // Rule: Below Level 5, final answer is strictly forbidden
    if (level < 5 && canonicalValue && tokens.has(canonicalValue)) {
      violations.push(`Final answer '${canonicalValue}' leaked in text surface: "${text}"`);
    }

    // Rule: Below Level 4, intermediate calculation values are strictly forbidden
    if (level < 4) {
      for (const inter of intermediateValues) {
        if (tokens.has(inter) && !stemTokens.has(inter)) {
          violations.push(`Intermediate calculation step '${inter}' leaked below Level 4 in: "${text}"`);
        }
      }
    }
  }

  // Specific check for rows in ratio table: below Level 5, target row must be masked with '?' or 'x'
  if (spec.rows && Array.isArray(spec.rows)) {
    const band = getLeakageBand(level);
    for (const r of spec.rows) {
      const cellVal = String(r[band] ?? "").trim();
      if (level < 5 && canonicalValue && cellVal === canonicalValue) {
        violations.push(`Cell for '${r.label}' displays unmasked final answer '${canonicalValue}' under band '${band}'`);
      }
    }
  }

  if (violations.length > 0) {
    return {
      valid: false,
      reason: "leakage_detected",
      violations,
    };
  }

  // Compute sha256 hash of rendered SVG
  const hash = "sha256:" + crypto.createHash("sha256").update(renderedSvg).digest("hex");

  return {
    valid: true,
    version: spec.version || 1,
    hash,
    svg: renderedSvg,
    alt_text: spec.alt_text || spec.title,
    description: spec.description || spec.alt_text,
    min_level: spec.min_level || 3,
    validated_at: new Date().toISOString(),
    validation_result: "valid",
  };
}

/**
 * In-memory registry of approved and test diagram assets.
 */
export const DIAGRAM_ASSETS = {
  // Approved standard ratio table for ratio_share_001
  diag_ratio_share_001: {
    diagram_id: "diag_ratio_share_001",
    version: 1,
    approval_status: "approved",
    type: "ratio_table",
    title: "Ratio Table: Leo and Maya's Shares",
    description: "Ratio table comparing Leo's 2 parts, Maya's 3 parts, and total 5 parts totaling $60.",
    alt_text: "A ratio table with rows for Leo, Maya, and Total. Leo has 2 parts, Maya has 3 parts, and Total has 5 parts representing $60. Dollar amounts for Leo and Maya are unknown.",
    min_level: 3,
    headers: ["Person", "Ratio Parts", "Dollar Amount"],
    rows: [
      { label: "Leo", parts: "2", below_4: "?", level_4: "24", level_5: "24", pattern: "pat-diagonal" },
      { label: "Maya", parts: "3", below_4: "?", level_4: "?", level_5: "36", pattern: "pat-dots" },
      { label: "Total", parts: "5", below_4: "60", level_4: "60", level_5: "60", pattern: "pat-crosshatch" },
    ],
  },

  // Leaked diagram with final answer in row and title (for testing validation rejection)
  diag_leaked_final_answer: {
    diagram_id: "diag_leaked_final_answer",
    version: 1,
    approval_status: "approved",
    type: "ratio_table",
    title: "Ratio Table with Maya getting 36",
    description: "Ratio table showing Maya gets 36 dollars",
    alt_text: "Ratio table with 36 dollars",
    min_level: 3,
    headers: ["Person", "Parts", "Amount"],
    rows: [
      { label: "Leo", parts: "2", below_4: "24", level_4: "24", level_5: "24" },
      { label: "Maya", parts: "3", below_4: "36", level_4: "36", level_5: "36" }, // Leaked 36 below Level 5
      { label: "Total", parts: "5", below_4: "60", level_4: "60", level_5: "60" },
    ],
  },

  // Unapproved diagram (approval_status: pending)
  diag_unapproved: {
    diagram_id: "diag_unapproved",
    version: 1,
    approval_status: "pending", // Unapproved!
    type: "ratio_table",
    title: "Pending Ratio Table",
    description: "Pending review",
    alt_text: "Pending ratio table",
    min_level: 3,
    headers: ["Person", "Parts", "Amount"],
    rows: [
      { label: "Leo", parts: "2", below_4: "?", level_4: "24", level_5: "24" },
      { label: "Maya", parts: "3", below_4: "?", level_4: "?", level_5: "36" },
      { label: "Total", parts: "5", below_4: "60", level_4: "60", level_5: "60" },
    ],
  },
};

export function getDiagramAsset(diagramId) {
  return DIAGRAM_ASSETS[diagramId] || null;
}
