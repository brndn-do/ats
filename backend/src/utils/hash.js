import crypto from 'crypto';

/**
 * Hashes the given string using SHA-256 and returns
 * the result as a hexadecimal string.
 *
 * @param {string} input - The string to hash.
 * @returns {string} The SHA-256 hash of the input, encoded in hex.
 */
function hash(input) {
  if (typeof input !== 'string') {
    throw new Error('Input is not a string');
  }
  return crypto.createHash('sha256').update(input).digest('hex');
}

export default hash;
