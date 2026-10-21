// Make an email an admin in the LOCAL Firestore emulator (never touches your real project).
// Usage: npm run emulator:admin -- someone@example.com   (default: admin@example.com)
const email = (process.argv[2] ?? 'admin@example.com').trim().toLowerCase();
const url = `http://127.0.0.1:8080/v1/projects/demo-badminton/databases/(default)/documents/admins/${encodeURIComponent(email)}`;

try {
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: { addedAt: { integerValue: String(Date.now()) } } }),
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  console.log(`${email} is now an admin in the emulator. Sign in with that email from the app's "Sign in" button.`);
} catch (e) {
  console.error(`Couldn't reach the Firestore emulator. Is "npm run emulators" running?\n${e.message}`);
  process.exit(1);
}
