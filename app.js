const STORAGE_KEY = "infinite-board-v2";

const state = {
  boards: {},
  activeBoardId: null,
  viewport: { x: 0, y: 0, scale: 1 },
  connectMode: false,
  connectFrom: null,
};

const els = {
  boardName: document.getElementById("boardName"),
  addBoard: document.getElementById("addBoard"),
  boardList: document.getElementById("boardList"),
  workspace: document.getElementById("workspace"),
  canvas: document.getElementById("canvas"),
  connections: document.getElementById("connections"),
  nodeTemplate: document.getElementById("nodeTemplate"),
  connectMode: document.getElementById("connectMode"),
  toolButtons: [...document.querySelectorAll("[data-tool]")],
};

init();

function init() {
  load();
  if (!Object.keys(state.boards).length) createBoard("Proyecto principal");
  bindUI();
  renderBoards();
  renderBoard();
}

function bindUI() {
  els.addBoard.addEventListener("click", () => {
    const name = els.boardName.value.trim() || `Proyecto ${Object.keys(state.boards).length + 1}`;
    createBoard(name);
    els.boardName.value = "";
  });

  els.toolButtons.forEach((btn) => btn.addEventListener("click", () => addNode(btn.dataset.tool)));

  els.connectMode.addEventListener("click", () => {
    state.connectMode = !state.connectMode;
    state.connectFrom = null;
    els.connectMode.classList.toggle("active", state.connectMode);
    renderBoard();
  });

  let panning = false;
  let start = { x: 0, y: 0 };

  els.workspace.addEventListener("mousedown", (e) => {
    if (!e.shiftKey || e.target.closest(".node")) return;
    panning = true;
    start = { x: e.clientX - state.viewport.x, y: e.clientY - state.viewport.y };
    els.workspace.style.cursor = "grabbing";
  });

  window.addEventListener("mousemove", (e) => {
    if (!panning) return;
    state.viewport.x = e.clientX - start.x;
    state.viewport.y = e.clientY - start.y;
    applyViewport();
  });

  window.addEventListener("mouseup", () => {
    if (!panning) return;
    panning = false;
    els.workspace.style.cursor = "grab";
    save();
  });

  els.workspace.addEventListener("wheel", (e) => {
    e.preventDefault();
    const scaleDelta = e.deltaY > 0 ? -0.08 : 0.08;
    state.viewport.scale = Math.min(2.3, Math.max(0.35, state.viewport.scale + scaleDelta));
    applyViewport();
    save();
  });
}

function addNode(type) {
  const board = activeBoard();
  if (!board) return;

  const base = {
    id: crypto.randomUUID(),
    type,
    x: 140 + board.nodes.length * 20,
    y: 120 + board.nodes.length * 20,
    title: { note: "Nota", image: "Imagen", video: "Video", timeline: "Línea de tiempo" }[type],
    data: {},
  };

  if (type === "note") {
    base.data.text = prompt("Escribe tu nota:", "Idea principal") || "";
  }

  if (type === "image") {
    base.data.url =
      prompt("URL de imagen:", "https://images.unsplash.com/photo-1509099836639-18ba1795216d?w=800") || "";
  }

  if (type === "video") {
    base.data.url = prompt("URL de YouTube o Vimeo:", "https://www.youtube.com/watch?v=dQw4w9WgXcQ") || "";
  }

  if (type === "timeline") {
    base.data.items = collectTimelineItems();
    if (!base.data.items.length) {
      base.data.items = [
        { label: "Kickoff", date: "2026-01-15", kind: "event" },
        { label: "Diseño", start: "2026-02-01", end: "2026-02-20", kind: "period" },
        { label: "Release", date: "2026-03-01", kind: "event" },
      ];
    }
  }

  board.nodes.push(base);
  save();
  renderBoard();
}

