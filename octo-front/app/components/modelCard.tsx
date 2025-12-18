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
    
    // Track the model ID to detect when it changes
    const modelIdRef = useRef<number>(model.id);
    // Track pending like state to prevent double-clicks
    const pendingLikeRef = useRef<boolean | null>(null);
    
    // Track optimistic updates separately from prop values
    const [optimisticLiked, setOptimisticLiked] = useState<boolean | null>(null);
    const [optimisticCount, setOptimisticCount] = useState<number | null>(null);
    const [isUpdating, setIsUpdating] = useState<boolean>(false);

    // Reset optimistic state when model changes
    useEffect(() => {
        const isNewModel = modelIdRef.current !== model.id;
        
        if (isNewModel) {
            modelIdRef.current = model.id;
            pendingLikeRef.current = null;
            setOptimisticLiked(null);
            setOptimisticCount(null);
            return;
        }
    }, [model.id]);

    // Clear optimistic updates when props catch up
    useEffect(() => {
        if (auth.isLoading || !auth.token) return;
        
        // If we have optimistic updates, check if props have caught up
        setOptimisticLiked(prev => {
            if (prev !== null && model.is_liked === prev) {
                return null; // Prop caught up, clear optimistic
            }
            return prev;
        });
        
        setOptimisticCount(prev => {
            if (prev !== null && model.likes_count === prev) {
                return null; // Prop caught up, clear optimistic
            }
            return prev;
        });
    }, [model.is_liked, model.likes_count, auth.isLoading, auth.token]);

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
        return model.is_liked ?? false;
    })();

    const displayCount = (() => {
        if (optimisticCount !== null) {
            return optimisticCount;
        }
        return model.likes_count ?? 0;
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
            body: JSON.stringify({ image: null, aimodel: model.id }),
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
            <Link href={`/model/${model.id}`} className="place-items-center">
                <Image
                    src={model.featured_image_url ? model.featured_image_url : "/image404.png"}
                    alt={`Model ${index}`}
                    width={512}
                    loading="eager"
                    height={Math.round(512 * 1024 / 1024)}
                    className="object-cover object-center rounded-lg md:max-h-100 lg:min-h-100"
                />
                <div className="absolute rounded-b-md inset-0 bg-linear-to-b to-neutral-950 z-0" />
            </Link>
            <div className="flex flex-col absolute bottom-0 max-h-100 max-w-11/12 text-balance z-1 mb-4">
                <div className="pl-5 mb-5">
                    <Link href={`/model/${model.id}`} className="">
                        <div className="flex text-left gap-1">
                            <Image src={"/img/nacho.png"} alt="" width={32} height={32} className="rounded-full"></Image>
                            <h5 className="text-xl truncate self-end">{model.author.username}</h5>
                        </div>
                        <h4 className="text-2xl font-semibold tracking-tight text-heading truncate">{model.name ? model.name : "N/A"}</h4>
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
