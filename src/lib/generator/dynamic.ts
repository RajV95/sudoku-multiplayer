import { ISudokuBoard, ISudokuGenerator, SudokuDifficulty } from './index';

export class DynamicSudokuGenerator implements ISudokuGenerator {
  // Checks if placing `num` at `board[row][col]` is valid
  private isValid(board: number[][], row: number, col: number, num: number): boolean {
    for (let i = 0; i < 9; i++) {
      // Check row
      if (board[row][i] === num) return false;
      // Check column
      if (board[i][col] === num) return false;
      // Check 3x3 subgrid
      const boxRow = 3 * Math.floor(row / 3) + Math.floor(i / 3);
      const boxCol = 3 * Math.floor(col / 3) + (i % 3);
      if (board[boxRow][boxCol] === num) return false;
    }
    return true;
  }

  // Solves the board using backtracking
  private solveBoard(board: number[][]): boolean {
    for (let row = 0; row < 9; row++) {
      for (let col = 0; col < 9; col++) {
        if (board[row][col] === 0) {
          const numbers = this.shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);
          for (const num of numbers) {
            if (this.isValid(board, row, col, num)) {
              board[row][col] = num;
              if (this.solveBoard(board)) {
                return true;
              }
              board[row][col] = 0; // Backtrack
            }
          }
          return false; // No valid number found
        }
      }
    }
    return true; // Solved
  }

  // Utility to shuffle an array
  private shuffle(array: number[]): number[] {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  // Generates a fully solved 9x9 board
  private generateSolvedBoard(): number[][] {
    const board = Array.from({ length: 9 }, () => Array(9).fill(0));
    this.solveBoard(board);
    return board;
  }

  // Copies a board
  private cloneBoard(board: number[][]): number[][] {
    return board.map((row) => [...row]);
  }

  // Removes numbers to create the puzzle based on difficulty
  private createPuzzle(solvedBoard: number[][], difficulty: SudokuDifficulty): number[][] {
    const puzzle = this.cloneBoard(solvedBoard);
    
    // Define cell removal targets
    let cellsToRemove = 35; // default easy
    switch (difficulty) {
      case 'easy':
        cellsToRemove = 35;
        break;
      case 'medium':
        cellsToRemove = 44;
        break;
      case 'hard':
        cellsToRemove = 51;
        break;
      case 'expert':
        cellsToRemove = 57;
        break;
    }

    // Generate indices 0-80 and shuffle
    const indices = this.shuffle(Array.from({ length: 81 }, (_, i) => i));

    let removed = 0;
    for (const idx of indices) {
      if (removed >= cellsToRemove) break;
      const row = Math.floor(idx / 9);
      const col = idx % 9;

      if (puzzle[row][col] !== 0) {
        puzzle[row][col] = 0;
        removed++;
      }
    }

    return puzzle;
  }

  public async generate(difficulty: SudokuDifficulty): Promise<ISudokuBoard> {
    const solution = this.generateSolvedBoard();
    const startBoard = this.createPuzzle(solution, difficulty);

    return {
      startBoard,
      solution,
      difficulty,
    };
  }
}
