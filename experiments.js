/* Algorithm 2035 - stress-testing lab.
   Each experiment: generated input family -> measured operations -> comparison
   with the theoretical bound -> risk rating (Low / Moderate / High). */
(function (g) {
  'use strict';
  const D = (g.DAA = g.DAA || {});
  const f = (x) => (typeof x === 'number' && isFinite(x) ? x.toLocaleString('en-US', { maximumFractionDigits: 1 }) : String(x));

  /* least-squares slope of log(y) against log(x) */
  function slope(pts) {
    const p = pts.filter((q) => q[0] > 0 && q[1] > 0).map((q) => [Math.log(q[0]), Math.log(q[1])]);
    if (p.length < 2) return NaN;
    const mx = p.reduce((s, q) => s + q[0], 0) / p.length,
      my = p.reduce((s, q) => s + q[1], 0) / p.length;
    let num = 0,
      den = 0;
    for (const q of p) {
      num += (q[0] - mx) * (q[1] - my);
      den += (q[0] - mx) * (q[0] - mx);
    }
    return num / den;
  }
  D.slope = slope;

  /* polynomial family: compare fitted exponent with the theoretical one */
  function polyRisk(pts, expected, lastMs, what) {
    const s = slope(pts);
    const fits = Math.abs(s - expected) <= 0.4;
    if (!fits) return { level: 'Moderate', why: 'Fitted growth exponent ' + s.toFixed(2) + ' differs from the expected ' + expected + ' for ' + what + '; check input restrictions.' };
    if (lastMs > 800) return { level: 'Moderate', why: 'Growth matches theory (exponent ' + s.toFixed(2) + ' vs ' + expected + ') but the largest run took ' + f(lastMs) + ' ms.' };
    return { level: 'Low', why: 'Growth matches theory: fitted exponent ' + s.toFixed(2) + ' vs expected ' + expected + '. Practical for the tested sizes.' };
  }
  /* exponential family: ratio between consecutive sizes */
  function expRisk(pts, lastMs, what) {
    const r = pts.length > 1 ? pts[pts.length - 1][1] / Math.max(1, pts[pts.length - 2][1]) : 1;
    const last = pts[pts.length - 1][1];
    if (r >= 3 || last > 1e6) return { level: 'High', why: 'One extra input unit multiplied the work by ' + r.toFixed(1) + 'x (' + f(last) + ' ' + what + ' at the largest size). Exact search becomes impractical a few sizes later.' };
    return { level: 'Moderate', why: 'Growth is steep (' + r.toFixed(1) + 'x per step, ' + f(last) + ' ' + what + ').' };
  }

  const timeIt = (fn) => D.timed(fn);

  const EXPERIMENTS = [];

  EXPERIMENTS.push({
    id: 'mst',
    title: 'MST: Prim vs Kruskal on sparse and dense graphs',
    family: 'Minimum Spanning Tree',
    theory: 'Prim (matrix) O(V^2); Kruskal O(E log E). Sparse: E = 2V. Dense: 60% of all possible links.',
    xLabel: 'sites V',
    run() {
      const S = { ps: [], ks: [], pd: [], kd: [] },
        rows = [];
      let lastMs = 0;
      for (const V of [20, 40, 80, 160, 320]) {
        const sp = D.parseEdges(D.genGraph(V, 2 * V, V, 'v', 99), false);
        const de = D.parseEdges(D.genGraph(V, Math.floor(0.6 * ((V * (V - 1)) / 2)), V + 1, 'v', 99), false);
        const [a1, t1] = timeIt(() => D.prim(sp)),
          [b1, t2] = timeIt(() => D.kruskal(sp)),
          [a2, t3] = timeIt(() => D.prim(de)),
          [b2, t4] = timeIt(() => D.kruskal(de));
        S.ps.push([V, a1.ops]);
        S.ks.push([V, b1.ops]);
        S.pd.push([V, a2.ops]);
        S.kd.push([V, b2.ops]);
        lastMs = Math.max(t1, t2, t3, t4);
        rows.push([V, sp.edges.length, f(a1.ops), f(b1.ops), de.edges.length, f(a2.ops), f(b2.ops), a2.total === b2.total ? 'yes' : 'NO']);
      }
      return {
        series: [
          { name: 'Prim, sparse', pts: S.ps },
          { name: 'Kruskal, sparse', pts: S.ks },
          { name: 'Prim, dense', pts: S.pd },
          { name: 'Kruskal, dense', pts: S.kd },
        ],
        theory: { name: 'V^2 (reference)', fn: (x) => x * x, anchor: 0, on: 0 },
        head: ['V', 'E sparse', 'Prim ops', 'Kruskal ops', 'E dense', 'Prim ops', 'Kruskal ops', 'Same cost'],
        rows,
        risk: polyRisk(S.pd, 2, lastMs, 'dense Prim'),
        finding: 'On sparse graphs Kruskal does far fewer steps than Prim; on dense graphs the order flips. Both always return the same total cost.',
      };
    },
  });

  EXPERIMENTS.push({
    id: 'fw',
    title: 'Floyd-Warshall as the number of zones grows',
    family: 'Dynamic programming: all-pairs',
    theory: 'O(V^3) time, O(V^2) space: doubling V multiplies work by 8.',
    xLabel: 'zones V',
    run() {
      const pts = [],
        rows = [];
      let lastMs = 0,
        prev = 0;
      for (const V of [20, 40, 80, 120, 160]) {
        const gph = D.parseEdges(D.genGraph(V, 4 * V, V, 'z', 20), true);
        const [r, ms] = timeIt(() => D.floydWarshall(gph));
        pts.push([V, r.ops]);
        rows.push([V, f(r.ops), f(V * V * V), f(ms), prev ? (r.ops / prev).toFixed(1) + 'x' : '-']);
        prev = r.ops;
        lastMs = ms;
      }
      return { series: [{ name: 'measured relaxations', pts }], theory: { name: 'V^3 (reference)', fn: (x) => x * x * x, anchor: 0 }, head: ['V', 'Relaxations', 'V^3', 'ms', 'Growth vs previous row'], rows, risk: polyRisk(pts, 3, lastMs, 'Floyd-Warshall'), finding: 'Operation count equals V^3 exactly, whatever the graph looks like. Cost depends on the zone count, not on the number of links.' };
    },
  });

  EXPERIMENTS.push({
    id: 'mcm',
    title: 'Matrix Chain Multiplication as the chain grows',
    family: 'Dynamic programming: chain order',
    theory: 'O(n^3) time (about n^3/6 split evaluations), O(n^2) space.',
    xLabel: 'matrices n',
    run() {
      const pts = [],
        rows = [];
      let lastMs = 0;
      const r = D.rng(9);
      for (const n of [10, 20, 40, 80, 160, 240]) {
        const p = Array.from({ length: n + 1 }, () => 5 + Math.floor(r() * 60));
        const [res, ms] = timeIt(() => D.mcm(p));
        pts.push([n, res.ops]);
        rows.push([n, f(res.ops), f(Math.round((n * n * n) / 6)), f(res.cost), f(res.leftToRight), (res.leftToRight / res.cost).toFixed(1) + 'x', f(ms)]);
        lastMs = ms;
      }
      return { series: [{ name: 'split evaluations', pts }], theory: { name: 'n^3 / 6 (reference)', fn: (x) => (x * x * x) / 6, anchor: 0 }, head: ['n', 'Evaluations', 'n^3/6', 'Optimal cost', 'Left-to-right', 'Penalty of naive', 'ms'], rows, risk: polyRisk(pts, 3, lastMs, 'matrix-chain DP'), finding: 'The DP stays cubic while the naive left-to-right order costs several times more scalar multiplications on the same chain.' };
    },
  });

  EXPERIMENTS.push({
    id: 'knap',
    title: 'Knapsack: greedy stays flat, DP grows with the capacity value',
    family: 'Greedy vs dynamic programming',
    theory: 'Fractional: O(n log n), independent of W. 0/1 DP: O(nW), pseudo-polynomial.',
    xLabel: 'capacity W',
    run() {
      const r = D.rng(4);
      const items = Array.from({ length: 100 }, (_, i) => ({ name: 'i' + i, value: 10 + Math.floor(r() * 90), weight: 20 + Math.floor(r() * 400) }));
      const dpPts = [],
        frPts = [],
        rows = [];
      let lastMs = 0;
      for (const W of [100, 500, 1000, 5000, 10000, 20000]) {
        const fr = D.knapFractional(items, W);
        const [dp, ms] = timeIt(() => D.knap01(items, W));
        dpPts.push([W, dp.ops]);
        frPts.push([W, fr.ops]);
        rows.push([f(W), f(fr.ops), f(dp.ops), f(dp.cells), f(fr.value), f(dp.value), f(fr.value - dp.value), f(ms)]);
        lastMs = ms;
      }
      return { series: [{ name: '0/1 DP cell updates', pts: dpPts }, { name: 'Fractional greedy steps', pts: frPts }], theory: null, head: ['W', 'Greedy steps', 'DP updates', 'DP cells', 'Fractional value', '0/1 value', 'Value lost to indivisibility', 'ms'], rows, risk: polyRisk(dpPts.filter((q) => q[0] >= 500), 1, lastMs, 'knapsack DP in W'), finding: 'Greedy work never changes with W. DP work is proportional to W, which is why it is called pseudo-polynomial: a budget written in more digits makes the table huge.' };
    },
  });

  EXPERIMENTS.push({
    id: 'heap',
    title: 'Binomial vs Fibonacci Heap under changing priorities',
    family: 'Advanced data structure: priority queue',
    theory: 'Decrease-key: Binomial O(log n), Fibonacci O(1) amortised. Extract-min: O(log n) for both.',
    xLabel: 'events n',
    run() {
      const S = { b60: [], f60: [], b5: [], f5: [] },
        rows = [];
      let lastMs = 0;
      for (const n of [500, 1000, 2000, 4000, 8000, 16000]) {
        const o = { events: n, merge: false };
        const [b60, t1] = timeIt(() => D.runHeapWorkload(D.BinomialHeap, { ...o, decreaseShare: 60 }));
        const [f60, t2] = timeIt(() => D.runHeapWorkload(D.FibHeap, { ...o, decreaseShare: 60 }));
        const b5 = D.runHeapWorkload(D.BinomialHeap, { ...o, decreaseShare: 5 }),
          f5 = D.runHeapWorkload(D.FibHeap, { ...o, decreaseShare: 5 });
        S.b60.push([n, b60.total]);
        S.f60.push([n, f60.total]);
        S.b5.push([n, b5.total]);
        S.f5.push([n, f5.total]);
        rows.push([f(n), f(b60.cost.dec / Math.max(1, b60.cnt.dec)) + ' / ' + f(f60.cost.dec / Math.max(1, f60.cnt.dec)), f(b60.total), f(f60.total), f(b5.total), f(f5.total)]);
        lastMs = Math.max(t1, t2);
      }
      return {
        series: [
          { name: 'Binomial, 60% decrease-key', pts: S.b60 },
          { name: 'Fibonacci, 60% decrease-key', pts: S.f60 },
          { name: 'Binomial, 5% decrease-key', pts: S.b5 },
          { name: 'Fibonacci, 5% decrease-key', pts: S.f5 },
        ],
        theory: { name: 'n log n (reference)', fn: (x) => x * Math.log2(x), anchor: 0 },
        head: ['n', 'Steps per decrease-key (Bin / Fib)', 'Binomial total (60%)', 'Fibonacci total (60%)', 'Binomial total (5%)', 'Fibonacci total (5%)'],
        rows,
        risk: polyRisk(S.b60, 1.1, lastMs, 'heap workload (n log n)'),
        finding: 'With frequent escalations the Fibonacci Heap does fewer steps, and the gap widens as n grows. With rare escalations the two are close, and the Binomial Heap keeps its worst-case guarantee.',
      };
    },
  });

  EXPERIMENTS.push({
    id: 'tree',
    title: 'B-Tree vs Red-Black Tree: node accesses for lookups',
    family: 'Advanced data structure: search tree',
    theory: 'Red-Black: O(log2 n) node accesses. B-Tree (t = 32): O(log_t n) node accesses.',
    xLabel: 'records n',
    run() {
      const rbP = [],
        btP = [],
        rows = [];
      let lastMs = 0;
      for (const n of [1000, 4000, 16000, 64000]) {
        const r = D.rng(n);
        const set = new Set();
        while (set.size < n) set.add(Math.floor(r() * n * 20));
        const keys = [...set];
        const rb = new D.RBTree(),
          bt = new D.BTree(32);
        const [, ms] = timeIt(() => {
          keys.forEach((k) => rb.insert(k, 1));
          keys.forEach((k) => bt.insert(k, 1));
        });
        const a = rb.st.visits,
          b = bt.st.nodeReads;
        keys.forEach((k) => rb.search(k));
        keys.forEach((k) => bt.search(k));
        const rbV = rb.st.visits - a,
          btV = bt.st.nodeReads - b;
        rbP.push([n, rbV / n]);
        btP.push([n, btV / n]);
        rows.push([f(n), rb.height(), bt.height(), (rbV / n).toFixed(1), (btV / n).toFixed(1), (rbV / btV).toFixed(1) + 'x', rb.st.rot, bt.st.splits]);
        lastMs = ms;
      }
      return { series: [{ name: 'Red-Black: accesses per lookup', pts: rbP }, { name: 'B-Tree t=32: accesses per lookup', pts: btP }], theory: null, head: ['n', 'RB height', 'B height', 'RB accesses/lookup', 'B accesses/lookup', 'RB / B', 'RB rotations', 'B splits'], rows, risk: { level: 'Low', why: 'Both structures stay logarithmic. Red-Black grows like log2 n, the B-Tree like log32 n. Last build took ' + f(lastMs) + ' ms.' }, finding: 'A B-Tree needs 3 to 5 times fewer node accesses per lookup, which matters when each access is a disk read. In memory the gap shrinks to comparison counts.' };
    },
  });

  EXPERIMENTS.push({
    id: 'tsp',
    title: 'TSP: backtracking vs Branch & Bound as sites increase',
    family: 'Backtracking / Branch and Bound',
    theory: 'Backtracking visits ~(n-1)! partial tours. Branch & Bound prunes with a lower bound but stays exponential in the worst case.',
    xLabel: 'sites n',
    run() {
      const S = { bt: [], dfs: [], bf: [] },
        rows = [];
      let lastMs = 0;
      for (let n = 5; n <= 12; n++) {
        const gph = D.parseEdges(D.genCoordGraph(n, 100 + n, 'S'), false);
        const Dm = D.tspMatrix(gph).D;
        let bt = null,
          t0 = 0;
        if (n <= 10) [bt, t0] = timeIt(() => D.tspBacktrack(Dm, 3e7));
        const [dfs, t1] = timeIt(() => D.tspBnBDFS(Dm, 4e6));
        let bf = null;
        if (n <= 11) bf = D.tspBnBBestFirst(Dm, 3e5, D.BinomialHeap);
        if (bt) S.bt.push([n, bt.nodes]);
        S.dfs.push([n, dfs.nodes]);
        if (bf) S.bf.push([n, bf.nodes]);
        rows.push([n, bt ? f(bt.nodes) : 'skipped', f(dfs.nodes), f(dfs.pruned), bf ? f(bf.nodes) : 'skipped', bf ? f(bf.maxQueue) : '-', f(dfs.best), dfs.optimal ? 'yes' : 'no']);
        lastMs = Math.max(t0, t1);
      }
      const risk = expRisk(S.bt, lastMs, 'states for plain backtracking');
      return { series: [{ name: 'Backtracking states', pts: S.bt }, { name: 'B&B depth-first states', pts: S.dfs }, { name: 'B&B best-first states', pts: S.bf }], theory: { name: '(n-1)! (reference)', fn: (x) => { let r = 1; for (let i = 2; i < x; i++) r *= i; return r; }, anchor: 0 }, head: ['n', 'Backtracking states', 'B&B DFS states', 'B&B pruned', 'B&B best-first states', 'Peak frontier', 'Best cost', 'Proven optimal'], rows, risk, finding: 'Plain backtracking multiplies by about n each step. Bounding cuts the search by one to two orders of magnitude on these instances but does not change its exponential nature. Best-first uses fewer states but stores a frontier that grows.' };
    },
  });

  EXPERIMENTS.push({
    id: 'nq',
    title: 'N-Queen placement: states as the grid grows',
    family: 'Backtracking',
    theory: 'Worst case O(n!) states; conflict pruning removes most of them. Standard N-Queen is not NP-Complete.',
    xLabel: 'grid size n',
    run() {
      const a = [],
        b = [],
        rows = [];
      let lastMs = 0;
      for (let n = 4; n <= 11; n++) {
        const [all, ms] = timeIt(() => D.nqueens(n, false));
        const first = D.nqueens(n, true);
        a.push([n, all.nodes]);
        b.push([n, first.nodes]);
        rows.push([n, f(all.solutions), f(all.nodes), f(all.pruned), f(first.nodes), f(ms)]);
        lastMs = ms;
      }
      return { series: [{ name: 'All layouts: nodes', pts: a }, { name: 'First layout: nodes', pts: b }], theory: { name: 'n! (reference)', fn: (x) => { let r = 1; for (let i = 2; i <= x; i++) r *= i; return r; }, anchor: 0 }, head: ['n', 'Layouts found', 'Nodes (all)', 'Branches pruned', 'Nodes (first layout)', 'ms'], rows, risk: { level: lastMs > 800 ? 'High' : 'Moderate', why: 'Enumerating every layout grows steeply (' + f(a[a.length - 1][1]) + ' nodes at n = 11). Finding one layout stays cheap, so the risk depends on which question is asked.' }, finding: 'Finding the first conflict-free layout needs far fewer states than listing all of them: feasibility is easy, enumeration is expensive.' };
    },
  });

  EXPERIMENTS.push({
    id: 'ham',
    title: 'Hamiltonian cycle: a hard family with no solution',
    family: 'Backtracking',
    theory: 'Decision problem is NP-Complete. A complete graph plus one pendant site has no cycle, but plain backtracking only finds out after exploring almost every path.',
    xLabel: 'sites n',
    run() {
      const pts = [],
        rows = [];
      let lastMs = 0;
      for (let n = 6; n <= 11; n++) {
        const lines = [];
        for (let i = 0; i < n - 1; i++) for (let j = i + 1; j < n - 1; j++) lines.push('v' + i + ' v' + j);
        lines.push('v0 v' + (n - 1));
        const gph = D.parseEdges(lines.join('\n'), false);
        const [h, ms] = timeIt(() => D.hamiltonian(gph, 'cycle', 5e6));
        pts.push([n, h.states]);
        rows.push([n, lines.length, f(h.states), f(h.backtracks), h.found ? 'yes' : h.exhausted ? 'undecided' : 'no cycle', f(ms)]);
        lastMs = ms;
      }
      return { series: [{ name: 'states generated', pts }], theory: { name: '(n-1)! (reference)', fn: (x) => { let r = 1; for (let i = 2; i < x; i++) r *= i; return r; }, anchor: 0 }, head: ['n', 'Links', 'States', 'Dead ends', 'Answer', 'ms'], rows, risk: expRisk(pts, lastMs, 'states'), finding: 'The answer is always "no cycle", yet the search cost multiplies at every step. A cheap degree check (every site needs two links) would end it at once. That check is exactly the kind of pruning rule that exact solvers add.' };
    },
  });

  D.EXPERIMENTS = EXPERIMENTS;
})(typeof window !== 'undefined' ? window : globalThis);
