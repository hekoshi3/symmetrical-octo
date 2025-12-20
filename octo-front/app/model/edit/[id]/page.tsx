/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import { useAuth } from "@/app/provider/authProvider";

// Предположим, у вас есть интерфейс для модели, или используем any для гибкости
const API_HOST = process.env.NEXT_PUBLIC_BACKEND_API || "http://localhost:8000/api";

export default function ModelEditPage() {
    const { id } = useParams<{ id: string }>();
    const router = useRouter();
    const auth = useAuth();

    const makeAuthenticatedRequest = auth.makeAuthenticatedRequest as (
        url: string,
        options?: RequestInit
    ) => Promise<Response>;

    const [modelData, setModelData] = useState<any | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Поля редактирования
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [tags, setTags] = useState<string[]>([]);

    // Система тегов
    const [allTags, setAllTags] = useState<string[]>([]);
    const [tagInput, setTagInput] = useState("");

    const [isSaving, setIsSaving] = useState(false);
    const [isPublishing, setIsPublishing] = useState(false);

    /* ------------------------------------------------------------
        Загрузка данных модели + Нормализация тегов
    ------------------------------------------------------------ */
    useEffect(() => {
        if (!id || auth.isLoading) return;

        const loadModel = async () => {
            try {
                setIsLoading(true);
                const res = auth.token
                    ? await makeAuthenticatedRequest(`${API_HOST}/models/${id}/`)
                    : await fetch(`${API_HOST}/models/${id}/`);

                if (!res.ok) throw new Error("Failed to load model");

                const data = await res.json();
                setModelData(data);
                setName(data.name || "");
                setDescription(data.description || "");

                // Приведение тегов django-taggit к массиву строк
                if (Array.isArray(data.tags)) {
                    setTags(data.tags.map((t: any) => typeof t === "string" ? t : t.name));
                }
            } catch (e: any) {
                setError(e.message || "Error loading model");
            } finally {
                setIsLoading(false);
            }
        };

        loadModel();
    }, [id, auth.token, auth.isLoading, makeAuthenticatedRequest]);

    /* ------------------------------------------------------------
        Загрузка всех доступных тегов для подсказок
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
        Хелперы для тегов
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
        Сохранение черновика (PATCH)
    ------------------------------------------------------------ */
    const handleSaveDraft = async () => {
        if (!auth.token || !modelData) return;

        setIsSaving(true);
        try {
            const res = await makeAuthenticatedRequest(
                `${API_HOST}/models/${modelData.id}/`,
                {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        name,
                        description,
                        tags,
                    }),
                }
            );

            if (!res.ok) throw new Error("Failed to save");
            const updated = await res.json();
            setModelData(updated);
            if (updated.tags) {
                setTags(updated.tags.map((t: any) => typeof t === "string" ? t : t.name));
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsSaving(false);
        }
    };

    /* ------------------------------------------------------------
        Публикация (PATCH)
    ------------------------------------------------------------ */
    const handlePublish = async () => {
        if (!auth.token || !modelData) return;

        setIsPublishing(true);
        try {
            const res = await makeAuthenticatedRequest(
                `${API_HOST}/models/${modelData.id}/`,
                {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ 
                        is_published: true,
                        name,
                        description,
                        tags 
                    }),
                }
            );

            if (!res.ok) throw new Error("Publish failed");
            router.push(`/model/${modelData.id}`); // Переход на страницу модели
        } catch (e) {
            console.error(e);
        } finally {
            setIsPublishing(false);
        }
    };

    if (isLoading) return <main className="flex min-h-screen items-center justify-center bg-neutral-900"><span className="loading loading-ring loading-xl text-accent"></span></main>;
    if (error || !modelData) return <main className="flex min-h-screen items-center justify-center bg-neutral-900 text-red-400">{error || "Model not found"}</main>;

    return (
        <main className="bg-neutral-900 min-h-screen text-white font-sans">
            <div className="container mx-auto px-4 py-8 max-w-7xl">
                <button onClick={() => router.back()} className="mb-6 text-neutral-400 hover:text-white flex items-center gap-2">
                    ← Back to Upload
                </button>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                    {/* Preview Image */}
                    <div className="flex flex-col gap-4">
                        <div className="relative aspect-video bg-neutral-800 rounded-2xl overflow-hidden border border-neutral-700">
                            {modelData.image ? (
                                <Image src={modelData.image} alt="Model preview" fill className="object-cover" />
                            ) : (
                                <div className="flex items-center justify-center h-full text-neutral-500">No Preview Image</div>
                            )}
                        </div>
                        <div className="p-4 bg-neutral-800 rounded-xl border border-neutral-700">
                            <p className="text-sm text-neutral-400">File attached:</p>
                            <p className="truncate font-mono text-accent">{modelData.file?.split('/').pop() || "model_file.safetensors"}</p>
                        </div>
                    </div>

                    {/* Editor Form */}
                    <div className="flex flex-col gap-6">
                        <h1 className="text-2xl font-bold text-accent">Finalize Your Model</h1>
                        
                        {/* Name */}
                        <div>
                            <label className="text-sm text-neutral-400 block mb-1">Model Name</label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Enter model name..."
                                className="w-full bg-neutral-800 text-white rounded-lg p-3 border border-neutral-700 focus:border-accent outline-none"
                            />
                        </div>

                        {/* Description */}
                        <div>
                            <label className="text-sm text-neutral-400 block mb-1">Description</label>
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                rows={5}
                                placeholder="What makes this model special?"
                                className="w-full bg-neutral-800 text-white rounded-lg p-3 resize-none border border-neutral-700 focus:border-accent outline-none"
                            />
                        </div>

                        {/* Tags System */}
                        <div className="relative">
                            <label className="text-sm text-neutral-400 block mb-1">Tags</label>
                            <input
                                value={tagInput}
                                onChange={(e) => setTagInput(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" || e.key === ",") {
                                        e.preventDefault();
                                        addTag(tagInput);
                                    }
                                }}
                                placeholder="Add tags (style, character, etc)..."
                                className="w-full bg-neutral-800 text-white rounded-lg p-3 border border-neutral-700 focus:border-accent outline-none"
                            />

                            {suggestions.length > 0 && (
                                <div className="absolute z-20 w-full bg-neutral-800 border border-neutral-700 rounded-lg mt-1 shadow-2xl overflow-hidden">
                                    {suggestions.map((t) => (
                                        <button
                                            key={t}
                                            type="button"
                                            onClick={() => addTag(t)}
                                            className="block w-full text-left px-4 py-2 hover:bg-neutral-700 transition-colors"
                                        >
                                            {t}
                                        </button>
                                    ))}
                                </div>
                            )}

                            <div className="flex flex-wrap gap-2 mt-4">
                                {tags.map((t) => (
                                    <span key={t} className="flex items-center gap-1 bg-accent/20 text-accent border border-accent/30 px-3 py-1 rounded-full text-sm">
                                        #{t}
                                        <button 
                                            type="button" 
                                            onClick={() => removeTag(t)}
                                            className="hover:text-white ml-1 font-bold"
                                        >
                                            ×
                                        </button>
                                    </span>
                                ))}
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-4 mt-6">
                            <button
                                onClick={handleSaveDraft}
                                disabled={isSaving}
                                className="flex-1 bg-neutral-700 hover:bg-neutral-600 py-3 rounded-xl transition-all disabled:opacity-50"
                            >
                                {isSaving ? "Saving..." : "Update Draft"}
                            </button>

                            <button
                                onClick={handlePublish}
                                disabled={isPublishing}
                                className="flex-1 bg-accent hover:bg-opacity-80 text-black font-bold py-3 rounded-xl transition-all disabled:opacity-50"
                            >
                                {isPublishing ? "Publishing..." : "Publish Model"}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
}