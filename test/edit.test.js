const test = require("node:test");
const assert = require("node:assert/strict");
const E = require("../media/edit.js");

const SAMPLE = `flowchart LR
    subgraph AT["mdc-agentic-tools"]
        U([You using Claude Code<br/>from repo root])
        GIT[(git history<br/>+ TS/JS source)]
    end
    subgraph CC["~/.claude/projects/-Volumes-workspace-mdc-agentic-tools"]
        T[(Session transcripts *.jsonl)]
    end
    U -- recorded automatically --> T
    ING["mcl ingest<br/>(only 'Read' counted)"]
    CFG[/.mcl/config.json/]
    HTML[[reports/agentic-tools.html]]
    ING --> RAW --> ATT
    RAW -.-> CFG`;

test("extract strips a ```mermaid fence and surrounding blank lines", () => {
  assert.equal(E.extract("Here:\n```mermaid\ngraph TD\n  A-->B\n```\nbye"), "graph TD\n  A-->B");
  assert.equal(E.extract("\n\n  graph TD\n  A\n\n"), "  graph TD\n  A");
});

test("looksLikeMermaid accepts diagrams, front matter and directives; rejects prose", () => {
  assert.ok(E.looksLikeMermaid(SAMPLE));
  assert.ok(E.looksLikeMermaid("```mermaid\nsequenceDiagram\nA->>B: hi\n```"));
  assert.ok(E.looksLikeMermaid("---\ntitle: x\n---\n%%{init: {}}%%\nclassDiagram"));
  assert.ok(!E.looksLikeMermaid("just some text"));
  assert.ok(!E.looksLikeMermaid("---\nunterminated"));
  assert.ok(E.isFlowchart(SAMPLE));
  assert.ok(!E.isFlowchart("sequenceDiagram"));
});

test("nodeTarget finds labels for every shape kind", () => {
  assert.equal(E.nodeTarget(SAMPLE, "U").text, "You using Claude Code<br/>from repo root");
  assert.equal(E.nodeTarget(SAMPLE, "GIT").text, "git history<br/>+ TS/JS source");
  assert.deepEqual(
    [E.nodeTarget(SAMPLE, "ING").text, E.nodeTarget(SAMPLE, "ING").kind],
    ["mcl ingest<br/>(only 'Read' counted)", "quoted"],
  );
  assert.equal(E.nodeTarget(SAMPLE, "CFG").text, ".mcl/config.json");
  assert.equal(E.nodeTarget(SAMPLE, "HTML").text, "reports/agentic-tools.html");
  assert.equal(E.nodeTarget(SAMPLE, "RAW").kind, "bare");
  assert.equal(E.nodeTarget(SAMPLE, "NOPE"), null);
});

test("applyLabel renames nodes, quoting only when needed", () => {
  const renamed = E.applyLabel(SAMPLE, E.nodeTarget(SAMPLE, "T"), "Transcripts");
  assert.match(renamed, /T\[\(Transcripts\)\]/);
  const quoted = E.applyLabel(SAMPLE, E.nodeTarget(SAMPLE, "T"), "a (b)");
  assert.match(quoted, /T\[\("a \(b\)"\)\]/);
  const inQuotes = E.applyLabel(SAMPLE, E.nodeTarget(SAMPLE, "ING"), 'say "hi"');
  assert.match(inQuotes, /ING\["say #quot;hi#quot;"\]/);
  const bare = E.applyLabel(SAMPLE, E.nodeTarget(SAMPLE, "RAW"), "Raw store");
  assert.match(bare, /ING --> RAW\[Raw store\] --> ATT/);
});

test("labelTarget finds edge labels and subgraph titles, not look-alike substrings", () => {
  const edge = E.labelTarget(SAMPLE, "recorded automatically");
  assert.match(E.applyLabel(SAMPLE, edge, "logged"), /U -- logged --> T/);
  const title = E.labelTarget(SAMPLE, "mdc-agentic-tools");
  assert.match(E.applyLabel(SAMPLE, title, "tools"), /subgraph AT\["tools"\]/);
  assert.match(E.applyLabel(SAMPLE, title, "tools"), /-Volumes-workspace-mdc-agentic-tools/);
  const multi = E.labelTarget(SAMPLE, "You using Claude Code\nfrom repo root");
  assert.equal(multi.text, "You using Claude Code<br/>from repo root");
  assert.equal(E.labelTarget(SAMPLE, "  "), null);
  assert.equal(E.labelTarget(SAMPLE, "missing"), null);
});

test("labelTarget picks the n-th repeat", () => {
  const src = "sequenceDiagram\n  A->>B: ok\n  B->>A: ok";
  assert.equal(E.labelTarget(src, "ok", 1).start, src.lastIndexOf("ok"));
  assert.equal(E.labelTarget(src, "ok", 9).start, src.lastIndexOf("ok"));
});

test("addChild inserts in the parent's subgraph with a fresh id", () => {
  const { source, id } = E.addChild(SAMPLE, "GIT");
  assert.equal(id, "N1");
  assert.match(source, /GIT\[\(git history<br\/>\+ TS\/JS source\)\]\n {8}GIT --> N1\[New node\]\n {4}end/);
  assert.equal(E.nextId("A --> N1\nN2"), "N3");
  assert.equal(E.addChild(SAMPLE, "NOPE"), null);
  assert.match(E.addChild("graph TD\nA", "A").source, /^graph TD\nA\nA --> N1\[New node\]$/);
});

test("connect appends a top-level edge", () => {
  assert.equal(E.connect("graph TD\n  A\n  B\n\n", "A", "B"), "graph TD\n  A\n  B\n    A --> B\n");
});
