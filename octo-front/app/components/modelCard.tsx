"use client"

import { useState, useEffect, useRef } from "react";
import Image from "next/image"
import Link from "next/link";
import { ModelList } from "./interfaces/BackdendRes";
import { useAuth } from "../provider/authProvider";

const API_HOST = process.env.NEXT_PUBLIC_BACKEND_API || "http://localhost:8000/api";

interface ModelCardProps {
    model: ModelList;
    index?: number;
}

export const ModelCard = ({ model, index = 0 }: ModelCardProps) => {
    const auth = useAuth();
    const makeAuthenticatedRequest = auth.makeAuthenticatedRequest as (url: string, options?: RequestInit) => Promise<Response>;
    
    const modelIdRef = useRef<number>(model.id);
    const pendingLikeRef = useRef<boolean | null>(null);
    
    const [optimisticLiked, setOptimisticLiked] = useState<boolean | null>(null);
    const [optimisticCount, setOptimisticCount] = useState<number | null>(null);
    const [isUpdating, setIsUpdating] = useState<boolean>(false);

    useEffect(() => {
        const isNewModel = modelIdRef.current !== model.id;
        if (isNewModel) {
            modelIdRef.current = model.id;
            pendingLikeRef.current = null;
            setOptimisticLiked(null);
            setOptimisticCount(null);
        }
    }, [model.id]);

    useEffect(() => {
        if (auth.isLoading || !auth.token) return;
        setOptimisticLiked(prev => (prev !== null && model.is_liked === prev) ? null : prev);
        setOptimisticCount(prev => (prev !== null && model.likes_count === prev) ? null : prev);
    }, [model.is_liked, model.likes_count, auth.isLoading, auth.token]);

    // eslint-disable-next-line react-hooks/refs
    const displayLiked = pendingLikeRef.current !== null ? pendingLikeRef.current : (optimisticLiked !== null ? optimisticLiked : (model.is_liked ?? false));
    const displayCount = optimisticCount !== null ? optimisticCount : (model.likes_count ?? 0);

    const handleLikeClick = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (!auth.token || isUpdating || auth.isLoading) return;

        const currentCount = displayCount;
        const nextLiked = !displayLiked;
        
        pendingLikeRef.current = nextLiked;
        setIsUpdating(true);
        setOptimisticLiked(nextLiked);
        setOptimisticCount(nextLiked ? currentCount + 1 : Math.max(currentCount - 1, 0));

        makeAuthenticatedRequest(`${API_HOST}/likes/`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ image: null, aimodel: model.id }),
        }).finally(() => {
            setTimeout(() => {
                pendingLikeRef.current = null;
                setIsUpdating(false);
            }, 200);
        });
    };

    const isAuthor = auth.user && auth.user.username === model.author.username;

    return (
        <div key={index} className="relative group bg-neutral-800 rounded-xl overflow-hidden shadow-lg transition-all hover:shadow-2xl hover:scale-[1.01]">
            
            {/* Изображение модели */}
            <Link href={`/model/${model.id}`} className="block relative w-full aspect-[2/3]">
                <Image
                    src={model.featured_image_url || "/image404.png"}
                    alt={model.name || "Model"}
                    width={768}
                    height={1024}
                    sizes="(max-width: 768px) 100vw, 33vw"
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                    priority={index < 4}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-transparent to-black/40 opacity-80 group-hover:opacity-100 transition-opacity" />
            </Link>

            {/* ВЕРХНЯЯ ЧАСТЬ: Статус и Кнопки */}
            <div className="absolute top-0 left-0 right-0 p-3 flex justify-between items-start z-20">
                <div>
                    {!model.is_published && isAuthor && (
                        <div className="bg-yellow-500 text-black text-[10px] font-bold px-2 py-1 rounded shadow-md uppercase">
                            Draft
                        </div>
                    )}
                    {/* Бейдж типа модели (LoRA, Checkpoint и т.д.) */}
                    {model.model_type && (
                        <div className="mt-1 bg-accent/90 text-black text-[9px] font-black px-1.5 py-0.5 rounded uppercase">
                            {model.model_type}
                        </div>
                    )}
                </div>

                <div className="flex gap-2">
                    {/* Edit только для владельца */}
                    {isAuthor && (
                        <Link 
                            href={`/model/edit/${model.id}`}
                            className="bg-black/40 hover:bg-accent hover:text-black p-2 rounded-lg backdrop-blur-md transition-all text-white"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                        </Link>
                    )}

                    {/* Доп. инфо */}
                    <div className="dropdown dropdown-end">
                        <div tabIndex={0} role="button" className="bg-black/40 hover:bg-black/60 cursor-pointer rounded-lg p-2 backdrop-blur-md transition-all">
                            <Image src="/menu-white.svg" alt="Info" width={18} height={18} />
                        </div>
                        <ul tabIndex={0} className="dropdown-content menu bg-neutral-900 border border-neutral-700 rounded-xl z-[30] p-3 mt-2 shadow-2xl w-60 text-[11px]">
                            <li className="menu-title text-neutral-500 text-[10px] uppercase mb-1">Model Details</li>
                            <li className="text-neutral-300 mb-1"><span>Type: <b className="text-accent">{model.model_type || "N/A"}</b></span></li>
                            <li className="text-neutral-300 mb-1"><span>Downloads: <b>{model.downloads_count || 0}</b></span></li>
                            <li className="text-neutral-300 mb-1"><span>Hash: <span className="font-mono opacity-60 text-[9px]">{model.file_hash?.substring(0,10) || "N/A"}...</span></span></li>
                        </ul>
                    </div>
                </div>
            </div>

            {/* НИЖНЯЯ ЧАСТЬ: Название и Автор */}
            <div className="absolute bottom-0 left-0 right-0 p-4 z-20">
                <div className="mb-3">
                    <h4 className="text-lg font-bold text-white truncate leading-tight group-hover:text-accent transition-colors">
                        {model.name || "Untitled Model"}
                    </h4>
                </div>
                
                <div className="flex items-center justify-between">
                    <Link href={`/user/${model.author.username}`} className="flex items-center gap-2 group/author max-w-[65%]">
                        <div className="relative w-7 h-7 flex-shrink-0">
                            <Image 
                                src={model.author.profile?.avatar || "/img/nacho.png"} 
                                alt={model.author.username} 
                                fill
                                className="rounded-full border border-white/20 object-cover"
                            />
                        </div>
                        <span className="text-xs font-medium text-neutral-200 truncate group-hover/author:text-white">
                            {model.author.username}
                        </span>
                    </Link>

                    <button
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full backdrop-blur-md transition-all ${
                            displayLiked 
                            ? 'bg-accent text-black font-bold' 
                            : 'bg-white/10 text-white hover:bg-white/20'
                        }`}
                        onClick={handleLikeClick}
                        disabled={isUpdating || auth.isLoading || !auth.token}
                    >
                        <Image
                            src={displayLiked ? "/heart-full-white.svg" : "/heart-white.svg"}
                            alt="Like"
                            width={13}
                            height={13}
                            className={displayLiked ? "invert" : ""}
                        />
                        <span className="text-xs">{displayCount}</span>
                    </button>
                </div>
            </div>
        </div>
    )
};