import { Infer, v } from "convex/values";
import { SystemFields } from "../shared/systemFields";
import { WithoutSystemFields } from "convex/server";
import { CoreRepositoryOperations } from "../shared/repository";

export const PilotProfileSchema = v.object({
  ...SystemFields("pilotProfiles"),
  fullName: v.string(),
  email: v.string(),
  phone: v.string(),
  address: v.string(),
  location: v.id("locations"),
  jobs: v.array(v.id("jobs")),
});

export type PilotProfile = Infer<typeof PilotProfileSchema>;
export type NewPilotProfile = WithoutSystemFields<PilotProfile>;

export interface PilotProfileRepository
  extends CoreRepositoryOperations<"pilotProfiles"> {}
