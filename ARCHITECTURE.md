# Architecture

## Pipeline

```
SCENARIO INPUT -> PROBLEM MODEL -> DAA CHOICE -> EXECUTION -> ANALYSIS -> EXPLANATION
```

A request is `{ structure, props, data }`:

- `structure`: records, events, network, items, matrices or grid
- `props`: goal, directed, divisible, residency, decreaseShare, realtime, conflict, size ...
- `data`: link list, item list, matrix dimensions

## 1. Problem model: recognition

`RULES` in `src/engine.js` is an ordered list of ten rules R1 to R10. Each rule is a predicate over `structure` and `props` only. `recognise()` evaluates all ten, records which matched (shown in the UI as the rule trace) and takes the first match. Two requests with the same data but different properties (for example `goal: connect-all` vs `round-trip`) are recognised as different problems.

## 2. DAA choice: selection rules

| Problem | Decision rule | Basis |
|---|---|---|
| Ordered data | disk residency: B-Tree; memory: Red-Black Tree | cost is block reads vs comparisons |
| Priorities | real-time: Binomial; decrease-key share >= 30%, or >= 10% with merging: Fibonacci; otherwise Binomial | worst-case vs amortised bounds |
| MST | compare 2V^2 (Prim, matrix) with E log2 E + 2E (Kruskal), pick the lower | estimated step counts from V and E |
| All pairs | Floyd-Warshall | goal needs every pair |
| Resource budget | divisible: greedy; indivisible: DP | exchange argument vs optimal substructure |
| Matrix chain | DP | optimal substructure |
| Hamiltonian, N-Queen | backtracking | feasibility, no cost to bound |
| TSP | depth-first Branch and Bound; backtracking and best-first also run for n <= 10 / 13 | cost minimisation allows bound pruning |

After choosing, the solver also runs the alternative on the same input so every explanation carries measured evidence (for example greedy 130 vs DP 170 on the indivisible-upgrades scenario).

## 3. Execution

`src/structures.js` and `src/algorithms.js` are independent of the interface. Every routine returns its answer plus counters (`ops`, `states`, `pruned`, `maxQueue`). Best-first TSP uses the Binomial or Fibonacci Heap as its frontier, so the heaps are exercised by a second part of the framework.

## 4. Analysis and explanation

`D.solve()` returns: recognised problem, rule, model summary, chosen technique with reasons, rejected alternatives with reasons, time and space complexity, a complexity class (decision and optimisation forms), result blocks and warnings. `src/app.js` renders it with a pipeline strip.

## 5. Stress-test lab

`src/experiments.js` defines nine experiments. Polynomial families fit a log-log slope and compare it with the expected exponent; exponential families look at the growth ratio between consecutive sizes. Output: Low, Moderate or High risk with the reason.

## 6. Quality checks

`src/tests.js` verifies each structure and algorithm against an independent method (sorted order and invariants, brute force over 2^10 subsets, Bellman-Ford, exhaustive recursion, known N-Queen counts) and checks that the adaptation demos change the selected technique. CI runs them on every push.
