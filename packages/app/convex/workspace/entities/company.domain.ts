import { WithoutSystemFields } from "convex/server";
import { Infer, v } from "convex/values";
import { SystemFields } from "../../shared/systemFields";

export const CompanySchema = v.object({
  ...SystemFields("companies"),
  name: v.optional(v.string()),
  email: v.string(),
  workosOrganizationId: v.string(),
  threads: v.array(v.string()),
});

export type Company = Infer<typeof CompanySchema>;
export type NewCompany = WithoutSystemFields<Company>;
