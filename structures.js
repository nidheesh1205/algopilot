/* Algorithm 2035 - advanced data structures (all hand-written, no libraries).
   Every structure keeps an operation counter `st` so experiments can compare
   measured work against the theoretical bound. */
(function (g) {
  'use strict';
  const D = (g.DAA = g.DAA || {});

  /* seeded PRNG (mulberry32) so every experiment is reproducible */
  D.rng = function (seed) {
    let s = seed >>> 0;
    return function () {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  /* ------------------------------------------------------------------ */
  /* Red-Black Tree: insert / search, CLRS-style with a NIL sentinel      */
  /* ------------------------------------------------------------------ */
  class RBTree {
    constructor() {
      this.NIL = { c: 0, l: null, r: null, p: null, k: null };
      this.root = this.NIL;
      this.st = { cmp: 0, visits: 0, rot: 0, recolor: 0, size: 0 };
    }
    _rotL(x) {
      const y = x.r;
      x.r = y.l;
      if (y.l !== this.NIL) y.l.p = x;
      y.p = x.p;
      if (x.p === this.NIL) this.root = y;
      else if (x === x.p.l) x.p.l = y;
      else x.p.r = y;
      y.l = x;
      x.p = y;
      this.st.rot++;
    }
    _rotR(x) {
      const y = x.l;
      x.l = y.r;
      if (y.r !== this.NIL) y.r.p = x;
      y.p = x.p;
      if (x.p === this.NIL) this.root = y;
      else if (x === x.p.r) x.p.r = y;
      else x.p.l = y;
      y.r = x;
      x.p = y;
      this.st.rot++;
    }
    insert(k, v) {
      let y = this.NIL,
        x = this.root;
      while (x !== this.NIL) {
        y = x;
        this.st.visits++;
        this.st.cmp++;
        if (k === x.k) {
          x.v = v;
          return;
        }
        x = k < x.k ? x.l : x.r;
      }
      const z = { k, v, c: 1, l: this.NIL, r: this.NIL, p: y };
      if (y === this.NIL) this.root = z;
      else if (k < y.k) y.l = z;
      else y.r = z;
      this.st.size++;
      this._fix(z);
    }
    _fix(z) {
      const T = this;
      while (z.p.c === 1) {
        if (z.p === z.p.p.l) {
          const u = z.p.p.r;
          if (u.c === 1) {
            z.p.c = 0;
            u.c = 0;
            z.p.p.c = 1;
            T.st.recolor += 3;
            z = z.p.p;
          } else {
            if (z === z.p.r) {
              z = z.p;
              T._rotL(z);
            }
            z.p.c = 0;
            z.p.p.c = 1;
            T.st.recolor += 2;
            T._rotR(z.p.p);
          }
        } else {
          const u = z.p.p.l;
          if (u.c === 1) {
            z.p.c = 0;
            u.c = 0;
            z.p.p.c = 1;
            T.st.recolor += 3;
            z = z.p.p;
          } else {
            if (z === z.p.l) {
              z = z.p;
              T._rotR(z);
            }
            z.p.c = 0;
            z.p.p.c = 1;
            T.st.recolor += 2;
            T._rotL(z.p.p);
          }
        }
      }
      this.root.c = 0;
    }
    search(k) {
      let x = this.root;
      while (x !== this.NIL) {
        this.st.visits++;
        this.st.cmp++;
        if (k === x.k) return x.v;
        x = k < x.k ? x.l : x.r;
      }
      return undefined;
    }
    height() {
      const h = (x) => (x === this.NIL ? 0 : 1 + Math.max(h(x.l), h(x.r)));
      return h(this.root);
    }
    inorder() {
      const out = [];
      const f = (x) => {
        if (x === this.NIL) return;
        f(x.l);
        out.push(x.k);
        f(x.r);
      };
      f(this.root);
      return out;
    }
    /* returns black-height, or -1 if any red-black rule is broken */
    validate() {
      if (this.root.c !== 0) return -1;
      const f = (x) => {
        if (x === this.NIL) return 1;
        if (x.c === 1 && (x.l.c === 1 || x.r.c === 1)) return -1;
        const a = f(x.l),
          b = f(x.r);
        if (a < 0 || b < 0 || a !== b) return -1;
        return a + (x.c === 0 ? 1 : 0);
      };
      return f(this.root);
    }
  }

  /* ------------------------------------------------------------------ */
  /* B-Tree of minimum degree t (node holds t-1 .. 2t-1 keys)            */
  /* ------------------------------------------------------------------ */
  class BTree {
    constructor(t = 3) {
      this.t = Math.max(2, t);
      this.root = { leaf: true, keys: [], vals: [], ch: [] };
      this.st = { cmp: 0, nodeReads: 0, splits: 0, size: 0 };
    }
    _peek(k) {
      let x = this.root;
      for (;;) {
        let i = 0;
        while (i < x.keys.length && k > x.keys[i]) i++;
        if (i < x.keys.length && x.keys[i] === k) return [x, i];
        if (x.leaf) return null;
        x = x.ch[i];
      }
    }
    search(k) {
      let x = this.root;
      for (;;) {
        this.st.nodeReads++;
        let i = 0;
        while (i < x.keys.length && (this.st.cmp++, k > x.keys[i])) i++;
        if (i < x.keys.length && x.keys[i] === k) return x.vals[i];
        if (x.leaf) return undefined;
        x = x.ch[i];
      }
    }
    _split(x, i) {
      const t = this.t,
        y = x.ch[i];
      const z = { leaf: y.leaf, keys: y.keys.splice(t), vals: y.vals.splice(t), ch: [] };
      const mk = y.keys.pop(),
        mv = y.vals.pop();
      if (!y.leaf) z.ch = y.ch.splice(t);
      x.keys.splice(i, 0, mk);
      x.vals.splice(i, 0, mv);
      x.ch.splice(i + 1, 0, z);
      this.st.splits++;
    }
    insert(k, v) {
      const hit = this._peek(k);
      if (hit) {
        hit[0].vals[hit[1]] = v;
        return;
      }
      const r = this.root;
      if (r.keys.length === 2 * this.t - 1) {
        const s = { leaf: false, keys: [], vals: [], ch: [r] };
        this.root = s;
        this._split(s, 0);
      }
      let x = this.root;
      for (;;) {
        this.st.nodeReads++;
        let i = x.keys.length - 1;
        while (i >= 0 && (this.st.cmp++, k < x.keys[i])) i--;
        if (x.leaf) {
          x.keys.splice(i + 1, 0, k);
          x.vals.splice(i + 1, 0, v);
          this.st.size++;
          return;
        }
        i++;
        if (x.ch[i].keys.length === 2 * this.t - 1) {
          this._split(x, i);
          this.st.cmp++;
          if (k > x.keys[i]) i++;
        }
        x = x.ch[i];
      }
    }
    height() {
      let h = 1,
        x = this.root;
      while (!x.leaf) {
        x = x.ch[0];
        h++;
      }
      return h;
    }
    inorder() {
      const out = [];
      const f = (x) => {
        for (let i = 0; i < x.keys.length; i++) {
          if (!x.leaf) f(x.ch[i]);
          out.push(x.keys[i]);
        }
        if (!x.leaf) f(x.ch[x.keys.length]);
      };
      f(this.root);
      return out;
    }
    /* all leaves same depth and key-count bounds respected */
    validate() {
      const t = this.t;
      let depth = -1,
        ok = true;
      const f = (x, d, isRoot) => {
        if (x.keys.length > 2 * t - 1 || (!isRoot && x.keys.length < t - 1)) ok = false;
        if (x.leaf) {
          if (depth < 0) depth = d;
          else if (depth !== d) ok = false;
          return;
        }
        if (x.ch.length !== x.keys.length + 1) ok = false;
        x.ch.forEach((c) => f(c, d + 1, false));
      };
      f(this.root, 0, true);
      return ok;
    }
  }

  /* ------------------------------------------------------------------ */
  /* Binomial Heap (roots stored by degree, like a binary counter)        */
  /* ------------------------------------------------------------------ */
  class BinomialHeap {
    constructor() {
      this.roots = [];
      this.n = 0;
      this.st = { cmp: 0, link: 0, swap: 0, cut: 0 };
    }
    get work() {
      const s = this.st;
      return s.cmp + s.link + s.swap + s.cut;
    }
    _mk(it) {
      const nd = { it, ch: [], p: null };
      it.node = nd;
      return nd;
    }
    _link(a, b) {
      this.st.cmp++;
      if (b.it.key < a.it.key) {
        const t = a;
        a = b;
        b = t;
      }
      b.p = a;
      a.ch.push(b);
      this.st.link++;
      return a;
    }
    _add(t, roots) {
      t.p = null;
      let d = t.ch.length;
      while (roots[d]) {
        t = this._link(roots[d], t);
        roots[d] = null;
        d++;
      }
      roots[d] = t;
    }
    insert(key, val) {
      const it = { key, val };
      this._add(this._mk(it), this.roots);
      this.n++;
      return it;
    }
    merge(o) {
      for (const t of o.roots) if (t) this._add(t, this.roots);
      this.n += o.n;
      o.roots = [];
      o.n = 0;
    }
    _minIdx() {
      let m = -1;
      for (let i = 0; i < this.roots.length; i++) {
        const r = this.roots[i];
        if (!r) continue;
        if (m < 0) m = i;
        else {
          this.st.cmp++;
          if (r.it.key < this.roots[m].it.key) m = i;
        }
      }
      return m;
    }
    min() {
      const m = this._minIdx();
      return m < 0 ? null : this.roots[m].it;
    }
    extractMin() {
      const m = this._minIdx();
      if (m < 0) return null;
      const t = this.roots[m];
      this.roots[m] = null;
      for (const c of t.ch) this._add(c, this.roots);
      this.n--;
      while (this.roots.length && !this.roots[this.roots.length - 1]) this.roots.pop();
      return t.it;
    }
    decreaseKey(it, k) {
      it.key = k;
      let x = it.node;
      while (x.p) {
        this.st.cmp++;
        if (x.it.key < x.p.it.key) {
          const a = x.it,
            b = x.p.it;
          x.it = b;
          x.p.it = a;
          b.node = x;
          a.node = x.p;
          x = x.p;
          this.st.swap++;
        } else break;
      }
    }
  }

  /* ------------------------------------------------------------------ */
  /* Fibonacci Heap: lazy insert/merge, consolidate on extract-min,       */
  /* cut + cascading cut on decrease-key                                  */
  /* ------------------------------------------------------------------ */
  class FibHeap {
    constructor() {
      this.roots = new Set();
      this.min = null;
      this.n = 0;
      this.st = { cmp: 0, link: 0, swap: 0, cut: 0 };
    }
    get work() {
      const s = this.st;
      return s.cmp + s.link + s.swap + s.cut;
    }
    insert(key, val) {
      const it = { key, val };
      const nd = { it, ch: new Set(), p: null, mark: false, deg: 0 };
      it.node = nd;
      this.roots.add(nd);
      this.st.cmp++;
      if (!this.min || key < this.min.it.key) this.min = nd;
      this.n++;
      return it;
    }
    merge(o) {
      for (const r of o.roots) this.roots.add(r);
      this.st.cmp++;
      if (!this.min || (o.min && o.min.it.key < this.min.it.key)) this.min = o.min || this.min;
      this.n += o.n;
      o.roots = new Set();
      o.min = null;
      o.n = 0;
    }
    extractMin() {
      const z = this.min;
      if (!z) return null;
      for (const c of z.ch) {
        c.p = null;
        c.mark = false;
        this.roots.add(c);
      }
      this.roots.delete(z);
      this.n--;
      if (this.roots.size === 0) this.min = null;
      else this._consolidate();
      return z.it;
    }
    _consolidate() {
      const A = [];
      for (const w of [...this.roots]) {
        let x = w,
          d = x.deg;
        while (A[d]) {
          let y = A[d];
          this.st.cmp++;
          if (y.it.key < x.it.key) {
            const t = x;
            x = y;
            y = t;
          }
          this.roots.delete(y);
          y.p = x;
          y.mark = false;
          x.ch.add(y);
          x.deg++;
          this.st.link++;
          A[d] = null;
          d++;
        }
        A[d] = x;
      }
      this.min = null;
      for (const r of A) {
        if (!r) continue;
        this.st.cmp++;
        if (!this.min || r.it.key < this.min.it.key) this.min = r;
      }
    }
    _cut(x, y) {
      y.ch.delete(x);
      y.deg--;
      x.p = null;
      x.mark = false;
      this.roots.add(x);
      this.st.cut++;
    }
    decreaseKey(it, k) {
      it.key = k;
      const x = it.node,
        y = x.p;
      if (y) {
        this.st.cmp++;
        if (x.it.key < y.it.key) {
          this._cut(x, y);
          let c = y;
          while (c.p) {
            if (!c.mark) {
              c.mark = true;
              break;
            }
            const z = c.p;
            this._cut(c, z);
            c = z;
          }
        }
      }
      this.st.cmp++;
      if (x.it.key < this.min.it.key) this.min = x;
    }
  }

  D.RBTree = RBTree;
  D.BTree = BTree;
  D.BinomialHeap = BinomialHeap;
  D.FibHeap = FibHeap;
})(typeof window !== 'undefined' ? window : globalThis);
