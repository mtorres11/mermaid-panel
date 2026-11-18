import * as vscode from "vscode";
import { randomBytes } from "crypto";

// Shared with the webview so both sides agree on what a Mermaid diagram is.
const edit: { extract(text: string): string; looksLikeMermaid(text: string): boolean } = require("../media/edit.js");

const LAST = "mermaidPanel.last";
const SAMPLE = `flowchart LR
    A([Copy a Mermaid diagram]) --> B[Run Mermaid Panel: Open]
    B --> C{Edit}
    C -- text --> D[Diagram updates]
    C -- double-click a label --> E[Text updates]`;

let panel: vscode.WebviewPanel | undefined;

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand("mermaidPanel.open", async () => {
      const clip = await vscode.env.clipboard.readText();
      show(context, edit.looksLikeMermaid(clip) ? edit.extract(clip) : undefined);
    }),
    // vscode://mtorres11.mermaid-panel/open?code=<base64url diagram>. base64url survives
    // the percent-decoding VS Code applies to the query; plain text would lose "+" and "%".
    vscode.window.registerUriHandler({
      handleUri(uri) {
        const code = /(?:^|&)code=([\w-]+)/.exec(uri.query)?.[1];
        if (uri.path === "/open" && code) show(context, edit.extract(Buffer.from(code, "base64url").toString("utf8")));
      },
    }),
  );
}

/** Opens (or reveals) the single panel; `text` replaces the diagram when given. */
function show(context: vscode.ExtensionContext, text?: string): void {
  if (panel) {
    panel.reveal();
    if (text !== undefined) void panel.webview.postMessage({ type: "set", text });
    return;
  }
  const media = vscode.Uri.joinPath(context.extensionUri, "media");
  const created = vscode.window.createWebviewPanel(
    "mermaidPanel",
    "Mermaid",
    vscode.ViewColumn.Beside,
    { enableScripts: true, retainContextWhenHidden: true, localResourceRoots: [media] },
  );
  panel = created;
  created.iconPath = vscode.Uri.joinPath(media, "icon.svg");
  created.webview.html = html(created.webview, media);
  const initial = text ?? context.globalState.get<string>(LAST) ?? SAMPLE;

  created.webview.onDidReceiveMessage(async (msg: { type: string; text?: string }) => {
    switch (msg.type) {
      case "ready":
        return created.webview.postMessage({ type: "set", text: initial });
      case "changed":
        return context.globalState.update(LAST, msg.text ?? "");
      case "copy":
        await vscode.env.clipboard.writeText(msg.text ?? "");
        vscode.window.setStatusBarMessage("$(check) Mermaid copied", 2000);
        return;
      case "paste":
        return created.webview.postMessage({ type: "set", text: edit.extract(await vscode.env.clipboard.readText()) });
    }
  });
  created.onDidDispose(() => (panel = undefined));
}

function html(webview: vscode.Webview, media: vscode.Uri): string {
  const nonce = randomBytes(24).toString("base64url");
  const uri = (file: string) => webview.asWebviewUri(vscode.Uri.joinPath(media, file));
  // Mermaid writes <style> into each SVG, hence 'unsafe-inline' for styles only.
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} data:; font-src ${webview.cspSource}; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link rel="stylesheet" href="${uri("main.css")}">
</head>
<body>
<div class="toolbar">
  <button id="paste" title="Replace with the clipboard">Paste</button>
  <button id="copy" title="Copy the Mermaid text">Copy</button>
  <span class="sep"></span>
  <button id="add" title="Add a node linked from the selected node">+ Node</button>
  <button id="connect" title="Connect the selected node to another node">Connect</button>
  <span class="sep"></span>
  <button id="zoomOut" title="Zoom out (Cmd/Ctrl + wheel)">−</button>
  <button id="zoomLabel" title="Reset zoom">100%</button>
  <button id="zoomIn" title="Zoom in (Cmd/Ctrl + wheel)">+</button>
  <span id="status"></span>
</div>
<div class="split">
  <textarea id="src" spellcheck="false" aria-label="Mermaid source"></textarea>
  <div id="view"><div id="canvas"></div></div>
</div>
<script nonce="${nonce}" src="${uri("mermaid.min.js")}"></script>
<script nonce="${nonce}" src="${uri("edit.js")}"></script>
<script nonce="${nonce}" src="${uri("main.js")}"></script>
</body>
</html>`;
}

export function deactivate(): void {}
