"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useAuth } from "../../provider/authProvider";

const API_HOST = process.env.NEXT_PUBLIC_BACKEND_API || "http://localhost:8000/api";

// Список типов моделей (обычно это ChoiceField в Django)
const MODEL_TYPES = [
    { id: "CHECKPOINT", name: "Checkpoint" },
    { id: "LORA", name: "LoRA" },
    { id: "EMBEDDING", name: "Textual Inversion" },
    { id: "UPSCALER", name: "Upscaler" },
    { id: "CONTROLNET", name: "ControlNet" },
];

export default function ModelUploadPage() {
    const router = useRouter();
    const auth = useAuth();
    const makeAuthenticatedRequest = auth.makeAuthenticatedRequest as (url: string, options?: RequestInit) => Promise<Response>;

    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    // Новые обязательные поля
    const [name, setName] = useState("");
    const [modelType, setModelType] = useState("checkpoint");

    const [modelFile, setModelFile] = useState<File | null>(null);
    const [previewImage, setPreviewImage] = useState<File | null>(null);

    useEffect(() => {
        if (auth.isLoading) return;
        if (!auth.token) {
            router.push("/login");
            return;
        }
        setIsLoading(false);
    }, [auth.token, auth.isLoading, router]);

    const handleModelFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) {
            const file = e.target.files[0];
            setModelFile(file);
            // Автоматически подставляем имя файла в название, если оно еще пустое
            if (!name) {
                setName(file.name.replace(/\.[^/.]+$/, ""));
            }
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        // Теперь проверяем и name, и modelFile
        if (!modelFile || !name || isSubmitting) return;

        setIsSubmitting(true);
        const form = new FormData();
        
        form.append("file", modelFile); 
        form.append("name", name); // Отправляем название
        form.append("model_type", modelType); // Отправляем тип
        
        if (previewImage) {
            form.append("image", previewImage); 
        }

        try {
            const res = await makeAuthenticatedRequest(`${API_HOST}/models/`, {
                method: "POST",
                body: form,
            });

            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                console.error("Server error:", errorData);
                alert(`Ошибка: ${JSON.stringify(errorData)}`);
                throw new Error("Model upload failed");
            }

            const data = await res.json();
            if (data && data.id) {
                router.push(`/model/edit/${data.id}`);
            }
        } catch (e) {
            console.error("Upload error:", e);
        } finally {
            setIsSubmitting(false);
        }
    };

    const previewImageUrl = useMemo(
        () => (previewImage ? URL.createObjectURL(previewImage) : null),
        [previewImage]
    );

    useEffect(() => {
        return () => { if (previewImageUrl) URL.revokeObjectURL(previewImageUrl); };
    }, [previewImageUrl]);

    if (isLoading) {
        return (
            <main className="flex min-h-screen items-center justify-center bg-neutral-900">
                <span className="loading loading-ring loading-xl text-accent"></span>
            </main>
        );
    }

    return (
        <main className="bg-neutral-900 min-h-screen text-white">
            <div className="container mx-auto px-4 py-8 max-w-4xl">
                <button onClick={() => router.back()} className="mb-6 text-neutral-400 hover:text-white">← Back</button>

                <div className="flex flex-col gap-8 items-center">
                    <h1 className="text-3xl font-bold">Upload New Model</h1>

                    <div className="w-full max-w-2xl flex flex-col gap-6">
                        
                        {/* Поле названия */}
                        <div className="bg-neutral-800 p-6 rounded-2xl border border-neutral-700">
                            <label className="block text-sm font-medium mb-2 text-neutral-400">Model Name *</label>
                            <input 
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="e.g. My Awesome LoRA"
                                className="input input-bordered w-full bg-neutral-700 border-neutral-600 focus:border-accent"
                                required
                            />
                        </div>

                        {/* Поле типа модели */}
                        <div className="bg-neutral-800 p-6 rounded-2xl border border-neutral-700">
                            <label className="block text-sm font-medium mb-2 text-neutral-400">Model Type *</label>
                            <select 
                                value={modelType}
                                onChange={(e) => setModelType(e.target.value)}
                                className="select select-bordered w-full bg-neutral-700 border-neutral-600 focus:border-accent"
                            >
                                {MODEL_TYPES.map(t => (
                                    <option key={t.id} value={t.id}>{t.name}</option>
                                ))}
                            </select>
                        </div>

                        {/* Выбор основного файла */}
                        <div className="bg-neutral-800 p-6 rounded-2xl border border-neutral-700">
                            <label className="block text-sm font-medium mb-2 text-neutral-400">Model File *</label>
                            <input 
                                type="file" 
                                onChange={handleModelFileChange}
                                className="file-input file-input-bordered file-input-accent w-full bg-neutral-700"
                                accept=".safetensors,.ckpt,.pt,.zip,.bin"
                                required
                            />
                        </div>

                        {/* Превью */}
                        <div className="bg-neutral-800 p-6 rounded-2xl border border-neutral-700">
                            <label className="block text-sm font-medium mb-2 text-neutral-400">Preview Image (Thumbnail)</label>
                            <div className="relative aspect-video w-full bg-neutral-900 rounded-xl border-2 border-dashed border-neutral-600 hover:border-accent overflow-hidden">
                                {!previewImage ? (
                                    <label className="flex flex-col items-center justify-center w-full h-full cursor-pointer">
                                        <span className="text-sm text-neutral-500">Upload cover image</span>
                                        <input type="file" className="hidden" onChange={(e) => setPreviewImage(e.target.files?.[0] || null)} accept="image/*" />
                                    </label>
                                ) : (
                                    <div className="relative w-full h-full">
                                        <Image src={previewImageUrl!} alt="Preview" fill className="object-contain p-2" />
                                        <button onClick={() => setPreviewImage(null)} className="absolute top-2 right-2 bg-red-600 p-1 rounded-full">×</button>
                                    </div>
                                )}
                            </div>
                        </div>

                        <button
                            onClick={handleSubmit}
                            disabled={!modelFile || !name || isSubmitting}
                            className={`btn btn-lg w-full ${isSubmitting ? 'btn-disabled' : 'btn-accent'}`}
                        >
                            {isSubmitting ? <span className="loading loading-spinner"></span> : "Upload and Continue"}
                        </button>
                    </div>
                </div>
            </div>
        </main>
    );
}