/** Barber Passport curve: same formula as public.bc_passport_xp_next. */
export function xpForNextLevel(level: number): number | null {
  if (!Number.isInteger(level) || level < 1 || level > 20)
    throw new RangeError("level must be an integer 1..20");
  if (level === 20) return null;
  return 100 + 50 * (level - 1) + 10 * (level - 1) ** 2;
}
export function passportLevel(xpClient: number): number {
  if (!Number.isSafeInteger(xpClient) || xpClient < 0)
    throw new RangeError("xpClient must be a non-negative safe integer");
  let level = 1, remainder = xpClient;
  while (level < 20) {
    const toNext = xpForNextLevel(level)!;
    if (remainder < toNext) break;
    remainder -= toNext;
    level++;
  }
  return level;
}
export function passportProgress(xpClient: number) {
  const level = passportLevel(xpClient);
  let consumed = 0;
  for (let i = 1; i < level; i++) consumed += xpForNextLevel(i)!;
  const required = xpForNextLevel(level);
  return {level, xpIntoLevel:xpClient-consumed, xpForNext:required, isMaxLevel:level===20};
}
