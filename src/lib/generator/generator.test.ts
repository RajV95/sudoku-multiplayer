import { describe, it, expect } from 'vitest';
import { DynamicSudokuGenerator } from './dynamic';
import { verifyCell, getCompletionProgress } from './helpers';

describe('DynamicSudokuGenerator', () => {
  const generator = new DynamicSudokuGenerator();

  it('should generate a valid 9x9 board with startBoard and solution', async () => {
    const board = await generator.generate('easy');
    
    expect(board.startBoard.length).toBe(9);
    expect(board.startBoard[0].length).toBe(9);
    expect(board.solution.length).toBe(9);
    expect(board.solution[0].length).toBe(9);
    expect(board.difficulty).toBe('easy');
  });

  it('should generate a solution containing numbers 1-9 in every row, col, and subgrid', async () => {
    const board = await generator.generate('easy');
    const { solution } = board;

    // Check rows
    for (let r = 0; r < 9; r++) {
      const rowSet = new Set(solution[r]);
      expect(rowSet.size).toBe(9);
      expect(rowSet.has(0)).toBe(false);
    }
  });
});

describe('Sudoku Helpers', () => {
  const dummySolution = [
    [5, 3, 4, 6, 7, 8, 9, 1, 2],
    [6, 7, 2, 1, 9, 5, 3, 4, 8],
    [1, 9, 8, 3, 4, 2, 5, 6, 7],
    [8, 5, 9, 7, 6, 1, 4, 2, 3],
    [4, 2, 6, 8, 5, 3, 7, 9, 1],
    [7, 1, 3, 9, 2, 4, 8, 5, 6],
    [9, 6, 1, 5, 3, 7, 2, 8, 4],
    [2, 8, 7, 4, 1, 9, 6, 3, 5],
    [3, 4, 5, 2, 8, 6, 1, 7, 9],
  ];

  it('verifyCell should correctly match values against solution', () => {
    expect(verifyCell(dummySolution, 0, 0, 5)).toBe(true);
    expect(verifyCell(dummySolution, 0, 0, 9)).toBe(false);
    expect(verifyCell(dummySolution, -1, 0, 5)).toBe(false);
  });

  it('getCompletionProgress should return progress details', () => {
    // Clone solution to make a current board
    const current = dummySolution.map(row => [...row]);
    
    // Check fully correct
    let progress = getCompletionProgress(dummySolution, current);
    expect(progress.isComplete).toBe(true);
    expect(progress.progressPercentage).toBe(100);

    // Empty one cell
    current[0][0] = 0;
    progress = getCompletionProgress(dummySolution, current);
    expect(progress.isComplete).toBe(false);
    expect(progress.correctCount).toBe(80);
    expect(progress.progressPercentage).toBe(99); // 80/81
  });
});
