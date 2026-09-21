function storyBuilderRawGraphEdges(objectives = []) {
    const byId = new Map(objectives.map(objective => [String(objective.id || ""), objective]));
    const links = [];
    for (const objective of objectives) {
      const sourceId = String(objective.id || "");
      if (!sourceId) continue;
      const transitions = objectiveOutputTransitions(objective);
      for (let outputIndex = 0; outputIndex < transitions.length; outputIndex++) {
        const transition = transitions[outputIndex];
        const targetId = String(transition.objective_id || transition.next_objective_id || "");
        if (targetId && byId.has(targetId)) {
          links.push({
            sourceId,
            targetId,
            kind: objectiveCompletionControl(objective) === "choice" ? "choice" : objectiveUsesAiOutcomeRouting(objective) ? "outcome" : "next",
            label: transition.title || transition.id || "",
            outputIndex,
            sourceOutputCount: transitions.length
          });
        } else if (objectiveOutputIsEnding(transition) && !targetId) {
          links.push({
            sourceId,
            targetId: `terminal:${sourceId}:${transition.id || links.length}`,
            kind: "terminal",
            label: transition.ending_type || transition.id || "ending",
            terminal: true,
            outputIndex,
            sourceOutputCount: transitions.length
          });
        }
      }
    }
    return links;
  }
  function storyBuilderGraphComponents(objectives = [], edges = []) {
    const ids = objectives.map(objective => String(objective.id || "")).filter(Boolean);
    const adjacency = new Map(ids.map(id => [id, new Set()]));
    for (const edge of edges) {
      if (!adjacency.has(edge.sourceId) || !adjacency.has(edge.targetId)) continue;
      adjacency.get(edge.sourceId).add(edge.targetId);
      adjacency.get(edge.targetId).add(edge.sourceId);
    }
    const seen = new Set();
    const components = [];
    for (const id of ids) {
      if (seen.has(id)) continue;
      const stack = [id];
      const componentIds = [];
      seen.add(id);
      while (stack.length) {
        const current = stack.pop();
        componentIds.push(current);
        for (const next of adjacency.get(current) || []) {
          if (seen.has(next)) continue;
          seen.add(next);
          stack.push(next);
        }
      }
      components.push(componentIds);
    }
    return components;
  }
  function storyBuilderEdgeCreatesCycle(edge, placedEdges = []) {
    const target = edge.targetId;
    const source = edge.sourceId;
    const adjacency = new Map();
    for (const item of placedEdges) {
      if (item.terminal || item.cycle) continue;
      adjacency.set(item.sourceId, [...(adjacency.get(item.sourceId) || []), item.targetId]);
    }
    const stack = [target];
    const seen = new Set();
    while (stack.length) {
      const current = stack.pop();
      if (current === source) return true;
      if (seen.has(current)) continue;
      seen.add(current);
      for (const next of adjacency.get(current) || []) stack.push(next);
    }
    return false;
  }
  function storyBuilderCycleEdges(componentIds, edges = []) {
    const adjacency = new Map();
    for (const edge of edges) {
      if (edge.terminal || !componentIds.has(edge.sourceId) || !componentIds.has(edge.targetId)) continue;
      adjacency.set(edge.sourceId, [...(adjacency.get(edge.sourceId) || []), edge]);
    }
    const color = new Map();
    const cycleEdges = new Set();
    for (const id of componentIds) {
      if (color.get(id)) continue;
      color.set(id, 1);
      const stack = [{
        id,
        index: 0,
        edges: adjacency.get(id) || []
      }];
      while (stack.length) {
        const frame = stack[stack.length - 1];
        if (frame.index >= frame.edges.length) {
          color.set(frame.id, 2);
          stack.pop();
          continue;
        }
        const edge = frame.edges[frame.index++];
        const targetColor = color.get(edge.targetId) || 0;
        if (targetColor === 1) {
          cycleEdges.add(edge);
          continue;
        }
        if (targetColor === 0) {
          color.set(edge.targetId, 1);
          stack.push({
            id: edge.targetId,
            index: 0,
            edges: adjacency.get(edge.targetId) || []
          });
        }
      }
    }
    return cycleEdges;
  }
  function storyBuilderLargeGraphSignature(objectives = [], edges = []) {
    return JSON.stringify([String(app.storyBuilder?.graphComponentId || "0"), objectives.map(objective => String(objective.id || "")), edges.map(edge => [edge.sourceId, edge.targetId, edge.kind, edge.label || "", edge.terminal === true])]);
  }
  function storyBuilderHydrateWorkerGraphLayout(result, objectives) {
    const byId = new Map(objectives.map(objective => [String(objective.id || ""), objective]));
    const hydrated = {
      ...result,
      objectives,
      displayEdges: (result.displayEdges || []).map(edge => ({
        ...edge
      }))
    };
    hydrated.warnings = result.warnings instanceof Set ? new Set(result.warnings) : new Set(result.warnings || []);
    hydrated.displayNodes = (result.displayNodes || []).map(node => ({
      ...node,
      objective: node.terminal === true ? node.objective : byId.get(String(node.realId || "")) || node.objective || {}
    }));
    hydrated.nodesByDisplayId = new Map(hydrated.displayNodes.map(node => [node.displayId, node]));
    hydrated.occupancy = (result.occupancy || []).map(row => row instanceof Int32Array ? row : Int32Array.from(row || []));
    return hydrated;
  }
  function storyBuilderCommitGraphLayout(builder, requestId, signature, layout, elapsedMilliseconds = 0) {
    if (!builder || builder.graphLayoutRequest?.requestId !== requestId || builder.graphLayoutRequest?.signature !== signature) return false;
    builder.graphLayoutCache = {
      signature,
      layout
    };
    builder.graphLayoutRequest = null;
    builder.status = `Graph ready (${Math.round(elapsedMilliseconds).toLocaleString()} ms)`;
    return true;
  }
  function storyBuilderLargeGraphWorkerSource() {
    return `
                const app = { storyBuilder: { graphComponentId: "0" } };
                let workerEdges = [];
                function clamp(value, min, max) {
                    return Math.min(max, Math.max(min, value));
                }
                function storyBuilderObjectiveList(draft) {
                    return Array.isArray(draft?.objectives) ? draft.objectives : [];
                }
                function storyBuilderValidationWarningIds() {
                    return new Set();
                }
                function storyBuilderRawGraphEdges() {
                    return workerEdges;
                }
                ${storyBuilderGraphComponents.toString()}
                ${storyBuilderCycleEdges.toString()}
                ${buildStoryBuilderObjectiveGraphLayout.toString()}
                self.onmessage = (event) => {
                    try {
                        const payload = event.data || {};
                        workerEdges = payload.edges || [];
                        app.storyBuilder.graphComponentId = String(payload.componentId || "0");
                        const result = buildStoryBuilderObjectiveGraphLayout({
                            objectives: payload.objectives || [],
                        });
                        self.postMessage({ ok: true, result });
                    } catch (error) {
                        self.postMessage({
                            ok: false,
                            error: error?.message || String(error),
                        });
                    }
                };
            `;
  }
  function storyBuilderRequestLargeGraphLayout(objectives, edges, signature) {
    const builder = app.storyBuilder;
    if (!builder) return Promise.reject(new Error("Story Builder is closed."));
    if (builder.graphLayoutRequest?.signature === signature && builder.graphLayoutRequest.promise) return builder.graphLayoutRequest.promise;
    builder.graphLayoutRequest?.cancel?.();
    const requestId = (Number(builder.graphLayoutGeneration) || 0) + 1;
    builder.graphLayoutGeneration = requestId;
    const source = storyBuilderLargeGraphWorkerSource();
    const workerUrl = URL.createObjectURL(new Blob([source], {
      type: "text/javascript"
    }));
    const worker = new Worker(workerUrl, {
      name: "emberadventures-lite-story-graph-layout"
    });
    URL.revokeObjectURL(workerUrl);
    const startedAt = performance.now();
    builder.status = `Laying out ${objectives.length.toLocaleString()} objectives...`;
    let cancelRequest = null;
    const promise = new Promise((resolve, reject) => {
      let settled = false;
      const finish = (callback, value) => {
        if (settled) return;
        settled = true;
        worker.terminate();
        callback(value);
      };
      cancelRequest = () => {
        const error = new Error("Graph layout request was replaced.");
        error.canceled = true;
        finish(reject, error);
      };
      worker.onmessage = event => {
        const response = event.data || {};
        if (!response.ok) {
          finish(reject, new Error(response.error || "Graph layout failed."));
          return;
        }
        finish(resolve, storyBuilderHydrateWorkerGraphLayout(response.result || {}, objectives));
      };
      worker.onerror = event => {
        finish(reject, generatedWorkerError("Story graph layout worker", event));
      };
      worker.postMessage({
        objectives,
        edges,
        componentId: String(builder.graphComponentId || "0")
      });
    }).then(layout => {
      if (storyBuilderCommitGraphLayout(app.storyBuilder, requestId, signature, layout, performance.now() - startedAt) && app.storyBuilder.panel === "tree") renderStoryBuilder();
      return layout;
    }).catch(error => {
      const activeRequest = app.storyBuilder?.graphLayoutRequest;
      if (error?.canceled) return null;
      if (app.storyBuilder && activeRequest?.requestId === requestId && activeRequest?.signature === signature) {
        app.storyBuilder.graphLayoutRequest = null;
        app.storyBuilder.status = error.message || String(error);
        showNotice("Story Graph Layout Failed", error.message || String(error));
      }
      throw error;
    });
    builder.graphLayoutRequest = {
      signature,
      requestId,
      promise,
      cancel: cancelRequest
    };
    return promise;
  }
  function storyBuilderGraphLayoutForRender(draft, objectives) {
    if (objectives.length <= 400) return buildStoryBuilderObjectiveGraphLayout(draft);
    const edges = storyBuilderRawGraphEdges(objectives);
    const signature = storyBuilderLargeGraphSignature(objectives, edges);
    const cached = app.storyBuilder?.graphLayoutCache;
    if (cached?.signature === signature) {
      return storyBuilderHydrateWorkerGraphLayout(cached.layout, objectives);
    }
    storyBuilderRequestLargeGraphLayout(objectives.map(objective => ({
      id: String(objective.id || ""),
      title: String(objective.title || ""),
      kind: objective.kind,
      type: objective.type,
      status: objective.status,
      completion_control: objective.completion_control
    })), edges, signature).catch(() => {});
    if (cached?.layout) {
      const previous = storyBuilderHydrateWorkerGraphLayout(cached.layout, objectives);
      previous.pending = true;
      previous.stale = true;
      return previous;
    }
    return {
      objectives,
      components: [objectives.map(objective => String(objective.id || ""))],
      componentIndex: 0,
      displayNodes: [],
      displayEdges: [],
      nodesByDisplayId: new Map(),
      warnings: new Set(),
      width: 960,
      height: 640,
      columnCount: 1,
      rows: 0,
      occupancy: [],
      routeChannelCount: 0,
      pending: true
    };
  }
  function buildStoryBuilderObjectiveGraphLayout(draft = app.storyBuilder?.draft) {
    const objectives = storyBuilderObjectiveList(draft);
    const byId = new Map(objectives.map(objective => [String(objective.id || ""), objective]));
    const warnings = storyBuilderValidationWarningIds(draft);
    const rawEdges = storyBuilderRawGraphEdges(objectives);
    const components = storyBuilderGraphComponents(objectives, rawEdges.filter(edge => byId.has(edge.targetId)));
    const selectedComponentId = app.storyBuilder?.graphComponentId && components[Number(app.storyBuilder.graphComponentId)] ? String(app.storyBuilder.graphComponentId) : "0";
    const componentIndex = clamp(Number(selectedComponentId) || 0, 0, Math.max(0, components.length - 1));
    const componentIds = new Set(components[componentIndex] || objectives.map(objective => String(objective.id || "")));
    const displayEdges = [];
    const cycleEdges = storyBuilderCycleEdges(componentIds, rawEdges);
    for (const edge of rawEdges) {
      if (!componentIds.has(edge.sourceId)) continue;
      if (edge.terminal) {
        displayEdges.push(edge);
        continue;
      }
      if (!componentIds.has(edge.targetId)) continue;
      if (cycleEdges.has(edge)) {
        displayEdges.push({
          ...edge,
          cycle: true,
          targetId: `cycle:${edge.sourceId}:${edge.targetId}`,
          realTargetId: edge.targetId
        });
      } else {
        displayEdges.push(edge);
      }
    }
    const rowById = new Map([...componentIds].map(id => [id, 0]));
    const outgoing = new Map();
    const incomingCount = new Map([...componentIds].map(id => [id, 0]));
    for (const edge of displayEdges) {
      if (edge.terminal || edge.cycle) continue;
      outgoing.set(edge.sourceId, [...(outgoing.get(edge.sourceId) || []), edge.targetId]);
      incomingCount.set(edge.targetId, (incomingCount.get(edge.targetId) || 0) + 1);
    }
    const queue = [...componentIds].filter(id => (incomingCount.get(id) || 0) === 0);
    let queueIndex = 0;
    while (queueIndex < queue.length) {
      const sourceId = queue[queueIndex++];
      const sourceRow = rowById.get(sourceId) || 0;
      for (const targetId of outgoing.get(sourceId) || []) {
        rowById.set(targetId, Math.max(rowById.get(targetId) || 0, sourceRow + 1));
        const remaining = (incomingCount.get(targetId) || 0) - 1;
        incomingCount.set(targetId, remaining);
        if (remaining === 0) queue.push(targetId);
      }
    }
    const displayNodes = [];
    for (const id of componentIds) {
      const objective = byId.get(id);
      if (!objective) continue;
      displayNodes.push({
        displayId: id,
        realId: id,
        objective,
        row: rowById.get(id) || 0,
        virtual: false
      });
    }
    for (const edge of displayEdges) {
      if (!edge.cycle && !edge.terminal) continue;
      const source = byId.get(edge.sourceId);
      displayNodes.push({
        displayId: edge.targetId,
        realId: edge.realTargetId || "",
        objective: edge.terminal ? {
          id: edge.targetId,
          title: edge.label || "Terminal",
          kind: "terminal",
          completion_control: "terminal"
        } : byId.get(edge.realTargetId) || source,
        row: rowById.get(edge.targetId) || (rowById.get(edge.sourceId) || 0) + 1,
        virtual: true,
        terminal: edge.terminal === true,
        cycleCopy: edge.cycle === true
      });
    }
    const rows = new Map();
    for (const node of displayNodes) {
      const row = rows.get(node.row) || [];
      row.push(node);
      rows.set(node.row, row);
    }
    const objectiveOrder = new Map(objectives.map((objective, index) => [String(objective.id || ""), index]));
    for (const row of rows.values()) {
      row.sort((a, b) => (objectiveOrder.get(a.realId) ?? Number.MAX_SAFE_INTEGER) - (objectiveOrder.get(b.realId) ?? Number.MAX_SAFE_INTEGER));
    }
    const linkedNodes = new Map();
    for (const edge of displayEdges) {
      linkedNodes.set(edge.sourceId, [...(linkedNodes.get(edge.sourceId) || []), edge.targetId]);
      linkedNodes.set(edge.targetId, [...(linkedNodes.get(edge.targetId) || []), edge.sourceId]);
    }
    const rowIndexes = [...rows.keys()].sort((a, b) => a - b);
    for (let sweep = 0; sweep < 6; sweep++) {
      const orderedRows = sweep % 2 ? [...rowIndexes].reverse() : rowIndexes;
      const positions = new Map();
      for (const row of rows.values()) row.forEach((node, index) => positions.set(node.displayId, index));
      for (const rowIndex of orderedRows) {
        const row = rows.get(rowIndex) || [];
        row.sort((a, b) => {
          const barycenter = node => {
            const neighbors = (linkedNodes.get(node.displayId) || []).map(id => positions.get(id)).filter(Number.isFinite);
            return neighbors.length ? neighbors.reduce((sum, value) => sum + value, 0) / neighbors.length : positions.get(node.displayId) || 0;
          };
          return barycenter(a) - barycenter(b) || (objectiveOrder.get(a.realId) ?? Number.MAX_SAFE_INTEGER) - (objectiveOrder.get(b.realId) ?? Number.MAX_SAFE_INTEGER);
        });
        row.forEach((node, index) => positions.set(node.displayId, index));
      }
    }
    const widest = Math.max(1, ...[...rows.values()].map(row => row.length));
    const columnCount = Math.max(1, widest * 2 - 1);
    const cellW = 190;
    const rowH = 116;
    const padX = 80;
    const padY = 70;
    const maxRow = Math.max(0, ...displayNodes.map(node => node.row));
    for (const [rowIndex, row] of rows.entries()) {
      const startCol = Math.max(0, Math.floor((columnCount - (row.length * 2 - 1)) / 2));
      row.forEach((node, index) => {
        node.col = startCol + index * 2;
        node.x = padX + node.col * cellW;
        node.y = padY + (maxRow - rowIndex) * rowH;
      });
    }
    const nodesByDisplayId = new Map(displayNodes.map(node => [node.displayId, node]));
    let routeChannelCount = 0;
    for (const edge of displayEdges) {
      const source = nodesByDisplayId.get(edge.sourceId);
      const target = nodesByDisplayId.get(edge.targetId);
      if (!source || !target) continue;
      if (Math.abs(Number(source.row) - Number(target.row)) <= 1) continue;
      edge.routeChannel = routeChannelCount++ % 24;
    }
    const routeWidth = Math.min(routeChannelCount, 24) * 14;
    const width = padX * 2 + columnCount * cellW + 260 + routeWidth;
    const height = padY * 2 + (maxRow + 1) * rowH;
    const routeBaseX = padX + columnCount * cellW + 54;
    for (const edge of displayEdges) {
      if (!Number.isInteger(edge.routeChannel)) continue;
      edge.routeX = routeBaseX + edge.routeChannel * 14;
    }
    const occupancy = Array.from({
      length: maxRow + 1
    }, () => new Int32Array(columnCount).fill(-1));
    displayNodes.forEach((node, index) => {
      if (occupancy[node.row] && node.col >= 0 && node.col < columnCount) occupancy[node.row][node.col] = index;
    });
    return {
      objectives,
      components,
      componentIndex,
      displayNodes,
      displayEdges,
      nodesByDisplayId,
      warnings,
      width,
      height,
      columnCount,
      rows: maxRow + 1,
      occupancy,
      routeChannelCount
    };
  }
  function storyBuilderLinkGeometry(source, target, edge = {}) {
    const nodeWidth = 184;
    const nodeHeight = 64;
    const sourceAboveTarget = Number(source.y) < Number(target.y);
    const sx = Number(source.x) + nodeWidth / 2;
    const sy = Number(source.y) + (sourceAboveTarget ? nodeHeight : 0);
    const tx = Number(target.x) + nodeWidth / 2;
    const ty = Number(target.y) + (sourceAboveTarget ? 0 : nodeHeight);
    const midY = (sy + ty) / 2;
    let points = null;
    if (Number.isFinite(Number(edge.routeX))) {
      const direction = ty < sy ? -1 : 1;
      const sourceGapY = sy + direction * 26;
      const targetGapY = ty - direction * 26;
      const routeX = Number(edge.routeX);
      points = [{
        x: sx,
        y: sy
      }, {
        x: sx,
        y: sourceGapY
      }, {
        x: routeX,
        y: sourceGapY
      }, {
        x: routeX,
        y: targetGapY
      }, {
        x: tx,
        y: targetGapY
      }, {
        x: tx,
        y: ty
      }];
    } else {
      points = [{
        x: sx,
        y: sy
      }, {
        x: sx,
        y: midY
      }, {
        x: tx,
        y: midY
      }, {
        x: tx,
        y: ty
      }];
    }
    const segments = [];
    for (let index = 1; index < points.length; index++) {
      const start = points[index - 1];
      const end = points[index];
      const horizontal = Math.abs(end.y - start.y) < 0.001;
      segments.push({
        start,
        end,
        horizontal,
        length: horizontal ? Math.abs(end.x - start.x) : Math.abs(end.y - start.y)
      });
    }
    return {
      points,
      segments,
      path: points.map((point, index) => `${index ? "L" : "M"} ${point.x} ${point.y}`).join(" ")
    };
  }
  function storyBuilderLinkPath(source, target, edge = {}) {
    return storyBuilderLinkGeometry(source, target, edge).path;
  }
  function storyBuilderGraphLabelText(value = "") {
    const text = String(value || "").trim();
    return text.length > 44 ? `${text.slice(0, 41)}...` : text;
  }
  const storyBuilderGraphLabelWidths = new Map();
  function storyBuilderGraphLabelWidth(text = "") {
    const value = String(text || "");
    if (storyBuilderGraphLabelWidths.has(value)) return storyBuilderGraphLabelWidths.get(value);
    let width = value.length * 7.6 + 8;
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (context) {
      context.font = "14px system-ui, sans-serif";
      width = context.measureText(value).width + 12;
    }
    width = Math.max(36, Math.min(330, Math.ceil(width)));
    storyBuilderGraphLabelWidths.set(value, width);
    return width;
  }
  function storyBuilderGraphRectGridKeys(rect, cellSize = 96) {
    const keys = [];
    const left = Math.floor(rect.left / cellSize);
    const right = Math.floor(rect.right / cellSize);
    const top = Math.floor(rect.top / cellSize);
    const bottom = Math.floor(rect.bottom / cellSize);
    for (let x = left; x <= right; x++) for (let y = top; y <= bottom; y++) keys.push(`${x}:${y}`);
    return keys;
  }
  function storyBuilderGraphEdgeRenderData(layout = {}, options = {}) {
    const selectedId = String(options.selectedId || "");
    const spatial = new Map();
    const addRect = rect => {
      for (const key of storyBuilderGraphRectGridKeys(rect)) {
        const entries = spatial.get(key) || [];
        entries.push(rect);
        spatial.set(key, entries);
      }
    };
    const intersects = (first, second) => first.left < second.right && first.right > second.left && first.top < second.bottom && first.bottom > second.top;
    const collides = rect => {
      const checked = new Set();
      for (const key of storyBuilderGraphRectGridKeys(rect)) {
        for (const other of spatial.get(key) || []) {
          if (checked.has(other)) continue;
          checked.add(other);
          if (intersects(rect, other)) return true;
        }
      }
      return false;
    };
    for (const node of layout.displayNodes || []) {
      const left = Number(node.x) - 8;
      const selected = selectedId && String(node.realId || node.displayId) === selectedId;
      const top = Number(node.y) - (selected ? 82 : 8);
      addRect({
        left,
        top,
        right: left + 200,
        bottom: Number(node.y) + 72
      });
    }
    const results = [];
    for (const edge of layout.displayEdges || []) {
      const source = layout.nodesByDisplayId?.get(edge.sourceId);
      const target = layout.nodesByDisplayId?.get(edge.targetId);
      if (!source || !target) continue;
      const geometry = storyBuilderLinkGeometry(source, target, edge);
      let label = null;
      const fullText = String(edge.label || "").trim();
      if (fullText && Number(edge.sourceOutputCount || 0) > 1) {
        const text = storyBuilderGraphLabelText(fullText);
        const width = storyBuilderGraphLabelWidth(text);
        const horizontalSegments = geometry.segments.filter(segment => segment.horizontal && segment.length >= 20).sort((a, b) => b.length - a.length);
        const verticalSegments = geometry.segments.filter(segment => !segment.horizontal && segment.length >= 20).sort((a, b) => b.length - a.length);
        const candidates = [];
        for (const segment of horizontalSegments) {
          for (const fraction of [0.5, 0.35, 0.65, 0.2, 0.8]) {
            const x = segment.start.x + (segment.end.x - segment.start.x) * fraction;
            for (const offset of [5, -12, 26, -34, 48, -56, 72, -80, 96, -104, 128, -136]) candidates.push({
              x,
              y: segment.start.y + offset,
              anchor: "middle"
            });
          }
        }
        for (const segment of verticalSegments) {
          for (const fraction of [0.5, 0.35, 0.65, 0.2, 0.8]) {
            const y = segment.start.y + (segment.end.y - segment.start.y) * fraction + 5;
            for (const offset of [14, -14, 32, -32, 52, -52, 76, -76, 104, -104, 136, -136]) candidates.push({
              x: segment.start.x + offset,
              y,
              anchor: offset > 0 ? "start" : "end"
            });
          }
        }
        for (const candidate of candidates) {
          const left = candidate.anchor === "middle" ? candidate.x - width / 2 : candidate.anchor === "end" ? candidate.x - width : candidate.x;
          const rect = {
            left,
            top: candidate.y - 15,
            right: left + width,
            bottom: candidate.y + 5
          };
          if (rect.left < 4 || rect.top < 4 || rect.right > Number(layout.width || 0) - 4 || rect.bottom > Number(layout.height || 0) - 4 || collides(rect)) continue;
          label = {
            ...candidate,
            text,
            fullText,
            rect
          };
          addRect(rect);
          break;
        }
        if (!label && candidates[0]) label = {
          ...candidates[0],
          text,
          fullText,
          rect: null
        };
      }
      results.push({
        edge,
        source,
        target,
        geometry,
        label
      });
    }
    return results;
  }
  function storyBuilderToggleInspectorFocus() {
    const builder = app.storyBuilder;
    const overlay = $("storyBuilderOverlay");
    if (!builder || !overlay) return false;
    builder.inspectorFocus = builder.inspectorFocus !== true;
    overlay.classList.toggle("inspector-focus", builder.inspectorFocus);
    return builder.inspectorFocus;
  }
  function storyBuilderToggleNodeList() {
    const builder = app.storyBuilder;
    if (!builder) return false;
    builder.nodeListOpen = builder.nodeListOpen !== true;
    renderStoryBuilder();
    return builder.nodeListOpen;
  }
  function storyBuilderCloseMobileInspector() {
    if (!app.storyBuilder) return false;
    storyBuilderToggleDetailsPanel(false);
    return true;
  }
  function captureStoryBuilderTreePanelView() {
    const stack = document.querySelector(".story-builder-inspector-stack");
    if (!stack) return null;
    const active = document.activeElement;
    const focus = active instanceof HTMLElement && stack.contains(active) ? {
      id: active.id || "",
      treeObjectiveField: active.dataset?.treeObjectiveField || "",
      treeJsonField: active.dataset?.treeJsonField || "",
      statePath: active.dataset?.statePath || "",
      outcomeRouteIndex: active.dataset?.outcomeRouteIndex || "",
      outcomeRouteField: active.dataset?.outcomeRouteField || "",
      selectionStart: typeof active.selectionStart === "number" ? active.selectionStart : null,
      selectionEnd: typeof active.selectionEnd === "number" ? active.selectionEnd : null
    } : null;
    return {
      selectedObjectiveId: app.storyBuilder?.selectedObjectiveId || "",
      stackScrollTop: stack.scrollTop || 0,
      panelBodyScrollTop: stack.closest(".story-builder-panel-body")?.scrollTop || 0,
      nodeListScrollTop: stack.querySelector(".story-builder-node-list")?.scrollTop || 0,
      mainScrollTop: document.querySelector(".story-builder-main")?.scrollTop || 0,
      openDetailIndexes: [...stack.querySelectorAll("details")].map((details, index) => details.open ? index : -1).filter(index => index >= 0),
      focus
    };
  }
  function storyBuilderTreePanelFocusTarget(stack, focus) {
    if (!stack || !focus) return null;
    const fields = [...stack.querySelectorAll("input, textarea, select, button")];
    return fields.find(field => focus.id && field.id === focus.id) || fields.find(field => focus.treeObjectiveField && field.dataset?.treeObjectiveField === focus.treeObjectiveField) || fields.find(field => focus.treeJsonField && field.dataset?.treeJsonField === focus.treeJsonField) || fields.find(field => focus.statePath && field.dataset?.statePath === focus.statePath) || fields.find(field => focus.outcomeRouteField && field.dataset?.outcomeRouteIndex === focus.outcomeRouteIndex && field.dataset?.outcomeRouteField === focus.outcomeRouteField) || null;
  }
  function restoreStoryBuilderTreePanelView(view) {
    const stack = document.querySelector(".story-builder-inspector-stack");
    if (!view || !stack || String(app.storyBuilder?.selectedObjectiveId || "") !== String(view.selectedObjectiveId || "")) return false;
    const details = [...stack.querySelectorAll("details")];
    for (const [index, item] of details.entries()) item.open = view.openDetailIndexes.includes(index);
    const nodeList = stack.querySelector(".story-builder-node-list");
    const main = document.querySelector(".story-builder-main");
    const panelBody = stack.closest(".story-builder-panel-body");
    if (nodeList) nodeList.scrollTop = view.nodeListScrollTop || 0;
    if (main) main.scrollTop = view.mainScrollTop || 0;
    if (panelBody) panelBody.scrollTop = view.panelBodyScrollTop || 0;
    stack.scrollTop = view.stackScrollTop || 0;
    const focusTarget = storyBuilderTreePanelFocusTarget(stack, view.focus);
    if (focusTarget) {
      focusTarget.focus({
        preventScroll: true
      });
      if (view.focus.selectionStart != null && typeof focusTarget.setSelectionRange === "function") focusTarget.setSelectionRange(view.focus.selectionStart, view.focus.selectionEnd);
    }
    if (panelBody) panelBody.scrollTop = view.panelBodyScrollTop || 0;
    stack.scrollTop = view.stackScrollTop || 0;
    return true;
  }
  function storyBuilderRenderPreservingTreePanel(options = {}) {
    const builder = app.storyBuilder;
    if (!builder) return false;
    const run = () => {
      builder.treePanelRenderFrame = 0;
      const view = captureStoryBuilderTreePanelView();
      renderStoryBuilder();
      restoreStoryBuilderTreePanelView(view);
      requestAnimationFrame(() => restoreStoryBuilderTreePanelView(view));
    };
    if (options.defer === true) {
      if (builder.treePanelRenderFrame) cancelAnimationFrame(builder.treePanelRenderFrame);
      builder.treePanelRenderFrame = requestAnimationFrame(run);
      return true;
    }
    run();
    return true;
  }
  function renderStoryBuilderTreePanel(draft) {
    const objectives = storyBuilderObjectiveList(draft);
    const tree = storyBuilderEnsureTreeLayout(draft);
    const layout = storyBuilderGraphLayoutForRender(draft, objectives);
    const startingId = storyBuilderStartingObjectiveId(draft);
    const selectedId = app.storyBuilder?.selectedObjectiveId && objectives.some(item => String(item.id) === String(app.storyBuilder.selectedObjectiveId)) ? app.storyBuilder.selectedObjectiveId : objectives[0]?.id || "";
    if (app.storyBuilder) app.storyBuilder.selectedObjectiveId = selectedId;
    const checks = storyBuilderValidationChecks(draft);
    const issueCount = checks.filter(check => !check.ok).length;
    const zoom = clamp(Number(tree.viewport?.zoom) || 1, STORY_BUILDER_TREE_ZOOM_MIN, STORY_BUILDER_TREE_ZOOM_MAX);
    const panX = Number(tree.viewport?.x) || 0;
    const panY = Number(tree.viewport?.y) || 0;
    const search = String(app.storyBuilder?.graphSearch || "");
    const searchLower = search.trim().toLowerCase();
    const pendingLinkSourceId = String(app.storyBuilder?.pendingGraphLinkSourceId || "");
    const edgeRenderData = storyBuilderGraphEdgeRenderData(layout, {
      selectedId
    });
    const searchMatches = objectives.filter(objective => {
      if (!searchLower) return true;
      return JSON.stringify(objective).toLowerCase().includes(searchLower);
    });
    return `
                <section class="story-builder-tree-center">
                    <div class="story-builder-tree-toolbar">
                        <div class="story-builder-graph-toolbar-row">
                            <button type="button" class="story-builder-toolbar-panel-toggle left" title="Show story editor menu" aria-label="Show story editor menu" onclick="EmberAdventures.storyBuilderToggleNavigationPanel(true)">&#9776; Menu</button>
                            <button type="button" title="Fit nodes" onclick="EmberAdventures.storyBuilderFitTree()">&#9974; Fit</button>
                            <button type="button" title="Show or hide the objective list" onclick="EmberAdventures.storyBuilderToggleNodeList()">&#9776; List</button>
                            <label>Graph
                                <select onchange="EmberAdventures.setStoryBuilderGraphComponent(this.value)">
                                    ${layout.components.map((ids, index) => `<option value="${index}" ${index === layout.componentIndex ? "selected" : ""}>${index + 1}: ${ids.length} node${ids.length === 1 ? "" : "s"}</option>`).join("")}
                                </select>
                            </label>
                            <label>Find <input type="search" value="${escapeHtml(search)}" oninput="EmberAdventures.setStoryBuilderGraphSearch(this.value)"></label>
                            <button type="button" class="story-builder-toolbar-panel-toggle right" title="Show node editor" aria-label="Show node editor" onclick="EmberAdventures.storyBuilderToggleDetailsPanel(true)">Node &#10094;</button>
                        </div>
                        <div class="row">
                            <span class="story-builder-validation-pill ${issueCount ? "bad" : ""}">${issueCount ? `${issueCount} issue${issueCount === 1 ? "" : "s"}` : "No blocking issues"}</span>
                            <span class="hint">${pendingLinkSourceId ? "Choose the objective that should come next, or cancel Link Node in the inspector." : "The graph is automatic. Select a node to edit it or use its focused actions."}</span>
                        </div>
                    </div>
                    <div class="story-builder-tree-layout auto-graph">
                        <div id="storyBuilderGraphViewport" class="story-builder-graph" style="--graph-pan-x:${panX}px;--graph-pan-y:${panY}px;--graph-grid-size:${32 * zoom}px">
                            <div id="storyBuilderTreeCanvas" class="story-builder-tree-canvas auto-graph" data-graph-width="${Math.round(layout.width)}" data-graph-height="${Math.round(layout.height)}" data-graph-layout-pending="${layout.pending ? "1" : "0"}" style="--graph-width:${Math.round(layout.width)}px;--graph-height:${Math.round(layout.height)}px;--graph-zoom:${zoom};transform:translate(${panX}px, ${panY}px) scale(${zoom})">
                            <svg class="story-builder-link-layer" viewBox="0 0 ${Math.round(layout.width)} ${Math.round(layout.height)}" style="width:${Math.round(layout.width)}px;height:${Math.round(layout.height)}px" aria-hidden="true">
                                <defs>
                                    <marker id="storyBuilderArrow" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto" markerUnits="strokeWidth">
                                        <path d="M0,0 L0,6 L9,3 z" fill="currentColor"></path>
                                    </marker>
                                    <marker id="storyBuilderArrowMuted" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto" markerUnits="strokeWidth">
                                        <path d="M0,0 L0,6 L9,3 z" fill="currentColor"></path>
                                    </marker>
                                </defs>
                                ${edgeRenderData.map(({
      edge: link,
      source,
      geometry,
      label
    }) => {
      const sourceObjective = source.objective || {};
      const color = storyBuilderGraphBehaviorColor(sourceObjective);
      const labelWidth = label ? storyBuilderGraphLabelWidth(label.text) : 0;
      const labelLeft = label ? label.anchor === "middle" ? label.x - labelWidth / 2 : label.anchor === "end" ? label.x - labelWidth : label.x : 0;
      const labelHtml = label ? `<g class="story-builder-link-label-group" data-story-builder-link-label data-link-source-id="${escapeHtml(link.sourceId)}" data-link-output-index="${Number(link.outputIndex) || 0}" data-graph-label-x="${Math.round(label.x)}" data-graph-label-y="${Math.round(label.y)}" data-full-label="${escapeHtml(label.fullText)}"><title>${escapeHtml(label.fullText)}</title><rect class="story-builder-link-label-background" x="${Math.round(labelLeft - 2)}" y="${Math.round(label.y - 15)}" width="${Math.round(labelWidth + 4)}" height="20" rx="3"></rect><text x="${Math.round(label.x)}" y="${Math.round(label.y)}" text-anchor="${escapeHtml(label.anchor)}" class="story-builder-link-label">${escapeHtml(label.text)}</text></g>` : "";
      return `<path class="story-builder-link ${escapeHtml(link.kind)} ${link.cycle ? "cycle" : ""} ${link.terminal ? "terminal" : ""}" style="stroke:${escapeHtml(color)};color:${escapeHtml(color)}" d="${escapeHtml(geometry.path)}"></path>${labelHtml}`;
    }).join("")}
                            </svg>
                            ${layout.displayNodes.map((node, index) => {
      const objective = node.objective || {};
      const id = String(objective.id || node.displayId || "");
      const selected = String(node.realId || id) === String(selectedId);
      const ring = storyBuilderGraphBehaviorColor(objective);
      const fill = node.virtual ? "transparent" : storyBuilderGraphFillColor(objective, layout.warnings);
      const title = node.terminal ? "Terminal" : objective.title || node.realId || id || "Objective";
      const objectiveIndex = objectives.findIndex(item => String(item.id || "") === String(node.realId || id));
      const linkSource = pendingLinkSourceId && String(node.realId || id) === pendingLinkSourceId;
      const linkTarget = pendingLinkSourceId && !linkSource && !node.virtual && !node.terminal;
      return `
                                        <div role="button" tabindex="${node.terminal ? "-1" : "0"}"
                                             class="${storyBuilderNodeClass(objective, selectedId, layout.warnings)} auto-node ${node.virtual ? "virtual" : ""} ${node.terminal ? "terminal-marker" : ""} ${selected ? "selected" : ""} ${linkSource ? "link-source" : ""} ${linkTarget ? "link-target" : ""}"
                                             data-tree-node-id="${escapeHtml(node.realId || id)}"
                                             style="left:${Math.round(node.x)}px;top:${Math.round(node.y)}px;--node-ring:${escapeHtml(ring)};--node-fill:${escapeHtml(fill)}"
                                             ${node.terminal ? "" : `onclick="EmberAdventures.storyBuilderSelectObjective(${htmlJsArg(node.realId || id)}, event)" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();EmberAdventures.storyBuilderSelectObjective(${htmlJsArg(node.realId || id)},event)}"`}
                                             aria-disabled="${node.terminal ? "true" : "false"}">
                                            ${selected && !node.virtual && !node.terminal ? `
                                                <span class="story-builder-node-actions">
                                                    <button type="button" class="story-builder-node-action" title="Add next node" aria-label="Add next node" onclick="event.stopPropagation();EmberAdventures.storyBuilderAddNextObjective()">+</button>
                                                    <button type="button" class="story-builder-node-action" title="${pendingLinkSourceId ? "Cancel link" : "Link node"}" aria-label="${pendingLinkSourceId ? "Cancel link" : "Link node"}" onclick="event.stopPropagation();EmberAdventures.storyBuilderStartLinkObjective()">&#128279;</button>
                                                </span>
                                            ` : ""}
                                            <span class="story-builder-node-index">${node.terminal ? "T" : objectiveIndex + 1}</span>
                                            ${!node.terminal && !node.virtual && String(node.realId || id) === startingId ? `<span class="story-builder-node-start-icon" title="Starting objective" aria-label="Starting objective">&#9873;</span>` : ""}
                                            <span class="story-builder-node-dot-label">${escapeHtml(title)}${node.cycleCopy ? " (continues)" : ""}</span>
                                        </div>
                                    `;
    }).join("") || `
                                    <div style="padding:1rem">
                                        ${layout.pending ? `<p class="hint">Computing layout for ${objectives.length.toLocaleString()} objectives...</p>` : `<button class="primary" type="button" onclick="EmberAdventures.storyBuilderAddNextObjective()">+ Add Opening Node</button>`}
                                    </div>
                                `}
                            </div>
                        </div>
                    </div>
                </section>
                <aside class="story-builder-details">
                    <div class="story-builder-panel-head">
                        <h2>Node Details</h2>
                        <span class="spacer"></span>
                        <button type="button" class="story-builder-panel-collapse right" title="Hide node editor" aria-label="Hide node editor" onclick="EmberAdventures.storyBuilderToggleDetailsPanel(false)">&#10095;</button>
                    </div>
                    <div class="story-builder-panel-body">
                        <div class="story-builder-inspector-stack">
                            ${renderStoryBuilderTreeInspector(draft, selectedId, checks)}
                            ${app.storyBuilder?.nodeListOpen ? `
                                <aside class="story-builder-inspector">
                                    <h3>Nodes</h3>
                                    <div class="story-builder-node-list">
                                        ${searchMatches.map(objective => `<button type="button" data-story-builder-node-list-id="${escapeHtml(objective.id || "")}" onclick="EmberAdventures.storyBuilderSelectObjective(${htmlJsArg(objective.id || "")})">${escapeHtml(objective.title || objective.id || "Objective")}</button>`).join("") || `<p class="hint">No matching nodes.</p>`}
                                    </div>
                                    <div class="hint">${layout.rows} row${layout.rows === 1 ? "" : "s"}, ${layout.columnCount} column${layout.columnCount === 1 ? "" : "s"}</div>
                                </aside>
                            ` : ""}
                        </div>
                    </div>
                </aside>
            `;
  }
  function storyBuilderEnsurePlayerChoiceOptions(objective = {}) {
    if (objectiveDirectChoiceOptions(objective).length) return;
    objective.choices = [{
      id: "option-a",
      title: "Option A",
      summary: "",
      player_text: "",
      rewards: []
    }, {
      id: "option-b",
      title: "Option B",
      summary: "",
      player_text: "",
      rewards: []
    }];
  }
  function storyBuilderEnsureAiOutcomeRoutes(objective = {}) {
    if (objectiveOutcomeRoutes(objective).length) return;
    objective.outcome_routes = [{
      id: "outcome-a",
      criteria: "Describe when the first outcome should be selected.",
      requirements: [],
      rewards: [],
      next_objective_id: "",
      fallback: false
    }, {
      id: "fallback",
      criteria: "Use this outcome when no other outcome applies.",
      requirements: [],
      rewards: [],
      next_objective_id: "",
      fallback: true
    }];
  }
  function storyBuilderSetStartingObjective(id = "") {
    const builder = app.storyBuilder;
    const objective = storyBuilderObjectiveById(id, builder?.draft);
    if (!builder?.draft || !objective) return false;
    if (objectiveIsSide(objective)) {
      showNotice("Starting Objective Must Be Main Story", "Turn off Side Objective before making this the starting objective.");
      return false;
    }
    builder.draft.state.objectives.active_id = String(objective.id || "");
    storyBuilderApplyDerivedObjectiveInitialState(builder.draft);
    builder.dirty = true;
    builder.status = "Starting objective changed";
    storyBuilderQueueAutosave();
    storyBuilderRenderPreservingTreePanel();
    return true;
  }
  function storyBuilderSetObjectiveControlMode(mode = "player") {
    const builder = app.storyBuilder;
    const objective = storyBuilderObjectiveById(builder?.selectedObjectiveId, builder?.draft);
    if (!objective) return false;
    const control = mode === "ai" ? "ai" : "player";
    const priorRows = storyBuilderObjectiveOutputRows(objective).map(row => clone(row));
    objective.type = objectiveIsSide(objective) ? "side" : "story";
    objective.completion_control = control;
    delete objective.requirement_check_only;
    objective.next_objectives = priorRows;
    delete objective.choices;
    delete objective.choice_options;
    delete objective.outcome_routes;
    delete objective.route_control;
    if (control !== "ai") delete objective.evaluate_ai_on_activation;
    storyBuilderCanonicalizeOutputStorage(objective, storyBuilderObjectiveOutputMode(objective, builder.draft));
    builder.dirty = true;
    builder.status = `Control mode changed to ${control === "ai" ? "AI" : "Player"}`;
    storyBuilderQueueAutosave();
    storyBuilderRenderPreservingTreePanel();
    return true;
  }
  function storyBuilderSetObjectiveEditorType(type = "standard") {
    const builder = app.storyBuilder;
    const objective = storyBuilderObjectiveById(builder?.selectedObjectiveId, builder?.draft);
    if (!objective) return false;
    const nextType = ["dialogue", "branch", "transition"].includes(type) ? type : "standard";
    const control = storyBuilderObjectiveControlMode(objective);
    delete objective.dialogue_lines;
    delete objective.choice_response_mode;
    delete objective.choices;
    delete objective.choice_options;
    delete objective.route_control;
    delete objective.outcome_routes;
    delete objective.requirement_check_only;
    if (nextType === "transition") {
      objective.type = objectiveIsSide(objective) ? "side" : "story";
      objective.completion_control = "reward_only";
      objective.requirement_check_only = true;
      delete objective.evaluate_ai_on_activation;
      delete objective.completion_criteria;
    } else if (nextType === "dialogue") {
      objective.type = objectiveIsSide(objective) ? "side" : "story";
      objective.completion_control = control;
      objective.dialogue_lines = [];
    } else if (nextType === "branch") {
      objective.type = objectiveIsSide(objective) ? "side" : "story";
      if (control === "ai") {
        objective.completion_control = "ai";
        objective.route_control = "ai";
        storyBuilderEnsureAiOutcomeRoutes(objective);
      } else {
        objective.completion_control = "choice";
        objective.choice_response_mode = "optional_text";
        delete objective.completion_criteria;
        storyBuilderEnsurePlayerChoiceOptions(objective);
      }
    } else {
      objective.type = objectiveIsSide(objective) ? "side" : "story";
      objective.completion_control = control;
    }
    builder.dirty = true;
    builder.status = "Objective type changed";
    storyBuilderQueueAutosave();
    storyBuilderRenderPreservingTreePanel();
    return true;
  }
  function storyBuilderSetChoiceResponseMode(mode = "optional_text") {
    const builder = app.storyBuilder;
    const objective = storyBuilderObjectiveById(builder?.selectedObjectiveId, builder?.draft);
    if (!objective || storyBuilderObjectiveEditorType(objective) !== "branch" || storyBuilderObjectiveControlMode(objective) !== "player") return false;
    objective.choice_response_mode = mode === "exact_text" ? "exact_text" : "optional_text";
    if (objective.choice_response_mode === "exact_text") {
      for (const choice of objective.choices || []) {
        if (!isPlainObject(choice)) continue;
        choice.player_text = textSlot(choice.player_text || choice.playerText, choice.title || "");
      }
    }
    builder.dirty = true;
    builder.status = "Player choice response mode changed";
    storyBuilderQueueAutosave();
    storyBuilderRenderPreservingTreePanel();
    return true;
  }

  //#region Guided Story Objective Editor

  function storyBuilderObjectiveChoiceEnabled(objective = {}) {
    return storyBuilderObjectiveControlMode(objective) === "player" && objectiveCompletionControl(objective) === "choice";
  }
  function storyBuilderObjectiveAutoComplete(objective = {}) {
    return storyBuilderObjectiveControlMode(objective) === "ai" && (objectiveEvaluatesAiOnActivation(objective) || objectiveCompletionControl(objective) === "reward_only");
  }
  function storyBuilderObjectiveRequirementCheckOnly(objective = {}) {
    return objectiveCompletionControl(objective) === "reward_only";
  }
  function storyBuilderObjectiveOutputModeStore(draft = app.storyBuilder?.draft) {
    const tree = storyBuilderTreeEditorData(draft);
    if (!isPlainObject(tree.output_modes)) tree.output_modes = {};
    return tree.output_modes;
  }
  function storyBuilderObjectiveOutputRows(objective = {}) {
    if (storyBuilderObjectiveChoiceEnabled(objective)) return Array.isArray(objective.choices) ? objective.choices : [];
    if (objectiveRouteControl(objective) === "ai") return Array.isArray(objective.outcome_routes) ? objective.outcome_routes : [];
    return Array.isArray(objective.next_objectives) ? objective.next_objectives : [];
  }
  function storyBuilderObjectiveOutputMode(objective = {}, draft = app.storyBuilder?.draft) {
    const stored = String(storyBuilderObjectiveOutputModeStore(draft)[objective.id] || "");
    if (["one", "multiple"].includes(stored)) return stored;
    return storyBuilderObjectiveOutputRows(objective).length > 1 ? "multiple" : "one";
  }
  function storyBuilderOutputStableId(objective = {}, row = {}, index = 0) {
    return textSlot(row.id || row.output_id || row.route_id, `${objective.id || "objective"}-output-${index + 1}`);
  }
  function storyBuilderNewOutputRow(objective = {}, index = 0) {
    const id = uniqueObjectiveId(`${objective.id || "objective"}-output`, new Set(storyBuilderObjectiveOutputRows(objective).map((row, rowIndex) => storyBuilderOutputStableId(objective, row, rowIndex))), "output");
    const common = {
      id,
      requirements: [],
      rewards: [],
      completion_instruction: "",
      dialogue_lines: [],
      travel_location_id: "",
      target_input_group_id: generatedPersistentId("input-group")
    };
    if (storyBuilderObjectiveChoiceEnabled(objective)) return {
      ...common,
      title: "",
      summary: "",
      player_text: "",
      next_objective_id: ""
    };
    if (objectiveRouteControl(objective) === "ai") return {
      ...common,
      criteria: "",
      fallback: index === 0,
      next_objective_id: ""
    };
    return {
      ...common,
      objective_id: ""
    };
  }
  function storyBuilderExactOutputRow(row = {}, fields = []) {
    const output = {};
    for (const field of fields) if (Object.hasOwn(row, field)) output[field] = clone(row[field]);
    return output;
  }
  function storyBuilderCanonicalOutputFields(row = {}, fields = [], targetField = "next_objective_id") {
    const output = storyBuilderExactOutputRow(row, fields);
    if (output.ending_type) {
      delete output[targetField];
      delete output.target_input_group_id;
    }
    return output;
  }
  function storyBuilderEnsureOutputRows(objective = {}, count = 1) {
    const requested = Math.max(0, Number(count) || 0);
    if (storyBuilderObjectiveChoiceEnabled(objective)) {
      objective.choices = Array.isArray(objective.choices) ? objective.choices : [];
      while (objective.choices.length < requested) objective.choices.push(storyBuilderNewOutputRow(objective, objective.choices.length));
      return objective.choices;
    }
    if (objectiveRouteControl(objective) === "ai") {
      objective.outcome_routes = Array.isArray(objective.outcome_routes) ? objective.outcome_routes : [];
      while (objective.outcome_routes.length < requested) objective.outcome_routes.push(storyBuilderNewOutputRow(objective, objective.outcome_routes.length));
      delete objective.next_objectives;
      return objective.outcome_routes;
    }
    objective.next_objectives = Array.isArray(objective.next_objectives) ? objective.next_objectives : [];
    while (objective.next_objectives.length < requested) objective.next_objectives.push(storyBuilderNewOutputRow(objective, objective.next_objectives.length));
    return objective.next_objectives;
  }
  function storyBuilderCanonicalizeOutputStorage(objective = {}, mode = storyBuilderObjectiveOutputMode(objective)) {
    const choice = storyBuilderObjectiveChoiceEnabled(objective);
    const requirementOnly = storyBuilderObjectiveRequirementCheckOnly(objective);
    const aiRoutes = mode === "multiple" && storyBuilderObjectiveControlMode(objective) === "ai" && !requirementOnly;
    const currentRows = storyBuilderObjectiveOutputRows(objective).map(row => clone(row));
    if (choice) {
      objective.choices = (currentRows.length ? currentRows : [storyBuilderNewOutputRow(objective, 0)]).map((row, index) => {
        const output = {
          ...storyBuilderCanonicalOutputFields(row, STORY_CHOICE_OUTPUT_FIELDS),
          id: storyBuilderOutputStableId(objective, row, index)
        };
        if (!output.ending_type) output.next_objective_id = textSlot(row.next_objective_id || row.objective_id, "");
        return output;
      });
      delete objective.next_objectives;
      delete objective.outcome_routes;
      delete objective.route_control;
      return objective.choices;
    }
    if (aiRoutes) {
      objective.route_control = "ai";
      objective.outcome_routes = (currentRows.length ? currentRows : [storyBuilderNewOutputRow(objective, 0)]).map((row, index) => {
        const output = {
          ...storyBuilderCanonicalOutputFields(row, STORY_ROUTE_OUTPUT_FIELDS),
          id: storyBuilderOutputStableId(objective, row, index),
          criteria: textSlot(row.criteria, ""),
          fallback: row.fallback === true
        };
        if (!output.ending_type) output.next_objective_id = textSlot(row.next_objective_id || row.objective_id, "");
        return output;
      });
      delete objective.next_objectives;
      return objective.outcome_routes;
    }
    delete objective.route_control;
    delete objective.outcome_routes;
    objective.next_objectives = (currentRows.length ? currentRows : [storyBuilderNewOutputRow(objective, 0)]).map((row, index) => {
      const output = {
        ...storyBuilderCanonicalOutputFields(row, STORY_NEXT_OUTPUT_FIELDS, "objective_id"),
        id: storyBuilderOutputStableId(objective, row, index)
      };
      if (!output.ending_type) output.objective_id = textSlot(row.objective_id || row.next_objective_id, "");
      return output;
    });
    return objective.next_objectives;
  }
  function storyBuilderSetChoiceObjective(enabled = false) {
    const objective = storyBuilderObjectiveById(app.storyBuilder?.selectedObjectiveId, app.storyBuilder?.draft);
    if (!objective || storyBuilderObjectiveControlMode(objective) !== "player") return false;
    const priorRows = storyBuilderObjectiveOutputRows(objective).map(row => clone(row));
    if (enabled) {
      objective.completion_control = "choice";
      objective.choice_response_mode ||= "optional_text";
      delete objective.evaluate_ai_on_activation;
      delete objective.completion_criteria;
      delete objective.outcome_routes;
      delete objective.route_control;
      objective.choices = priorRows;
      storyBuilderEnsureOutputRows(objective, 1);
    } else {
      objective.completion_control = "player";
      delete objective.choice_response_mode;
      delete objective.choices;
      objective.next_objectives = priorRows;
      storyBuilderEnsureOutputRows(objective, 1);
    }
    storyBuilderCanonicalizeOutputStorage(objective, storyBuilderObjectiveOutputMode(objective));
    app.storyBuilder.dirty = true;
    app.storyBuilder.status = enabled ? "Player choice enabled" : "Player choice disabled";
    storyBuilderQueueAutosave();
    storyBuilderRenderPreservingTreePanel();
    return true;
  }
  function storyBuilderSetObjectiveOutputMode(mode = "one") {
    const builder = app.storyBuilder;
    const objective = storyBuilderObjectiveById(builder?.selectedObjectiveId, builder?.draft);
    if (!objective) return false;
    const nextMode = mode === "multiple" ? "multiple" : "one";
    storyBuilderObjectiveOutputModeStore(builder.draft)[objective.id] = nextMode;
    storyBuilderCanonicalizeOutputStorage(objective, nextMode);
    storyBuilderEnsureOutputRows(objective, nextMode === "multiple" ? Math.max(1, storyBuilderObjectiveOutputRows(objective).length) : 1);
    builder.dirty = true;
    builder.status = `Outputs changed to ${nextMode}`;
    storyBuilderQueueAutosave();
    storyBuilderRenderPreservingTreePanel();
    return true;
  }
  function storyBuilderSetObjectiveAutoComplete(enabled = false) {
    const objective = storyBuilderObjectiveById(app.storyBuilder?.selectedObjectiveId, app.storyBuilder?.draft);
    if (!objective || storyBuilderObjectiveControlMode(objective) !== "ai") return false;
    if (enabled) {
      objective.completion_control = "ai";
      objective.evaluate_ai_on_activation = true;
    } else {
      objective.completion_control = "ai";
      delete objective.evaluate_ai_on_activation;
      delete objective.requirement_check_only;
    }
    storyBuilderCanonicalizeOutputStorage(objective, storyBuilderObjectiveOutputMode(objective));
    app.storyBuilder.dirty = true;
    app.storyBuilder.status = enabled ? "Auto Complete enabled" : "Auto Complete disabled";
    storyBuilderQueueAutosave();
    storyBuilderRenderPreservingTreePanel();
    return true;
  }
  function storyBuilderSetRequirementCheckOnly(enabled = false) {
    const objective = storyBuilderObjectiveById(app.storyBuilder?.selectedObjectiveId, app.storyBuilder?.draft);
    if (!objective || !storyBuilderObjectiveAutoComplete(objective)) return false;
    if (enabled) {
      objective.completion_control = "reward_only";
      objective.requirement_check_only = true;
      delete objective.evaluate_ai_on_activation;
      delete objective.completion_criteria;
      delete objective.dialogue_lines;
      if (objective.type === "dialogue") objective.type = "story";
    } else {
      objective.completion_control = "ai";
      objective.evaluate_ai_on_activation = true;
      delete objective.requirement_check_only;
    }
    storyBuilderCanonicalizeOutputStorage(objective, storyBuilderObjectiveOutputMode(objective));
    app.storyBuilder.dirty = true;
    app.storyBuilder.status = enabled ? "Requirement Check Only enabled" : "Immediate AI completion check enabled";
    storyBuilderQueueAutosave();
    storyBuilderRenderPreservingTreePanel();
    return true;
  }
  function storyBuilderSetOutputEndingType(index = 0, endingType = "") {
    const objective = storyBuilderObjectiveById(app.storyBuilder?.selectedObjectiveId, app.storyBuilder?.draft);
    const row = storyBuilderOutputRow(objective, index);
    if (!objective || !row) return false;
    const next = ["freeplay", "ending", "game_over"].includes(endingType) ? endingType : "";
    if (next) {
      row.ending_type = next;
      delete row.next_objective_id;
      delete row.objective_id;
      delete row.target_input_group_id;
    } else delete row.ending_type;
    app.storyBuilder.dirty = true;
    storyBuilderQueueAutosave();
    storyBuilderRenderPreservingTreePanel();
    return true;
  }
  function storyBuilderAddOutput() {
    const objective = storyBuilderObjectiveById(app.storyBuilder?.selectedObjectiveId, app.storyBuilder?.draft);
    if (!objective) return false;
    const rows = storyBuilderEnsureOutputRows(objective, storyBuilderObjectiveOutputRows(objective).length + 1);
    storyBuilderObjectiveOutputModeStore()[objective.id] = "multiple";
    storyBuilderCanonicalizeOutputStorage(objective, "multiple");
    const canonicalRows = storyBuilderObjectiveOutputRows(objective);
    if (objectiveRouteControl(objective) === "ai" && !canonicalRows.some(row => row.fallback === true)) canonicalRows[canonicalRows.length - 1].fallback = true;
    app.storyBuilder.dirty = true;
    storyBuilderQueueAutosave();
    storyBuilderRenderPreservingTreePanel();
    return true;
  }
  function storyBuilderMoveOutput(index = 0, delta = 0) {
    const objective = storyBuilderObjectiveById(app.storyBuilder?.selectedObjectiveId, app.storyBuilder?.draft);
    const rows = storyBuilderObjectiveOutputRows(objective);
    const next = Number(index) + Number(delta);
    if (!objective || index < 0 || index >= rows.length || next < 0 || next >= rows.length) return false;
    [rows[index], rows[next]] = [rows[next], rows[index]];
    const fallbackIndex = rows.findIndex(row => row.fallback === true);
    if (fallbackIndex >= 0 && fallbackIndex !== rows.length - 1) {
      const [fallback] = rows.splice(fallbackIndex, 1);
      rows.push(fallback);
    }
    app.storyBuilder.dirty = true;
    storyBuilderQueueAutosave();
    storyBuilderRenderPreservingTreePanel();
    return true;
  }
  async function storyBuilderDeleteOutput(index = 0) {
    const objective = storyBuilderObjectiveById(app.storyBuilder?.selectedObjectiveId, app.storyBuilder?.draft);
    const rows = storyBuilderObjectiveOutputRows(objective);
    if (!objective || index < 0 || index >= rows.length) return false;
    if (!(await showConfirm("Delete Output", "Delete this output, including its dialogue, rewards, travel, and node link?", {
      confirmText: "Delete",
      danger: true
    }))) return false;
    rows.splice(index, 1);
    app.storyBuilder.dirty = true;
    storyBuilderQueueAutosave();
    storyBuilderRenderPreservingTreePanel();
    return true;
  }
  function storyBuilderOutputRow(objective = {}, index = 0) {
    return storyBuilderObjectiveOutputRows(objective)[Number(index)] || null;
  }
  function storyBuilderApplyOutputField(field) {
    const objective = storyBuilderObjectiveById(app.storyBuilder?.selectedObjectiveId, app.storyBuilder?.draft);
    const index = Number(field?.dataset?.storyOutputIndex || 0);
    const key = String(field?.dataset?.storyOutputField || "");
    const row = storyBuilderOutputRow(objective, index);
    if (!objective || !row || !key) return false;
    const value = String(field.type || "").toLowerCase() === "checkbox" ? !!field.checked : field.value;
    if (key === "next_objective_id") {
      row.next_objective_id = String(value || "");
      if (Object.hasOwn(row, "objective_id")) row.objective_id = row.next_objective_id;
    } else if (key === "ending_type") {
      storyBuilderSetOutputEndingType(index, String(value || ""));
      return true;
    } else if (key === "fallback") {
      for (const output of storyBuilderObjectiveOutputRows(objective)) output.fallback = output === row && !!value;
      const rows = storyBuilderObjectiveOutputRows(objective);
      const fallbackIndex = rows.indexOf(row);
      if (value && fallbackIndex >= 0 && fallbackIndex !== rows.length - 1) {
        rows.splice(fallbackIndex, 1);
        rows.push(row);
      }
    } else row[key] = value;
    app.storyBuilder.dirty = true;
    storyBuilderQueueAutosave();
    if (["fallback", "next_objective_id"].includes(key)) storyBuilderRenderPreservingTreePanel({
      defer: true
    });
    return true;
  }
  function storyBuilderToggleOutputDialogue(index = 0, enabled = false) {
    const objective = storyBuilderObjectiveById(app.storyBuilder?.selectedObjectiveId, app.storyBuilder?.draft);
    const row = storyBuilderOutputRow(objective, index);
    if (!row) return false;
    if (enabled) {
      if (!Array.isArray(row.dialogue_lines)) row.dialogue_lines = [];
      if (!row.dialogue_lines.length) row.dialogue_lines.push("");
    } else delete row.dialogue_lines;
    app.storyBuilder.dirty = true;
    storyBuilderQueueAutosave();
    storyBuilderRenderPreservingTreePanel();
    return true;
  }
  function storyBuilderAddDialogueLine(index = 0) {
    const objective = storyBuilderObjectiveById(app.storyBuilder?.selectedObjectiveId, app.storyBuilder?.draft);
    const row = storyBuilderOutputRow(objective, index);
    if (!row) return false;
    row.dialogue_lines ||= [];
    row.dialogue_lines.push("");
    app.storyBuilder.dirty = true;
    storyBuilderRenderPreservingTreePanel();
    return true;
  }
  function storyBuilderApplyDialogueLine(field) {
    const objective = storyBuilderObjectiveById(app.storyBuilder?.selectedObjectiveId, app.storyBuilder?.draft);
    const outputIndex = Number(field?.dataset?.storyOutputIndex || 0);
    const lineIndex = Number(field?.dataset?.storyDialogueIndex || 0);
    const row = storyBuilderOutputRow(objective, outputIndex);
    if (!row) return false;
    row.dialogue_lines ||= [];
    row.dialogue_lines[lineIndex] = String(field.value || "");
    app.storyBuilder.dirty = true;
    storyBuilderQueueAutosave();
    return true;
  }
  function storyBuilderRemoveDialogueLine(outputIndex = 0, lineIndex = 0) {
    const objective = storyBuilderObjectiveById(app.storyBuilder?.selectedObjectiveId, app.storyBuilder?.draft);
    const row = storyBuilderOutputRow(objective, outputIndex);
    if (!Array.isArray(row?.dialogue_lines)) return false;
    row.dialogue_lines.splice(Number(lineIndex), 1);
    if (!row.dialogue_lines.length) delete row.dialogue_lines;
    app.storyBuilder.dirty = true;
    storyBuilderQueueAutosave();
    storyBuilderRenderPreservingTreePanel();
    return true;
  }
  function storyBuilderApplyDialogueCharacter(field) {
    const objective = storyBuilderObjectiveById(app.storyBuilder?.selectedObjectiveId, app.storyBuilder?.draft);
    const outputIndex = Number(field?.dataset?.storyOutputIndex || 0);
    const lineIndex = Number(field?.dataset?.storyDialogueCharacter || 0);
    const row = storyBuilderOutputRow(objective, outputIndex);
    if (!row) return false;
    row.dialogue_lines ||= [];
    const parsed = storyBuilderDialogueLineParts(row.dialogue_lines[lineIndex] || "");
    const characterId = String(field.value || "");
    row.dialogue_lines[lineIndex] = characterId ? `(|[character:${characterId}]|) ${parsed.text}` : parsed.text;
    app.storyBuilder.dirty = true;
    storyBuilderQueueAutosave();
    return true;
  }
  function storyBuilderLocationEntries(draft = app.storyBuilder?.draft) {
    const state = draft?.state || {};
    return Object.entries(state.world_map?.locations || {}).map(([id, location]) => ({
      id,
      name: textSlot(location.name || location.label || location.title, id),
      type: textSlot(location.type, "Location"),
      parent: textSlot(location.parent_location_id || location.parent_id || location.region, "")
    })).sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name));
  }
  function storyBuilderLocationDisplayName(id = "", draft = app.storyBuilder?.draft) {
    const target = String(id || "");
    return storyBuilderLocationEntries(draft).find(entry => entry.id === target)?.name || "";
  }
  function openStoryBuilderNodePicker(outputIndex = 0) {
    const objective = storyBuilderObjectiveById(app.storyBuilder?.selectedObjectiveId, app.storyBuilder?.draft);
    if (!objective) return false;
    const choices = storyBuilderObjectiveList().filter(item => String(item.id || "") !== String(objective.id || ""));
    const popup = openPopupModal(`
                <h2>Select Next Node</h2>
                <input type="search" placeholder="Search nodes..." oninput="EmberAdventures.filterStoryBuilderPicker(this, '[data-story-node-picker-row]')">
                <div class="story-builder-modal-list">
                    <button type="button" data-story-node-picker-row data-search-text="none" onclick="EmberAdventures.selectStoryBuilderNodeTarget(${outputIndex}, '', this)">None</button>
                    ${choices.map(item => `<button type="button" data-story-node-picker-row data-search-text="${escapeHtml(`${storyBuilderObjectiveNumber(item.id)} ${item.title || ""}`)}" onclick="EmberAdventures.selectStoryBuilderNodeTarget(${outputIndex}, ${htmlJsArg(item.id)}, this)">#${storyBuilderObjectiveNumber(item.id)} ${escapeHtml(item.title || "Untitled")}</button>`).join("")}
                </div>
            `);
    popup.box?.querySelector?.('input[type="search"]')?.focus();
    return true;
  }
  function selectStoryBuilderNodeTarget(outputIndex = 0, targetId = "", button = null) {
    const objective = storyBuilderObjectiveById(app.storyBuilder?.selectedObjectiveId, app.storyBuilder?.draft);
    const row = storyBuilderOutputRow(objective, outputIndex);
    if (!row) return false;
    row.next_objective_id = String(targetId || "");
    if (Object.hasOwn(row, "objective_id")) row.objective_id = row.next_objective_id;
    if (row.next_objective_id && !row.target_input_group_id) row.target_input_group_id = generatedPersistentId("input-group");
    app.storyBuilder.dirty = true;
    storyBuilderQueueAutosave();
    if (button) closeContainingPopup(button);
    storyBuilderRenderPreservingTreePanel();
    return true;
  }
  function openStoryBuilderLocationPicker(outputIndex = 0) {
    const entries = storyBuilderLocationEntries();
    const groups = new Map();
    for (const entry of entries) {
      if (!groups.has(entry.type)) groups.set(entry.type, []);
      groups.get(entry.type).push(entry);
    }
    const popup = openPopupModal(`
                <h2>Select Travel Location</h2>
                <input type="search" placeholder="Search locations..." oninput="EmberAdventures.filterStoryBuilderPicker(this, '[data-story-location-picker-row]')">
                <div class="story-builder-modal-list">
                    <button type="button" data-story-location-picker-row data-search-text="none" onclick="EmberAdventures.selectStoryBuilderLocation(${outputIndex}, '', this)">None</button>
                    ${[...groups.entries()].map(([type, items]) => `
                                <section>
                                    <h3>${escapeHtml(humanizeIdentifierLabel(type))}</h3>
                                    ${items.map(entry => `<button type="button" data-story-location-picker-row data-search-text="${escapeHtml(`${entry.name} ${entry.type} ${entry.parent}`)}" onclick="EmberAdventures.selectStoryBuilderLocation(${outputIndex}, ${htmlJsArg(entry.id)}, this)">${escapeHtml(entry.name)}</button>`).join("")}
                                </section>`).join("")}
                </div>
            `);
    popup.box?.querySelector?.('input[type="search"]')?.focus();
    return true;
  }
  function selectStoryBuilderLocation(outputIndex = 0, locationId = "", button = null) {
    const objective = storyBuilderObjectiveById(app.storyBuilder?.selectedObjectiveId, app.storyBuilder?.draft);
    const row = storyBuilderOutputRow(objective, outputIndex);
    if (!row) return false;
    row.travel_location_id = String(locationId || "");
    if (!row.travel_location_id) delete row.travel_location_id;
    app.storyBuilder.dirty = true;
    storyBuilderQueueAutosave();
    if (button) closeContainingPopup(button);
    storyBuilderRenderPreservingTreePanel();
    return true;
  }
  function filterStoryBuilderPicker(input, selector = "") {
    const tokens = searchTokens(input?.value || "");
    input?.closest?.(".popup-box")?.querySelectorAll?.(selector).forEach(row => {
      row.hidden = !matchesSearchTokens(row.dataset.searchText || row.textContent || "", tokens);
    });
  }
  function storyBuilderRequirementCollection(scope = "completion", outputIndex = -1) {
    const objective = storyBuilderObjectiveById(app.storyBuilder?.selectedObjectiveId, app.storyBuilder?.draft);
    if (!objective) return null;
    if (scope === "completion") {
      objective.completion_requirements ||= [];
      return objective.completion_requirements;
    }
    const row = storyBuilderOutputRow(objective, outputIndex);
    if (!row) return null;
    row.requirements ||= [];
    return row.requirements;
  }
  function storyBuilderStateTargetEntries(draft = app.storyBuilder?.draft) {
    const state = draft?.state || {};
    const entries = [];
    const addObject = (value, path, prefix, depth = 0) => {
      if (!isPlainObject(value) || depth > 3) return;
      for (const [key, item] of Object.entries(value)) {
        if (["objectives", "messages", "snapshots", "profile_images", "images", "future_cast", "npc_directory", "characters", "players", "player"].includes(key)) continue;
        const nextPath = [...path, key];
        const label = `${prefix}: ${nextPath.slice(path.length ? 1 : 0).map(part => humanizeIdentifierLabel(part)).join(" / ")}`;
        if (item == null || ["string", "number", "boolean"].includes(typeof item) || Array.isArray(item)) entries.push({
          path: nextPath.join("."),
          label,
          value: item
        });else addObject(item, nextPath, prefix, depth + 1);
      }
    };
    addObject(state.story_inventory || {}, ["story_inventory"], "Story");
    addObject(state.location || {}, ["location"], "Location");
    addObject(state.scene || {}, ["scene"], "Scene");
    addObject(state.meta || {}, ["meta"], "Story Settings");
    return entries.sort((a, b) => a.label.localeCompare(b.label));
  }
  function openStoryBuilderRequirementEditor(scope = "completion", outputIndex = -1, requirementIndex = -1) {
    const collection = storyBuilderRequirementCollection(scope, outputIndex);
    if (!collection) return false;
    const existing = requirementIndex >= 0 ? collection[requirementIndex] : null;
    app.storyBuilder.requirementEditor = {
      scope,
      outputIndex,
      requirementIndex,
      draft: clone(existing || {
        type: "state_value",
        path: "",
        op: "==",
        value: ""
      })
    };
    const popup = openPopupModal(`<div data-story-requirement-editor></div>`);
    app.storyBuilder.requirementEditor.popup = popup;
    renderStoryBuilderRequirementEditor();
    return true;
  }
  function renderStoryBuilderRequirementEditor() {
    const editor = app.storyBuilder?.requirementEditor;
    const root = editor?.popup?.box?.querySelector?.("[data-story-requirement-editor]") || null;
    if (!editor || !root) return false;
    const draft = editor.draft || {};
    const type = textSlot(draft.type, "state_value");
    const characters = storyBuilderCharacterPickerEntries();
    const objectives = storyBuilderObjectiveList();
    const stateTargets = storyBuilderStateTargetEntries();
    const rules = Array.isArray(app.storyBuilder?.draft?.state?.story_rules) ? app.storyBuilder.draft.state.story_rules : [];
    const characterTypes = new Set(["party_member", "character_alive", "character_dead", "known_fact"]);
    const objectiveType = type === "objective_complete" || type === "objective_not_complete";
    root.innerHTML = `
                <h2>${editor.requirementIndex >= 0 ? "Edit" : "Add"} Requirement</h2>
                <label>Requirement Type
                    <select data-requirement-editor-field="type" onchange="EmberAdventures.updateStoryBuilderRequirementDraft(this)">
                        <option value="state_value" ${type === "state_value" ? "selected" : ""}>Story State Value</option>
                        <option value="story_rule" ${type === "story_rule" ? "selected" : ""}>Story Rule</option>
                        <option value="objective_complete" ${type === "objective_complete" ? "selected" : ""}>Objective Is Complete</option>
                        <option value="objective_not_complete" ${type === "objective_not_complete" ? "selected" : ""}>Objective Is Not Complete</option>
                        <option value="party_member" ${type === "party_member" ? "selected" : ""}>Character Is In Party</option>
                        <option value="character_alive" ${type === "character_alive" ? "selected" : ""}>Character Is Alive</option>
                        <option value="character_dead" ${type === "character_dead" ? "selected" : ""}>Character Is Dead</option>
                        <option value="known_fact" ${type === "known_fact" ? "selected" : ""}>Character Knows Fact</option>
                    </select>
                </label>
                ${type === "state_value" ? `
                            <label>State Target
                                <select class="${draft.path ? "" : "invalid"}" data-requirement-editor-field="path" onchange="EmberAdventures.updateStoryBuilderRequirementDraft(this)">
                                    <option value="">Select a story value</option>
                                    ${stateTargets.map(entry => `<option value="${escapeHtml(entry.path)}" ${entry.path === draft.path ? "selected" : ""}>${escapeHtml(entry.label)}</option>`).join("")}
                                </select>
                            </label>
                            <label>Comparison
                                <select data-requirement-editor-field="op" onchange="EmberAdventures.updateStoryBuilderRequirementDraft(this)">
                                    ${[["==", "Equals"], ["!=", "Does not equal"], [">=", "At least"], ["<=", "At most"], [">", "Greater than"], ["<", "Less than"], ["truthy", "Is enabled / present"], ["falsy", "Is disabled / absent"], ["includes", "Contains"], ["not_includes", "Does not contain"]].map(([value, label]) => `<option value="${value}" ${value === draft.op ? "selected" : ""}>${label}</option>`).join("")}
                                </select>
                            </label>
                            ${["truthy", "falsy"].includes(draft.op) ? "" : `<label>Required Value <input data-requirement-editor-field="value" value="${escapeHtml(draft.value ?? "")}" oninput="EmberAdventures.updateStoryBuilderRequirementDraft(this, false)"></label>`}
                        ` : ""}
                ${type === "story_rule" ? `<label>Story Rule
                            <select class="${draft.id ? "" : "invalid"}" data-requirement-editor-field="id" onchange="EmberAdventures.updateStoryBuilderRequirementDraft(this)">
                                <option value="">Select a story rule</option>
                                ${rules.map(rule => `<option value="${escapeHtml(rule.id)}" ${rule.id === draft.id ? "selected" : ""}>${escapeHtml(rule.text || rule.id)}</option>`).join("")}
                            </select>
                        </label>` : ""}
                ${objectiveType ? `<label>Objective
                            <select class="${draft.id ? "" : "invalid"}" data-requirement-editor-field="id" onchange="EmberAdventures.updateStoryBuilderRequirementDraft(this)">
                                <option value="">Select an objective</option>
                                ${objectives.map(objective => `<option value="${escapeHtml(objective.id)}" ${objective.id === draft.id ? "selected" : ""}>#${storyBuilderObjectiveNumber(objective.id)} ${escapeHtml(objective.title || "Untitled")}</option>`).join("")}
                            </select>
                        </label>` : ""}
                ${characterTypes.has(type) ? `<label>Character
                            <select class="${draft.target ? "" : "invalid"}" data-requirement-editor-field="target" onchange="EmberAdventures.updateStoryBuilderRequirementDraft(this)">
                                <option value="">Select a character</option>
                                ${characters.map(entry => `<option value="${escapeHtml(entry.id)}" ${entry.id === draft.target ? "selected" : ""}>${escapeHtml(entry.name)}</option>`).join("")}
                            </select>
                        </label>` : ""}
                ${type === "known_fact" ? `<label>Known Fact <input class="${draft.id ? "" : "invalid"}" data-requirement-editor-field="id" value="${escapeHtml(draft.id || "")}" placeholder="Known fact name" oninput="EmberAdventures.updateStoryBuilderRequirementDraft(this, false)"></label>` : ""}
                <div class="row">
                    ${editor.requirementIndex >= 0 ? `<button type="button" class="danger" onclick="EmberAdventures.deleteStoryBuilderRequirement()">Delete</button>` : ""}
                    <button type="button" onclick="EmberAdventures.closeStoryBuilderRequirementEditor()">Cancel</button>
                    <button type="button" class="primary" onclick="EmberAdventures.saveStoryBuilderRequirement()">Save Requirement</button>
                </div>`;
    return true;
  }
  function updateStoryBuilderRequirementDraft(field, rerender = true) {
    const editor = app.storyBuilder?.requirementEditor;
    const key = field?.dataset?.requirementEditorField;
    if (!editor || !key) return false;
    let value = field.value;
    if (key === "value") value = parseRequirementLiteral(value);
    editor.draft[key] = value;
    if (key === "type") {
      editor.draft = {
        type: value
      };
      if (value === "state_value") Object.assign(editor.draft, {
        path: "",
        op: "==",
        value: ""
      });else editor.draft.op = "truthy";
    }
    if (rerender) renderStoryBuilderRequirementEditor();
    return true;
  }
  function storyBuilderRequirementDraftValue() {
    const draft = clone(app.storyBuilder?.requirementEditor?.draft || {});
    if (draft.type === "state_value") {
      delete draft.type;
      return draft.path ? draft : null;
    }
    if (["objective_complete", "objective_not_complete", "story_rule"].includes(draft.type)) return draft.id ? draft : null;
    if (["party_member", "character_alive", "character_dead"].includes(draft.type)) return draft.target ? draft : null;
    if (draft.type === "known_fact") return draft.target && draft.id ? draft : null;
    return null;
  }
  function saveStoryBuilderRequirement() {
    const editor = app.storyBuilder?.requirementEditor;
    const collection = storyBuilderRequirementCollection(editor?.scope, editor?.outputIndex);
    const value = storyBuilderRequirementDraftValue();
    if (!editor || !collection || !value) {
      showNotice("Incomplete Requirement", "Select every required value before saving this requirement.");
      return false;
    }
    if (editor.requirementIndex >= 0) collection[editor.requirementIndex] = value;else collection.push(value);
    app.storyBuilder.dirty = true;
    storyBuilderQueueAutosave();
    editor.popup.close();
    delete app.storyBuilder.requirementEditor;
    storyBuilderRenderPreservingTreePanel();
    return true;
  }
  function deleteStoryBuilderRequirement() {
    const editor = app.storyBuilder?.requirementEditor;
    const collection = storyBuilderRequirementCollection(editor?.scope, editor?.outputIndex);
    if (!editor || !collection || editor.requirementIndex < 0) return false;
    collection.splice(editor.requirementIndex, 1);
    app.storyBuilder.dirty = true;
    storyBuilderQueueAutosave();
    editor.popup.close();
    delete app.storyBuilder.requirementEditor;
    storyBuilderRenderPreservingTreePanel();
    return true;
  }
  function closeStoryBuilderRequirementEditor() {
    const editor = app.storyBuilder?.requirementEditor;
    editor?.popup?.close?.();
    if (app.storyBuilder) delete app.storyBuilder.requirementEditor;
  }
  function storyBuilderRewardTypeGroups() {
    return [{
      label: "Characters and NPCs",
      items: ["introduce_future_character", "make_future_character_recruitable", "promote_future_character_to_party", "remove_character_shop_listing", "adjust_relationship", "kill_character"]
    }, {
      label: "Inventory and story items",
      items: ["add_item", "grant_item", "add_story_item", "adjust_story_inventory"]
    }, {
      label: "Outfits and clothing",
      items: ["grant_outfit", "equip_outfit", "delete_outfit", "delete_all_outfits"]
    }, {
      label: "Locations and time",
      items: ["unlock_location", "advance_time"]
    }, {
      label: "Story state and rules",
      items: ["add_story_rule", "remove_story_rule", "set_state_field", "modify_integer", "modify_number", "add_state_list_item", "remove_state_list_item"]
    }, {
      label: "Images",
      items: ["generate_profile_image", "generate_solo_normal_image", "generate_story_image"]
    }, {
      label: "Objectives and jobs",
      items: ["start_objective", "complete_objective", "complete_generated_job"]
    }, {
      label: "Reusable rewards",
      items: ["apply_reward_bundle", "apply_reward_template"]
    }];
  }
  function storyBuilderRewardCollection(outputIndex = 0) {
    const objective = storyBuilderObjectiveById(app.storyBuilder?.selectedObjectiveId, app.storyBuilder?.draft);
    if (!objective) return null;
    if (storyBuilderObjectiveOutputMode(objective) === "none") {
      objective.rewards = Array.isArray(objective.rewards) ? objective.rewards : [];
      return objective.rewards;
    }
    const row = storyBuilderOutputRow(objective, outputIndex);
    if (!row) return null;
    if (storyBuilderObjectiveOutputMode(objective) === "one" && !Array.isArray(row.rewards) && Array.isArray(objective.rewards)) row.rewards = clone(objective.rewards);
    row.rewards = Array.isArray(row.rewards) ? row.rewards : [];
    return row.rewards;
  }
  function storyBuilderReusableRewardCollection(kind = "bundle", id = "") {
    const state = app.storyBuilder?.draft?.state;
    const key = String(id || "");
    if (!state || !key) return null;
    if (kind === "template") {
      state.reward_templates ||= {};
      const entry = state.reward_templates[key];
      if (!isPlainObject(entry)) return null;
      entry.rewards = Array.isArray(entry.rewards) ? entry.rewards : [];
      return entry.rewards;
    }
    state.reward_bundles ||= {};
    const entry = state.reward_bundles[key];
    if (Array.isArray(entry)) return entry;
    if (!isPlainObject(entry)) return null;
    entry.rewards = Array.isArray(entry.rewards) ? entry.rewards : [];
    return entry.rewards;
  }
  function openStoryBuilderRewardEditor(outputIndex = 0, rewardIndex = -1, options = {}) {
    const scope = String(options.scope || "objective");
    const reusableKind = String(options.kind || "");
    const reusableId = String(options.id || "");
    const collection = scope === "reusable" ? storyBuilderReusableRewardCollection(reusableKind, reusableId) : storyBuilderRewardCollection(outputIndex);
    if (!collection) return false;
    const existing = rewardIndex >= 0 ? collection[rewardIndex] : null;
    app.storyBuilder.rewardEditor = {
      scope,
      reusableKind,
      reusableId,
      outputIndex: Number(outputIndex),
      rewardIndex: Number(rewardIndex),
      collection,
      draft: clone(existing || storyBuilderDefaultReward("introduce_future_character"))
    };
    const popup = openPopupModal(`<div data-story-reward-editor></div>`);
    popup.box.classList.add("story-builder-fullscreen-editor");
    app.storyBuilder.rewardEditor.popup = popup;
    renderStoryBuilderRewardEditor();
    return true;
  }
  function openStoryBuilderReusableRewardEditor(kind = "bundle", id = "", rewardIndex = -1) {
    return openStoryBuilderRewardEditor(0, rewardIndex, {
      scope: "reusable",
      kind,
      id
    });
  }
  function storyBuilderSelectOptions(entries = [], selected = "", placeholder = "Select") {
    return [`<option value="">${escapeHtml(placeholder)}</option>`, ...entries.map(entry => `<option value="${escapeHtml(entry.id)}" ${String(entry.id) === String(selected) ? "selected" : ""}>${escapeHtml(entry.name || entry.label || entry.id)}</option>`)].join("");
  }
  function storyBuilderRewardTemplateParameters(editor = app.storyBuilder?.rewardEditor) {
    if (editor?.scope !== "reusable" || editor.reusableKind !== "template") return {};
    return isPlainObject(app.storyBuilder?.draft?.state?.reward_templates?.[editor.reusableId]?.parameters) ? app.storyBuilder.draft.state.reward_templates[editor.reusableId].parameters : {};
  }
  function storyBuilderRewardParameterOptions(type = "") {
    return Object.entries(storyBuilderRewardTemplateParameters()).filter(([, definition]) => definition?.type === type).map(([name]) => `<option value="parameter:${escapeHtml(name)}">Parameter: ${escapeHtml(name)}</option>`).join("");
  }
  function storyBuilderRewardFieldValue(reward = {}, key = "") {
    const value = reward[key];
    if (isPlainObject(value) && textSlot(value.parameter, "")) return `parameter:${value.parameter}`;
    if (Array.isArray(value)) return value.join(".");
    return value ?? "";
  }
  function storyBuilderRewardSelect(label, key, entries, reward, options = {}) {
    const value = storyBuilderRewardFieldValue(reward, key);
    return `<label>${escapeHtml(label)}
                <select data-story-reward-field="${escapeHtml(key)}">
                    ${storyBuilderSelectOptions(entries, value, options.placeholder || "Select")}
                    ${options.parameterType ? storyBuilderRewardParameterOptions(options.parameterType) : ""}
                </select>
                ${options.hint ? `<span class="hint">${escapeHtml(options.hint)}</span>` : ""}
            </label>`;
  }
  function storyBuilderCharacterOutfitEntries(characterId = "") {
    const entry = storyBuilderCharacterPickerEntries().find(item => item.id === String(characterId || ""));
    if (!entry) return [];
    const definition = storyDefinitionCharacterEntries(app.storyBuilder?.draft).map(item => item.character).find(character => textSlot(character.id || character.character_id, "") === entry.id);
    return (definition?.outfits || []).map(outfit => ({
      id: textSlot(outfit.id, ""),
      name: textSlot(outfit.name, outfit.id)
    }));
  }
  function storyBuilderGrantOutfitMode(reward = {}) {
    if (isPlainObject(reward.outfit)) return "universal";
    if (isPlainObject(reward.male_outfit) && isPlainObject(reward.non_male_outfit)) return "both";
    if (isPlainObject(reward.male_outfit)) return "male";
    if (isPlainObject(reward.non_male_outfit)) return "non_male";
    return "universal";
  }
  function renderStoryBuilderGrantOutfitPresentation(reward = {}, presentation = "outfit", heading = "") {
    const outfit = isPlainObject(reward[presentation]) ? reward[presentation] : {
      id: "",
      name: "",
      clothing: {}
    };
    const clothing = isPlainObject(outfit.clothing) ? outfit.clothing : {};
    const rows = Object.entries(clothing);
    const unusedSlots = validClothingSlots().filter(slot => !Object.hasOwn(clothing, slot));
    return `
                ${heading ? `<strong>${escapeHtml(heading)}</strong>` : ""}
                <label>Outfit ID
                    <input data-story-reward-outfit-presentation="${escapeHtml(presentation)}" data-story-reward-outfit-field="id" value="${escapeHtml(outfit.id || "")}" placeholder="Stable outfit ID">
                </label>
                <label>Outfit Name
                    <input data-story-reward-outfit-presentation="${escapeHtml(presentation)}" data-story-reward-outfit-field="name" value="${escapeHtml(outfit.name || "")}" placeholder="Player-facing outfit name">
                </label>
                <label>Hosted Outfit Image URL
                    <input type="url" data-story-reward-outfit-presentation="${escapeHtml(presentation)}" data-story-reward-outfit-field="image.url" value="${escapeHtml(outfit.image?.url || outfit.image?.hosted_url || "")}" placeholder="https://.../image.png">
                </label>
                <label>Outfit Image Prompt
                    <textarea rows="2" data-story-reward-outfit-presentation="${escapeHtml(presentation)}" data-story-reward-outfit-field="image.prompt" placeholder="Used only when no hosted image is supplied">${escapeHtml(outfit.image?.prompt || outfit.image_prompt || "")}</textarea>
                </label>
                <div class="story-builder-guided-list">
                    ${rows.map(([slot, description]) => `
                                <div class="story-builder-dialogue-row">
                                    <select data-story-reward-outfit-presentation="${escapeHtml(presentation)}" data-story-reward-clothing-slot="${escapeHtml(slot)}">
                                        ${validClothingSlots().map(candidate => `<option value="${escapeHtml(candidate)}" ${candidate === slot ? "selected" : ""}>${escapeHtml(humanizeIdentifierLabel(candidate))}</option>`).join("")}
                                    </select>
                                    <input data-story-reward-outfit-presentation="${escapeHtml(presentation)}" data-story-reward-clothing-description="${escapeHtml(slot)}" value="${escapeHtml(description)}" placeholder="Clothing description">
                                    <button type="button" class="icon-button danger" onclick="EmberAdventures.removeStoryBuilderRewardClothing(${htmlJsArg(slot)}, ${htmlJsArg(presentation)})">&#10005;</button>
                                </div>`).join("")}
                </div>
                ${unusedSlots.length ? `<button type="button" onclick="EmberAdventures.addStoryBuilderRewardClothing(${htmlJsArg(unusedSlots[0])}, ${htmlJsArg(presentation)})">+ Clothing Piece</button>` : ""}`;
  }
  function renderStoryBuilderGrantOutfitFields(reward = {}) {
    const mode = storyBuilderGrantOutfitMode(reward);
    return `
                <label>Gender Presentation
                    <select onchange="EmberAdventures.setStoryBuilderGrantOutfitMode(this.value)">
                        <option value="universal" ${mode === "universal" ? "selected" : ""}>All genders</option>
                        <option value="male" ${mode === "male" ? "selected" : ""}>Male only</option>
                        <option value="non_male" ${mode === "non_male" ? "selected" : ""}>Non-male only</option>
                        <option value="both" ${mode === "both" ? "selected" : ""}>Separate male and non-male</option>
                    </select>
                </label>
                ${mode === "universal" ? renderStoryBuilderGrantOutfitPresentation(reward, "outfit") : ""}
                ${mode === "male" || mode === "both" ? renderStoryBuilderGrantOutfitPresentation(reward, "male_outfit", mode === "both" ? "Male Outfit" : "") : ""}
                ${mode === "non_male" || mode === "both" ? renderStoryBuilderGrantOutfitPresentation(reward, "non_male_outfit", mode === "both" ? "Non-Male Outfit" : "") : ""}
                <label class="check-row"><input type="checkbox" data-story-reward-field="equip" ${reward.equip === true ? "checked" : ""}> <span>Equip immediately</span></label>`;
  }
  function renderStoryBuilderRewardFields(reward = {}) {
    const type = textSlot(reward.type, "introduce_future_character");
    const characters = storyBuilderCharacterPickerEntries();
    const locations = storyBuilderLocationEntries();
    const objectives = storyBuilderObjectiveList().map(objective => ({
      id: objective.id,
      name: `#${storyBuilderObjectiveNumber(objective.id)} ${objective.title || "Untitled"}`
    }));
    const characterField = () => storyBuilderRewardSelect("Character", "character_id", characters, reward, {
      placeholder: "Select character",
      parameterType: "character_id"
    });
    const pathEntries = storyBuilderStateTargetEntries().map(entry => ({
      id: entry.path,
      name: entry.label
    }));
    const pathField = () => storyBuilderRewardSelect("State Target", "field_path", pathEntries, reward, {
      placeholder: "Select state target",
      parameterType: "path"
    });
    if (type === "remove_character_shop_listing") {
      const characterShops = Object.values(app.storyBuilder?.draft?.state?.story_shops || {}).filter(shop => String(shop?.type || "").trim().toLowerCase() === "character").map(shop => ({
        id: shop.id,
        name: shop.title || shop.id
      }));
      const selectedShop = app.storyBuilder?.draft?.state?.story_shops?.[textSlot(reward.shop_id, "")];
      const listedCharacters = (Array.isArray(selectedShop?.items) ? selectedShop.items : []).map(item => ({
        id: item.character_id,
        name: storyBuilderCharacterPickerEntries().find(entry => entry.id === item.character_id)?.name || humanizeIdentifierLabel(item.character_id)
      }));
      return storyBuilderRewardSelect("Character Shop", "shop_id", characterShops, reward, {
        placeholder: "Select character shop"
      }) + storyBuilderRewardSelect("Character Listing", "character_id", listedCharacters, reward, {
        placeholder: "Select listed character"
      });
    }
    if (["introduce_future_character", "make_future_character_recruitable", "promote_future_character_to_party", "adjust_relationship", "kill_character", "add_item", "grant_item", "grant_outfit", "equip_outfit", "delete_outfit", "delete_all_outfits", "generate_profile_image", "generate_solo_normal_image"].includes(type)) {
      const extra = [];
      if (type === "introduce_future_character") extra.push(storyBuilderRewardSelect("NPC Location", "npc_location_id", Object.entries(app.storyBuilder?.draft?.state?.npc_directory?.locations || {}).map(([id, location]) => ({
        id,
        name: location.label || id
      })), reward, {
        placeholder: "Select NPC location"
      }));
      if (["add_item", "grant_item"].includes(type)) extra.push(`<label>Item<input data-story-reward-field="item" value="${escapeHtml(reward.item || "")}" placeholder="Item name"></label>
                         <label>Quantity<input type="number" data-story-reward-field="quantity" value="${escapeHtml(reward.quantity ?? 1)}"></label>`);
      if (type === "adjust_relationship") extra.push(...["trust", "attraction", "affection"].map(field => `<label>${humanizeIdentifierLabel(field)}<input type="number" data-story-reward-field="${field}" value="${escapeHtml(reward[field] ?? 0)}"></label>`));
      if (type === "grant_outfit") extra.push(renderStoryBuilderGrantOutfitFields(reward));
      if (["equip_outfit", "delete_outfit", "generate_solo_normal_image"].includes(type)) extra.push(storyBuilderRewardSelect("Outfit", "outfit_id", storyBuilderCharacterOutfitEntries(storyBuilderRewardFieldValue(reward, "character_id")), reward, {
        placeholder: "Select outfit"
      }));
      if (type === "kill_character") extra.push(`<label>Death Note<textarea rows="2" data-story-reward-field="death_note" placeholder="What happened">${escapeHtml(reward.death_note || "")}</textarea></label>`);
      if (["generate_profile_image", "generate_solo_normal_image"].includes(type)) extra.push(`<label>Hosted Image URL<input type="url" data-story-reward-field="image.url" value="${escapeHtml(reward.image?.url || reward.image?.hosted_url || "")}" placeholder="https://.../image.png"></label>
                         <span class="hint">Use a real hosted image now, or leave this blank to generate from the character when the reward runs.</span>
                         <label>Image Prompt<textarea rows="3" data-story-reward-field="image.prompt" placeholder="Optional metadata for the hosted image">${escapeHtml(reward.image?.prompt || reward.prompt || "")}</textarea></label>
                         ${type === "generate_solo_normal_image" ? `<label>Solo Description<textarea rows="3" data-story-reward-field="description" placeholder="Optional appearance and clothing details; excludes pose, scene action, held items, and location">${escapeHtml(reward.description || "")}</textarea></label>
                         <label>Solo Background<textarea rows="2" data-story-reward-field="background" placeholder="Optional background; replaces the normal location/background">${escapeHtml(reward.background || "")}</textarea></label>` : ""}`);
      return characterField() + extra.join("");
    }
    if (type === "add_story_item") return `<label>Item ID<input data-story-reward-field="item.id" value="${escapeHtml(reward.item?.id || "")}" placeholder="Stable item ID"></label>
                    <label>Item Name<input data-story-reward-field="item.name" value="${escapeHtml(reward.item?.name || "")}" placeholder="Player-facing item name"></label>
                    <label>Description<textarea rows="2" data-story-reward-field="item.description" placeholder="Item description">${escapeHtml(reward.item?.description || "")}</textarea></label>
                    <label>Quantity<input type="number" data-story-reward-field="item.quantity" value="${escapeHtml(reward.item?.quantity ?? 1)}"></label>
                    <label>Hosted Image URL<input type="url" data-story-reward-field="item.image.url" value="${escapeHtml(reward.item?.image?.url || reward.item?.image?.hosted_url || "")}" placeholder="https://.../image.png"></label>
                    <label>Image Prompt<textarea rows="2" data-story-reward-field="item.image.prompt" placeholder="Used only when no hosted image is supplied">${escapeHtml(reward.item?.image?.prompt || reward.item?.image_prompt || "")}</textarea></label>`;
    if (type === "adjust_story_inventory") return `<label>Story Inventory Field<input data-story-reward-field="field" value="${escapeHtml(reward.field || "")}" placeholder="Flat story inventory field"></label>
                    <label>Amount<input type="number" data-story-reward-field="amount" value="${escapeHtml(reward.amount ?? 0)}"></label>`;
    if (type === "advance_time") return `<label>Minutes<input type="number" min="0" data-story-reward-field="minutes" value="${escapeHtml(reward.minutes ?? 0)}"></label>`;
    if (type === "unlock_location") return storyBuilderRewardSelect("Location", "location_id", locations, reward, {
      placeholder: "Select location"
    });
    if (["add_story_rule", "remove_story_rule"].includes(type)) return `<label>Story Rule<textarea rows="2" data-story-reward-field="rule" placeholder="Story rule">${escapeHtml(reward.rule || "")}</textarea></label>`;
    if (["set_state_field", "modify_integer", "modify_number", "add_state_list_item", "remove_state_list_item"].includes(type)) {
      const operation = ["modify_integer", "modify_number"].includes(type) ? `<label>Operation<select data-story-reward-field="operation">
                        ${["add", "subtract", "multiply", "divide"].map(item => `<option value="${item}" ${reward.operation === item ? "selected" : ""}>${humanizeIdentifierLabel(item)}</option>`).join("")}
                    </select></label>` : "";
      return `${pathField()}${operation}<label>Value<input data-story-reward-field="value" value="${escapeHtml(reward.value ?? reward.amount ?? "")}" placeholder="Value"></label>`;
    }
    if (type === "generate_story_image") return `<label>Image ID<input data-story-reward-field="id" value="${escapeHtml(reward.id || "")}" placeholder="Stable image ID"></label>
                    <label>Title<input data-story-reward-field="title" value="${escapeHtml(reward.title || "")}" placeholder="Image title"></label>
                    <label>Hosted Image URL<input type="url" data-story-reward-field="image.url" value="${escapeHtml(reward.image?.url || reward.image?.hosted_url || "")}" placeholder="https://.../image.png"></label>
                    <label>Image Prompt<textarea rows="4" data-story-reward-field="image.prompt" placeholder="Required only when no hosted image is supplied">${escapeHtml(reward.image?.prompt || reward.prompt || "")}</textarea></label>
                    <label>Negative Prompt<textarea rows="2" data-story-reward-field="image.negative_prompt" placeholder="Optional exclusions for generated images">${escapeHtml(reward.image?.negative_prompt || reward.negative_prompt || "")}</textarea></label>`;
    if (["start_objective", "complete_objective"].includes(type)) return storyBuilderRewardSelect("Objective", "objective_id", objectives, reward, {
      placeholder: "Select objective"
    });
    if (type === "complete_generated_job") return `<label>Generated Job ID<input data-story-reward-field="job_id" value="${escapeHtml(reward.job_id || "")}" placeholder="Generated job ID"></label>`;
    if (type === "apply_reward_bundle") return storyBuilderRewardSelect("Fixed Reward Bundle", "bundle_id", Object.keys(app.storyBuilder?.draft?.state?.reward_bundles || {}).map(id => ({
      id,
      name: storyBuilderReusableRewardTitle("bundle", id)
    })), reward, {
      placeholder: "Select bundle"
    });
    if (type === "apply_reward_template") {
      const templateId = textSlot(reward.template_id, "");
      const template = app.storyBuilder?.draft?.state?.reward_templates?.[templateId];
      return storyBuilderRewardSelect("Reward Template", "template_id", Object.keys(app.storyBuilder?.draft?.state?.reward_templates || {}).map(id => ({
        id,
        name: storyBuilderReusableRewardTitle("template", id)
      })), reward, {
        placeholder: "Select template"
      }) + Object.entries(template?.parameters || {}).map(([name, definition]) => {
        const argument = reward.arguments?.[name];
        return definition.type === "character_id" ? storyBuilderRewardSelect(`Argument: ${name}`, `arguments.${name}`, characters, {
          [`arguments.${name}`]: argument
        }, {
          placeholder: "Select character"
        }) : storyBuilderRewardSelect(`Argument: ${name}`, `arguments.${name}`, pathEntries, {
          [`arguments.${name}`]: Array.isArray(argument) ? argument.join(".") : argument
        }, {
          placeholder: "Select state target"
        });
      }).join("");
    }
    return `<p class="hint">No additional settings are required.</p>`;
  }
  function renderStoryBuilderRewardEditor() {
    const editor = app.storyBuilder?.rewardEditor;
    const root = editor?.popup?.box?.querySelector?.("[data-story-reward-editor]");
    if (!editor || !root) return false;
    const reward = editor.draft;
    root.innerHTML = `
                <h2>${editor.rewardIndex >= 0 ? "Edit Reward" : "New Reward"}</h2>
                <label>Reward Type
                    <select data-story-reward-type>
                        ${storyBuilderRewardTypeGroups().map(group => `<optgroup label="${escapeHtml(group.label)}">${group.items.map(type => `<option value="${type}" ${reward.type === type ? "selected" : ""}>${escapeHtml(storyBuilderRewardSummary({
      type
    }))}</option>`).join("")}</optgroup>`).join("")}
                    </select>
                </label>
                <div class="story-builder-guided-list">
                    ${renderStoryBuilderRewardFields(reward)}
                </div>
                <div class="stat-card"><strong>Preview</strong><div>${escapeHtml(storyBuilderRewardSummary(reward))}</div></div>
                <div class="row">
                    <button type="button" onclick="EmberAdventures.closeStoryBuilderRewardEditor()">Cancel</button>
                    ${editor.rewardIndex >= 0 ? `<button type="button" class="danger" onclick="EmberAdventures.deleteStoryBuilderReward()">Delete</button>` : ""}
                    <button type="button" class="primary" onclick="EmberAdventures.saveStoryBuilderReward()">Save Reward</button>
                </div>`;
    const type = root.querySelector("[data-story-reward-type]");
    if (type) type.onchange = () => {
      editor.draft = storyBuilderDefaultReward(type.value);
      renderStoryBuilderRewardEditor();
    };
    root.querySelectorAll("[data-story-reward-field]").forEach(field => {
      field.onchange = () => updateStoryBuilderRewardDraft(field);
      field.oninput = () => updateStoryBuilderRewardDraft(field, {
        rerender: false
      });
    });
    root.querySelectorAll("[data-story-reward-outfit-field]").forEach(field => {
      const eventName = field.tagName === "SELECT" ? "onchange" : "oninput";
      field[eventName] = () => updateStoryBuilderRewardOutfitField(field);
    });
    root.querySelectorAll("[data-story-reward-clothing-description]").forEach(field => {
      field.oninput = () => updateStoryBuilderRewardClothingDescription(field);
    });
    root.querySelectorAll("[data-story-reward-clothing-slot]").forEach(field => {
      field.onchange = () => renameStoryBuilderRewardClothingSlot(field);
    });
    return true;
  }
  function storyBuilderSetNestedValue(target = {}, path = "", value) {
    const parts = String(path || "").split(".").filter(Boolean);
    if (!parts.length) return false;
    let cursor = target;
    for (const part of parts.slice(0, -1)) {
      if (!isPlainObject(cursor[part])) cursor[part] = {};
      cursor = cursor[part];
    }
    cursor[parts.at(-1)] = value;
    return true;
  }
  function updateStoryBuilderRewardDraft(field, options = {}) {
    const editor = app.storyBuilder?.rewardEditor;
    const key = String(field?.dataset?.storyRewardField || "");
    if (!editor || !key) return false;
    let value = field.type === "checkbox" ? !!field.checked : field.type === "number" ? Number(field.value || 0) : field.value;
    if (/^parameter:/.test(String(value))) value = {
      parameter: String(value).slice(10)
    };else if (key === "field_path" || key.startsWith("arguments.") && storyBuilderRewardTemplateParameters()[key.split(".").at(-1)]?.type === "path") value = String(value || "").split(".").filter(Boolean);
    storyBuilderSetNestedValue(editor.draft, key, value);
    if (options.rerender !== false && ["character_id", "template_id", "shop_id"].includes(key)) renderStoryBuilderRewardEditor();
    return true;
  }
  function updateStoryBuilderRewardOutfitField(field) {
    const editor = app.storyBuilder?.rewardEditor;
    if (!editor) return false;
    const presentation = field.dataset.storyRewardOutfitPresentation || "outfit";
    editor.draft[presentation] ||= {
      id: "",
      name: "",
      clothing: {}
    };
    const rawValue = field.value;
    storyBuilderSetNestedValue(editor.draft[presentation], field.dataset.storyRewardOutfitField, rawValue);
    return true;
  }
  function setStoryBuilderGrantOutfitMode(mode = "universal") {
    const editor = app.storyBuilder?.rewardEditor;
    if (!editor) return false;
    const prior = editor.draft.outfit || editor.draft.male_outfit || editor.draft.non_male_outfit || {
      id: "",
      name: "",
      clothing: {}
    };
    delete editor.draft.outfit;
    delete editor.draft.male_outfit;
    delete editor.draft.non_male_outfit;
    if (mode === "both") {
      editor.draft.male_outfit = clone(prior);
      editor.draft.non_male_outfit = clone(prior);
    } else if (mode === "male") editor.draft.male_outfit = clone(prior);else if (mode === "non_male") editor.draft.non_male_outfit = clone(prior);else editor.draft.outfit = clone(prior);
    renderStoryBuilderRewardEditor();
    return true;
  }
  function addStoryBuilderRewardClothing(slot = "", presentation = "outfit") {
    const editor = app.storyBuilder?.rewardEditor;
    if (!editor || !slot) return false;
    editor.draft[presentation] ||= {
      id: "",
      name: "",
      clothing: {}
    };
    editor.draft[presentation].clothing ||= {};
    editor.draft[presentation].clothing[slot] = "";
    renderStoryBuilderRewardEditor();
    return true;
  }
  function removeStoryBuilderRewardClothing(slot = "", presentation = "outfit") {
    const editor = app.storyBuilder?.rewardEditor;
    if (!editor?.draft?.[presentation]?.clothing) return false;
    delete editor.draft[presentation].clothing[slot];
    renderStoryBuilderRewardEditor();
    return true;
  }
  function renameStoryBuilderRewardClothingSlot(field) {
    const editor = app.storyBuilder?.rewardEditor;
    const oldSlot = String(field?.dataset?.storyRewardClothingSlot || "");
    const nextSlot = String(field?.value || "");
    const presentation = field?.dataset?.storyRewardOutfitPresentation || "outfit";
    const clothing = editor?.draft?.[presentation]?.clothing;
    if (!clothing || !oldSlot || !nextSlot || oldSlot === nextSlot) return false;
    const description = clothing[oldSlot];
    delete clothing[oldSlot];
    clothing[nextSlot] = description;
    renderStoryBuilderRewardEditor();
    return true;
  }
  function updateStoryBuilderRewardClothingDescription(field) {
    const editor = app.storyBuilder?.rewardEditor;
    const slot = String(field?.dataset?.storyRewardClothingDescription || "");
    const presentation = field?.dataset?.storyRewardOutfitPresentation || "outfit";
    if (!editor?.draft?.[presentation]?.clothing || !slot) return false;
    editor.draft[presentation].clothing[slot] = field.value;
    return true;
  }
  function saveStoryBuilderReward() {
    const editor = app.storyBuilder?.rewardEditor;
    if (!editor?.collection) return false;
    const reward = clone(editor.draft);
    const draft = app.storyBuilder?.draft || {};
    const errors = editor.scope === "reusable" && editor.reusableKind === "template" ? rewardTemplateSchemaValidationErrors({
      preview: {
        parameters: draft.state?.reward_templates?.[editor.reusableId]?.parameters || {},
        rewards: [reward]
      }
    }, "reward_templates") : objectiveRewardValidationErrors([{
      id: "story-builder-reward-preview",
      title: "Reward Preview",
      completion_control: "player",
      rewards: [reward]
    }], draft.state?.reward_bundles || {}, draft);
    if (errors.length) {
      showNotice("Reward Needs More Information", errors.slice(0, 8).map(error => error.message).join("\n"));
      return false;
    }
    if (editor.rewardIndex >= 0) editor.collection[editor.rewardIndex] = reward;else editor.collection.push(reward);
    app.storyBuilder.dirty = true;
    storyBuilderQueueAutosave();
    editor.popup.close();
    delete app.storyBuilder.rewardEditor;
    if (editor.scope === "reusable") renderStoryBuilderReusableRewardsManager();else storyBuilderRenderPreservingTreePanel();
    return true;
  }
  function deleteStoryBuilderReward() {
    const editor = app.storyBuilder?.rewardEditor;
    if (!editor?.collection || editor.rewardIndex < 0) return false;
    editor.collection.splice(editor.rewardIndex, 1);
    app.storyBuilder.dirty = true;
    storyBuilderQueueAutosave();
    editor.popup.close();
    delete app.storyBuilder.rewardEditor;
    if (editor.scope === "reusable") renderStoryBuilderReusableRewardsManager();else storyBuilderRenderPreservingTreePanel();
    return true;
  }
  function closeStoryBuilderRewardEditor() {
    const editor = app.storyBuilder?.rewardEditor;
    editor?.popup?.close?.();
    if (app.storyBuilder) delete app.storyBuilder.rewardEditor;
  }
  function storyBuilderReusableRewardLabels(draft = app.storyBuilder?.draft) {
    const editorData = storyBuilderTreeEditorData(draft);
    if (!isPlainObject(editorData.reward_labels)) editorData.reward_labels = {};
    return editorData.reward_labels;
  }
  function storyBuilderReusableRewardTitle(kind = "bundle", id = "") {
    return storyBuilderReusableRewardLabels()[`${kind}:${String(id || "")}`] || humanizeIdentifierLabel(id);
  }
  function storyBuilderReusableRewardReferences(kind = "bundle", id = "", draft = app.storyBuilder?.draft) {
    const type = kind === "template" ? "apply_reward_template" : "apply_reward_bundle";
    const key = kind === "template" ? "template_id" : "bundle_id";
    const references = [];
    const visit = (value, path = []) => {
      if (!value || typeof value !== "object") return;
      if (Array.isArray(value)) {
        value.forEach((item, index) => visit(item, [...path, index]));
        return;
      }
      if (value.type === type && String(value[key] || "") === String(id || "")) references.push({
        path: path.join("."),
        reward: value
      });
      for (const [childKey, child] of Object.entries(value)) visit(child, [...path, childKey]);
    };
    visit(draft?.state?.objectives || {}, ["objectives"]);
    visit(draft?.state?.timed_events || {}, ["timed_events"]);
    visit(draft?.state?.story_shops || {}, ["story_shops"]);
    visit(draft?.state?.reward_bundles || {}, ["reward_bundles"]);
    visit(draft?.state?.reward_templates || {}, ["reward_templates"]);
    return references;
  }
  function openStoryBuilderReusableRewardsManager(tab = "bundle") {
    if (!app.storyBuilder?.draft) return false;
    app.storyBuilder.reusableRewardsTab = tab === "template" ? "template" : "bundle";
    const popup = openPopupModal(`<div data-story-reusable-rewards></div>`);
    popup.box.classList.add("story-builder-fullscreen-editor");
    app.storyBuilder.reusableRewardsPopup = popup;
    renderStoryBuilderReusableRewardsManager();
    return true;
  }
  function renderStoryBuilderReusableRewardsManager() {
    const builder = app.storyBuilder;
    const root = builder?.reusableRewardsPopup?.box?.querySelector?.("[data-story-reusable-rewards]");
    if (!builder || !root) return false;
    const kind = builder.reusableRewardsTab === "template" ? "template" : "bundle";
    const collection = kind === "template" ? builder.draft.state.reward_templates || {} : builder.draft.state.reward_bundles || {};
    root.innerHTML = `
                <div class="story-builder-output-head">
                    <div>
                        <h2>Reusable Rewards</h2>
                        <p class="hint">Fixed bundles repeat an exact reward list. Templates repeat a reward list with typed Character and State Target parameters.</p>
                    </div>
                    <button type="button" onclick="EmberAdventures.closeStoryBuilderReusableRewardsManager()">Close</button>
                </div>
                <div class="story-builder-reusable-tabs">
                    <button type="button" class="${kind === "bundle" ? "active" : ""}" onclick="EmberAdventures.setStoryBuilderReusableRewardsTab('bundle')">Fixed Bundles</button>
                    <button type="button" class="${kind === "template" ? "active" : ""}" onclick="EmberAdventures.setStoryBuilderReusableRewardsTab('template')">Templates</button>
                </div>
                <button type="button" class="primary" onclick="EmberAdventures.createStoryBuilderReusableReward(${htmlJsArg(kind)})">+ New ${kind === "template" ? "Template" : "Bundle"}</button>
                <div class="story-builder-guided-list">
                    ${Object.keys(collection).sort((a, b) => storyBuilderReusableRewardTitle(kind, a).localeCompare(storyBuilderReusableRewardTitle(kind, b))).map(id => renderStoryBuilderReusableRewardCard(kind, id)).join("") || `<p class="hint">No reusable ${kind === "template" ? "templates" : "bundles"} yet.</p>`}
                </div>`;
    return true;
  }
  function renderStoryBuilderReusableRewardCard(kind = "bundle", id = "") {
    const state = app.storyBuilder?.draft?.state || {};
    const entry = kind === "template" ? state.reward_templates?.[id] : state.reward_bundles?.[id];
    const rewards = storyBuilderReusableRewardCollection(kind, id) || [];
    const parameters = kind === "template" && isPlainObject(entry?.parameters) ? entry.parameters : {};
    const references = storyBuilderReusableRewardReferences(kind, id);
    return `
                <section class="story-builder-reusable-card">
                    <div class="story-builder-output-head">
                        <div>
                            <strong>${escapeHtml(storyBuilderReusableRewardTitle(kind, id))}</strong>
                            <div class="hint">${escapeHtml(id)} / used ${references.length} time${references.length === 1 ? "" : "s"}</div>
                        </div>
                        <div class="row">
                            <button type="button" onclick="EmberAdventures.renameStoryBuilderReusableReward(${htmlJsArg(kind)}, ${htmlJsArg(id)})">Rename</button>
                            <button type="button" class="danger" onclick="EmberAdventures.deleteStoryBuilderReusableReward(${htmlJsArg(kind)}, ${htmlJsArg(id)})">Delete</button>
                        </div>
                    </div>
                    ${kind === "template" ? `<div class="story-builder-guided-list">
                                <strong>Parameters</strong>
                                ${Object.entries(parameters).map(([name, definition]) => `<div class="story-builder-guided-row"><span>${escapeHtml(name)}: ${definition.type === "path" ? "State Target" : "Character"}</span><span class="row"><button type="button" class="icon-button" title="Rename parameter" onclick="EmberAdventures.renameStoryBuilderRewardTemplateParameter(${htmlJsArg(id)}, ${htmlJsArg(name)})">&#9998;</button><button type="button" class="icon-button danger" title="Delete parameter" onclick="EmberAdventures.deleteStoryBuilderRewardTemplateParameter(${htmlJsArg(id)}, ${htmlJsArg(name)})">&#10005;</button></span></div>`).join("") || `<div class="hint">No parameters.</div>`}
                                <div class="row">
                                    <button type="button" onclick="EmberAdventures.addStoryBuilderRewardTemplateParameter(${htmlJsArg(id)}, 'character_id')">+ Character</button>
                                    <button type="button" onclick="EmberAdventures.addStoryBuilderRewardTemplateParameter(${htmlJsArg(id)}, 'path')">+ State Target</button>
                                </div>
                            </div>` : ""}
                    <div class="story-builder-guided-list">
                        <strong>Rewards</strong>
                        ${rewards.map((reward, index) => `<button type="button" class="story-builder-guided-row" onclick="EmberAdventures.openStoryBuilderReusableRewardEditor(${htmlJsArg(kind)}, ${htmlJsArg(id)}, ${index})"><span>${escapeHtml(storyBuilderRewardSummary(reward))}</span><span>&#9998;</span></button>`).join("")}
                        <button type="button" class="story-builder-add-row" onclick="EmberAdventures.openStoryBuilderReusableRewardEditor(${htmlJsArg(kind)}, ${htmlJsArg(id)}, -1)">+ New Reward</button>
                    </div>
                    ${references.length ? `<details><summary>Dependencies</summary>${references.map(reference => `<div class="hint">${escapeHtml(reference.path)}</div>`).join("")}
                                  <div class="story-builder-picker-row">
                                      <select data-reusable-replacement="${escapeHtml(`${kind}:${id}`)}">
                                          <option value="">Select replacement</option>
                                          ${Object.keys(kind === "template" ? state.reward_templates || {} : state.reward_bundles || {}).filter(candidateId => candidateId !== id).map(candidateId => `<option value="${escapeHtml(candidateId)}">${escapeHtml(storyBuilderReusableRewardTitle(kind, candidateId))}</option>`).join("")}
                                      </select>
                                      <button type="button" onclick="EmberAdventures.replaceStoryBuilderReusableRewardReferences(${htmlJsArg(kind)}, ${htmlJsArg(id)})">Replace Uses</button>
                                  </div>
                              </details>` : ""}
                </section>`;
  }
  function setStoryBuilderReusableRewardsTab(tab = "bundle") {
    if (!app.storyBuilder) return false;
    app.storyBuilder.reusableRewardsTab = tab === "template" ? "template" : "bundle";
    renderStoryBuilderReusableRewardsManager();
    return true;
  }
  async function createStoryBuilderReusableReward(kind = "bundle") {
    const title = await showPrompt(`New ${kind === "template" ? "Reward Template" : "Fixed Reward Bundle"}`, "Name", "", {
      submitText: "Create"
    });
    if (!title) return false;
    const state = app.storyBuilder.draft.state;
    const collection = kind === "template" ? state.reward_templates ||= {} : state.reward_bundles ||= {};
    const id = uniqueObjectiveId(objectiveIdFromTitle(title, kind === "template" ? "reward-template" : "reward-bundle"), new Set(Object.keys(collection)), kind === "template" ? "reward-template" : "reward-bundle");
    collection[id] = kind === "template" ? {
      parameters: {},
      rewards: []
    } : [];
    storyBuilderReusableRewardLabels()[`${kind}:${id}`] = String(title);
    app.storyBuilder.dirty = true;
    storyBuilderQueueAutosave();
    renderStoryBuilderReusableRewardsManager();
    return true;
  }
  async function renameStoryBuilderReusableReward(kind = "bundle", id = "") {
    const title = await showPrompt("Rename Reusable Reward", "Name", storyBuilderReusableRewardTitle(kind, id), {
      submitText: "Rename"
    });
    if (!title) return false;
    storyBuilderReusableRewardLabels()[`${kind}:${id}`] = String(title);
    app.storyBuilder.dirty = true;
    storyBuilderQueueAutosave();
    renderStoryBuilderReusableRewardsManager();
    return true;
  }
  async function addStoryBuilderRewardTemplateParameter(templateId = "", type = "character_id") {
    const template = app.storyBuilder?.draft?.state?.reward_templates?.[templateId];
    if (!isPlainObject(template)) return false;
    const name = await showPrompt("New Template Parameter", "Parameter name", "", {
      submitText: "Add"
    });
    const id = objectiveIdFromTitle(name, "");
    if (!id) return false;
    template.parameters ||= {};
    if (template.parameters[id]) {
      showNotice("Parameter Exists", `A parameter named ${id} already exists.`);
      return false;
    }
    template.parameters[id] = {
      type: type === "path" ? "path" : "character_id"
    };
    app.storyBuilder.dirty = true;
    storyBuilderQueueAutosave();
    renderStoryBuilderReusableRewardsManager();
    return true;
  }
  function storyBuilderReplaceTemplateParameterValue(value, oldName = "", newName = "") {
    if (Array.isArray(value)) return value.map(item => storyBuilderReplaceTemplateParameterValue(item, oldName, newName));
    if (!isPlainObject(value)) return value;
    if (Object.keys(value).length === 1 && value.parameter === oldName) return {
      parameter: newName
    };
    for (const [key, item] of Object.entries(value)) value[key] = storyBuilderReplaceTemplateParameterValue(item, oldName, newName);
    return value;
  }
  function storyBuilderTemplateParameterUseCount(templateId = "", name = "") {
    const template = app.storyBuilder?.draft?.state?.reward_templates?.[templateId];
    let count = 0;
    const visit = value => {
      if (!value || typeof value !== "object") return;
      if (isPlainObject(value) && Object.keys(value).length === 1 && value.parameter === name) {
        count += 1;
        return;
      }
      for (const item of Array.isArray(value) ? value : Object.values(value)) visit(item);
    };
    visit(template?.rewards || []);
    for (const reference of storyBuilderReusableRewardReferences("template", templateId)) {
      if (Object.prototype.hasOwnProperty.call(reference.reward?.arguments || {}, name)) count += 1;
    }
    return count;
  }
  async function renameStoryBuilderRewardTemplateParameter(templateId = "", name = "") {
    const template = app.storyBuilder?.draft?.state?.reward_templates?.[templateId];
    if (!isPlainObject(template?.parameters?.[name])) return false;
    const requested = await showPrompt("Rename Template Parameter", "Parameter name", name, {
      submitText: "Rename"
    });
    const nextName = objectiveIdFromTitle(requested, "");
    if (!nextName || nextName === name) return false;
    if (template.parameters[nextName]) {
      showNotice("Parameter Exists", `A parameter named ${nextName} already exists.`);
      return false;
    }
    template.parameters[nextName] = template.parameters[name];
    delete template.parameters[name];
    template.rewards = storyBuilderReplaceTemplateParameterValue(clone(template.rewards || []), name, nextName);
    for (const reference of storyBuilderReusableRewardReferences("template", templateId)) {
      const args = reference.reward.arguments;
      if (!isPlainObject(args) || !Object.prototype.hasOwnProperty.call(args, name)) continue;
      args[nextName] = args[name];
      delete args[name];
    }
    app.storyBuilder.dirty = true;
    storyBuilderQueueAutosave();
    renderStoryBuilderReusableRewardsManager();
    return true;
  }
  async function deleteStoryBuilderRewardTemplateParameter(templateId = "", name = "") {
    const template = app.storyBuilder?.draft?.state?.reward_templates?.[templateId];
    if (!isPlainObject(template?.parameters)) return false;
    const uses = storyBuilderTemplateParameterUseCount(templateId, name);
    if (uses) {
      showNotice("Template Parameter Is In Use", `${name} is used ${uses} time${uses === 1 ? "" : "s"}. Rename it or remove those uses before deleting it.`);
      return false;
    }
    if (!(await showConfirm("Delete Template Parameter", `Delete ${name}?`, {
      confirmText: "Delete",
      danger: true
    }))) return false;
    delete template.parameters[name];
    app.storyBuilder.dirty = true;
    storyBuilderQueueAutosave();
    renderStoryBuilderReusableRewardsManager();
    return true;
  }
  function replaceStoryBuilderReusableRewardReferences(kind = "bundle", id = "") {
    const marker = `${kind}:${id}`;
    const selector = [...document.querySelectorAll("[data-reusable-replacement]")].find(element => element.dataset.reusableReplacement === marker);
    const replacementId = String(selector?.value || "");
    if (!replacementId || replacementId === id) {
      showNotice("Replacement Required", "Select a different reusable reward first.");
      return false;
    }
    const key = kind === "template" ? "template_id" : "bundle_id";
    for (const reference of storyBuilderReusableRewardReferences(kind, id)) reference.reward[key] = replacementId;
    app.storyBuilder.dirty = true;
    storyBuilderQueueAutosave();
    renderStoryBuilderReusableRewardsManager();
    return true;
  }
  async function deleteStoryBuilderReusableReward(kind = "bundle", id = "") {
    const references = storyBuilderReusableRewardReferences(kind, id);
    if (references.length) {
      showNotice("Reusable Reward Is In Use", `${storyBuilderReusableRewardTitle(kind, id)} is used in ${references.length} place${references.length === 1 ? "" : "s"}. Replace those references before deleting it.`);
      return false;
    }
    if (!(await showConfirm("Delete Reusable Reward", `Delete ${storyBuilderReusableRewardTitle(kind, id)}?`, {
      confirmText: "Delete",
      danger: true
    }))) return false;
    const state = app.storyBuilder.draft.state;
    if (kind === "template") delete state.reward_templates?.[id];else delete state.reward_bundles?.[id];
    delete storyBuilderReusableRewardLabels()[`${kind}:${id}`];
    app.storyBuilder.dirty = true;
    storyBuilderQueueAutosave();
    renderStoryBuilderReusableRewardsManager();
    return true;
  }
  function closeStoryBuilderReusableRewardsManager() {
    app.storyBuilder?.reusableRewardsPopup?.close?.();
    if (app.storyBuilder) delete app.storyBuilder.reusableRewardsPopup;
  }
  function storyBuilderInputCandidateRows(targetId = "", draft = app.storyBuilder?.draft) {
    const target = String(targetId || "");
    const candidates = [];
    for (const objective of storyBuilderObjectiveList(draft)) {
      if (String(objective.id || "") === target) continue;
      const rows = storyBuilderObjectiveOutputRows(objective);
      if (!rows.length) {
        candidates.push({
          key: `${objective.id}:new`,
          sourceId: objective.id,
          sourceTitle: objective.title || "Untitled",
          outputId: "",
          outputLabel: "New output",
          row: null
        });
        continue;
      }
      for (let index = 0; index < rows.length; index++) {
        const row = rows[index];
        const destination = textSlot(row.next_objective_id || row.objective_id, "");
        if (destination && destination !== target) continue;
        const outputId = storyBuilderOutputStableId(objective, row, index);
        candidates.push({
          key: `${objective.id}:${outputId}`,
          sourceId: objective.id,
          sourceTitle: objective.title || "Untitled",
          outputId,
          outputLabel: row.title || row.criteria || `Output ${index + 1}`,
          row
        });
      }
    }
    return candidates;
  }
  function openStoryBuilderInputsEditor() {
    const objective = storyBuilderObjectiveById(app.storyBuilder?.selectedObjectiveId, app.storyBuilder?.draft);
    if (!objective) return false;
    const candidates = storyBuilderInputCandidateRows(objective.id);
    const groupsById = new Map();
    for (const candidate of candidates) {
      const destination = textSlot(candidate.row?.next_objective_id || candidate.row?.objective_id, "");
      if (destination !== String(objective.id || "")) continue;
      const groupId = textSlot(candidate.row?.target_input_group_id, candidate.outputId);
      if (!groupsById.has(groupId)) groupsById.set(groupId, []);
      groupsById.get(groupId).push(candidate.key);
    }
    const groups = [...groupsById.values()];
    let mode = "custom";
    if (!groups.length || groups.every(group => group.length === 1)) mode = "any";else if (groups.length === 1) mode = "all";
    app.storyBuilder.inputEditor = {
      objectiveId: objective.id,
      mode,
      groups: groups.length ? groups : [[]],
      candidates
    };
    const popup = openPopupModal(`<div data-story-input-editor></div>`);
    popup.box.classList.add("story-builder-fullscreen-editor");
    app.storyBuilder.inputEditor.popup = popup;
    renderStoryBuilderInputsEditor();
    return true;
  }
  function renderStoryBuilderInputsEditor() {
    const editor = app.storyBuilder?.inputEditor;
    const root = editor?.popup?.box?.querySelector?.("[data-story-input-editor]");
    if (!editor || !root) return false;
    const selected = new Map();
    editor.groups.forEach((group, groupIndex) => group.forEach(key => selected.set(key, groupIndex)));
    root.innerHTML = `
                <h2>Manage Inputs</h2>
                <p class="hint">Any completed input group can make this node visible. Every selected transition inside one group is required.</p>
                <div class="story-builder-mode-control" role="group" aria-label="Input grouping">
                    <button type="button" class="${editor.mode === "any" ? "active" : ""}" onclick="EmberAdventures.setStoryBuilderInputMode('any')">Any</button>
                    <button type="button" class="${editor.mode === "all" ? "active" : ""}" onclick="EmberAdventures.setStoryBuilderInputMode('all')">All</button>
                    <button type="button" class="${editor.mode === "custom" ? "active" : ""}" onclick="EmberAdventures.setStoryBuilderInputMode('custom')">Custom</button>
                </div>
                <div class="story-builder-input-groups">
                    ${editor.groups.map((group, groupIndex) => `
                                ${groupIndex ? `<div class="story-builder-input-or">OR</div>` : ""}
                                <section class="story-builder-reusable-card">
                                    <strong>${editor.mode === "custom" ? `Path ${groupIndex + 1}` : editor.mode === "all" ? "All selected inputs" : "Any selected input"}</strong>
                                    <div class="story-builder-modal-list">
                                        ${editor.candidates.map(candidate => {
      const selectedGroup = selected.get(candidate.key);
      const active = selectedGroup === groupIndex;
      const disabled = selectedGroup != null && selectedGroup !== groupIndex;
      return `<button type="button" class="${active ? "active" : ""}" ${disabled ? "disabled" : ""} onclick="EmberAdventures.toggleStoryBuilderInput(${groupIndex}, ${htmlJsArg(candidate.key)})">#${storyBuilderObjectiveNumber(candidate.sourceId)} ${escapeHtml(candidate.sourceTitle)} / ${escapeHtml(candidate.outputLabel)}</button>`;
    }).join("")}
                                    </div>
                                    ${editor.mode === "custom" && editor.groups.length > 1 ? `<button type="button" class="danger" onclick="EmberAdventures.removeStoryBuilderInputGroup(${groupIndex})">Delete Path</button>` : ""}
                                    <div class="hint">${group.length ? group.map(key => editor.candidates.find(candidate => candidate.key === key)?.sourceTitle || key).join(" AND ") : "No inputs selected"}</div>
                                </section>`).join("")}
                </div>
                ${editor.mode === "custom" ? `<button type="button" onclick="EmberAdventures.addStoryBuilderInputGroup()">+ OR Path</button>` : ""}
                <div class="row">
                    <button type="button" onclick="EmberAdventures.closeStoryBuilderInputsEditor()">Cancel</button>
                    <button type="button" class="primary" onclick="EmberAdventures.saveStoryBuilderInputs()">Save Inputs</button>
                </div>`;
    return true;
  }
  function setStoryBuilderInputMode(mode = "any") {
    const editor = app.storyBuilder?.inputEditor;
    if (!editor) return false;
    const selected = [...new Set(editor.groups.flat())];
    editor.mode = ["all", "custom"].includes(mode) ? mode : "any";
    if (editor.mode === "all") editor.groups = [selected];else if (editor.mode === "any") editor.groups = selected.length ? selected.map(key => [key]) : [[]];else editor.groups = selected.length ? [selected] : [[]];
    renderStoryBuilderInputsEditor();
    return true;
  }
  function toggleStoryBuilderInput(groupIndex = 0, key = "") {
    const editor = app.storyBuilder?.inputEditor;
    const group = editor?.groups?.[Number(groupIndex)];
    if (!editor || !group) return false;
    const existing = group.indexOf(String(key));
    if (existing >= 0) group.splice(existing, 1);else {
      for (const other of editor.groups) {
        const index = other.indexOf(String(key));
        if (index >= 0) other.splice(index, 1);
      }
      group.push(String(key));
    }
    if (editor.mode === "any") {
      const selected = [...new Set(editor.groups.flat())];
      editor.groups = selected.length ? selected.map(item => [item]) : [[]];
    }
    renderStoryBuilderInputsEditor();
    return true;
  }
  function addStoryBuilderInputGroup() {
    const editor = app.storyBuilder?.inputEditor;
    if (!editor || editor.mode !== "custom") return false;
    editor.groups.push([]);
    renderStoryBuilderInputsEditor();
    return true;
  }
  function removeStoryBuilderInputGroup(groupIndex = 0) {
    const editor = app.storyBuilder?.inputEditor;
    if (!editor || editor.groups.length <= 1) return false;
    editor.groups.splice(Number(groupIndex), 1);
    renderStoryBuilderInputsEditor();
    return true;
  }
  function saveStoryBuilderInputs() {
    const editor = app.storyBuilder?.inputEditor;
    const target = storyBuilderObjectiveById(editor?.objectiveId, app.storyBuilder?.draft);
    if (!editor || !target) return false;
    const groups = editor.groups.filter(group => group.length);
    if (String(storyBuilderStartingObjectiveId()) !== String(target.id || "") && !groups.length) {
      showNotice("Inputs Required", "Every node except the story start needs at least one input.");
      return false;
    }
    const selectedKeys = new Set(groups.flat());
    for (const candidate of editor.candidates) {
      if (!candidate.row) continue;
      const destination = textSlot(candidate.row.next_objective_id || candidate.row.objective_id, "");
      if (destination === String(target.id || "") && !selectedKeys.has(candidate.key)) {
        candidate.row.next_objective_id = "";
        if (Object.hasOwn(candidate.row, "objective_id")) candidate.row.objective_id = "";
        delete candidate.row.target_input_group_id;
      }
    }
    groups.forEach((group, groupIndex) => {
      const groupId = generatedPersistentId(`input-group-${groupIndex + 1}`);
      for (const key of group) {
        const candidate = editor.candidates.find(item => item.key === key);
        const source = storyBuilderObjectiveById(candidate?.sourceId, app.storyBuilder?.draft);
        if (!candidate || !source) continue;
        let row = candidate.row;
        if (!row) {
          row = storyBuilderEnsureOutputRows(source, 1)[0];
          if (!row.id) row.id = generatedPersistentId("output");
        }
        row.next_objective_id = String(target.id || "");
        if (Object.hasOwn(row, "objective_id")) row.objective_id = row.next_objective_id;
        row.target_input_group_id = groupId;
      }
    });
    target.requires = [];
    app.storyBuilder.dirty = true;
    storyBuilderQueueAutosave();
    editor.popup.close();
    delete app.storyBuilder.inputEditor;
    storyBuilderRenderPreservingTreePanel();
    return true;
  }
  function closeStoryBuilderInputsEditor() {
    const editor = app.storyBuilder?.inputEditor;
    editor?.popup?.close?.();
    if (app.storyBuilder) delete app.storyBuilder.inputEditor;
  }

  //#endregion Guided Story Objective Editor

  function storyBuilderObjectiveNumber(id = "", draft = app.storyBuilder?.draft) {
    const index = storyBuilderObjectiveList(draft).findIndex(objective => String(objective.id || "") === String(id || ""));
    return index >= 0 ? index + 1 : 0;
  }
  function storyBuilderObjectiveDisplay(id = "", draft = app.storyBuilder?.draft) {
    const objective = storyBuilderObjectiveById(id, draft);
    if (!objective) return "None";
    return `#${storyBuilderObjectiveNumber(id, draft)} ${objective.title || "Untitled"}`;
  }
  function storyBuilderIncomingTransitions(targetId = "", draft = app.storyBuilder?.draft) {
    const target = String(targetId || "");
    const transitions = [];
    for (const objective of storyBuilderObjectiveList(draft)) {
      const sourceId = String(objective.id || "");
      const rows = [...objectiveNextOptions(objective), ...objectiveOutcomeRoutes(objective), ...objectiveDirectChoiceOptions(objective)];
      for (let index = 0; index < rows.length; index++) {
        const row = rows[index];
        const destination = textSlot(row.next_objective_id || row.objective_id, "");
        if (destination !== target) continue;
        transitions.push({
          sourceId,
          sourceTitle: objective.title || sourceId,
          outputId: storyBuilderOutputStableId(objective, row, index),
          groupId: textSlot(row.target_input_group_id, storyBuilderOutputStableId(objective, row, index)),
          row
        });
      }
    }
    return transitions;
  }
  function storyBuilderInputSummary(objective = {}, draft = app.storyBuilder?.draft) {
    if (String(storyBuilderStartingObjectiveId(draft)) === String(objective.id || "")) return "Story Start";
    const incoming = storyBuilderIncomingTransitions(objective.id, draft);
    if (!incoming.length) return "None";
    const groups = new Map();
    for (const edge of incoming) groups.set(edge.groupId, (groups.get(edge.groupId) || 0) + 1);
    if (groups.size === incoming.length) return `Any of ${incoming.length}`;
    if (groups.size === 1) return `All ${incoming.length}`;
    return `${groups.size} custom paths`;
  }
  function storyBuilderRequirementSummary(requirement = {}) {
    return storyRequirementLabel(requirement);
  }
  function storyBuilderRewardSummary(reward = {}) {
    const type = textSlot(reward.type, "reward");
    const names = {
      introduce_future_character: "Introduce character",
      make_future_character_recruitable: "Make character recruitable",
      promote_future_character_to_party: "Add character to party",
      remove_character_shop_listing: "Remove character from shop",
      add_item: "Add item",
      grant_item: "Grant item",
      add_story_item: "Add story item",
      adjust_story_inventory: "Adjust story inventory",
      advance_time: "Advance time",
      unlock_location: "Unlock location",
      add_story_rule: "Add story rule",
      remove_story_rule: "Remove story rule",
      set_state_field: "Set story state",
      modify_integer: "Modify integer",
      modify_number: "Modify number",
      adjust_relationship: "Adjust relationship",
      grant_outfit: "Grant outfit",
      equip_outfit: "Equip outfit",
      delete_outfit: "Delete outfit",
      delete_all_outfits: "Delete all outfits",
      add_state_list_item: "Add list item",
      remove_state_list_item: "Remove list item",
      kill_character: "Kill character",
      generate_profile_image: "Generate profile image",
      generate_solo_normal_image: "Generate character image",
      generate_story_image: "Generate story image",
      start_objective: "Start objective",
      complete_objective: "Complete objective",
      complete_generated_job: "Complete generated job",
      apply_reward_bundle: "Use fixed reward bundle",
      apply_reward_template: "Use reward template"
    };
    const target = (reward.type === "remove_character_shop_listing" && reward.shop_id && reward.character_id ? `${reward.shop_id} / ${reward.character_id}` : reward.character_id) || reward.location_id || reward.objective_id || reward.bundle_id || reward.template_id || reward.item?.name || reward.item || reward.rule || reward.field || "";
    return `${names[type] || humanizeIdentifierLabel(type)}${target ? `: ${target}` : ""}`;
  }
  function renderStoryBuilderRequirementRows(requirements = [], scope = "completion", outputIndex = -1) {
    return `
                <div class="story-builder-guided-list">
                    ${(requirements || []).map((requirement, index) => `
                                <button type="button" class="story-builder-guided-row" onclick="EmberAdventures.openStoryBuilderRequirementEditor(${htmlJsArg(scope)}, ${outputIndex}, ${index})">
                                    <span>${escapeHtml(storyBuilderRequirementSummary(requirement))}</span>
                                    <span aria-hidden="true">&#9998;</span>
                                </button>`).join("")}
                    <button type="button" class="story-builder-add-row" onclick="EmberAdventures.openStoryBuilderRequirementEditor(${htmlJsArg(scope)}, ${outputIndex}, -1)">+ Add Requirement</button>
                </div>`;
  }
  function renderStoryBuilderRewardRows(rewards = [], outputIndex = 0) {
    return `
                <div class="story-builder-guided-list">
                    ${(rewards || []).map((reward, index) => `
                                <button type="button" class="story-builder-guided-row" onclick="EmberAdventures.openStoryBuilderRewardEditor(${outputIndex}, ${index})">
                                    <span>${escapeHtml(storyBuilderRewardSummary(reward))}</span>
                                    <span aria-hidden="true">&#9998;</span>
                                </button>`).join("")}
                    <button type="button" class="story-builder-add-row" onclick="EmberAdventures.openStoryBuilderRewardEditor(${outputIndex}, -1)">+ New Reward</button>
                </div>`;
  }
  function renderStoryBuilderDialogueEditor(objective = {}, row = {}, outputIndex = 0) {
    const enabled = Array.isArray(row.dialogue_lines);
    const playerControlled = storyBuilderObjectiveControlMode(objective) === "player";
    if (!enabled) return `
                    <label class="check-row">
                        <input type="checkbox" onchange="EmberAdventures.storyBuilderToggleOutputDialogue(${outputIndex}, this.checked)">
                        <span>Dialogue</span>
                    </label>`;
    const characters = storyBuilderCharacterPickerEntries();
    return `
                <label class="check-row">
                    <input type="checkbox" checked onchange="EmberAdventures.storyBuilderToggleOutputDialogue(${outputIndex}, this.checked)">
                    <span>Dialogue</span>
                </label>
                <div class="story-builder-dialogue-list">
                    ${(row.dialogue_lines || []).map((line, lineIndex) => {
      const parsed = storyBuilderDialogueLineParts(line);
      return `
                                <div class="story-builder-dialogue-row">
                                    ${playerControlled ? `<span class="story-builder-dialogue-speaker">Player</span>` : `<select data-story-output-index="${outputIndex}" data-story-dialogue-character="${lineIndex}" aria-label="Dialogue character">
                                                <option value="">Character</option>
                                                ${characters.map(entry => `<option value="${escapeHtml(entry.id)}" ${entry.id === parsed.characterId ? "selected" : ""}>${escapeHtml(entry.name)}</option>`).join("")}
                                            </select>`}
                                    <textarea rows="2" placeholder="Exact dialogue line" data-story-output-index="${outputIndex}" data-story-dialogue-index="${lineIndex}">${escapeHtml(parsed.text)}</textarea>
                                    <button type="button" class="icon-button danger" title="Delete dialogue" onclick="EmberAdventures.storyBuilderRemoveDialogueLine(${outputIndex}, ${lineIndex})">&#10005;</button>
                                </div>`;
    }).join("")}
                    ${playerControlled ? "" : `<button type="button" class="story-builder-add-row" onclick="EmberAdventures.storyBuilderAddDialogueLine(${outputIndex})">+ New Dialogue</button>`}
                </div>`;
  }
  function storyBuilderDialogueLineParts(line = "") {
    const text = String(line || "");
    const match = text.match(/^\(\|\[character:([^\]]+)\]\|\)\s*([\s\S]*)$/);
    return match ? {
      characterId: match[1],
      text: match[2]
    } : {
      characterId: "",
      text
    };
  }
  function storyBuilderCharacterPickerEntries(draft = app.storyBuilder?.draft) {
    const state = draft?.state || {};
    const entries = new Map();
    const add = (character, fallbackId = "", fallbackName = "") => {
      if (!isPlainObject(character)) return;
      const id = textSlot(character.id || character.character_id || fallbackId, "");
      if (!id) return;
      entries.set(id, {
        id,
        name: textSlot(character.name || fallbackName, id)
      });
    };
    add(state.player, state.player?.id, state.player?.name);
    for (const player of state.players || []) add(player);
    for (const [name, character] of Object.entries(state.characters || {})) add(character, character.id || objectiveIdFromTitle(name, "character"), name);
    for (const location of Object.values(state.npc_directory?.locations || {})) for (const [name, npc] of Object.entries(location?.characters || {})) add(npc.full_character || npc, npc.id || npc.full_character?.id, name);
    for (const [id, future] of Object.entries(state.future_cast?.items || {})) add(future.full_character || future, future.id || id, future.name || id);
    return [...entries.values()].sort((a, b) => a.name.localeCompare(b.name));
  }
  function renderStoryBuilderOutputBlock(objective = {}, row = {}, index = 0, mode = "one") {
    const control = storyBuilderObjectiveControlMode(objective);
    const choice = storyBuilderObjectiveChoiceEnabled(objective);
    const requirementOnly = storyBuilderObjectiveRequirementCheckOnly(objective);
    const aiRoute = control === "ai" && mode === "multiple";
    const deterministicRoute = !choice && !aiRoute && mode === "multiple";
    const destinationId = textSlot(row.next_objective_id || row.objective_id, "");
    const dialogueVisible = !requirementOnly;
    return `
                <section class="story-builder-output-block" data-story-output-block="${index}">
                    ${mode === "multiple" ? `<div class="story-builder-output-head">
                                <strong>Output ${index + 1}</strong>
                                <div class="row">
                                    <button type="button" class="icon-button" title="Move output up" ${index === 0 ? "disabled" : ""} onclick="EmberAdventures.storyBuilderMoveOutput(${index}, -1)">&#8593;</button>
                                    <button type="button" class="icon-button" title="Move output down" onclick="EmberAdventures.storyBuilderMoveOutput(${index}, 1)">&#8595;</button>
                                    <button type="button" class="icon-button danger" title="Delete output" onclick="EmberAdventures.storyBuilderDeleteOutput(${index})">&#10005;</button>
                                </div>
                            </div>` : ""}
                    ${choice ? `<input class="${textSlot(row.title, "") ? "" : "invalid"}" data-story-output-index="${index}" data-story-output-field="title" value="${escapeHtml(row.title || "")}" placeholder="The visible option in the list of options.">
                               ${objectiveChoiceResponseMode(objective) === "exact_text" ? `<textarea rows="2" class="${textSlot(row.player_text, "") ? "" : "invalid"}" data-story-output-index="${index}" data-story-output-field="player_text" placeholder="The exact words the player says when choosing this option.">${escapeHtml(row.player_text || "")}</textarea>` : ""}` : ""}
                    ${aiRoute ? `<textarea rows="2" class="${textSlot(row.criteria, "") || row.fallback ? "" : "invalid"}" data-story-output-index="${index}" data-story-output-field="criteria" placeholder="When the AI should select this output after the objective completes.">${escapeHtml(row.criteria || "")}</textarea>
                               <label class="check-row"><input type="checkbox" data-story-output-index="${index}" data-story-output-field="fallback" ${row.fallback ? "checked" : ""}> <span>Fallback output</span></label>` : ""}
                    ${deterministicRoute ? `<p class="hint">Outputs are checked in order. The first eligible output is used.</p>
                               <label class="check-row"><input type="checkbox" data-story-output-index="${index}" data-story-output-field="fallback" ${row.fallback ? "checked" : ""}> <span>Fallback output</span></label>` : ""}
                    <div class="story-builder-subsection">
                        <strong>Output Requirements</strong>
                        ${renderStoryBuilderRequirementRows(row.requirements || [], "output", index)}
                    </div>
                    ${requirementOnly ? "" : `<textarea rows="3" class="${textSlot(row.completion_instruction || objective.completion_instruction, "") ? "" : "invalid"}" data-story-output-index="${index}" data-story-output-field="completion_instruction" placeholder="Instructions to the AI on what to do in the message when this objective completes.">${escapeHtml(row.completion_instruction || (mode === "one" ? objective.completion_instruction || "" : ""))}</textarea>`}
                    ${dialogueVisible ? renderStoryBuilderDialogueEditor(objective, row, index) : ""}
                    <label>Output Result</label>
                    <select data-story-output-index="${index}" data-story-output-field="ending_type">
                        <option value="" ${!row.ending_type ? "selected" : ""}>Continue to next node</option>
                        <option value="freeplay" ${row.ending_type === "freeplay" ? "selected" : ""}>Continue in Freeplay</option>
                        <option value="ending" ${row.ending_type === "ending" ? "selected" : ""}>Ending</option>
                        <option value="game_over" ${row.ending_type === "game_over" ? "selected" : ""}>Game Over</option>
                    </select>
                    ${row.ending_type ? `
                        <input data-story-output-index="${index}" data-story-output-field="ending_title" value="${escapeHtml(row.ending_title || "")}" placeholder="Optional ending title">
                        <textarea rows="3" data-story-output-index="${index}" data-story-output-field="ending_message" placeholder="Optional ending or transition message">${escapeHtml(row.ending_message || "")}</textarea>
                    ` : ""}
                    <div class="story-builder-subsection">
                        <div class="story-builder-output-head">
                            <strong>Rewards</strong>
                            <button type="button" onclick="EmberAdventures.openStoryBuilderReusableRewardsManager()">Reusable Rewards</button>
                        </div>
                        ${renderStoryBuilderRewardRows(row.rewards || (mode === "one" ? objective.rewards || [] : []), index)}
                    </div>
                    <div class="story-builder-picker-row">
                        <button type="button" onclick="EmberAdventures.openStoryBuilderLocationPicker(${index})">Travel Location</button>
                        <span class="${row.travel_location_id ? "selected-value" : ""}">${escapeHtml(storyBuilderLocationDisplayName(row.travel_location_id) || "None")}</span>
                    </div>
                    ${row.ending_type ? `<div class="story-builder-picker-row"><span class="valid-value">Ending output: ${escapeHtml(row.ending_type)}</span></div>` : `<div class="story-builder-picker-row">
                                <button type="button" onclick="EmberAdventures.openStoryBuilderNodePicker(${index})">Next Node</button>
                                <span class="${destinationId ? "valid-value" : "invalid-value"}">${escapeHtml(storyBuilderObjectiveDisplay(destinationId))}</span>
                            </div>`}
                </section>`;
  }
  function renderStoryBuilderTreeInspector(draft, selectedId, checks = storyBuilderValidationChecks(draft)) {
    const objectives = storyBuilderObjectiveList(draft);
    const objective = storyBuilderObjectiveById(selectedId, draft);
    if (!objective) {
      return `
                    <aside class="story-builder-inspector">
                        <div class="story-builder-node-primary-actions">
                            <button class="primary" type="button" onclick="EmberAdventures.storyBuilderAddNextObjective()">+ Add Opening Node</button>
                        </div>
                        <h3>Tree</h3>
                        <p class="hint">Select an objective node to edit it.</p>
                        ${renderStoryBuilderValidationList(checks)}
                    </aside>
                `;
    }
    const index = objectives.findIndex(item => String(item.id) === String(objective.id));
    const starting = String(storyBuilderStartingObjectiveId(draft)) === String(objective.id || "");
    const controlMode = storyBuilderObjectiveControlMode(objective);
    const choice = storyBuilderObjectiveChoiceEnabled(objective);
    const autoComplete = storyBuilderObjectiveAutoComplete(objective);
    const requirementOnly = storyBuilderObjectiveRequirementCheckOnly(objective);
    const outputMode = storyBuilderObjectiveOutputMode(objective, draft);
    const outputRows = storyBuilderObjectiveOutputRows(objective).length ? storyBuilderObjectiveOutputRows(objective) : [storyBuilderNewOutputRow(objective, 0)];
    const completionRequirements = Array.isArray(objective.completion_requirements) ? objective.completion_requirements : [];
    const nodeChecks = checks.filter(check => !check.objectiveId || String(check.objectiveId) === String(objective.id));
    return `
                <aside class="story-builder-inspector">
                    <div class="story-builder-node-primary-actions">
                        <button class="primary" type="button" onclick="EmberAdventures.storyBuilderAddNextObjective()">+ Add Next Node</button>
                    </div>
                    <div class="story-builder-section-header">
                        <h3>Node</h3>
                        <div class="row">
                            <button type="button" class="danger" title="Delete objective" onclick="EmberAdventures.storyBuilderDeleteObjective(${index})">&#10005;</button>
                        </div>
                    </div>
                    <label>Control Mode</label>
                    <div class="story-builder-mode-control" role="group" aria-label="Objective control mode">
                        <button type="button" class="${controlMode === "player" ? "active" : ""}" aria-pressed="${controlMode === "player"}" onclick="EmberAdventures.storyBuilderSetObjectiveControlMode('player')">Player</button>
                        <button type="button" class="${controlMode === "ai" ? "active" : ""}" aria-pressed="${controlMode === "ai"}" onclick="EmberAdventures.storyBuilderSetObjectiveControlMode('ai')">AI</button>
                    </div>
                    ${controlMode === "player" ? `<label class="check-row"><input type="checkbox" ${choice ? "checked" : ""} onchange="EmberAdventures.storyBuilderSetChoiceObjective(this.checked)"> <span>Choice Objective</span></label>` : ""}
                    <label>Outputs</label>
                    <div class="story-builder-mode-control" role="group" aria-label="Objective output mode">
                        <button type="button" class="${outputMode === "one" ? "active" : ""}" aria-pressed="${outputMode === "one"}" onclick="EmberAdventures.storyBuilderSetObjectiveOutputMode('one')" title="One output">&#9679;&#9472;&#9679;</button>
                        <button type="button" class="${outputMode === "multiple" ? "active" : ""}" aria-pressed="${outputMode === "multiple"}" onclick="EmberAdventures.storyBuilderSetObjectiveOutputMode('multiple')" title="Multiple outputs">&#9679;&#9532;&#9679;</button>
                    </div>
                    <div class="row" style="justify-content:space-between">
                        <label class="check-row"><input type="checkbox" data-tree-objective-field="side_objective" ${objectiveIsSide(objective) ? "checked" : ""} ${starting ? "disabled" : ""}> <span>Side Objective</span></label>
                        <button type="button" ${starting || objectiveIsSide(objective) ? "disabled" : ""} onclick="EmberAdventures.storyBuilderSetStartingObjective(${htmlJsArg(objective.id || "")})">${starting ? "Starting Node" : "Set As Starting Node"}</button>
                    </div>
                    ${controlMode === "ai" ? `<label class="check-row"><input type="checkbox" ${autoComplete ? "checked" : ""} onchange="EmberAdventures.storyBuilderSetObjectiveAutoComplete(this.checked)"> <span>Auto Complete</span></label>
                               ${autoComplete ? `<label class="check-row story-builder-nested-check"><input type="checkbox" ${requirementOnly ? "checked" : ""} onchange="EmberAdventures.storyBuilderSetRequirementCheckOnly(this.checked)"> <span>Requirement Check Only</span></label>
                                          ${requirementOnly && !completionRequirements.length ? `<div class="warn">This node completes immediately when reached.</div>` : ""}` : ""}` : ""}
                    <input class="${textSlot(objective.title, "") ? "" : "invalid"}" data-tree-objective-field="title" value="${escapeHtml(objective.title || "")}" placeholder="Title">
                    <div class="story-builder-picker-row">
                        <button type="button" onclick="EmberAdventures.openStoryBuilderInputsEditor()">Manage Inputs</button>
                        <span class="${starting || storyBuilderIncomingTransitions(objective.id, draft).length ? "valid-value" : "invalid-value"}">Inputs: ${escapeHtml(storyBuilderInputSummary(objective, draft))}</span>
                    </div>
                    <div class="story-builder-subsection">
                        <strong>Completion Requirements</strong>
                        ${renderStoryBuilderRequirementRows(completionRequirements, "completion", -1)}
                    </div>
                    ${requirementOnly ? "" : `<textarea rows="3" class="${textSlot(objective.summary, "") ? "" : "invalid"}" data-tree-objective-field="summary" placeholder="Information for the player to give extra info and/or a hint on how to complete the objective.">${escapeHtml(objective.summary || "")}</textarea>`}
                    <textarea rows="3" class="${textSlot(objective.while_active_guidance, "") ? "" : "invalid"}" data-tree-objective-field="while_active_guidance" placeholder="Required hidden AI-only guidance for while this objective is active.">${escapeHtml(objective.while_active_guidance || "")}</textarea>
                    ${choice ? `
                        <label>Player Response</label>
                        <div class="story-builder-mode-control" role="group" aria-label="Player choice response mode">
                            <button type="button" class="${objectiveChoiceResponseMode(objective) === "optional_text" ? "active" : ""}" onclick="EmberAdventures.storyBuilderSetChoiceResponseMode('optional_text')">Optional Text</button>
                            <button type="button" class="${objectiveChoiceResponseMode(objective) === "exact_text" ? "active" : ""}" onclick="EmberAdventures.storyBuilderSetChoiceResponseMode('exact_text')">Exact Dialogue</button>
                        </div>
                    ` : ""}
                    ${requirementOnly || choice ? "" : `<textarea rows="3" class="${textSlot(objective.completion_criteria, "") ? "" : "invalid"}" data-tree-objective-field="completion_criteria" placeholder="The 1 simple condition to complete this objective. Do not use 'and' statements or a list of requirements.">${escapeHtml(objective.completion_criteria || "")}</textarea>`}
                    ${outputMode === "multiple" && controlMode !== "ai" && !choice ? `<p class="hint">Outputs are checked in order. The first eligible output is used.</p>` : ""}
                    ${outputRows.map((row, outputIndex) => renderStoryBuilderOutputBlock(objective, row, outputIndex, outputMode)).join("")}
                    ${outputMode === "multiple" ? `<button type="button" class="story-builder-add-output" onclick="EmberAdventures.storyBuilderAddOutput()">+ New Output</button>` : ""}
                    <section class="story-builder-section story-builder-validation-section">
                        <strong>Validation</strong>
                        ${renderStoryBuilderValidationList(nodeChecks)}
                    </section>
                </aside>
            `;
  }
  function renderStoryBuilderValidationList(checks = []) {
    const issues = checks.filter(check => !check.ok);
    if (!issues.length) return `<div class="story-builder-validation-list"><div class="good">OK: No issues found.</div></div>`;
    return `
                <div class="story-builder-validation-list">
                    ${issues.map(check => check.objectiveId ? `<button type="button" class="bad story-builder-validation-button" onclick="EmberAdventures.storyBuilderOpenValidationIssue(${htmlJsArg(check.objectiveId)}, ${htmlJsArg(check.field || "")})">Fix: ${escapeHtml(check.label)}</button>` : `<div class="bad">Fix: ${escapeHtml(check.label)}</div>`).join("")}
                </div>
            `;
  }
  function storyBuilderOpenValidationIssue(objectiveId = "", field = "") {
    const builder = app.storyBuilder;
    if (!builder) return false;
    builder.selectedObjectiveId = String(objectiveId || "");
    if (window.matchMedia?.("(max-width: 839px)")?.matches) builder.mobileInspectorOpen = true;
    renderStoryBuilder();
    requestAnimationFrame(() => {
      const escapedField = window.CSS?.escape?.(String(field || "")) || String(field || "").replace(/["\\]/g, "\\$&");
      const selector = field ? `[data-tree-objective-field="${escapedField}"], [data-story-output-field="${escapedField}"]` : ".story-builder-inspector";
      const target = document.querySelector(selector);
      target?.scrollIntoView?.({
        block: "center",
        behavior: "smooth"
      });
      target?.focus?.({
        preventScroll: true
      });
    });
    return true;
  }
  function renderStoryBuilderObjectiveGraph(objectives = []) {
    const children = new Map();
    for (const item of objectives) {
      for (const req of objectiveRequiredIds(item)) {
        children.set(req, (children.get(req) || 0) + 1);
      }
    }
    return `
                <section class="story-builder-section">
                    <div class="story-builder-section-header">
                        <div>
                            <h3>Objective Graph</h3>
                            <p class="hint">Cards show prerequisites and downstream links. Edit the detailed cards below to change requirements, rewards, completion rules, and branch groups.</p>
                        </div>
                    </div>
                    <div class="story-builder-grid">
                        ${objectives.map((objective, index) => {
      const reqs = objectiveRequiredIds(objective);
      const isSide = String(objective.kind || objective.type || "").toLowerCase() === "side";
      const locked = /^(hidden|locked)$/i.test(String(objective.status || ""));
      return `
                                    <div class="story-builder-compact-card ${isSide ? "side" : ""} ${locked ? "locked" : ""}">
                                        <div class="hint">#${index + 1} ${isSide ? "Side" : "Main"} / ${escapeHtml(objective.status || "active")}</div>
                                        <strong>${escapeHtml(objective.title || objective.id || "Objective")}</strong>
                                        <p class="hint">${escapeHtml(objective.summary || "")}</p>
                                        <div class="story-builder-chip-row">
                                            ${reqs.length ? reqs.map(id => `<span class="story-builder-chip">requires ${escapeHtml(id)}</span>`).join("") : `<span class="story-builder-chip">opening/root</span>`}
                                            <span class="story-builder-chip">${children.get(objective.id) || 0} child${children.get(objective.id) === 1 ? "" : "ren"}</span>
                                            ${objective.exclusive_group ? `<span class="story-builder-chip">branch ${escapeHtml(objective.exclusive_group)}</span>` : ""}
                                        </div>
                                    </div>
                                `;
    }).join("") || `<p class="hint">No objectives yet.</p>`}
                    </div>
                </section>
            `;
  }
  function bindStoryBuilderPanel() {
    const builder = app.storyBuilder;
    if (!builder) return;
    const autoSave = () => {
      if (saveStoryBuilderVisibleFields() === false) return;
      storyBuilderQueueAutosave();
    };
    const headerTitle = $("storyBuilderHeaderTitle");
    const overviewTitle = $("storyBuilderTitle");
    const syncStoryBuilderTitle = (source, target) => {
      if (!source) return;
      if (target && target.value !== source.value) target.value = source.value;
      builder.draft.title = source.value;
      builder.dirty = true;
    };
    if (headerTitle) {
      headerTitle.oninput = () => syncStoryBuilderTitle(headerTitle, overviewTitle);
      headerTitle.onblur = autoSave;
      headerTitle.onkeydown = event => {
        if (event.key !== "Enter") return;
        event.preventDefault();
        headerTitle.blur();
      };
    }
    if (overviewTitle) {
      overviewTitle.oninput = () => syncStoryBuilderTitle(overviewTitle, headerTitle);
    }
    ["storyBuilderTitle", "storyBuilderDescription", "storyBuilderSource", "storyBuilderCreationTool", "storyBuilderGuidance", "storyBuilderTitleCardPrompt", "storyBuilderTitleCardSubjects"].forEach(id => {
      const field = $(id);
      if (field) field.onblur = autoSave;
    });
    if ($("storyBuilderAllowAnyPlayer")) $("storyBuilderAllowAnyPlayer").onchange = () => {
      if ($("storyBuilderAllowAnyPlayer").checked && !Object.keys(builder.draft.any_player_starting_state || {}).length) builder.draft.any_player_starting_state = storyBuilderDefaultAnyPlayerStartingState();
      autoSave();
      renderStoryBuilder();
    };
    document.querySelectorAll(".storyBuilderGenreCheck").forEach(field => {
      field.onchange = autoSave;
    });
    if ($("storyBuilderStateEditor")) {
      const tree = $("storyBuilderStateEditor");
      const saveStateTree = () => {
        try {
          builder.draft.state = stripRuntimeTemplateFields(readFriendlyStateEditor(builder.draft.state, tree));
          builder.dirty = true;
          storyBuilderQueueAutosave();
        } catch (err) {
          showNotice("Story Builder Save Failed", err.message || String(err));
        }
      };
      tree.querySelectorAll("input, textarea, select").forEach(field => {
        const tag = field.tagName.toLowerCase();
        const type = String(field.type || "").toLowerCase();
        if (tag === "textarea" || type === "text" || type === "search") field.onblur = saveStateTree;else field.onchange = saveStateTree;
      });
    }
    for (const tree of [$("storyBuilderAnyPlayerEditor"), $("storyBuilderStructuredEditor"), $("storyBuilderObjectiveCollectionsEditor"), ...document.querySelectorAll("[data-story-builder-future-shell]")].filter(Boolean)) {
      tree.querySelectorAll("input, textarea, select").forEach(field => {
        const tag = field.tagName.toLowerCase();
        const type = String(field.type || "").toLowerCase();
        if (tag === "textarea" || type === "text" || type === "search") field.onblur = autoSave;else field.onchange = () => {
          if (storyBuilderReplaceRewardTypeField(field)) return;
          autoSave();
        };
      });
    }
    document.querySelectorAll("[data-future-id][data-future-field], [data-objective-index][data-objective-field]").forEach(field => {
      field.onblur = autoSave;
      field.onchange = autoSave;
    });
    document.querySelectorAll("[data-story-cast-kind][data-story-cast-field]").forEach(field => {
      field.onblur = autoSave;
      field.onchange = autoSave;
    });
    if ($("storyBuilderAddFutureCharacterBtn")) $("storyBuilderAddFutureCharacterBtn").onclick = storyBuilderAddFutureCharacter;
    if ($("storyBuilderGenerateFutureCharacterBtn")) $("storyBuilderGenerateFutureCharacterBtn").onclick = storyBuilderGenerateFutureCharacter;
    if ($("storyBuilderImportBtn")) $("storyBuilderImportBtn").onclick = storyBuilderImportJson;
    if ($("storyBuilderRunAiBtn")) $("storyBuilderRunAiBtn").onclick = storyBuilderRunAiComposer;
    if ($("storyBuilderApplyPatchBtn")) $("storyBuilderApplyPatchBtn").onclick = storyBuilderApplyPendingPatch;
    bindStoryBuilderTreePanel();
  }
  function bindStoryBuilderTreePanel() {
    const graph = $("storyBuilderGraphViewport");
    if (!graph || !app.storyBuilder?.draft) return;
    graph.addEventListener("wheel", storyBuilderHandleTreeWheel, {
      passive: false
    });
    graph.onpointerdown = storyBuilderStartTreePan;
    graph.onpointermove = storyBuilderMoveTreePan;
    graph.onpointerup = storyBuilderEndTreePan;
    graph.onpointercancel = storyBuilderEndTreePan;
    graph.onlostpointercapture = storyBuilderEndTreePan;
    graph.querySelectorAll("[data-tree-port]").forEach(port => {
      port.onpointerdown = storyBuilderTreeStartConnection;
    });
    document.querySelectorAll("[data-tree-objective-field], [data-tree-json-field]").forEach(field => {
      const handler = () => storyBuilderApplyTreeInspectorField(field);
      const textField = field.matches('textarea, input:not([type]), input[type="text"], input[type="search"], input[type="number"]');
      field.onblur = textField ? handler : null;
      field.onchange = textField ? null : () => {
        field.dataset.storyBuilderModified = "true";
        handler();
      };
    });
    document.querySelectorAll("[data-outcome-route-index][data-outcome-route-field]").forEach(field => {
      const handler = () => storyBuilderApplyOutcomeRouteField(field);
      const textField = field.matches('textarea, input:not([type]), input[type="text"], input[type="search"], input[type="number"]');
      field.onblur = textField ? handler : null;
      field.onchange = textField ? null : handler;
    });
    document.querySelectorAll("[data-story-output-index][data-story-output-field]").forEach(field => {
      const handler = () => storyBuilderApplyOutputField(field);
      const textField = field.matches('textarea, input:not([type]), input[type="text"], input[type="search"], input[type="number"]');
      field.onblur = textField ? handler : null;
      field.onchange = textField ? null : handler;
    });
    document.querySelectorAll("[data-story-output-index][data-story-dialogue-index]").forEach(field => {
      field.onblur = () => storyBuilderApplyDialogueLine(field);
    });
    document.querySelectorAll("[data-story-output-index][data-story-dialogue-character]").forEach(field => {
      field.onchange = () => storyBuilderApplyDialogueCharacter(field);
    });
  }
  function saveStoryBuilderVisibleFields() {
    const builder = app.storyBuilder;
    if (!builder?.draft) return false;
    let valid = true;
    const draft = builder.draft;
    const titleField = $("storyBuilderTitle") || $("storyBuilderHeaderTitle");
    if (titleField) draft.title = titleField.value.trim() || "Untitled Story";
    if ($("storyBuilderDescription")) draft.description = $("storyBuilderDescription").value.trim();
    if ($("storyBuilderSource")) draft.source = entitySourceSlot($("storyBuilderSource").value);
    if ($("storyBuilderCreationTool")) draft.creation_tool = entityCreationToolSlot($("storyBuilderCreationTool").value);
    if ($("storyBuilderAllowAnyPlayer")) draft.allow_any_player = $("storyBuilderAllowAnyPlayer").checked;
    if ($("storyBuilderAnyPlayerEditor")) {
      try {
        const value = readFriendlyStateEditor({
          any_player_starting_state: clone(draft.any_player_starting_state || storyBuilderDefaultAnyPlayerStartingState())
        }, $("storyBuilderAnyPlayerEditor"));
        if (draft.allow_any_player === true) draft.any_player_starting_state = value.any_player_starting_state;else draft.any_player_starting_state = {};
      } catch (error) {
        builder.status = `Any-player starting fields are invalid: ${error.message}`;
        valid = false;
      }
    }
    const structuredEditor = $("storyBuilderStructuredEditor");
    if (structuredEditor) {
      try {
        const panel = structuredEditor.dataset.storyBuilderStructuredPanel;
        const value = readFriendlyStateEditor(storyBuilderStructuredPanelValue(panel, draft), structuredEditor);
        if (!storyBuilderApplyStructuredPanel(panel, value)) throw new Error("Unknown story editor section.");
      } catch (error) {
        builder.status = `Story section is invalid: ${error.message}`;
        valid = false;
      }
    }
    const objectiveCollectionsEditor = $("storyBuilderObjectiveCollectionsEditor");
    if (objectiveCollectionsEditor) {
      try {
        const objective = storyBuilderObjectiveById(builder.selectedObjectiveId, draft);
        if (!objective) throw new Error("Select an objective first.");
        const value = readFriendlyStateEditor(storyBuilderObjectiveCollectionsValue(objective), objectiveCollectionsEditor);
        storyBuilderApplyObjectiveCollections(objective, value);
      } catch (error) {
        builder.status = `Objective details are invalid: ${error.message}`;
        valid = false;
      }
    }
    for (const shellEditor of document.querySelectorAll("[data-story-builder-future-shell]")) {
      try {
        const id = shellEditor.dataset.storyBuilderFutureShell;
        const entry = draft.state?.future_cast?.items?.[id];
        if (!entry) throw new Error(`Future character "${id}" no longer exists.`);
        const previousShell = storyBuilderFutureShellValue(entry);
        const shell = readFriendlyStateEditor(previousShell, shellEditor);
        for (const key of Object.keys(previousShell)) delete entry[key];
        Object.assign(entry, shell);
      } catch (error) {
        builder.status = `Future-cast shell is invalid: ${error.message}`;
        valid = false;
      }
    }
    draft.state.meta ||= {};
    if ($("storyBuilderDefaultImageModel")) {
      const model = $("storyBuilderDefaultImageModel").value ? selectedImageModel($("storyBuilderDefaultImageModel").value) : "";
      if (model) {
        draft.default_image_model = model;
        draft.state.meta.default_image_model = model;
      } else {
        delete draft.default_image_model;
        delete draft.state.meta.default_image_model;
      }
    }
    if ($("storyBuilderGuidance")) {
      draft.state.meta ||= {};
      draft.state.meta.story_guidance = $("storyBuilderGuidance").value.trim();
    }
    if ($("storyBuilderTitleCardPrompt")) {
      draft.title_card_image = createStoryTitleCardImageSlot(draft.title_card_image, draft.state, draft);
      if ($("storyBuilderTitleCardPrompt")) draft.title_card_image.prompt = $("storyBuilderTitleCardPrompt").value.trim();
      draft.title_card_image.negativePrompt = "";
    }
    if ($("storyBuilderTitleCardSubjects")) {
      draft.title_card_subjects = stringListSlot($("storyBuilderTitleCardSubjects").value.split(/\n/).map(item => item.trim()), []);
    }
    const genreChecks = [...document.querySelectorAll(".storyBuilderGenreCheck")];
    if (genreChecks.length) {
      const genres = approvedGenreList(genreChecks.filter(field => field.checked).map(field => field.value));
      draft.state.meta ||= {};
      draft.state.meta.genres = genres;
      draft.genres = genres;
    }
    document.querySelectorAll("[data-future-id][data-future-field]").forEach(field => {
      const entry = draft.state.future_cast?.items?.[field.dataset.futureId];
      if (!entry) return;
      setStoryBuilderObjectField(entry, field.dataset.futureField, field.value);
    });
    document.querySelectorAll("[data-objective-index][data-objective-field]").forEach(field => {
      const objective = draft.state.objectives?.items?.[Number(field.dataset.objectiveIndex)];
      if (!objective) return;
      if (["rewards", "outcome_routes"].includes(field.dataset.objectiveField)) {
        try {
          objective[field.dataset.objectiveField] = JSON.parse(field.value || "[]");
        } catch {
          builder.status = `Objective ${field.dataset.objectiveField} JSON is invalid.`;
          valid = false;
        }
        return;
      }
      if (field.dataset.objectiveField === "requires") {
        objective.requires = String(field.value || "").split(/\n+/).map(line => line.trim()).filter(Boolean);
        return;
      }
      if (field.dataset.objectiveField === "kind") {
        objective.type = field.value === "side" ? "side" : "story";
        delete objective.kind;
        return;
      }
      objective[field.dataset.objectiveField] = field.value;
    });
    document.querySelectorAll("[data-objective-requires]").forEach(field => {
      const objective = draft.state.objectives?.items?.[Number(field.dataset.objectiveIndex)];
      if (!objective) return;
      const boxes = [...document.querySelectorAll(`[data-objective-index="${field.dataset.objectiveIndex}"][data-objective-requires]`)];
      const picked = boxes.filter(box => box.checked).map(box => box.dataset.objectiveRequires).filter(Boolean);
      if (boxes.length) objective.requires = [...new Set(picked)];
    });
    document.querySelectorAll("[data-tree-objective-field], [data-tree-json-field]").forEach(field => storyBuilderApplyTreeInspectorField(field, {
      persist: false,
      rerender: false
    }));
    document.querySelectorAll("[data-outcome-route-index][data-outcome-route-field]").forEach(field => storyBuilderApplyOutcomeRouteField(field, {
      persist: false,
      rerender: false
    }));
    [...document.querySelectorAll("[data-story-cast-kind][data-story-cast-field]")].sort((a, b) => (a.dataset.storyCastField === "name" ? 1 : 0) - (b.dataset.storyCastField === "name" ? 1 : 0)).forEach(field => {
      storyBuilderApplyCastField(field);
    });
    draft.state = stripRuntimeTemplateFields(draft.state);
    builder.dirty = true;
    return valid;
  }
  function storyBuilderApplyCastField(field) {
    const builder = app.storyBuilder;
    const state = builder?.draft?.state;
    if (!state) return;
    const kind = field.dataset.storyCastKind;
    const key = field.dataset.storyCastKey;
    const slot = field.dataset.storyCastField;
    const value = field.type === "checkbox" ? !!field.checked : field.value;
    if (kind === "player") {
      const index = Number(key) || 0;
      const players = storyTemplatePlayerOptions(state);
      if (players.length) {
        state.players ||= players.map(option => option.character);
        const character = state.players[index];
        if (!character) return;
        character[slot] = slot === "age" ? parseAdultAgeInput(value, `story builder player ${character.name || index}.age`) : value;
        if (index === 0) state.player = clone(character);
      } else {
        state.player ||= blankCharacterTemplate("Player");
        state.player[slot] = slot === "age" ? parseAdultAgeInput(value, `story builder player ${state.player.name || "Player"}.age`) : value;
      }
      return;
    }
    if (kind === "character") {
      state.characters ||= {};
      const character = state.characters[key];
      if (!character) return;
      if (slot === "scene.active" || slot === "scene.image") {
        storyBuilderSetSceneListName(slot === "scene.active" ? "party_members_present" : "image_characters", character.name || key, !!value);
        return;
      }
      if (slot === "name") {
        const oldName = character.name || key;
        const newName = textSlot(value, oldName);
        character.name = newName;
        if (newName && newName !== key) {
          delete state.characters[key];
          state.characters[newName] = character;
          storyBuilderRenameSceneListName(oldName, newName);
        }
        return;
      }
      character[slot] = slot === "age" ? parseAdultAgeInput(value, `story builder character ${character.name || key}.age`) : value;
      return;
    }
    if (kind === "npc") {
      const [locationId, npcKey] = String(key || "").split("||");
      const location = state.npc_directory?.locations?.[locationId];
      const npc = location?.characters?.[npcKey];
      if (!npc) return;
      if (slot === "scene.active" || slot === "scene.nearby" || slot === "scene.image") {
        const listKey = slot === "scene.active" ? "party_members_present" : slot === "scene.nearby" ? "npcs_present" : "image_characters";
        storyBuilderSetSceneListName(listKey, npc.name || npcKey, !!value);
        return;
      }
      if (slot === "inspected") {
        npc.inspected = !!value;
        if (npc.inspected && !npc.full_character) npc.full_character = addImmutableDefinitionFields(blankCharacterTemplate(npc.name || npcKey), npc.name || npcKey);
        return;
      }
      if (slot === "locationId") {
        const nextId = textSlot(value, locationId);
        if (isNpcLocationId(nextId) && nextId !== locationId) {
          state.npc_directory.locations[nextId] ||= {
            label: nextId,
            characters: {}
          };
          state.npc_directory.locations[nextId].characters[npcKey] = npc;
          delete location.characters[npcKey];
        }
        return;
      }
      if (slot === "name") {
        const oldName = npc.name || npcKey;
        const newName = textSlot(value, oldName);
        npc.name = newName;
        if (npc.full_character) npc.full_character.name = newName;
        if (newName && newName !== npcKey) {
          delete location.characters[npcKey];
          location.characters[newName] = npc;
          storyBuilderRenameSceneListName(oldName, newName);
        }
        return;
      }
      npc[slot] = slot === "age" ? parseAdultAgeInput(value, `story builder NPC ${npc.name || npcKey}.age`) : value;
      if (npc.full_character && slot === "role") npc.full_character.role = value;
      if (npc.full_character && ["gender", "age"].includes(slot)) npc.full_character[slot] = npc[slot];
    }
  }
  function storyBuilderSetSceneListName(listKey, name, enabled) {
    const state = app.storyBuilder?.draft?.state;
    if (!state || !name) return;
    state.scene ||= {};
    const current = new Set(stringListSlot(state.scene[listKey], []));
    if (enabled) current.add(name);else current.delete(name);
    state.scene[listKey] = [...current];
  }
  function storyBuilderRenameSceneListName(oldName, newName) {
    const state = app.storyBuilder?.draft?.state;
    if (!state || !oldName || !newName) return;
    state.scene ||= {};
    for (const listKey of ["party_members_present", "npcs_present", "image_characters"]) {
      state.scene[listKey] = stringListSlot(state.scene[listKey], []).map(item => item === oldName ? newName : item);
    }
  }
  function storyBuilderEnsurePlayerOptions() {
    const state = app.storyBuilder?.draft?.state;
    if (!state) return [];
    if (!Array.isArray(state.players)) {
      state.players = [addImmutableDefinitionFields(clone(state.player || blankCharacterTemplate("Player")), state.player?.name || "Player")];
    }
    return state.players;
  }
  function storyBuilderNewEmbeddedCharacterDefinition(name, runtimeFields = {}) {
    const runtime = {
      ...blankCharacterTemplate(name),
      ...runtimeFields,
      name
    };
    const definition = standaloneCharacterStoryProjection(runtimeCharacterDefinitionRecord(name, runtime).character);
    const validation = validateCharacterDefinition(definition, `story character ${name}`, {
      embedded: true
    });
    if (!validation.ok) throw new Error(validationErrorsText(validation));
    return definition;
  }
  async function storyBuilderAddPlayerOption() {
    const builder = app.storyBuilder;
    if (!builder?.draft?.state) return;
    saveStoryBuilderVisibleFields();
    const players = storyBuilderEnsurePlayerOptions();
    const name = uniqueNameForStoryBuilder("Player Option", players.map(player => player.name));
    players.push(storyBuilderNewEmbeddedCharacterDefinition(name, {
      relationship_to_player: "self",
      role: "selectable protagonist"
    }));
    builder.dirty = true;
    const saved = await saveStoryBuilderDraft(false, {
      collectVisible: false
    });
    renderStoryBuilder();
    return saved;
  }
  async function storyBuilderAddStartingCharacter() {
    const builder = app.storyBuilder;
    if (!builder?.draft?.state) return;
    saveStoryBuilderVisibleFields();
    const state = builder.draft.state;
    state.characters ||= {};
    const name = uniqueNameForStoryBuilder("New Ally", Object.keys(state.characters));
    state.characters[name] = storyBuilderNewEmbeddedCharacterDefinition(name, {
      role: "starting party character",
      relationship_to_player: "ally"
    });
    storyBuilderSetSceneListName("party_members_present", name, true);
    storyBuilderSetSceneListName("image_characters", name, true);
    builder.dirty = true;
    const saved = await saveStoryBuilderDraft(false, {
      collectVisible: false
    });
    renderStoryBuilder();
    return saved;
  }
  async function storyBuilderAddOpeningNpc() {
    const builder = app.storyBuilder;
    if (!builder?.draft?.state) return;
    saveStoryBuilderVisibleFields();
    const state = builder.draft.state;
    let locationId = currentNpcLocationId(state);
    if (!isNpcLocationId(locationId)) {
      const mapLocationId = textSlot(state.world_map?.current_location_id, "");
      locationId = isNpcLocationId(mapLocationId) ? mapLocationId : "story-builder-location";
      state.location ||= {};
      state.location.npc_location_id = locationId;
    }
    const location = ensureNpcDirectoryLocation(state, locationId, currentSettlementName(state));
    location.characters ||= {};
    const name = uniqueNameForStoryBuilder("New NPC", Object.keys(location.characters));
    location.characters[name] = {
      name,
      gender: "unspecified",
      age: 25,
      role: "local",
      relationship: "neutral",
      note: "Opening scene NPC.",
      inspected: false,
      status: "alive",
      death_note: "",
      full_character: storyBuilderNewEmbeddedCharacterDefinition(name, {
        role: "local",
        relationship_to_player: "neutral"
      })
    };
    storyBuilderSetSceneListName("npcs_present", name, true);
    builder.dirty = true;
    const saved = await saveStoryBuilderDraft(false, {
      collectVisible: false
    });
    renderStoryBuilder();
    return saved;
  }
  function uniqueNameForStoryBuilder(baseName, used = []) {
    const base = textSlot(baseName, "New Entry");
    const usedSet = new Set((used || []).map(item => String(item || "")));
    if (!usedSet.has(base)) return base;
    let index = 2;
    while (usedSet.has(`${base} ${index}`)) index++;
    return `${base} ${index}`;
  }
  async function storyBuilderDeleteCastEntry(kind, key) {
    const builder = app.storyBuilder;
    const state = builder?.draft?.state;
    if (!state) return;
    if (!(await showConfirm("Delete Story Character", "Delete this character from the story draft? References may need to be updated. You can undo this change from the Story Builder header.", {
      confirmText: "Delete",
      danger: true
    }))) return false;
    if (kind === "player") {
      const index = Number(key) || 0;
      if (Array.isArray(state.players) && state.players.length > 1) {
        state.players.splice(index, 1);
        state.player = clone(state.players[0]);
      }
    } else if (kind === "character") {
      const character = state.characters?.[key];
      delete state.characters?.[key];
      storyBuilderRenameSceneListName(character?.name || key, "");
      state.scene ||= {};
      for (const listKey of ["party_members_present", "npcs_present", "image_characters"]) {
        state.scene[listKey] = stringListSlot(state.scene?.[listKey], []).filter(Boolean);
      }
    } else if (kind === "npc") {
      const [locationId, npcKey] = String(key || "").split("||");
      const location = state.npc_directory?.locations?.[locationId];
      const npc = location?.characters?.[npcKey];
      delete location?.characters?.[npcKey];
      storyBuilderRenameSceneListName(npc?.name || npcKey, "");
      state.scene ||= {};
      for (const listKey of ["party_members_present", "npcs_present", "image_characters"]) {
        state.scene[listKey] = stringListSlot(state.scene?.[listKey], []).filter(Boolean);
      }
    }
    builder.dirty = true;
    const saved = await saveStoryBuilderDraft(false);
    renderStoryBuilder();
    return saved;
  }
  function storyBuilderCharacterDefinitionTarget(kind, key) {
    const state = app.storyBuilder?.draft?.state;
    if (!state) return null;
    if (kind === "player") {
      const players = Array.isArray(state.players) ? state.players : null;
      const index = Number(key) || 0;
      return {
        label: players ? `Player Option ${index + 1}` : "Player",
        character: players ? players[index] : state.player,
        save(next) {
          if (players) {
            state.players[index] = next;
            if (index === 0) state.player = clone(next);
          } else {
            state.player = next;
          }
        }
      };
    }
    if (kind === "character") {
      return {
        label: key,
        character: state.characters?.[key],
        save(next) {
          const oldName = key;
          const newName = textSlot(next.name, oldName);
          next.name = newName;
          state.characters ||= {};
          delete state.characters[oldName];
          state.characters[newName] = next;
          storyBuilderRenameSceneListName(oldName, newName);
        }
      };
    }
    if (kind === "npc") {
      const [locationId, npcKey] = String(key || "").split("||");
      const npc = state.npc_directory?.locations?.[locationId]?.characters?.[npcKey];
      if (!npc) return null;
      if (!npc.full_character) npc.full_character = addImmutableDefinitionFields(blankCharacterTemplate(npc.name || npcKey), npc.name || npcKey);
      return {
        label: npc.name || npcKey,
        character: npc.full_character,
        save(next) {
          const oldName = npc.name || npcKey;
          const newName = textSlot(next.name, oldName);
          npc.name = newName;
          npc.gender = textSlot(next.gender, npc.gender || "unspecified");
          npc.age = parseAdultAgeInput(next.age, `story builder full NPC ${newName}.age`);
          npc.role = textSlot(next.role, npc.role || "local");
          npc.inspected = true;
          npc.full_character = next;
          const location = state.npc_directory.locations[locationId];
          if (newName && newName !== npcKey) {
            delete location.characters[npcKey];
            location.characters[newName] = npc;
            storyBuilderRenameSceneListName(oldName, newName);
          }
        }
      };
    }
    if (kind === "future") {
      const entry = state.future_cast?.items?.[key];
      if (!entry) return null;
      if (!entry.full_character) entry.full_character = addImmutableDefinitionFields(blankCharacterTemplate(entry.name || key), entry.name || key);
      return {
        label: entry.name || key,
        character: entry.full_character,
        save(next) {
          const oldName = entry.name || key;
          const newName = textSlot(next.name, oldName);
          entry.name = newName;
          entry.full_character = next;
        }
      };
    }
    return null;
  }
  function storyBuilderImageEntryPreviewUrl(entry = {}) {
    if (entry.kind === "title") {
      const slot = createStoryTitleCardImageSlot(app.storyBuilder?.draft?.title_card_image, app.storyBuilder?.draft?.state, app.storyBuilder?.draft);
      return slot.url || "";
    }
    if (entry.kind === "profile") {
      const slot = profileImagePresentationSlot(entry.character, entry.male === true);
      if (!defaultProfileImageSlotHasRealReference(slot)) return "";
      const local = slot.local_image_id ? profileImageByStoreId(slot.local_image_id) : null;
      if (profileImageRecordIsBlockedPlaceholder(local)) return "";
      return slot.url || slot.hosted_url || imageSrcFromHtml(slot.html) || local?.hosted_url || local?.url || imageSrcFromHtml(local?.html || "") || "";
    }
    if (entry.kind === "unlock") {
      const slot = entry.entry?.on_unlock?.image || {};
      return slot.url || slot.hosted_url || imageSrcFromHtml(slot.html) || "";
    }
    if (entry.kind === "story-reward") {
      const slot = entry.reward?.image || {};
      return slot.url || slot.hosted_url || imageSrcFromHtml(slot.html) || "";
    }
    if (entry.kind === "authored-asset") {
      const slot = entry.asset || {};
      return slot.url || slot.hosted_url || imageSrcFromHtml(slot.html) || "";
    }
    return "";
  }
  function storyBuilderImageEntryIsReady(entry = {}) {
    return !!storyBuilderImageEntryPreviewUrl(entry);
  }
  function storyBuilderImageEntryKey(entry = {}) {
    return [entry.kind, entry.targetKind || "", entry.targetKey || "", entry.presentation || ""].map(part => String(part || "").replace(/\|/g, "%7C")).join("|");
  }
  function storyBuilderImageManifest(draft = app.storyBuilder?.draft) {
    if (!draft) return [];
    const entries = [];
    const titleCard = createStoryTitleCardImageSlot(draft.title_card_image, draft.state, draft);
    entries.push({
      kind: "title",
      slotId: "title|||",
      group: "Story",
      title: "Title Card",
      subtitle: draft.title || "Story title",
      prompt: titleCard.prompt
    });
    for (const target of storyBuilderImageTargets(draft.state)) {
      for (const [presentation, male] of [["male", true], ["non_male", false]]) {
        const display = characterLibraryPresentation(target.character, target.key || target.name, male ? "male" : "female");
        const name = textSlot(display?.name || target.name, target.name);
        entries.push({
          kind: "profile",
          targetKind: target.kind,
          targetKey: target.key,
          presentation,
          male,
          character: target.character,
          group: target.label,
          title: name,
          subtitle: male ? "Male profile image" : "Female profile image"
        });
      }
      if (target.kind === "future") {
        entries.push({
          kind: "unlock",
          targetKind: target.kind,
          targetKey: target.key,
          presentation: "unlock",
          entry: target.entry,
          group: "Future Character Unlocks",
          title: `${target.name} Unlock`,
          subtitle: "Reusable unlock image",
          prompt: target.entry?.on_unlock?.image?.prompt || ""
        });
      }
    }
    const seenRewards = new Set();
    const visitRewards = (value, path = []) => {
      if (!value || typeof value !== "object") return;
      if (Array.isArray(value)) {
        value.forEach((item, index) => visitRewards(item, [...path, index]));
        return;
      }
      if (value.type === "generate_story_image" && !seenRewards.has(value)) {
        seenRewards.add(value);
        const id = textSlot(value.id || value.image_id, `story-image-${entries.length + 1}`);
        entries.push({
          kind: "story-reward",
          targetKind: "reward",
          targetKey: path.join("."),
          presentation: id,
          reward: value,
          group: "Story Images",
          title: textSlot(value.title || value.name, id),
          subtitle: "Objective or event image",
          prompt: textSlot(value.prompt || value.positive_prompt || value.positivePrompt, "")
        });
      }
      for (const [key, item] of Object.entries(value)) visitRewards(item, [...path, key]);
    };
    visitRewards(draft.state?.objectives || {}, ["objectives"]);
    visitRewards(draft.state?.timed_events || {}, ["timed_events"]);
    visitRewards(draft.state?.story_pacing || {}, ["story_pacing"]);
    visitRewards(draft.state?.reward_bundles || {}, ["reward_bundles"]);
    visitRewards(draft.state?.reward_templates || {}, ["reward_templates"]);
    visitRewards(draft.state?.story_shops || {}, ["story_shops"]);
    const knownImageSlots = new WeakSet();
    for (const entry of entries) {
      const slot = entry.kind === "story-reward" ? entry.reward?.image : entry.kind === "unlock" ? entry.entry?.on_unlock?.image : null;
      if (slot && typeof slot === "object") knownImageSlots.add(slot);
    }
    const seenAssets = new WeakSet();
    const addAuthoredAsset = (owner, asset, path, title = "") => {
      if (!isPlainObject(asset) || knownImageSlots.has(asset) || seenAssets.has(asset)) return;
      const prompt = textSlot(asset.prompt || asset.positive_prompt || asset.positivePrompt || owner?.image_prompt || owner?.imagePrompt, "");
      const authoredUrl = textSlot(asset.url || asset.hosted_url, "");
      if (!prompt && !authoredUrl) return;
      seenAssets.add(asset);
      const root = String(path[0] || "story");
      const fallbackTitle = path.filter(part => !Number.isInteger(part)).slice(-2).map(part => stateEditorDisplayLabel(part, {
        profile: "story_builder"
      })).join(" / ");
      entries.push({
        kind: "authored-asset",
        targetKind: root,
        targetKey: path.join("."),
        presentation: textSlot(asset.id, path.join("-")),
        owner,
        asset,
        group: stateEditorDisplayLabel(root, {
          profile: "story_builder"
        }),
        title: textSlot(title || owner?.title || owner?.name, fallbackTitle || "Story Asset"),
        subtitle: "Authored story asset",
        prompt
      });
    };
    const visitAuthoredAssets = (value, path = []) => {
      if (!value || typeof value !== "object") return;
      if (Array.isArray(value)) {
        value.forEach((item, index) => {
          if (path.at(-1) === "images" && isPlainObject(item)) addAuthoredAsset(item, item, [...path, index], item.title || item.name);
          visitAuthoredAssets(item, [...path, index]);
        });
        return;
      }
      if (isPlainObject(value.image)) addAuthoredAsset(value, value.image, [...path, "image"]);else if (textSlot(value.image_prompt || value.imagePrompt, "")) {
        addAuthoredAsset(value, {}, [...path, "image"]);
      }
      for (const [key, item] of Object.entries(value)) visitAuthoredAssets(item, [...path, key]);
    };
    visitAuthoredAssets(draft.state || {}, ["state"]);
    for (const entry of entries) entry.slotId = storyBuilderImageEntryKey(entry);
    return entries;
  }
  function storyBuilderImageManifestCounts(entries = []) {
    const total = entries.length;
    const ready = entries.filter(storyBuilderImageEntryIsReady).length;
    const missing = Math.max(0, total - ready);
    return {
      total,
      ready,
      missing
    };
  }
  function storyBuilderImageFilterChoice() {
    return String(app.storyBuilder?.imageFilter || "all");
  }
  function setStoryBuilderImageFilter(filter) {
    if (!app.storyBuilder) return;
    app.storyBuilder.imageFilter = ["all", "missing", "ready"].includes(filter) ? filter : "all";
    renderStoryBuilder();
  }
  function storyBuilderImageAutogenPausedByEditor() {
    const modal = $("modal");
    if (modal && !modal.classList.contains("hidden")) return true;
    return !!document.querySelector("#storyBuilderCharacterDefinitionEditor, #imageLabModal, .profile-image-picker-modal");
  }
  function storyBuilderEnsureImageAutogen() {
    const builder = app.storyBuilder;
    if (!builder?.draft) return;
    if (builder.imageAutogenEnabled === undefined) builder.imageAutogenEnabled = true;
    if (builder.imageAutogenTimer) return;
    builder.imageAutogenTimer = setInterval(storyBuilderImageAutogenTick, 1000);
  }
  function storyBuilderStopImageAutogen() {
    const timer = app.storyBuilder?.imageAutogenTimer;
    if (timer) clearInterval(timer);
    if (app.storyBuilder) app.storyBuilder.imageAutogenTimer = null;
  }
  function storyBuilderToggleImageAutogen() {
    const builder = app.storyBuilder;
    if (!builder) return;
    builder.imageAutogenEnabled = builder.imageAutogenEnabled !== false ? false : true;
    if (builder.imageAutogenEnabled) storyBuilderEnsureImageAutogen();
    renderStoryBuilder();
  }
  async function storyBuilderImageAutogenTick() {
    const builder = app.storyBuilder;
    if (!builder?.draft) {
      storyBuilderStopImageAutogen();
      return;
    }
    if (builder.imageAutogenEnabled === false || builder.imageGenerationActive) return;
    if (EMBERADVENTURES_DEBUG_TEST_SCENARIO) return;
    if (storyBuilderImageAutogenPausedByEditor()) return;
    const entry = storyBuilderImageManifest(builder.draft).find(item => !storyBuilderImageEntryIsReady(item));
    if (!entry) return;
    await storyBuilderGenerateManifestImage(entry.slotId, {
      background: true
    });
  }
  async function storyBuilderGenerateAllMissingImages() {
    const builder = app.storyBuilder;
    if (!builder?.draft || builder.imageGenerationActive) return;
    builder.imageQueueStopAfterCurrent = false;
    let guard = 0;
    while (builder?.draft && !builder.imageQueueStopAfterCurrent && guard < 1000) {
      guard++;
      const entry = storyBuilderImageManifest(builder.draft).find(item => !storyBuilderImageEntryIsReady(item));
      if (!entry) break;
      await storyBuilderGenerateManifestImage(entry.slotId, {
        background: false
      });
    }
    if (builder) {
      builder.imageQueueStopAfterCurrent = false;
      renderStoryBuilder();
    }
  }
  function storyBuilderStopImageQueueAfterCurrent() {
    if (!app.storyBuilder) return;
    app.storyBuilder.imageQueueStopAfterCurrent = true;
    app.storyBuilder.status = "Image queue will stop after the current image.";
    renderStoryBuilder();
  }
  async function storyBuilderGenerateManifestImage(slotId, options = {}) {
    const builder = app.storyBuilder;
    if (!builder?.draft || builder.imageGenerationActive) return;
    const entry = storyBuilderImageManifest(builder.draft).find(item => item.slotId === slotId);
    if (!entry || storyBuilderImageEntryIsReady(entry)) return;
    builder.imageGenerationActive = slotId;
    if (!options.background) renderStoryBuilder();
    try {
      if (entry.kind === "title") await storyBuilderGenerateTitleCardImage({
        fromManifest: true
      });else if (entry.kind === "profile") await storyBuilderGenerateDefaultProfileImage(entry.targetKind, entry.targetKey, entry.male ? "male" : "female", {
        fromManifest: true
      });else if (entry.kind === "unlock") await storyBuilderGenerateUnlockImage(entry.targetKey, {
        fromManifest: true
      });else if (entry.kind === "story-reward") await storyBuilderGenerateRewardImage(entry);else if (entry.kind === "authored-asset") await storyBuilderGenerateRewardImage(entry);
    } finally {
      if (app.storyBuilder) app.storyBuilder.imageGenerationActive = "";
      if (app.storyBuilder && !options.background) renderStoryBuilder();
    }
  }
  function renderStoryBuilderImageManifestCard(entry) {
    const ready = storyBuilderImageEntryIsReady(entry);
    const active = app.storyBuilder?.imageGenerationActive === entry.slotId;
    const previewUrl = storyBuilderImageEntryPreviewUrl(entry);
    const status = active ? "Generating" : ready ? "Ready" : "Missing";
    const preview = previewUrl ? `<div class="story-builder-image-preview"><img src="${escapeHtml(previewUrl)}" alt="${escapeHtml(entry.title)}"></div>` : `<div class="story-builder-image-placeholder">${active ? "Generating..." : "No image yet"}</div>`;
    return `
                <section class="story-builder-image-card ${ready ? "ready" : "missing"} ${active ? "generating" : ""}">
                    <div class="story-builder-image-card-header">
                        <div>
                            <div class="story-builder-image-card-title">${escapeHtml(entry.title)}</div>
                            <div class="story-builder-image-card-meta">${escapeHtml(entry.group)} / ${escapeHtml(entry.subtitle || "")}</div>
                        </div>
                        <span class="story-builder-chip">${escapeHtml(status)}</span>
                    </div>
                    ${preview}
                    ${entry.prompt ? `<p class="hint">${escapeHtml(entry.prompt)}</p>` : ""}
                    <div class="row">
                        <button type="button" onclick="EmberAdventures.storyBuilderGenerateManifestImage(${htmlJsArg(entry.slotId)})" ${active ? "disabled" : ""}>${ready ? "Regenerate" : "Generate"}</button>
                    </div>
                </section>
            `;
  }
  function renderStoryBuilderImagesPanel(draft) {
    const builder = app.storyBuilder || {};
    const titleCard = createStoryTitleCardImageSlot(draft.title_card_image, draft.state, draft);
    const entries = storyBuilderImageManifest(draft);
    const counts = storyBuilderImageManifestCounts(entries);
    const filter = storyBuilderImageFilterChoice();
    const visible = entries.filter(entry => {
      const ready = storyBuilderImageEntryIsReady(entry);
      if (filter === "missing") return !ready;
      if (filter === "ready") return ready;
      return true;
    });
    const titleCardPreview = builder.titleCardLiveHtml ? `<div class="story-builder-image-preview">${builder.titleCardLiveHtml}</div>` : imageSrcFromHtml(titleCard.html) ? `<div class="story-builder-image-preview">${titleCard.html}</div>` : `<div class="hint">No title-card image generated yet.</div>`;
    return `
                <section class="story-builder-section">
                    <div class="story-builder-section-header">
                        <div>
                            <h3>Story Images</h3>
                            <p class="hint">Images generate one at a time while this editor is open. Open an item editor to pause background generation for that item.</p>
                        </div>
                        ${""}
                    </div>
                    <div class="story-builder-image-counts">
                        <span class="story-builder-chip">${counts.ready} ready</span>
                        <span class="story-builder-chip">${counts.missing} missing</span>
                        <span class="story-builder-chip">${counts.total} total</span>
                    </div>
                    <div class="story-builder-image-toolbar">
                        <button type="button" class="primary" onclick="EmberAdventures.storyBuilderGenerateAllMissingImages()" ${builder.imageGenerationActive ? "disabled" : ""}>Generate Missing</button>
                        <button type="button" onclick="EmberAdventures.storyBuilderStopImageQueueAfterCurrent()">Stop After Current</button>
                        <button type="button" onclick="EmberAdventures.storyBuilderToggleImageAutogen()">${builder.imageAutogenEnabled === false ? "Start Background Generation" : "Pause Background Generation"}</button>
                        <label>Show
                            <select onchange="EmberAdventures.setStoryBuilderImageFilter(this.value)">
                                <option value="all" ${filter === "all" ? "selected" : ""}>All</option>
                                <option value="missing" ${filter === "missing" ? "selected" : ""}>Missing</option>
                                <option value="ready" ${filter === "ready" ? "selected" : ""}>Ready</option>
                            </select>
                        </label>
                    </div>
                    <div class="story-builder-status" style="margin-top:.6rem">${escapeHtml(builder.status || "Ready")}</div>
                </section>
                <section class="story-builder-section">
                    <h3>Title Card Prompt</h3>
                    ${titleCardPreview}
                    <label>Title-card prompt <textarea id="storyBuilderTitleCardPrompt" rows="4">${escapeHtml(titleCard.prompt)}</textarea></label>
                    <label>Featured subjects <textarea id="storyBuilderTitleCardSubjects" rows="3" placeholder="One character, faction, object, or scene element per line">${escapeHtml(storyTitleCardSubjects(draft, draft.state).join("\n"))}</textarea></label>
                    <div class="row">
                        <button type="button" class="primary" onclick="EmberAdventures.storyBuilderGenerateTitleCardImage()">Generate Title Card</button>
                    </div>
                </section>
                <div class="story-builder-grid">
                    ${visible.map(renderStoryBuilderImageManifestCard).join("") || `<p class="hint">No images match this filter.</p>`}
                </div>
            `;
  }
  function storyBuilderImageTargets(state = app.storyBuilder?.draft?.state || {}) {
    const targets = [];
    const add = (kind, key, label, character, extra = {}) => {
      if (!isPlainObject(character)) return;
      const name = textSlot(character.name || extra.entry?.name, String(key || label || kind));
      targets.push({
        kind,
        key: String(key),
        label,
        name,
        character,
        ...extra
      });
    };
    const players = storyTemplatePlayerOptions(state);
    if (players.length) {
      players.forEach((option, index) => add("player", index, `Playable Character ${index + 1}`, option.character));
    } else {
      add("player", 0, "Player", state.player);
    }
    for (const [key, character] of Object.entries(state.characters || {})) {
      add("character", key, "Starting Party Member", character);
    }
    for (const entry of storyBuilderOpeningNpcEntries(state)) {
      const npc = entry.npc || {};
      if (!isPlainObject(npc.full_character)) continue;
      add("npc", `${entry.locationId}||${entry.key}`, "Opening Inspected NPC", npc.full_character, {
        npc
      });
    }
    for (const [key, entry] of Object.entries(state.future_cast?.items || {})) {
      add("future", key, "Future Character", entry.full_character || entry, {
        entry
      });
    }
    return targets;
  }
  function storyBuilderEditCharacterDefinition(kind, key) {
    saveStoryBuilderVisibleFields();
    const target = storyBuilderCharacterDefinitionTarget(kind, key);
    if (!target?.character) return;
    openModal(`
                <div id="storyBuilderCharacterDefinitionEditor" class="state-editor-tree">
                    ${buildFriendlyStateEditor(storyBuilderCharacterDefinitionValue(target.character), [], 0, {
      profile: "story_builder"
    })}
                </div>
                <div class="row" style="margin-top:.8rem">
                    <button class="primary" type="button" onclick="EmberAdventures.storyBuilderSaveCharacterDefinition(${htmlJsArg(kind)}, ${htmlJsArg(key)})">Save Definition</button>
                    <button type="button" onclick="EmberAdventures.closeModal()">Cancel</button>
                </div>
            `, {
      title: `Edit ${target.label}`
    });
  }
  function storyBuilderSaveCharacterDefinition(kind, key) {
    const target = storyBuilderCharacterDefinitionTarget(kind, key);
    const editor = $("storyBuilderCharacterDefinitionEditor");
    if (!target?.character || !editor) return;
    const value = readFriendlyStateEditor(storyBuilderCharacterDefinitionValue(target.character), editor);
    const next = {
      ...clone(target.character),
      ...clone(value.character_definition || {})
    };
    removeRuntimeClothingFromCharacterDefinition(next);
    const complete = addImmutableDefinitionFields(next, next.name || target.label);
    const validation = validateCharacterDefinition(complete);
    if (!validation.ok) {
      showNotice("Character Definition Needs Repair", validation.errors.slice(0, 8).map(error => `${error.path}: ${error.message}`).join("\n"));
      return false;
    }
    target.save(complete);
    app.storyBuilder.dirty = true;
    saveStoryBuilderDraft(false, {
      collectVisible: false
    });
    closeModal();
    renderStoryBuilder();
  }
  function setStoryBuilderObjectField(target, path, rawValue) {
    const parts = String(path || "").split(".");
    let value = rawValue;
    if (["profile_images", "images", "on_unlock.image"].includes(path)) {
      try {
        value = JSON.parse(rawValue || (path === "on_unlock.image" ? "{}" : "[]"));
      } catch {
        app.storyBuilder.status = `${path} JSON is invalid.`;
        return;
      }
    }
    let cursor = target;
    for (let i = 0; i < parts.length - 1; i++) {
      cursor[parts[i]] ||= {};
      cursor = cursor[parts[i]];
    }
    cursor[parts[parts.length - 1]] = value;
    if (path === "on_unlock.image") {
      target.on_unlock ||= {};
      target.on_unlock.image ||= {};
      target.on_unlock.image.favorite = target.on_unlock.image.favorite === true;
    }
  }
  function storyBuilderFinalizeObjectiveStructure(draft = {}) {
    const outputModes = storyBuilderObjectiveOutputModeStore(draft);
    for (const objective of storyBuilderObjectiveList(draft)) {
      let mode = storyBuilderObjectiveOutputMode(objective, draft);
      if (mode === "multiple" && storyBuilderObjectiveOutputRows(objective).length <= 1) {
        mode = "one";
        outputModes[objective.id] = "one";
      }
      if (mode === "none") mode = "one";
      const rows = storyBuilderCanonicalizeOutputStorage(objective, mode);
      rows.forEach((row, index) => {
        row.id = storyBuilderOutputStableId(objective, row, index);
        if (textSlot(row.next_objective_id || row.objective_id, "") && !textSlot(row.target_input_group_id, "")) row.target_input_group_id = generatedPersistentId("input-group");
      });
      const fallbacks = rows.filter(row => row.fallback === true);
      if (fallbacks.length === 1) {
        const fallback = fallbacks[0];
        const fallbackIndex = rows.indexOf(fallback);
        if (fallbackIndex >= 0 && fallbackIndex !== rows.length - 1) {
          rows.splice(fallbackIndex, 1);
          rows.push(fallback);
        }
      }
      if (mode !== "one") continue;
      const row = rows[0];
      objective.completion_instruction = textSlot(row.completion_instruction, objective.completion_instruction || "");
      objective.rewards = clone(Array.isArray(row.rewards) ? row.rewards : objective.rewards || []);
      if (Array.isArray(row.dialogue_lines)) objective.dialogue_lines = row.dialogue_lines.map(String);else delete objective.dialogue_lines;
      const travelLocationId = textSlot(row.travel_location_id, objective.travel_location_id || "");
      if (travelLocationId) objective.travel_location_id = travelLocationId;else delete objective.travel_location_id;
      delete objective.terminal_mode;
      delete objective.ending_title;
      delete objective.ending_message;
      delete objective.end_state;
      delete objective.ending;
      delete row.completion_instruction;
      delete row.rewards;
      delete row.dialogue_lines;
      delete row.travel_location_id;
    }
    return draft;
  }
  async function saveStoryBuilderDraft(renderAfter = true, options = {}) {
    const builder = app.storyBuilder;
    if (!builder?.draft) return false;
    if (builder.autosaveTimer) {
      clearTimeout(builder.autosaveTimer);
      builder.autosaveTimer = null;
    }
    if (options.collectVisible !== false && saveStoryBuilderVisibleFields() === false) {
      setStatus("Story template has invalid visible fields");
      if (renderAfter) renderStoryBuilder();
      return false;
    }
    if (options.finalizeStructure === true) storyBuilderFinalizeObjectiveStructure(builder.draft);
    storyBuilderApplyDerivedObjectiveInitialState(builder.draft);
    const validation = validateStoryDefinition(builder.draft);
    const builderChecks = storyBuilderValidationChecks(builder.draft, validation);
    const failedBuilderChecks = builderChecks.filter(check => !check.ok);
    if (failedBuilderChecks.length || !validation.ok) {
      const previouslyInvalid = builder.validationHadErrors === true;
      builder.validationHadErrors = true;
      builder.status = failedBuilderChecks[0]?.label || validationErrorsText(validation);
      setStatus("Story template is invalid");
      if (renderAfter) renderStoryBuilder();
      if (options.validationNoticeMode !== "transition" || !previouslyInvalid) showNotice("Story Builder Save Failed", failedBuilderChecks.length ? failedBuilderChecks.map(check => check.label).join("\n") : validationErrorsText(validation));
      return false;
    }
    builder.validationHadErrors = false;
    const validatedTemplate = validatedStoryTemplateRecord(builder.draft, validation);
    const previousRecord = storyTemplateById(validatedTemplate.id);
    try {
      let compileError = null;
      const compiled = await app.work.enqueueOrdered(`story-builder:${builder.templateId}`, `compile story builder ${builder.templateId}`, async () => {
        try {
          await compileStoryTemplateValidationArtifact(validatedTemplate, {
            onProgress: message => {
              builder.status = String(message || "Compiling story definition");
              setStatus(builder.status);
            }
          });
          const index = (app.storyTemplates || []).findIndex(template => String(template.id) === String(builder.templateId));
          if (options.recordHistory !== false && previousRecord) storyBuilderRememberPreviousDraft(previousRecord);
          if (index >= 0) app.storyTemplates[index] = validatedTemplate;else app.storyTemplates.push(validatedTemplate);
          invalidateStoryLibraryVisibleTemplatesCache();
          builder.draft = clone(validatedTemplate);
          builder.dirty = false;
          queuePerRecordLibraryRecordsSave(STORY_TEMPLATE_KEY, [storyTemplateById(validatedTemplate.id) || validatedTemplate], "story builder draft saved");
          return true;
        } catch (error) {
          compileError = error;
          throw error;
        }
      });
      if (compiled !== true) throw compileError || new Error("Story definition compilation failed.");
      builder.status = "Saved";
      setStatus("Story template saved");
      if (renderAfter) renderStoryBuilder();
      return true;
    } catch (error) {
      builder.status = String(error?.message || error);
      setStatus("Story template save failed");
      if (renderAfter) {
        renderStoryBuilder();
        showNotice("Story Builder Save Failed", builder.status);
      }
      return false;
    }
  }
  async function storyBuilderGenerateRewardImage(entry) {
    const builder = app.storyBuilder;
    const reward = entry?.reward || entry?.owner || entry?.asset;
    const imageSlot = entry?.asset || reward?.image || {};
    if (!builder?.draft || !reward) return false;
    const prompt = textSlot(entry?.prompt || imageSlot.prompt || reward.prompt || reward.image_prompt || reward.imagePrompt || reward.positive_prompt || reward.positivePrompt, "");
    if (!prompt) throw new Error("Story image asset requires a prompt.");
    const mode = "";
    const safePrompt = sanitizeFamilyFriendlyImagePrompt(prompt, {});
    const negativePrompt = joinPromptParts([textSlot(imageSlot.negative_prompt || imageSlot.negativePrompt || reward.negative_prompt || reward.negativePrompt, ""), buildImageSafetyNegativePrompt()]);
    const seed = exactProfileImageSeed(imageSlot.seed ?? reward.seed ?? 0, "story builder reward image seed");
    const model = selectedImageModel(imageSlot.model || reward.model || builder.draft.default_image_model || app.settings.imageModel);
    builder.status = `Generating ${entry.title}...`;
    const html = await generateImageHtml(safePrompt, negativePrompt, seed, model, {
      label: "story builder reward image",
      promptType: "story builder objective reward image",
      requirePlugin: true
    });
    const url = imageSrcFromHtml(html) || extractImageSrc(html);
    if (!url) throw new Error("Story reward image generation returned no image.");
    const savedImage = {
      id: textSlot(imageSlot.id || reward.id, ""),
      title: textSlot(imageSlot.title || reward.title, ""),
      prompt: safePrompt,
      negative_prompt: negativePrompt,
      seed,
      model,
      source: "generated",
      url,
      favorite: imageSlot.favorite === true
    };
    if (entry?.kind === "authored-asset" && entry.asset === entry.owner) Object.assign(entry.asset, savedImage);else reward.image = savedImage;
    builder.dirty = true;
    builder.status = `${entry.title} generated`;
    return await saveStoryBuilderDraft(false, {
      collectVisible: false
    });
  }
  async function exportStoryBuilderDraft() {
    saveStoryBuilderVisibleFields();
    if (!(await saveStoryBuilderDraft(false))) return;
    exportStoryTemplate(app.storyBuilder?.templateId);
  }
  async function storyBuilderAddFutureCharacter() {
    const builder = app.storyBuilder;
    if (!builder) return;
    const name = await showPrompt("Add Future Character", "Future character name?", "", {
      rows: 2,
      submitText: "Add"
    });
    if (!name) return;
    builder.draft.state.future_cast ||= {
      enabled: true,
      items: {}
    };
    builder.draft.state.future_cast.items ||= {};
    const id = objectiveIdFromTitle(name, `future-${Date.now()}`);
    builder.draft.state.future_cast.items[id] = {
      id,
      name,
      status: "locked",
      introduce_as: "npc",
      location_hint: "",
      scene_presence: "nearby",
      greeting: "",
      on_unlock: {
        image: {
          id: `${id}-unlock-image`,
          title: `${name} introduction`,
          prompt: `${name}, introduction scene`,
          favorite: false
        }
      },
      full_character: addImmutableDefinitionFields(blankCharacterTemplate(name), name),
      profile_images: [],
      images: []
    };
    builder.dirty = true;
    saveStoryBuilderDraft(false);
    renderStoryBuilder();
  }
  async function storyBuilderGenerateFutureCharacter() {
    const builder = app.storyBuilder;
    if (!builder) return;
    const name = await showPrompt("Generate Future Character", "Character name or concept?", "", {
      rows: 3,
      submitText: "Generate"
    });
    if (!name) return;
    builder.status = `Waiting for AI: generating ${name}...`;
    renderStoryBuilder();
    const instruction = `Create one future EmberAdventures character for a story template.
Return ONLY valid JSON:
{
  "id": "slug",
  "entry": {
    "future_cast entry": "..."
  }
}

The entry must include: id, name, status="locked", introduce_as="npc", location_hint, scene_presence="nearby", note, optional greeting string, on_unlock with image {id,title,prompt,favorite=false}, full_character matching the immutable character definition shape below, profile_images=[], images=[].
Do not invent database ids or live public-library references. Use the current story-template method where this future_cast entry embeds the full character definition.
For full_character, default_seed must be 0, image_prompt_config.seed must be 0, default_profile_image must use empty/default values, and voice.preferred_voice_name should be blank unless the exact full Microsoft voice name is known.

Character concept:
${name}

Immutable character definition shape:
${prettyJson(characterDefinitionTemplateForAiPrompt(name))}

Rules:
- ${generatedBodyDescriptionRuleText("full_character.appearance.body_description")}

Current template summary:
${compactJson({
      title: builder.draft.title,
      description: builder.draft.description,
      story_source: builder.draft.state?.meta?.story_source,
      objectives: builder.draft.state?.objectives?.items?.map(o => o.title).slice(0, 20)
    })}`;
    try {
      let streamed = "";
      const raw = await aiText(instruction, {
        startWith: "{",
        hideStartWith: false,
        label: "story builder future character",
        onStream: text => {
          streamed = text;
          builder.aiOutput = streamed;
          builder.status = `Receiving AI character JSON: ${streamed.length.toLocaleString()} chars`;
          const status = document.querySelector(".story-builder-status");
          if (status) status.textContent = builder.status;
        }
      });
      const data = parseJsonObject(raw);
      if (!data?.entry) throw new Error("No entry returned");
      const id = data.id || data.entry.id || objectiveIdFromTitle(data.entry.name || name, `future-${Date.now()}`);
      builder.draft.state.future_cast ||= {
        enabled: true,
        items: {}
      };
      builder.draft.state.future_cast.items ||= {};
      if (data.entry?.full_character) data.entry.full_character = materializeCharacterForRuntime(data.entry.full_character, data.entry.name || name, {
        clampGeneratedChest: true,
        allowMetadata: false
      });
      if (data.entry?.full_character) data.entry.full_character.creation_tool = "Perchance AI";
      builder.draft.state.future_cast.items[id] = data.entry;
      builder.status = `Generated ${data.entry.name || name}`;
      builder.dirty = true;
      saveStoryBuilderDraft(false);
    } catch (err) {
      builder.status = `AI character generation failed: ${err.message || err}`;
    }
    renderStoryBuilder();
  }
  async function storyBuilderDeleteFutureCharacter(id) {
    const builder = app.storyBuilder;
    if (!builder?.draft?.state?.future_cast?.items) return;
    if (!(await showConfirm("Delete Future Character", `Delete ${builder.draft.state.future_cast.items[id]?.name || id}? Objectives and rewards that reference this character will need repair. You can undo this change.`, {
      confirmText: "Delete",
      danger: true
    }))) return false;
    delete builder.draft.state.future_cast.items[id];
    builder.dirty = true;
    const saved = await saveStoryBuilderDraft(false);
    renderStoryBuilder();
    return saved;
  }
  async function storyBuilderGenerateUnlockImage(id) {
    const builder = app.storyBuilder;
    if (!builder?.draft?.state) return;
    saveStoryBuilderVisibleFields();
    const entry = builder.draft.state.future_cast?.items?.[id];
    if (!entry) return;
    const prompt = entry.on_unlock?.image?.prompt || entry.images?.[0]?.prompt || `${entry.name || id}, character introduction scene, fantasy RPG`;
    builder.status = `Generating unlock image for ${entry.name || id}...`;
    renderStoryBuilder();
    try {
      const mode = "";
      const safePrompt = sanitizeFamilyFriendlyImagePrompt(prompt, {});
      const html = await generateImageHtml(safePrompt, "", exactProfileImageSeed(entry.on_unlock?.image?.seed, "story builder unlock image seed"), app.settings.imageModel, {
        label: "story builder unlock image",
        promptType: "story builder unlock image",
        promptEditorReplay: {
          storyBuilderImageKind: "unlock",
          futureId: id
        }
      });
      entry.on_unlock ||= {};
      entry.on_unlock.image = {
        ...(entry.on_unlock.image || {}),
        id: entry.on_unlock.image?.id || `${id}-unlock-image`,
        title: entry.on_unlock.image?.title || `${entry.name || id} introduction`,
        prompt: safePrompt,
        html,
        favorite: entry.on_unlock.image?.favorite === true
      };
      entry.images ||= [];
      if (!entry.images.some(image => image.id === entry.on_unlock.image.id)) entry.images.unshift(clone(entry.on_unlock.image));
      builder.status = `Unlock image generated for ${entry.name || id}`;
      builder.dirty = true;
      saveStoryBuilderDraft(false);
    } catch (err) {
      builder.status = `Unlock image failed: ${err.message || err}`;
    }
    renderStoryBuilder();
  }
  async function storyBuilderGenerateTitleCardImage() {
    const builder = app.storyBuilder;
    if (!builder?.draft) return;
    saveStoryBuilderVisibleFields();
    const draft = builder.draft;
    const slot = createStoryTitleCardImageSlot(draft.title_card_image, draft.state, draft);
    builder.status = "Generating story title card...";
    builder.titleCardLiveHtml = "";
    renderStoryBuilder();
    let iframeStatusInterval = null;
    let generated = false;
    try {
      const seed = exactProfileImageSeed(slot.seed, "story builder title image seed");
      const model = selectedImageModel(slot.model || app.settings.imageModel);
      const storyImageMode = "";
      log("Story Builder title-card generation started", `${draft.title || "Story Builder draft"}\nMode: ${storyImageMode}\nSeed: ${String(seed)}\nModel: ${model}`, {
        type: "image"
      });
      const finalPrompt = storyTitleCardPromptWithRules(slot.prompt, draft.state, draft);
      const safePrompt = sanitizeFamilyFriendlyImagePrompt(finalPrompt, {});
      const negativePrompt = buildStoryTitleCardNegativePrompt();
      const html = await generateImageHtml(safePrompt, negativePrompt, seed, model, {
        label: "story builder title card",
        promptType: "story builder title card image",
        promptEditorReplay: {
          storyBuilderImageKind: "title-card"
        },
        resolution: STORY_TITLE_CARD_IMAGE_RESOLUTION,
        requirePlugin: true,
        onIframe: (iframeHtml, iframeEl = null) => {
          const updatePendingStatus = () => {
            const statusText = safeProfileImageIframeStatusText(iframeEl);
            builder.titleCardLiveHtml = profileImagePendingInfoHtml(iframeHtml, "Perchance image generation", statusText || "Generating story title card");
            renderStoryBuilder();
            scheduleProfileImageLoadingAutosize(document);
          };
          updatePendingStatus();
          if (iframeEl && !iframeStatusInterval) {
            iframeStatusInterval = setInterval(updatePendingStatus, 900);
          }
        },
        ensureIframeHost: true
      });
      const url = imageSrcFromHtml(html) || extractImageSrc(html);
      if (!url) throw new Error("Story title-card generation returned no usable image.");
      draft.title_card_image = {
        ...slot,
        url,
        seed,
        model,
        favorite: slot.favorite === true
      };
      builder.titleCardLiveHtml = "";
      builder.status = "Story title card generated";
      builder.dirty = true;
      if (!(await saveStoryBuilderDraft(false, {
        collectVisible: false
      }))) throw new Error(builder.status || "Story title card could not be saved.");
      generated = true;
    } catch (err) {
      builder.titleCardLiveHtml = "";
      builder.status = `Story title card failed: ${err.message || err}`;
      log("Story Builder title-card generation failed", `${draft.title || "Story Builder draft"}\n${err.message || String(err)}`, {
        type: "image",
        level: "error"
      });
    } finally {
      if (iframeStatusInterval) clearInterval(iframeStatusInterval);
    }
    renderStoryBuilder();
    return generated;
  }
  async function storyBuilderGenerateDefaultProfileImage(kind, key, requestedGender = "", options = {}) {
    const builder = app.storyBuilder;
    if (!builder?.draft) return;
    saveStoryBuilderVisibleFields();
    const target = storyBuilderCharacterDefinitionTarget(kind, key);
    if (!target?.character) return;
    let character = addImmutableDefinitionFields(clone(target.character), target.character.name || target.label);
    const targetGender = characterPresentationUsesMaleFields(requestedGender) ? "male" : requestedGender ? "female" : characterPresentationUsesMaleFields(character.gender) ? "male" : "female";
    const malePresentation = targetGender === "male";
    const promptCharacter = characterLibraryPresentation(character, key || character.name || target.label, malePresentation ? "male" : "female");
    const name = textSlot(promptCharacter.name || character.name, target.label);
    builder.status = `Generating ${malePresentation ? "male" : "female"} profile image for ${name}...`;
    renderStoryBuilder();
    let generated = false;
    try {
      const model = selectedImageModel(app.settings.imageModel);
      const seed = Math.floor(Math.random() * 999999999);
      const rawPrompt = buildProfileImagePrompt(name, promptCharacter, {
        genres: builder.draft.genres || builder.draft.state?.meta?.genres || builder.draft.state?.meta?.genre || []
      });
      const rawNegativePrompt = buildImageSafetyNegativePrompt();
      const safeRawPrompt = sanitizeFamilyFriendlyImagePrompt(rawPrompt, {
        entity: promptCharacter
      });
      const styled = applyImageArtStyle(safeRawPrompt, rawNegativePrompt, model);
      const html = await generateImageHtml(styled.prompt, styled.negativePrompt, seed, model, {
        label: "story builder default profile image",
        promptType: "story builder default profile image",
        promptEditorReplay: {
          storyBuilderImageKind: "default-profile",
          characterName: name,
          targetKind: kind,
          targetKey: key
        }
      });
      const url = imageSrcFromHtml(html);
      if (!url) throw new Error("Profile image returned no usable image URL.");
      const slot = profileImageSlotFromExactInput({
        ...emptyProfileImageSlot(malePresentation),
        url,
        source: "generated-in-story-builder",
        seed,
        prompt: styled.prompt,
        negative_prompt: styled.negativePrompt,
        male: malePresentation,
        note: "Generated in the EmberAdventures Story Builder as this character's default profile image."
      });
      character.profile_image_presentations = createProfileImagePresentations(character.profile_image_presentations);
      character.profile_image_presentations[malePresentation ? "male" : "non_male"] = clone(slot);
      character.default_profile_image = clone(slot);
      target.save(character);
      if (kind === "npc") {
        const [locationId, npcKey] = String(key || "").split("||");
        const npc = builder.draft.state.npc_directory?.locations?.[locationId]?.characters?.[npcKey] || builder.draft.state.npc_directory?.locations?.[locationId]?.characters?.[name];
        if (npc) {
          npc.default_profile_image = clone(character.default_profile_image);
          npc.profile_image_presentations = clone(character.profile_image_presentations);
        }
      }
      builder.status = `${malePresentation ? "Male" : "Female"} profile image generated for ${name}`;
      builder.dirty = true;
      if (!(await saveStoryBuilderDraft(false, {
        collectVisible: false
      }))) throw new Error(builder.status || "Profile image could not be saved.");
      generated = true;
    } catch (err) {
      builder.status = `Default profile image failed: ${err.message || err}`;
    }
    renderStoryBuilder();
    return generated;
  }
  function storyBuilderObjectiveTemplate(kind = "main") {
    const builder = app.storyBuilder;
    const list = builder?.draft?.state?.objectives?.items || [];
    const id = generatedPersistentId("draft-objective");
    return {
      id,
      title: "",
      type: kind === "side" ? "side" : "story",
      kind: kind === "side" ? "side" : "main",
      status: list.length ? "hidden" : "active",
      summary: "",
      while_active_guidance: "",
      requires: [],
      rewards: [],
      selectable: kind === "side",
      available_now: !list.length,
      completion_control: "player",
      completion_criteria: "",
      completion_requirements: []
    };
  }
  async function storyBuilderAddNextObjective(kind = "") {
    const builder = app.storyBuilder;
    if (!builder?.draft) return false;
    if (saveStoryBuilderVisibleFields() === false) return false;
    const list = storyBuilderObjectiveList(builder.draft);
    const source = storyBuilderObjectiveById(builder.selectedObjectiveId, builder.draft);
    const objective = storyBuilderObjectiveTemplate(kind || (source && objectiveIsSide(source) ? "side" : "main"));
    list.push(objective);
    if (source) {
      if (objectiveRouteControl(source) === "ai") {
        const routes = objectiveOutcomeRoutes(source);
        routes.push({
          id: uniqueObjectiveId("new-outcome", new Set(routes.map(route => String(route.id || ""))), "outcome"),
          criteria: "",
          requirements: [],
          rewards: [],
          next_objective_id: objective.id,
          target_input_group_id: generatedPersistentId("input-group"),
          fallback: !routes.some(route => route.fallback === true)
        });
        source.outcome_routes = routes;
        delete source.next_objectives;
      } else {
        const next = objectiveNextOptions(source);
        if (!next.some(item => String(item.objective_id || "") === String(objective.id))) next.push({
          id: generatedPersistentId("output"),
          objective_id: objective.id,
          requirements: [],
          rewards: [],
          completion_instruction: "",
          target_input_group_id: generatedPersistentId("input-group")
        });
        source.next_objectives = next;
      }
    }
    builder.pendingGraphLinkSourceId = "";
    builder.selectedObjectiveId = objective.id;
    builder.mobileInspectorOpen = true;
    builder.dirty = true;
    builder.validationHadErrors = storyBuilderValidationChecks(builder.draft).some(check => !check.ok) || !validateStoryDefinition(builder.draft).ok;
    builder.status = "Node added; finish its route or ending before saving";
    renderStoryBuilder();
    return objective.id;
  }
  function storyBuilderStartLinkObjective() {
    const builder = app.storyBuilder;
    const selectedId = String(builder?.selectedObjectiveId || "");
    if (!builder || !selectedId) return false;
    if (String(builder.pendingGraphLinkSourceId || "") === selectedId) {
      builder.pendingGraphLinkSourceId = "";
      builder.status = "Link canceled";
      renderStoryBuilder();
      return false;
    }
    const source = storyBuilderObjectiveById(selectedId, builder.draft);
    if (!source) return false;
    if (objectiveRouteControl(source) === "ai") {
      showNotice("Use Outcome Routes", "This node uses AI-adjudicated outcomes. Choose each destination in its outcome-route editor.");
      return false;
    }
    builder.pendingGraphLinkSourceId = selectedId;
    builder.mobileInspectorOpen = false;
    builder.status = "Choose the objective that should come next";
    renderStoryBuilder();
    return true;
  }
  function storyBuilderAddObjective(kind = "main") {
    const builder = app.storyBuilder;
    if (!builder) return;
    saveStoryBuilderVisibleFields();
    builder.draft.state.objectives ||= {
      items: []
    };
    builder.draft.state.objectives.items ||= [];
    const objective = storyBuilderObjectiveTemplate(kind);
    builder.draft.state.objectives.items.push(objective);
    builder.selectedObjectiveId = objective.id;
    builder.dirty = true;
    saveStoryBuilderDraft(false, {
      collectVisible: false
    });
    renderStoryBuilder();
  }
  async function storyBuilderAddChoiceObjective() {
    const builder = app.storyBuilder;
    if (!builder) return false;
    saveStoryBuilderVisibleFields();
    builder.draft.state.objectives ||= {
      items: []
    };
    builder.draft.state.objectives.items ||= [];
    const objective = storyBuilderObjectiveTemplate("main");
    objective.title = "New Choice";
    objective.id = uniqueObjectiveId(objective.title, new Set(builder.draft.state.objectives.items.map(item => String(item.id || ""))), "choice-objective");
    objective.summary = "Choose one path.";
    objective.completion_control = "choice";
    delete objective.completion_criteria;
    objective.completion_message = "The choice is complete.";
    objective.choices = [{
      id: "option-a",
      title: "Option A",
      summary: "",
      rewards: [{
        type: "add_story_rule",
        id: `${objective.id}-option-a`,
        text: "The player selected Option A."
      }]
    }, {
      id: "option-b",
      title: "Option B",
      summary: "",
      rewards: [{
        type: "add_story_rule",
        id: `${objective.id}-option-b`,
        text: "The player selected Option B."
      }]
    }];
    builder.draft.state.objectives.items.push(objective);
    builder.selectedObjectiveId = objective.id;
    builder.dirty = true;
    builder.validationHadErrors = true;
    builder.status = "Choice objective added; connect and complete every output before saving";
    renderStoryBuilder();
    return true;
  }
  async function storyBuilderMoveObjective(index, delta) {
    saveStoryBuilderVisibleFields();
    const list = app.storyBuilder?.draft?.state?.objectives?.items || [];
    const next = index + delta;
    if (next < 0 || next >= list.length) return false;
    [list[index], list[next]] = [list[next], list[index]];
    app.storyBuilder.dirty = true;
    const saved = await saveStoryBuilderDraft(false, {
      collectVisible: false
    });
    renderStoryBuilder();
    return saved;
  }
  async function storyBuilderDeleteObjective(index) {
    saveStoryBuilderVisibleFields();
    const list = app.storyBuilder?.draft?.state?.objectives?.items || [];
    const candidate = list[index];
    if (!candidate) return false;
    const candidateId = String(candidate.id || "");
    const dependentCount = list.filter((objective, objectiveIndex) => objectiveIndex !== index && (objectiveRequiredIds(objective).includes(candidateId) || objectiveNextOptions(objective).some(route => String(route.objective_id || "") === candidateId) || objectiveOutcomeRoutes(objective).some(route => String(route.next_objective_id || "") === candidateId))).length;
    if (!(await showConfirm("Delete Objective", `Delete "${candidate.title || candidateId || "Untitled Objective"}"? ${dependentCount} other objective${dependentCount === 1 ? "" : "s"} currently reference it. Direct prerequisites will be reconnected where possible.`, {
      confirmText: "Delete",
      danger: true
    }))) return false;
    const [removed] = list.splice(index, 1);
    const removedId = String(removed?.id || "");
    if (removedId) {
      const inheritedRequiredIds = objectiveRequiredIds(removed);
      const tree = storyBuilderTreeEditorData(app.storyBuilder.draft);
      delete tree.positions[removedId];
      for (const objective of list) {
        const requiredIds = objectiveRequiredIds(objective);
        objective.requires = requiredIds.includes(removedId) ? [...new Set([...requiredIds.filter(id => id !== removedId), ...inheritedRequiredIds])] : requiredIds;
        const next = objectiveNextOptions(objective).filter(item => String(item.objective_id) !== removedId);
        if (next.length) objective.next_objectives = next;else delete objective.next_objectives;
      }
    }
    if (app.storyBuilder.selectedObjectiveId === removedId) app.storyBuilder.selectedObjectiveId = list[0]?.id || "";
    app.storyBuilder.dirty = true;
    const saved = await saveStoryBuilderDraft(false, {
      collectVisible: false
    });
    renderStoryBuilder();
    return saved;
  }
  function storyBuilderDuplicateObjective(id, event) {
    if (event) event.stopPropagation();
    const builder = app.storyBuilder;
    const list = storyBuilderObjectiveList(builder?.draft);
    const source = storyBuilderObjectiveById(id, builder?.draft);
    if (!builder || !source) return;
    saveStoryBuilderVisibleFields();
    const copy = clone(source);
    copy.id = uniqueObjectiveId(`${source.title || source.id} Copy`, new Set(list.map(item => String(item.id || ""))), "objective-copy");
    copy.title = `${source.title || "Objective"} Copy`;
    copy.status = "hidden";
    delete copy.requires;
    delete copy.required_objectives;
    delete copy.prerequisites;
    delete copy.auto_completed_from_prereqs;
    list.push(copy);
    let sourceMode = storyBuilderObjectiveOutputMode(source, builder.draft);
    if (sourceMode === "none") sourceMode = "one";
    const sourceRows = storyBuilderCanonicalizeOutputStorage(source, sourceMode);
    const row = storyBuilderNewOutputRow(source, sourceRows.length);
    row.next_objective_id = copy.id;
    row.objective_id = copy.id;
    sourceRows.push(row);
    storyBuilderObjectiveOutputModeStore(builder.draft)[source.id] = sourceRows.length > 1 ? "multiple" : "one";
    builder.selectedObjectiveId = copy.id;
    builder.dirty = true;
    saveStoryBuilderDraft(false, {
      collectVisible: false
    });
    renderStoryBuilder();
  }
  async function storyBuilderSelectObjective(id, event) {
    if (event?.target?.dataset?.treePort) return;
    const builder = app.storyBuilder;
    if (!builder) return;
    const targetId = String(id || "");
    const sourceId = String(builder.pendingGraphLinkSourceId || "");
    if (sourceId) {
      if (sourceId === targetId) {
        builder.pendingGraphLinkSourceId = "";
        builder.status = "Link canceled";
        renderStoryBuilder();
        return false;
      }
      builder.pendingGraphLinkSourceId = "";
      builder.mobileInspectorOpen = false;
      return storyBuilderConnectTreePorts({
        objectiveId: sourceId,
        port: "output"
      }, {
        objectiveId: targetId,
        port: "input"
      });
    }
    builder.selectedObjectiveId = targetId;
    if (window.matchMedia?.("(max-width: 839px)")?.matches) builder.mobileInspectorOpen = true;
    renderStoryBuilder();
    return true;
  }
  function storyBuilderAutoLayout() {
    const builder = app.storyBuilder;
    if (!builder?.draft) return;
    storyBuilderEnsureTreeLayout(builder.draft);
    renderStoryBuilder();
  }
  function storyBuilderCharacterDefinitionValue(character = {}) {
    const full = {
      ...characterDefinitionTemplateForAiPrompt(character?.name || "Character"),
      ...addImmutableDefinitionFields(clone(character || {}), character?.name || "Character")
    };
    full.voice = clone(character?.voice || {
      gender_bucket: characterPresentationUsesMaleFields(character?.gender) ? "male" : "non_male",
      preferred_voice_name: ""
    });
    removeRuntimeClothingFromCharacterDefinition(full);
    delete full.relationship_to_player;
    delete full.trust;
    delete full.attraction;
    delete full.affection;
    delete full.state_of_mind;
    delete full.physical_state;
    delete full.pose;
    delete full.held_items;
    delete full.inventory;
    delete full.known_facts;
    delete full.power;
    return {
      character_definition: completeFriendlyStateEditorSchema(full)
    };
  }
  function storyBuilderQueueAutosave() {
    const builder = app.storyBuilder;
    if (!builder?.draft) return;
    if (builder.autosaveTimer) clearTimeout(builder.autosaveTimer);
    builder.autosaveTimer = setTimeout(() => {
      if (!app.storyBuilder || app.storyBuilder !== builder) return;
      builder.autosaveTimer = null;
      void saveStoryBuilderDraft(false, {
        validationNoticeMode: "transition"
      });
    }, 350);
  }
  function storyBuilderRememberPreviousDraft(previous = null) {
    const builder = app.storyBuilder;
    if (!builder || !previous) return;
    const signature = stableJsonString(previous);
    const last = builder.undoStack?.[builder.undoStack.length - 1];
    if (last && stableJsonString(last) === signature) return;
    builder.undoStack ||= [];
    builder.undoStack.push(clone(previous));
    if (builder.undoStack.length > 50) builder.undoStack.shift();
    builder.redoStack = [];
  }
  async function storyBuilderUndo() {
    const builder = app.storyBuilder;
    if (!builder?.undoStack?.length) return false;
    builder.redoStack ||= [];
    builder.redoStack.push(clone(builder.draft));
    builder.draft = builder.undoStack.pop();
    builder.dirty = true;
    renderStoryBuilder();
    return saveStoryBuilderDraft(false, {
      collectVisible: false,
      recordHistory: false
    });
  }
  async function storyBuilderRedo() {
    const builder = app.storyBuilder;
    if (!builder?.redoStack?.length) return false;
    builder.undoStack ||= [];
    builder.undoStack.push(clone(builder.draft));
    builder.draft = builder.redoStack.pop();
    builder.dirty = true;
    renderStoryBuilder();
    return saveStoryBuilderDraft(false, {
      collectVisible: false,
      recordHistory: false
    });
  }
  function storyBuilderApplyTreeViewportTransform() {
    const builder = app.storyBuilder;
    const viewport = $("storyBuilderGraphViewport");
    const canvas = $("storyBuilderTreeCanvas");
    if (!builder?.draft || !viewport || !canvas) return false;
    const tree = storyBuilderEnsureTreeLayout(builder.draft);
    const x = Number(tree.viewport.x) || 0;
    const y = Number(tree.viewport.y) || 0;
    const bounds = storyBuilderTreeZoomBounds(viewport, canvas);
    const zoom = clamp(Number(tree.viewport.zoom) || 1, bounds.minimum, bounds.maximum);
    tree.viewport.zoom = zoom;
    canvas.style.setProperty("--graph-zoom", String(zoom));
    canvas.style.transform = `translate(${x}px, ${y}px) scale(${zoom})`;
    viewport.style.setProperty("--graph-pan-x", `${x}px`);
    viewport.style.setProperty("--graph-pan-y", `${y}px`);
    viewport.style.setProperty("--graph-grid-size", `${32 * zoom}px`);
    return true;
  }
  function storyBuilderSetTreeViewport(x, y, zoom) {
    const builder = app.storyBuilder;
    if (!builder?.draft) return false;
    const tree = storyBuilderEnsureTreeLayout(builder.draft);
    const bounds = storyBuilderTreeZoomBounds();
    tree.viewport.x = Number.isFinite(Number(x)) ? Number(x) : tree.viewport.x;
    tree.viewport.y = Number.isFinite(Number(y)) ? Number(y) : tree.viewport.y;
    tree.viewport.zoom = clamp(Number.isFinite(Number(zoom)) ? Number(zoom) : tree.viewport.zoom, bounds.minimum, bounds.maximum);
    return storyBuilderApplyTreeViewportTransform();
  }
  function storyBuilderTreeZoomBounds(viewport = $("storyBuilderGraphViewport"), canvas = $("storyBuilderTreeCanvas")) {
    const maximum = STORY_BUILDER_TREE_ZOOM_MAX;
    if (!viewport || !canvas) return {
      minimum: STORY_BUILDER_TREE_ZOOM_MIN,
      maximum
    };
    const graphWidth = Math.max(1, Number(canvas.dataset.graphWidth) || 1);
    const graphHeight = Math.max(1, Number(canvas.dataset.graphHeight) || 1);
    const padding = 36;
    const availableWidth = Math.max(1, viewport.clientWidth - padding * 2);
    const availableHeight = Math.max(1, viewport.clientHeight - padding * 2);
    return {
      minimum: clamp(Math.min(availableWidth / graphWidth, availableHeight / graphHeight), STORY_BUILDER_TREE_ZOOM_MIN, 1),
      maximum
    };
  }
  function storyBuilderZoomTreeAtViewportPoint(nextZoom, pointX, pointY) {
    const builder = app.storyBuilder;
    if (!builder?.draft) return false;
    const tree = storyBuilderEnsureTreeLayout(builder.draft);
    const bounds = storyBuilderTreeZoomBounds();
    const previousZoom = clamp(Number(tree.viewport.zoom) || 1, bounds.minimum, bounds.maximum);
    const zoom = clamp(Number(nextZoom) || previousZoom, bounds.minimum, bounds.maximum);
    if (Math.abs(zoom - previousZoom) < 0.0001) return false;
    const x = Number(tree.viewport.x) || 0;
    const y = Number(tree.viewport.y) || 0;
    const anchorX = Number(pointX) || 0;
    const anchorY = Number(pointY) || 0;
    const graphX = (anchorX - x) / previousZoom;
    const graphY = (anchorY - y) / previousZoom;
    return storyBuilderSetTreeViewport(anchorX - graphX * zoom, anchorY - graphY * zoom, zoom);
  }
  function storyBuilderObjectiveCollectionsValue(objective = {}) {
    const editorType = storyBuilderObjectiveEditorType(objective);
    const controlMode = storyBuilderObjectiveControlMode(objective);
    const value = {};
    if (editorType === "dialogue") value.dialogue_lines = clone(objective.dialogue_lines || []);
    if (editorType === "branch" && controlMode === "player") {
      const exactText = objectiveChoiceResponseMode(objective) === "exact_text";
      value.choices = clone(objective.choices || objective.choice_options || []).map(choice => {
        if (!isPlainObject(choice)) return choice;
        delete choice.playerText;
        if (exactText) choice.player_text = textSlot(choice.player_text, choice.title || "");else delete choice.player_text;
        return choice;
      });
    }
    if (editorType === "branch" && controlMode === "ai") value.outcome_routes = clone(objectiveOutcomeRoutes(objective));
    value.rewards = clone(objective.rewards || []);
    if (!(editorType === "branch" && controlMode === "ai")) value.next_objectives = clone(objectiveNextOptions(objective));
    if (!["branch", "transition"].includes(editorType)) {
      value.travel_location_id = textSlot(objective.travel_location_id, "");
      value.travel_location_name = textSlot(objective.travel_location_name, "");
    }
    value.notes = clone(objective.notes || []);
    return value;
  }
  function storyBuilderApplyObjectiveCollections(objective, value = {}) {
    if (!objective || !isPlainObject(value)) return false;
    for (const key of ["dialogue_lines", "notes", "next_objectives", "choices", "rewards", "outcome_routes", "travel_location_id", "travel_location_name", "evaluate_ai_on_activation"]) {
      if (Object.prototype.hasOwnProperty.call(value, key)) objective[key] = clone(value[key]);
    }
    if (Array.isArray(objective.dialogue_lines) && !objective.dialogue_lines.length) delete objective.dialogue_lines;
    if (Array.isArray(objective.next_objectives) && !objective.next_objectives.length) delete objective.next_objectives;
    if (Array.isArray(objective.choices) && !objective.choices.length) delete objective.choices;
    if (!Array.isArray(objective.rewards)) objective.rewards = [];
    if (Array.isArray(objective.outcome_routes) && !objective.outcome_routes.length) delete objective.outcome_routes;
    if (objective.type === "dialogue" && !objective.dialogue_lines) objective.dialogue_lines = [];
    return true;
  }
  function renderStoryBuilderObjectiveCollectionsEditor(objective = {}) {
    return `
                <section class="story-builder-section">
                    <div class="story-builder-section-header">
                        <strong>Dialogue, Routes, Choices, And Rewards</strong>
                        <span class="hint">Add and remove structured entries. Every supported reward type can be selected inside a reward entry.</span>
                    </div>
                    <div id="storyBuilderObjectiveCollectionsEditor" class="state-editor-tree">
                        ${buildFriendlyStateEditor(storyBuilderObjectiveCollectionsValue(objective), [], 0, {
      profile: "story_builder"
    })}
                    </div>
                </section>`;
  }
  function storyBuilderFitTree() {
    const builder = app.storyBuilder;
    if (!builder?.draft) return;
    const viewport = $("storyBuilderGraphViewport");
    const canvas = $("storyBuilderTreeCanvas");
    if (!viewport || !canvas) return;
    const graphWidth = Number(canvas.dataset.graphWidth) || buildStoryBuilderObjectiveGraphLayout(builder.draft).width;
    const graphHeight = Number(canvas.dataset.graphHeight) || buildStoryBuilderObjectiveGraphLayout(builder.draft).height;
    const zoom = storyBuilderTreeZoomBounds(viewport, canvas).minimum;
    storyBuilderSetTreeViewport((viewport.clientWidth - graphWidth * zoom) / 2, (viewport.clientHeight - graphHeight * zoom) / 2, zoom);
  }
  function storyBuilderZoomTree(delta) {
    const builder = app.storyBuilder;
    if (!builder?.draft) return;
    const tree = storyBuilderTreeEditorData(builder.draft);
    const viewport = $("storyBuilderGraphViewport");
    const pointX = viewport ? viewport.clientWidth / 2 : 0;
    const pointY = viewport ? viewport.clientHeight / 2 : 0;
    storyBuilderZoomTreeAtViewportPoint((Number(tree.viewport.zoom) || 1) + Number(delta || 0), pointX, pointY);
  }
  function storyBuilderHandleTreeWheel(event) {
    const viewport = event?.currentTarget instanceof Element ? event.currentTarget : $("storyBuilderGraphViewport");
    const builder = app.storyBuilder;
    if (!event || !viewport || !builder?.draft) return;
    event.preventDefault();
    const tree = storyBuilderEnsureTreeLayout(builder.draft);
    const rect = viewport.getBoundingClientRect();
    const pointX = Number(event.clientX) - rect.left;
    const pointY = Number(event.clientY) - rect.top;
    const deltaScale = event.deltaMode === WheelEvent.DOM_DELTA_LINE ? 16 : event.deltaMode === WheelEvent.DOM_DELTA_PAGE ? Math.max(1, viewport.clientHeight) : 1;
    const deltaPixels = clamp(Number(event.deltaY) * deltaScale, -480, 480);
    const nextZoom = (Number(tree.viewport.zoom) || 1) * Math.exp(-deltaPixels * 0.0012);
    storyBuilderZoomTreeAtViewportPoint(nextZoom, pointX, pointY);
  }
  function storyBuilderStartTreePan(event) {
    const builder = app.storyBuilder;
    const viewport = $("storyBuilderGraphViewport");
    if (!builder?.draft || !viewport || !event?.isPrimary) return;
    const isPrimaryButton = event.button === 0;
    const isMiddleButton = event.button === 1;
    if (!isPrimaryButton && !isMiddleButton) return;
    const interactiveTarget = event.target?.closest?.("button, input, textarea, select, label, [data-tree-port], [data-tree-node-id]");
    if (isPrimaryButton && interactiveTarget) return;
    event.preventDefault();
    const tree = storyBuilderEnsureTreeLayout(builder.draft);
    builder.treePan = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: Number(tree.viewport.x) || 0,
      startY: Number(tree.viewport.y) || 0
    };
    viewport.classList.add("panning");
    if (event.isTrusted && !viewport.hasPointerCapture(event.pointerId)) viewport.setPointerCapture(event.pointerId);
  }
  function storyBuilderMoveTreePan(event) {
    const builder = app.storyBuilder;
    const pan = builder?.treePan;
    if (!pan || pan.pointerId !== event?.pointerId) return;
    event.preventDefault();
    storyBuilderSetTreeViewport(pan.startX + event.clientX - pan.startClientX, pan.startY + event.clientY - pan.startClientY, storyBuilderTreeEditorData(builder.draft).viewport.zoom);
  }
  function storyBuilderEndTreePan(event) {
    const builder = app.storyBuilder;
    const viewport = $("storyBuilderGraphViewport");
    const pan = builder?.treePan;
    if (!pan || pan.pointerId !== event?.pointerId) return;
    if (event.type !== "lostpointercapture" && viewport?.hasPointerCapture(event.pointerId)) viewport.releasePointerCapture(event.pointerId);
    viewport?.classList.remove("panning");
    builder.treePan = null;
  }
  function setStoryBuilderGraphComponent(componentId) {
    if (!app.storyBuilder) return;
    app.storyBuilder.graphComponentId = String(componentId || "0");
    renderStoryBuilder();
  }
  function setStoryBuilderGraphSearch(value) {
    if (!app.storyBuilder) return;
    app.storyBuilder.graphSearch = String(value || "");
    if (app.storyBuilder.graphSearch.trim()) app.storyBuilder.nodeListOpen = true;
    renderStoryBuilder();
  }
  function storyBuilderTreeStartNodeDrag(event) {
    const node = event.target.closest("[data-tree-node-id]");
    const builder = app.storyBuilder;
    if (!node || !builder?.draft) return;
    event.preventDefault();
    event.stopPropagation();
    const id = node.dataset.treeNodeId;
    builder.selectedObjectiveId = id;
    const tree = storyBuilderTreeEditorData(builder.draft);
    const zoom = clamp(Number(tree.viewport?.zoom) || 1, STORY_BUILDER_TREE_ZOOM_MIN, STORY_BUILDER_TREE_ZOOM_MAX);
    const start = {
      x: event.clientX,
      y: event.clientY,
      nodeX: Number(tree.positions[id]?.x) || 0,
      nodeY: Number(tree.positions[id]?.y) || 0
    };
    const move = moveEvent => {
      const dx = (moveEvent.clientX - start.x) / zoom;
      const dy = (moveEvent.clientY - start.y) / zoom;
      tree.positions[id] = {
        x: Math.max(12, Math.round(start.nodeX + dx)),
        y: Math.max(12, Math.round(start.nodeY + dy))
      };
      node.style.left = `${tree.positions[id].x}px`;
      node.style.top = `${tree.positions[id].y}px`;
    };
    const up = () => {
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", up);
      builder.dirty = true;
      saveStoryBuilderDraft(false, {
        collectVisible: false
      });
      renderStoryBuilder();
    };
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", up, {
      once: true
    });
  }
  function storyBuilderTreeStartConnection(event) {
    const port = event.target.closest("[data-tree-port]");
    const builder = app.storyBuilder;
    if (!port || !builder?.draft) return;
    event.preventDefault();
    event.stopPropagation();
    builder.pendingTreeConnection = {
      objectiveId: port.dataset.treeNodeId,
      port: port.dataset.treePort
    };
    port.classList.add("pending");
    const up = upEvent => {
      document.removeEventListener("pointerup", up);
      const endPort = upEvent.target?.closest?.("[data-tree-port]");
      const start = builder.pendingTreeConnection;
      builder.pendingTreeConnection = null;
      port.classList.remove("pending");
      if (!start || !endPort) return;
      storyBuilderConnectTreePorts(start, {
        objectiveId: endPort.dataset.treeNodeId,
        port: endPort.dataset.treePort
      });
    };
    document.addEventListener("pointerup", up, {
      once: true
    });
  }
  async function storyBuilderConnectTreePorts(start, end) {
    const builder = app.storyBuilder;
    const draft = builder?.draft;
    if (!draft || !start?.objectiveId || !end?.objectiveId) return;
    if (String(start.objectiveId) === String(end.objectiveId)) return;
    const source = start.port === "output" && end.port === "input" ? storyBuilderObjectiveById(start.objectiveId, draft) : start.port === "input" && end.port === "output" ? storyBuilderObjectiveById(end.objectiveId, draft) : null;
    const target = start.port === "output" && end.port === "input" ? storyBuilderObjectiveById(end.objectiveId, draft) : start.port === "input" && end.port === "output" ? storyBuilderObjectiveById(start.objectiveId, draft) : null;
    if (!source || !target) return;
    if (start.port === "output" && end.port === "input") {
      if (objectiveRouteControl(source) === "ai") {
        builder.status = "Choose the target on an individual hidden outcome route.";
        renderStoryBuilder();
        return;
      }
      const next = objectiveNextOptions(source);
      if (!next.some(item => String(item.objective_id) === String(target.id))) {
        next.push({
          objective_id: String(target.id),
          requirements: []
        });
        source.next_objectives = next;
      }
    } else {
      const required = new Set(objectiveRequiredIds(target));
      required.add(String(source.id));
      target.requires = [...required];
    }
    builder.selectedObjectiveId = String(target.id || "");
    builder.dirty = true;
    const saved = await saveStoryBuilderDraft(false, {
      collectVisible: false
    });
    renderStoryBuilder();
    return saved;
  }
  function storyBuilderTreeInspectorFieldRequiresRender(field) {
    return ["id", "side_objective", "selectable", "evaluate_ai_on_activation"].includes(String(field?.dataset?.treeObjectiveField || ""));
  }
  function fitStoryBuilderGraphNodeTitle(label) {
    const node = label?.closest?.(".story-builder-graph-node.auto-node");
    if (!label || !node || !label.isConnected) return false;
    const nodeStyle = getComputedStyle(node);
    label.style.removeProperty("font-size");
    const baseFontSize = Number(label.dataset.storyBuilderBaseFontSize) || Number.parseFloat(getComputedStyle(label).fontSize) || 14;
    label.dataset.storyBuilderBaseFontSize = String(baseFontSize);
    const availableWidth = Math.max(1, node.clientWidth - Number.parseFloat(nodeStyle.paddingLeft || "0") - Number.parseFloat(nodeStyle.paddingRight || "0"));
    const availableHeight = Math.max(1, node.clientHeight - Number.parseFloat(nodeStyle.paddingTop || "0") - Number.parseFloat(nodeStyle.paddingBottom || "0"));
    label.style.width = `${availableWidth}px`;
    label.style.maxHeight = `${availableHeight}px`;
    const fits = () => label.scrollWidth <= availableWidth + 0.5 && label.scrollHeight <= availableHeight + 0.5;
    label.style.fontSize = `${baseFontSize}px`;
    if (fits()) return true;
    let lower = 4;
    let upper = baseFontSize;
    let best = lower;
    label.style.fontSize = `${lower}px`;
    if (!fits()) return false;
    for (let pass = 0; pass < 9; pass += 1) {
      const candidate = (lower + upper) / 2;
      label.style.fontSize = `${candidate}px`;
      if (fits()) {
        best = candidate;
        lower = candidate;
      } else {
        upper = candidate;
      }
    }
    label.style.fontSize = `${Math.floor(best * 10) / 10}px`;
    return true;
  }
  function fitStoryBuilderGraphNodeTitles(root = document) {
    root?.querySelectorAll?.(".story-builder-graph-node.auto-node .story-builder-node-dot-label").forEach(fitStoryBuilderGraphNodeTitle);
  }
  function storyBuilderRefreshTreeInspectorFieldDisplay(objective, key) {
    if (key !== "title" || !objective) return;
    const id = String(objective.id || "");
    const title = String(objective.title || objective.id || "Objective");
    document.querySelectorAll("[data-tree-node-id]").forEach(node => {
      if (String(node.dataset.treeNodeId || "") !== id) return;
      const label = node.querySelector(".story-builder-node-dot-label");
      if (label) {
        const suffix = /\s+\(continues\)$/.test(label.textContent) ? " (continues)" : "";
        label.textContent = `${title}${suffix}`;
        fitStoryBuilderGraphNodeTitle(label);
      }
    });
    document.querySelectorAll("[data-story-builder-node-list-id]").forEach(button => {
      if (String(button.dataset.storyBuilderNodeListId || "") === id) button.textContent = title;
    });
  }
  function storyBuilderApplyTreeInspectorField(field, options = {}) {
    const builder = app.storyBuilder;
    const draft = builder?.draft;
    const objective = storyBuilderObjectiveById(builder?.selectedObjectiveId, draft);
    if (!objective || !field) return;
    const oldId = String(objective.id || "");
    const key = String(field.dataset.treeObjectiveField || field.dataset.treeJsonField || "");
    const isCheckbox = String(field.type || "").toLowerCase() === "checkbox";
    const value = isCheckbox ? !!field.checked : field.value;
    try {
      if (field.dataset.treeJsonField) {
        const key = field.dataset.treeJsonField;
        const parsed = JSON.parse(field.value || "[]");
        if (!Array.isArray(parsed)) throw new Error(`${key} must be a JSON array.`);
        objective[key] = parsed;
      } else if (field.dataset.treeObjectiveField === "requires") {
        objective.requires = String(value || "").split(/\n+/).map(item => item.trim()).filter(Boolean);
      } else if (field.dataset.treeObjectiveField === "side_objective") {
        objective.type = value ? "side" : "story";
        delete objective.kind;
        if (value) {
          objective.selectable = true;
        } else if (String(draft.state?.objectives?.active_id || "") === String(objective.id || "")) {
          objective.selectable = false;
        }
      } else if (field.dataset.treeObjectiveField === "id") {
        const nextId = uniqueObjectiveId(String(value || oldId || "objective"), new Set(storyBuilderObjectiveList(draft).filter(item => item !== objective).map(item => String(item.id || ""))), "objective");
        objective.id = nextId;
        storyBuilderRenameObjectiveId(oldId, nextId, draft);
        builder.selectedObjectiveId = nextId;
      } else if (field.dataset.treeObjectiveField === "title") {
        objective.title = String(value || "").trim();
        if (objective.title && /^draft-objective-/i.test(String(objective.id || ""))) {
          const nextId = uniqueObjectiveId(objective.title, new Set(storyBuilderObjectiveList(draft).filter(item => item !== objective).map(item => String(item.id || ""))), objectiveIsSide(objective) ? "side-objective" : "objective");
          objective.id = nextId;
          storyBuilderRenameObjectiveId(oldId, nextId, draft);
          const outputModes = storyBuilderObjectiveOutputModeStore(draft);
          if (Object.hasOwn(outputModes, oldId)) {
            outputModes[nextId] = outputModes[oldId];
            delete outputModes[oldId];
          }
          builder.selectedObjectiveId = nextId;
        }
      } else if (["selectable", "available_now"].includes(field.dataset.treeObjectiveField)) {
        const key = field.dataset.treeObjectiveField;
        if (key === "available_now" && !Object.hasOwn(objective, key) && field.dataset.storyBuilderModified !== "true") return;
        objective[key] = !!value;
      } else {
        objective[field.dataset.treeObjectiveField] = value;
      }
      builder.status = "Tree updated";
    } catch (err) {
      builder.status = `Tree field invalid: ${err.message || err}`;
    }
    builder.dirty = true;
    if (options.persist !== false) storyBuilderQueueAutosave();
    storyBuilderRefreshTreeInspectorFieldDisplay(objective, key);
    const rerender = options.rerender === true || options.rerender !== false && storyBuilderTreeInspectorFieldRequiresRender(field);
    if (rerender) storyBuilderRenderPreservingTreePanel({
      defer: true
    });
  }
  function storyBuilderAddOutcomeRoute() {
    const objective = storyBuilderObjectiveById(app.storyBuilder?.selectedObjectiveId, app.storyBuilder?.draft);
    if (!objective) return;
    const routes = objectiveOutcomeRoutes(objective);
    const id = uniqueObjectiveId("outcome", new Set(routes.map(route => route.id)), "outcome");
    routes.push({
      id,
      criteria: "Describe the private scene outcome that selects this route.",
      requirements: [],
      rewards: [],
      next_objective_id: "",
      fallback: routes.length === 0
    });
    objective.route_control = "ai";
    objective.outcome_routes = routes;
    delete objective.next_objectives;
    app.storyBuilder.dirty = true;
    saveStoryBuilderDraft(false, {
      collectVisible: false
    });
    renderStoryBuilder();
  }
  function storyBuilderMoveOutcomeRoute(index, delta) {
    const objective = storyBuilderObjectiveById(app.storyBuilder?.selectedObjectiveId, app.storyBuilder?.draft);
    if (!objective) return;
    const routes = objectiveOutcomeRoutes(objective);
    const next = index + delta;
    if (index < 0 || index >= routes.length || next < 0 || next >= routes.length) return;
    [routes[index], routes[next]] = [routes[next], routes[index]];
    objective.outcome_routes = routes;
    app.storyBuilder.dirty = true;
    saveStoryBuilderDraft(false, {
      collectVisible: false
    });
    renderStoryBuilder();
  }
  async function storyBuilderDeleteOutcomeRoute(index) {
    const objective = storyBuilderObjectiveById(app.storyBuilder?.selectedObjectiveId, app.storyBuilder?.draft);
    if (!objective) return;
    const routes = objectiveOutcomeRoutes(objective);
    if (index < 0 || index >= routes.length) return;
    if (!(await showConfirm("Delete Outcome Route", "Delete this outcome route? You can undo this change from the Story Builder header.", {
      confirmText: "Delete",
      danger: true
    }))) return false;
    routes.splice(index, 1);
    objective.outcome_routes = routes;
    app.storyBuilder.dirty = true;
    const saved = await saveStoryBuilderDraft(false, {
      collectVisible: false
    });
    renderStoryBuilder();
    return saved;
  }
  function storyBuilderApplyOutcomeRouteField(field, options = {}) {
    const objective = storyBuilderObjectiveById(app.storyBuilder?.selectedObjectiveId, app.storyBuilder?.draft);
    const index = Number(field?.dataset?.outcomeRouteIndex);
    const key = field?.dataset?.outcomeRouteField;
    const routes = objectiveOutcomeRoutes(objective);
    const route = routes[index];
    if (!route || !key) return;
    try {
      if (["requirements", "rewards"].includes(key)) {
        const parsed = JSON.parse(field.value || "[]");
        if (!Array.isArray(parsed)) throw new Error(`${key} must be an array.`);
        route[key] = parsed;
      } else if (key === "fallback") {
        route[key] = !!field.checked;
        if (route.fallback) {
          for (const [otherIndex, other] of routes.entries()) if (otherIndex !== index) other.fallback = false;
        }
      } else if (key === "ending_type") {
        const endingType = String(field.value || "").trim();
        if (endingType && !["freeplay", "ending", "game_over"].includes(endingType)) throw new Error("ending_type must be freeplay, ending, or game_over.");
        if (endingType) {
          route.ending_type = endingType;
          delete route.next_objective_id;
          delete route.target_input_group_id;
        } else delete route.ending_type;
      } else {
        route[key] = String(field.value || "").trim();
      }
      objective.outcome_routes = routes;
      app.storyBuilder.status = "Hidden outcome route updated";
    } catch (err) {
      app.storyBuilder.status = `Outcome route field invalid: ${err.message || err}`;
    }
    app.storyBuilder.dirty = true;
    if (options.persist !== false) storyBuilderQueueAutosave();
    if (options.rerender !== false) storyBuilderRenderPreservingTreePanel({
      defer: true
    });
  }
  function storyBuilderRenameObjectiveId(oldId, newId, draft = app.storyBuilder?.draft) {
    if (!oldId || !newId || oldId === newId) return;
    const tree = storyBuilderTreeEditorData(draft);
    if (tree.positions[oldId]) {
      tree.positions[newId] = tree.positions[oldId];
      delete tree.positions[oldId];
    }
    const objectives = storyBuilderObjectiveList(draft);
    for (const objective of objectives) {
      objective.requires = objectiveRequiredIds(objective).map(id => id === oldId ? newId : id);
      const next = objectiveNextOptions(objective).map(item => ({
        ...item,
        objective_id: String(item.objective_id) === oldId ? newId : item.objective_id
      }));
      if (next.length) objective.next_objectives = next;
      const outcomes = objectiveOutcomeRoutes(objective).map(route => ({
        ...route,
        next_objective_id: route.next_objective_id === oldId ? newId : route.next_objective_id
      }));
      if (outcomes.length) objective.outcome_routes = outcomes;
    }
    if (draft.state?.objectives?.active_id === oldId) draft.state.objectives.active_id = newId;
  }
  async function storyBuilderImportJson() {
    const files = await chooseImportFiles({
      accept: COMPRESSED_JSON_IMPORT_ACCEPT,
      multiple: false
    });
    const file = files[0];
    if (!file) return;
    return withSavingOverlay(async () => {
      try {
        const data = JSON.parse(await compressedJsonBlobText(file, file.name));
        const previous = clone(app.storyBuilder.draft);
        const candidate = clone(previous);
        mergeStoryBuilderImport(data, candidate);
        const accepted = await showConfirm("Import Story Data", `Apply the recognized story sections from ${file.name}? You can undo this import from the Story Builder header.`, {
          confirmText: "Import"
        });
        if (!accepted) return false;
        storyBuilderRememberPreviousDraft(previous);
        app.storyBuilder.draft = candidate;
        app.storyBuilder.status = `Imported ${file.name}`;
        app.storyBuilder.dirty = true;
        await saveStoryBuilderDraft(false, {
          collectVisible: false,
          recordHistory: false
        });
        renderStoryBuilder();
        return true;
      } catch (err) {
        showNotice("Story Builder Import Failed", err.message || String(err));
        return false;
      }
    }, "Importing story data...");
  }
  function mergeStoryBuilderImport(data, targetDraft = app.storyBuilder?.draft) {
    const draft = targetDraft;
    if (!draft || !isPlainObject(data)) return;
    const source = data.storyTemplate || data.template || data;
    if (source.state) {
      draft.state = stripRuntimeTemplateFields(source.state);
      draft.title = source.title || draft.title;
      draft.description = source.description || draft.description;
      draft.source = entitySourceSlot(source.source);
      draft.creator = entityCreatorSlot(source.creator);
      draft.creation_tool = entityCreationToolSlot(source.creation_tool);
      return;
    }
    draft.state ||= {};
    if (data.future_cast) draft.state.future_cast = repairAiFutureCast(data.future_cast);
    if (data.characters || data.future_characters) {
      draft.state.future_cast ||= {
        enabled: true,
        items: {}
      };
      draft.state.future_cast.items ||= {};
      const list = Array.isArray(data.characters) ? data.characters : Array.isArray(data.future_characters) ? data.future_characters : Object.values(data.characters || data.future_characters || {});
      for (const character of list) {
        const name = character.name || "Future Character";
        const id = character.id || objectiveIdFromTitle(name, `future-${Date.now()}`);
        draft.state.future_cast.items[id] = {
          id,
          name,
          status: "locked",
          introduce_as: "npc",
          scene_presence: "nearby",
          greeting: character.greeting || character.on_unlock?.greeting || "",
          full_character: character.full_character || character,
          profile_images: character.profile_images || [],
          images: character.images || [],
          on_unlock: character.on_unlock || {
            image: (character.images || [])[0] || {}
          }
        };
      }
    }
    const supportedStateSections = ["messages", "location", "world_map", "time", "scene", "npc_directory", "story_inventory", "story_rules", "story_memory", "world_flags", "story_clock", "story_pacing", "timed_events", "reward_bundles", "reward_templates", "numeric_precision", "story_shops", "character_shop_cost_templates", "story_job_offers", "objectives"];
    for (const key of supportedStateSections) {
      if (data[key]) draft.state[key] = data[key];
    }
    if (Array.isArray(data.images)) {
      draft.state.future_cast ||= {
        enabled: true,
        items: {}
      };
      draft.state.future_cast.shared_images = data.images;
    }
    draft.state = stripRuntimeTemplateFields(draft.state);
  }
  async function storyBuilderRunAiComposer() {
    const builder = app.storyBuilder;
    const request = $("storyBuilderAiRequest")?.value.trim();
    if (!builder || !request) return;
    saveStoryBuilderVisibleFields();
    builder.status = "Waiting for AI story-template patch...";
    builder.aiOutput = "";
    builder.pendingPatch = null;
    renderStoryBuilder();
    const instruction = `You are editing an EmberAdventures story template.
Return ONLY valid JSON:
{
  "ops": [
    {
      "op": "set|merge|append|delete",
      "path": "draft.path.here",
      "value": "..."
    }
  ]
}

Allowed root path is draft. Examples:
draft.title
draft.description
draft.allow_any_player
draft.any_player_starting_state
draft.state.future_cast.items.character_id
draft.state.objectives.items
draft.state.world_map.locations

Do not add runtime-only fields such as setup_complete or player_preferences.
Do not edit draft.source, draft.creator, or draft.creation_tool. Those are future public-library metadata owned by the user/upload flow.
Keep the complete story suitable for a general audience.
Use top-level draft.allow_any_player for whether Character Library players are allowed. Put only story-required replacement/addition fields in draft.any_player_starting_state.

User request:
${request}

Current story template:
${prettyJson(builder.draft).slice(0, 50000)}`;
    try {
      const raw = await aiText(instruction, {
        startWith: "{",
        hideStartWith: false,
        label: "story builder patch",
        onStream: text => {
          builder.aiOutput = text;
          builder.status = `Receiving AI patch: ${text.length.toLocaleString()} chars`;
          const status = document.querySelector(".story-builder-status");
          if (status) status.textContent = builder.status;
        }
      });
      const data = parseJsonObject(raw);
      if (!Array.isArray(data?.ops)) throw new Error("AI did not return ops[]");
      builder.pendingPatch = data.ops;
      builder.status = `Patch ready: ${data.ops.length} op(s)`;
      builder.aiOutput = "";
    } catch (err) {
      builder.status = `AI patch failed: ${err.message || err}`;
    }
    renderStoryBuilder();
  }
  async function storyBuilderApplyPendingPatch() {
    const builder = app.storyBuilder;
    if (!builder?.pendingPatch) return;
    const selectedIndexes = new Set([...document.querySelectorAll("[data-story-builder-patch-index]:checked")].map(field => Number(field.dataset.storyBuilderPatchIndex)).filter(Number.isInteger));
    const selectedOps = builder.pendingPatch.filter((_, index) => selectedIndexes.has(index));
    if (!selectedOps.length) {
      builder.status = "Select at least one proposed change.";
      renderStoryBuilder();
      return false;
    }
    const previous = clone(builder.draft);
    const candidate = clone(builder.draft);
    for (const op of selectedOps) applyStoryBuilderPatchOp(candidate, op);
    const contract = validateStoryDefinition(candidate);
    const builderChecks = storyBuilderValidationChecks(candidate).filter(check => !check.ok);
    if (!contract.ok || builderChecks.length) {
      const first = contract.errors?.[0]?.message || builderChecks[0]?.label || "The proposed changes are invalid.";
      builder.status = `Patch rejected: ${first}`;
      showNotice("AI Changes Need Repair", "The selected changes were not applied because they would make the story invalid. Review the Validation panel or ask the AI to revise the proposal.");
      renderStoryBuilder();
      return false;
    }
    storyBuilderRememberPreviousDraft(previous);
    builder.draft = candidate;
    builder.pendingPatch = null;
    builder.dirty = true;
    builder.status = `${selectedOps.length} change${selectedOps.length === 1 ? "" : "s"} applied`;
    await saveStoryBuilderDraft(false, {
      collectVisible: false,
      recordHistory: false
    });
    renderStoryBuilder();
    return true;
  }
  function applyStoryBuilderPatchOp(draft, op) {
    const path = String(op.path || "").replace(/^draft\.?/, "").split(".").filter(Boolean);
    if (!path.length) return;
    const banned = new Set(["setup_complete", "player_preferences"]);
    const userOwnedMetadata = new Set(["creator", "creation_tool"]);
    const sourceIsStorySource = path[0] === "state" && path[1] === "meta" && path[2] === "story_source";
    const editsUserOwnedSource = path[0] === "source" || path[path.length - 1] === "source" && !sourceIsStorySource;
    if (path.some(part => userOwnedMetadata.has(part)) || editsUserOwnedSource) return;
    if (path.some(part => banned.has(part))) return;
    const value = op.value;
    if (op.op === "delete") {
      removePathValue(draft, path);
      return;
    }
    if (op.op === "append") {
      const list = getPathValue(draft, path);
      if (Array.isArray(list)) list.push(value);
      return;
    }
    if (op.op === "merge") {
      const current = getPathValue(draft, path);
      if (isPlainObject(current) && isPlainObject(value)) setPathValue(draft, path, {
        ...current,
        ...value
      });
      return;
    }
    setPathValue(draft, path, value);
  }
  function renderStoryBuilderValidation() {
    const draft = app.storyBuilder?.draft;
    const contract = validateStoryDefinition(draft || {});
    const checks = storyBuilderValidationChecks(draft, contract);
    return `
                <section class="stat-card">
                    <h3>Validation</h3>
                    <div class="stack">
                        ${checks.map(check => `<div class="${check.ok ? "good" : "bad"}">${check.ok ? "OK" : "Fix"}: ${escapeHtml(check.label)}</div>`).join("")}
                        ${(contract.warnings || []).map(warning => `<div class="warn">Review: ${escapeHtml(warning.path)}: ${escapeHtml(warning.message)}</div>`).join("")}
                        ${contract.ok && checks.every(check => check.ok) ? `<div class="good">Ready to save and export.</div>` : ""}
                    </div>
                </section>
            `;
  }
  
