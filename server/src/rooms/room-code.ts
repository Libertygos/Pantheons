/**
 * Room-code generator (wog-room.md §6.1). Short, human-typable invite codes. Alphabet
 * avoids ambiguous glyphs (0/O, 1/I/L).
 */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const ROOM_CODE_LENGTH = 5;

export function generateRoomCode(rng: () => number = Math.random): string {
  let code = '';
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    code += ALPHABET[Math.floor(rng() * ALPHABET.length)]!;
  }
  return code;
}

export function normalizeRoomCode(input: unknown): string {
  return typeof input === 'string' ? input.trim().toUpperCase() : '';
}
