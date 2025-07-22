import {
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { uploadResume, downloadResume, deleteResume } from "../../s3.js";

// Mocks the S3 client. The `send` method is a mock function, preventing
// actual AWS calls. This allows tests to simulate S3 operations.
jest.mock("@aws-sdk/client-s3", () => {
  const mSend = jest.fn();
  const mS3Client = jest.fn(() => ({
    send: mSend,
  }));
  // Expose mSend as a static property on the mock S3Client constructor
  mS3Client.mSend = mSend;
  return {
    S3Client: mS3Client,
    PutObjectCommand: jest.fn(),
    GetObjectCommand: jest.fn(),
    DeleteObjectCommand: jest.fn(),
  };
});

const S3Client = require("@aws-sdk/client-s3").S3Client;

beforeEach(() => {
  S3Client.mSend.mockReset();
  PutObjectCommand.mockClear();
  GetObjectCommand.mockClear();
  DeleteObjectCommand.mockClear();
});

describe("uploadResume", () => {
  const pdfBuffer = Buffer.from("example");
  it("should upload and return an object with an objectKey property on first attempt", async () => {
    const S3Result = await uploadResume(pdfBuffer);
    expect(S3Result.objectKey).toMatch(".pdf");
    expect(S3Client.mSend).toHaveBeenCalledTimes(1);
  });
  it("should succeed after one retry if first attempt fails", async () => {
    S3Client.mSend.mockRejectedValueOnce(new Error("S3 connection error"));
    const S3Result = await uploadResume(pdfBuffer);
    expect(S3Result.objectKey).toMatch(".pdf");
    expect(S3Client.mSend).toHaveBeenCalledTimes(2);
  });
  it("should throw an error after all retry attempts fail", async () => {
    S3Client.mSend.mockRejectedValue(new Error("S3 connection error"));
    await expect(uploadResume(pdfBuffer)).rejects.toThrow(
      "S3 connection error"
    );
    expect(S3Client.mSend).toHaveBeenCalledTimes(3);
  });
  it("should correctly pass params to PutObjectCommand", async () => {
    await uploadResume(pdfBuffer);
    expect(PutObjectCommand).toHaveBeenCalledTimes(1);
    expect(PutObjectCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        Bucket: expect.any(String),
        Key: expect.stringMatching(/\.pdf$/),
        Body: pdfBuffer,
        ContentType: "application/pdf",
        ContentDisposition: "inline",
        ACL: "private",
      })
    );
  });
});

describe("downloadResume", () => {
  const objectKey = "abc.pdf";
  const mockResultObject = { Body: null };
  it("should succeed on the first attempt and return result object", async () => {
    S3Client.mSend.mockResolvedValueOnce(mockResultObject);
    const S3Result = await downloadResume(objectKey);
    expect(S3Result).toBe(mockResultObject);
    expect(S3Client.mSend).toHaveBeenCalledTimes(1);
  });
  it("should succeed after one retry if the first attempt fails", async () => {
    S3Client.mSend.mockRejectedValueOnce(new Error("S3 connection error"));
    S3Client.mSend.mockResolvedValueOnce(mockResultObject);
    const S3Result = await downloadResume(objectKey);
    expect(S3Result).toBe(mockResultObject);
    expect(S3Client.mSend).toHaveBeenCalledTimes(2);
  });
  it("should throw an error after all retry attempts fail", async () => {
    S3Client.mSend.mockRejectedValue(new Error("S3 connection error"));
    await expect(downloadResume(objectKey)).rejects.toThrow(
      "S3 connection error"
    );
    expect(S3Client.mSend).toHaveBeenCalledTimes(3);
  });
  it("should correctly pass params to GetObjectCommand", async () => {
    await downloadResume(objectKey);
    expect(GetObjectCommand).toHaveBeenCalledTimes(1);
    expect(GetObjectCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        Bucket: expect.any(String),
        Key: objectKey,
      })
    );
  });
});

describe("deleteResume", () => {});
