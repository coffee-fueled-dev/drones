import { createCoreRepositoryOperations } from "../../shared/repository";
import { IRepository } from "../../shared/repository";
import { MutationCtx } from "../../_generated/server";
import { Id } from "../../_generated/dataModel";
import { IChunkTransaction } from "./chunk.transaction";
import { ChunkTransaction } from "./chunk.transaction";

export interface IChunkRepository extends IRepository<"chunks"> {
  startTransaction(
    ctx: MutationCtx,
    id: Id<"chunks">
  ): Promise<IChunkTransaction>;
}

const baseRepository = createCoreRepositoryOperations("chunks");

export const ChunkRepository: IChunkRepository = {
  ...baseRepository,
  startTransaction: async (ctx, id) => new ChunkTransaction(ctx).start(id),
};
