"use client"

import "@/app/components/navbar"
import { useEffect, useState } from "react";
import { BackdendResIMG, BackdendResMODEL, GalleryImage, ModelList,  } from "./components/interfaces/BackdendRes";
import { ImgCard } from "./components/imageCard";
import { ModelCard } from "./components/modelCard";
import { useAuth } from "./provider/authProvider";

const API_HOST = process.env.NEXT_PUBLIC_BACKEND_API || "http://localhost:8000/api";

export default function MainPage() {
  const [gallery, setGallery] = useState<GalleryImage[]>([]);
  const [models, setModels] = useState<ModelList[]>([]);
  const auth = useAuth();
  const makeAuthenticatedRequest = auth.makeAuthenticatedRequest as (url: string, options?: RequestInit) => Promise<Response>;

  useEffect(() => {
    const fetchGallery = async () => {
      try {
        const res = auth.token && !auth.isLoading
          ? await makeAuthenticatedRequest(`${API_HOST}/images/`)
          : await fetch(`${API_HOST}/images/`);
        if (!res.ok) throw new Error("Failed to fetch images");
        const images: BackdendResIMG = await res.json();
        setGallery(images.results.reverse());
      } catch (error) {
        console.error("Error loading gallery:", error);
      }
    };

    const fetchModels = async () => {
      try {
        const res = auth.token && !auth.isLoading
          ? await makeAuthenticatedRequest(`${API_HOST}/models/`)
          : await fetch(`${API_HOST}/models/`);
        if (!res.ok) throw new Error("Failed to fetch models");
        const models: BackdendResMODEL = await res.json();
        setModels(models.results.reverse());
      } catch (error) {
        console.error("Error loading models:", error);
      }
    };

    if (!auth.isLoading) {
      fetchModels();
      fetchGallery();
    }
  }, [auth.token, auth.isLoading, makeAuthenticatedRequest]);

  return (
    <>
      <main className="bg-neutral-900 p-5 pt-1 sm:p-8">
        <section>
          <h1 className="text-3xl font-bold pb-5">Images</h1>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-6">
            {gallery.map((img, index) => (
              <ImgCard key={img.id ?? index} img={img} index={index} />
            ))}</div>
        </section>
        <section>
          <h1 className="text-3xl font-bold pb-5 pt-5">Models</h1>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-6">
            {models.slice(0, 14).map((model, index) => (
              <ModelCard key={model.id ?? index} model={model} index={index} />
            ))}</div>
        </section>
      </main >
    </>
  )
}