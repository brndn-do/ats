import hash from '../../../src/utils/hash.js';
import crypto from 'crypto';

it('should return a SHA-256 hash', () => {
  const input = 'test';
  const expectedHash = crypto.createHash('sha256').update(input).digest('hex');
  const actualHash = hash(input);
  expect(actualHash).toBe(expectedHash);
});

it('should throw an error if the input is not a string', () => {
  expect(() => hash(123)).toThrow('Input is not a string');
});
