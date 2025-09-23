import { Glob } from "bun";
import path from "path";
import { fileURLToPath } from "url";
import { GraphRunner, type GraphRunnerConfig } from "./graph-writer";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DOCS_DIR = path.resolve(__dirname, "docs");

// Configuration from environment variables
const config: Omit<GraphRunnerConfig, "chunksPath" | "metadataPath"> = {
  graphitiUrl: process.env.GRAPHITI_URL || "http://localhost:8000",
  delayBetweenChunks: parseInt(process.env.DELAY_BETWEEN_CHUNKS || "200", 10),
  concurrency: 1, // Keep sequential to avoid overwhelming Graphiti
  enabled: process.env.ENABLE_GRAPHITI !== "false", // Default to enabled
  maxRetries: parseInt(process.env.MAX_RETRIES || "3", 10),
  batchSize: parseInt(process.env.BATCH_SIZE || "10", 10),
};

console.log(`🚀 Starting Graphiti fact writing process`);
console.log(`📁 Scanning directory: ${DOCS_DIR}`);
console.log(`🌐 Graphiti URL: ${config.graphitiUrl}`);
console.log(`⏱️  Delay between chunks: ${config.delayBetweenChunks}ms`);
console.log(`🔧 Enabled: ${config.enabled}`);
console.log(`🔄 Max retries: ${config.maxRetries}`);

// Find all processed document directories (those containing chunks.jsonl)
const processedDirs: string[] = [];

for await (const entry of new Glob("**/chunks.jsonl").scan(DOCS_DIR)) {
  const dirPath = path.dirname(path.join(DOCS_DIR, entry));
  processedDirs.push(dirPath);
}

if (processedDirs.length === 0) {
  console.log(`📄 No processed documents found in ${DOCS_DIR}`);
  console.log(
    `💡 Run the fact extraction process first: bun run src/extract-facts.ts`
  );
  process.exit(0);
}

console.log(`\n📊 Found ${processedDirs.length} processed document(s):`);
processedDirs.forEach((dir, i) => {
  const dirName = path.basename(dir);
  console.log(`   ${i + 1}. ${dirName}`);
});

let totalChunksProcessed = 0;
let totalEpisodesSent = 0;
let totalErrors: string[] = [];

// Process each document directory
for (const dirPath of processedDirs) {
  const dirName = path.basename(dirPath);
  const chunksPath = path.join(dirPath, "chunks.jsonl");
  const metadataPath = path.join(dirPath, "metadata.json");

  console.log(`\n📄 Processing document: ${dirName}`);
  console.log(`   📁 Chunks: ${chunksPath}`);
  console.log(`   📄 Metadata: ${metadataPath}`);

  const runner = new GraphRunner({
    ...config,
    chunksPath,
    metadataPath,
  });

  try {
    // Check if files exist
    const chunksFile = Bun.file(chunksPath);
    const metadataFile = Bun.file(metadataPath);

    if (!(await chunksFile.exists())) {
      console.error(`   ❌ Chunks file not found: ${chunksPath}`);
      continue;
    }

    if (!(await metadataFile.exists())) {
      console.error(`   ❌ Metadata file not found: ${metadataPath}`);
      continue;
    }

    // Process the document
    const result = await runner.run();

    console.log(`   ✅ Completed ${dirName}:`);
    console.log(`      Chunks processed: ${result.chunksProcessed}`);
    console.log(`      Episodes sent: ${result.episodesSent}`);
    console.log(`      Errors: ${result.errors.length}`);

    if (result.errors.length > 0) {
      console.log(`   ⚠️  Errors in ${dirName}:`);
      result.errors.forEach((error, i) => {
        console.log(`      ${i + 1}. ${error}`);
      });
    }

    // Accumulate totals
    totalChunksProcessed += result.chunksProcessed;
    totalEpisodesSent += result.episodesSent;
    totalErrors.push(...result.errors.map((err) => `${dirName}: ${err}`));
  } catch (error) {
    const errorMsg = `Failed to process ${dirName}: ${error}`;
    console.error(`   ❌ ${errorMsg}`);
    totalErrors.push(errorMsg);
  }

  // Add a small delay between documents to be extra gentle on the server
  if (processedDirs.indexOf(dirPath) < processedDirs.length - 1) {
    console.log(`   ⏸️  Pausing before next document...`);
    await new Promise((resolve) => setTimeout(resolve, 1000)); // 1 second between documents
  }
}

// Final summary
console.log(`\n📊 Final Summary:`);
console.log(`   Documents processed: ${processedDirs.length}`);
console.log(`   Total chunks processed: ${totalChunksProcessed}`);
console.log(`   Total episodes sent: ${totalEpisodesSent}`);
console.log(`   Total errors: ${totalErrors.length}`);

if (totalErrors.length > 0) {
  console.log(`\n❌ Errors encountered:`);
  totalErrors.forEach((error, i) => {
    console.log(`   ${i + 1}. ${error}`);
  });
  process.exit(1);
} else {
  console.log(
    `\n🎉 Successfully processed all documents and sent ${totalEpisodesSent} episodes to Graphiti!`
  );
}
