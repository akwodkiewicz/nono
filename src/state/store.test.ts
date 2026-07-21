import { describe, expect, it } from 'vitest';
import { migrateV1toV2, useAppStore } from './store';

describe('migrateV1toV2', () => {
  it('pakuje pojedynczą zagadkę v1 w jednoelementową bibliotekę', () => {
    const v1 = {
      rowTexts: ['1', '2'],
      colTexts: ['1', '1', '1'],
      view: 'solver',
      puzzle: { rowClues: [[1], [2]], colClues: [[1], [1], [1]] },
      grid: [[1, 2]],
      steps: [{ line: { kind: 'row', index: 0 }, clue: [1], deductions: [] }],
      status: 'progress',
    };
    const migrated = migrateV1toV2(v1);
    expect(migrated.puzzles).toHaveLength(1);
    const entry = migrated.puzzles[0];
    expect(entry.rowTexts).toEqual(['1', '2']);
    expect(entry.colTexts).toEqual(['1', '1', '1']);
    expect(entry.puzzle).toEqual(v1.puzzle);
    expect(entry.steps).toEqual(v1.steps);
    expect(entry.status).toBe('progress');
    expect(migrated.activeId).toBe(entry.id);
    expect(migrated.view).toBe('solver');
  });

  it('domyśla brakujące pola i mapuje widok na bibliotekę', () => {
    const migrated = migrateV1toV2({});
    expect(migrated.puzzles).toHaveLength(1);
    expect(migrated.puzzles[0].status).toBe('ready');
    expect(migrated.puzzles[0].steps).toEqual([]);
    expect(migrated.view).toBe('library');
  });
});

describe('biblioteka zagadek', () => {
  it('przełączanie zagadek zachowuje osobny stan każdej', () => {
    const store = useAppStore;
    store.getState().newPuzzle();
    const idA = store.getState().activeId;
    store.getState().setRowTexts(['1', '2']);

    store.getState().newPuzzle();
    const idB = store.getState().activeId;
    expect(idB).not.toBe(idA);
    store.getState().setRowTexts(['3', '3', '3']);

    store.getState().openPuzzle(idA!);
    expect(store.getState().activeId).toBe(idA);
    expect(store.getState().rowTexts).toEqual(['1', '2']);

    store.getState().openPuzzle(idB!);
    expect(store.getState().rowTexts).toEqual(['3', '3', '3']);

    const entryA = store.getState().puzzles.find((p) => p.id === idA);
    expect(entryA?.rowTexts).toEqual(['1', '2']);
  });

  it('zachowuje postęp solvera po przełączeniu i wznawia w solverze', () => {
    const store = useAppStore;
    store.getState().newPuzzle();
    const id = store.getState().activeId!;
    store.getState().setRowTexts(['1']);
    store.getState().setColTexts(['1']);
    store.getState().startSolver();
    store.getState().stepOnce();
    const steps = store.getState().steps.length;
    expect(steps).toBeGreaterThan(0);
    expect(store.getState().view).toBe('solver');

    store.getState().newPuzzle();
    store.getState().openPuzzle(id);
    expect(store.getState().view).toBe('solver');
    expect(store.getState().steps.length).toBe(steps);
    expect(store.getState().puzzle).toBeDefined();
  });

  it('updatedAt to data edycji definicji, nie ruszają jej kroki solvera', () => {
    const store = useAppStore;
    store.getState().newPuzzle();
    const id = store.getState().activeId!;
    store.getState().setRowTexts(['1']);
    store.getState().setColTexts(['1']);
    const afterDefine = store.getState().puzzles.find((p) => p.id === id)!.updatedAt;

    store.getState().startSolver();
    store.getState().stepOnce();
    const afterSolve = store.getState().puzzles.find((p) => p.id === id)!.updatedAt;
    expect(afterSolve).toBe(afterDefine);
  });

  it('usunięcie aktywnej zagadki wraca do biblioteki', () => {
    const store = useAppStore;
    store.getState().newPuzzle();
    const id = store.getState().activeId!;
    store.getState().deletePuzzle(id);
    expect(store.getState().activeId).toBeNull();
    expect(store.getState().view).toBe('library');
    expect(store.getState().puzzles.find((p) => p.id === id)).toBeUndefined();
  });
});
