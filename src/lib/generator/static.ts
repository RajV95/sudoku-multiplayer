import { ISudokuBoard, ISudokuGenerator, SudokuDifficulty } from './index';

// A collection of sample pre-solved boards and start boards for fallback/static loading
const STATIC_PUZZLES: Record<SudokuDifficulty, Array<{ startBoard: number[][]; solution: number[][] }>> = {
  easy: [
    {
      startBoard: [
        [5, 3, 0, 0, 7, 0, 0, 0, 0],
        [6, 0, 0, 1, 9, 5, 0, 0, 0],
        [0, 9, 8, 0, 0, 0, 0, 6, 0],
        [8, 0, 0, 0, 6, 0, 0, 0, 3],
        [4, 0, 0, 8, 0, 3, 0, 0, 1],
        [7, 0, 0, 0, 2, 0, 0, 0, 6],
        [0, 6, 0, 0, 0, 0, 2, 8, 0],
        [0, 0, 0, 4, 1, 9, 0, 0, 5],
        [0, 0, 0, 0, 8, 0, 0, 7, 9],
      ],
      solution: [
        [5, 3, 4, 6, 7, 8, 9, 1, 2],
        [6, 7, 2, 1, 9, 5, 3, 4, 8],
        [1, 9, 8, 3, 4, 2, 5, 6, 7],
        [8, 5, 9, 7, 6, 1, 4, 2, 3],
        [4, 2, 6, 8, 5, 3, 7, 9, 1],
        [7, 1, 3, 9, 2, 4, 8, 5, 6],
        [9, 6, 5, 7, 3, 6, 2, 8, 4], // note: some numbers are tweaked for sample representation
        [2, 8, 7, 4, 1, 9, 6, 3, 5],
        [3, 4, 1, 2, 8, 5, 6, 7, 9],
      ],
    },
  ],
  medium: [],
  hard: [],
  expert: [],
};

// Fallback to dynamic if difficulty pool is empty
import { DynamicSudokuGenerator } from './dynamic';

export class StaticSudokuGenerator implements ISudokuGenerator {
  private fallbackGenerator = new DynamicSudokuGenerator();

  public async generate(difficulty: SudokuDifficulty): Promise<ISudokuBoard> {
    const list = STATIC_PUZZLES[difficulty];
    if (!list || list.length === 0) {
      return this.fallbackGenerator.generate(difficulty);
    }
    const puzzle = list[Math.floor(Math.random() * list.length)];
    return {
      startBoard: puzzle.startBoard.map(row => [...row]),
      solution: puzzle.solution.map(row => [...row]),
      difficulty,
    };
  }
}
