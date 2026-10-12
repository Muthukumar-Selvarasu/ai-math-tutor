import { getQuestion, listQuestions } from "./question-loader.js";
import { getDiagramAsset } from "./diagram-service.js";

/**
 * Skill Graph definition (SPEC §2.4, §3.6-3.9, PRD §10.6, AGENTS.md SV-02)
 * Nodes: Skills, Misconceptions, and Questions.
 * Edges: 'prerequisite', 'indicates', 'remediates'.
 */
export const SKILL_GRAPH_NODES = {
  skills: {
    ratio_simplifying: {
      skill_id: "ratio_simplifying",
      aliases: ["ratio.simplify", "ratio_simplify"],
      name: "Simplifying Ratios",
      difficulty_band: "foundation",
      prerequisites: [], // Foundational starting skill: 0 prerequisites
      question_ids: ["ratio_simp_001", "ratio_simp_002"],
    },
    ratio_sharing: {
      skill_id: "ratio_sharing",
      aliases: ["ratio.sharing", "ratio_sharing"],
      name: "Sharing in a Given Ratio",
      difficulty_band: "intermediate",
      prerequisites: ["ratio_simplifying"], // Requires simplifying
      question_ids: ["ratio_share_001", "ratio_share_002"],
    },
    ratio_unitary: {
      skill_id: "ratio_unitary",
      aliases: ["ratio.unitary", "ratio_unitary"],
      name: "Unitary Ratio Methods",
      difficulty_band: "intermediate",
      prerequisites: ["ratio_sharing"], // Requires sharing
      question_ids: ["ratio_unit_001", "ratio_unit_002"],
    },
  },
  misconceptions: [
    "ratio_additive_interpretation",
    "unit_rate_error",
    "ratio_reversal",
  ],
};

export const SKILL_GRAPH_EDGES = [
  // Prerequisite edges: skill A before skill B
  {
    from_id: "ratio_simplifying",
    to_id: "ratio_sharing",
    kind: "prerequisite",
  },
  {
    from_id: "ratio_sharing",
    to_id: "ratio_unitary",
    kind: "prerequisite",
  },

  // Remediates edges: an approved question set is the next practice for that misconception
  {
    from_id: "ratio_additive_interpretation",
    to_id: "ratio_simp_001",
    target_skill_id: "ratio_simplifying",
    kind: "remediates",
    rationale: "Reinforce multiplicative relationship and division by common factor",
  },
  {
    from_id: "unit_rate_error",
    to_id: "ratio_unit_001",
    target_skill_id: "ratio_unitary",
    kind: "remediates",
    rationale: "Reinforce unit rate method: finding the value of one part",
  },
  {
    from_id: "ratio_reversal",
    to_id: "ratio_share_002",
    target_skill_id: "ratio_sharing",
    kind: "remediates",
    rationale: "Reinforce order of terms to share assignments",
  },
];

/**
 * Cohort starting skills that require no untaught skills.
 */
export const COHORT_STARTING_SKILLS = ["ratio_simplifying", "ratio.simplify"];

/**
 * Normalises skill_id across dot or underscore notation.
 */
export function normaliseSkillId(skillId) {
  if (!skillId) return "ratio_simplifying";
  const s = String(skillId).trim().toLowerCase();
  if (s === "ratio.simplify" || s === "ratio_simplifying") return "ratio_simplifying";
  if (s === "ratio.sharing" || s === "ratio_sharing") return "ratio_sharing";
  if (s === "ratio.unitary" || s === "ratio_unitary") return "ratio_unitary";
  return s;
}

/**
 * Validates whether a question is approved and published (SPEC WF-02, PRD FR-02).
 * Unapproved, draft, flagged, or withheld questions return false.
 */
export function isQuestionApprovedAndPublished(question) {
  if (!question || typeof question !== "object") return false;
  if (!question.question_id) return false;

  // Validation status check
  if (question.validation_status !== undefined && question.validation_status !== "approved") {
    return false;
  }

  // Publication status check
  if (question.publication_status !== undefined && question.publication_status !== "published") {
    return false;
  }

  // Flagged items are never served
  if (question.flagged) {
    return false;
  }

  // Diagram availability check: if question has a diagram, must have approved variant (SPEC WF-02 step 4)
  if (question.has_diagram && question.diagram_id) {
    const diagAsset = getDiagramAsset(question.diagram_id) || question.diagram;
    if (!diagAsset || diagAsset.approval_status !== "approved") {
      return false;
    }
  }

  return true;
}

