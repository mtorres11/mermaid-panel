# Mermaid Panel

A VS Code panel for Mermaid diagrams: paste one, see it drawn, and edit either side.
The text on the left is the only model. Editing it redraws the diagram, and editing the
diagram rewrites the text (Cmd/Ctrl+Z undoes graphical edits too).

Created by **Marco Torres C** · <https://github.com/mtorres11/mermaid-panel>

## Use

1. Copy a diagram (from Claude, a Markdown file, anywhere; a ```` ```mermaid ```` fence is fine).
2. **Cmd/Ctrl+Shift+P → Mermaid Panel: Open**. It loads the clipboard if it holds a diagram,
   otherwise your last one.

In the diagram:

| Action | Does |
| --- | --- |
| Double-click any text | Edit that label in place (nodes, edge labels, subgraph titles, sequence messages…). Enter saves, Esc cancels. |
| Click a node (flowcharts) | Select it |
| **+ Node** | Add a node linked from the selected one, in the same subgraph, and start editing its label |
| **Connect**, then click a node | Add an edge from the selected node to that one |
| **Paste** / **Copy** | Replace with the clipboard / copy the text |
| **− 100% +**, Cmd/Ctrl + wheel | Zoom |

Anything else (deleting, styles, layout direction) you edit in the text.

## Use from Claude Code

The repo includes a Claude Code skill. Install it once:

```
cp -R claude/skills/mermaid-panel ~/.claude/skills/
```

Then, after Claude shows a diagram, type **`/mermaid-panel`** (or ask "open it in the panel")
and it opens in VS Code. The first time, VS Code asks whether the extension may open the
link: allow it (and tick "Don't ask again").

To have Claude offer this every time, add to `~/.claude/CLAUDE.md`:

```
When a reply contains a ```mermaid diagram, end it with one line: "Open it in VS Code: /mermaid-panel".
```

Other tools can open the panel the same way:
`vscode://mtorres11.mermaid-panel/open?code=<diagram as base64url>`.

## Install

```
gh release download --repo mtorres11/mermaid-panel --pattern '*.vsix' --dir /tmp --clobber
code --install-extension /tmp/mermaid-panel.vsix --force
```

Or build it: `npm install && npm run package`, then Extensions view → `…` → **Install from VSIX…**
→ `mermaid-panel.vsix`. Reload the window afterwards.

## Develop

`npm install`, `npm run watch`, then **F5**. `npm test` runs the text-editing tests
([media/edit.js](media/edit.js) holds all source rewriting and is shared by the webview and
the extension).

## License

MIT. Bundles [Mermaid](https://github.com/mermaid-js/mermaid) (MIT).
