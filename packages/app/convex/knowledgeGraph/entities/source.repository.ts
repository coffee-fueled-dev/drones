import {
  createCoreRepositoryOperations,
  IRepository,
} from "../../shared/repository";
import { SourceTransaction } from "./source.transaction";
import { MutationCtx } from "../../_generated/server";
import { Id } from "../../_generated/dataModel";
import { ISourceTransaction } from "./source.transaction";

export interface ISourceRepository extends IRepository<"sources"> {
  startTransaction(
    ctx: MutationCtx,
    id: Id<"sources">
  ): Promise<ISourceTransaction>;
}

const baseRepository = createCoreRepositoryOperations("sources");

export const SourceRepository: ISourceRepository = {
  ...baseRepository,
  startTransaction: async (ctx, id) => new SourceTransaction(ctx).start(id),
};
