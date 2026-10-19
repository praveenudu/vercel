import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export const s3 = new S3Client({
  region: "auto",
  endpoint: process.env.S3_ENDPOINT,
  forcePathStyle: false,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
  },
});

export function presignPut(key: string, contentType: string) {
  return getSignedUrl(s3, new PutObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key, ContentType: contentType }), { expiresIn: 600 });
}

export function presignGet(key: string, filename?: string) {
  return getSignedUrl(
    s3,
    new GetObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: key,
      ResponseContentDisposition: filename ? `inline; filename="${filename.replace(/"/g, "")}"` : undefined,
    }),
    { expiresIn: 3600 },
  );
}
