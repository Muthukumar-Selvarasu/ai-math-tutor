import cannedResponses from "../content/safety/canned_responses.json";

export function getCannedResponse(key) {
  const item = cannedResponses[key];
  if (!item) {
    throw new Error(`Unknown canned response key: ${key}`);
  }
  return item.text;
}

export function getAllCannedResponses() {
  return cannedResponses;
}
