import fs from "fs";
import path from "path";

const QUESTION_DIRS = [
  path.join(process.cwd(), "content", "questions"),
  path.join(process.cwd(), "docs", "question-bank"),
];

function getAllJsonFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...getAllJsonFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith(".json")) {
      files.push(fullPath);
    }
  }
  return files;
}

export function listQuestions() {
  const seenIds = new Set();
  const questions = [];

  for (const dir of QUESTION_DIRS) {
    const files = getAllJsonFiles(dir);
    for (const filePath of files) {
      try {
        const content = fs.readFileSync(filePath, "utf8");
        const data = JSON.parse(content);
        if (data.question_id && !seenIds.has(data.question_id)) {
          seenIds.add(data.question_id);
          questions.push({
            question_id: data.question_id,
            version: data.version || 1,
            title: data.title,
            skill_id: data.skill_id,
            difficulty_band: data.difficulty?.band || "intermediate",
            stem: data.stem,
            publication_status: data.publication_status,
            validation_status: data.validation_status,
            flagged: data.flagged,
          });
        }
      } catch {
        // Ignore invalid files
      }
    }
  }

  return questions;
}

export function getQuestion(questionId) {
  for (const dir of QUESTION_DIRS) {
    const directPath = path.join(dir, `${questionId}.json`);
    if (fs.existsSync(directPath)) {
      try {
        const content = fs.readFileSync(directPath, "utf8");
        return JSON.parse(content);
      } catch {
        // continue
      }
    }

    const files = getAllJsonFiles(dir);
    for (const file of files) {
      try {
        const content = fs.readFileSync(file, "utf8");
        const data = JSON.parse(content);
        if (data.question_id === questionId) {
          return data;
        }
      } catch {
        // continue
      }
    }
  }

  return null;
}