function collectTimelineItems() {
  const raw = prompt(
    "Introduce eventos/periodos (uno por línea).\nFormato evento: evento|Nombre|YYYY-MM-DD\nFormato periodo: periodo|Nombre|YYYY-MM-DD|YYYY-MM-DD",
    "evento|Inicio|2026-01-10\nperiodo|Implementación|2026-01-15|2026-02-20\nevento|Entrega|2026-03-01"
  );

  if (!raw) return [];

  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split("|").map((x) => x.trim());
      if (parts[0] === "evento" && parts.length >= 3) {
        return { kind: "event", label: parts[1], date: parts[2] };
      }
      if (parts[0] === "periodo" && parts.length >= 4) {
        return { kind: "period", label: parts[1], start: parts[2], end: parts[3] };
      }
      return null;
    })
    .filter(Boolean);
}

function renderBoards() {
  els.boardList.innerHTML = "";

  Object.values(state.boards).forEach((board) => {
    const li = document.createElement("li");
    if (board.id === state.activeBoardId) li.classList.add("active");

    const name = document.createElement("span");
    name.textContent = board.name;
    name.className = "name";
    name.onclick = () => {
      state.activeBoardId = board.id;
      save();
      renderBoards();
      renderBoard();
    };

    const remove = document.createElement("button");
    remove.textContent = "🗑";
    remove.onclick = () => {
      if (Object.keys(state.boards).length === 1) return;
      delete state.boards[board.id];
      if (state.activeBoardId === board.id) state.activeBoardId = Object.keys(state.boards)[0];
      save();
      renderBoards();
      renderBoard();
    };

    li.append(name, remove);
    els.boardList.append(li);
  });
}

function renderBoard() {
  const board = activeBoard();
  if (!board) return;

  els.canvas.innerHTML = "";
  els.connections.innerHTML = "";

  board.nodes.forEach((node) => {
    const el = els.nodeTemplate.content.firstElementChild.cloneNode(true);
    el.dataset.id = node.id;
    el.style.left = `${node.x}px`;
    el.style.top = `${node.y}px`;
    el.querySelector(".title").textContent = node.title;
    if (state.connectFrom === node.id) el.classList.add("selected-for-connection");

    const content = el.querySelector(".content");
    if (node.type === "note") content.textContent = node.data.text || "";
    if (node.type === "image") content.innerHTML = `<img src="${node.data.url}" alt="Imagen" />`;
    if (node.type === "video") content.innerHTML = videoEmbed(node.data.url);
    if (node.type === "timeline") content.append(timeline(node.data.items || []));

    el.querySelector(".delete").addEventListener("click", (ev) => {
      ev.stopPropagation();
      board.nodes = board.nodes.filter((n) => n.id !== node.id);
      board.connections = board.connections.filter((c) => c.from !== node.id && c.to !== node.id);
      if (state.connectFrom === node.id) state.connectFrom = null;
      save();
      renderBoard();
    });

    let moved = false;
    el.addEventListener("mousedown", (ev) => {
      if (ev.button !== 0) return;
      moved = false;
      dragNode(ev, node, () => {
        moved = true;
      });
    });

    el.addEventListener("click", (ev) => {
      ev.stopPropagation();
      if (!state.connectMode || moved) return;
      connectNode(node.id);
    });

    els.canvas.append(el);
  });

  board.connections.forEach((conn) => drawConnection(conn, board));
  applyViewport();
}

function connectNode(targetId) {
  const board = activeBoard();
  if (!board) return;

  if (!state.connectFrom) {
    state.connectFrom = targetId;
    renderBoard();
    return;
  }

  if (state.connectFrom === targetId) {
    state.connectFrom = null;
    renderBoard();
    return;
  }

  const exists = board.connections.some(
    (c) => (c.from === state.connectFrom && c.to === targetId) || (c.from === targetId && c.to === state.connectFrom)
  );

  if (!exists) {
    board.connections.push({ id: crypto.randomUUID(), from: state.connectFrom, to: targetId });
  }

  state.connectFrom = null;
  save();
  renderBoard();
}

