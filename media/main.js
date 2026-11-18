// Webview: the textarea is the single source of truth. Every graphical edit rewrites
// its text (through execCommand so Cmd/Ctrl+Z undoes it) and the diagram re-renders.
(function () {
  "use strict";
  const vscode = acquireVsCodeApi();
  const E = window.MermaidEdit;
  const $ = (id) => document.getElementById(id);
  const src = $("src"), view = $("view"), canvas = $("canvas"), status = $("status");
  const btn = { add: $("add"), connect: $("connect") };

  let selected = null; // flowchart node id
  let connectFrom = null;
  let pendingEdit = null; // node id to open the label editor on after the next render
  let zoom = 1, seq = 0, timer;

  const theme = () =>
    document.body.classList.contains("vscode-light") || document.body.classList.contains("vscode-high-contrast-light")
      ? "default"
      : "dark";
  const init = () => mermaid.initialize({ startOnLoad: false, securityLevel: "strict", suppressErrorRendering: true, theme: theme() });

  function setStatus(text, error = false) {
    status.textContent = text;
    status.classList.toggle("error", error);
  }

  /** Replaces the whole text as one undoable edit. */
  function setSource(text) {
    src.focus();
    src.select();
    if (!document.execCommand("insertText", false, text)) {
      src.value = text;
      schedule();
    }
  }

  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(render, 250);
  }

  async function render() {
    const text = src.value;
    const mine = ++seq;
    vscode.postMessage({ type: "changed", text });
    if (!text.trim()) {
      canvas.innerHTML = "";
      return setStatus("Paste a Mermaid diagram on the left.");
    }
    try {
      const { svg } = await mermaid.render(`mp-${mine}`, text);
      if (mine !== seq) return;
      canvas.innerHTML = svg;
      canvas.classList.remove("stale");
      setStatus(E.isFlowchart(text) ? "Double-click text to edit · click a node to select" : "Double-click text to edit");
      select(nodeEl(selected) ? selected : null);
      if (pendingEdit && nodeEl(pendingEdit)) editNode(pendingEdit);
      pendingEdit = null;
    } catch (err) {
      if (mine !== seq) return;
      canvas.classList.add("stale");
      setStatus(String((err && err.message) || err).split("\n").slice(0, 4).join("\n"), true);
    }
  }

  // Flowchart nodes render as <g class="node" id="<svg>-flowchart-<ID>-<n>"> (some layouts add data-id).
  const nodeId = (g) => g.dataset.id || (/-flowchart-(.+)-\d+$/.exec(g.id) || [])[1];
  const nodeAt = (target) => (flowchart() ? target.closest("g.node") : null);
  const nodeEl = (id) => (id ? [...canvas.querySelectorAll("g.node")].find((g) => nodeId(g) === id) : null);
  const flowchart = () => E.isFlowchart(src.value);

  function select(id) {
    canvas.querySelectorAll(".mp-selected").forEach((el) => el.classList.remove("mp-selected"));
    selected = id;
    const el = nodeEl(id);
    if (el) el.classList.add("mp-selected");
    btn.add.disabled = btn.connect.disabled = !el;
  }

  function setConnect(from) {
    connectFrom = from;
    btn.connect.classList.toggle("active", !!from);
    if (from) setStatus(`Click the node to connect ${from} to (Esc cancels)`);
  }

  /** Text shown by a label element, with line breaks as \n. */
  function shownText(el) {
    const html = el.tagName === "foreignObject" ? el.querySelector("div, span") : null;
    if (html) return html.innerText.trim();
    const lines = el.querySelectorAll(":scope > tspan");
    return (lines.length > 1 ? [...lines].map((t) => t.textContent).join("\n") : el.textContent).trim();
  }

  /** Small input over `el`; calls done(text) on Enter/blur unless the text is unchanged. */
  function inlineEdit(el, initial, done) {
    const r = el.getBoundingClientRect();
    const input = document.createElement("input");
    input.className = "mp-input";
    input.value = initial;
    Object.assign(input.style, {
      left: `${r.left}px`,
      top: `${r.top + r.height / 2 - 14}px`,
      width: `${Math.max(r.width, 180)}px`,
    });
    let finished = false;
    const finish = (commit) => {
      if (finished) return;
      finished = true;
      input.remove();
      if (commit && input.value !== initial && input.value.trim()) done(input.value);
    };
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === "Escape") {
        e.preventDefault(); // keep the key from reaching the textarea that gets focus next
        finish(e.key === "Enter");
      }
      e.stopPropagation();
    });
    input.addEventListener("blur", () => finish(true));
    document.body.appendChild(input);
    input.focus();
    input.select();
  }

  function editNode(id) {
    const target = E.nodeTarget(src.value, id);
    const el = nodeEl(id);
    if (target && el) inlineEdit(el, target.text, (text) => setSource(E.applyLabel(src.value, target, text)));
  }

  function editLabel(el) {
    const shown = shownText(el);
    const same = [...canvas.querySelectorAll("foreignObject, text")].filter((x) => shownText(x) === shown);
    const target = E.labelTarget(src.value, shown, Math.max(0, same.indexOf(el)));
    if (!target) return setStatus(`Could not find "${shown}" in the text. Edit it on the left.`, true);
    inlineEdit(el, target.text, (text) => setSource(E.applyLabel(src.value, target, text)));
  }

  canvas.addEventListener("click", (e) => {
    const id = (nodeAt(e.target) && nodeId(nodeAt(e.target))) || null;
    if (connectFrom) {
      if (id && id !== connectFrom) setSource(E.connect(src.value, connectFrom, id));
      return setConnect(null);
    }
    select(id);
  });

  canvas.addEventListener("dblclick", (e) => {
    const node = nodeAt(e.target);
    if (node && nodeId(node)) return editNode(nodeId(node));
    const label = e.target.closest("foreignObject") || e.target.closest("text");
    if (label && shownText(label)) editLabel(label);
  });

  btn.add.addEventListener("click", () => {
    const added = selected && E.addChild(src.value, selected);
    if (!added) return;
    selected = pendingEdit = added.id;
    setSource(added.source);
  });
  btn.connect.addEventListener("click", () => setConnect(connectFrom ? null : selected));

  const setZoom = (z) => {
    zoom = Math.min(5, Math.max(0.2, z));
    canvas.style.zoom = String(zoom);
    $("zoomLabel").textContent = `${Math.round(zoom * 100)}%`;
  };
  $("zoomIn").addEventListener("click", () => setZoom(zoom * 1.25));
  $("zoomOut").addEventListener("click", () => setZoom(zoom / 1.25));
  $("zoomLabel").addEventListener("click", () => setZoom(1));
  view.addEventListener(
    "wheel",
    (e) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      setZoom(zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1));
    },
    { passive: false },
  );

  $("paste").addEventListener("click", () => vscode.postMessage({ type: "paste" }));
  $("copy").addEventListener("click", () => vscode.postMessage({ type: "copy", text: src.value }));
  src.addEventListener("input", schedule);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && connectFrom) setConnect(null);
  });

  window.addEventListener("message", (e) => {
    if (e.data.type === "set") setSource(e.data.text);
  });
  // Re-render when the VS Code theme changes (light <-> dark).
  new MutationObserver(() => {
    init();
    schedule();
  }).observe(document.body, { attributes: true, attributeFilter: ["class"] });

  init();
  select(null);
  vscode.postMessage({ type: "ready" });
})();
