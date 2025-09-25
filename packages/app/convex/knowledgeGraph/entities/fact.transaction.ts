import { ITransaction, Transaction } from "../../shared/transaction";
import { Fact } from "./fact.domain";

export interface IFactTransaction extends ITransaction<"facts"> {
  addStatus(status: Fact["statuses"][number]): this;
  setCompleted(timestamp?: number): this;
  setError(error: string, timestamp?: number): this;
  updateSubject(subject: string): this;
  updatePredicate(predicate: string): this;
  updateObject(object: string): this;
  updateSource(source: string | null): this;
}

export class FactTransaction
  extends Transaction<"facts">
  implements IFactTransaction
{
  addStatus = (status: Fact["statuses"][number]): this =>
    this._update((fact) => ({
      ...fact,
      statuses: [...fact.statuses, status],
    }));

  setCompleted = (timestamp: number = Date.now()): this =>
    this._update((fact) => ({
      ...fact,
      completedAt: timestamp,
      statuses: [...fact.statuses, { label: "completed", timestamp }],
    }));

  setError = (error: string, timestamp: number = Date.now()): this =>
    this._update((fact) => ({
      ...fact,
      error,
      statuses: [...fact.statuses, { label: "error", timestamp }],
    }));

  updateSubject = (subject: string): this =>
    this._update((fact) => ({ ...fact, subject }));

  updatePredicate = (predicate: string): this =>
    this._update((fact) => ({ ...fact, predicate }));

  updateObject = (object: string): this =>
    this._update((fact) => ({ ...fact, object }));

  updateSource = (source: string | null): this =>
    this._update((fact) => ({ ...fact, source }));
}
