import { createCoreRepositoryOperations } from "../../shared/repository";
import { ISourceRepository } from "./source.domain";
import { SourceTransaction } from "./source.transaction";

const baseRepository = createCoreRepositoryOperations("sources");

export const SourceRepository: ISourceRepository = {
  ...baseRepository,
  startTransaction: async (ctx, id) => new SourceTransaction(ctx).start(id),
};
