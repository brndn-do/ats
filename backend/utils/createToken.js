import crypto from "crypto";

/**
 * Creates a random token with 256 bits of entropy (cryptographically strong)
 * returned as a 64-character hexademical string.
 * 
 * @returns {string} A hex-encoded string of length 64.
 */
export default function createToken() {
  return crypto.randomBytes(32).toString("hex");
}