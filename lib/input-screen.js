/**
 * Input Screen Engine (lib/input-screen.js)
 *
 * Implements deterministic input screening from:
 * - PRD §8.3.1 (Input Screen, 6 categories: answer_request, abuse, assessment_help,
 *   impersonation, worrying_disclosure, injection_phrase)
 * - SPEC §3.9, AG-01 (ProblemContextAgent)
 *
 * On a hit:
 * - Turn short-circuits
 * - Verifier, model, and hint level are untouched
 * - No attempt is counted
 * - Returns authored canned reply from content/safety/canned_responses.json
 * - Logs safety event to audit trail
 */

import { getCannedResponse } from "./canned-responses";

const INJECTION_PATTERNS = [
  /\bignore\s+(all\s+|any\s+)?(previous|prior)\s+instructions\b/i,
  /\b(system\s+prompt|developer\s+mode|jailbreak|disregard\s+rules|override\s+rules)\b/i,
  /\b(reveal|show|print)\s+(your\s+|the\s+)?(system\s+prompt|instructions|internal\s+prompt)\b/i,
  /\b(bypass\s+safety|unrestricted\s+mode|act\s+as\s+dan)\b/i,
  /\b(prompt\s+injection|ignore\s+policy)\b/i,
];

const ANSWER_REQUEST_PATTERNS = [
  /\b(tell\s+me|give\s+me|just\s+give\s+me|what\s+is)\s+(the\s+)?(answer|final\s+answer|solution)\b/i,
  /\b(show\s+me\s+the\s+answer|give\s+answer\s+now)\b/i,
];

const ABUSE_PATTERNS = [
  /\b(fuck|shit|bitch|bastard|asshole|cunt|f\*ck|s\*it)\b/i,
  /\b(shut\s+up|i\s+hate\s+you|you\s+suck)\b/i,
];

const ASSESSMENT_HELP_PATTERNS = [
  /\b(this\s+is\s+a\s+test|solve\s+my\s+test|exam\s+question|test\s+cheat|during\s+my\s+exam)\b/i,
  /\b(help\s+me\s+cheat|cheat\s+on\s+test)\b/i,
];

const IMPERSONATION_PATTERNS = [
  /\b(write\s+my\s+essay|do\s+my\s+homework\s+for\s+me\s+to\s+submit|write\s+work\s+for\s+me)\b/i,
  /\b(pretend\s+to\s+be\s+my\s+teacher|impersonate)\b/i,
];

const WORRYING_DISCLOSURE_PATTERNS = [
  /\b(i\s+want\s+to\s+hurt\s+myself|kill\s+myself|commit\s+suicide|self[\s-]harm)\b/i,
  /\b(i\s+am\s+being\s+hurt|someone\s+is\s+hurting\s+me|abuse\s+at\s+home)\b/i,
];

export function inputScreen(text) {
  if (!text || typeof text !== "string") {
    return { hit: false, category: null, canned_key: null, text: null };
  }

  const trimmed = text.trim();
  if (!trimmed) {
    return { hit: false, category: null, canned_key: null, text: null };
  }

  // 1. Injection phrase check
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(trimmed)) {
      return {
        hit: true,
        category: "injection_phrase",
        canned_key: "injection_phrase_reply",
        text: getCannedResponse("injection_phrase_reply"),
      };
    }
  }

  // 2. Worrying disclosure check (Safeguarding)
  for (const pattern of WORRYING_DISCLOSURE_PATTERNS) {
    if (pattern.test(trimmed)) {
      return {
        hit: true,
        category: "worrying_disclosure",
        canned_key: "worrying_disclosure_reply",
        text: getCannedResponse("worrying_disclosure_reply"),
      };
    }
  }

  // 3. Abuse check
  for (const pattern of ABUSE_PATTERNS) {
    if (pattern.test(trimmed)) {
      return {
        hit: true,
        category: "abuse",
        canned_key: "abuse_reply",
        text: getCannedResponse("abuse_reply"),
      };
    }
  }

  // 4. Assessment help check
  for (const pattern of ASSESSMENT_HELP_PATTERNS) {
    if (pattern.test(trimmed)) {
      return {
        hit: true,
        category: "assessment_help",
        canned_key: "assessment_help_reply",
        text: getCannedResponse("assessment_help_reply"),
      };
    }
  }

  // 5. Impersonation check
  for (const pattern of IMPERSONATION_PATTERNS) {
    if (pattern.test(trimmed)) {
      return {
        hit: true,
        category: "impersonation",
        canned_key: "impersonation_reply",
        text: getCannedResponse("impersonation_reply"),
      };
    }
  }

  // 6. Direct answer request check
  for (const pattern of ANSWER_REQUEST_PATTERNS) {
    if (pattern.test(trimmed)) {
      return {
        hit: true,
        category: "answer_request",
        canned_key: "answer_request_reply",
        text: getCannedResponse("answer_request_reply"),
      };
    }
  }

  return { hit: false, category: null, canned_key: null, text: null };
}
