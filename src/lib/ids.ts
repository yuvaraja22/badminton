const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

/** Random alphanumeric id, safe to use as a Firestore map key / field path segment. */
export function newId(length = 16): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  let id = '';
  for (const b of bytes) id += ALPHABET[b % ALPHABET.length];
  return id;
}
