import { ITransaction, Transaction } from "../../shared/transaction";
import { Chunk } from "./chunk.domain";
import { Id } from "../../_generated/dataModel";

export interface IChunkTransaction extends ITransaction<"chunks"> {
  addStatus(status: Chunk["statuses"][number]): this;
  setCompleted(timestamp?: Chunk["completedAt"]): this;
  setError(error: Chunk["error"], timestamp?: number): this;
  addFact(factId: Id<"facts">): this;
  setFacts(factIds: Id<"facts">[]): this;
  removeFact(factId: Id<"facts">): this;
  setContext(context: Chunk["context"]): this;
  setContent(content: Chunk["content"]): this;
}

export class ChunkTransaction
  extends Transaction<"chunks">
  implements IChunkTransaction
{
  addStatus = (status: Chunk["statuses"][number]): this =>
    this._update((chunk) => ({
      ...chunk,
      statuses: [...chunk.statuses, status],
    }));

  setCompleted = (timestamp: Chunk["completedAt"] = Date.now()): this =>
    this._update((chunk) => ({
      ...chunk,
      completedAt: timestamp,
      statuses: [...chunk.statuses, { label: "completed", timestamp }],
    }));

  setError = (error: Chunk["error"], timestamp: number = Date.now()): this =>
    this._update((chunk) => ({
      ...chunk,
      error,
      statuses: [...chunk.statuses, { label: "error", timestamp }],
    }));

  addFact = (factId: Id<"facts">): this =>
    this._update((chunk) => ({
      ...chunk,
      facts: [...(chunk.facts || []), factId],
    }));

  setFacts = (factIds: Id<"facts">[]): this =>
    this._update((chunk) => ({
      ...chunk,
      facts: factIds,
    }));

  removeFact = (factId: Id<"facts">): this =>
    this._update((chunk) => ({
      ...chunk,
      facts: (chunk.facts || []).filter((id) => id !== factId),
    }));

  setContent = (content: Chunk["content"]): this =>
    this._update((chunk) => ({ ...chunk, content }));

  setContext = (context: Chunk["context"]): this =>
    this._update((chunk) => ({ ...chunk, context }));
}
