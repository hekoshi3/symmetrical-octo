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
    
    // Track the image ID to detect when it changes
    const imageIdRef = useRef<number>(img.id);
    // Track pending like state to prevent double-clicks
    const pendingLikeRef = useRef<boolean | null>(null);
    
    // Track optimistic updates separately from prop values
    const [optimisticLiked, setOptimisticLiked] = useState<boolean | null>(null);
    const [optimisticCount, setOptimisticCount] = useState<number | null>(null);
    const [isUpdating, setIsUpdating] = useState<boolean>(false);

    // Reset optimistic state when image changes
    useEffect(() => {
        const isNewImage = imageIdRef.current !== img.id;
        
        if (isNewImage) {
            imageIdRef.current = img.id;
            pendingLikeRef.current = null;
            setOptimisticLiked(null);
            setOptimisticCount(null);
            return;
        }
    }, [img.id]);

    // Clear optimistic updates when props catch up
    useEffect(() => {
        if (auth.isLoading || !auth.token) return;
        
        // If we have optimistic updates, check if props have caught up
        setOptimisticLiked(prev => {
            if (prev !== null && img.is_liked === prev) {
                return null; // Prop caught up, clear optimistic
            }
            return prev;
        });
        
        setOptimisticCount(prev => {
            if (prev !== null && img.likes_count === prev) {
                return null; // Prop caught up, clear optimistic
            }
            return prev;
        });
    }, [img.is_liked, img.likes_count, auth.isLoading, auth.token]);

    // Determine the actual liked state to display
    // Use optimistic update if available, otherwise use prop value
    const displayLiked = (() => {
        // If we have a pending optimistic update, use it
        if (pendingLikeRef.current !== null) {
            return pendingLikeRef.current;
        }
        if (optimisticLiked !== null) {
            return optimisticLiked;
        }
        // Otherwise use prop value (respecting auth status)
        if (!auth.token || auth.isLoading) {
            return false;
        }
        return img.is_liked ?? false;
    })();

    const displayCount = (() => {
        if (optimisticCount !== null) {
            return optimisticCount;
        }
        return img.likes_count ?? 0;
    })();

    const handleLikeClick = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        
        // Prevent clicks if not authenticated, already updating, or button disabled
        if (!auth.token || isUpdating || auth.isLoading) return;

        // Get current display state
        const currentLiked = displayLiked;
        const currentCount = displayCount;
        const nextLiked = !currentLiked;
        
        // Set pending state to prevent interference
        pendingLikeRef.current = nextLiked;
        setIsUpdating(true);
        
        // Optimistic update
        setOptimisticLiked(nextLiked);
        setOptimisticCount(nextLiked ? currentCount + 1 : Math.max(currentCount - 1, 0));

        // Fire and forget - don't await, suppress all errors including 400
        makeAuthenticatedRequest(`${API_HOST}/likes/`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ image: img.id, aimodel: null }),
        }).then((response) => {
            // Silently handle all responses - 400 is expected when unliking
            // Don't throw errors or log anything
            if (!response.ok) {
                // 400 and other errors are expected for toggle operations
                // Silently consume the response body to prevent console errors
                response.text().catch(() => {});
            }
            // Success or error - optimistic update will persist until props update
        }).catch(() => {
            // Silently ignore all errors (network errors, etc.)
            // Keep the optimistic update regardless
        }).finally(() => {
            // Clear pending and re-enable button after a short delay
            setTimeout(() => {
                pendingLikeRef.current = null;
                setIsUpdating(false);
                // Don't clear optimistic updates here - let them persist until props update
                // The useEffect will clear them when props match
            }, 200);
        });
    };

    return (
        <div key={index} className="relative grid bg-neutral-primary-soft min-w-70 md:max-w-80 rounded-lg hover:scale-101">
            <Link href={`/image/${img.id}`} className="place-items-center">
                <Image
                    src={img.image}
                    alt={`Generated ${index}`}
                    width={512}
                    loading="eager"
                    height={Math.round(512 * 1024 / 1024)}
                    className="object-cover object-center rounded-lg md:max-h-100 lg:min-h-100"
                />
                <div className="absolute rounded-b-md inset-0 bg-linear-to-b to-neutral-950 z-0" />
            </Link>
            <div className="flex flex-col absolute top-0 right-0 max-h-100 max-w-11/12 text-balance z-1 mb-4">
                <div className="dropdown dropdown-end pt-2 pr-2">
                    <div tabIndex={0} role="button" className="bg-black/30 cursor-pointer rounded-sm p-2">
                        <Image className="" src={"/menu-white.svg"} alt="" width={18} height={18}></Image></div>
                    <div tabIndex={-1} className="dropdown-content menu bg-neutral-800 rounded-box z-1 p-2 mr-2 shadow-sm overflow-hidden">
                        <ul>
                            <li className="truncate">Model: {img.linked_model ? img.linked_model : "N/A"}</li>
                            <li className="truncate">Sampler: {img.generation_params.sampler ? img.generation_params.sampler : "N/A"}</li>
                            <li className="truncate">Sheduler: {img.generation_params.schedule_type ? img.generation_params.schedule_type : "N/A"}</li>
                            <li className="truncate">Seed: {img.generation_params.seed ? img.generation_params.seed : "N/A"}</li>
                            <li className="truncate">Width: {img.generation_params.width ? img.generation_params.width : "N/A"}</li>
                            <li className="truncate">Height: {img.generation_params.height ? img.generation_params.height : "N/A"}</li>
                        </ul>
                    </div>
                </div>
            </div>
            <div className="flex flex-col absolute bottom-0 max-h-100 max-w-11/12 text-balance z-1 mb-4">
                <div className="pl-5 mb-5">
                    <Link href="#" className="">
                        <Image src={"/img/nacho.png"} alt="" width={32} height={32} className="rounded-full"></Image>
                        <div>
                            <h4 className="text-2xl font-semibold tracking-tight text-heading truncate">{img.author.username}</h4>
                            <h5 className="text-xl tracking-tight truncate">{img.author.followers_count} подписчиков</h5>
                        </div>
                    </Link>
                </div>
                <div className="pl-10 lg:pl-5 h-10 scale-150 lg:scale-100">
                    <button
                        className="flex items-center bg-white/20 cursor-pointer rounded-sm mr-2 px-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        onClick={handleLikeClick}
                        disabled={isUpdating || auth.isLoading || !auth.token}
                        type="button"
                    >
                        <Image
                            className="m-2"
                            src={displayLiked ? "/heart-full-white.svg" : "/heart-white.svg"}
                            alt={displayLiked ? "Liked" : "Not liked"}
                            width={16}
                            height={16}
                        />
                        <span className="text-sm pr-2">{displayCount}</span>
                    </button>
                </div>
            </div>
        </div>
    )
};

