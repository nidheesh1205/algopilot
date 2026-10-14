// node tests/run-tests.js  - runs the built-in correctness checks and exits non-zero on failure
const path = require('path');
for (const f of ['structures', 'algorithms', 'engine', 'experiments', 'tests']) require(path.join(__dirname, '..', 'src', f + '.js'));
const res = globalThis.DAA.runTests();
res.forEach((r) => console.log((r.pass ? 'PASS ' : 'FAIL ') + r.name + (r.detail ? ' -> ' + r.detail : '')));
const ok = res.filter((r) => r.pass).length;
console.log('\n' + ok + '/' + res.length + ' checks passed');
process.exit(ok === res.length ? 0 : 1);
