import { getQuestion, listQuestions } from "./question-loader";

export const SKILL_METADATA = {
  "ratio.sharing": {
    name: "Sharing in a Given Ratio",
    description: "Dividing quantities proportionally into specified parts",
    prerequisites: ["ratio.simplify"],
  },
  "ratio.simplify": {
    name: "Simplifying Ratios",
    description: "Expressing ratios in their simplest equivalent form",
    prerequisites: [],
  },
  "ratio.unitary": {
    name: "Unitary Ratio Methods",
    description: "Finding the value of one part to solve proportions",
    prerequisites: ["ratio.sharing"],
  },
};

// In-memory store for learner_skill_state: key `${student_id}:${skill_id}`
const learnerSkillStates = new Map();

// In-memory history of attempts per student & skill for conflict calculation
const studentSkillAttemptHistories = new Map();

// Store rollup timestamps per student
const studentRollupTimestamps = new Map();

export const FORBIDDEN_WORDS = ["weak", "failing", "low ability"];
export const FORBIDDEN_COMPARISONS = [
  "better than",
  "worse than",
  "percentile",
  "leaderboard",
  "rank",
  "average student",
  "other students",
  "cohort average",
  "class ranking",
  "top student",
  "bottom student",
];

/**
 * Validates that any text or object in the dashboard complies with Criterion 3:
 * Does not say "weak", "failing", "low ability", and does not compare with others.
 */
export function validateDashboardLanguage(target) {
  const violations = [];

  function scan(val, path = "") {
    if (typeof val === "string") {
      const lower = val.toLowerCase();
      for (const word of FORBIDDEN_WORDS) {
        // Use word boundary to avoid false positives (e.g. weekly)
        const regex = new RegExp(`\\b${word}\\b`, "i");
        if (regex.test(lower)) {
          violations.push({ path, type: "forbidden_word", match: word, text: val });
        }
      }
      for (const comp of FORBIDDEN_COMPARISONS) {
        if (lower.includes(comp)) {
          violations.push({ path, type: "forbidden_comparison", match: comp, text: val });
        }
      }
    } else if (Array.isArray(val)) {
      val.forEach((item, index) => scan(item, `${path}[${index}]`));
    } else if (val && typeof val === "object") {
      for (const [k, v] of Object.entries(val)) {
        scan(v, path ? `${path}.${k}` : k);
      }
    }
  }

  scan(target);
  return {
    valid: violations.length === 0,
    violations,
  };
}

/**
 * Get or initialize learner_skill_state
 */
export function getOrCreateSkillState(studentId, skillId) {
  const key = `${studentId}:${skillId}`;
  if (!learnerSkillStates.has(key)) {
    const initialState = {
      student_id: studentId,
      skill_id: skillId,
      mastery_estimate: 0.0,
      mastery_confidence: 0.0,
      recent_accuracy: 0.0,
      median_response_seconds: 30,
      attempt_count: 0,
      independent_success_rate: 0.0,
      hint_dependency_profile: { level0: 0, level1_3: 0, level4_5: 0 },
      misconception_distribution: {},
      transfer_success_rate: 0.0,
      recommended_next_skill: skillId,
      last_updated_at: new Date().toISOString(),
      rollup_at: studentRollupTimestamps.get(studentId) || null,
    };
    learnerSkillStates.set(key, initialState);
  }
  return learnerSkillStates.get(key);
}

/**
 * Updates learner model on a turn according to STU-16 rules (SPEC §2.5, Decision #21)
 */
