// ─── Shared math utilities ────────────────────────────────────────────────────

export const lerp = (a, b, t) => a + (b - a) * t;

export function sliceAvg(arr, s, e) {
  let sum = 0;
  for (let i = s; i < e; i++) sum += arr[i];
  return (sum / (e - s)) / 255;
}
