// s3.js

import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';
dotenv.config();

const client = new S3Client({
  region: process.env.S3_REGION,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY
  }
});

// Given a PDF buffer, uploads the PDF to S3 bucket, generating a unique object key
// Input: PDF buffer, optional retry count, optional delay
// Returns an object containing the generated uuid object key
async function uploadResume(buffer, retries = 3, delay = 1000) {
  const id = uuidv4();
  const objectKey = `${id}.pdf`
  const params = {
    Bucket: process.env.S3_BUCKET_NAME,
    Key: objectKey,
    Body: buffer,
    ContentType: 'application/pdf',
    ContentDisposition: 'inline',
    ACL: 'private'
  };
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      console.log(`Uploading... attempt ${attempt + 1} of ${retries}`);
      const command = new PutObjectCommand(params);
      await client.send(command);
      console.log("Upload succeeded!");
      return { objectKey };
    } catch (err) {
      if (attempt === retries - 1) {
        throw err;
      }
      console.log(`Retrying... Attempt ${attempt + 1} of ${retries}`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
};

// Given an S3 object key, gets the file stream from S3
// Input: object key, optional retry count, optional delay
// Returns the result object returned from .send(new GetObjectCommand(...))
async function downloadResume(objectKey, retries = 3, delay = 1000) {
  const params = {
    Bucket: process.env.S3_BUCKET_NAME,
    Key: objectKey
  };
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      console.log(`Downloading... attempt ${attempt + 1} of ${retries}`);
      const command = new GetObjectCommand(params);
      const result = await client.send(command);
      console.log("Download succeeded!");
      return result;
    } catch (err) {
      if (attempt === retries - 1) {
        throw err;
      }
      console.log(`Retrying... Attempt ${attempt + 1} of ${retries}`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

// Given an S3 object key, deletes the object from S3 bucket
// Input: object key, optional retry count, optional delay
// Returns void
async function deleteResume(objectKey, retries = 3, delay = 1000) {
  const params = {
    Bucket: process.env.S3_BUCKET_NAME,
    Key: objectKey
  };
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      console.log(`Deleting... attempt ${attempt + 1} of ${retries}`);
      const command = new DeleteObjectCommand(params);
      await client.send(command);
      console.log("Delete succeeded!");
      return;
    } catch (err) {
      if (attempt === retries - 1) {
        throw err;
      }
      console.log(`Retrying... Attempt ${attempt + 1} of ${retries}`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

export { uploadResume, downloadResume, deleteResume, client };