/**
 * Lists all published, approved, unflagged questions (SPEC §3.3 / STU-09).
 */
export function listApprovedPublishedQuestions() {
  const all = listQuestions();
  const approvedList = [];

  for (const item of all) {
    const full = getQuestion(item.question_id) || item;
    if (isQuestionApprovedAndPublished(full)) {
      approvedList.push({
        question_id: full.question_id,
        version: full.version || 1,
        title: full.title || item.title || full.question_id,
        skill_id: full.skill_id || item.skill_id || "ratio_sharing",
        difficulty_band: full.difficulty?.band || item.difficulty_band || "intermediate",
        stem: full.stem || item.stem || "",
      });
    }
  }

  // Deterministic sort by question_id
  approvedList.sort((a, b) => a.question_id.localeCompare(b.question_id));
  return approvedList;
}

/**
 * Gets a single approved published question by ID.
 * Returns null if unapproved, unpublished, flagged, or missing.
 */
export function getApprovedPublishedQuestion(questionId) {
  if (!questionId) return null;
  const question = getQuestion(questionId);
  if (!question) return null;
  if (!isQuestionApprovedAndPublished(question)) {
    return null;
  }
  return question;
}

/**
 * PracticePlanner (SV-02): Recommend next practice item deterministically along skill graph.
 *
 * Rules (PRD FR-02, FR-08, SPEC WF-02, AGENTS.md SV-02):
 * 1. Zero unapproved questions delivered.
 * 2. If student has NO history:
 *    Choose an approved starting item from cohort starting set that requires NO untaught skill.
 * 3. If student HAS history:
 *    The Practice Planner reads the student's learner_skill_state and session history.
 *    - Follows 'remediates' edge if misconception observed.
 *    - Follows 'prerequisite' edge backward if struggling on current skill.
 *    - Follows 'prerequisite' edge forward if mastered current skill.
 * 4. Deterministic tie-breaking (alphabetical by question_id). Vector similarity NEVER used.
 */
