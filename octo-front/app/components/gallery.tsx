"use client"

import Image from "next/image";
import React, { useEffect, useState } from "react";
import { GalleryImage } from "../components/interfaces/GalleryImage";

export default function GeneratePage() {
    const [gallery, setGallery] = useState<GalleryImage[]>([]);

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

        fetchGallery();
    }, []);

    return (
        <div className="gallery-list gallery">
            {gallery.map((img, index) => (
                <a key={index} href={img.path} target="_blank" rel="noopener noreferrer">
                    <div className="gallery-image-wrapper">
                        <Image
                            src={img.path}
                            alt={`Generated ${index}`}
                            width={190}
                            height={Math.round(190 * (img.height / img.width))}
                            unoptimized
                        />
                    </div>
                </a>
            ))}
        </div>
    );
}