// s3.js

import dotenv from 'dotenv';
dotenv.config();
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

const client = new S3Client({
  region: process.env.S3_REGION,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY
  }
});

async function uploadObject(input) {
  const command = new PutObjectCommand(input);
};

async function downloadObject(input) {
  const command = new GetObjectCommand(input);
}

async function deleteObject(input) {
  const command = new DeleteObjectCommand(input);
}

export default { uploadObject, downloadObject, deleteObject };