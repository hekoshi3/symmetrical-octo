/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import { useAuth } from "@/app/provider/authProvider";
import { GalleryImage } from "@/app/components/interfaces/BackdendRes";

const API_HOST = process.env.NEXT_PUBLIC_BACKEND_API || "http://localhost:8000/api";

export default function ImageEditPage() {
    const { id } = useParams<{ id: string }>();
    const router = useRouter();
    const auth = useAuth();

    const makeAuthenticatedRequest = auth.makeAuthenticatedRequest as (
        url: string,
        options?: RequestInit
    ) => Promise<Response>;

    const [image, setImage] = useState<GalleryImage | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [description, setDescription] = useState("");
    const [tags, setTags] = useState<string[]>([]);

    const [allTags, setAllTags] = useState<string[]>([]);
    const [tagInput, setTagInput] = useState("");

    const [isSaving, setIsSaving] = useState(false);
    const [isPublishing, setIsPublishing] = useState(false);

    /* ------------------------------------------------------------
        Load image + Normalization
    ------------------------------------------------------------ */
    useEffect(() => {
        if (!id || auth.isLoading) return;

        const loadImage = async () => {
            try {
                setIsLoading(true);
                const res = auth.token
                    ? await makeAuthenticatedRequest(`${API_HOST}/images/${id}/`)
                    : await fetch(`${API_HOST}/images/${id}/`);

                if (!res.ok) throw new Error("Failed to load image");

                const data: GalleryImage = await res.json();
                setImage(data);
                setDescription(data.description || "");

                if (Array.isArray(data.tags)) {
                    setTags(data.tags.map((t: any) => typeof t === "string" ? t : t.name));
                }
            } catch (e: any) {
                setError(e.message || "Error loading image");
            } finally {
                setIsLoading(false);
            }
        };

        loadImage();
    }, [id, auth.token, auth.isLoading, makeAuthenticatedRequest]);

    /* ------------------------------------------------------------
        Load available tags
    ------------------------------------------------------------ */
    useEffect(() => {
        fetch(`${API_HOST}/tags/`)
            .then((r) => (r.ok ? r.json() : []))
            .then((data) => {
                if (Array.isArray(data)) {
                    setAllTags(data.map((t: any) => typeof t === "string" ? t : t.name));
                }
            })
            .catch(() => {});
    }, []);

    /* ------------------------------------------------------------
        Tags helpers
    ------------------------------------------------------------ */
    const suggestions =
        tagInput.trim() === ""
            ? []
            : allTags
                  .filter(
                      (t) =>
                          t.toLowerCase().includes(tagInput.toLowerCase()) &&
                          !tags.includes(t)
                  )
                  .slice(0, 8);

    const addTag = (value: string) => {
        const clean = value.replace(/,/g, "").trim();
        if (!clean || tags.includes(clean)) {
            setTagInput("");
            return;
        }
        setTags((prev) => [...prev, clean]);
        setTagInput("");
    };

    const removeTag = (tag: string) => {
        setTags((prev) => prev.filter((t) => t !== tag));
    };

    /* ------------------------------------------------------------
        Actions (Save / Publish)
    ------------------------------------------------------------ */
    const handleSaveDraft = async () => {
        if (!auth.token || !image) return;
        setIsSaving(true);
        try {
            const res = await makeAuthenticatedRequest(`${API_HOST}/images/${image.id}/`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ description, tags }),
            });
            if (!res.ok) throw new Error("Failed to save");
            const updated = await res.json();
            setImage(updated);
            if (updated.tags) {
                setTags(updated.tags.map((t: any) => typeof t === "string" ? t : t.name));
            }
        } catch (e) { console.error(e); } finally { setIsSaving(false); }
    };

    const handlePublish = async () => {
        if (!auth.token || !image) return;
        setIsPublishing(true);
        try {
            const res = await makeAuthenticatedRequest(`${API_HOST}/images/${image.id}/`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ is_published: true, description, tags }),
            });
            if (!res.ok) throw new Error("Publish failed");
            router.push(`/image/${image.id}`);
        } catch (e) { console.error(e); } finally { setIsPublishing(false); }
    };

    if (isLoading) return <main className="flex min-h-screen items-center justify-center bg-neutral-900"><span className="loading loading-ring loading-xl text-accent"></span></main>;
    if (error || !image) return <main className="flex min-h-screen items-center justify-center bg-neutral-900 text-red-400">{error || "Image not found"}</main>;

    return (
        <main className="bg-neutral-900 min-h-screen text-white font-sans">
            <div className="container mx-auto px-4 py-8 max-w-7xl">
                {/* Back button */}
                <button onClick={() => router.back()} className="mb-6 text-neutral-400 hover:text-white flex items-center gap-2 transition-colors">
                    ← Back to Gallery
                </button>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                    {/* Left Side: Image Preview Card */}
                    <div className="flex flex-col gap-4">
                        <div className="relative aspect-square bg-neutral-800 rounded-2xl overflow-hidden border border-neutral-700 shadow-2xl">
                            <Image 
                                src={image.image} 
                                alt="Editable item" 
                                fill 
                                className="object-contain" 
                                priority 
                            />
                        </div>
                        {image.author && (
                            <div className="flex items-center gap-3 p-4 bg-neutral-800 rounded-xl border border-neutral-700">
                                <div className="relative w-10 h-10 rounded-full overflow-hidden border border-neutral-600">
                                    <Image 
                                        src={image.author.profile?.avatar || "/img/nacho.png"} 
                                        alt={image.author.username} 
                                        fill 
                                        className="object-cover"
                                    />
                                </div>
                                <span className="text-sm font-medium">Post by <span className="text-accent">{image.author.username}</span></span>
                            </div>
                        )}
                    </div>

                    {/* Right Side: Editor Form */}
                    <div className="flex flex-col gap-6">
                        <h1 className="text-2xl font-bold text-accent">Edit Image Details</h1>

                        {/* Description Field */}
                        <div>
                            <label className="text-sm text-neutral-400 block mb-2 font-medium">Description</label>
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                rows={5}
                                placeholder="Add a caption to your image..."
                                className="w-full bg-neutral-800 text-white rounded-xl p-4 resize-none border border-neutral-700 focus:border-accent outline-none transition-all shadow-inner"
                            />
                        </div>

                        {/* Tags Section */}
                        <div className="relative">
                            <label className="text-sm text-neutral-400 block mb-2 font-medium">Tags</label>
                            <div className="flex flex-col gap-3">
                                <input
                                    value={tagInput}
                                    onChange={(e) => setTagInput(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter" || e.key === ",") {
                                            e.preventDefault();
                                            addTag(tagInput);
                                        }
                                    }}
                                    placeholder="Type tag and press Enter..."
                                    className="w-full bg-neutral-800 text-white rounded-xl p-3 border border-neutral-700 focus:border-accent outline-none transition-all shadow-inner"
                                />

                                {/* Suggestions Dropdown */}
                                {suggestions.length > 0 && (
                                    <div className="absolute z-20 w-full bg-neutral-800 border border-neutral-700 rounded-xl mt-14 shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-1">
                                        {suggestions.map((t) => (
                                            <button
                                                key={t}
                                                type="button"
                                                onClick={() => addTag(t)}
                                                className="block w-full text-left px-4 py-3 hover:bg-neutral-700 transition-colors border-b border-neutral-700 last:border-0"
                                            >
                                                {t}
                                            </button>
                                        ))}
                                    </div>
                                )}

                                {/* Tag Chips Container */}
                                <div className="flex flex-wrap gap-2 pt-1">
                                    {tags.length === 0 && <span className="text-sm text-neutral-600 italic">No tags added yet</span>}
                                    {tags.map((t) => (
                                        <span 
                                            key={t} 
                                            className="flex items-center gap-1.5 bg-accent/10 text-accent border border-accent/20 px-3 py-1.5 rounded-full text-sm font-medium transition-all hover:bg-accent/20"
                                        >
                                            #{t}
                                            <button 
                                                type="button" 
                                                onClick={() => removeTag(t)}
                                                className="hover:text-white ml-1 font-bold text-lg leading-none"
                                            >
                                                ×
                                            </button>
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Actions buttons */}
                        <div className="flex gap-4 mt-8">
                            <button
                                onClick={handleSaveDraft}
                                disabled={isSaving}
                                className="flex-1 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 py-3.5 rounded-xl font-semibold transition-all active:scale-95 disabled:opacity-50"
                            >
                                {isSaving ? <span className="loading loading-spinner loading-sm"></span> : "Save Draft"}
                            </button>

                            <button
                                onClick={handlePublish}
                                disabled={isPublishing}
                                className="flex-1 bg-accent hover:bg-accent-focus text-black font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-accent/20 active:scale-95 disabled:opacity-50"
                            >
                                {isPublishing ? <span className="loading loading-spinner loading-sm text-black"></span> : "Publish Post"}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
}