export function updateLearnerModel(studentId, skillId, turnOutcome) {
  const state = getOrCreateSkillState(studentId, skillId);
  const historyKey = `${studentId}:${skillId}`;
  if (!studentSkillAttemptHistories.has(historyKey)) {
    studentSkillAttemptHistories.set(historyKey, []);
  }
  const history = studentSkillAttemptHistories.get(historyKey);

  const {
    is_correct,
    hint_level = 0,
    is_transfer = false,
    transfer_outcome = null,
    is_counted = true,
  } = turnOutcome;

  if (is_counted) {
    history.push({
      status: is_correct ? "correct" : "incorrect",
      hint_level,
      is_transfer,
      timestamp: new Date().toISOString(),
    });
    state.attempt_count += 1;
  }

  // Conflict rule: among the last 3 counted attempts on the skill,
  // at least one correct and at least one incorrect/partially_correct -> confidence - 0.10, floor 0
  const recent3 = history.slice(-3);
  if (recent3.length >= 2) {
    const hasCorrect = recent3.some((a) => a.status === "correct");
    const hasIncorrect = recent3.some((a) => a.status === "incorrect");
    if (hasCorrect && hasIncorrect) {
      state.mastery_confidence = Math.max(0.0, Number((state.mastery_confidence - 0.10).toFixed(2)));
    }
  }

  // Mastery deltas apply to a counted success on original or transfer item (D-15)
  if (is_correct) {
    if (hint_level === 0) {
      state.mastery_estimate = Math.min(1.0, Number((state.mastery_estimate + 0.15).toFixed(2)));
    } else if (hint_level >= 1 && hint_level <= 3) {
      state.mastery_estimate = Math.min(1.0, Number((state.mastery_estimate + 0.05).toFixed(2)));
    }
    // Completion at Level 4 or 5: no increase
  }

  // Successful transfer raises confidence by +0.20
  if (is_transfer && transfer_outcome === "correct") {
    state.mastery_confidence = Math.min(1.0, Number((state.mastery_confidence + 0.20).toFixed(2)));
  }

  state.last_updated_at = new Date().toISOString();
  return { ...state };
}

/**
 * Recomputes hourly rollup aggregates for a student
 */
export function runLearnerRollup(studentId, sessions = [], options = {}) {
  const rollupTime = options.rollup_at || new Date().toISOString();
  studentRollupTimestamps.set(studentId, rollupTime);

  // Group student sessions by skill
  const skillSessions = new Map();
  for (const session of sessions) {
    if (session.student_id !== studentId) continue;
    const question = getQuestion(session.question_id);
    const skillId = question?.skill_id || "ratio.sharing";
    if (!skillSessions.has(skillId)) {
      skillSessions.set(skillId, []);
    }
    skillSessions.get(skillId).push(session);
  }

  for (const [skillId, sList] of skillSessions.entries()) {
    const state = getOrCreateSkillState(studentId, skillId);
    let totalAttempts = 0;
    let correctAttempts = 0;
    let independentSuccessCount = 0;
    let l0Count = 0;
    let l1_3Count = 0;
    let l4_5Count = 0;
    let transferSuccessCount = 0;
    let transferCount = 0;
    const misconceptionCounts = {};

    for (const s of sList) {
      const attempts = s.attempts || [];
      totalAttempts += attempts.length;
      correctAttempts += attempts.filter((a) => a.verdict === "correct").length;

      // Independent success: succeeded at hint level 0
      if (s.state === "completed" || s.state === "reflection" || s.state === "transfer_offered") {
        if (s.hint_level === 0) {
          independentSuccessCount += 1;
        }
      }

      attempts.forEach((a) => {
        const lvl = a.hint_level ?? 0;
        if (lvl === 0) l0Count += 1;
        else if (lvl >= 1 && lvl <= 3) l1_3Count += 1;
        else l4_5Count += 1;
      });

      if (s.transfer_outcome) {
        transferCount += 1;
        if (s.transfer_outcome === "correct") {
          transferSuccessCount += 1;
        }
      }

      (s.misconception_events || []).forEach((ev) => {
        if (ev.code) {
          misconceptionCounts[ev.code] = (misconceptionCounts[ev.code] || 0) + 1;
        }
      });
    }

    state.attempt_count = totalAttempts;
    state.recent_accuracy = totalAttempts > 0 ? Number((correctAttempts / totalAttempts).toFixed(2)) : 0.0;
    state.independent_success_rate = sList.length > 0 ? Number((independentSuccessCount / sList.length).toFixed(2)) : 0.0;
    state.hint_dependency_profile = {
      level0: l0Count,
      level1_3: l1_3Count,
      level4_5: l4_5Count,
    };
    state.misconception_distribution = misconceptionCounts;
    state.transfer_success_rate = transferCount > 0 ? Number((transferSuccessCount / transferCount).toFixed(2)) : 0.0;
    state.rollup_at = rollupTime;
  }

  return rollupTime;
}

