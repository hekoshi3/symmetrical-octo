"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useAuth } from "../../provider/authProvider";

const API_HOST = process.env.NEXT_PUBLIC_BACKEND_API || "http://localhost:8000/api";

export default function UploadPage() {
    const router = useRouter();
    const auth = useAuth();
    const makeAuthenticatedRequest = auth.makeAuthenticatedRequest as (url: string, options?: RequestInit) => Promise<Response>;

    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [selectedImage, setSelectedImage] = useState<File | null>(null);

    // Управление состоянием загрузки профиля (чтобы страница не "висела")
    useEffect(() => {
        if (auth.isLoading) return;
        if (!auth.token) {
            router.push("/login"); // Редирект если не залогинен
            return;
        }
        setIsLoading(false);
    }, [auth.token, auth.isLoading, router]);

    const imageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (files && files.length > 0) {
            setSelectedImage(files[0]);
        }
    };

    const removeSelectedImage = () => {
        setSelectedImage(null);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedImage || isSubmitting) return;

        setIsSubmitting(true);
        const form = new FormData();
        form.append("image", selectedImage);

        try {
            const res = await makeAuthenticatedRequest(`${API_HOST}/images/`, {
                method: "POST",
                body: form,
            });

            if (!res.ok) {
                // Пытаемся прочитать ошибку, если она есть
                const errorData = await res.json().catch(() => ({}));
                console.error("Server error:", errorData);
                throw new Error("Upload failed");
            }

            // 1. Получаем данные из ответа
            const data = await res.json();

            // 2. Проверяем наличие ID и перенаправляем
            if (data && data.id) {
                router.push(`/image/edit/${data.id}`);
            } else {
                console.error("ID not found in response:", data);
                throw new Error("Server did not return image ID");
            }

        } catch (e) {
            console.error("Redirect error:", e);
            alert("Upload successful, but failed to redirect. Check console.");
        } finally {
            setIsSubmitting(false);
        }
    };

    // Предпросмотр изображения
    const previewUrl = useMemo(
        () => (selectedImage ? URL.createObjectURL(selectedImage) : null),
        [selectedImage]
    );

    // Очистка памяти
    useEffect(() => {
        return () => {
            if (previewUrl) URL.revokeObjectURL(previewUrl);
        };
    }, [previewUrl]);

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
                <button
                    onClick={() => router.back()}
                    className="mb-6 text-neutral-400 hover:text-white transition-colors"
                >
                    ← Back
                </button>

                <div className="flex flex-col gap-8 items-center">
                    <h1 className="text-3xl font-bold">Upload New Image</h1>

                    <div className="w-full max-w-2xl">
                        {/* Area Upload */}
                        <div className="relative aspect-video w-full bg-neutral-800 rounded-2xl border-2 border-dashed border-neutral-700 hover:border-accent transition-colors overflow-hidden group">
                            {!selectedImage ? (
                                <label className="flex flex-col items-center justify-center w-full h-full cursor-pointer">
                                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                        <svg className="w-12 h-12 mb-4 text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                        </svg>
                                        <p className="text-sm text-neutral-400">Click to upload or drag and drop</p>
                                    </div>
                                    <input type="file" className="hidden" onChange={imageChange} accept="image/*" />
                                </label>
                            ) : (
                                <div className="relative w-full h-full">
                                    <Image
                                        src={previewUrl!}
                                        alt="Preview"
                                        fill
                                        className="object-contain p-4"
                                    />
                                    <button
                                        onClick={removeSelectedImage}
                                        className="absolute top-4 right-4 bg-red-600 hover:bg-red-700 text-white p-2 rounded-full shadow-lg transition-colors"
                                        title="Remove image"
                                    >
                                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Submit Button */}
                        <div className="mt-8 flex justify-center">
                            <button
                                onClick={handleSubmit}
                                disabled={!selectedImage || isSubmitting}
                                className={`btn btn-lg w-full md:w-64 ${isSubmitting ? 'btn-disabled' : 'btn-accent'}`}
                            >
                                {isSubmitting ? (
                                    <>
                                        <span className="loading loading-spinner"></span>
                                        Uploading...
                                    </>
                                ) : (
                                    "Continue to Edit"
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
}