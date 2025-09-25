import { DocumentByName } from "convex/server";
import { DataModel, Id, TableNames } from "../_generated/dataModel";
import { MutationCtx } from "../_generated/server";

export interface ITransaction<TName extends TableNames> {
  _id: Id<TName> | undefined;
  _ctx: MutationCtx;
  _entity: DocumentByName<DataModel, TName> | undefined;
  _update(
    cb: (
      entity: DocumentByName<DataModel, TName>
    ) => DocumentByName<DataModel, TName>
  ): this;
  start(id: Id<TName>): Promise<this>;
  commit(): Promise<DocumentByName<DataModel, TName>>;
}

export class Transaction<TName extends TableNames>
  implements ITransaction<TName>
{
  _id: Id<TName> | undefined;
  _ctx: MutationCtx;
  _entity: DocumentByName<DataModel, TName> | undefined;

  constructor(ctx: MutationCtx) {
    this._ctx = ctx;
  }

  _update(
    cb: (
      entity: DocumentByName<DataModel, TName>
    ) => DocumentByName<DataModel, TName>
  ): this {
    if (!this._id || !this._entity)
      throw new Error("You must start a transaction before starting work");
    this._entity = cb(this._entity);
    return this;
  }

  async start(id: Id<TName>): Promise<this> {
    const entity = await this._ctx.db.get(id);
    if (!entity) throw new Error("Entity not found");
    this._id = id;
    this._entity = entity;
    return this;
  }

  async commit() {
    if (!this._id || !this._entity)
      throw new Error("You must start a transaction before committing it");

    await this._ctx.db.patch(this._id, {
      ...this._entity!,
      updatedAt: Date.now(),
    });

    return this._entity;
  }
}
