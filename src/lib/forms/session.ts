/**
 * Feedback Form Session Management
 *
 * Signs and verifies HttpOnly session cookies for tester authentication.
 * Cookies are signed with HMAC-SHA256 using FORM_SESSION_SECRET.
 * Password version is embedded so changing the form password invalidates
 * all existing sessions without a server-side session store.
 *
 * Cookie format: base64url(payload).base64url(signature)
 */

import { createHmac, timingSafeEqual } from "crypto";
import type { NextRequest } from "next/server";
import type { NextResponse } from "next/server";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FormSessionPayload {
  formId: string;
  slug: string;
  /** Must match feedback_forms.password_version at verification time. */
  passwordVersion: number;
  /** Unix ms — used to enforce 7-day expiry. */
  issuedAt: number;
}

export interface SessionValidationResult {
  valid: boolean;
  payload?: FormSessionPayload;
  reason?: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export function getCookieName(slug: string): string {
  return `ascend-form-session-${slug}`;
}

// ─── Signing ─────────────────────────────────────────────────────────────────

function getSecret(): string {
  const secret = process.env.FORM_SESSION_SECRET;
  if (!secret) {
    throw new Error("FORM_SESSION_SECRET env var is not set");
  }
  return secret;
}

function b64urlEncode(str: string): string {
  return Buffer.from(str, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

function b64urlDecode(str: string): string {
  const padded = str.replace(/-/g, "+").replace(/_/g, "/");
  const pad = padded.length % 4;
  return Buffer.from(pad ? padded + "=".repeat(4 - pad) : padded, "base64").toString("utf8");
}

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret)
    .update(payload)
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Create a signed cookie value from a session payload.
 */
export function createSessionCookie(payload: FormSessionPayload): string {
  const encodedPayload = b64urlEncode(JSON.stringify(payload));
  const signature = sign(encodedPayload, getSecret());
  return `${encodedPayload}.${signature}`;
}

/**
 * Parse and verify a cookie value.
 * Does NOT check passwordVersion against the DB — caller must do that.
 */
export function parseSessionCookie(cookieValue: string): SessionValidationResult {
  const parts = cookieValue.split(".");
  // Cookie has format: payload.signature — payload itself is base64url (no dots)
  if (parts.length !== 2) {
    return { valid: false, reason: "malformed_cookie" };
  }

  const [encodedPayload, receivedSig] = parts;

  // Verify signature (timing-safe)
  const expectedSig = sign(encodedPayload, getSecret());
  try {
    const expected = Buffer.from(expectedSig, "utf8");
    const received = Buffer.from(receivedSig, "utf8");
    if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
      return { valid: false, reason: "invalid_signature" };
    }
  } catch {
    return { valid: false, reason: "invalid_signature" };
  }

  // Decode payload
  let payload: FormSessionPayload;
  try {
    payload = JSON.parse(b64urlDecode(encodedPayload)) as FormSessionPayload;
  } catch {
    return { valid: false, reason: "malformed_payload" };
  }

  // Check expiry
  if (Date.now() - payload.issuedAt > SESSION_TTL_MS) {
    return { valid: false, reason: "expired" };
  }

  return { valid: true, payload };
}

/**
 * Read and verify the session cookie from a request.
 * Returns null if missing or invalid.
 */
export function getFormSession(
  request: NextRequest,
  slug: string
): FormSessionPayload | null {
  const cookieName = getCookieName(slug);
  const cookieValue = request.cookies.get(cookieName)?.value;
  if (!cookieValue) return null;

  const result = parseSessionCookie(cookieValue);
  return result.valid && result.payload ? result.payload : null;
}

/**
 * Attach a session cookie to a response.
 * Path is scoped to /forms/[slug] to prevent cross-form session bleed.
 */
export function setFormSessionCookie(
  response: NextResponse,
  slug: string,
  payload: FormSessionPayload
): void {
  const cookieName = getCookieName(slug);
  const cookieValue = createSessionCookie(payload);
  const maxAgeSeconds = SESSION_TTL_MS / 1000;

  response.cookies.set(cookieName, cookieValue, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: maxAgeSeconds,
  });
}

/**
 * Hash a plaintext password using Node.js scrypt.
 * scrypt is the recommended modern alternative to bcrypt — no extra packages needed.
 * Returns a hex string: `salt:hash`
 */
export async function hashPassword(password: string): Promise<string> {
  const { scrypt, randomBytes } = await import("crypto");
  const { promisify } = await import("util");
  const scryptAsync = promisify(scrypt);

  const salt = randomBytes(16).toString("hex");
  const hash = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt}:${hash.toString("hex")}`;
}

/**
 * Verify a plaintext password against a stored `salt:hash` string.
 */
export async function verifyPassword(
  password: string,
  stored: string
): Promise<boolean> {
  const { scrypt, timingSafeEqual: tse } = await import("crypto");
  const { promisify } = await import("util");
  const scryptAsync = promisify(scrypt);

  const [salt, hashHex] = stored.split(":");
  if (!salt || !hashHex) return false;

  try {
    const hash = (await scryptAsync(password, salt, 64)) as Buffer;
    const storedHash = Buffer.from(hashHex, "hex");
    return hash.length === storedHash.length && tse(hash, storedHash);
  } catch {
    return false;
  }
}
