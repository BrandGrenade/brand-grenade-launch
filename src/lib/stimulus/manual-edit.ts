import { z } from "zod";

export const ManualIdeaEdit = z.object({
  directionId: z.string().uuid(),
  expectedAttemptId: z.string().uuid().nullable(),
  description: z.string().refine((value) => value.trim().length > 0, "Description is required"),
  field1: z.string(),
  field2: z.string(),
});
export type ManualIdeaEditInput = z.infer<typeof ManualIdeaEdit>;