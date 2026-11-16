export type ComparisonWinner = "left" | "right" | null;
export type ComparisonDirection = "higher" | "lower";

export function comparisonWinner(
  left: number | null,
  right: number | null,
  direction: ComparisonDirection,
): ComparisonWinner {
  if (left == null || right == null || left === right) return null;
  const leftIsBetter = direction === "higher" ? left > right : left < right;
  return leftIsBetter ? "left" : "right";
}
