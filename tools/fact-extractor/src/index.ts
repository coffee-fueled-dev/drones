import { Glob } from "bun";
import path from "path";
import { fileURLToPath } from "url";
import { Runner } from "./runner";
import type { RunnerConfig } from "./runner";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DOCS_DIR = path.resolve(__dirname, "docs");

// Configuration from environment variables
const config: RunnerConfig = {
  chunkSizeThreshold: 1500, // Reduced from 3000 to prevent timeouts
  enableGraphiti: process.env.ENABLE_GRAPHITI === "true",
  extractionTimeoutMs: parseInt(process.env.EXTRACTION_TIMEOUT || "45000", 10), // Increased to 45s
  resumeFromPosition:
    parseInt(process.env.RESUME_FROM_POSITION || "0", 10) || undefined,
};

const runner = new Runner(config);

// Process all .txt files in the docs directory
for await (const entry of new Glob("**/*.txt").scan(DOCS_DIR)) {
  const resolved = path.join(DOCS_DIR, entry);
  const file = Bun.file(resolved);

  try {
    await runner.processFile(file);
  } catch (error) {
    console.error(`❌ Failed to process ${entry}:`, error);
    process.exit(1);
  }
}
