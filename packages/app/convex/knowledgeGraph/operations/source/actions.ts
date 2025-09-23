import { v } from "convex/values";
import { internalAction } from "../../../customFunctions";
import { internal } from "../../../_generated/api";

export const chunk = internalAction({
  args: {
    sourceId: v.id("sources"),
    storageId: v.id("_storage"),
  },
  handler: async (ctx, { sourceId, storageId }) => {
    console.log(`Processing chunks for source: ${sourceId}`);

    // Get file URL from storage
    const url = await ctx.storage.getUrl(storageId);
    if (!url) throw new Error("File URL not available");
    console.log(`Storage URL obtained: yes`);

    // Fetch the file
    console.log(`Fetching file from URL...`);
    const res = await fetch(url);
    console.log(
      `Fetch response status: ${res.status}, has body: ${!!res.body}`
    );

    if (!res.ok || !res.body) {
      throw new Error(`Failed to fetch file: ${res.status} ${res.statusText}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffered = "";
    let position = 0;
    const maxChunkBytes = 2000; // ~2KB chunks

    console.log(`Starting to stream and chunk document...`);

    // Helper to find good break point (newline or period)
    const findBreakPoint = (text: string, maxLength: number): number => {
      if (text.length <= maxLength) return text.length;

      // Look for newline first, then period, within reasonable distance of max
      const searchStart = Math.max(0, maxLength - 200);

      for (let i = maxLength - 1; i >= searchStart; i--) {
        if (text[i] === "\n") return i + 1;
      }

      for (let i = maxLength - 1; i >= searchStart; i--) {
        if (text[i] === ".") return i + 1;
      }

      // Fallback to max length
      return maxLength;
    };

    let totalChunks = 0;

    // Stream and chunk the document
    while (true) {
      const { done, value } = await reader.read();

      if (value) {
        buffered += decoder.decode(value, { stream: true });
      }

      // Process complete chunks
      while (
        buffered.length >= maxChunkBytes ||
        (done && buffered.length > 0)
      ) {
        const breakPoint = findBreakPoint(buffered, maxChunkBytes);
        const chunkText = buffered.slice(0, breakPoint);
        buffered = buffered.slice(breakPoint);

        if (chunkText) {
          console.log(
            `Creating chunk at position ${position}, size: ${chunkText.length}`
          );

          // Create chunk record
          const chunkId = await ctx.runMutation(
            internal.knowledgeGraph.operations.source.chunk.mutations.create,
            {
              sourceId,
              position,
              size: chunkText.length,
              content: chunkText.trim(),
            }
          );

          console.log(`Created chunk: ${chunkId}`);
          totalChunks++;
        }

        position += chunkText.length;
      }

      if (done) break;
    }

    console.log(`Completed processing. Created ${totalChunks} chunks.`);
    return totalChunks;
  },
});
