# Report: Algorithm 2035, Autonomous DAA Decision Framework

## 1. Problem abstraction

A decision-support platform receives problems without being told which algorithm to use. It must identify the problem, map it to a prescribed DAA formulation, choose a technique, execute it and explain the reasoning.

**Entities:** smart-city records, events, sites and links, projects, matrices, grid blocks.
**Constraints:** budgets, interference rules, connectivity, storage residency, real-time bounds.
**Objective:** minimise cost, maximise value, or decide feasibility, depending on the request.
**Input size parameters:** n (records, events, items, matrices, sites), V and E (graphs), W (capacity).

## 2. Representations

| Problem | Model |
|---|---|
| Ordered data | set of keys with insert and lookup workload |
| Priorities | multiset of (key, item) with insert, decrease-key, extract-min, merge |
| Network connection | undirected weighted graph, adjacency matrix and edge list |
| All-pairs | weighted (optionally directed) graph, distance matrix |
| Resource selection | items (value, weight) and capacity |
| Matrix chain | dimension vector p0..pn |
| Hamiltonian | adjacency matrix, search over partial paths |
| N-Queen | n x n grid, one placement per row, column and diagonal flags |
| TSP | complete distance matrix, search over partial tours |

## 3. Design choices

Recognition uses rules over properties, so the framework never depends on a user naming an algorithm. Selection rules are cost-model or guarantee based (see `docs/ARCHITECTURE.md`), and each solver runs the rejected alternative as evidence. Floyd-Warshall is reused to close missing links before TSP, and the heaps serve as the Branch and Bound frontier.

## 4. Analysis (time and space)

| Technique | Time | Space |
|---|---|---|
| Red-Black Tree | O(log n) | O(n) |
| B-Tree (min degree t) | O(log_t n) node reads | O(n) |
| Binomial Heap | insert O(1) amortised; merge, decrease-key, extract-min O(log n) | O(n) |
| Fibonacci Heap | insert, merge, decrease-key O(1) amortised; extract-min O(log n) amortised | O(n) |
| Prim (matrix) | O(V^2) | O(V^2) |
| Kruskal | O(E log E) | O(V + E) |
| Floyd-Warshall | O(V^3) | O(V^2) |
| Fractional Knapsack | O(n log n) | O(n) |
| 0/1 Knapsack DP | O(nW), pseudo-polynomial | O(nW) |
| Matrix Chain DP | O(n^3) | O(n^2) |
| Hamiltonian, N-Queen, TSP backtracking | O(n!) worst case | O(n) |
| TSP best-first Branch and Bound | exponential worst case | exponential frontier |

Correctness arguments: greedy choice and cut property for Prim and Kruskal; exchange argument for Fractional Knapsack; optimal substructure for the two DPs; exhaustive search with sound pruning for backtracking and Branch and Bound (the lower bound `cost + minOut(last) + sum minOut(unvisited)` never overestimates the remaining tour cost).

## 5. Complexity theory

- TSP: optimisation NP-Hard, decision NP-Complete. Exact methods are limited to modest n.
- 0/1 Knapsack: optimisation NP-Hard, decision NP-Complete, DP is pseudo-polynomial because W is written in log W bits.
- Hamiltonian cycle/path: decision NP-Complete.
- Standard N-Queen is not labelled NP-Complete (solutions exist for every n >= 4 and can be constructed directly); the completion variant is NP-Complete.
- Everything else (MST, all-pairs, Fractional Knapsack, matrix chain, dictionary and priority-queue operations) is polynomial.

## 6. Experiments

Nine generated test families with normal, large, boundary and difficult inputs. Full tables: [RESULTS.md](RESULTS.md). Highlights:

- Prim and Kruskal flip order between sparse and dense graphs.
- Floyd-Warshall work equals V^3 exactly (fitted exponent 3.00).
- Knapsack DP work grows linearly with W while the greedy cost stays flat.
- Fibonacci Heap needs about 3.5 steps per decrease-key against 12 for the Binomial Heap at n = 16,000 under heavy escalation.
- B-Tree (t = 32) needs about 3 node accesses per lookup against 15 for the Red-Black Tree at n = 64,000.
- Plain backtracking TSP multiplies by about 9 per extra site (986,410 states at n = 10); depth-first Branch and Bound needs 13,041 at the same size.
- A complete graph with one pendant site forces about 986,000 states to prove "no Hamiltonian cycle" at n = 11.

## 7. Gaps that motivated newer algorithms

| Gap | Newer approach |
|---|---|
| Binomial decrease-key O(log n) | Fibonacci Heap, Pairing and Strict Fibonacci heaps |
| Red-Black Tree poor for disk | B-Tree, B+ Tree |
| Floyd-Warshall cubic on sparse graphs | Johnson's algorithm |
| 0/1 Knapsack pseudo-polynomial | FPTAS, meet-in-the-middle |
| Factorial TSP | Held-Karp, Christofides, Lin-Kernighan, branch and cut |
| Hamiltonian search ignores degree and connectivity | pruning rules, subset DP |
| Prim with matrix costs V^2 | Prim with Fibonacci Heap, Boruvka |
| Matrix chain cubic | Hu-Shing O(n log n) |

## 8. Demonstrated adaptation

Seven cases change one property and change the result: divisible to indivisible, sparse to dense, memory to disk, 5% to 60% escalations, real-time guarantee on or off, and a different goal on the same network (connect all, round trip, pair costs).

## 9. Limitations

See the README. Counts of elementary steps stand in for hardware behaviour; TSP is limited to 25 sites; large capacities are refused by the 0/1 DP.
