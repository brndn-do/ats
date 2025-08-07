import {
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  DeleteObjectsCommand,
} from '@aws-sdk/client-s3';
import {
  uploadResume,
  downloadResume,
  deleteResume,
  emptyBucket,
} from '../../../src/services/s3.js';

// Mocks the S3 client. The `send` method is a mock function, preventing
// actual AWS calls. This allows tests to simulate S3 operations.
jest.mock('@aws-sdk/client-s3', () => {
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
    ListObjectsV2Command: jest.fn(),
    DeleteObjectsCommand: jest.fn(),
  };
});

const S3Client = require('@aws-sdk/client-s3').S3Client;

beforeEach(() => {
  S3Client.mSend.mockReset();
  PutObjectCommand.mockClear();
  GetObjectCommand.mockClear();
  DeleteObjectCommand.mockClear();
  ListObjectsV2Command.mockClear();
  DeleteObjectsCommand.mockClear();
});

describe('uploadResume', () => {
  const pdfBuffer = Buffer.from('example');

  it('should return an object with an objectKey property on first attempt', async () => {
    const S3Result = await uploadResume(pdfBuffer);
    expect(S3Result.objectKey).toMatch('.pdf');
  });

  it('should correctly pass params to PutObjectCommand', async () => {
    await uploadResume(pdfBuffer);
    expect(PutObjectCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        Bucket: expect.any(String),
        Key: expect.stringMatching(/\.pdf$/),
        Body: pdfBuffer,
        ContentType: 'application/pdf',
        ContentDisposition: 'inline',
        ACL: 'private',
      })
    );
  });

  it('should succeed after one retry if first attempt fails', async () => {
    S3Client.mSend.mockRejectedValueOnce(new Error());
    const S3Result = await uploadResume(pdfBuffer);
    expect(S3Result.objectKey).toMatch('.pdf');
    expect(PutObjectCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        Bucket: expect.any(String),
        Key: expect.stringMatching(/\.pdf$/),
        Body: pdfBuffer,
        ContentType: 'application/pdf',
        ContentDisposition: 'inline',
        ACL: 'private',
      })
    );
  });

  it('should throw an error after all retry attempts fail', async () => {
    S3Client.mSend.mockRejectedValue(new Error());
    await expect(uploadResume(pdfBuffer)).rejects.toThrow();
  });
});

describe('downloadResume', () => {
  const objectKey = 'abc.pdf';
  const mockResultObject = { Body: null };

  it('should return result object', async () => {
    S3Client.mSend.mockResolvedValueOnce(mockResultObject);
    const S3Result = await downloadResume(objectKey);
    expect(S3Result).toBe(mockResultObject);
  });

  it('should correctly pass params to GetObjectCommand', async () => {
    await downloadResume(objectKey);
    expect(GetObjectCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        Bucket: expect.any(String),
        Key: objectKey,
      })
    );
  });

  it('should succeed after one retry if the first attempt fails', async () => {
    S3Client.mSend.mockRejectedValueOnce(new Error());
    S3Client.mSend.mockResolvedValueOnce(mockResultObject);
    const S3Result = await downloadResume(objectKey);
    expect(S3Result).toBe(mockResultObject);
    expect(GetObjectCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        Bucket: expect.any(String),
        Key: objectKey,
      })
    );
  });

  it('should throw an error after all retry attempts fail', async () => {
    S3Client.mSend.mockRejectedValue(new Error());
    await expect(downloadResume(objectKey)).rejects.toThrow();
  });
});

describe('deleteResume', () => {
  const objectKey = 'acb.pdf';

  it('should return nothing', async () => {
    const S3Result = await deleteResume(objectKey);
    expect(S3Result).toBeUndefined();
  });

  it('should correctly pass params to DeleteObjectCommand', async () => {
    await deleteResume(objectKey);
    expect(DeleteObjectCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        Bucket: expect.any(String),
        Key: objectKey,
      })
    );
  });

  it('should succeed after one retry if the first attempt fails', async () => {
    S3Client.mSend.mockRejectedValueOnce(new Error());
    const S3Result = await deleteResume(objectKey);
    expect(S3Result).toBeUndefined();
    expect(DeleteObjectCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        Bucket: expect.any(String),
        Key: objectKey,
      })
    );
  });

  it('should throw an error after all retry attempts fail', async () => {
    S3Client.mSend.mockRejectedValue(new Error());
    await expect(deleteResume(objectKey)).rejects.toThrow();
  });
});

describe('emptyBucket', () => {
  const listedObjects = {
    Contents: [{ Key: 'file1.pdf' }, { Key: 'file2.pdf' }],
  };

  it('should return nothing', async () => {
    S3Client.mSend.mockResolvedValueOnce(listedObjects).mockResolvedValueOnce({});
    const S3result = await emptyBucket();
    expect(S3result).toBeUndefined();
  });

  it('should delete all objects if bucket is not empty', async () => {
    S3Client.mSend.mockResolvedValueOnce(listedObjects).mockResolvedValueOnce({});

    await emptyBucket();

    expect(ListObjectsV2Command).toHaveBeenCalled();
    expect(DeleteObjectsCommand).toHaveBeenCalledWith({
      Bucket: process.env.TEST_S3_BUCKET_NAME,
      Delete: {
        Objects: [{ Key: 'file1.pdf' }, { Key: 'file2.pdf' }],
      },
    });
  });

  it('should do nothing if bucket is already empty', async () => {
    S3Client.mSend.mockResolvedValue({ Contents: [] });
    await emptyBucket();
    expect(ListObjectsV2Command).toHaveBeenCalled();
    expect(DeleteObjectsCommand).not.toHaveBeenCalled();
  });

  it("should throw an error if NODE_ENV is not 'test'", async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'dev';
    await expect(emptyBucket()).rejects.toThrow('Cannot empty bucket outside of testing');
    process.env.NODE_ENV = originalEnv;
  });

  it('should succeed after one retry', async () => {
    S3Client.mSend
      .mockRejectedValueOnce(new Error())
      .mockResolvedValueOnce(listedObjects)
      .mockResolvedValueOnce({});

    await emptyBucket();

    expect(ListObjectsV2Command).toHaveBeenCalled();
    expect(DeleteObjectsCommand).toHaveBeenCalled();
  });

  it('should throw an error after all retries fail', async () => {
    S3Client.mSend.mockRejectedValue(new Error());

    await expect(emptyBucket()).rejects.toThrow();
  });
});
