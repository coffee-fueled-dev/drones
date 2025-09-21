/**
 * Unicode-aware text reader that yields sanitized, normalized characters.
 * - Autodetects BOM: UTF-8 / UTF-16LE / UTF-16BE
 * - Normalizes all line separators to \n
 * - Strips NULs and replaces most control chars with space
 */
export class Unicode {
  static fromString(text: string): number[] {
    const out: number[] = [];
    for (const ch of text) out.push(ch.codePointAt(0)!);
    return out;
  }

  static toString(codepoints: number[]): string {
    return String.fromCodePoint(...codepoints);
  }

  static toUtf8Bytes(codepoints: number[]): number[] {
    const enc = new TextEncoder();
    return Array.from(enc.encode(String.fromCodePoint(...codepoints)));
  }

  // Options if you want to tweak behavior later
  static defaults = {
    chunkCP: 8192,
    normalize: "NFC" as "NFC" | "NFD" | "NFKC" | "NFKD" | false,
    // Replace control chars (except \n and \t) with a space (true) or drop them (false)
    replaceControlsWithSpace: true,
  };

  static async *stream(
    source: Bun.BunFile,
    opts?: Partial<typeof Unicode.defaults>
  ): AsyncGenerator<string[]> {
    const { chunkCP, normalize, replaceControlsWithSpace } = {
      ...Unicode.defaults,
      ...(opts ?? {}),
    };

    // ReadableStream<Uint8Array>
    const rs = source.stream();
    const reader = rs.getReader();

    // Peek first chunk to detect BOM
    let first = await reader.read();
    if (first.done) return;

    let bytes = first.value!;
    let enc: Bun.Encoding;
    let offset = 0;

    if (
      bytes.length >= 3 &&
      bytes[0] === 0xef &&
      bytes[1] === 0xbb &&
      bytes[2] === 0xbf
    ) {
      enc = "utf-8";
      offset = 3; // skip UTF-8 BOM
    } else if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
      enc = "utf-16";
      offset = 2; // skip UTF-16LE BOM
    } else {
      enc = "windows-1252";
      offset = 2; // skip UTF-16BE BOM
    }
    const decoder = new TextDecoder(enc, { fatal: false }); // set fatal:true if you prefer hard failures

    let buf: string[] = [];

    // Helper: push a sanitized string into buf, yielding in chunkCP pieces
    const pushSanitized = (s: string): string[] => {
      // Normalize text form if requested
      if (normalize) s = s.normalize(normalize);

      // 1) Normalize newlines to \n:
      //    CRLF, CR, VT, FF, NEL, LS, PS → \n
      s = s
        .replace(/\r\n/g, "\n")
        .replace(/\r/g, "\n")
        .replace(/\u000B/g, "\n")
        .replace(/\u000C/g, "\n")
        .replace(/\u0085/g, "\n")
        .replace(/\u2028/g, "\n")
        .replace(/\u2029/g, "\n");

      // 2) Strip NULs (classic when UTF-16 is mis-decoded or embedded)
      s = s.replace(/\u0000/g, "");

      // 3) Handle C0/C1 controls (keep \n and \t; map others to space or remove)
      if (replaceControlsWithSpace) {
        s = s.replace(
          /[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F\u0080-\u009F]/g,
          " "
        );
      } else {
        s = s.replace(
          /[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F\u0080-\u009F]/g,
          ""
        );
      }

      // Optional: you mentioned \u0014 (DC4). With the line above, it becomes a space;
      // if you specifically want it to be a newline, uncomment the following line:
      // s = s.replace(/\u0014/g, "\n");

      // 4) Collapse runs of whitespace around newlines if you like (optional):
      // s = s.replace(/[ \t]+\n/g, "\n");

      for (const ch of s) {
        buf.push(ch);
        if (buf.length >= chunkCP) {
          const out = buf;
          buf = [];
          return out;
        }
      }
      return [];
    };

    // Process the first chunk
    if (offset) {
      const chunk = pushSanitized(
        decoder.decode(bytes.subarray(offset), { stream: true })
      );
      if (chunk.length > 0) yield chunk;
    } else {
      const chunk = pushSanitized(decoder.decode(bytes, { stream: true }));
      if (chunk.length > 0) yield chunk;
    }

    // Process remaining chunks
    while (true) {
      const nxt = await reader.read();
      if (nxt.done) break;
      const chunk = pushSanitized(decoder.decode(nxt.value!, { stream: true }));
      if (chunk.length > 0) yield chunk;
    }

    // Flush decoder remainder
    const finalChunk = pushSanitized(decoder.decode());
    if (finalChunk.length > 0) yield finalChunk;

    if (buf.length) yield buf;
  }
}
