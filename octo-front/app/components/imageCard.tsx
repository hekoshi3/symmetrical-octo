"use client"

import { useState, useEffect, useRef } from "react";
import Image from "next/image"
import { GalleryImage } from "./interfaces/BackdendRes";
import Link from "next/link";
import { useAuth } from "../provider/authProvider";

const API_HOST = process.env.NEXT_PUBLIC_BACKEND_API || "http://localhost:8000/api";

interface ImgCardProps {
    img: GalleryImage;
    index?: number;
}

export const ImgCard = ({ img, index = 0 }: ImgCardProps) => {
    const auth = useAuth();
    const makeAuthenticatedRequest = auth.makeAuthenticatedRequest as (url: string, options?: RequestInit) => Promise<Response>;
    
    const imageIdRef = useRef<number>(img.id);
    const pendingLikeRef = useRef<boolean | null>(null);
    
    const [optimisticLiked, setOptimisticLiked] = useState<boolean | null>(null);
    const [optimisticCount, setOptimisticCount] = useState<number | null>(null);
    const [isUpdating, setIsUpdating] = useState<boolean>(false);

    useEffect(() => {
        const isNewImage = imageIdRef.current !== img.id;
        if (isNewImage) {
            imageIdRef.current = img.id;
            pendingLikeRef.current = null;
            setOptimisticLiked(null);
            setOptimisticCount(null);
        }
    }, [img.id]);

    useEffect(() => {
        if (auth.isLoading || !auth.token) return;
        setOptimisticLiked(prev => (prev !== null && img.is_liked === prev) ? null : prev);
        setOptimisticCount(prev => (prev !== null && img.likes_count === prev) ? null : prev);
    }, [img.is_liked, img.likes_count, auth.isLoading, auth.token]);

    // eslint-disable-next-line react-hooks/refs
    const displayLiked = pendingLikeRef.current !== null ? pendingLikeRef.current : (optimisticLiked !== null ? optimisticLiked : (img.is_liked ?? false));
    const displayCount = optimisticCount !== null ? optimisticCount : (img.likes_count ?? 0);

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
            body: JSON.stringify({ image: img.id, aimodel: null }),
        }).finally(() => {
            setTimeout(() => {
                pendingLikeRef.current = null;
                setIsUpdating(false);
            }, 200);
        });
    };

    const isAuthor = auth.user && auth.user.username === img.author.username;

    return (
        <div key={index} className="relative group bg-neutral-800 rounded-xl overflow-hidden shadow-lg transition-all hover:shadow-2xl hover:scale-[1.01]">
            
            {/* Изображение и ссылка */}
            <Link href={`/image/${img.id}`} className="block relative w-full aspect-[2/3]">
                <Image
                    src={img.image}
                    alt={`Image ${img.id}`}
                    fill
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                    priority={index < 4}
                />
                {/* Градиентная подложка для читаемости текста */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-black/40 opacity-80 group-hover:opacity-100 transition-opacity" />
            </Link>

            {/* ВЕРХНЯЯ ЧАСТЬ: Draft и Кнопки управления */}
            <div className="absolute top-0 left-0 right-0 p-3 flex justify-between items-start z-20">
                <div>
                    {!img.is_published && isAuthor && (
                        <div className="bg-yellow-500 text-black text-[10px] font-bold px-2 py-1 rounded shadow-md uppercase tracking-tighter">
                            Draft
                        </div>
                    )}
                </div>

                <div className="flex gap-2">
                    {/* Кнопка редактирования */}
                    {isAuthor && (
                        <Link 
                            href={`/image/edit/${img.id}`}
                            className="bg-black/40 hover:bg-accent hover:text-black p-2 rounded-lg backdrop-blur-md transition-all text-white"
                            title="Edit"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                        </Link>
                    )}

                    {/* Выпадающее меню параметров */}
                    <div className="dropdown dropdown-end">
                        <div tabIndex={0} role="button" className="bg-black/40 hover:bg-black/60 cursor-pointer rounded-lg p-2 backdrop-blur-md transition-all">
                            <Image src="/menu-white.svg" alt="Menu" width={18} height={18} />
                        </div>
                        <ul tabIndex={0} className="dropdown-content menu bg-neutral-900 border border-neutral-700 rounded-xl z-[30] p-2 mt-2 shadow-2xl w-56 text-[11px]">
                            <li className="menu-title text-neutral-500 text-[10px] uppercase">Generation Info</li>
                            <li className="truncate text-neutral-300"><span>Model: {img.linked_model || "N/A"}</span></li>
                            <li className="truncate text-neutral-300"><span>Sampler: {img.generation_params.sampler || "N/A"}</span></li>
                            <li className="truncate text-neutral-300"><span>Seed: {img.generation_params.seed || "N/A"}</span></li>
                            <li className="truncate text-neutral-300"><span>Size: {img.generation_params.width}x{img.generation_params.height}</span></li>
                        </ul>
                    </div>
                </div>
            </div>

            {/* НИЖНЯЯ ЧАСТЬ: Автор и Лайки */}
            <div className="absolute bottom-0 left-0 right-0 p-4 z-20">
                <div className="flex items-center justify-between">
                    <Link href={`/user/${img.author.username}`} className="flex items-center gap-2 group/author max-w-[65%]">
                        <div className="relative w-8 h-8 flex-shrink-0">
                            <Image 
                                src={img.author.profile?.avatar || "/img/nacho.png"} 
                                alt={img.author.username} 
                                fill
                                className="rounded-full border border-white/20 object-cover"
                            />
                        </div>
                        <div className="min-w-0">
                            <h4 className="text-sm font-bold text-white truncate group-hover/author:text-accent transition-colors">
                                {img.author.username}
                            </h4>
                            <p className="text-[10px] text-neutral-400 truncate">
                                {img.author.followers_count} followers
                            </p>
                        </div>
                    </Link>

                    <button
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full backdrop-blur-md transition-all ${
                            displayLiked 
                            ? 'bg-accent text-black font-bold scale-105' 
                            : 'bg-white/10 text-white hover:bg-white/20'
                        }`}
                        onClick={handleLikeClick}
                        disabled={isUpdating || auth.isLoading || !auth.token}
                    >
                        <Image
                            src={displayLiked ? "/heart-full-white.svg" : "/heart-white.svg"}
                            alt="Like"
                            width={14}
                            height={14}
                            className={displayLiked ? "invert" : ""}
                        />
                        <span className="text-xs">{displayCount}</span>
                    </button>
                </div>
            </div>
        </div>
    )
};