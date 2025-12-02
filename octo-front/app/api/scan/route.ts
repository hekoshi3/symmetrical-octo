import { NextResponse } from "next/server";
import path from "path";
import fsp from "fs/promises";
import sharp from "sharp";
import fs from "fs";
import { log } from "console";

const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];

async function getImagesInDirectory(
  dir: string
): Promise<{ path: string; width: number; height: number }[]> {
  const fullDir = path.join(process.cwd(), "public", dir);
  let result: { path: string; width: number; height: number }[] = [];

  if (!fs.existsSync(path.join(process.cwd(), "public"))) {
    log(
      "OwlLog || Cannot find requred path at /public; creating",
      path.join(process.cwd(), "public")
    );
    fs.mkdirSync(path.join(process.cwd(), "public"));
  }

  if (!fs.existsSync(path.join(process.cwd(), "public", dir))) {
    log(
      `OwlLog || Cannot find requred path at /public/`,
      dir,
      "; Creating",
      path.join(process.cwd(), "public", dir)
    );
    fs.mkdirSync(path.join(process.cwd(), "public", dir));
  }

  try {
    const entries = await fsp.readdir(fullDir, { withFileTypes: true });

    for (const entry of entries) {
      const entryPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        const nested = await getImagesInDirectory(entryPath);
        result = result.concat(nested);
      } else if (
        IMAGE_EXTENSIONS.includes(path.extname(entry.name).toLowerCase())
      ) {
        const fullPath = path.join(process.cwd(), "public", entryPath);
        const metadata = await sharp(fullPath).metadata();
        if (metadata.width && metadata.height) {
          result.push({
            path: "/" + entryPath.replace(/\\/g, "/"),
            width: metadata.width,
            height: metadata.height,
          });
        }
      }
    }
  } catch (err) {
    console.error("Error scanning directory:", err);
  }

  return result;
}

export async function GET() {
  const images = await getImagesInDirectory("generated");
  return NextResponse.json(images);
}
