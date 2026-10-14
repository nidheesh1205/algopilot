/* Algorithm 2035 - autonomous decision engine.
   Pipeline: SCENARIO INPUT -> PROBLEM MODEL -> DAA CHOICE -> EXECUTION -> ANALYSIS -> EXPLANATION
   The engine never receives an algorithm name. It receives a request made of
   structure + properties + data, recognises the problem by rules over those
   properties, then selects, runs and explains a syllabus technique. */
(function (g) {
  'use strict';
  const D = (g.DAA = g.DAA || {});
  const INF = Infinity;
  const fmt = (x) => (typeof x === 'number' && isFinite(x) ? x.toLocaleString('en-US', { maximumFractionDigits: 2 }) : String(x));
  const clamp = (x, a, b) => Math.min(b, Math.max(a, Number(x) || a));
  const log2 = (x) => Math.log(Math.max(2, x)) / Math.LN2;

  /* ------------------------------------------------------------------ */
  /* 1. Problem recognition rules (properties only, never algorithm names) */
  /* ------------------------------------------------------------------ */
  const RULES = [
    { id: 'R1', problem: 'ORDERED_SEARCH', when: 'data = keyed records that must be searched and updated in key order', test: (r) => r.structure === 'records' },
    { id: 'R2', problem: 'DYNAMIC_PRIORITY', when: 'data = events whose priority changes over time', test: (r) => r.structure === 'events' },
    { id: 'R3', problem: 'MST', when: 'data = weighted network AND goal = connect every node at minimum total cost', test: (r) => r.structure === 'network' && r.props.goal === 'connect-all' },
    { id: 'R4', problem: 'APSP', when: 'data = weighted network AND goal = cost between every pair of nodes', test: (r) => r.structure === 'network' && r.props.goal === 'pair-costs' },
    { id: 'R5', problem: 'KNAP_FRAC', when: 'data = items under one budget AND items can be split', test: (r) => r.structure === 'items' && !!r.props.divisible },
    { id: 'R6', problem: 'KNAP_01', when: 'data = items under one budget AND items are all-or-nothing', test: (r) => r.structure === 'items' && !r.props.divisible },
    { id: 'R7', problem: 'MCM', when: 'data = chain of matrices AND goal = cheapest evaluation order', test: (r) => r.structure === 'matrices' },
    { id: 'R8', problem: 'HAMILTON', when: 'data = network AND goal = is there a route visiting every node exactly once', test: (r) => r.structure === 'network' && r.props.goal === 'visit-once' },
    { id: 'R9', problem: 'NQUEEN', when: 'data = grid AND placed items conflict along row, column or diagonal', test: (r) => r.structure === 'grid' && r.props.conflict === 'line-of-sight' },
    { id: 'R10', problem: 'TSP', when: 'data = weighted network AND goal = cheapest round trip through every node', test: (r) => r.structure === 'network' && r.props.goal === 'round-trip' },
  ];
  D.RULES = RULES;

  const TITLES = {
    ORDERED_SEARCH: 'Ordered searchable data',
    DYNAMIC_PRIORITY: 'Mergeable / changing priorities',
    MST: 'Minimum network connection',
    APSP: 'All-pairs costs',
    KNAP_FRAC: 'Divisible resource choice',
    KNAP_01: 'Indivisible resource choice',
    MCM: 'Optimal matrix evaluation order',
    HAMILTON: 'Hamiltonian feasibility',
    NQUEEN: 'Conflict-free placement',
    TSP: 'Minimum complete tour',
  };
  D.TITLES = TITLES;

  /* 10. complexity classification - decision vs optimisation kept separate */
  const CLASS = {
    ORDERED_SEARCH: { kind: 'P', label: 'Polynomial (logarithmic per operation)', decision: 'Is key k stored? Answered in O(log n).', optimization: 'No optimisation form.', note: 'Dictionary operations are cheap; no hardness involved.' },
    DYNAMIC_PRIORITY: { kind: 'P', label: 'Polynomial (amortised logarithmic or better)', decision: 'What is the minimum key? O(1) with a pointer / O(log n) scan.', optimization: 'No optimisation form.', note: 'Priority-queue operations are low-polynomial. Fibonacci bounds are amortised, not worst-case per operation.' },
    MST: { kind: 'P', label: 'Polynomial (P)', decision: 'Is there a spanning tree of cost <= k? In P.', optimization: 'Minimum spanning tree: Prim O(V^2) / Kruskal O(E log E). In P.', note: 'Greedy choice is provably safe (cut property), so no search is needed.' },
    APSP: { kind: 'P', label: 'Polynomial (P)', decision: 'Is d(u,v) <= k? In P.', optimization: 'All-pairs shortest paths: Floyd-Warshall O(V^3), in P. Caveat: with negative cycles the shortest SIMPLE path problem becomes NP-Hard.', note: 'The cubic cost is the limit here, not hardness.' },
    KNAP_FRAC: { kind: 'P', label: 'Polynomial (P)', decision: 'Is value >= V reachable within weight W? In P when items are divisible.', optimization: 'Fractional Knapsack: greedy O(n log n). In P.', note: 'Divisibility turns an NP-Hard problem into a greedy one.' },
    KNAP_01: { kind: 'pseudo', label: 'NP-Hard (optimisation) / NP-Complete (decision) - DP is pseudo-polynomial', decision: 'Is there a subset with value >= V and weight <= W? NP-Complete.', optimization: 'Maximise value: NP-Hard. The O(nW) DP is pseudo-polynomial: W is encoded in log W bits, so the DP is exponential in the input length.', note: 'Practical for modest W, but the table grows with the numeric value of W, not with the number of bits needed to write it.' },
    MCM: { kind: 'P', label: 'Polynomial (P)', decision: 'Is there an order with <= k scalar multiplications? In P.', optimization: 'Matrix-chain order: DP O(n^3) time, O(n^2) space. In P (an O(n log n) algorithm exists, outside this syllabus).', note: 'There are Catalan-many orders, but optimal substructure avoids enumerating them.' },
    HAMILTON: { kind: 'NPC', label: 'NP-Complete (decision form)', decision: 'Does a Hamiltonian cycle / path exist? NP-Complete.', optimization: 'No optimisation form as stated. Adding edge weights and asking for the cheapest cycle gives TSP (NP-Hard).', note: 'Backtracking is exponential in the worst case: O(n!) states.' },
    NQUEEN: { kind: 'other', label: 'Standard N-Queen is NOT labelled NP-Complete', decision: 'Does a solution exist for n x n? Yes for every n >= 4, and one can be built in O(n) by formula.', optimization: 'No optimisation form. Counting all solutions is expensive but that is enumeration, not NP-completeness.', note: 'A related variant, completing a partially filled board, is known to be NP-Complete. The plain board used here is not.' },
    TSP: { kind: 'NPH', label: 'NP-Hard (optimisation) / NP-Complete (decision)', decision: 'Is there a tour of cost <= k? NP-Complete.', optimization: 'Find the cheapest tour: NP-Hard.', note: 'Exact methods are exponential: (n-1)!/2 tours, or O(n^2 2^n) with Held-Karp. Pruning helps in practice, not in the worst case.' },
  };
  D.CLASS = CLASS;

  D.recognise = function (req) {
    const trace = RULES.map((r) => ({ id: r.id, when: r.when, fired: !!r.test(req), problem: r.problem }));
    const hit = trace.find((t) => t.fired);
    return { trace, problem: hit ? hit.problem : null, rule: hit ? hit.id : null };
  };

  /* ------------------------------------------------------------------ */
  /* helpers for result blocks                                           */
  /* ------------------------------------------------------------------ */
  const kv = (title, items) => ({ type: 'kv', title, items });
  const table = (title, head, rows, hl) => ({ type: 'table', title, head, rows, hl });
  const text = (title, html) => ({ type: 'text', title, html });
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const names = (gph, idxs) => idxs.map((i) => gph.names[i]).join(' \u2192 ');

  function catalan(k) {
    let c = 1n;
    for (let i = 0; i < k; i++) c = (c * BigInt(2 * (2 * i + 1))) / BigInt(i + 2);
    return c;
  }
  const big = (b) => (b.toString().length > 18 ? b.toString()[0] + '.' + b.toString().slice(1, 4) + ' x 10^' + (b.toString().length - 1) : b.toLocaleString('en-US'));
  function binom(nn, kk) {
    let r = 1n;
    for (let i = 1n; i <= BigInt(kk); i++) r = (r * (BigInt(nn) - BigInt(kk) + i)) / i;
    return r;
  }
  function factorial(n) {
    let r = 1n;
    for (let i = 2n; i <= BigInt(n); i++) r *= i;
    return r;
  }

  /* ------------------------------------------------------------------ */
  /* 2. Solvers: each does   model -> select -> execute -> explain        */
  /* ------------------------------------------------------------------ */
  const SOLVERS = {};

  /* ---- ordered searchable data: B-Tree vs Red-Black Tree ---- */
  SOLVERS.ORDERED_SEARCH = function (req) {
    const p = req.props;
    const n = clamp(p.records, 200, 150000),
      cap = clamp(p.blockCapacity || 64, 3, 1024);
    const t = Math.max(2, Math.floor((cap + 1) / 2));
    const r = D.rng(11);
    const set = new Set();
    while (set.size < n) set.add(Math.floor(r() * n * 20));
    const keys = [...set];
    const q = n;
    const lookups = [];
    for (let i = 0; i < q; i++) lookups.push(r() < 0.8 ? keys[Math.floor(r() * n)] : -1 - i);

    const rb = new D.RBTree(),
      bt = new D.BTree(t);
    const [, rbInsMs] = D.timed(() => keys.forEach((k, i) => rb.insert(k, i)));
    const rbI = { ...rb.st };
    const [, rbSeaMs] = D.timed(() => lookups.forEach((k) => rb.search(k)));
    const rbS = { visits: rb.st.visits - rbI.visits, cmp: rb.st.cmp - rbI.cmp };
    const [, btInsMs] = D.timed(() => keys.forEach((k, i) => bt.insert(k, i)));
    const btI = { ...bt.st };
    const [, btSeaMs] = D.timed(() => lookups.forEach((k) => bt.search(k)));
    const btS = { visits: bt.st.nodeReads - btI.nodeReads, cmp: bt.st.cmp - btI.cmp };
    const rbH = rb.height(),
      btH = bt.height();

    const disk = p.residency === 'disk';
    const chosen = disk ? 'B-Tree' : 'Red-Black Tree';
    const reasons = disk
      ? [
          'Records live in disk blocks, so the cost that matters is node accesses: one node = one block read.',
          'A B-Tree packs up to ' + (2 * t - 1) + ' keys per block, so its height is ' + btH + ' against ' + rbH + ' for the Red-Black Tree.',
          'Measured: ' + fmt(btS.visits) + ' block reads for ' + fmt(q) + ' lookups with the B-Tree vs ' + fmt(rbS.visits) + ' with the Red-Black Tree (' + (rbS.visits / btS.visits).toFixed(1) + 'x more).',
        ]
      : [
          'Records fit in memory, so the cost that matters is comparisons and pointer hops, not block reads.',
          'A Red-Black Tree uses small binary nodes, at most 2 rotations per insert, and never scans or shifts keys inside a wide node.',
          'Measured: ' + fmt(rbS.cmp) + ' comparisons for ' + fmt(q) + ' lookups (Red-Black) vs ' + fmt(btS.cmp) + ' (B-Tree), with ' + fmt(rb.st.rot) + ' rotations in total for ' + fmt(n) + ' inserts.',
        ];
    const rejected = disk
      ? [{ name: 'Red-Black Tree', reason: 'Binary nodes scatter across blocks: about ' + rbH + ' block reads per lookup instead of ' + btH + '.' }]
      : [{ name: 'B-Tree', reason: 'Wide nodes only pay off when a node access is expensive (disk). In memory they add in-node scanning and key shifting for no gain.' }];
    return {
      model: fmt(n) + ' unique integer keys, ' + fmt(q) + ' lookups (80% hits), ' + (disk ? 'block-resident' : 'memory-resident') + ', ' + cap + ' keys per block',
      choice: { name: chosen, reasons },
      rejected,
      complexity: {
        time: chosen === 'B-Tree' ? 'Search/insert: O(log_t n) node reads, O(t log_t n) = O(log n) comparisons' : 'Search/insert/rebalance: O(log n) worst case, at most 2 rotations per insert',
        space: 'O(n) for both structures',
      },
      blocks: [
        table('Measured on the same workload', ['Metric', 'Red-Black Tree', 'B-Tree (t=' + t + ')'], [
          ['Height', rbH, btH],
          ['Node accesses, ' + fmt(n) + ' inserts', fmt(rbI.visits), fmt(btI.nodeReads)],
          ['Node accesses, ' + fmt(q) + ' lookups', fmt(rbS.visits), fmt(btS.visits)],
          ['Key comparisons (inserts + lookups)', fmt(rbI.cmp + rbS.cmp), fmt(btI.cmp + btS.cmp)],
          ['Rebalancing work', fmt(rb.st.rot) + ' rotations, ' + fmt(rb.st.recolor) + ' recolours', fmt(bt.st.splits) + ' node splits'],
          ['Wall time (ms)', (rbInsMs + rbSeaMs).toFixed(1), (btInsMs + btSeaMs).toFixed(1)],
        ], disk ? 2 : 1),
      ],
      warnings: [],
    };
  };

  /* ---- dynamic priorities: Binomial Heap vs Fibonacci Heap ---- */
  function runHeapWorkload(HeapClass, p) {
    const n = clamp(p.events, 100, 40000),
      share = clamp(p.decreaseShare, 0, 100) / 100;
    const r = D.rng(5);
    const h = new HeapClass();
    const live = [];
    const cost = { ins: 0, dec: 0, ext: 0, mrg: 0 },
      cnt = { ins: 0, dec: 0, ext: 0, mrg: 0 };
    let w = h.work;
    const lap = (k) => {
      const x = h.work;
      cost[k] += x - w;
      w = x;
      cnt[k]++;
    };
    const add = (it) => {
      it.pos = live.length;
      live.push(it);
    };
    for (let i = 0; i < n; i++) {
      add(h.insert(1000 + r() * 1e6, i));
      lap('ins');
    }
    let minSeen = 1000;
    const M = 2 * n;
    for (let op = 0; op < M; op++) {
      if (r() < share && live.length) {
        const it = live[Math.floor(r() * live.length)];
        minSeen -= 1 + r() * 10; /* an escalation: the event jumps to the front of the queue */
        h.decreaseKey(it, minSeen);
        lap('dec');
      } else if (h.n > 0) {
        const it = h.extractMin();
        lap('ext');
        const last = live.pop();
        if (last !== it) {
          live[it.pos] = last;
          last.pos = it.pos;
        }
      }
    }
    if (p.merge) {
      const h2 = new HeapClass();
      for (let i = 0; i < Math.floor(n / 2); i++) h2.insert(2e6 + r() * 1e6, i);
      const before = h.work;
      h.merge(h2);
      cost.mrg += h.work - before;
      cnt.mrg++;
      w = h.work;
    }
    while (h.n > 0) {
      h.extractMin();
      lap('ext');
    }
    return { cost, cnt, total: cost.ins + cost.dec + cost.ext + cost.mrg, st: { ...h.st } };
  }
  D.runHeapWorkload = runHeapWorkload;

  SOLVERS.DYNAMIC_PRIORITY = function (req) {
    const p = req.props;
    const share = clamp(p.decreaseShare, 0, 100);
    const bin = runHeapWorkload(D.BinomialHeap, p),
      fib = runHeapWorkload(D.FibHeap, p);
    let chosen, why;
    if (p.realtime) {
      chosen = 'Binomial Heap';
      why = 'The workload needs a worst-case bound on every single operation. Binomial Heap guarantees O(log n) each; Fibonacci Heap bounds are amortised and one extract-min can take O(n).';
    } else if (share >= 30 || (share >= 10 && p.merge)) {
      chosen = 'Fibonacci Heap';
      why = share >= 30 ? share + '% of operations are decrease-key. Fibonacci Heap does decrease-key in amortised O(1) (cut), Binomial Heap pays O(log n) swaps up the tree each time.' : 'Decrease-key is frequent (' + share + '%) and queues must be merged: Fibonacci Heap merges in O(1) and decreases in amortised O(1).';
    } else {
      chosen = 'Binomial Heap';
      why = 'Only ' + share + '% of operations are decrease-key, so the Fibonacci advantage is small. Binomial Heap has lower constants, simple structure and worst-case O(log n) per operation.';
    }
    const isFib = chosen === 'Fibonacci Heap';
    const pick = isFib ? fib : bin,
      other = isFib ? bin : fib;
    const reasons = [
      why,
      'Measured on this workload: ' + fmt(pick.total) + ' elementary steps for ' + chosen + ' vs ' + fmt(other.total) + ' for the alternative' + (pick.total <= other.total ? ' (' + (other.total / pick.total).toFixed(2) + 'x more).' : '. The alternative is cheaper here, which shows the rule is a trade-off, not a guarantee.'),
    ];
    const row = (label, k) => [label + ' (' + fmt(bin.cnt[k]) + ' ops)', fmt(bin.cost[k]), fmt(fib.cost[k])];
    const rows = [row('Insert', 'ins'), row('Decrease-key', 'dec'), row('Extract-min', 'ext')];
    if (p.merge) rows.push(['Merge (' + fmt(Math.floor(clamp(p.events, 100, 40000) / 2)) + ' items joined)', fmt(bin.cost.mrg), fmt(fib.cost.mrg)]);
    rows.push(['Total elementary steps', fmt(bin.total), fmt(fib.total)]);
    return {
      model: fmt(clamp(p.events, 100, 40000)) + ' events, ' + share + '% of mixed operations are priority escalations' + (p.merge ? ', queues merged' : '') + (p.realtime ? ', hard real-time' : ''),
      choice: { name: chosen, reasons },
      rejected: [{ name: isFib ? 'Binomial Heap' : 'Fibonacci Heap', reason: isFib ? 'Decrease-key costs O(log n) swaps each; this is exactly the operation that dominates the workload.' : p.realtime ? 'Amortised bounds allow occasional very expensive operations, which a real-time system cannot accept.' : 'Lazy structure and cascading cuts carry higher constants and only pay off when decrease-key or merge dominate.' }],
      complexity: {
        time: isFib ? 'Insert O(1), merge O(1), decrease-key O(1) amortised, extract-min O(log n) amortised' : 'Insert O(1) amortised, merge O(log n), decrease-key O(log n), extract-min O(log n) worst case',
        space: 'O(n)',
      },
      blocks: [table('Elementary steps (comparisons + links + swaps + cuts)', ['Operation', 'Binomial Heap', 'Fibonacci Heap'], rows, isFib ? 2 : 1)],
      warnings: [],
    };
  };

  /* ---- minimum network connection: Prim vs Kruskal ---- */
  SOLVERS.MST = function (req) {
    const gph = D.parseEdges(req.data.edges, false);
    if (gph.n < 2) throw new Error('Give at least two sites and one link.');
    const V = gph.n,
      E = gph.edges.filter((e) => e.u !== e.v).length;
    const maxE = (V * (V - 1)) / 2;
    const density = E / maxE;
    const estPrim = V * V * 2,
      estKr = E * log2(E) + E * 2;
    const choosePrim = estPrim <= estKr;
    const [pr, pMs] = D.timed(() => D.prim(gph));
    const [kr, kMs] = D.timed(() => D.kruskal(gph));
    const win = choosePrim ? pr : kr;
    const warnings = [];
    if (!win.connected) warnings.push('The network is not connected, so no spanning tree exists. Showing the minimum spanning forest of the component(s) reached.');
    if (pr.connected && kr.connected && Math.abs(pr.total - kr.total) > 1e-9) warnings.push('Internal check failed: Prim and Kruskal disagree.');
    const chosen = choosePrim ? 'Prim (adjacency matrix)' : 'Kruskal (sort + union-find)';
    const reasons = [
      'Graph has ' + V + ' sites and ' + E + ' candidate links: density ' + (density * 100).toFixed(1) + '% of the ' + fmt(maxE) + ' possible links.',
      'Cost model: Prim with a matrix ~ 2V^2 = ' + fmt(estPrim) + ' steps; Kruskal ~ E log2 E + 2E = ' + fmt(Math.round(estKr)) + ' steps. The ' + (choosePrim ? 'matrix-based Prim' : 'edge-sorting Kruskal') + ' estimate is lower.',
      'Measured: Prim ' + fmt(pr.ops) + ' steps, Kruskal ' + fmt(kr.ops) + ' steps. Both give total cost ' + fmt(win.total) + '.',
    ];
    return {
      model: 'Undirected weighted graph: V = ' + V + ', E = ' + E + ', density ' + (density * 100).toFixed(1) + '%',
      choice: { name: chosen, reasons },
      rejected: [
        {
          name: choosePrim ? 'Kruskal' : 'Prim (adjacency matrix)',
          reason: choosePrim ? 'Sorting ' + fmt(E) + ' edges costs more than scanning a V x V matrix when the graph is dense.' : 'Scanning the V x V matrix costs V^2 regardless of how few links exist; Kruskal only touches the ' + fmt(E) + ' real links.',
        },
      ],
      complexity: {
        time: choosePrim ? 'Prim with matrix: O(V^2). (With a Fibonacci heap it would be O(E + V log V).)' : 'Kruskal: O(E log E) = O(E log V)',
        space: choosePrim ? 'O(V^2) for the matrix' : 'O(V + E)',
      },
      blocks: [
        kv('Network', [['Total cost of the spanning tree', fmt(win.total)], ['Links chosen', win.edges.length + ' of ' + (V - 1) + ' needed'], ['Prim and Kruskal agree', pr.total === kr.total ? 'yes' : 'no']]),
        table('Cost estimate vs measurement', ['', 'Prim (matrix)', 'Kruskal'], [['Estimated steps', fmt(estPrim), fmt(Math.round(estKr))], ['Measured steps', fmt(pr.ops), fmt(kr.ops)], ['Wall time (ms)', pMs.toFixed(2), kMs.toFixed(2)]], choosePrim ? 1 : 2),
        table('Links in the cheapest network' + (win.edges.length > 40 ? ' (first 40)' : ''), ['From', 'To', 'Cost'], win.edges.slice(0, 40).map((e) => [gph.names[e[0]], gph.names[e[1]], fmt(e[2])])),
      ],
      warnings,
    };
  };

  /* ---- all-pairs costs: Floyd-Warshall ---- */
  SOLVERS.APSP = function (req) {
    const gph = D.parseEdges(req.data.edges, !!req.props.directed);
    if (gph.n < 2) throw new Error('Give at least two zones and one link.');
    const [fw, ms] = D.timed(() => D.floydWarshall(gph));
    const V = gph.n;
    const warnings = [];
    if (fw.negCycle) warnings.push('A negative cycle exists, so shortest costs are not well defined for nodes on it.');
    let unreachable = 0;
    for (let i = 0; i < V; i++) for (let j = 0; j < V; j++) if (fw.d[i][j] === INF) unreachable++;
    if (unreachable) warnings.push(unreachable + ' zone pair(s) cannot reach each other (shown as -).');
    const blocks = [];
    if (V <= 14)
      blocks.push(table('All-pairs cost matrix (row = from, column = to)', [''].concat(gph.names), fw.d.map((row, i) => [gph.names[i]].concat(row.map((x) => (x === INF ? '-' : fmt(x)))))));
    else blocks.push(text('Matrix', '<p>' + V + ' x ' + V + ' matrix computed (' + fmt(V * V) + ' entries); too large to print here.</p>'));
    const samples = [];
    for (let j = 1; j < V && samples.length < 5; j++) {
      const pth = D.fwPath(fw, 0, j);
      if (pth) samples.push([gph.names[0] + ' \u2192 ' + gph.names[j], fmt(fw.d[0][j]), names(gph, pth)]);
    }
    if (samples.length) blocks.push(table('Cheapest routes from ' + gph.names[0], ['Pair', 'Cost', 'Route'], samples));
    blocks.push(kv('Scaling', [['Relaxations at V = ' + V, fmt(fw.ops)], ['If zones double (V = ' + 2 * V + ')', fmt(8 * fw.ops) + ' (8x)'], ['Wall time (ms)', ms.toFixed(2)]]));
    return {
      model: (gph.directed ? 'Directed' : 'Undirected') + ' weighted graph with ' + V + ' zones and ' + gph.edges.length + ' links; every pair of zones needs a cost',
      choice: {
        name: 'Floyd-Warshall',
        reasons: [
          'The goal is a cost for EVERY pair of zones, so a single answer table is needed, not one source or one tree.',
          'Dynamic programming over intermediate zones fills the whole table in V^3 = ' + fmt(V * V * V) + ' relaxations and handles one-way links and negative costs.',
        ],
      },
      rejected: [
        { name: 'Prim / Kruskal', reason: 'A minimum spanning tree minimises the total cost of connecting everything, it does not give the cheapest route between two particular zones.' },
        { name: 'Backtracking / TSP search', reason: 'They answer visit-all questions, which is a different (NP-Hard) problem.' },
      ],
      complexity: { time: 'O(V^3)', space: 'O(V^2)' },
      blocks,
      warnings,
    };
  };

  /* ---- knapsack: Fractional (greedy) vs 0/1 (DP) ---- */
  function knapSolver(req, divisible) {
    const items = D.parseItems(req.data.items);
    const W = Number(req.data.capacity);
    if (!isFinite(W) || W <= 0) throw new Error('Budget / capacity must be a positive number.');
    const fr = D.knapFractional(items, W);
    const warnings = [];
    let dp = null;
    try {
      dp = D.knap01(items, W);
    } catch (e) {
      warnings.push(e.message);
    }
    const gr = D.knapGreedy01(items, W);
    const n = items.length;
    const totalW = items.reduce((s, i) => s + i.weight, 0);
    if (totalW <= W) warnings.push('Everything fits in the budget, so no selection is needed.');
    const blocks = [];
    if (divisible) {
      blocks.push(table('Greedy by value per unit of weight', ['Item', 'Share taken', 'Value', 'Weight used'], fr.picks.map((x) => [x.name, (x.fraction * 100).toFixed(0) + '%', fmt(x.value), fmt(x.weight)])));
      blocks.push(kv('Result', [['Total value', fmt(fr.value)], ['Budget used', fmt(fr.used) + ' of ' + fmt(W)], ['If the same items were all-or-nothing', dp ? fmt(dp.value) + ' (0/1 optimum)' : 'DP table too large']]));
    } else if (dp) {
      blocks.push(table('Chosen items (0/1)', ['Item', 'Value', 'Weight'], dp.chosen.map((x) => [x.name, fmt(x.value), fmt(x.weight)])));
      blocks.push(kv('Result', [['Total value', fmt(dp.value)], ['Budget used', fmt(dp.weight) + ' of ' + fmt(W)], ['DP table', fmt(dp.cells) + ' cells (n x capacity)'], ['Greedy by ratio would give', fmt(gr.value) + (gr.value < dp.value ? ' (worse by ' + fmt(dp.value - gr.value) + ')' : ' (ties on this instance only)')], ['Fractional upper bound', fmt(fr.value)]]));
    }
    const nm = divisible ? 'Fractional Knapsack (greedy)' : '0/1 Knapsack (dynamic programming)';
    const reasons = divisible
      ? ['Items can be split, so taking the best value-per-weight first can never be improved on (exchange argument).', 'No table is needed: sort by ratio, then fill. ' + fmt(fr.ops) + ' steps for ' + n + ' items.']
      : ['Items are all-or-nothing, so a locally best ratio can block a better combination.', dp ? (gr.value < dp.value ? 'Proof on this data: greedy-by-ratio gets ' + fmt(gr.value) + ' but the DP optimum is ' + fmt(dp.value) + '.' : 'Greedy happens to tie here, but nothing guarantees that; the DP always finds the optimum.') : 'The DP could not be built for this capacity (see warning).'];
    return {
      model: n + ' items (value, weight), budget ' + fmt(W) + ', items ' + (divisible ? 'divisible' : 'indivisible'),
      choice: { name: nm, reasons },
      rejected: divisible
        ? [{ name: '0/1 Knapsack DP', reason: 'Would force whole items, so it gives a lower value' + (dp ? ' (' + fmt(dp.value) + ' vs ' + fmt(fr.value) + ')' : '') + ' and costs O(nW) instead of O(n log n).' }]
        : [{ name: 'Fractional Knapsack (greedy)', reason: 'Splits items, which is not allowed here; its value ' + fmt(fr.value) + ' is only an upper bound and is not achievable.' }, { name: 'Greedy by ratio on whole items', reason: 'No optimality guarantee for 0/1 choices.' }, { name: 'Brute force over 2^n subsets', reason: '2^' + n + ' = ' + fmt(Math.pow(2, n)) + ' subsets; DP needs ' + (dp ? fmt(dp.cells) : 'n x W') + ' cells.' }],
      complexity: divisible ? { time: 'O(n log n) (sorting dominates)', space: 'O(n)' } : { time: 'O(nW) - pseudo-polynomial', space: 'O(nW) with reconstruction (O(W) for the value only)' },
      blocks,
      warnings,
    };
  }
  SOLVERS.KNAP_FRAC = (req) => knapSolver(req, true);
  SOLVERS.KNAP_01 = (req) => knapSolver(req, false);

  /* ---- matrix chain multiplication ---- */
  SOLVERS.MCM = function (req) {
    const p = D.parseNumbers(req.data.dims);
    if (p.length < 3) throw new Error('Give at least three dimensions (two matrices), e.g. 10 30 5 60.');
    if (p.some((x) => x <= 0 || !Number.isInteger(x))) throw new Error('Dimensions must be positive whole numbers.');
    const [res, ms] = D.timed(() => D.mcm(p));
    const best = Math.min(res.leftToRight, res.rightToLeft);
    const saving = res.leftToRight > 0 ? (1 - res.cost / res.leftToRight) * 100 : 0;
    const ord = res.n - 1 <= 60 ? big(catalan(res.n - 1)) : 'astronomically many';
    return {
      model: res.n + ' matrices A1..A' + res.n + ', dimensions ' + (p.length > 12 ? p.slice(0, 12).join(' x ') + ' ...' : p.join(' x ')) + '; operation count is the proxy for CPU load',
      choice: {
        name: 'Matrix Chain Multiplication (dynamic programming)',
        reasons: [
          'Multiplication is associative, so every bracketing gives the same matrix but a different scalar-multiplication count. There are ' + ord + ' bracketings.',
          'Optimal substructure: the best order for A_i..A_j splits at some k into two best sub-chains, so a table over (i, j) replaces enumeration.',
        ],
      },
      rejected: [
        { name: 'Left-to-right order', reason: 'Costs ' + fmt(res.leftToRight) + ' scalar multiplications' + (res.leftToRight > res.cost ? ' (' + (res.leftToRight / res.cost).toFixed(2) + 'x the optimum).' : ' (happens to be optimal here).') },
        { name: 'Try every bracketing', reason: ord + ' orders to evaluate.' },
      ],
      complexity: { time: 'O(n^3): ' + fmt(res.ops) + ' split evaluations for n = ' + res.n, space: 'O(n^2) cost and split tables' },
      blocks: [
        kv('Result', [['Best order', res.paren], ['Scalar multiplications (optimal)', fmt(res.cost)], ['Left-to-right', fmt(res.leftToRight)], ['Right-to-left', fmt(res.rightToLeft)], ['Work saved vs left-to-right', saving.toFixed(1) + '%'], ['Wall time (ms)', ms.toFixed(2)]]),
      ],
      warnings: [],
    };
  };

  /* ---- Hamiltonian feasibility ---- */
  SOLVERS.HAMILTON = function (req) {
    const gph = D.parseEdges(req.data.edges, !!req.props.directed);
    if (gph.n < 2) throw new Error('Give at least two sites and one link.');
    const mode = req.props.visitMode === 'path' ? 'path' : 'cycle';
    const [r, ms] = D.timed(() => D.hamiltonian(gph, mode, 5e6));
    const warnings = [];
    if (r.exhausted) warnings.push('Search stopped at the 5,000,000-state budget, so the answer is undecided. This is the exponential blow-up.');
    const blocks = [];
    if (r.found) blocks.push(kv('Answer', [['Feasible?', 'Yes'], [mode === 'cycle' ? 'Closed route' : 'Route', names(gph, r.found) + (mode === 'cycle' ? ' \u2192 ' + gph.names[r.found[0]] : '')]]));
    else blocks.push(kv('Answer', [['Feasible?', r.exhausted ? 'Undecided (budget hit)' : 'No ' + (mode === 'cycle' ? 'Hamiltonian cycle' : 'Hamiltonian path') + ' exists']]));
    blocks.push(kv('Search effort', [['States generated', fmt(r.states)], ['Dead ends (backtracks)', fmt(r.backtracks)], ['Wall time (ms)', ms.toFixed(2)], ['Worst-case states for n = ' + gph.n, gph.n <= 20 ? big(factorial(gph.n)) : 'n! (astronomical)']]));
    return {
      model: (gph.directed ? 'Directed' : 'Undirected') + ' graph, ' + gph.n + ' sites, ' + gph.edges.length + ' links; decide whether one route can visit each site exactly once (' + (mode === 'cycle' ? 'returning to the start' : 'free end point') + ')',
      choice: {
        name: 'Backtracking',
        reasons: ['This is a feasibility question, not a cost question: extend a partial route one site at a time, and undo the last step when no unvisited neighbour remains.', 'Each dead end prunes every completion below it: ' + fmt(r.backtracks) + ' dead ends were cut off in ' + fmt(r.states) + ' states.'],
      },
      rejected: [
        { name: 'Enumerate all n! permutations', reason: 'Backtracking checks adjacency while building, so it abandons impossible prefixes early.' },
        { name: 'Prim / Kruskal / Floyd-Warshall', reason: 'They connect or measure; none of them can decide whether a single route covers every node once.' },
      ],
      complexity: { time: 'O(n!) worst case (about n * (n-1)! states)', space: 'O(n) recursion depth plus visited flags' },
      blocks,
      warnings,
    };
  };

  /* ---- N-Queen style placement ---- */
  SOLVERS.NQUEEN = function (req) {
    const n = clamp(req.props.size, 1, 14);
    const first = D.nqueens(n, true);
    const all = n <= 11 ? D.nqueens(n, false) : null;
    const warnings = [];
    if (n === 2 || n === 3) warnings.push('No conflict-free placement exists for ' + n + ' x ' + n + '.');
    const blocks = [];
    if (first.first) blocks.push({ type: 'board', n, pos: first.first, title: 'Conflict-free sensor layout (one per row, none sharing a column or diagonal)' });
    const kvs = [['Grid', n + ' x ' + n + ' city blocks, ' + n + ' sensors'], ['Nodes explored to the first layout', fmt(first.nodesToFirst || first.nodes)]];
    if (all) kvs.push(['All distinct layouts', fmt(all.solutions) + ' (explored ' + fmt(all.nodes) + ' nodes, pruned ' + fmt(all.pruned) + ' branches)']);
    else kvs.push(['All distinct layouts', 'not counted for n > 11']);
    kvs.push(['Brute-force placements C(n^2, n)', n <= 14 ? big(binom(n * n, n)) : 'astronomical']);
    blocks.push(kv('Search effort', kvs));
    return {
      model: n + ' x ' + n + ' grid of city blocks; two transmitters interfere if they share a row, column or diagonal; place ' + n + ' with no interference',
      choice: { name: 'Backtracking', reasons: ['Place one sensor per row and test only the new sensor against used columns and diagonals.', 'A conflict rejects the whole subtree of placements below it: ' + fmt(first.pruned) + ' branches pruned before the first layout was found.'] },
      rejected: [
        { name: 'Try every placement of n sensors', reason: big(binom(n * n, n)) + ' placements for n = ' + n + '.' },
        { name: 'Branch & Bound', reason: 'There is no cost to bound; the question is pure feasibility.' },
      ],
      complexity: { time: 'O(n!) worst case, far fewer states in practice because conflicts prune early', space: 'O(n) for the partial layout and conflict flags' },
      blocks,
      warnings,
    };
  };

  /* ---- Travelling salesperson ---- */
  SOLVERS.TSP = function (req) {
    const gph = D.parseEdges(req.data.edges, false);
    const n = gph.n;
    if (n < 3) throw new Error('A tour needs at least three sites.');
    if (n > 25) throw new Error('This demo holds at most 25 sites for TSP.');
    const tm = D.tspMatrix(gph);
    if (!tm.feasible) throw new Error('The network is not connected, so no tour can reach every site.');
    const Dm = tm.D;
    const rows = [];
    const run = (label, fn) => {
      const [r, ms] = D.timed(fn);
      rows.push({ label, r, ms });
      return r;
    };
    let bt = null;
    if (n <= 10) bt = run('Backtracking (no bound)', () => D.tspBacktrack(Dm, 3e7));
    const dfs = run('Branch & Bound, depth-first', () => D.tspBnBDFS(Dm, 4e6));
    let bf = null,
      bff = null;
    if (n <= 13) {
      bf = run('Branch & Bound, best-first (Binomial Heap queue)', () => D.tspBnBBestFirst(Dm, 3e5, D.BinomialHeap));
      bff = run('Branch & Bound, best-first (Fibonacci Heap queue)', () => D.tspBnBBestFirst(Dm, 3e5, D.FibHeap));
    }
    const warnings = [];
    if (tm.closure) warnings.push('Some site pairs had no direct link; their cost was filled with the cheapest connection found by Floyd-Warshall (so the tour may pass through other sites).');
    if (!dfs.optimal) warnings.push('Search hit its state budget, so the tour below is the best found, not proven optimal. This is the NP-Hard growth showing itself.');
    if (n > 13) warnings.push('Above 13 sites the framework runs only the depth-first Branch & Bound; the other methods would exceed their state or memory budgets.');
    const space = n <= 20 ? big(factorial(n - 1) / 2n) : '(n-1)!/2';
    const blocks = [];
    blocks.push(kv('Cheapest tour', [['Cost', fmt(dfs.best)], ['Route', names(gph, dfs.path) + ' \u2192 ' + gph.names[dfs.path[0]]], ['Proven optimal', dfs.optimal ? 'yes' : 'no (budget reached)'], ['Possible tours (n-1)!/2', space]]));
    blocks.push(table('Exact methods compared on this instance', ['Method', 'States expanded', 'Pruned', 'Peak frontier', 'Cost found', 'ms'], rows.map((x) => [x.label, fmt(x.r.nodes), fmt(x.r.pruned), x.r.maxQueue ? fmt(x.r.maxQueue) : '-', fmt(x.r.best), x.ms.toFixed(1)]), bt ? 2 : 1));
    return {
      headline: n + ' sites: ' + rows.length + ' exact method' + (rows.length > 1 ? 's' : '') + ' run; depth-first Branch & Bound expanded ' + fmt(dfs.nodes) + ' states' + (dfs.optimal ? '' : ' and stopped at its budget (not proven optimal)') + '.',
      model: n + ' sites, complete cost matrix' + (tm.closure ? ' (gaps closed with Floyd-Warshall)' : '') + '; one vehicle visits every site once and returns to the start; minimise total cost',
      choice: {
        name: 'Branch & Bound (depth-first, min-edge lower bound)',
        reasons: [
          'This is a cost-minimisation over complete tours, so feasibility pruning alone is not enough: a partial tour is also abandoned when its cost plus an optimistic bound already reaches the best tour found.',
          bt ? 'Measured: plain backtracking expanded ' + fmt(bt.nodes) + ' states, depth-first Branch & Bound ' + fmt(dfs.nodes) + ' (' + (bt.nodes / dfs.nodes).toFixed(1) + 'x fewer).' : 'Plain backtracking is skipped above 10 sites: ' + space + ' tours.',
          'Depth-first keeps memory at O(n); best-first reaches the same optimum' + (bf ? ' with a frontier of up to ' + fmt(bf.maxQueue) + ' stored states' : '') + '.',
        ],
      },
      rejected: [
        { name: 'Backtracking without a bound', reason: 'Every one of the (n-1)! orderings is visited; no partial tour is ever dropped for being too expensive.' },
        { name: 'Prim / Kruskal', reason: 'An MST is a tree, not a closed tour; it only provides a lower-bound idea.' },
        { name: 'Best-first Branch & Bound', reason: 'Needs a heap frontier that grows with the search; fine for small n, memory-heavy beyond about 13 sites.' },
      ],
      complexity: { time: 'O(n!) worst case for both; bounding shrinks the practical search, not the worst case', space: 'Depth-first: O(n). Best-first: exponential frontier in the worst case.' },
      blocks,
      warnings,
    };
  };

  /* ------------------------------------------------------------------ */
  /* 3. Public entry point                                               */
  /* ------------------------------------------------------------------ */
  D.solve = function (req) {
    const t0 = D.now();
    try {
      const rec = D.recognise(req);
      if (!rec.problem) return { error: 'No rule matched these properties. Check the structure and goal.', trace: rec.trace };
      const t1 = D.now();
      const out = SOLVERS[rec.problem](req);
      const t2 = D.now();
      return Object.assign(out, { headline: out.headline || out.choice.reasons[out.choice.reasons.length - 1], problem: rec.problem, title: TITLES[rec.problem], rule: rec.rule, trace: rec.trace, cls: CLASS[rec.problem], timing: { recognise: t1 - t0, execute: t2 - t1 } });
    } catch (e) {
      return { error: e.message, trace: D.recognise(req).trace };
    }
  };

  /* ------------------------------------------------------------------ */
  /* 4. Smart-city scenarios and the adaptation demos                    */
  /* ------------------------------------------------------------------ */
  D.genGraph = function (n, m, seed, prefix, wmax) {
    const r = D.rng(seed);
    prefix = prefix || 'N';
    wmax = wmax || 50;
    const seen = new Set(),
      lines = [];
    const add = (a, b) => {
      const k = a < b ? a + '-' + b : b + '-' + a;
      if (a === b || seen.has(k)) return false;
      seen.add(k);
      lines.push(prefix + a + ' ' + prefix + b + ' ' + (1 + Math.floor(r() * wmax)));
      return true;
    };
    for (let i = 1; i < n; i++) add(i, Math.floor(r() * i));
    const target = Math.min(m, (n * (n - 1)) / 2);
    while (lines.length < target) add(Math.floor(r() * n), Math.floor(r() * n));
    return lines.join('\n');
  };
  D.genCoordGraph = function (n, seed, prefix) {
    const r = D.rng(seed);
    prefix = prefix || 'S';
    const pts = Array.from({ length: n }, () => [Math.floor(r() * 100), Math.floor(r() * 100)]);
    const lines = [];
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) lines.push(prefix + (i + 1) + ' ' + prefix + (j + 1) + ' ' + Math.round(Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1])));
    return lines.join('\n');
  };

  const ITEMS_PROJ = ['SolarStreetlights 60 10', 'BusLaneUpgrade 100 20', 'WaterSensors 120 30', 'CCTVRefresh 50 15', 'EVChargers 90 25', 'FibreToSchools 70 12'].join('\n');
  const mk = (id, title, scenario, structure, props, data) => ({ id, title, scenario, req: { structure, props, data: data || {} } });

  D.PRESETS = [
    mk('p1', 'City asset registry (in memory)', 'The control room keeps 20,000 street-asset records in RAM and needs fast lookup and insert by asset ID.', 'records', { records: 20000, residency: 'memory', blockCapacity: 64 }),
    mk('p1b', 'Citizen permit archive (on disk)', 'Two million permit records live on disk and are fetched by permit number. Each disk read is slow.', 'records', { records: 20000, residency: 'disk', blockCapacity: 64 }),
    mk('p2', 'Emergency dispatch queue', 'Incident priorities escalate constantly as new reports arrive. Most operations raise an existing incident to the front.', 'events', { events: 4000, decreaseShare: 60, merge: false, realtime: false }),
    mk('p2b', 'Overnight billing batch queue', 'Utility bills are queued once and processed in order. Priorities almost never change.', 'events', { events: 4000, decreaseShare: 5, merge: false, realtime: false }),
    mk('p3', 'Fibre backbone, sparse districts', 'Connect 40 city sites with fibre. Only 70 trenching routes are legally possible.', 'network', { goal: 'connect-all', directed: false }, { edges: D.genGraph(40, 70, 3, 'Site', 90) }),
    mk('p3b', 'Fibre backbone, dense downtown', 'Connect 40 downtown buildings. Almost every pair can be linked directly.', 'network', { goal: 'connect-all', directed: false }, { edges: D.genGraph(40, 700, 4, 'Bldg', 90) }),
    mk('p4', 'Metro zone travel costs', 'Planners need the cheapest travel cost between every pair of 7 zones. Some links are one-way.', 'network', { goal: 'pair-costs', directed: true }, { edges: ['North East 4', 'East South 6', 'South West 3', 'West North 5', 'North Centre 2', 'Centre South 2', 'Centre Harbour 7', 'Harbour South 1', 'East Airport 8', 'Airport Centre 3', 'West Centre 4'].join('\n') }),
    mk('p5', 'Park renovation hours (divisible)', 'A crew has 120 hours. Each project gives value per hour and can be partly done in any proportion.', 'items', { divisible: true }, { items: ['Playground 90 30', 'RiverPath 60 40', 'Lighting 70 20', 'Benches 20 10', 'Garden 100 50'].join('\n'), capacity: '120' }),
    mk('p5b', 'Smart-city upgrades (indivisible)', 'Six upgrades must each be funded fully or not at all. The budget is 36 units.', 'items', { divisible: false }, { items: ITEMS_PROJ, capacity: '36' }),
    mk('p6', 'Analytics matrix pipeline', 'A server evaluates A1 x A2 x A3 x A4 x A5 x A6. Operation count is the CPU-load proxy.', 'matrices', {}, { dims: '30 35 15 5 10 20 25' }),
    mk('p7', 'Ambulance corridor check', 'Can one inspection patrol cover all 9 junctions exactly once and return to its depot?', 'network', { goal: 'visit-once', directed: false, visitMode: 'cycle' }, { edges: ['J6 J1', 'J9 J1', 'J9 J3', 'J7 J8', 'J8 J9', 'J1 J2', 'J4 J5', 'J5 J9', 'J3 J4', 'J5 J6', 'J2 J3', 'J4 J9', 'J6 J7'].join('\n') }),
    mk('p8', 'Radio-sensor placement', 'Place 8 transmitters on an 8 x 8 block grid. Two interfere if they share a row, column or diagonal.', 'grid', { conflict: 'line-of-sight', size: 8 }),
    mk('p9', 'Substation inspection tour', 'One engineer must visit 9 substations once and return to the depot at minimum travel cost.', 'network', { goal: 'round-trip', directed: false }, { edges: D.genCoordGraph(9, 21, 'Sub') }),
  ];
  D.preset = (id) => JSON.parse(JSON.stringify(D.PRESETS.find((p) => p.id === id)));

  const cl = (o) => JSON.parse(JSON.stringify(o));
  const withProps = (req, patch, data) => {
    const r = cl(req);
    Object.assign(r.props, patch);
    if (data) Object.assign(r.data, data);
    return r;
  };
  const P = (id) => D.preset(id).req;
  D.ADAPTATIONS = [
    { id: 'a1', title: 'Same project list, splittable or not', changed: 'items divisible: yes \u2192 no', a: ['Divisible', withProps(P('p5b'), { divisible: true })], b: ['Indivisible', P('p5b')] },
    { id: 'a2', title: 'Same 40 sites, sparse or dense link set', changed: 'candidate links: 70 \u2192 700', a: ['Sparse (70 links)', P('p3')], b: ['Dense (700 links)', P('p3b')] },
    { id: 'a3', title: 'Same records, memory or disk', changed: 'residency: memory \u2192 disk', a: ['In memory', P('p1')], b: ['On disk', P('p1b')] },
    { id: 'a4', title: 'Same queue, rare or constant escalations', changed: 'decrease-key share: 5% \u2192 60%', a: ['5% escalations', P('p2b')], b: ['60% escalations', P('p2')] },
    { id: 'a5', title: 'Same network, different question', changed: 'goal: connect all \u2192 round trip \u2192 pair costs', a: ['Connect all', withProps(P('p9'), { goal: 'connect-all' })], b: ['Round trip', P('p9')], c: ['Pair costs', withProps(P('p9'), { goal: 'pair-costs' })] },
    { id: 'a6', title: 'Same hard-real-time queue', changed: 'worst-case guarantee needed: no \u2192 yes', a: ['Average cost matters', P('p2')], b: ['Hard real-time', withProps(P('p2'), { realtime: true })] },
    { id: 'a7', title: 'Tour size grows', changed: 'sites: 9 \u2192 14', a: ['9 sites', P('p9')], b: ['14 sites', withProps(P('p9'), {}, { edges: D.genCoordGraph(14, 33, 'Sub') })] },
  ];
})(typeof window !== 'undefined' ? window : globalThis);