/**
 * Practice Planner (SV-02): Recommend next practice item deterministically along skill graph
 */
export function recommendNextPractice(studentId, completedQuestionIds = []) {
  const publishedQuestions = listQuestions();
  if (publishedQuestions.length === 0) {
    const fallback = getQuestion("ratio_share_001");
    return {
      question_id: fallback?.question_id || "ratio_share_001",
      title: fallback?.title || "Sharing an amount in a given ratio",
      stem: fallback?.stem || "Share $60 between Leo and Maya in the ratio 2 : 3.",
      skill_id: fallback?.skill_id || "ratio.sharing",
      reason: "Start foundational practice in ratio problem solving",
    };
  }

  // Find first uncompleted published question
  const nextUncompleted = publishedQuestions.find((q) => !completedQuestionIds.includes(q.question_id));
  const selected = nextUncompleted || publishedQuestions[0];
  const fullQ = getQuestion(selected.question_id) || selected;

  return {
    question_id: fullQ.question_id,
    title: fullQ.title,
    stem: fullQ.stem,
    skill_id: fullQ.skill_id,
    reason: nextUncompleted
      ? "Recommended next question based on your curriculum progress"
      : "Strengthen and solidify your practice with an additional question",
  };
}

/**
 * Generate StudentDashboard payload adhering to SPEC §3.3 / WF-15 and STU-07 ACs
 */