function timeline(items) {
  const wrap = document.createElement("div");
  wrap.className = "timeline-wrap";
  if (!items.length) {
    wrap.textContent = "Sin eventos todavía.";
    return wrap;
  }

  const parsed = items
    .map((item) => {
      const date = item.kind === "event" ? parseDate(item.date) : parseDate(item.start);
      const end = item.kind === "period" ? parseDate(item.end) : date;
      if (!date || !end) return null;
      return { ...item, _start: date, _end: end };
    })
    .filter(Boolean)
    .sort((a, b) => a._start - b._start);

  if (!parsed.length) {
    wrap.textContent = "Fechas inválidas en la línea de tiempo.";
    return wrap;
  }

  const min = parsed.reduce((acc, i) => Math.min(acc, i._start), parsed[0]._start);
  const max = parsed.reduce((acc, i) => Math.max(acc, i._end), parsed[0]._end);
  const range = Math.max(max - min, 1);

  const track = document.createElement("div");
  track.className = "timeline-track";

  parsed.forEach((item) => {
    if (item.kind === "period") {
      const period = document.createElement("div");
      period.className = "timeline-period";
      period.style.left = `${((item._start - min) / range) * 100}%`;
      period.style.width = `${((item._end - item._start) / range) * 100}%`;
      period.innerHTML = `<span>${item.label} (${item.start} → ${item.end})</span>`;
      track.append(period);
      return;
    }

    const mark = document.createElement("div");
    mark.className = "timeline-event";
    mark.style.left = `${((item._start - min) / range) * 100}%`;
    mark.innerHTML = `<strong>${item.label}</strong><small>${item.date}</small>`;
    track.append(mark);
  });

  wrap.append(track);
  return wrap;
}

function parseDate(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.getTime();
}

function videoEmbed(url = "") {
  if (url.includes("youtube.com/watch")) {
    const id = new URL(url).searchParams.get("v");
    return `<iframe height="150" src="https://www.youtube.com/embed/${id}" allowfullscreen></iframe><a href="${url}" target="_blank">Abrir video</a>`;
  }
  if (url.includes("youtu.be/")) {
    const id = url.split("youtu.be/")[1].split("?")[0];
    return `<iframe height="150" src="https://www.youtube.com/embed/${id}" allowfullscreen></iframe><a href="${url}" target="_blank">Abrir video</a>`;
  }
  return `<a href="${url}" target="_blank">${url}</a>`;
}

function dragNode(ev, node, onMoveDetected) {
  ev.preventDefault();

  const start = {
    mouseX: ev.clientX,
    mouseY: ev.clientY,
    nodeX: node.x,
    nodeY: node.y,
  };

  function onMove(e) {
    const dx = (e.clientX - start.mouseX) / state.viewport.scale;
    const dy = (e.clientY - start.mouseY) / state.viewport.scale;

    if (Math.abs(dx) > 1 || Math.abs(dy) > 1) onMoveDetected();

    node.x = start.nodeX + dx;
    node.y = start.nodeY + dy;
    renderBoard();
  }

  function onUp() {
    window.removeEventListener("mousemove", onMove);
    window.removeEventListener("mouseup", onUp);
    save();
  }

  window.addEventListener("mousemove", onMove);
  window.addEventListener("mouseup", onUp);
}

function drawConnection(conn, board) {
  const from = board.nodes.find((n) => n.id === conn.from);
  const to = board.nodes.find((n) => n.id === conn.to);
  if (!from || !to) return;

  const x1 = from.x + 130;
  const y1 = from.y + 50;
  const x2 = to.x + 130;
  const y2 = to.y + 50;

  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("class", "connection-line");
  path.setAttribute("d", `M ${x1} ${y1} C ${x1 + 120} ${y1}, ${x2 - 120} ${y2}, ${x2} ${y2}`);
  els.connections.append(path);
}

function createBoard(name) {
  const id = crypto.randomUUID();
  state.boards[id] = { id, name, nodes: [], connections: [] };
  state.activeBoardId = id;
  save();
  renderBoards();
  renderBoard();
}

function activeBoard() {
  return state.boards[state.activeBoardId];
}

function applyViewport() {
  const t = `translate(${state.viewport.x}px, ${state.viewport.y}px) scale(${state.viewport.scale})`;
  els.canvas.style.transform = t;
  els.connections.style.transform = t;
}

function load() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;
  const parsed = JSON.parse(raw);
  state.boards = parsed.boards || {};
  state.activeBoardId = parsed.activeBoardId || null;
  state.viewport = parsed.viewport || state.viewport;
}

function save() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      boards: state.boards,
      activeBoardId: state.activeBoardId,
      viewport: state.viewport,
    })
  );
}
