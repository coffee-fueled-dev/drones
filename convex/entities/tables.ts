import { defineTable } from "convex/server";
import { withoutSystemFields } from "convex-helpers";
import { OperatorProfileSchema } from "./operator.domain";
import { LocationSchema } from "./location.domain";
import { JobSchema } from "./job.domain";
import { PilotProfileSchema } from "./pilot.domain";

export const sharedTables = {
  operatorProfiles: defineTable(
    withoutSystemFields(OperatorProfileSchema.fields)
  ).index("by_name", ["name"]),

  locations: defineTable(withoutSystemFields(LocationSchema.fields)).index(
    "by_name",
    ["name"]
  ),

  jobs: defineTable(withoutSystemFields(JobSchema.fields)).index("by_name", [
    "name",
  ]),

  pilotProfiles: defineTable(
    withoutSystemFields(PilotProfileSchema.fields)
  ).index("by_name", ["name"]),
};
