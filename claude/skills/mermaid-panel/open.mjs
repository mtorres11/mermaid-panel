#!/usr/bin/env node
// Opens a Mermaid diagram in the Mermaid Panel VS Code extension.
// Usage: node open.mjs diagram.mmd   or   node open.mjs <<'MERMAID' ... MERMAID
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const text = readFileSync(process.argv[2] ?? 0, "utf8").trim();
if (!text) {
  console.error("No diagram given (pass a file or pipe it on stdin).");
  process.exit(1);
}
const url = `vscode://mtorres11.mermaid-panel/open?code=${Buffer.from(text, "utf8").toString("base64url")}`;
const [cmd, args] =
  process.platform === "darwin" ? ["open", [url]]
  : process.platform === "win32" ? ["cmd", ["/c", "start", "", url]]
  : ["xdg-open", [url]];
execFileSync(cmd, args, { stdio: "inherit" });
console.log("Opened in Mermaid Panel.");
