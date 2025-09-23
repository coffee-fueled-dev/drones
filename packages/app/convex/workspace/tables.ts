import { defineTable } from "convex/server";
import { withoutSystemFields } from "convex-helpers";
import { UserSchema } from "./entities/user.domain";
import { CompanySchema } from "./entities/company";

export const userManagementTables = {
  users: defineTable(withoutSystemFields(UserSchema.fields))
    .index("by_name", ["name"])
    .index("by_email", ["email"])
    .index("by_workosUserId", ["workosUserId"]),

  companies: defineTable(withoutSystemFields(CompanySchema.fields))
    .index("by_name", ["name"])
    .index("by_email", ["email"])
    .index("by_workosOrganizationId", ["workosOrganizationId"]),
};
