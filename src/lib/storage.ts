import { randomBytes } from "crypto";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

const MAX_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/gif"];

/**
 * Upload an event/club image. Uses Cloudinary when CLOUDINARY_URL is set;
 * otherwise writes to public/uploads so local development works with no keys.
 * Returns the URL to store on the event row.
 */
export async function uploadImage(file: File, folder: string): Promise<string> {
  if (!ALLOWED.includes(file.type)) {
    throw new Error("Only JPEG, PNG, WebP or GIF images are allowed.");
  }
  if (file.size > MAX_SIZE) {
    throw new Error("Image must be under 5 MB.");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const cloudUrl = process.env.CLOUDINARY_URL;

  if (cloudUrl) {
    const { v2 } = await import("cloudinary");
    v2.config({ cloud_url: cloudUrl });
    const result = await new Promise<{ secure_url: string }>((resolve, reject) => {
      const stream = v2.uploader.upload_stream(
        { folder: `campus-pulse/${folder}`, resource_type: "image" },
        (error, res) => (error || !res ? reject(error) : resolve(res))
      );
      stream.end(buffer);
    });
    return result.secure_url;
  }

  // Local fallback (dev only — Vercel's filesystem is ephemeral).
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const name = `${randomBytes(8).toString("hex")}.${ext}`;
  const dir = path.join(process.cwd(), "public", "uploads", folder);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, name), buffer);
  return `/uploads/${folder}/${name}`;
}
