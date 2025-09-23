import { WithoutSystemFields } from "convex/server";
import { Infer, v } from "convex/values";
import { SystemFields } from "../shared/systemFields";
import { CoreRepositoryOperations } from "../shared/repository";

export const OperatorProfileSchema = v.object({
  ...SystemFields("operatorProfiles"),
  website: v.string(),
  industry: v.string(),
  yearFounded: v.number(),
  employeeCount: v.number(),
  revenue: v.number(),
  jobs: v.array(v.id("jobs")),
  headquarters: v.id("locations"),
  legalAddress: v.id("locations"),
  billingAddress: v.id("locations"),
  threads: v.optional(v.array(v.string())),
});

export type OperatorProfile = Infer<typeof OperatorProfileSchema>;
export type NewOperatorProfile = WithoutSystemFields<OperatorProfile>;

export interface OperatorProfileRepository
  extends CoreRepositoryOperations<"operatorProfiles"> {}
