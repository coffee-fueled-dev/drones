import { WithoutSystemFields } from "convex/server";
import { Infer, v } from "convex/values";
import { SystemFields } from "../../shared/systemFields";

export const UserSchema = v.object({
  ...SystemFields("users"),
  name: v.optional(v.string()),
  email: v.string(),
  workosUserId: v.string(),
  threads: v.array(v.string()),
});

export type User = Infer<typeof UserSchema>;
export type NewUser = WithoutSystemFields<User>;
