// Use the global Bun.glob at runtime to find files. Don't import Glob here.
import { FastMCP } from "fastmcp";
import path from "path";
import { Glob } from "bun";

const server = new FastMCP({
  name: "Drone policy",
  version: "1.0.0",
});

for await (const entry of new Glob("**/*.txt").scan("resources/samples")) {
  const filename = path.basename(entry);
  const resourceName = `sample_${filename.replace(/[^a-zA-Z0-9_\-\.]/g, "_")}`;
  const uri = `/resources/samples/${filename}`;

  server.addResource({
    name: resourceName,
    uri,
    load: async () => {
      const file = Bun.file(entry);
      const text = await file.text();
      return {
        blob: file,
        text,
      };
    },
  });
}

server.start({
  transportType: "stdio",
});
