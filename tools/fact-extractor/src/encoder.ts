export class Encoder {
  // Encode data to compressed base64 string
  static encode<T>(data: T): string {
    const compressed = Bun.gzipSync(JSON.stringify(data));
    return Buffer.from(compressed).toString("base64");
  }

  // Decode compressed base64 string back to original data
  static decode<T>(encoded: string): T {
    const compressed = Buffer.from(encoded, "base64");
    const decompressed = Bun.gunzipSync(compressed);
    const jsonString = new TextDecoder().decode(decompressed);
    return JSON.parse(jsonString);
  }
}
