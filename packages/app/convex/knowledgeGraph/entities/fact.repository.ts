import { createCoreRepositoryOperations } from "../../shared/repository";
import { IFactRepository } from "./fact.domain";
import { FactTransaction } from "./fact.transaction";

const baseRepository = createCoreRepositoryOperations("facts");

export const FactRepository: IFactRepository = {
  ...baseRepository,
  startTransaction: async (ctx, id) => new FactTransaction(ctx).start(id),
};
