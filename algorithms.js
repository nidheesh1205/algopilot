/* Algorithm 2035 - syllabus algorithms. Each returns its answer together with
   operation counters (ops / states / pruned) used by the experiment lab. */
(function (g) {
  'use strict';
  const D = (g.DAA = g.DAA || {});
  const INF = Infinity;
  const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
  D.now = now;
  D.timed = (fn) => {
    const t = now();
    const r = fn();
    return [r, now() - t];
  };

  /* ---------------- parsing helpers ---------------- */
  D.parseEdges = function (text, directed) {
    const names = [],
      idx = new Map(),
      edges = [];
    const id = (n) => {
      if (!idx.has(n)) {
        idx.set(n, names.length);
        names.push(n);
      }
      return idx.get(n);
    };
    for (const raw of String(text).split(/\n|;/)) {
      const line = raw.replace(/#.*/, '').trim();
      if (!line) continue;
      const p = line.split(/[\s,]+/);
      if (p.length < 2) throw new Error('Bad link "' + line + '". Use: siteA siteB cost');
      const w = p.length >= 3 ? Number(p[2]) : 1;
      if (!isFinite(w)) throw new Error('Cost is not a number in "' + line + '"');
      edges.push({ u: id(p[0]), v: id(p[1]), w });
    }
    return { names, n: names.length, edges, directed: !!directed };
  };
  D.parseNumbers = (text) =>
    String(text)
      .split(/[\s,;]+/)
      .filter(Boolean)
      .map((x) => {
        const v = Number(x);
        if (!isFinite(v)) throw new Error('"' + x + '" is not a number');
        return v;
      });
  D.parseItems = function (text) {
    const items = [];
    for (const raw of String(text).split(/\n|;/)) {
      const line = raw.replace(/#.*/, '').trim();
      if (!line) continue;
      const p = line.split(/[\s,]+/);
      if (p.length < 3) throw new Error('Bad item "' + line + '". Use: name value weight');
      const value = Number(p[1]),
        weight = Number(p[2]);
      if (!isFinite(value) || !isFinite(weight) || weight <= 0 || value < 0)
        throw new Error('Value must be >= 0 and weight > 0 in "' + line + '"');
      items.push({ name: p[0], value, weight });
    }
    if (!items.length) throw new Error('No items given');
    return items;
  };

  function toMatrix(g, directed) {
    const n = g.n;
    const M = Array.from({ length: n }, (_, i) => {
      const r = new Array(n).fill(INF);
      r[i] = 0;
      return r;
    });
    for (const e of g.edges) {
      if (e.u === e.v) continue;
      if (e.w < M[e.u][e.v]) M[e.u][e.v] = e.w;
      if (!directed && e.w < M[e.v][e.u]) M[e.v][e.u] = e.w;
    }
    return M;
  }
  D.toMatrix = toMatrix;

  /* ---------------- Minimum spanning tree ---------------- */
  D.prim = function (g) {
    const n = g.n;
    if (n === 0) return { connected: true, edges: [], total: 0, ops: 0 };
    const W = toMatrix(g, false);
    const inT = new Array(n).fill(false),
      key = new Array(n).fill(INF),
      par = new Array(n).fill(-1);
    key[0] = 0;
    let ops = 0,
      total = 0;
    const edges = [];
    for (let it = 0; it < n; it++) {
      let u = -1;
      for (let v = 0; v < n; v++) {
        ops++;
        if (!inT[v] && (u < 0 || key[v] < key[u])) u = v;
      }
      if (key[u] === INF) return { connected: false, edges, total, ops };
      inT[u] = true;
      if (par[u] >= 0) {
        edges.push([par[u], u, key[u]]);
        total += key[u];
      }
      for (let v = 0; v < n; v++) {
        ops++;
        if (!inT[v] && W[u][v] < key[v]) {
          key[v] = W[u][v];
          par[v] = u;
        }
      }
    }
    return { connected: true, edges, total, ops };
  };

  D.kruskal = function (g) {
    const n = g.n;
    const E = g.edges.filter((e) => e.u !== e.v).map((e) => [e.u, e.v, e.w]);
    let cmp = 0,
      finds = 0;
    E.sort((a, b) => {
      cmp++;
      return a[2] - b[2];
    });
    const par = [...Array(n).keys()];
    const find = (x) => {
      while (par[x] !== x) {
        finds++;
        par[x] = par[par[x]];
        x = par[x];
      }
      return x;
    };
    const rank = new Array(n).fill(0);
    const edges = [];
    let total = 0;
    for (const [u, v, w] of E) {
      const a = find(u),
        b = find(v);
      if (a === b) continue;
      if (rank[a] < rank[b]) par[a] = b;
      else if (rank[a] > rank[b]) par[b] = a;
      else {
        par[b] = a;
        rank[a]++;
      }
      edges.push([u, v, w]);
      total += w;
      if (edges.length === n - 1) break;
    }
    return { connected: edges.length === Math.max(0, n - 1), edges, total, ops: cmp + finds };
  };

  /* ---------------- Floyd-Warshall ---------------- */
  D.fwMatrix = function (d) {
    const n = d.length;
    const nx = Array.from({ length: n }, (_, i) =>
      Array.from({ length: n }, (_, j) => (i !== j && d[i][j] < INF ? j : -1))
    );
    let ops = 0;
    for (let k = 0; k < n; k++) {
      const dk = d[k];
      for (let i = 0; i < n; i++) {
        const di = d[i],
          dik = di[k];
        ops += n;
        if (dik === INF) continue;
        for (let j = 0; j < n; j++) {
          const alt = dik + dk[j];
          if (alt < di[j]) {
            di[j] = alt;
            nx[i][j] = nx[i][k];
          }
        }
      }
    }
    let negCycle = false;
    for (let i = 0; i < n; i++) if (d[i][i] < 0) negCycle = true;
    return { d, next: nx, ops, negCycle };
  };
  D.floydWarshall = function (g) {
    return D.fwMatrix(toMatrix(g, g.directed));
  };
  D.fwPath = function (fw, i, j) {
    if (fw.d[i][j] === INF || fw.negCycle) return null;
    const p = [i];
    let guard = 0;
    while (i !== j && guard++ <= fw.d.length) {
      i = fw.next[i][j];
      if (i < 0) return null;
      p.push(i);
    }
    return p;
  };

  /* ---------------- Knapsacks ---------------- */
  function scaleInts(vals) {
    let k = 0;
    for (const v of vals) {
      const s = String(v);
      if (s.includes('.')) k = Math.max(k, s.split('.')[1].length);
    }
    k = Math.min(k, 3);
    const f = Math.pow(10, k);
    return vals.map((v) => Math.max(0, Math.round(v * f)));
  }
  const ratio = (it) => (it.weight === 0 ? INF : it.value / it.weight);

  D.knapFractional = function (items, W) {
    let cmp = 0;
    const order = items
      .map((_, i) => i)
      .sort((a, b) => {
        cmp++;
        return ratio(items[b]) - ratio(items[a]);
      });
    let rem = W,
      value = 0;
    const picks = [];
    for (const i of order) {
      if (rem <= 0) break;
      const it = items[i];
      const f = Math.min(1, rem / it.weight);
      picks.push({ name: it.name, fraction: f, value: f * it.value, weight: f * it.weight });
      value += f * it.value;
      rem -= f * it.weight;
    }
    return { value, picks, ops: cmp + order.length, used: W - Math.max(0, rem) };
  };

  D.knap01 = function (items, W, maxCells) {
    maxCells = maxCells || 4e7;
    const sc = scaleInts([...items.map((i) => i.weight), W]);
    const C = sc[sc.length - 1];
    const w = sc.slice(0, -1).map((x) => Math.max(1, x));
    const n = items.length;
    if (n * (C + 1) > maxCells)
      throw new Error(
        'DP table would need ' + (n * (C + 1)).toLocaleString() + ' cells (n x capacity). This is the pseudo-polynomial limit of 0/1 Knapsack.'
      );
    const dp = new Float64Array(C + 1);
    const take = new Uint8Array(n * (C + 1));
    let ops = 0;
    for (let i = 0; i < n; i++) {
      for (let c = C; c >= w[i]; c--) {
        ops++;
        const v = dp[c - w[i]] + items[i].value;
        if (v > dp[c]) {
          dp[c] = v;
          take[i * (C + 1) + c] = 1;
        }
      }
    }
    let c = C;
    const chosen = [];
    for (let i = n - 1; i >= 0; i--) {
      if (take[i * (C + 1) + c]) {
        chosen.push(items[i]);
        c -= w[i];
      }
    }
    chosen.reverse();
    return {
      value: dp[C],
      chosen,
      weight: chosen.reduce((s, x) => s + x.weight, 0),
      ops,
      cells: n * (C + 1),
      capacityUnits: C,
    };
  };

  /* greedy by value/weight - optimal for fractional, NOT for 0/1 */
  D.knapGreedy01 = function (items, W) {
    const order = items.map((_, i) => i).sort((a, b) => ratio(items[b]) - ratio(items[a]));
    let rem = W,
      value = 0;
    const chosen = [];
    for (const i of order) {
      if (items[i].weight <= rem) {
        chosen.push(items[i]);
        rem -= items[i].weight;
        value += items[i].value;
      }
    }
    return { value, chosen };
  };

  /* ---------------- Matrix Chain Multiplication ---------------- */
  D.mcm = function (p) {
    const n = p.length - 1;
    if (n < 1) throw new Error('Need at least two dimensions (one matrix)');
    const m = Array.from({ length: n + 1 }, () => new Float64Array(n + 1));
    const s = Array.from({ length: n + 1 }, () => new Int32Array(n + 1));
    let ops = 0;
    for (let len = 2; len <= n; len++) {
      for (let i = 1; i + len - 1 <= n; i++) {
        const j = i + len - 1;
        m[i][j] = INF;
        for (let k = i; k < j; k++) {
          ops++;
          const q = m[i][k] + m[k + 1][j] + p[i - 1] * p[k] * p[j];
          if (q < m[i][j]) {
            m[i][j] = q;
            s[i][j] = k;
          }
        }
      }
    }
    const paren = (i, j) => (i === j ? 'A' + i : '(' + paren(i, s[i][j]) + ' x ' + paren(s[i][j] + 1, j) + ')');
    let ltr = 0,
      rtl = 0;
    for (let t = 2; t <= n; t++) ltr += p[0] * p[t - 1] * p[t];
    for (let t = 1; t < n; t++) rtl += p[t - 1] * p[t] * p[n];
    return { n, cost: n === 1 ? 0 : m[1][n], paren: paren(1, n), leftToRight: ltr, rightToLeft: rtl, ops };
  };

  /* ---------------- Hamiltonian path / cycle (backtracking) ---------------- */
  D.hamiltonian = function (g, mode, budget) {
    budget = budget || 5e6;
    const n = g.n;
    const A = toMatrix(g, g.directed).map((r) => r.map((x) => x < INF));
    let states = 0,
      backtracks = 0,
      found = null,
      exhausted = false;
    const path = [],
      vis = new Array(n).fill(false);
    function rec() {
      states++;
      if (states > budget) {
        exhausted = true;
        return true;
      }
      if (path.length === n) {
        if (mode === 'path' || A[path[n - 1]][path[0]]) {
          found = path.slice();
          return true;
        }
        backtracks++;
        return false;
      }
      const last = path[path.length - 1];
      for (let v = 0; v < n; v++) {
        if (!vis[v] && A[last][v]) {
          vis[v] = true;
          path.push(v);
          if (rec()) return true;
          path.pop();
          vis[v] = false;
        }
      }
      backtracks++;
      return false;
    }
    if (n === 0 || (mode === 'cycle' && n < 3)) return { found: null, states: 0, backtracks: 0, exhausted: false, mode };
    const starts = mode === 'cycle' ? [0] : [...Array(n).keys()];
    for (const s0 of starts) {
      path.length = 0;
      vis.fill(false);
      path.push(s0);
      vis[s0] = true;
      if (rec()) break;
    }
    return { found, states, backtracks, exhausted, mode };
  };

  /* ---------------- N-Queen style conflict-free placement ---------------- */
  D.nqueens = function (n, stopAtFirst) {
    const cols = new Array(n).fill(false),
      d1 = new Array(2 * n).fill(false),
      d2 = new Array(2 * n).fill(false);
    const pos = [];
    let nodes = 0,
      solutions = 0,
      first = null,
      nodesToFirst = 0,
      pruned = 0,
      done = false;
    function rec(r) {
      nodes++;
      if (r === n) {
        solutions++;
        if (!first) {
          first = pos.slice();
          nodesToFirst = nodes;
        }
        if (stopAtFirst) done = true;
        return;
      }
      for (let c = 0; c < n && !done; c++) {
        if (cols[c] || d1[r + c] || d2[r - c + n - 1]) {
          pruned++;
          continue;
        }
        cols[c] = d1[r + c] = d2[r - c + n - 1] = true;
        pos[r] = c;
        rec(r + 1);
        cols[c] = d1[r + c] = d2[r - c + n - 1] = false;
      }
    }
    rec(0);
    return { n, solutions, first, nodes, nodesToFirst, pruned };
  };

  /* ---------------- Travelling Salesperson ---------------- */
  /* complete distance matrix from a link list; missing links are filled by
     Floyd-Warshall (shortest connection), which is flagged to the caller */
  D.tspMatrix = function (g) {
    const n = g.n;
    const M = toMatrix(g, false);
    let closure = false;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (i !== j && M[i][j] === INF) closure = true;
    let fwOps = 0;
    if (closure) fwOps = D.fwMatrix(M).ops;
    let feasible = true;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (M[i][j] === INF) feasible = false;
    return { D: M, closure, feasible, fwOps };
  };

  function minOut(Dm) {
    const n = Dm.length;
    return Dm.map((r, u) => {
      let m = INF;
      for (let v = 0; v < n; v++) if (v !== u && r[v] < m) m = r[v];
      return m;
    });
  }

  /* pure backtracking: explores the whole tree of partial tours */
  D.tspBacktrack = function (Dm, budget) {
    budget = budget || 3e7;
    const n = Dm.length;
    let best = INF,
      bestPath = null,
      nodes = 0,
      exhausted = false;
    const vis = new Array(n).fill(false),
      path = [0];
    vis[0] = true;
    function rec(last, cnt, cost) {
      if (exhausted) return;
      nodes++;
      if (nodes > budget) {
        exhausted = true;
        return;
      }
      if (cnt === n) {
        const t = cost + Dm[last][0];
        if (t < best) {
          best = t;
          bestPath = path.slice();
        }
        return;
      }
      for (let v = 1; v < n; v++) {
        if (!vis[v]) {
          vis[v] = true;
          path.push(v);
          rec(v, cnt + 1, cost + Dm[last][v]);
          path.pop();
          vis[v] = false;
        }
      }
    }
    if (n === 1) return { best: 0, path: [0], nodes: 1, pruned: 0, optimal: true, maxQueue: n };
    rec(0, 1, 0);
    return { best, path: bestPath, nodes, pruned: 0, optimal: !exhausted, maxQueue: n };
  };

  /* depth-first branch & bound with a min-edge lower bound */
  D.tspBnBDFS = function (Dm, budget) {
    budget = budget || 3e6;
    const n = Dm.length;
    const m1 = minOut(Dm);
    let best = INF,
      bestPath = null,
      nodes = 0,
      pruned = 0,
      exhausted = false;
    const vis = new Array(n).fill(false),
      path = [0];
    vis[0] = true;
    let remMin = 0;
    for (let u = 1; u < n; u++) remMin += m1[u];
    function rec(last, cnt, cost) {
      if (exhausted) return;
      nodes++;
      if (nodes > budget) {
        exhausted = true;
        return;
      }
      if (cnt === n) {
        const t = cost + Dm[last][0];
        if (t < best) {
          best = t;
          bestPath = path.slice();
        }
        return;
      }
      if (cost + m1[last] + remMin >= best) {
        pruned++;
        return;
      }
      const cand = [];
      for (let v = 1; v < n; v++) if (!vis[v]) cand.push(v);
      cand.sort((a, b) => Dm[last][a] - Dm[last][b]);
      for (const v of cand) {
        vis[v] = true;
        path.push(v);
        remMin -= m1[v];
        rec(v, cnt + 1, cost + Dm[last][v]);
        remMin += m1[v];
        path.pop();
        vis[v] = false;
      }
    }
    if (n === 1) return { best: 0, path: [0], nodes: 1, pruned: 0, optimal: true, maxQueue: 1 };
    rec(0, 1, 0);
    return { best, path: bestPath, nodes, pruned, optimal: !exhausted, maxQueue: n };
  };

  /* best-first branch & bound whose frontier is a Binomial or Fibonacci heap */
  D.tspBnBBestFirst = function (Dm, budget, HeapClass) {
    budget = budget || 2e6;
    HeapClass = HeapClass || D.BinomialHeap;
    const n = Dm.length;
    const m1 = minOut(Dm);
    let totalMin = 0;
    for (let u = 0; u < n; u++) totalMin += m1[u];
    const heap = new HeapClass();
    let best = INF,
      bestPath = null,
      nodes = 0,
      pruned = 0,
      maxQueue = 0,
      exhausted = false;
    if (n === 1) return { best: 0, path: [0], nodes: 1, pruned: 0, optimal: true, maxQueue: 1 };
    // state: path, visited bitset (array), cost, remaining min-sum of unvisited
    const root = { path: [0], vis: 1, cost: 0, rem: totalMin - m1[0] };
    heap.insert(m1[0] + root.rem, root);
    while (heap.n > 0) {
      const it = heap.extractMin();
      if (it.key >= best) {
        pruned += heap.n;
        break;
      }
      nodes++;
      if (nodes > budget) {
        exhausted = true;
        break;
      }
      const s = it.val,
        last = s.path[s.path.length - 1],
        cnt = s.path.length;
      for (let v = 1; v < n; v++) {
        if (s.vis & (1 << v)) continue;
        const cost2 = s.cost + Dm[last][v];
        if (cnt + 1 === n) {
          const t = cost2 + Dm[v][0];
          if (t < best) {
            best = t;
            bestPath = [...s.path, v];
          }
          continue;
        }
        const rem2 = s.rem - m1[v];
        const lb = cost2 + m1[v] + rem2;
        if (lb < best) heap.insert(lb, { path: [...s.path, v], vis: s.vis | (1 << v), cost: cost2, rem: rem2 });
        else pruned++;
      }
      if (heap.n > maxQueue) maxQueue = heap.n;
    }
    return { best, path: bestPath, nodes, pruned, optimal: !exhausted, maxQueue };
  };
})(typeof window !== 'undefined' ? window : globalThis);
