// src/solver/types.ts
var UNKNOWN = 0;
var FILLED = 1;
var EMPTY = 2;
function puzzleWidth(puzzle) {
  return puzzle.colClues.length;
}
function puzzleHeight(puzzle) {
  return puzzle.rowClues.length;
}
function emptyGrid(height, width) {
  return Array.from({ length: height }, () => Array(width).fill(UNKNOWN));
}

// src/solver/line.ts
function normalizeClue(clue) {
  return clue.filter((block) => block > 0);
}
function solveLine(line, clueRaw) {
  const clue = normalizeClue(clueRaw);
  const n = line.length;
  const k = clue.length;
  const emptyBefore = new Array(n + 1).fill(0);
  for (let i = 0; i < n; i++) {
    emptyBefore[i + 1] = emptyBefore[i] + (line[i] === EMPTY ? 1 : 0);
  }
  const canPlace = (pos, len) => {
    if (pos + len > n) return false;
    if (emptyBefore[pos + len] - emptyBefore[pos] > 0) return false;
    if (pos + len < n && line[pos + len] === FILLED) return false;
    return true;
  };
  const canComplete = Array.from(
    { length: n + 1 },
    () => new Array(k + 1).fill(false)
  );
  canComplete[n][k] = true;
  for (let pos = n - 1; pos >= 0; pos--) {
    canComplete[pos][k] = line[pos] !== FILLED && canComplete[pos + 1][k];
  }
  for (let blk = k - 1; blk >= 0; blk--) {
    const len = clue[blk];
    for (let pos = n - 1; pos >= 0; pos--) {
      let ok = line[pos] !== FILLED && canComplete[pos + 1][blk];
      if (!ok && canPlace(pos, len)) {
        const afterGap = pos + len === n ? n : pos + len + 1;
        ok = canComplete[afterGap][blk + 1];
      }
      canComplete[pos][blk] = ok;
    }
  }
  if (!canComplete[0][0]) return null;
  const canBeFilled = new Array(n).fill(false);
  const canBeEmpty = new Array(n).fill(false);
  const reachable = Array.from(
    { length: n + 1 },
    () => new Array(k + 1).fill(false)
  );
  reachable[0][0] = true;
  for (let pos = 0; pos < n; pos++) {
    for (let blk = 0; blk <= k; blk++) {
      if (!reachable[pos][blk]) continue;
      if (line[pos] !== FILLED && canComplete[pos + 1][blk]) {
        canBeEmpty[pos] = true;
        reachable[pos + 1][blk] = true;
      }
      if (blk < k) {
        const len = clue[blk];
        if (canPlace(pos, len)) {
          const afterGap = pos + len === n ? n : pos + len + 1;
          if (canComplete[afterGap][blk + 1]) {
            for (let i = pos; i < pos + len; i++) canBeFilled[i] = true;
            if (pos + len < n) canBeEmpty[pos + len] = true;
            reachable[afterGap][blk + 1] = true;
          }
        }
      }
    }
  }
  const result = new Array(n);
  for (let i = 0; i < n; i++) {
    const filled = canBeFilled[i];
    const empty = canBeEmpty[i];
    if (filled && empty) {
      result[i] = line[i];
    } else if (filled) {
      result[i] = FILLED;
    } else if (empty) {
      result[i] = EMPTY;
    } else {
      return null;
    }
  }
  return result;
}

// src/solver/solver.ts
var Solver = class {
  puzzle;
  width;
  height;
  grid;
  steps = [];
  queue = [];
  queued = /* @__PURE__ */ new Set();
  constructor(puzzle) {
    this.puzzle = puzzle;
    this.width = puzzleWidth(puzzle);
    this.height = puzzleHeight(puzzle);
    this.grid = emptyGrid(this.height, this.width);
    this.enqueueAll();
  }
  /** Jeden krok: analizuje linie z kolejki, aż któraś da nowe wnioski. */
  step() {
    while (this.queue.length > 0) {
      const ref = this.queue.shift();
      this.queued.delete(lineKey(ref));
      const line = this.getLine(ref);
      const clue = this.getClue(ref);
      const solved = solveLine(line, clue);
      if (solved === null) {
        return { status: "contradiction", contradiction: ref };
      }
      const deductions = [];
      for (let i = 0; i < solved.length; i++) {
        if (line[i] === UNKNOWN && solved[i] !== UNKNOWN) {
          deductions.push({
            row: ref.kind === "row" ? ref.index : i,
            col: ref.kind === "row" ? i : ref.index,
            value: solved[i]
          });
        }
      }
      if (deductions.length === 0) continue;
      for (const d of deductions) {
        this.grid[d.row][d.col] = d.value;
        this.enqueue(
          ref.kind === "row" ? { kind: "col", index: d.col } : { kind: "row", index: d.row }
        );
      }
      const step = { line: ref, clue: normalizeClue(clue), deductions };
      this.steps.push(step);
      if (this.isSolved()) {
        const conflict = this.verifyRemaining();
        if (conflict) {
          return { status: "contradiction", contradiction: conflict, step };
        }
        return { status: "solved", step };
      }
      return { status: "progress", step };
    }
    return { status: this.isSolved() ? "solved" : "stuck" };
  }
  /** Sprawdza pozostałe linie z kolejki; zwraca linię sprzeczną albo null. */
  verifyRemaining() {
    while (this.queue.length > 0) {
      const ref = this.queue.shift();
      this.queued.delete(lineKey(ref));
      if (solveLine(this.getLine(ref), this.getClue(ref)) === null) {
        return ref;
      }
    }
    return null;
  }
  /** Rozwiązuje do rozwiązania, utknięcia lub sprzeczności. */
  run(maxSteps = Number.POSITIVE_INFINITY) {
    let result = this.step();
    let count = 1;
    while (result.status === "progress" && count < maxSteps) {
      result = this.step();
      count++;
    }
    return result;
  }
  /** Cofa ostatni krok. Wszystkie linie wracają do kolejki. */
  undo() {
    const step = this.steps.pop();
    if (!step) return void 0;
    for (const d of step.deductions) {
      this.grid[d.row][d.col] = UNKNOWN;
    }
    this.queue = [];
    this.queued.clear();
    this.enqueueAll();
    return step;
  }
  isSolved() {
    return this.grid.every((row) => row.every((cell) => cell !== UNKNOWN));
  }
  unknownCount() {
    let count = 0;
    for (const row of this.grid) {
      for (const cell of row) {
        if (cell === UNKNOWN) count++;
      }
    }
    return count;
  }
  enqueueAll() {
    for (let r = 0; r < this.height; r++) this.enqueue({ kind: "row", index: r });
    for (let c = 0; c < this.width; c++) this.enqueue({ kind: "col", index: c });
  }
  enqueue(ref) {
    const key = lineKey(ref);
    if (this.queued.has(key)) return;
    this.queued.add(key);
    this.queue.push(ref);
  }
  getLine(ref) {
    return ref.kind === "row" ? [...this.grid[ref.index]] : this.grid.map((row) => row[ref.index]);
  }
  getClue(ref) {
    return ref.kind === "row" ? this.puzzle.rowClues[ref.index] : this.puzzle.colClues[ref.index];
  }
};
function lineKey(ref) {
  return `${ref.kind}:${ref.index}`;
}
export {
  Solver
};
