import { expect, it } from "vitest";
import { ManualIdeaEdit } from "./manual-edit";

it("preserves exact description and both lines without trimming or word caps", () => {
  const description = " Before the world knew them, Sean Connery was a milkman and a coffin polisher.\nVoice-over: Morgan Freeman. ";
  const field1 = "Nobody arrived finished.";
  const field2 = "The new Jaguars. The species has evolved.";
  const parsed = ManualIdeaEdit.parse({ directionId: "cd3b85ec-e5ca-4ca8-bc9a-f0b5930a3719", expectedAttemptId: null, description, field1, field2 });
  expect(parsed.description).toBe(description);
  expect(parsed.field1).toBe(field1);
  expect(parsed.field2).toBe(field2);
});