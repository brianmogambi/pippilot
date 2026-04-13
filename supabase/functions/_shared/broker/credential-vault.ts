// supabase/functions/_shared/broker/credential-vault.ts
//
// Phase 14: Symmetric encryption for broker credentials at rest.
// Uses AES-256-GCM via the Web Crypto API (available in Deno).
// The encryption key is read from the BROKER_CREDENTIAL_KEY env var
// (must be a 64-char hex string = 32 bytes).

import type { BrokerCredentials } from "./types.ts";

// deno-lint-ignore no-explicit-any
declare const Deno: any;

const ALGORITHM = "AES-GCM";
const IV_BYTES = 12;
const KEY_ENV = "BROKER_CREDENTIAL_KEY";

function getKeyHex(): string {
  const hex = Deno.env.get(KEY_ENV);
  if (!hex || hex.length !== 64) {
    throw new Error(
      `${KEY_ENV} must be set to a 64-character hex string (32 bytes).`,
    );
  }
  return hex;
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function importKey(): Promise<CryptoKey> {
  const raw = hexToBytes(getKeyHex());
  return crypto.subtle.importKey("raw", raw, ALGORITHM, false, [
    "encrypt",
    "decrypt",
  ]);
}

/**
 * Encrypt a BrokerCredentials object into a hex string (iv + ciphertext).
 */
export async function encryptCredentials(
  plain: BrokerCredentials,
): Promise<string> {
  const key = await importKey();
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const encoded = new TextEncoder().encode(JSON.stringify(plain));

  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: ALGORITHM, iv }, key, encoded),
  );

  // Prepend IV to ciphertext, encode as hex.
  const combined = new Uint8Array(iv.length + ciphertext.length);
  combined.set(iv, 0);
  combined.set(ciphertext, iv.length);
  return bytesToHex(combined);
}

/**
 * Decrypt a hex string back into BrokerCredentials.
 */
export async function decryptCredentials(
  encrypted: string,
): Promise<BrokerCredentials> {
  const key = await importKey();
  const combined = hexToBytes(encrypted);

  const iv = combined.slice(0, IV_BYTES);
  const ciphertext = combined.slice(IV_BYTES);

  const decrypted = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv },
    key,
    ciphertext,
  );

  return JSON.parse(new TextDecoder().decode(decrypted)) as BrokerCredentials;
}
