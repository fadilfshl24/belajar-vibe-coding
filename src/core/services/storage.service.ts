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

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB (before resize)
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/jpg", "image/webp"];

/** Target resize constraints */
const RESIZE_MAX_DIMENSION = 800;  // px
const RESIZE_QUALITY = 0.80;       // JPEG quality 0–1
const RESIZE_MAX_OUTPUT_BYTES = 500 * 1024; // 500 KB

/**
 * Resize an image buffer using Bun-native Web APIs (no native binary required).
 * Decodes the image as an ImageBitmap → renders to OffscreenCanvas → encodes as JPEG blob.
 * Falls back gracefully on Bun versions that do not support OffscreenCanvas.
 *
 * @param buffer  Raw image bytes
 * @param mimeType  Original MIME type
 * @returns Resized image as Buffer (JPEG), or original buffer if resize not supported
 */
async function resizeImage(buffer: Buffer, mimeType: string): Promise<{ buffer: Buffer; mimeType: string }> {
  try {
    // createImageBitmap and OffscreenCanvas are available in Bun >= 1.0
    const blob = new Blob([buffer], { type: mimeType });
    const bitmap = await createImageBitmap(blob);

    const { width, height } = bitmap;
    let targetW = width;
    let targetH = height;

    // Scale down proportionally if larger than max dimension
    if (width > RESIZE_MAX_DIMENSION || height > RESIZE_MAX_DIMENSION) {
      const ratio = Math.min(RESIZE_MAX_DIMENSION / width, RESIZE_MAX_DIMENSION / height);
      targetW = Math.round(width * ratio);
      targetH = Math.round(height * ratio);
    }

    const canvas = new OffscreenCanvas(targetW, targetH);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("OffscreenCanvas 2D context not available");

    ctx.drawImage(bitmap, 0, 0, targetW, targetH);
    bitmap.close();

    const resizedBlob = await canvas.convertToBlob({ type: "image/jpeg", quality: RESIZE_QUALITY });
    const resizedBuffer = Buffer.from(await resizedBlob.arrayBuffer());

    return { buffer: resizedBuffer, mimeType: "image/jpeg" };
  } catch (_err) {
    // OffscreenCanvas not supported in this runtime — return original
    console.warn("[StorageService] Image resize not supported in this environment, uploading original.");
    return { buffer, mimeType };
  }
}

export class StorageService {
  /**
   * Mengunggah file gambar (ke S3 atau Lokal).
   * - File divalidasi tipe dan ukuran.
   * - Gambar di-resize otomatis ke max 800×800px, JPEG quality 80%, max 500KB sebelum upload.
   *
   * @param file    File objek dari request (File/Blob di Bun/Elysia)
   * @param folder  Folder penyimpanan (misal: "pr-attachments", "return-proofs")
   * @returns URL publik ke file yang diunggah
   */
  static async uploadFile(file: File, folder: string = "uploads"): Promise<string> {
    if (!file) throw new Error("File is required");

    // Validasi tipe
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      throw new Error(`Invalid file type: ${file.type}. Only JPG/PNG/WebP are allowed.`);
    }

    // Validasi ukuran (before resize)
    if (file.size > MAX_FILE_SIZE) {
      throw new Error(`File is too large. Maximum size is 10MB.`);
    }

    const rawArrayBuffer = await file.arrayBuffer();
    let rawBuffer = Buffer.from(rawArrayBuffer);
    let finalMimeType = file.type;

    // ── Resize / compress ──────────────────────────────────────
    const resized = await resizeImage(rawBuffer, file.type);
    rawBuffer = resized.buffer;
    finalMimeType = resized.mimeType;

    // If still too large after resize, reject
    if (rawBuffer.byteLength > RESIZE_MAX_OUTPUT_BYTES) {
      throw new Error(
        `Image too large after resize (${Math.round(rawBuffer.byteLength / 1024)} KB). Max is 500 KB. Please use a smaller image.`
      );
    }
    // ──────────────────────────────────────────────────────────

    const ext = finalMimeType === "image/jpeg" ? "jpg" : (file.name.split(".").pop() || "png");
    const filename = `${folder}/${crypto.randomUUID()}.${ext}`;

    if (STORAGE_PROVIDER === "s3" && s3Client) {
      const command = new PutObjectCommand({
        Bucket: AWS_S3_BUCKET_NAME,
        Key: filename,
        Body: rawBuffer,
        ContentType: finalMimeType,
      });

      await s3Client.send(command);

      return `https://${AWS_S3_BUCKET_NAME}.s3.${AWS_REGION}.amazonaws.com/${filename}`;
    } else {
      // Penyimpanan lokal
      const __dirname = path.dirname(fileURLToPath(import.meta.url));
      const uploadDir = path.resolve(__dirname, "../../../public");
      const fullPath = path.join(uploadDir, filename);

      await mkdir(path.dirname(fullPath), { recursive: true });
      await writeFile(fullPath, rawBuffer);

      return `${APP_URL}/public/${filename}`;
    }
  }
}
