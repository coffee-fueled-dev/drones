import { createCoreRepositoryOperations } from "../../shared/repository";
import { IChunkRepository } from "./chunk.domain";

export const ChunkRepository: IChunkRepository =
  createCoreRepositoryOperations("chunks");
