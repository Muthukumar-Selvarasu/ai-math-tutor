/**
 * Prompt-Capture Guard Module (lib/prompt-capture-guard.js)
 *
 * Implements the before_model prompt-capture guard from:
 * - PRD §9.3, §11.2, SPEC §2.1 #2, SPEC §3.7, AGENTS §2.1 #2, AGENTS §3.7
 * - Rule: No student free text is permitted in any model prompt.
 * - On violation: The turn fails before any model call into fallback_l{level},
 *   with fallback_reason=null and a P0 audit event "prompt_capture_violation".
 */

export function checkPromptCaptureGuard({
  prompt_text = "",
  student_free_text = "",
  simulate_violation = false,
} = {}) {
  if (simulate_violation) {
    return {
      passed: false,
      reason: "prompt_capture_violation",
      details: "Simulated prompt-capture violation: student free text detected in model prompt.",
    };
  }

  if (!prompt_text || typeof prompt_text !== "string") {
    return { passed: true };
  }

  if (student_free_text && typeof student_free_text === "string" && student_free_text.trim().length > 0) {
    const cleanStudentText = student_free_text.trim().toLowerCase();
    // Exclude single numbers or short numeric strings that match stem / problem values
    if (cleanStudentText.length > 3 && !/^\d+(\.\d+)?$/.test(cleanStudentText)) {
      if (prompt_text.toLowerCase().includes(cleanStudentText)) {
        return {
          passed: false,
          reason: "prompt_capture_violation",
          details: `Student free-text pattern "${cleanStudentText}" found in model prompt.`,
        };
      }
    }
  }

  return {
    passed: true,
  };
}
