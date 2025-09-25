import { createCoreRepositoryOperations } from "../../shared/repository";
import { IChunkRepository } from "./chunk.domain";
import { ChunkTransaction } from "./chunk.transaction";

const baseRepository = createCoreRepositoryOperations("chunks");

export const ChunkRepository: IChunkRepository = {
  ...baseRepository,
  startTransaction: async (ctx, id) => new ChunkTransaction(ctx).start(id),
};
