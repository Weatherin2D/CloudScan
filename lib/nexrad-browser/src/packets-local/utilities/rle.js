export function expand4_4(byte) {
  const run = byte >> 4;
  const value = byte & 0x0f;
  const result = [];
  for (let i = 0; i < run; i += 1) {
    result.push(value);
  }
  return result;
}
