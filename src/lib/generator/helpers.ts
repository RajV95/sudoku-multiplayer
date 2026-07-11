/**
 * Verifies if a given value at (row, col) matches the correct solution value.
 */
export function verifyCell(
  solution: number[][],
  row: number,
  col: number,
  val: number
): boolean {
  if (row < 0 || row >= 9 || col < 0 || col >= 9) return false;
  return solution[row][col] === val;
}

/**
 * Calculates the percentage completion of the board based on the count of correct cells.
 * Only cells matching the solution are counted towards completion.
 */
export function getCompletionProgress(
  solution: number[][],
  currentBoard: number[][]
): {
  progressPercentage: number;
  correctCount: number;
  isComplete: boolean;
} {
  let correctCount = 0;
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (currentBoard[r][c] !== 0 && currentBoard[r][c] === solution[r][c]) {
        correctCount++;
      }
    }
  }

  // A complete board has all 81 correct entries
  const progressPercentage = Math.round((correctCount / 81) * 100);
  const isComplete = correctCount === 81;

  return {
    progressPercentage,
    correctCount,
    isComplete,
  };
}