export function buildStudentDashboard(studentId, allSessions = [], options = {}) {
  // Filter sessions strictly to the caller student (AC5)
  const studentSessions = allSessions.filter((s) => (s.student_id || "student_default") === studentId);

  // Check completed sessions
  const completedSessions = studentSessions.filter(
    (s) => s.state === "completed" || s.state === "reflection" || s.state === "transfer_offered" || s.state === "transfer_active"
  );

  const fallbackFirstQ = getQuestion("ratio_share_001");
  const firstQuestion = {
    question_id: fallbackFirstQ?.question_id || "ratio_share_001",
    title: fallbackFirstQ?.title || "Sharing an amount in a given ratio",
    stem: fallbackFirstQ?.stem || "Share $60 between Leo and Maya in the ratio 2 : 3.",
    skill_id: fallbackFirstQ?.skill_id || "ratio.sharing",
  };

  const completedQuestionIds = studentSessions.map((s) => s.question_id);
  const nextPractice = recommendNextPractice(studentId, completedQuestionIds);

  const isEmpty = completedSessions.length === 0;

  // Recent sessions: include latest sessions regardless of whether rollup has run (AC2)
  const recentSessions = [...studentSessions]
    .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
    .slice(0, 10)
    .map((s) => {
      const q = getQuestion(s.question_id);
      return {
        session_id: s.id,
        question_id: s.question_id,
        question_title: q?.title || s.question_id,
        stem: q?.stem || "",
        skill_id: q?.skill_id || "ratio.sharing",
        state: s.state,
        attempt_count: s.attempt_count || 0,
        hint_level: s.hint_level || 0,
        transfer_outcome: s.transfer_outcome || null,
        created_at: s.created_at,
        completed_at: s.completed_at || s.created_at,
      };
    });

  // Current skills
  const skillsMap = new Map();
  for (const [key, state] of learnerSkillStates.entries()) {
    if (key.startsWith(`${studentId}:`)) {
      const meta = SKILL_METADATA[state.skill_id] || { name: state.skill_id, description: "" };
      let status = "Practising";
      if (state.mastery_estimate >= 0.8) {
        status = "Proficient";
      } else if (state.mastery_estimate >= 0.4) {
        status = "Developing";
      } else {
        status = "Exploring";
      }

      skillsMap.set(state.skill_id, {
        skill_id: state.skill_id,
        skill_name: meta.name,
        description: meta.description,
        mastery_estimate: state.mastery_estimate,
        mastery_confidence: state.mastery_confidence,
        status, // Non-shaming, positive growth status
        attempt_count: state.attempt_count,
        last_practised_at: state.last_updated_at,
      });
    }
  }

  // If no skills initialized yet, populate default
  if (skillsMap.size === 0) {
    for (const [sId, meta] of Object.entries(SKILL_METADATA)) {
      skillsMap.set(sId, {
        skill_id: sId,
        skill_name: meta.name,
        description: meta.description,
        mastery_estimate: 0.0,
        mastery_confidence: 0.0,
        status: "Exploring",
        attempt_count: 0,
        last_practised_at: null,
      });
    }
  }

  const currentSkills = Array.from(skillsMap.values());

  // Strengths: skills with higher mastery / confidence (encouraging language)
  const strengths = currentSkills
    .filter((s) => s.mastery_estimate >= 0.5 || s.mastery_confidence >= 0.4)
    .map((s) => ({
      skill_id: s.skill_id,
      skill_name: s.skill_name,
      summary: `Demonstrating solid understanding in ${s.skill_name.toLowerCase()}`,
      mastery: s.mastery_estimate,
    }));

  // If no high mastery yet, show growth potential
  if (strengths.length === 0 && !isEmpty) {
    strengths.push({
      skill_id: currentSkills[0].skill_id,
      skill_name: currentSkills[0].skill_name,
      summary: `Active practice and engagement in ${currentSkills[0].skill_name.toLowerCase()}`,
      mastery: currentSkills[0].mastery_estimate,
    });
  }

  // Next focus areas: encouraging recommendations (never using "weak", "failing", "low ability")
  const nextFocus = currentSkills
    .filter((s) => s.mastery_estimate < 0.8)
    .slice(0, 2)
    .map((s) => ({
      skill_id: s.skill_id,
      skill_name: s.skill_name,
      summary: `Ready for further practice in ${s.skill_name.toLowerCase()}`,
      recommended_action: `Practise additional items to build fluency in ${s.skill_name.toLowerCase()}`,
    }));

  // Independent success rate
  const solvedCount = completedSessions.length;
  const independentCount = completedSessions.filter((s) => s.hint_level === 0).length;
  const independentSuccessRate = solvedCount > 0 ? Number((independentCount / solvedCount).toFixed(2)) : 0.0;

  // Hint trend
  const hintTrend = recentSessions.map((s) => ({
    session_id: s.session_id,
    question_id: s.question_id,
    hint_level: s.hint_level,
    created_at: s.created_at,
  }));

  // Transfer results
  const transferResults = recentSessions
    .filter((s) => s.transfer_outcome !== null)
    .map((s) => ({
      session_id: s.session_id,
      question_id: s.question_id,
      outcome: s.transfer_outcome,
      created_at: s.created_at,
    }));

  // Rollup timestamp: shows when the background rollup last executed (AC2)
  const rollupAt = studentRollupTimestamps.get(studentId) || options.rollup_at || new Date().toISOString();

  const dashboard = {
    student_id: studentId,
    empty_state: isEmpty,
    first_question: firstQuestion,
    recent_sessions: recentSessions,
    current_skills: currentSkills,
    strengths,
    next_focus: nextFocus,
    independent_success_rate: independentSuccessRate,
    hint_trend: hintTrend,
    transfer_results: transferResults,
    next_practice: nextPractice,
    rollup_at: rollupAt,
  };

  // Verify language invariant: ensure no forbidden words or peer comparisons (AC3)
  const languageCheck = validateDashboardLanguage(dashboard);
  if (!languageCheck.valid) {
    throw new Error(`Dashboard language violation: ${JSON.stringify(languageCheck.violations)}`);
  }

  return dashboard;
}

/**
 * Resets learner store (useful for clean test states)
 */
export function resetLearnerStore() {
  learnerSkillStates.clear();
  studentSkillAttemptHistories.clear();
  studentRollupTimestamps.clear();
}
