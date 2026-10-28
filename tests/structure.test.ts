import { describe, it } from "vitest";

// Checks on data/structure/ and data/titles/. Not built yet: they need the
// versification decision and the first data. See docs/schema.md, "Checks".
describe("data", () => {
  it.todo("every verse of each book is in exactly one pericope");
  it.todo("every verse of each book is in exactly one segment");
  it.todo("every span is valid against the chosen versification");
  it.todo("keys are unique and match the key format");
  it.todo("no key released in an earlier tag is missing, moved or reused");
  it.todo("every key has a title in every language marked complete");
  it.todo("titles fit the length and script rules for their language");
});
