import { WithoutSystemFields } from "convex/server";
import { Infer, v } from "convex/values";
import { SystemFields } from "../shared/systemFields";
import { CoreRepositoryOperations } from "../shared/repository";

export const UserSchema = v.object({
  ...SystemFields("users"),
  email: v.string(),
  role: v.union(v.literal("admin"), v.literal("operator"), v.literal("viewer")),
  operatorProfile: v.optional(v.id("operatorProfiles")),
});

export type User = Infer<typeof UserSchema>;
export type NewUser = WithoutSystemFields<User>;

export interface UserRepository extends CoreRepositoryOperations<"users"> {}
