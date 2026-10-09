import type { NavInstruction, Waypoint } from '@/features/route/domain';

/** Backend distances describe maneuver starts. Geometry only interpolates between those anchors. */
export function instructionProgress(
  instructions: readonly NavInstruction[],
  index: number,
  geometry?: { alongM: number; waypoints: readonly Waypoint[] },
): { totalM: number; remainingM: number } | null {
  const distances = instructions.map((step) => step.cumulativeDistanceM);
  if (!distances.length || distances.some((distance, i) => distance == null || !Number.isFinite(distance) || distance < 0 || (i > 0 && distance < distances[i - 1]!))) return null;
  const last = instructions.at(-1)!;
  const totalM = last.cumulativeDistanceM! + Math.max(0, last.distanceM ?? 0);
  let completed = instructions[index]?.cumulativeDistanceM;
  if (geometry && geometry.waypoints.length === instructions.length) {
    const { alongM, waypoints } = geometry;
    let before = 0;
    while (before + 1 < waypoints.length && waypoints[before + 1].alongM <= alongM) before++;
    const next = before + 1;
    const start = waypoints[before].alongM;
    const end = waypoints[next]?.alongM;
    completed = distances[before]!;
    if (end != null && end > start) {
      const ratio = Math.min(1, Math.max(0, (alongM - start) / (end - start)));
      completed += ratio * (distances[next]! - distances[before]!);
    }
  }
  return totalM > 0 && completed != null ? { totalM, remainingM: Math.max(0, totalM - completed) } : null;
}
