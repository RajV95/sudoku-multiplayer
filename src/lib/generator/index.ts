export type SudokuDifficulty = 'easy' | 'medium' | 'hard' | 'expert';

export interface ISudokuBoard {
  startBoard: number[][]; // 9x9 grid, 0 represents empty cells
  solution: number[][];   // 9x9 grid, fully solved
  difficulty: SudokuDifficulty;
}

export interface ISudokuGenerator {
  generate(difficulty: SudokuDifficulty): Promise<ISudokuBoard>;
}
