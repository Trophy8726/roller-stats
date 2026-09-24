export const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function generateCode(rand: () => number = Math.random): string {
  let s = '';
  for (let i = 0; i < 4; i++) s += CODE_ALPHABET[Math.floor(rand() * CODE_ALPHABET.length)];
  return s;
}

export function normalizeCode(input: string): string {
  return input.replace(/\s+/g, '').toUpperCase();
}

export function isValidCode(s: string): boolean {
  return /^[A-HJKMNP-Z2-9]{4}$/.test(s);
}
