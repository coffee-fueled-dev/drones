import { Transaction } from "../../shared/transaction";
import { Chunk, IChunkTransaction } from "./chunk.domain";
import { Id } from "../../_generated/dataModel";

export class ChunkTransaction
  extends Transaction<"chunks">
  implements IChunkTransaction
{
  addStatus = (status: Chunk["statuses"][number]): this =>
    this._update((chunk) => ({
      ...chunk,
      statuses: [...chunk.statuses, status],
    }));

  setCompleted = (timestamp: number = Date.now()): this =>
    this._update((chunk) => ({
      ...chunk,
      completedAt: timestamp,
      statuses: [...chunk.statuses, { label: "completed", timestamp }],
    }));

  setError = (error: string, timestamp: number = Date.now()): this =>
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

  removeFact = (factId: Id<"facts">): this =>
    this._update((chunk) => ({
      ...chunk,
      facts: (chunk.facts || []).filter((id) => id !== factId),
    }));

  updateContent = (content: string): this =>
    this._update((chunk) => ({ ...chunk, content }));
}
