#!/usr/bin/env bun

/**
 * Auto-resume wrapper for fact extraction
 * Automatically restarts the process when it times out and resumes from the last position
 */

import { spawn } from "child_process";
import path from "path";

const MAX_RETRIES = 50; // Maximum number of auto-resume attempts
const RETRY_DELAY = 2000; // 2 seconds between retries

async function runWithAutoResume() {
  let retryCount = 0;
  let lastResumePosition = 0;

  while (retryCount < MAX_RETRIES) {
    console.log(
      `\n🚀 Starting extraction attempt ${retryCount + 1}/${MAX_RETRIES}`
    );

    if (retryCount > 0) {
      console.log(`🔄 Auto-resuming from position ${lastResumePosition}`);
    }

    const env = {
      ...process.env,
      RESUME_FROM_POSITION: lastResumePosition.toString(),
    };

    const child = spawn("bun", ["run", "start"], {
      cwd: process.cwd(),
      env,
      stdio: "inherit",
    });

    const exitCode = await new Promise<number>((resolve) => {
      child.on("close", (code) => {
        resolve(code || 0);
      });

      child.on("error", (error) => {
        console.error(`❌ Process error: ${error.message}`);
        resolve(1);
      });
    });

    if (exitCode === 0) {
      console.log("✅ Extraction completed successfully!");
      return;
    }

    if (exitCode === 2 || exitCode === 1) {
      // Timeout termination (code 2) or error that might be timeout-related (code 1)
      console.log(
        `⏰ Process failed with exit code ${exitCode} - attempting auto-resume`
      );

      // Try to get the last position from metadata
      try {
        const newResumePosition = await getLastKnownPosition();
        if (newResumePosition > lastResumePosition) {
          lastResumePosition = newResumePosition;
          console.log(`📍 Updated resume position to ${lastResumePosition}`);
        } else {
          // If we can't get a new position, increment by a small amount to avoid infinite loops
          lastResumePosition += 1000;
          console.log(
            `📍 Incremented resume position to ${lastResumePosition}`
          );
        }
      } catch (error) {
        console.warn(`⚠️ Could not determine resume position: ${error}`);
        lastResumePosition += 1000;
      }

      retryCount++;

      if (retryCount < MAX_RETRIES) {
        console.log(`⏳ Waiting ${RETRY_DELAY}ms before retry...`);
        await sleep(RETRY_DELAY);
        continue;
      }
    } else {
      console.error(`❌ Process failed with exit code ${exitCode}`);
      return;
    }
  }

  console.error(`💥 Maximum retries (${MAX_RETRIES}) exceeded. Giving up.`);
  process.exit(1);
}

async function getLastKnownPosition(): Promise<number> {
  const { Glob } = await import("bun");
  const { DocumentProcessor } = await import("./src/document-processor");

  // Find the first .txt file in docs directory
  const docsDir = path.resolve(__dirname, "src/docs");

  for await (const entry of new Glob("**/*.txt").scan(docsDir)) {
    const resolved = path.join(docsDir, entry);
    const file = Bun.file(resolved);

    try {
      const position = await DocumentProcessor.getResumePosition(file);
      if (position > 0) {
        return position;
      }
    } catch (error) {
      console.warn(`Could not get position for ${entry}: ${error}`);
    }
  }

  return 0;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Run the auto-resume extraction
runWithAutoResume().catch((error) => {
  console.error(`💥 Auto-resume failed: ${error}`);
  process.exit(1);
});
