import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  DeleteObjectsCommand,
} from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger.js';

const DELAY = process.env.NODE_ENV === 'test' ? 10 : 1000; // shorter delay for testing

const clientConfig = {
  region: process.env.S3_REGION,
  endpoint: process.env.S3_ENDPOINT,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
  },
};

// the bucket name
let Bucket;

switch (process.env.NODE_ENV) {
  case 'dev':
    logger.info('S3CLIENT: using dev MinIO bucket');
    clientConfig.forcePathStyle = true;
    Bucket = process.env.DEV_S3_BUCKET_NAME;
    break;
  case 'test':
    logger.info('S3CLIENT: using test MinIO bucket');
    clientConfig.forcePathStyle = true;
    Bucket = process.env.TEST_S3_BUCKET_NAME;
    break;
  default:
    logger.info('S3CLIENT: using AWS S3 bucket');
    Bucket = process.env.S3_BUCKET_NAME;
}

const client = new S3Client(clientConfig);

/**
 * Empties the contents of an S3 bucket, retrying on failure.
 *
 * Only allowed in the 'test' environment.
 *
 * @param {number} [attempts=3] - The maximum number of attempts.
 * @param {number} [delay=DELAY] - The delay in milliseconds between attempts.
 * @returns {Promise<void>}
 * @throws Will throw an error if all attempts fail or not in a test environment.
 */
async function emptyBucket(attempts = 3, delay = DELAY) {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('Cannot empty bucket outside of testing');
  }

  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const listParams = { Bucket };
      // eslint-disable-next-line no-await-in-loop
      const listedObjects = await client.send(new ListObjectsV2Command(listParams));

      if (!listedObjects.Contents || listedObjects.Contents.length === 0) {
        return;
      }

      const deleteParams = {
        Bucket,
        Delete: {
          Objects: listedObjects.Contents.map(({ Key }) => ({ Key })),
        },
      };
      // eslint-disable-next-line no-await-in-loop
      await client.send(new DeleteObjectsCommand(deleteParams));

      return;
    } catch (err) {
      logger.error(err);
      if (attempt === attempts - 1) {
        break;
      }
      logger.info(`Retrying... attempt ${attempt + 2} of ${attempts}`);
      // eslint-disable-next-line no-await-in-loop
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw new Error('Empty bucket failed after all attempts');
}

/**
 * Uploads a PDF file to an S3 bucket with a unique UUID-based object key.
 *
 * @param {Buffer} buffer - The PDF file buffer to upload.
 * @param {number} [attempts=3] - The maximum number of attempts.
 * @param {number} [delay=DELAY] - Delay in milliseconds between attempts.
 * @returns {Promise<{ objectKey: string }>} An object containing the generated S3 object key.
 * @throws Will throw an error if all attempts fail.
 */
async function uploadResume(buffer, attempts = 3, delay = DELAY) {
  const id = uuidv4();
  const objectKey = `${id}.pdf`;
  const params = {
    Bucket,
    Key: objectKey,
    Body: buffer,
    ContentType: 'application/pdf',
    ContentDisposition: 'inline',
    ACL: 'private',
  };
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const command = new PutObjectCommand(params);
      // eslint-disable-next-line no-await-in-loop
      await client.send(command);

      return { objectKey };
    } catch (err) {
      logger.error(err);
      if (attempt === attempts - 1) {
        break;
      }
      logger.info(`Retrying... attempt ${attempt + 2} of ${attempts}`);
      // eslint-disable-next-line no-await-in-loop
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw new Error('Upload resume failed after all attempts');
}

/**
 * Downloads a file stream from an S3 bucket using the given object key.
 *
 * @param {string} objectKey - The S3 object key of the file to download.
 * @param {number} [attempts=3] - The maximum number of attempts.
 * @param {number} [delay=DELAY] - Delay in milliseconds between attempts.
 * @returns {Promise<import('@aws-sdk/client-s3').GetObjectCommandOutput>} The result from the S3 GetObjectCommand.
 * @throws Will throw an error if all attempts fail.
 */
async function downloadResume(objectKey, attempts = 3, delay = DELAY) {
  const params = {
    Bucket,
    Key: objectKey,
  };
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const command = new GetObjectCommand(params);
      // eslint-disable-next-line no-await-in-loop
      const result = await client.send(command);

      return result;
    } catch (err) {
      logger.error(err);
      if (attempt === attempts - 1) {
        break;
      }
      logger.info(`Retrying... attempt ${attempt + 2} of ${attempts}`);
      // eslint-disable-next-line no-await-in-loop
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw new Error('Download resume failed after all attempts');
}

/**
 * Deletes a file from an S3 bucket using the provided object key.
 *
 * @param {string} objectKey - The S3 object key to delete.
 * @param {number} [attempts=3] - The maximum number of attempts.
 * @param {number} [delay=DELAY] - Delay in milliseconds between attempts.
 * @returns {Promise<void>}
 * @throws Will throw an error if all attempts fail.
 */
async function deleteResume(objectKey, attempts = 3, delay = DELAY) {
  const params = {
    Bucket,
    Key: objectKey,
  };
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const command = new DeleteObjectCommand(params);
      // eslint-disable-next-line no-await-in-loop
      await client.send(command);

      return;
    } catch (err) {
      logger.error(err);
      if (attempt === attempts - 1) {
        break;
      }
      logger.info(`Retrying... attempt ${attempt + 2} of ${attempts}`);
      // eslint-disable-next-line no-await-in-loop
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw new Error('Delete resume failed after all attempts');
}

export { uploadResume, downloadResume, deleteResume, client, emptyBucket };
