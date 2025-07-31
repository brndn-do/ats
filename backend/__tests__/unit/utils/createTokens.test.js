
import createTokens from "../../../utils/createTokens.js";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import hash from "../../../utils/hash.js";

import dotenv from "dotenv";

dotenv.config();

describe("createTokens", () => {
  const userId = 1;
  const username = "testuser";
  const isAdmin = false;

  it("should create a valid access token", () => {
    const { accessToken } = createTokens(userId, username, isAdmin);
    const payload = jwt.verify(accessToken, process.env.JWT_SECRET);
    expect(payload.sub).toBe(userId);
    expect(payload.name).toBe(username);
    expect(payload.isAdmin).toBe(isAdmin);
    expect(payload.exp - payload.iat).toBeLessThanOrEqual(300);
  });

  it("should create a 32 byte random refresh token", () => {
    const spy = jest.spyOn(crypto, "randomBytes");
    const { refreshToken } = createTokens(userId, username, isAdmin);
    expect(spy).toHaveBeenCalledWith(32);
    expect(typeof refreshToken).toBe("string");
    expect(refreshToken.length).toBe(64); // 32 bytes in hex is 64 chars
    spy.mockRestore();
  });

  it("should create a correct hash of the refresh token", () => {
    const { refreshToken, refreshTokenHash } = createTokens(
      userId,
      username,
      isAdmin
    );
    const expectedHash = hash(refreshToken);
    expect(refreshTokenHash).toBe(expectedHash);
  });
});

describe("Error handling", () => {
  const userId = 1;
  const username = "testuser";
  const isAdmin = false;

  it("should throw an error if userId is missing or not a number", () => {
    expect(() => createTokens(undefined, username, isAdmin)).toThrow(
      "Invalid arguments"
    );
    expect(() => createTokens(null, username, isAdmin)).toThrow(
      "Invalid arguments"
    );
    expect(() => createTokens("1", username, isAdmin)).toThrow(
      "Invalid arguments"
    );
  });

  it("should throw an error if username is missing or not a string", () => {
    expect(() => createTokens(userId, undefined, isAdmin)).toThrow(
      "Invalid arguments"
    );
    expect(() => createTokens(userId, null, isAdmin)).toThrow(
      "Invalid arguments"
    );
    expect(() => createTokens(userId, 123, isAdmin)).toThrow(
      "Invalid arguments"
    );
  });

  it("should throw an error if isAdmin is missing or not a boolean", () => {
    expect(() => createTokens(userId, username, undefined)).toThrow(
      "Invalid arguments"
    );
    expect(() => createTokens(userId, username, null)).toThrow(
      "Invalid arguments"
    );
    expect(() => createTokens(userId, username, "false")).toThrow(
      "Invalid arguments"
    );
  });
});
