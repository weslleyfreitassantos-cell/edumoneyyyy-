/** Deterministic index shuffle so repeated tokens/options remain distinct. */
export function seededExerciseOrder(length: number, seed: string): number[] {
  if (!Number.isInteger(length) || length < 0) return [];

  let state = 2166136261;
  for (const character of seed) {
    state ^= character.codePointAt(0) ?? 0;
    state = Math.imul(state, 16777619);
  }

  const random = () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };

  const order = Array.from({ length }, (_, index) => index);
  for (let index = order.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [order[index], order[swapIndex]] = [order[swapIndex], order[index]];
  }
  return order;
}
