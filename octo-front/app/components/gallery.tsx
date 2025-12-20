"use client"

import Image from "next/image";
import { useEffect, useState } from "react";
import { GalleryImage } from "./interfaces/BackdendRes";
import Link from "next/link";

export default function GeneratePage() {
    const [gallery, setGallery] = useState<GalleryImage[]>([]);

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

        fetchGallery();
    }, []);

    return (
        <div className="gallery-list gallery">
            {gallery.map((img, index) => (
                <Link key={index} href={img.path} target="_blank" rel="noopener noreferrer">
                    <div className="gallery-image-wrapper">
                        <Image
                            src={img.path}
                            alt={`Generated ${index}`}
                            width={190}
                            height={Math.round(190 * (img.height / img.width))}
                            unoptimized
                        />
                    </div>
                </Link>
            ))}
        </div>
    );
}

/*"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { GalleryImage, Comment, CommentList, ModelList, UserProfileData } from "../../components/interfaces/BackdendRes";
import { useAuth } from "../../provider/authProvider";

const API_HOST = process.env.NEXT_PUBLIC_BACKEND_API || "http://localhost:8000/api";

export default function UploadPage() {
    //const params = useParams();
    const router = useRouter();
    const auth = useAuth();
    const makeAuthenticatedRequest = auth.makeAuthenticatedRequest as (url: string, options?: RequestInit) => Promise<Response>;

    const [userProfile, setUserProfile] = useState<UserProfileData | null>(null);
    const [image, setImage] = useState<GalleryImage>();
    //const [model, setModel] = useState<ModelList>();
    const [isLoading, setIsLoading] = useState(true);
    const [, setIsSubmitting] = useState(false)

    const [selectedImage, setSelectedImage] = useState<File | null>(null);

    useEffect(() => {
        if (!auth.token) return;

        let cancelled = false;

        const fetchMe = async () => {
            try {
                const res = await makeAuthenticatedRequest(`${API_HOST}/users/me/`);
                if (!res.ok) return;

                const data = await res.json();
                if (!cancelled) {
                    setUserProfile(data);
                }
            } catch (e) {
                console.error(e);
            }
        };

        fetchMe();

        return () => {
            cancelled = true;
        };
    }, [auth.token, makeAuthenticatedRequest]);

    const imageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (files && files.length > 0) {
            setSelectedImage(files[0]);
        }
    };

    const removeSelectedImage = () => {
        setSelectedImage(null);
        router.refresh();
    };


    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedImage) return;

        setIsSubmitting(true);

        const form = new FormData();
        form.append("image", selectedImage);
        form.append("tags", JSON.stringify([]));
        form.append("description", "");
        form.append("notification_sent", "false");
        form.append("is_published", "false");

        try {
            const res = await makeAuthenticatedRequest(`${API_HOST}/images/`, {
                method: "POST",
                body: form,
            });

            if (!res.ok) {
                throw new Error("Upload failed");
            }

            const data = await res.json();

            // 🔑 App Router redirect
            router.push(`/image/edit/${data.id}`);

        } catch (e) {
            console.error(e);
        } finally {
            setIsSubmitting(false);
        }
    };

    const previewUrl = useMemo(
        () => selectedImage ? URL.createObjectURL(selectedImage) : null,
        [selectedImage]
    );

    useEffect(() => {
        return () => {
            if (previewUrl) {
                URL.revokeObjectURL(previewUrl);
            }
        };
    }, [previewUrl]);


    if (!isLoading) {
        return (
            <main className="flex w-screen items-center justify-center min-h-screen bg-neutral-900">
                <div className="text-white text-xl"><span className="loading loading-ring loading-xl"></span></div>
            </main>
        );
    }

    return (
        <main className="bg-neutral-900 min-h-screen">
            <div className="container mx-auto px-4 py-8 max-w-7xl">
                {/* Back button }
                <button
                    onClick={() => router.back()}
                    className="mb-6 text-neutral-400 hover:text-white transition-colors"
                >
                    ← Back
                </button>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Left side - Image }
                    <div className="flex flex-col w-full size-max">
                        <div className="relative aspect-square bg-neutral-800 rounded-lg overflow-hidden">

                            <input id="selectImg" type="file" className="file-input object-contain" onChange={imageChange} />
                            {selectedImage && (
                                <div className="img">
                                    <Image
                                        src={URL.createObjectURL(selectedImage)}
                                        alt={`Image`}
                                        fill
                                        className="object-contain"
                                        priority
                                    />
                                </div>
                            )}
                        </div>
                        {selectedImage && (
                            <button onClick={removeSelectedImage} className="absolute btn z-1">
                                Remove This Image
                            </button>
                        )}
                        <div>
                            <div role="submit" className="btn btn-accent" onClick={handleSubmit}>Submit</div>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
}
*/