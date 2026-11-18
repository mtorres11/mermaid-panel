---
name: mermaid-panel
description: Open a Mermaid diagram in the Mermaid Panel VS Code extension, where it can be viewed and edited graphically. Use when the user runs /mermaid-panel or asks to open, show, preview or edit a mermaid diagram in the panel or in VS Code.
allowed-tools: Bash(node ~/.claude/skills/mermaid-panel/open.mjs:*)
---

# Open a diagram in Mermaid Panel

1. Pick the diagram: the one in the user's arguments if there is one, otherwise the most
   recent ```mermaid block in this conversation. If there is none, ask for it.
2. Run this, with the diagram text between the markers (no ``` fence needed):

   ```bash
   node ~/.claude/skills/mermaid-panel/open.mjs <<'MERMAID'
   flowchart LR
       A --> B
   MERMAID
   ```

3. Reply in one line that it is open in VS Code. The first time, VS Code asks whether the
   extension may open the link; the user should allow it (and can tick "Don't ask again").

If the command fails because the extension is missing, point the user to
https://github.com/mtorres11/mermaid-panel#install.
