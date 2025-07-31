import dotenv from "dotenv";
dotenv.config();

import jwt from "jsonwebtoken";
import crypto from "crypto";
import hash from "./hash.js";

/**
 * 
 * @param {number} id - The user's ID in the database.
 * @param {string} username - The user's username.
 * @param {boolean} isAdmin - Whether the user has admin privileges.
 * @returns {{accessToken: string, refreshToken: string, refreshTokenHash: string }}
 * An object containing:
 *  - `accessToken`: JWT signed with user data.
 *  - `refreshToken`: Random token with 256 bits of entropy (cryptographically strong)
 *  - `refreshTokenHash`: Hashed version to store in the databse.
 * 
 * @example
 * const tokens = createTokens(1, "alice", false);
 * // {
 * //   accessToken: "eyJhbGciOiJIUzI1NiIs...",
 * //   refreshToken: "b8b1c2e6...",
 * //   refreshTokenHash: "a3e1e99..."
 * // }
 */
export default function createTokens(id, username, isAdmin) {
  const payload = {
    sub: id,
    name: username,
    isAdmin: isAdmin,
  }

  // Create access token
  const accessToken = jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: "5m",
  });

  // Create refresh token
  const refreshToken = crypto.randomBytes(32).toString("hex");
  const refreshTokenHash = hash(refreshToken);

  return { accessToken, refreshToken, refreshTokenHash };
}