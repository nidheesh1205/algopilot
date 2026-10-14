/* Algorithm 2035 - built-in correctness tests (run in the browser or with node). */
(function (g) {
  'use strict';
  const D = (g.DAA = g.DAA || {});
  D.runTests = function () {
    const out = [];
    const T = (name, fn) => {
      try {
        const r = fn();
        out.push({ name, pass: r === true, detail: r === true ? '' : String(r) });
      } catch (e) {
        out.push({ name, pass: false, detail: e.message });
      }
    };
    const r = D.rng(7);
    const keys = [];
    for (let i = 0; i < 3000; i++) keys.push(Math.floor(r() * 1e6));
    const uniq = [...new Set(keys)].sort((a, b) => a - b);
    const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

    T('Red-Black Tree: in-order is sorted, colour rules and black-height hold', () => {
      const t = new D.RBTree();
      keys.forEach((k, i) => t.insert(k, i));
      return same(t.inorder(), uniq) && t.validate() > 0 && keys.every((k) => t.search(k) !== undefined);
    });
    T('Red-Black Tree: height <= 2 log2(n+1)', () => {
      const t = new D.RBTree();
      keys.forEach((k) => t.insert(k, 1));
      return t.height() <= 2 * Math.log2(t.st.size + 1) || 'height ' + t.height();
    });
    T('B-Tree (t = 2, 3, 16): sorted, all leaves same depth, every key found', () => {
      for (const t of [2, 3, 16]) {
        const b = new D.BTree(t);
        keys.forEach((k) => b.insert(k, 1));
        if (!same(b.inorder(), uniq) || !b.validate() || !keys.every((k) => b.search(k) !== undefined)) return 'failed for t=' + t;
      }
      return true;
    });
    for (const H of [D.BinomialHeap, D.FibHeap]) {
      T((H === D.BinomialHeap ? 'Binomial' : 'Fibonacci') + ' Heap: extract-min order is sorted after decrease-key and merge', () => {
        const h = new H(),
          items = [];
        for (let i = 0; i < 2000; i++) items.push(h.insert(r() * 1000, i));
        for (let i = 0; i < 800; i++) {
          const it = items[Math.floor(r() * items.length)];
          if (it.key > 1) h.decreaseKey(it, it.key * r());
        }
        const h2 = new H(),
          more = [];
        for (let i = 0; i < 300; i++) more.push(h2.insert(r() * 1000, i));
        h.merge(h2);
        const expected = [...items, ...more].map((x) => x.key).sort((a, b) => a - b);
        const got = [];
        let x;
        while ((x = h.extractMin())) got.push(x.key);
        return same(got, expected);
      });
    }
    const rg = (n, p, seed) => {
      const q = D.rng(seed);
      let s = '';
      for (let i = 1; i < n; i++) s += 'v' + i + ' v' + Math.floor(q() * i) + ' ' + (1 + Math.floor(q() * 50)) + '\n';
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (q() < p) s += 'v' + i + ' v' + j + ' ' + (1 + Math.floor(q() * 50)) + '\n';
      return D.parseEdges(s, false);
    };
    T('Prim and Kruskal return the same minimum cost on 50 random graphs', () => {
      for (let s = 0; s < 50; s++) {
        const gph = rg(20, 0.2, s),
          a = D.prim(gph),
          b = D.kruskal(gph);
        if (a.total !== b.total || !a.connected || !b.connected) return 'differ on seed ' + s;
      }
      return true;
    });
    T('Floyd-Warshall equals Bellman-Ford from every source (20 random digraphs)', () => {
      for (let s = 0; s < 20; s++) {
        const gph = rg(12, 0.3, s);
        gph.directed = true;
        const fw = D.floydWarshall(gph),
          n = gph.n;
        for (let src = 0; src < n; src++) {
          const d = new Array(n).fill(Infinity);
          d[src] = 0;
          for (let it = 0; it < n; it++) for (const e of gph.edges) if (d[e.u] + e.w < d[e.v]) d[e.v] = d[e.u] + e.w;
          for (let j = 0; j < n; j++) if (d[j] !== fw.d[src][j]) return 'mismatch seed ' + s;
        }
      }
      return true;
    });
    T('0/1 Knapsack DP equals brute force over 2^10 subsets; fractional value >= 0/1 value', () => {
      for (let s = 0; s < 30; s++) {
        const q = D.rng(s),
          n = 10,
          items = [];
        for (let i = 0; i < n; i++) items.push({ name: 'i' + i, value: 1 + Math.floor(q() * 40), weight: 1 + Math.floor(q() * 20) });
        const W = 30;
        let best = 0;
        for (let m = 0; m < 1 << n; m++) {
          let w = 0,
            v = 0;
          for (let i = 0; i < n; i++) if ((m >> i) & 1) {
            w += items[i].weight;
            v += items[i].value;
          }
          if (w <= W && v > best) best = v;
        }
        const dp = D.knap01(items, W),
          fr = D.knapFractional(items, W);
        if (dp.value !== best || fr.value < best - 1e-9 || dp.chosen.reduce((a, x) => a + x.weight, 0) > W) return 'seed ' + s;
      }
      return true;
    });
    T('Matrix Chain DP equals exhaustive recursion on 20 random chains of 7 matrices', () => {
      const brute = (p, i, j) => {
        if (i === j) return 0;
        let b = Infinity;
        for (let k = i; k < j; k++) b = Math.min(b, brute(p, i, k) + brute(p, k + 1, j) + p[i - 1] * p[k] * p[j]);
        return b;
      };
      for (let s = 0; s < 20; s++) {
        const q = D.rng(s),
          p = Array.from({ length: 8 }, () => 1 + Math.floor(q() * 30));
        if (D.mcm(p).cost !== brute(p, 1, 7)) return 'seed ' + s;
      }
      return true;
    });
    T('N-Queen solution counts: n=4 -> 2, n=6 -> 4, n=8 -> 92', () => D.nqueens(4).solutions === 2 && D.nqueens(6).solutions === 4 && D.nqueens(8).solutions === 92);
    T('Hamiltonian: 4-cycle has a cycle; a star has neither cycle nor path', () => {
      const c = D.parseEdges('a b\nb c\nc d\nd a', false),
        st = D.parseEdges('a b\na c\na d', false);
      return D.hamiltonian(c, 'cycle').found !== null && D.hamiltonian(st, 'cycle').found === null && D.hamiltonian(st, 'path').found === null;
    });
    T('TSP: backtracking, both Branch & Bound variants and both heap frontiers agree (10 instances)', () => {
      for (let s = 0; s < 10; s++) {
        const q = D.rng(s + 100),
          n = 8;
        const pts = Array.from({ length: n }, () => [q() * 100, q() * 100]);
        const M = pts.map((a) => pts.map((b) => Math.round(Math.hypot(a[0] - b[0], a[1] - b[1]))));
        const a = D.tspBacktrack(M).best,
          b = D.tspBnBDFS(M).best,
          c = D.tspBnBBestFirst(M, 2e6, D.BinomialHeap).best,
          d = D.tspBnBBestFirst(M, 2e6, D.FibHeap).best;
        if (!(a === b && b === c && c === d)) return 'seed ' + s + ': ' + [a, b, c, d].join(', ');
      }
      return true;
    });
    T('Engine: changing one property changes the chosen technique (7 adaptation pairs)', () => {
      for (const a of D.ADAPTATIONS) {
        const picks = ['a', 'b', 'c'].filter((k) => a[k]).map((k) => D.solve(a[k][1]));
        if (picks.some((x) => x.error)) return a.id + ' errored';
        if (a.id !== 'a7' && new Set(picks.map((x) => x.choice.name)).size < 2) return a.id + ' did not adapt';
      }
      return true;
    });
    T('Engine: all 13 smart-city scenarios solve without error', () => {
      for (const p of D.PRESETS) {
        const x = D.solve(p.req);
        if (x.error) return p.id + ': ' + x.error;
      }
      return true;
    });
    return out;
  };
})(typeof window !== 'undefined' ? window : globalThis);
