import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  DeleteObjectsCommand,
} from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger';
import dotenv from 'dotenv';

dotenv.config();

const DELAY = 10;

let client;

if (process.env.NODE_ENV === 'test') {
  logger.info('S3CLIENT: using test credentials');
  // Use credentials with broader permissions for testing
  client = new S3Client({
    region: process.env.S3_REGION,
    credentials: {
      accessKeyId: process.env.TEST_S3_ACCESS_KEY,
      secretAccessKey: process.env.TEST_S3_SECRET_ACCESS_KEY,
    },
  });
} else {
  // Use more restricted credentials for development/production
  logger.info('S3CLIENT: using restricted credentials');
  client = new S3Client({
    region: process.env.S3_REGION,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
    },
  });
}

async function emptyBucket(retries = 3, delay = DELAY) {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('Cannot empty bucket outside of testing');
  }

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const listParams = { Bucket: process.env.S3_BUCKET_NAME };
      // eslint-disable-next-line no-await-in-loop
      const listedObjects = await client.send(new ListObjectsV2Command(listParams));

      if (!listedObjects.Contents || listedObjects.Contents.length === 0) {
        return;
      }

      const deleteParams = {
        Bucket: process.env.S3_BUCKET_NAME,
        Delete: {
          Objects: listedObjects.Contents.map(({ Key }) => ({ Key })),
        },
      };
      // eslint-disable-next-line no-await-in-loop
      await client.send(new DeleteObjectsCommand(deleteParams));

      return;
    } catch (err) {
      logger.error(err);
      if (attempt === retries - 1) {
        break;
      }
      logger.info(`Retrying... attempt ${attempt + 2} of ${retries}`);
      // eslint-disable-next-line no-await-in-loop
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw new Error('Empty bucket failed after all retries');
}

// Given a PDF buffer, uploads the PDF to S3 bucket, generating a unique object key
// Input: PDF buffer, optional retry count, optional delay
// Returns an object containing the generated uuid object key
async function uploadResume(buffer, retries = 3, delay = DELAY) {
  const id = uuidv4();
  const objectKey = `${id}.pdf`;
  const params = {
    Bucket: process.env.S3_BUCKET_NAME,
    Key: objectKey,
    Body: buffer,
    ContentType: 'application/pdf',
    ContentDisposition: 'inline',
    ACL: 'private',
  };
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const command = new PutObjectCommand(params);
      // eslint-disable-next-line no-await-in-loop
      await client.send(command);

      return { objectKey };
    } catch (err) {
      logger.error(err);
      if (attempt === retries - 1) {
        break;
      }
      logger.info(`Retrying... attempt ${attempt + 2} of ${retries}`);
      // eslint-disable-next-line no-await-in-loop
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw new Error('Upload resume failed after all retries');
}

// Given an S3 object key, gets the file stream from S3
// Input: object key, optional retry count, optional delay
// Returns the result object returned from .send(new GetObjectCommand(...))
async function downloadResume(objectKey, retries = 3, delay = DELAY) {
  const params = {
    Bucket: process.env.S3_BUCKET_NAME,
    Key: objectKey,
  };
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const command = new GetObjectCommand(params);
      // eslint-disable-next-line no-await-in-loop
      const result = await client.send(command);

      return result;
    } catch (err) {
      logger.error(err);
      if (attempt === retries - 1) {
        break;
      }
      logger.info(`Retrying... attempt ${attempt + 2} of ${retries}`);
      // eslint-disable-next-line no-await-in-loop
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw new Error('Download resume failed after all retries');
}

// Given an S3 object key, deletes the object from S3 bucket
// Input: object key, optional retry count, optional delay
// Returns void
async function deleteResume(objectKey, retries = 3, delay = DELAY) {
  const params = {
    Bucket: process.env.S3_BUCKET_NAME,
    Key: objectKey,
  };
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const command = new DeleteObjectCommand(params);
      // eslint-disable-next-line no-await-in-loop
      await client.send(command);

      return;
    } catch (err) {
      logger.error(err);
      if (attempt === retries - 1) {
        break;
      }
      logger.info(`Retrying... attempt ${attempt + 2} of ${retries}`);
      // eslint-disable-next-line no-await-in-loop
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw new Error('Delete resume failed after all retries');
}

export { uploadResume, downloadResume, deleteResume, client, emptyBucket };
