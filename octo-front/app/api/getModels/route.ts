import { NextResponse } from "next/server";
import path from "path";
import fsp from "fs/promises";
import sharp from "sharp";
import fs from "fs";
import { log } from "console";

const MODEL_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];

async function getModels(dir: string): Promise<
  {
    preview: string;
    previewWidth: number;
    previewHeight: number;
    arch: string;
    id: number;
  }[]
> {
  const fullDir = path.join(process.cwd(), "public", dir);
  let result: {
    preview: string;
    previewWidth: number;
    previewHeight: number;
    arch: string;
    id: number;
  }[] = [];

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
        const nested = await getModels(entryPath);
        result = result.concat(nested);
      } else if (
        MODEL_EXTENSIONS.includes(path.extname(entry.name).toLowerCase())
      ) {
        const fullPath = path.join(process.cwd(), "public", entryPath);
        const metadata = await sharp(fullPath).metadata();
        if (metadata.width && metadata.height) {
          result.push({
            preview: "/" + entryPath.replace(/\\/g, "/"),
            previewWidth: metadata.width,
            previewHeight: metadata.height,
            arch: "noobai",
            id: 0,
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
  const models = await getModels("models");
  return NextResponse.json(models);
}
