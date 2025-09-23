import { WithoutSystemFields } from "convex/server";
import { Infer, v } from "convex/values";
import { SystemFields } from "../../shared/systemFields";
import { CoreRepositoryOperations } from "../../shared/repository";
import { MutationCtx, QueryCtx } from "../../_generated/server";
import { Id } from "../../_generated/dataModel";

export const CompanySchema = v.object({
  ...SystemFields("companies"),
  name: v.optional(v.string()),
  email: v.string(),
  workosOrganizationId: v.string(),
  threads: v.array(v.string()),
});

export type Company = Infer<typeof CompanySchema>;
export type NewCompany = WithoutSystemFields<Company>;

export interface ICompanyRepository
  extends CoreRepositoryOperations<"companies"> {
  findByExternalId(
    ctx: QueryCtx,
    workosCompanyId: string
  ): Promise<Company | null>;
  upsert(ctx: MutationCtx, CompanyData: NewCompany): Promise<Id<"companies">>;
}
