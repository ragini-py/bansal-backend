import { z } from "zod";
import { ROLES } from "../../constants/roles.js";

// Matches the frontend's updateUser(id, patch: Partial<User>) — AdminPage's
// (new) Customers tab only ever changes role and/or status.
export const updateUserSchema = z
  .object({
    role: z.enum(ROLES),
    status: z.enum(["active", "blocked"]),
  })
  .partial();
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
