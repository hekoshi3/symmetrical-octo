"use client"

import "@/app/components/navbar"
import { useEffect, useState } from "react";
import { GalleryImage } from "./components/interfaces/GalleryImage";
import { ModelList } from "./components/interfaces/ModelList";
import { imgCard } from "./components/imageCard";
import { modelCard } from "./components/modelCard";

export default function MainPage() {
  const [gallery, setGallery] = useState<GalleryImage[]>([]);
  const [models, setModels] = useState<ModelList[]>([]);
  const [clicked, setClicked] = useState(false);

  const setClickedFunc = async () => {
    if (clicked) return
    setClicked(true);
    return new Promise(() => {
    setTimeout(() => {
      setClicked(false)
    }, 2000);
  });
  }

  useEffect(() => {
    const fetchGallery = async () => {
      try {
        const res = await fetch("/api/getImages");
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
      <aside className={clicked ? "fixed flex w-full p-8 z-10 justify-end" : "hidden"}>
        <div role="alert" className="alert alert-success ">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 shrink-0 stroke-current" fill="none" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>Вы поставили лайк</span>
        </div>
      </aside>
      <main className="bg-neutral-900 p-5 pt-1 sm:p-8">
        <section>
          <h1 className="text-3xl font-bold pb-5">Images</h1>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-6">
            {gallery.map((img, index) => (imgCard(img, index, setClickedFunc)))}</div> {/*.slice(0, 14)*/}
        </section>
        <section>
          <h1 className="text-3xl font-bold pb-5 pt-5">Models</h1>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-6">
            {models.slice(0, 14).map((model, index) => (modelCard(model, index)))}</div>
        </section>
      </main >
    </>
  )
}