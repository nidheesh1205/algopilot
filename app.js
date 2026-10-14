/* Algorithm 2035 - user interface */
(function () {
  'use strict';
  const D = window.DAA;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const tick = () => new Promise((r) => setTimeout(r, 20));
  const f1 = (x) => (typeof x === 'number' && isFinite(x) ? x.toLocaleString('en-US', { maximumFractionDigits: 1 }) : String(x));

  const FAMILY = {
    ORDERED_SEARCH: ['Data structures', 'blue'],
    DYNAMIC_PRIORITY: ['Data structures', 'blue'],
    MST: ['Graph optimisation', 'teal'],
    APSP: ['Graph optimisation', 'teal'],
    KNAP_FRAC: ['Resource selection', 'amber'],
    KNAP_01: ['Resource selection', 'amber'],
    MCM: ['Resource selection', 'amber'],
    HAMILTON: ['Constraint search', 'mag'],
    NQUEEN: ['Constraint search', 'mag'],
    TSP: ['Constraint search', 'mag'],
  };
  const PRESET_PROBLEM = { p1: 'ORDERED_SEARCH', p1b: 'ORDERED_SEARCH', p2: 'DYNAMIC_PRIORITY', p2b: 'DYNAMIC_PRIORITY', p3: 'MST', p3b: 'MST', p4: 'APSP', p5: 'KNAP_FRAC', p5b: 'KNAP_01', p6: 'MCM', p7: 'HAMILTON', p8: 'NQUEEN', p9: 'TSP' };

  const state = { req: null, scenario: '', presetId: null, result: null };

  /* ---------------- tabs ---------------- */
  const inited = {};
  function showTab(id) {
    $$('.tab').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === id)));
    $$('.panel').forEach((p) => (p.hidden = p.id !== 'tab-' + id));
    if (id === 'adapt' && !inited.adapt) {
      inited.adapt = true;
      renderAdapt();
    }
    if (id === 'lab' && !inited.lab) {
      inited.lab = true;
      renderLab();
    }
    if (id === 'theory' && !inited.theory) {
      inited.theory = true;
      renderTheory();
    }
    if (id === 'tests') renderTests();
  }

  /* ---------------- request form ---------------- */
  const STRUCTS = [
    ['records', 'Keyed records'],
    ['events', 'Prioritised events'],
    ['network', 'Weighted network'],
    ['items', 'Items under a budget'],
    ['matrices', 'Chain of matrices'],
    ['grid', 'Placement grid'],
  ];
  const DEFAULT_PRESET = { records: 'p1', events: 'p2', network: 'p3', items: 'p5b', matrices: 'p6', grid: 'p8' };
  const GOALS = [
    ['connect-all', 'Connect every site at the lowest total cost'],
    ['pair-costs', 'Know the cheapest cost between every pair of sites'],
    ['visit-once', 'Decide if one route can visit every site exactly once'],
    ['round-trip', 'Find the cheapest round trip through every site'],
  ];
  const get = (o, path) => path.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
  const set = (o, path, v) => {
    const ks = path.split('.');
    const last = ks.pop();
    ks.reduce((a, k) => (a[k] = a[k] || {}), o)[last] = v;
  };
  const field = (label, k, type, extra) => {
    const v = get(state.req, k);
    const id = 'f-' + k.replace('.', '-');
    extra = extra || {};
    if (type === 'check') return '<label class="chk"><input type="checkbox" id="' + id + '" data-k="' + k + '" data-t="check"' + (v ? ' checked' : '') + '><span>' + esc(label) + '</span></label>';
    if (type === 'select') return '<label class="fld"><span>' + esc(label) + '</span><select id="' + id + '" data-k="' + k + '" data-t="text">' + extra.options.map((o) => '<option value="' + esc(o[0]) + '"' + (o[0] === v ? ' selected' : '') + '>' + esc(o[1]) + '</option>').join('') + '</select></label>';
    if (type === 'area') return '<label class="fld"><span>' + esc(label) + '</span><textarea id="' + id + '" data-k="' + k + '" data-t="text" rows="' + (extra.rows || 6) + '" spellcheck="false">' + esc(v) + '</textarea>' + (extra.hint ? '<small>' + esc(extra.hint) + '</small>' : '') + '</label>';
    if (type === 'range') return '<label class="fld"><span>' + esc(label) + ': <b id="' + id + '-v">' + esc(v) + '%</b></span><input type="range" min="0" max="100" step="5" id="' + id + '" data-k="' + k + '" data-t="num" value="' + esc(v) + '"></label>';
    return '<label class="fld"><span>' + esc(label) + '</span><input type="' + (type === 'num' ? 'number' : 'text') + '" id="' + id + '" data-k="' + k + '" data-t="' + (type === 'num' ? 'num' : 'text') + '" value="' + esc(v) + '"' + (extra.min != null ? ' min="' + extra.min + '"' : '') + '></label>';
  };

  function renderForm() {
    const r = state.req,
      p = r.props;
    let h = '<label class="fld"><span>What kind of data is it?</span><select id="f-structure">' + STRUCTS.map((s) => '<option value="' + s[0] + '"' + (s[0] === r.structure ? ' selected' : '') + '>' + s[1] + '</option>').join('') + '</select></label>';
    if (r.structure === 'records') {
      h += field('Where do the records live?', 'props.residency', 'select', { options: [['memory', 'In memory (RAM)'], ['disk', 'On disk, read in blocks']] });
      h += field('Number of records', 'props.records', 'num', { min: 200 });
      h += field('Keys that fit in one disk block', 'props.blockCapacity', 'num', { min: 3 });
    } else if (r.structure === 'events') {
      h += field('Number of events', 'props.events', 'num', { min: 100 });
      h += field('Operations that raise an existing priority', 'props.decreaseShare', 'range');
      h += field('Separate queues must be merged', 'props.merge', 'check');
      h += field('Every single operation needs a worst-case time bound', 'props.realtime', 'check');
    } else if (r.structure === 'network') {
      h += field('What do you need from the network?', 'props.goal', 'select', { options: GOALS });
      if (p.goal === 'pair-costs' || p.goal === 'visit-once') h += field('Links are one-way', 'props.directed', 'check');
      if (p.goal === 'visit-once') h += field('Route must return to the start', 'props.visitMode', 'select', { options: [['cycle', 'Yes, closed route'], ['path', 'No, any end point']] });
      h += field('Links (one per line)', 'data.edges', 'area', { rows: 8, hint: 'Format: siteA siteB cost. Cost can be left out for yes/no questions.' });
    } else if (r.structure === 'items') {
      h += field('Items can be split into parts', 'props.divisible', 'check');
      h += field('Budget / capacity', 'data.capacity', 'text');
      h += field('Items (one per line)', 'data.items', 'area', { rows: 7, hint: 'Format: name value weight' });
    } else if (r.structure === 'matrices') {
      h += field('Matrix dimensions p0 p1 p2 ...', 'data.dims', 'text');
      h += '<p class="hint">Matrix i has size p(i-1) x p(i), so 4 numbers describe 3 matrices.</p>';
    } else if (r.structure === 'grid') {
      h += field('Placed items conflict when they share', 'props.conflict', 'select', { options: [['line-of-sight', 'a row, column or diagonal'], ['none', 'nothing (no conflicts)']] });
      h += field('Grid size n (n x n, n items)', 'props.size', 'num', { min: 1 });
    }
    $('#form').innerHTML = h;
    $('#reqjson').textContent = JSON.stringify(cleanReq(), null, 1);
    const sel = $('#f-structure');
    sel.addEventListener('change', () => {
      const id = DEFAULT_PRESET[sel.value];
      const pr = D.preset(id);
      state.req = pr.req;
      state.scenario = '';
      state.presetId = null;
      renderForm();
      renderPresets();
      setScenario();
    });
    $$('#form [data-k]').forEach((el) => {
      const ev = el.type === 'checkbox' || el.tagName === 'SELECT' ? 'change' : 'input';
      el.addEventListener(ev, () => {
        let v = el.value;
        if (el.dataset.t === 'check') v = el.checked;
        else if (el.dataset.t === 'num') v = Number(v);
        set(state.req, el.dataset.k, v);
        if (el.type === 'range') $('#' + el.id + '-v').textContent = v + '%';
        state.scenario = '';
        state.presetId = null;
        setScenario();
        renderPresets();
        $('#reqjson').textContent = JSON.stringify(cleanReq(), null, 1);
        if (el.dataset.k === 'props.goal') {
          const pid = { 'connect-all': 'p3', 'pair-costs': 'p4', 'visit-once': 'p7', 'round-trip': 'p9' }[v];
          const pr = D.preset(pid);
          state.req.props = Object.assign({}, pr.req.props);
          state.req.data = pr.req.data;
          renderForm();
        }
      });
    });
  }
  const cleanReq = () => JSON.parse(JSON.stringify(state.req));

  function renderPresets() {
    $('#presets').innerHTML = D.PRESETS.map((p, i) => {
      const fam = FAMILY[PRESET_PROBLEM[p.id]];
      return '<button type="button" class="pre c-' + fam[1] + (state.presetId === p.id ? ' on' : '') + '" data-id="' + p.id + '"><span class="pt">' + esc(p.title) + '</span><span class="pf">' + esc(D.TITLES[PRESET_PROBLEM[p.id]]) + '</span></button>';
    }).join('');
    $$('#presets .pre').forEach((b) =>
      b.addEventListener('click', () => {
        const pr = D.preset(b.dataset.id);
        state.req = pr.req;
        state.scenario = pr.scenario;
        state.presetId = pr.id;
        renderForm();
        renderPresets();
        setScenario();
        run();
      })
    );
  }
  const setScenario = () => {
    $('#scenario').textContent = state.scenario || 'Custom request. The engine only sees the properties and data in the form.';
  };

  /* ---------------- pipeline ---------------- */
  const STAGES = ['Scenario input', 'Problem model', 'DAA choice', 'Execution', 'Analysis', 'Explanation'];
  function renderPipeline(res) {
    const fam = res && res.problem ? FAMILY[res.problem] : ['', 'teal'];
    const caps = res && !res.error
      ? [state.presetId ? D.PRESETS.find((p) => p.id === state.presetId).title : 'Custom request', res.model, res.choice.name, f1(res.timing.execute) + ' ms to run', res.cls.label, res.rejected.length + ' alternative' + (res.rejected.length === 1 ? '' : 's') + ' ruled out']
      : ['', '', '', '', '', ''];
    $('#pipeline').className = 'pipe c-' + fam[1] + (res && !res.error ? ' done' : '');
    $('#pipeline').innerHTML = '<ol>' + STAGES.map((s, i) => '<li style="--i:' + i + '"><span class="dot"></span><b>' + s + '</b><span class="cap">' + esc(caps[i]) + '</span></li>').join('') + '</ol>';
  }

  /* ---------------- result ---------------- */
  function renderBlock(b) {
    let h = '<section class="blk">' + (b.title ? '<h4>' + esc(b.title) + '</h4>' : '');
    if (b.type === 'kv') h += '<dl>' + b.items.map((i) => '<div><dt>' + esc(i[0]) + '</dt><dd>' + esc(i[1]) + '</dd></div>').join('') + '</dl>';
    else if (b.type === 'table')
      h += '<div class="scroll"><table><thead><tr>' + b.head.map((x, i) => '<th' + (b.hl === i ? ' class="hl"' : '') + '>' + esc(x) + '</th>').join('') + '</tr></thead><tbody>' + b.rows.map((r) => '<tr>' + r.map((c, i) => '<td' + (b.hl === i ? ' class="hl"' : '') + '>' + esc(c) + '</td>').join('') + '</tr>').join('') + '</tbody></table></div>';
    else if (b.type === 'text') h += b.html;
    else if (b.type === 'board') {
      let cells = '';
      for (let r = 0; r < b.n; r++) for (let c = 0; c < b.n; c++) cells += '<i class="' + ((r + c) % 2 ? 'dk' : '') + (b.pos[r] === c ? ' q' : '') + '">' + (b.pos[r] === c ? '&#9679;' : '') + '</i>';
      h += '<div class="board" style="--n:' + b.n + '" role="img" aria-label="Grid with ' + b.n + ' sensors, none sharing a row, column or diagonal">' + cells + '</div>';
    }
    return h + '</section>';
  }

  function renderResult() {
    const res = state.result;
    renderPipeline(res);
    const el = $('#result');
    if (!res) {
      el.innerHTML = '';
      return;
    }
    if (res.error) {
      el.innerHTML = '<article class="card err" role="alert"><h2>The request could not be solved</h2><p>' + esc(res.error) + '</p></article>';
      return;
    }
    const fam = FAMILY[res.problem];
    el.innerHTML =
      '<article class="card c-' + fam[1] + '">' +
      '<div class="rhead"><div><p class="muted">Recognised as</p><h2>' + esc(res.title) + '</h2><p class="muted">Rule ' + res.rule + ' matched the properties of this request.</p></div><span class="badge k-' + res.cls.kind + '">' + esc(res.cls.label) + '</span></div>' +
      '<p class="model">' + esc(res.model) + '</p>' +
      '<div class="choice"><p class="muted">Chosen technique</p><h3>' + esc(res.choice.name) + '</h3><ul>' + res.choice.reasons.map((x) => '<li>' + esc(x) + '</li>').join('') + '</ul></div>' +
      res.warnings.map((w) => '<p class="warn" role="note">' + esc(w) + '</p>').join('') +
      res.blocks.map(renderBlock).join('') +
      '<div class="two"><section class="blk"><h4>Alternatives ruled out</h4><ul>' + res.rejected.map((x) => '<li><b>' + esc(x.name) + '.</b> ' + esc(x.reason) + '</li>').join('') + '</ul></section>' +
      '<section class="blk"><h4>Expected complexity</h4><dl><div><dt>Time</dt><dd>' + esc(res.complexity.time) + '</dd></div><div><dt>Space</dt><dd>' + esc(res.complexity.space) + '</dd></div></dl></section></div>' +
      '<section class="blk"><h4>Complexity class: decision and optimisation forms</h4><dl><div><dt>Decision form</dt><dd>' + esc(res.cls.decision) + '</dd></div><div><dt>Optimisation form</dt><dd>' + esc(res.cls.optimization) + '</dd></div><div><dt>Note</dt><dd>' + esc(res.cls.note) + '</dd></div></dl></section>' +
      '<details class="trace"><summary>Recognition rules evaluated (' + res.trace.filter((t) => t.fired).length + ' of ' + res.trace.length + ' matched)</summary><ul>' + res.trace.map((t) => '<li class="' + (t.fired ? 'hit' : '') + '"><b>' + t.id + '</b> ' + esc(t.when) + ' <em>' + (t.fired ? 'matched' : 'no match') + '</em></li>').join('') + '</ul><p class="muted">The first matching rule decides the problem type. Rules read properties only; no algorithm name is ever part of a request.</p></details>' +
      '</article>';
  }

  function run() {
    const btn = $('#run');
    btn.disabled = true;
    setTimeout(() => {
      state.result = D.solve(cleanReq());
      renderResult();
      btn.disabled = false;
    }, 10);
  }

  /* ---------------- adaptation demos ---------------- */
  function renderAdapt() {
    const box = $('#adaptList');
    box.innerHTML = D.ADAPTATIONS.map((a, i) => {
      const vs = ['a', 'b', 'c'].filter((k) => a[k]).map((k) => ({ key: k, label: a[k][0], res: D.solve(a[k][1]) }));
      const names = new Set(vs.map((v) => v.res.choice && v.res.choice.name));
      const changed = names.size > 1;
      return '<article class="card adapt"><h3>' + esc(a.title) + '</h3><p class="muted">Property changed: <b>' + esc(a.changed) + '</b></p><div class="vars n' + vs.length + '">' + vs.map((v) => {
        if (v.res.error) return '<div class="var"><p class="muted">' + esc(v.label) + '</p><p class="warn">' + esc(v.res.error) + '</p></div>';
        const fam = FAMILY[v.res.problem];
        return '<div class="var c-' + fam[1] + '"><p class="muted">' + esc(v.label) + '</p><p class="pn">' + esc(v.res.title) + '</p><h4>' + esc(v.res.choice.name) + '</h4><p class="hd">' + esc(v.res.headline) + '</p><button type="button" class="btn ghost" data-a="' + a.id + '" data-v="' + v.key + '">Open in solver</button></div>';
      }).join('') + '</div><p class="verdict ' + (changed ? 'yes' : 'no') + '">' + (changed ? 'The framework chose a different technique.' : 'Same primary technique; the supporting methods and cost profile changed.') + '</p></article>';
    }).join('');
    $$('#adaptList button[data-a]').forEach((b) =>
      b.addEventListener('click', () => {
        const a = D.ADAPTATIONS.find((x) => x.id === b.dataset.a);
        state.req = JSON.parse(JSON.stringify(a[b.dataset.v][1]));
        state.scenario = a.title + ' - ' + a[b.dataset.v][0];
        state.presetId = null;
        showTab('solve');
        renderForm();
        renderPresets();
        setScenario();
        run();
      })
    );
  }

  /* ---------------- charts ---------------- */
  const SER_COL = ['var(--s1)', 'var(--s2)', 'var(--s3)', 'var(--s4)', 'var(--s5)'];
  const SER_DASH = ['', '6 3', '', '6 3', '2 3'];
  const compact = (v) => (v >= 1e6 ? +(v / 1e6).toPrecision(3) + 'M' : v >= 1e3 ? +(v / 1e3).toPrecision(3) + 'K' : String(+v.toPrecision(3)));
  function chart(series, theory, xLabel) {
    const W = 640,
      H = 310,
      L = 58,
      R = 14,
      T = 12,
      B = 44;
    const all = series.filter((s) => s.pts.length).flatMap((s) => s.pts);
    const xs = [...new Set(series[0].pts.map((p) => p[0]))];
    const xmin = Math.min(...all.map((p) => p[0])),
      xmax = Math.max(...all.map((p) => p[0]));
    let ys = all.map((p) => p[1]).filter((y) => y > 0);
    let th = null;
    if (theory) {
      const a = series[theory.anchor || 0].pts[0];
      const sc = a[1] / theory.fn(a[0]);
      th = series[0].pts.map((p) => [p[0], theory.fn(p[0]) * sc]);
      ys = ys.concat(th.map((p) => p[1]).filter((y) => isFinite(y) && y > 0));
    }
    const ymin = Math.pow(10, Math.floor(Math.log10(Math.min(...ys)))),
      ymax = Math.pow(10, Math.ceil(Math.log10(Math.max(...ys))));
    const xlog = xmax / xmin > 12;
    const X = (x) => L + ((xlog ? Math.log(x / xmin) / Math.log(xmax / xmin) : (x - xmin) / (xmax - xmin || 1)) * (W - L - R));
    const Y = (y) => T + (1 - (Math.log10(Math.max(y, ymin)) - Math.log10(ymin)) / (Math.log10(ymax) - Math.log10(ymin) || 1)) * (H - T - B);
    let s = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="chart" role="img" aria-label="Line chart of measured operations against ' + esc(xLabel) + ', logarithmic vertical axis">';
    for (let e = Math.log10(ymin); e <= Math.log10(ymax) + 1e-9; e++) {
      const y = Y(Math.pow(10, e));
      s += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + y + '" y2="' + y + '" class="grid"/><text x="' + (L - 8) + '" y="' + (y + 4) + '" text-anchor="end" class="tk">' + compact(Math.pow(10, e)) + '</text>';
    }
    xs.forEach((x) => {
      s += '<text x="' + X(x) + '" y="' + (H - B + 16) + '" text-anchor="middle" class="tk">' + compact(x) + '</text><line x1="' + X(x) + '" x2="' + X(x) + '" y1="' + (H - B) + '" y2="' + (H - B + 4) + '" class="axis"/>';
    });
    s += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + (H - B) + '" y2="' + (H - B) + '" class="axis"/><line x1="' + L + '" x2="' + L + '" y1="' + T + '" y2="' + (H - B) + '" class="axis"/>';
    s += '<text x="' + (L + (W - L - R) / 2) + '" y="' + (H - 6) + '" text-anchor="middle" class="al">' + esc(xLabel) + '</text>';
    if (th) s += '<polyline points="' + th.map((p) => X(p[0]) + ',' + Y(p[1])).join(' ') + '" class="theory"/>';
    series.forEach((se, i) => {
      if (!se.pts.length) return;
      s += '<polyline points="' + se.pts.map((p) => X(p[0]) + ',' + Y(p[1])).join(' ') + '" fill="none" stroke="' + SER_COL[i % 5] + '" stroke-width="2.4" stroke-dasharray="' + SER_DASH[i % 5] + '"/>';
      se.pts.forEach((p) => (s += '<circle cx="' + X(p[0]) + '" cy="' + Y(p[1]) + '" r="3.2" fill="' + SER_COL[i % 5] + '"/>'));
    });
    s += '</svg><ul class="legend">' + series.map((se, i) => '<li><svg width="26" height="8" aria-hidden="true"><line x1="0" x2="26" y1="4" y2="4" stroke="' + SER_COL[i % 5] + '" stroke-width="2.4" stroke-dasharray="' + SER_DASH[i % 5] + '"/></svg>' + esc(se.name) + '</li>').join('') + (th ? '<li><svg width="26" height="8" aria-hidden="true"><line x1="0" x2="26" y1="4" y2="4" class="theory"/></svg>' + esc(theory.name) + '</li>' : '') + '</ul>';
    return s;
  }

  /* ---------------- experiment lab ---------------- */
  const EXP = {};
  const runExp = async (id) => {
    const e = D.EXPERIMENTS.find((x) => x.id === id);
    const btn = $('#run-' + id);
    btn.disabled = true;
    btn.textContent = 'Running...';
    await tick();
    const t = performance.now();
    EXP[id] = e.run();
    EXP[id].ms = performance.now() - t;
    const r = EXP[id];
    $('#out-' + id).innerHTML =
      '<p class="risk r-' + r.risk.level + '"><b>' + r.risk.level + ' risk.</b> ' + esc(r.risk.why) + '</p>' + chart(r.series, r.theory, e.xLabel) +
      '<div class="scroll"><table><thead><tr>' + r.head.map((h) => '<th>' + esc(h) + '</th>').join('') + '</tr></thead><tbody>' + r.rows.map((row) => '<tr>' + row.map((c) => '<td>' + esc(c) + '</td>').join('') + '</tr>').join('') + '</tbody></table></div><p class="finding">' + esc(r.finding) + '</p>';
    btn.disabled = false;
    btn.textContent = 'Run again';
    updateRiskTable();
  };
  function updateRiskTable() {
    $('#riskBody').innerHTML = D.EXPERIMENTS.map((e) => {
      const r = EXP[e.id];
      return '<tr><td><a href="#exp-' + e.id + '">' + esc(e.family) + '</a></td><td>' + esc(e.theory.split('.')[0] + '.') + '</td><td>' + (r ? esc(r.risk.why) : '<span class="muted">Not run yet</span>') + '</td><td>' + (r ? '<span class="risk-pill r-' + r.risk.level + '">' + r.risk.level + '</span>' : '') + '</td></tr>';
    }).join('');
  }
  function renderLab() {
    $('#labList').innerHTML = D.EXPERIMENTS.map((e) => '<article class="card exp" id="exp-' + e.id + '"><div class="rhead"><div><h3>' + esc(e.title) + '</h3><p class="muted">' + esc(e.theory) + '</p></div><button type="button" class="btn ghost" id="run-' + e.id + '">Run</button></div><div id="out-' + e.id + '"></div></article>').join('');
    D.EXPERIMENTS.forEach((e) => $('#run-' + e.id).addEventListener('click', () => runExp(e.id)));
    $('#runAll').addEventListener('click', async () => {
      const b = $('#runAll');
      b.disabled = true;
      for (const e of D.EXPERIMENTS) {
        b.textContent = 'Running ' + e.family + '...';
        await runExp(e.id);
      }
      b.textContent = 'Run all again';
      b.disabled = false;
    });
    updateRiskTable();
  }

  /* ---------------- complexity and gaps ---------------- */
  const TECH = [
    ['ORDERED_SEARCH', 'Red-Black Tree, B-Tree', 'O(log n) per operation; B-Tree O(log_t n) node reads', 'O(n)'],
    ['DYNAMIC_PRIORITY', 'Binomial Heap, Fibonacci Heap', 'Decrease-key O(log n) vs O(1) amortised; extract-min O(log n)', 'O(n)'],
    ['MST', 'Prim, Kruskal', 'O(V^2) with a matrix; O(E log E)', 'O(V^2); O(V + E)'],
    ['APSP', 'Floyd-Warshall', 'O(V^3)', 'O(V^2)'],
    ['KNAP_FRAC', 'Fractional Knapsack', 'O(n log n)', 'O(n)'],
    ['KNAP_01', '0/1 Knapsack DP', 'O(nW), pseudo-polynomial', 'O(nW), or O(W) for the value alone'],
    ['MCM', 'Matrix Chain Multiplication', 'O(n^3)', 'O(n^2)'],
    ['HAMILTON', 'Backtracking', 'O(n!) worst case', 'O(n)'],
    ['NQUEEN', 'Backtracking', 'O(n!) worst case, heavily pruned in practice', 'O(n)'],
    ['TSP', 'Backtracking, Branch and Bound', 'O(n!) worst case; bounding prunes in practice', 'O(n) depth-first; exponential frontier best-first'],
  ];
  function renderTheory() {
    $('#classBody').innerHTML = TECH.map((t) => {
      const c = D.CLASS[t[0]];
      return '<tr><td>' + esc(D.TITLES[t[0]]) + '</td><td>' + esc(t[1]) + '</td><td>' + esc(t[2]) + '</td><td>' + esc(t[3]) + '</td><td>' + esc(c.decision) + '</td><td>' + esc(c.optimization) + '</td><td><span class="badge k-' + c.kind + '">' + esc(c.label) + '</span></td></tr>';
    }).join('');
    $('#gapEvidence').textContent = 'Measuring...';
    setTimeout(async () => {
      for (const id of ['heap', 'tree', 'fw', 'tsp', 'knap', 'ham']) {
        if (!EXP[id]) {
          EXP[id] = D.EXPERIMENTS.find((e) => e.id === id).run();
        }
      }
      const L = (id) => EXP[id].rows[EXP[id].rows.length - 1];
      const heap = L('heap'),
        tree = L('tree'),
        fw = L('fw'),
        knap = L('knap'),
        ham = L('ham');
      const tsp = EXP.tsp.rows.find((r) => r[0] === 10);
      const GAPS = [
        ['Binomial Heap pays O(log n) for every decrease-key', 'Fibonacci Heap: lazy cuts give amortised O(1) decrease-key (and later Pairing and Strict Fibonacci heaps)', 'At n = ' + heap[0] + ' with 60% escalations: ' + heap[1] + ' steps per decrease-key (Binomial / Fibonacci)'],
        ['Red-Black Tree nodes are small and scattered, so every level can be a disk read', 'B-Tree and B+ Tree: wide nodes sized to a disk block', 'At n = ' + tree[0] + ': ' + tree[3] + ' node accesses per lookup (Red-Black) vs ' + tree[4] + ' (B-Tree)'],
        ['Floyd-Warshall is cubic however sparse the graph is', "Johnson's algorithm: reweighting plus one Dijkstra per source, O(V^2 log V + VE)", 'V = ' + fw[0] + ' zones with only ' + 4 * fw[0] + ' links still cost ' + fw[1] + ' relaxations'],
        ['0/1 Knapsack DP is pseudo-polynomial: its table grows with the value of W', 'FPTAS (round the values), meet-in-the-middle O(2^(n/2)), branch and bound', 'W = ' + knap[0] + ': ' + knap[2] + ' DP updates against ' + knap[1] + ' greedy steps'],
        ['Greedy-by-ratio is optimal for Fractional Knapsack but breaks for 0/1', 'Dynamic programming for exact answers, approximation schemes for large inputs', 'Open the indivisible-upgrades scenario: greedy 130 vs optimum 170'],
        ['Exact TSP by backtracking visits (n-1)! partial tours', 'Held-Karp DP O(n^2 2^n), Christofides 1.5-approximation, Lin-Kernighan heuristics, branch and cut', 'n = 10: ' + tsp[1] + ' backtracking states vs ' + tsp[2] + ' with Branch and Bound'],
        ['Hamiltonian backtracking ignores simple necessary conditions', 'Degree and connectivity pruning, subset DP (Bellman-Held-Karp) O(n^2 2^n)', 'Pendant-vertex family, n = ' + ham[0] + ': ' + ham[2] + ' states to prove "no cycle"'],
        ['Prim with an adjacency matrix costs V^2 even for sparse graphs', 'Prim with a Fibonacci Heap O(E + V log V), Boruvka, near-linear MST algorithms', 'Sparse graph results in the MST experiment'],
        ['Matrix-chain DP is cubic', 'Hu-Shing algorithm: O(n log n)', 'n = 240 chain: see the Matrix Chain experiment'],
        ['Plain N-Queen backtracking enumerates board states', 'Bitmask backtracking, and an O(n) constructive formula when only one layout is needed', 'First layout found in far fewer nodes than the full enumeration'],
      ];
      $('#gapBody').innerHTML = GAPS.map((g) => '<tr><td>' + esc(g[0]) + '</td><td>' + esc(g[1]) + '</td><td>' + esc(g[2]) + '</td></tr>').join('');
      $('#gapEvidence').textContent = 'Evidence numbers are measured live by this app.';
      updateRiskTable();
    }, 30);
  }

  /* ---------------- self tests ---------------- */
  let testRes = null;
  function renderTests() {
    if (!testRes) testRes = D.runTests();
    const pass = testRes.filter((t) => t.pass).length;
    $('#testBadge').textContent = pass + ' of ' + testRes.length + ' checks pass';
    $('#testBadge').className = 'tbadge ' + (pass === testRes.length ? 'ok' : 'bad');
    $('#testList').innerHTML = testRes.map((t) => '<li class="' + (t.pass ? 'pass' : 'fail') + '"><span>' + (t.pass ? 'Pass' : 'Fail') + '</span> ' + esc(t.name) + (t.detail ? ' <em>' + esc(t.detail) + '</em>' : '') + '</li>').join('');
  }

  /* ---------------- boot ---------------- */
  function boot() {
    $$('.tab').forEach((b) => b.addEventListener('click', () => showTab(b.dataset.tab)));
    $('#run').addEventListener('click', run);
    const pr = D.preset('p5b');
    state.req = pr.req;
    state.scenario = pr.scenario;
    state.presetId = pr.id;
    renderForm();
    renderPresets();
    setScenario();
    renderPipeline(null);
    run();
    setTimeout(renderTests, 400);
  }
  boot();
})();
