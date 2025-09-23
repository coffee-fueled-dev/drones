import OpenAI from "openai";

export class FileAgent {
  readonly _openai: OpenAI;
  _conversation: OpenAI.Conversations.Conversation | undefined;

  constructor() {
    this._openai = new OpenAI();
  }

  start = async (file: Bun.BunFile) => {
    // Stateless processing - no conversation needed
    return this;
  };
}
