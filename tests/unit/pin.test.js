import assert from "node:assert";
import { hashPin, verifyPin } from "../../src/face/pin.ts";

async function run() {
  console.log("Testing pin.ts (PBKDF2)...");

  // 1. Minimum length validation
  let caught = false;
  try {
    await hashPin("12");
  } catch (e) {
    caught = true;
  }
  assert.strictEqual(caught, true, "PIN under 4 chars must throw");

  // 2. Hash generation
  const { pinHash, pinSalt } = await hashPin("9876");
  assert.ok(pinHash, "pinHash should be defined");
  assert.ok(pinSalt, "pinSalt should be defined");
  assert.strictEqual(Buffer.from(pinSalt, "base64").length, 16, "Salt must be 16 bytes");
  assert.strictEqual(Buffer.from(pinHash, "base64").length, 32, "Hash must be 32 bytes (256 bits)");

  // 3. Correct verification
  const valid = await verifyPin("9876", pinHash, pinSalt);
  assert.strictEqual(valid, true, "Correct PIN must verify");

  // 4. Incorrect verification
  const invalid = await verifyPin("1234", pinHash, pinSalt);
  assert.strictEqual(invalid, false, "Incorrect PIN must not verify");

  // 5. Empty / missing input
  const empty = await verifyPin("", pinHash, pinSalt);
  assert.strictEqual(empty, false, "Empty PIN must fail");

  console.log("PASS: pin.test.js");
}

run().catch((e) => {
  console.error("FAIL: pin.test.js", e);
  process.exit(1);
});
