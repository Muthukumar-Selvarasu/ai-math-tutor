import fs from "fs";
import path from "path";

const QUESTION_BANK_DIR = path.join(process.cwd(), "docs", "question-bank");

export function listQuestions() {
  if (!fs.existsSync(QUESTION_BANK_DIR)) {
    return [];
  }

  const files = fs.readdirSync(QUESTION_BANK_DIR).filter((file) => file.endsWith(".json"));
  const questions = [];

  for (const file of files) {
    try {
      const content = fs.readFileSync(path.join(QUESTION_BANK_DIR, file), "utf8");
      const data = JSON.parse(content);
      questions.push({
        question_id: data.question_id,
        version: data.version || 1,
        title: data.title,
        skill_id: data.skill_id,
        difficulty_band: data.difficulty?.band || "intermediate",
        stem: data.stem,
      });
    } catch {
      // Ignore invalid files
    }
  }

  return questions;
}

export function getQuestion(questionId) {
  const filePath = path.join(QUESTION_BANK_DIR, `${questionId}.json`);
  if (!fs.existsSync(filePath)) {
    // Try scanning files if filename doesn't match exactly
    const files = fs.readdirSync(QUESTION_BANK_DIR).filter((file) => file.endsWith(".json"));
    for (const file of files) {
      try {
        const content = fs.readFileSync(path.join(QUESTION_BANK_DIR, file), "utf8");
        const data = JSON.parse(content);
        if (data.question_id === questionId) {
          return data;
        }
      } catch {
        // Skip
      }
    }
    return null;
  }

  try {
    const content = fs.readFileSync(filePath, "utf8");
    return JSON.parse(content);
  } catch {
    return null;
  }
}
