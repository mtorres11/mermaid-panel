// Pure text operations on Mermaid source. Loaded by the webview (window.MermaidEdit),
// the extension host and the tests (CommonJS). No DOM, no VS Code API.
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.MermaidEdit = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const KEYWORD =
    /^(flowchart|graph|sequenceDiagram|classDiagram(-v2)?|stateDiagram(-v2)?|erDiagram|journey|gantt|pie|quadrantChart|requirementDiagram|gitGraph|mindmap|timeline|sankey(-beta)?|xychart(-beta)?|block(-beta)?|packet(-beta)?|architecture(-beta)?|kanban|radar(-beta)?|treemap(-beta)?|C4(Context|Container|Component|Dynamic|Deployment)|zenuml)\b/;

  // Flowchart node shapes, longest opener first so "((" wins over "(".
  const SHAPES = [
    ["(((", ")))"], ["((", "))"], ["([", "])"], ["[[", "]]"], ["[(", ")]"], ["{{", "}}"],
    ["[/", "/]"], ["[/", "\\]"], ["[\\", "\\]"], ["[\\", "/]"],
    ["[", "]"], ["(", ")"], ["{", "}"], [">", "]"],
  ];

  const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  /** The diagram inside a ```mermaid fence when there is one, otherwise the text itself. */
  function extract(text) {
    const fenced = /```[ \t]*mermaid[^\n]*\n([\s\S]*?)```/.exec(text);
    return (fenced ? fenced[1] : text).replace(/^(\s*\n)+/, "").replace(/\s+$/, "");
  }

  /** The first meaningful line, skipping front matter, %% comments/directives and blanks. */
  function header(text) {
    const lines = extract(text).split("\n");
    let i = 0;
    if (lines[0] && lines[0].trim() === "---") {
      i = lines.findIndex((l, n) => n > 0 && l.trim() === "---") + 1;
      if (i === 0) return "";
    }
    for (; i < lines.length; i++) {
      const l = lines[i].trim();
      if (l && !l.startsWith("%%")) return l;
    }
    return "";
  }

  const looksLikeMermaid = (text) => KEYWORD.test(header(text));
  const isFlowchart = (text) => /^(flowchart|graph)\b/.test(header(text));

  /** Where a flowchart node's label lives in the source, ready for applyLabel(). */
  function nodeTarget(source, id) {
    const re = new RegExp(`(?<![\\w-])${escapeRe(id)}(?![\\w-])`, "g");
    let first = null;
    for (let m; (m = re.exec(source)); ) {
      const at = m.index + id.length;
      if (first === null) first = at;
      const shape = SHAPES.find(([open]) => source.startsWith(open, at));
      if (!shape) continue;
      const start = at + shape[0].length;
      if (source[start] === '"') {
        const end = source.indexOf('"' + shape[1], start + 1);
        if (end > 0) return { start: start + 1, end, text: source.slice(start + 1, end), kind: "quoted" };
      }
      const end = source.indexOf(shape[1], start);
      if (end > 0) return { start, end, text: source.slice(start, end), kind: "shape" };
    }
    // Bare node ("A --> B"): the label is the id; editing adds a [label] after it.
    return first === null ? null : { start: first, end: first, text: id, kind: "bare" };
  }

  const BEFORE = /[\s[({>|:/\\]/;
  const AFTER = /[\s\])}|/\\;]/;
  const QUOTE = /["`]/;

  function bounded(s, start, end) {
    let b = start - 1;
    if (QUOTE.test(s[b] || "")) b--;
    let a = end;
    if (QUOTE.test(s[a] || "")) a++;
    return (b < 0 || BEFORE.test(s[b])) && (a >= s.length || AFTER.test(s[a]));
  }

  /**
   * Finds a label by the text the diagram shows (lines separated by \n, which the source
   * writes as <br/>). `occurrence` picks among repeats, in document order.
   */
  function labelTarget(source, shown, occurrence = 0) {
    const lines = shown.split("\n").map((l) => l.trim()).filter(Boolean);
    if (!lines.length) return null;
    const pattern = lines.map((l) => l.split(/\s+/).map(escapeRe).join("\\s+")).join("\\s*<br\\s*/?>\\s*");
    const strict = [], loose = [];
    const re = new RegExp(pattern, "g");
    for (let m; (m = re.exec(source)); ) {
      const end = m.index + m[0].length;
      (bounded(source, m.index, end) ? strict : loose).push({ start: m.index, end, text: m[0], kind: "raw" });
    }
    const hits = strict.length ? strict : loose;
    return hits.length ? hits[Math.min(occurrence, hits.length - 1)] : null;
  }

  /** Writes `text` into a target from nodeTarget() or labelTarget(). */
  function applyLabel(source, target, text) {
    let out = text;
    if (target.kind === "quoted") out = text.replace(/"/g, "#quot;");
    else if (target.kind !== "raw" && /[[\](){}|"]/.test(text)) out = `"${text.replace(/"/g, "#quot;")}"`;
    if (target.kind === "bare") out = `[${out}]`;
    return source.slice(0, target.start) + out + source.slice(target.end);
  }

  /** First "N<number>" id not already used anywhere in the source. */
  function nextId(source) {
    for (let n = 1; ; n++) if (!new RegExp(`(?<![\\w-])N${n}(?![\\w-])`).test(source)) return `N${n}`;
  }

  /**
   * Adds a node linked from `id`, right after the line that first mentions `id`
   * (same indentation), so it lands in the same subgraph.
   */
  function addChild(source, id, label = "New node") {
    const target = nodeTarget(source, id);
    if (!target) return null;
    const newId = nextId(source);
    const lineEnd = source.indexOf("\n", target.start);
    const lineStart = source.lastIndexOf("\n", target.start) + 1;
    const indent = /^\s*/.exec(source.slice(lineStart))[0];
    const line = `\n${indent}${id} --> ${newId}[${label}]`;
    const at = lineEnd < 0 ? source.length : lineEnd;
    return { source: source.slice(0, at) + line + source.slice(at), id: newId };
  }

  /** Appends "from --> to" at the top level, where it cannot move nodes between subgraphs. */
  function connect(source, from, to) {
    return `${source.replace(/\s+$/, "")}\n    ${from} --> ${to}\n`;
  }

  return { extract, looksLikeMermaid, isFlowchart, nodeTarget, labelTarget, applyLabel, nextId, addChild, connect };
});