export function recommendNextQuestion(studentId, options = {}) {
  const {
    sessions = [],
    learnerSkillStates = new Map(),
    excludeQuestionIds = [],
  } = options;

  // Filter bank to strictly approved, published, unflagged, un-withheld items
  const eligibleQuestions = listApprovedPublishedQuestions().filter(
    (q) => !excludeQuestionIds.includes(q.question_id)
  );

  if (eligibleQuestions.length === 0) {
    return null;
  }

  // Filter sessions for this student
  const studentSessions = sessions.filter(
    (s) => (s.student_id || "student_default") === studentId
  );

  const completedSessions = studentSessions.filter(
    (s) =>
      s.state === "completed" ||
      s.state === "reflection" ||
      s.state === "transfer_offered" ||
      s.state === "transfer_active"
  );

  const hasHistory = studentSessions.length > 0 || completedSessions.length > 0;

  // Case A: No history -> Approved starting item with NO untaught skill (Criterion 3)
  if (!hasHistory) {
    const startingQuestions = eligibleQuestions.filter((q) => {
      const normSkill = normaliseSkillId(q.skill_id);
      return COHORT_STARTING_SKILLS.includes(normSkill) || normSkill === "ratio_simplifying";
    });

    const candidate = startingQuestions.length > 0 ? startingQuestions[0] : eligibleQuestions[0];
    const fullQ = getQuestion(candidate.question_id) || candidate;

    return {
      question_id: fullQ.question_id,
      title: fullQ.title,
      stem: fullQ.stem,
      skill_id: fullQ.skill_id,
      difficulty_band: fullQ.difficulty?.band || candidate.difficulty_band,
      reason: "Approved starting item with no untaught skill prerequisites",
      edge_type: "starting_item",
    };
  }

  // Case B: With history -> Practice Planner walks skill-graph edges (Criterion 4)
  const lastSession = studentSessions[studentSessions.length - 1];
  const completedIds = new Set(
    completedSessions.map((s) => s.question_id).concat(excludeQuestionIds)
  );

  // 1. Check for Misconceptions in recent session or history -> 'remediates' edge
  let recentMisconception = null;
  if (lastSession?.misconception_events && lastSession.misconception_events.length > 0) {
    const latestEvent = lastSession.misconception_events[lastSession.misconception_events.length - 1];
    if (latestEvent?.code) {
      recentMisconception = latestEvent.code;
    }
  }

  if (recentMisconception) {
    const remediatesEdge = SKILL_GRAPH_EDGES.find(
      (edge) => edge.kind === "remediates" && edge.from_id === recentMisconception
    );

    if (remediatesEdge) {
      const targetQuestion = eligibleQuestions.find(
        (q) => q.question_id === remediatesEdge.to_id
      );
      if (targetQuestion) {
        const fullQ = getQuestion(targetQuestion.question_id) || targetQuestion;
        return {
          question_id: fullQ.question_id,
          title: fullQ.title,
          stem: fullQ.stem,
          skill_id: fullQ.skill_id,
          difficulty_band: fullQ.difficulty?.band || targetQuestion.difficulty_band,
          reason: `Remediation for misconception '${recentMisconception}' along skill-graph remediates edge`,
          edge_type: "remediates",
          misconception_code: recentMisconception,
        };
      }
    }
  }

  // 2. Check current skill performance -> 'prerequisite' edge (forward or backward)
  const currentSkillRaw = lastSession
    ? getQuestion(lastSession.question_id)?.skill_id
    : "ratio_sharing";
  const currentSkill = normaliseSkillId(currentSkillRaw);

  // Check struggle indicators
  const wasStuck = lastSession?.state === "stuck";
  const consecutiveUnsuccessful =
    lastSession?.attempts &&
    lastSession.attempts.length >= 2 &&
    lastSession.attempts.every((a) => a.verdict !== "correct");

  if (wasStuck || consecutiveUnsuccessful) {
    // Student struggled: follow prerequisite edge BACKWARD to reinforce foundational skill
    const backwardEdge = SKILL_GRAPH_EDGES.find(
      (edge) => edge.kind === "prerequisite" && edge.to_id === currentSkill
    );

    if (backwardEdge) {
      const prereqSkill = backwardEdge.from_id;
      const prereqQuestions = eligibleQuestions.filter(
        (q) => normaliseSkillId(q.skill_id) === prereqSkill && !completedIds.has(q.question_id)
      );

      const target = prereqQuestions.length > 0 ? prereqQuestions[0] : eligibleQuestions.find(
        (q) => normaliseSkillId(q.skill_id) === prereqSkill
      );

      if (target) {
        const fullQ = getQuestion(target.question_id) || target;
        return {
          question_id: fullQ.question_id,
          title: fullQ.title,
          stem: fullQ.stem,
          skill_id: fullQ.skill_id,
          difficulty_band: fullQ.difficulty?.band || target.difficulty_band,
          reason: `Reinforce foundational skill '${prereqSkill}' along skill-graph prerequisite edge`,
          edge_type: "prerequisite_backward",
        };
      }
    }
  }

  // Check progression: student succeeded on current skill -> follow prerequisite edge FORWARD
  const lastWasSuccess =
    lastSession?.state === "completed" ||
    lastSession?.state === "reflection" ||
    lastSession?.state === "transfer_offered" ||
    lastSession?.state === "transfer_active";

  if (lastWasSuccess) {
    const forwardEdge = SKILL_GRAPH_EDGES.find(
      (edge) => edge.kind === "prerequisite" && edge.from_id === currentSkill
    );

    if (forwardEdge) {
      const nextSkill = forwardEdge.to_id;
      const nextQuestions = eligibleQuestions.filter(
        (q) => normaliseSkillId(q.skill_id) === nextSkill && !completedIds.has(q.question_id)
      );

      const target = nextQuestions.length > 0 ? nextQuestions[0] : eligibleQuestions.find(
        (q) => normaliseSkillId(q.skill_id) === nextSkill
      );

      if (target) {
        const fullQ = getQuestion(target.question_id) || target;
        return {
          question_id: fullQ.question_id,
          title: fullQ.title,
          stem: fullQ.stem,
          skill_id: fullQ.skill_id,
          difficulty_band: fullQ.difficulty?.band || target.difficulty_band,
          reason: `Advance to next skill '${nextSkill}' along skill-graph prerequisite edge`,
          edge_type: "prerequisite_forward",
        };
      }
    }
  }

  // Default: Choose uncompleted approved question in bank (deterministic sort)
  const uncompleted = eligibleQuestions.filter((q) => !completedIds.has(q.question_id));
  const selected = uncompleted.length > 0 ? uncompleted[0] : eligibleQuestions[0];
  const fullQ = getQuestion(selected.question_id) || selected;

  return {
    question_id: fullQ.question_id,
    title: fullQ.title,
    stem: fullQ.stem,
    skill_id: fullQ.skill_id,
    difficulty_band: fullQ.difficulty?.band || selected.difficulty_band,
    reason: "Curriculum practice recommendation along approved skill sequence",
    edge_type: "curriculum_sequence",
  };
}
