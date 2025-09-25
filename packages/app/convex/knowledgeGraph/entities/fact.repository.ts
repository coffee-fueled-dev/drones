import { createCoreRepositoryOperations } from "../../shared/repository";
import { Id } from "../../_generated/dataModel";
import { MutationCtx } from "../../_generated/server";
import { IRepository } from "../../shared/repository";
import { IFactTransaction } from "./fact.transaction";
import { FactTransaction } from "./fact.transaction";

export interface IFactRepository extends IRepository<"facts"> {
  startTransaction(
    ctx: MutationCtx,
    id: Id<"facts">
  ): Promise<IFactTransaction>;
}

const baseRepository = createCoreRepositoryOperations("facts");

export const FactRepository: IFactRepository = {
  ...baseRepository,
  startTransaction: async (ctx, id) => new FactTransaction(ctx).start(id),
};
