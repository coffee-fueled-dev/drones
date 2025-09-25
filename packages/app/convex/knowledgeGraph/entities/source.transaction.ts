import { ITransaction, Transaction } from "../../shared/transaction";
import { Source } from "./source.domain";

export interface ISourceTransaction extends ITransaction<"sources"> {
  addStatus(status: Source["statuses"][number]): this;
  setCompleted(timestamp?: number): this;
  setError(error: string, timestamp?: number): this;
  updateName(name: string): this;
  updateDescription(description: string): this;
}

export class SourceTransaction
  extends Transaction<"sources">
  implements ISourceTransaction
{
  addStatus = (status: Source["statuses"][number]): this =>
    this._update((source) => ({
      ...source,
      statuses: [...source.statuses, status],
    }));

  setCompleted = (timestamp: number = Date.now()): this =>
    this._update((source) => ({
      ...source,
      completedAt: timestamp,
      statuses: [...source.statuses, { label: "completed", timestamp }],
    }));

  setError = (error: string, timestamp: number = Date.now()): this =>
    this._update((source) => ({
      ...source,
      error,
      statuses: [...source.statuses, { label: "error", timestamp }],
    }));

  updateName = (name: string): this =>
    this._update((source) => ({ ...source, name }));

  updateDescription = (description: string): this =>
    this._update((source) => ({ ...source, description }));
}
