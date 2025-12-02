"use client"

import "@/app/components/navbar"
import { useEffect, useState } from "react";
import { GalleryImage } from "./components/interfaces/GalleryImage";
import { ModelList } from "./components/interfaces/ModelList";
import Image from "next/image";
import Link from "next/link"

export default function MainPage() {
  const [gallery, setGallery] = useState<GalleryImage[]>([]);
  const [models, setModels] = useState<ModelList[]>([]);

  useEffect(() => {
    const fetchGallery = async () => {
      try {
        const res = await fetch("/api/scan");
        if (!res.ok) throw new Error("Failed to fetch images");
        const images: GalleryImage[] = await res.json();
        setGallery(images.reverse());
      } catch (error) {
        console.error("Error loading gallery:", error);
      }
    };
    
    const fetchModels = async () => {
      try {
        const res = await fetch("/api/getModels");
        if (!res.ok) throw new Error("Failed to fetch models");
        const models: ModelList[] = await res.json();
        setModels(models.reverse());
      } catch (error) {
        console.error("Error loading models:", error);
      }
    };

    fetchModels();
    fetchGallery();
  }, []);

  return (
    <>
      <main className="bg-neutral-900 p-5 pt-1 sm:p-8">
        <section>
          <h1 className=" text-3xl font-bold pb-5">Images</h1>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-7 md:grid-cols-4">
            {gallery.slice(0, 14).map((img, index) => (
              <Link key={index} href={img.path} target="_blank" rel="noopener noreferrer" className="items-center hover:scale-101">
                <Image
                  src={img.path}
                  alt={`Generated ${index}`}
                  width={512}
                  loading="eager"
                  height={Math.round(512 * (img.height / img.width))}
                  className="object-cover object-center rounded-lg min-h-100 md:h-80 md:max-h-80 h-60"
                />
              </Link>
            ))}
          </div>
        </section>
        <section>
          <h1 className=" text-3xl font-bold pb-5 pt-5">Models</h1>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-7 md:grid-cols-4">
            {models.slice(0, 14).map((model, index) => (
              <Link key={index} href={model.preview} target="_blank" rel="noopener noreferrer" className="items-center hover:scale-101">
                <Image
                  src={model.preview}
                  alt={`Model ${index}`}
                  width={512}
                  loading="eager"
                  height={Math.round(512 * (model.previewHeight / model.previewWidth))}
                  className="object-cover object-center rounded-lg min-h-100 md:h-80 md:max-h-80 h-60"
                />
              </Link>
            ))}
          </div>
        </section>
      </main>
    </>
  )
}