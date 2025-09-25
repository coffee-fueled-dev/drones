import { createCoreRepositoryOperations } from "../../shared/repository";
import { IRepository } from "../../shared/repository";
import { MutationCtx } from "../../_generated/server";
import { Id } from "../../_generated/dataModel";
import { QueryCtx } from "../../_generated/server";
import { Company } from "./company.domain";
import { NewCompany } from "./company.domain";
import { ICompanyTransaction } from "./company.transaction";
import { CompanyTransaction } from "./company.transaction";

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

const baseRepository = createCoreRepositoryOperations("companies");

/**
 *  Transaction Example:
 *
 *  const company = await CompanyRepository.startTransaction(ctx, "123").then((tx) =>
 *    tx.addThread("123").updateEmail("test@test.com").commit()
 *  );
 */

export const CompanyRepository: ICompanyRepository = {
  ...baseRepository,

  startTransaction: async (ctx, id) => new CompanyTransaction(ctx).start(id),

  async find(ctx, { id, workosOrganizationId }) {
    if (!id && !workosOrganizationId) return null;

    if (id) {
      return await ctx.db.get(id);
    }

    if (workosOrganizationId) {
      return await ctx.db
        .query("companies")
        .withIndex("by_workosOrganizationId", (q) =>
          q.eq("workosOrganizationId", workosOrganizationId)
        )
        .first();
    }

    return null;
  },

  async upsert(ctx, companyData) {
    const existingCompany = await this.find(ctx, {
      workosOrganizationId: companyData.workosOrganizationId,
    });

    if (existingCompany) {
      // Update existing company
      await ctx.db.patch(existingCompany._id, {
        ...companyData,
        updatedAt: Date.now(),
      });
      return existingCompany._id;
    } else {
      // Create new company
      const newCompany = await ctx.db.insert("companies", {
        ...companyData,
        updatedAt: Date.now(),
      });
      return newCompany;
    }
  },
};
