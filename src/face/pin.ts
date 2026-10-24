/**
 * Face Lock PIN Management
 * PBKDF2 via crypto.subtle: SHA-256, 150,000 iterations, 16-byte random salt, 32-byte output.
 * SPEC Section 8.3.
 */

export async function hashPin(pin: string): Promise<{ pinHash: string; pinSalt: string }> {
  if (typeof pin !== "string" || pin.trim().length < 4) {
    throw new Error("PIN must be at least 4 digits");
  }

  const enc = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(pin),
    { name: "PBKDF2" },
    false,
    ["deriveBits", "deriveKey"]
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt,
      iterations: 150000,
      hash: "SHA-256",
    },
    keyMaterial,
    256
  );

  const pinHash = bytesToBase64(new Uint8Array(derivedBits));
  const pinSalt = bytesToBase64(salt);

  return { pinHash, pinSalt };
}

export async function verifyPin(pin: string, storedHash: string, storedSalt: string): Promise<boolean> {
  if (!pin || !storedHash || !storedSalt) return false;

  try {
    const enc = new TextEncoder();
    const salt = base64ToBytes(storedSalt);
    const expected = base64ToBytes(storedHash);

    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      enc.encode(pin),
      { name: "PBKDF2" },
      false,
      ["deriveBits"]
    );

    const derivedBits = await crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        salt: salt as any,
        iterations: 150000,
        hash: "SHA-256",
      },
      keyMaterial,
      256
    );

    const actual = new Uint8Array(derivedBits);
    if (actual.length !== expected.length) return false;

    let diff = 0;
    for (let i = 0; i < actual.length; i++) {
      diff |= actual[i] ^ expected[i];
    }
    return diff === 0;
  } catch (err) {
    console.error("[eX] PIN verification failed:", err);
    return false;
  }
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
