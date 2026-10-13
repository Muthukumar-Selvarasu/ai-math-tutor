import cannedResponses from "../content/safety/canned_responses.json";

export function getCannedResponse(key) {
  if (key === "emergency_maintenance") {
    return "The tutoring service is temporarily paused for maintenance. Please check back shortly.";
  }
  const item = cannedResponses[key];
  if (!item) {
    throw new Error(`Unknown canned response key: ${key}`);
  }
  return item.text;
}

export function getAllCannedResponses() {
  return cannedResponses;
}
