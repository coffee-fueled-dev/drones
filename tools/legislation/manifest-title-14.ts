#!/usr/bin/env bun

const resp = await fetch(
  "https://www.ecfr.gov/api/versioner/v1/structure/2025-01-01/title-14.json",
  {
    method: "GET",
    headers: {
      accept: "application/json",
    },
  }
);

if (!resp.ok) {
  throw new Error(`Fetch failed: ${resp.status} ${resp.statusText}`);
}

const data = await resp.json();
await Bun.write("title14.json", JSON.stringify(data, null, 2));

console.log("Saved to title14.json");
