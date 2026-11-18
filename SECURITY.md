# Security Policy

## Reporting a vulnerability

Please **do not open a public issue** for security problems.

Report it privately through GitHub: **Security** tab → **Report a vulnerability**
(<https://github.com/mtorres11/mermaid-panel/security/advisories/new>).
You'll get a response as soon as possible, and a fix will be released before details are made public.

## How the extension handles your data

- It makes no network requests. Mermaid is bundled with the extension and diagrams are rendered locally.
- It reads the clipboard only when you run **Mermaid Panel: Open** or press **Paste**, and writes it only when you press **Copy**.
- The last diagram is kept in VS Code's extension storage on your machine so the panel can reopen it.
- The panel runs in a locked-down webview (no remote scripts, nonce-only scripts, Mermaid's `strict` security level). Inline styles are allowed because Mermaid styles each SVG inline.
- `vscode://mtorres11.mermaid-panel/open?code=<base64url>` links only display the diagram they carry; VS Code asks before an outside app can open one.
