import path from "path";
import type { FactExtractionAgent } from "./agents/fact-extractor";

interface OutputData {
  metadata: {
    filename: string;
    filepath: string;
    processedAt: string;
    lastUpdated: string;
    chunkSizeThreshold: number;
  };
  globalContext: string[];
  facts: any[];
}

export class DocumentProcessor {
  private outputPath: string;
  private outputData: OutputData;

  constructor(
    private readonly factAgent: FactExtractionAgent,
    private readonly file: Bun.BunFile,
    private readonly chunkSizeThreshold: number = 2000
  ) {
    const filename = path.basename(file.name || "unknown.txt");
    const outputFilename = filename.replace(/\.[^/.]+$/, ".json");
    this.outputPath = path.join(path.dirname(file.name || "."), outputFilename);

    this.outputData = {
      metadata: {
        filename,
        filepath: file.name || "",
        processedAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        chunkSizeThreshold: this.chunkSizeThreshold,
      },
      globalContext: [],
      facts: [],
    };
  }

  async start() {
    await this.factAgent.start(this.file);
    await this.writeOutput();
  }

  /** Feed a paragraph; emits fact extraction when a semantic boundary is hit. */
  processChunk = async (para: string) => {
    await this.factAgent.extract(para);
    await this.updateOutput();
  };

  /** Update output file with latest facts and context */
  private async updateOutput() {
    this.outputData.globalContext = this.factAgent.context;
    this.outputData.facts = this.factAgent.getAllFacts();
    this.outputData.metadata.lastUpdated = new Date().toISOString();
    await this.writeOutput();
  }

  /** Write output data to JSON file */
  private async writeOutput() {
    await Bun.write(this.outputPath, JSON.stringify(this.outputData, null, 2));
  }

  /** Finish: flush remaining buffer, wait for facts to settle, return results. */
  finalize = async () => {
    await this.factAgent.waitForIdle();
    await this.updateOutput();
    return {
      context: this.factAgent.context,
      facts: this.factAgent.flushFacts(),
      outputPath: this.outputPath,
    };
  };
}
