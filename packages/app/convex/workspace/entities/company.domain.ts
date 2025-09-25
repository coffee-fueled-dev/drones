import { WithoutSystemFields } from "convex/server";
import { Infer, v } from "convex/values";
import { SystemFields } from "../../shared/systemFields";
import { IRepository } from "../../shared/repository";
import { MutationCtx, QueryCtx } from "../../_generated/server";
import { Id } from "../../_generated/dataModel";
import { ITransaction } from "../../shared/transaction";

export const CompanySchema = v.object({
  ...SystemFields("companies"),
  name: v.optional(v.string()),
  email: v.string(),
  workosOrganizationId: v.string(),
  threads: v.array(v.string()),
});

export type Company = Infer<typeof CompanySchema>;
export type NewCompany = WithoutSystemFields<Company>;

export interface ICompanyRepository extends IRepository<"companies"> {
  find(
    ctx: QueryCtx,
    selector: {
      id?: Id<"companies">;
      workosOrganizationId?: string;
    }
  ): Promise<Company | null>;
  upsert(ctx: MutationCtx, CompanyData: NewCompany): Promise<Id<"companies">>;
  startTransaction(
    ctx: MutationCtx,
    id: Id<"companies">
  ): Promise<ICompanyTransaction>;
}

export interface ICompanyTransaction extends ITransaction<"companies"> {
  updateEmail(email: Company["email"]): this;
  updateName(name: Company["name"]): this;
  addThread(threadId: Company["threads"][number]): this;
  removeThread(threadId: Company["threads"][number]): this;
}
