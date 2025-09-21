import OpenAI from "openai";

export class FileAgent {
  readonly _openai: OpenAI;
  _conversation: OpenAI.Conversations.Conversation | undefined;

  constructor() {
    this._openai = new OpenAI();
  }

  start = async (file: Bun.BunFile) => {
    if (this._conversation !== undefined) return this;
    this._conversation = await this._openai.conversations.create({
      metadata: {
        fileName: file.name ?? "unknown file",
      },
    });

    return this;
  };
}
