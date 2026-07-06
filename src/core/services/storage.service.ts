import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const STORAGE_PROVIDER = process.env.STORAGE_PROVIDER || "local";
const AWS_REGION = process.env.AWS_REGION || "ap-southeast-1";
const AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID || "";
const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY || "";
const AWS_S3_BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME || "";
const APP_URL = process.env.APP_URL || "http://localhost:3000";

let s3Client: S3Client | null = null;

if (STORAGE_PROVIDER === "s3" && AWS_ACCESS_KEY_ID && AWS_SECRET_ACCESS_KEY) {
  s3Client = new S3Client({
    region: AWS_REGION,
    credentials: {
      accessKeyId: AWS_ACCESS_KEY_ID,
      secretAccessKey: AWS_SECRET_ACCESS_KEY,
    },
  });
}

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/jpg"];

export class StorageService {
  /**
   * Mengunggah file (ke S3 atau Lokal).
   * File dibatasi maksimal 2MB dan hanya format JPG/PNG.
   * @param file File objek dari request (File/Blob di Bun/Elysia)
   * @param folder Folder penyimpanan (misal: "pr-attachments")
   * @returns URL publik ke file yang diunggah
   */
  static async uploadFile(file: File, folder: string = "uploads"): Promise<string> {
    if (!file) throw new Error("File is required");

    // Validasi tipe
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      throw new Error(`Invalid file type: ${file.type}. Only JPG/PNG are allowed.`);
    }

    // Validasi ukuran
    if (file.size > MAX_FILE_SIZE) {
      throw new Error(`File is too large. Maximum size is 2MB.`);
    }

    const ext = file.name.split(".").pop() || "png";
    const filename = `${folder}/${crypto.randomUUID()}.${ext}`;

    if (STORAGE_PROVIDER === "s3" && s3Client) {
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const command = new PutObjectCommand({
        Bucket: AWS_S3_BUCKET_NAME,
        Key: filename,
        Body: buffer,
        ContentType: file.type,
      });

      await s3Client.send(command);

      return `https://${AWS_S3_BUCKET_NAME}.s3.${AWS_REGION}.amazonaws.com/${filename}`;
    } else {
      // Penyimpanan lokal
      const __dirname = path.dirname(fileURLToPath(import.meta.url));
      // asumsikan struktur: src/core/services -> root public/uploads
      const uploadDir = path.resolve(__dirname, "../../../public");
      const fullPath = path.join(uploadDir, filename);

      await mkdir(path.dirname(fullPath), { recursive: true });

      const arrayBuffer = await file.arrayBuffer();
      await writeFile(fullPath, Buffer.from(arrayBuffer));

      // Asumsi file statis dilayani melalui prefix /public
      return `${APP_URL}/public/${filename}`;
    }
  }
}
