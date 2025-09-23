import { Glob } from "bun";
import path from "path";
import { fileURLToPath } from "url";
import { Runner, type RunnerConfig } from "./document-processor/runner";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DOCS_DIR = path.resolve(__dirname, "..", "docs");

console.log(`🚀 Starting fact extraction process`);
console.log(`📁 Scanning directory: ${DOCS_DIR}`);

// Find all text files in the docs directory
const textFiles: string[] = [];

for await (const entry of new Glob("**/*.txt").scan(DOCS_DIR)) {
  const filePath = path.join(DOCS_DIR, entry);
  textFiles.push(filePath);
}

if (textFiles.length === 0) {
  console.log(`📄 No text files found in ${DOCS_DIR}`);
  console.log(`💡 Add .txt files to the docs directory to process them`);
  process.exit(0);
}

console.log(`\n📊 Found ${textFiles.length} text file(s):`);
textFiles.forEach((file, i) => {
  const fileName = path.basename(file);
  console.log(`   ${i + 1}. ${fileName}`);
});

// Configuration from environment variables
const baseConfig: Omit<RunnerConfig, "description"> = {
  chunkSizeThreshold: 1500, // Reduced from 3000 to prevent timeouts
  enableGraphiti: process.env.ENABLE_GRAPHITI === "true",
  extractionTimeoutMs: parseInt(process.env.EXTRACTION_TIMEOUT || "45000", 10), // Increased to 45s
  resumeFromPosition:
    parseInt(process.env.RESUME_FROM_POSITION || "0", 10) || undefined,
};

let totalProcessed = 0;
let totalErrors = 0;

// Process each text file
for (const filePath of textFiles) {
  const fileName = path.basename(filePath);
  console.log(`\n📄 Processing file: ${fileName}`);

  // Generate description based on filename or use default
  let description: string;
  if (fileName.includes("2025-14992")) {
    description =
      "Notice of Proposed Rulemaking for Beyond Visual Line of Sight operations of Unmanned Aircraft Systems, focusing on performance-based regulations for low-altitude UAS operations.";
  } else {
    description = `Document processing for ${fileName}`;
  }

  const config: RunnerConfig = {
    ...baseConfig,
    description,
  };

  const runner = new Runner(config);
  const file = Bun.file(filePath);

  try {
    // Check if file exists
    if (!(await file.exists())) {
      console.error(`   ❌ File not found: ${filePath}`);
      totalErrors++;
      continue;
    }

    await runner.processFile(file);
    console.log(`   ✅ Completed processing ${fileName}`);
    totalProcessed++;
  } catch (error) {
    console.error(`   ❌ Failed to process ${fileName}:`, error);
    totalErrors++;
  }

  // Add a small delay between files to be gentle on resources
  if (textFiles.indexOf(filePath) < textFiles.length - 1) {
    console.log(`   ⏸️  Pausing before next file...`);
    await new Promise((resolve) => setTimeout(resolve, 1000)); // 1 second between files
  }
}

// Final summary
console.log(`\n📊 Final Summary:`);
console.log(`   Files processed: ${totalProcessed}`);
console.log(`   Errors: ${totalErrors}`);

if (totalErrors > 0) {
  console.log(
    `\n⚠️  Some files had errors. Check the output above for details.`
  );
  process.exit(1);
} else {
  console.log(`\n🎉 Successfully processed all ${totalProcessed} files!`);
}
