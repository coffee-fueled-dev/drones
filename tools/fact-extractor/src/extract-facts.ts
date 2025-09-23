import { Glob } from "bun";
import path from "path";
import { fileURLToPath } from "url";
import { Runner, type RunnerConfig } from "./document-processor/runner";

const DOCUMENT_PATH = "2025-14992_clean.txt";
const DOCUMENT_DESCRIPTION =
  "Notice of Proposed Rulemaking for Beyond Visual Line of Sight operations of Unmanned Aircraft Systems, focusing on performance-based regulations for low-altitude UAS operations.";

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
  description: DOCUMENT_DESCRIPTION,
};

const runner = new Runner(config);

const resolved = path.join(DOCS_DIR, DOCUMENT_PATH);
const file = Bun.file(resolved);

try {
  await runner.processFile(file);
} catch (error) {
  console.error(`❌ Failed to process ${DOCUMENT_PATH}:`, error);
  process.exit(1);
}
