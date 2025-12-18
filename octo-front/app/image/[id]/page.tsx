"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { GalleryImage, Comment, CommentList } from "../../components/interfaces/BackdendRes";
import { useAuth } from "../../provider/authProvider";

const API_HOST = process.env.NEXT_PUBLIC_BACKEND_API || "http://localhost:8000/api";

export default function ImageDetailPage() {
    const params = useParams();
    const router = useRouter();
    const imageId = params?.id as string;
    
    const [image, setImage] = useState<GalleryImage | null>(null);
    const [comments, setComments] = useState<Comment[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [commentText, setCommentText] = useState("");
    const [isSubmittingComment, setIsSubmittingComment] = useState(false);
    
    const auth = useAuth();
    const makeAuthenticatedRequest = auth.makeAuthenticatedRequest as (url: string, options?: RequestInit) => Promise<Response>;
    
    // Like state management (similar to imageCard)
    const [optimisticLiked, setOptimisticLiked] = useState<boolean | null>(null);
    const [optimisticCount, setOptimisticCount] = useState<number | null>(null);
    const [isUpdatingLike, setIsUpdatingLike] = useState<boolean>(false);
    const pendingLikeRef = useRef<boolean | null>(null);

    useEffect(() => {
        if (!imageId || auth.isLoading) return;

        const fetchImageData = async () => {
            try {
                setIsLoading(true);
                setError(null);

                // Fetch image details
                const imageRes = auth.token
                    ? await makeAuthenticatedRequest(`${API_HOST}/images/${imageId}/`)
                    : await fetch(`${API_HOST}/images/${imageId}/`);
                
                if (!imageRes.ok) {
                    throw new Error("Failed to fetch image");
                }
                
                const imageData: GalleryImage = await imageRes.json();
                setImage(imageData);
                setOptimisticLiked(null);
                setOptimisticCount(null);

                // Fetch comments
                const commentsRes = auth.token
                    ? await makeAuthenticatedRequest(`${API_HOST}/comments/?image=${imageId}`)
                    : await fetch(`${API_HOST}/comments/?image=${imageId}`);
                
                if (commentsRes.ok) {
                    const commentsData: CommentList = await commentsRes.json();
                    setComments(commentsData.results || []);
                }
            } catch (err: any) {
                console.error("Error loading image:", err);
                setError(err.message || "Failed to load image");
            } finally {
                setIsLoading(false);
            }
        };

        fetchImageData();
    }, [imageId, auth.token, auth.isLoading, makeAuthenticatedRequest]);

    // Clear optimistic updates when props catch up
    useEffect(() => {
        if (!image || auth.isLoading || !auth.token) return;
        
        setOptimisticLiked(prev => {
            if (prev !== null && image.is_liked === prev) {
                return null;
            }
            return prev;
        });
        
        setOptimisticCount(prev => {
            if (prev !== null && image.likes_count === prev) {
                return null;
            }
            return prev;
        });
    }, [image?.is_liked, image?.likes_count, auth.isLoading, auth.token, image]);

    const displayLiked = (() => {
        if (pendingLikeRef.current !== null) {
            return pendingLikeRef.current;
        }
        if (optimisticLiked !== null) {
            return optimisticLiked;
        }
        if (!auth.token || auth.isLoading || !image) {
            return false;
        }
        return image.is_liked ?? false;
    })();

    const displayCount = (() => {
        if (optimisticCount !== null) {
            return optimisticCount;
        }
        return image?.likes_count ?? 0;
    })();

    const handleLikeClick = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        
        if (!auth.token || isUpdatingLike || auth.isLoading || !image) return;

        const currentLiked = displayLiked;
        const currentCount = displayCount;
        const nextLiked = !currentLiked;
        
        pendingLikeRef.current = nextLiked;
        setIsUpdatingLike(true);
        
        setOptimisticLiked(nextLiked);
        setOptimisticCount(nextLiked ? currentCount + 1 : Math.max(currentCount - 1, 0));

        makeAuthenticatedRequest(`${API_HOST}/likes/`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ image: image.id, aimodel: null }),
        }).then((response) => {
            if (!response.ok) {
                response.text().catch(() => {});
            }
        }).catch(() => {
            // Silently ignore errors
        }).finally(() => {
            setTimeout(() => {
                pendingLikeRef.current = null;
                setIsUpdatingLike(false);
            }, 200);
        });
    };

    const handleSubmitComment = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!auth.token || !commentText.trim() || isSubmittingComment || !image) return;

        setIsSubmittingComment(true);

        try {
            const response = await makeAuthenticatedRequest(`${API_HOST}/comments/`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ image: image.id, text: commentText.trim() }),
            });

            if (response.ok) {
                const newComment: Comment = await response.json();
                setComments(prev => [newComment, ...prev]);
                setCommentText("");
            }
        } catch (error) {
            console.error("Error submitting comment:", error);
        } finally {
            setIsSubmittingComment(false);
        }
    };

    const formatDate = (dateString: string | Date) => {
        const date = new Date(dateString);
        return date.toLocaleDateString("ru-RU", {
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    if (isLoading) {
        return (
            <main className="flex w-screen items-center justify-center min-h-screen bg-neutral-900">
                <div className="text-white text-xl"><span className="loading loading-ring loading-xl"></span></div>
            </main>
        );
    }

    if (error || !image) {
        return (
            <main className="flex w-screen items-center justify-center min-h-screen bg-neutral-900">
                <div className="text-red-400 text-xl">
                    {error || "Image not found"}
                </div>
                <Link href="/" className="ml-4 text-blue-400 hover:underline">
                    Go back
                </Link>
            </main>
        );
    }

    return (
        <main className="bg-neutral-900 min-h-screen">
            <div className="container mx-auto px-4 py-8 max-w-7xl">
                {/* Back button */}
                <button
                    onClick={() => router.back()}
                    className="mb-6 text-neutral-400 hover:text-white transition-colors"
                >
                    ← Back
                </button>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Left side - Image */}
                    <div className="flex flex-col">
                        <div className="relative w-full aspect-square bg-neutral-800 rounded-lg overflow-hidden">
                            <Image
                                src={image.image}
                                alt={`Image ${image.id}`}
                                fill
                                className="object-contain"
                                priority
                            />
                        </div>
                    </div>

                    {/* Right side - Info */}
                    <div className="flex flex-col gap-6">
                        {/* Author info */}
                        <div className="flex items-center gap-4">
                            <Link href={`/user/${image.author.id}`} className="flex items-center gap-3">
                                <Image
                                    src={image.author.profile?.avatar || "/img/nacho.png"}
                                    alt={image.author.username}
                                    width={48}
                                    height={48}
                                    className="rounded-full"
                                />
                                <div>
                                    <h2 className="text-xl font-semibold text-white">
                                        {image.author.username}
                                    </h2>
                                    <p className="text-sm text-neutral-400">
                                        {image.author.followers_count} подписчиков
                                    </p>
                                </div>
                            </Link>
                        </div>

                        {/* Like button */}
                        <div className="flex items-center gap-4">
                            <button
                                className="flex items-center gap-2 bg-white/20 hover:bg-white/30 cursor-pointer rounded-sm px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                onClick={handleLikeClick}
                                disabled={isUpdatingLike || auth.isLoading || !auth.token}
                                type="button"
                            >
                                <Image
                                    src={displayLiked ? "/heart-full-white.svg" : "/heart-white.svg"}
                                    alt={displayLiked ? "Liked" : "Not liked"}
                                    width={20}
                                    height={20}
                                />
                                <span className="text-lg font-semibold">{displayCount}</span>
                            </button>
                            <span className="text-neutral-400 text-sm">
                                {formatDate(image.created_at)}
                            </span>
                        </div>

                        {/* Generation params */}
                        <div className="bg-neutral-800 rounded-lg p-6">
                            <h3 className="text-xl font-semibold mb-4 text-white">Generation Parameters</h3>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                {image.generation_params.model && (
                                    <div>
                                        <span className="text-neutral-400">Model:</span>
                                        <span className="ml-2 text-white">{image.generation_params.model}</span>
                                    </div>
                                )}
                                {image.generation_params.sampler && (
                                    <div>
                                        <span className="text-neutral-400">Sampler:</span>
                                        <span className="ml-2 text-white">{image.generation_params.sampler}</span>
                                    </div>
                                )}
                                {image.generation_params.schedule_type && (
                                    <div>
                                        <span className="text-neutral-400">Scheduler:</span>
                                        <span className="ml-2 text-white">{image.generation_params.schedule_type}</span>
                                    </div>
                                )}
                                {image.generation_params.seed && (
                                    <div>
                                        <span className="text-neutral-400">Seed:</span>
                                        <span className="ml-2 text-white">{image.generation_params.seed}</span>
                                    </div>
                                )}
                                {image.generation_params.width && (
                                    <div>
                                        <span className="text-neutral-400">Width:</span>
                                        <span className="ml-2 text-white">{image.generation_params.width}</span>
                                    </div>
                                )}
                                {image.generation_params.height && (
                                    <div>
                                        <span className="text-neutral-400">Height:</span>
                                        <span className="ml-2 text-white">{image.generation_params.height}</span>
                                    </div>
                                )}
                                {image.generation_params.steps && (
                                    <div>
                                        <span className="text-neutral-400">Steps:</span>
                                        <span className="ml-2 text-white">{image.generation_params.steps}</span>
                                    </div>
                                )}
                                {image.generation_params.cfg_scale && (
                                    <div>
                                        <span className="text-neutral-400">CFG Scale:</span>
                                        <span className="ml-2 text-white">{image.generation_params.cfg_scale}</span>
                                    </div>
                                )}
                            </div>
                            
                            {/* Prompt */}
                            {image.generation_params.prompt && (
                                <div className="mt-4">
                                    <span className="text-neutral-400 text-sm">Prompt:</span>
                                    <p className="mt-2 text-white break-words">{image.generation_params.prompt}</p>
                                </div>
                            )}
                            
                            {/* Negative prompt */}
                            {image.generation_params.negative_prompt && (
                                <div className="mt-4">
                                    <span className="text-neutral-400 text-sm">Negative Prompt:</span>
                                    <p className="mt-2 text-white break-words">{image.generation_params.negative_prompt}</p>
                                </div>
                            )}
                        </div>

                        {/* Comments section */}
                        <div className="bg-neutral-800 rounded-lg p-6">
                            <h3 className="text-xl font-semibold mb-4 text-white">
                                Comments ({comments.length})
                            </h3>

                            {/* Comment form */}
                            {auth.token && (
                                <form onSubmit={handleSubmitComment} className="mb-6">
                                    <textarea
                                        value={commentText}
                                        onChange={(e) => setCommentText(e.target.value)}
                                        placeholder="Add a comment..."
                                        className="w-full bg-neutral-700 text-white rounded-lg p-3 mb-2 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        rows={3}
                                        disabled={isSubmittingComment}
                                    />
                                    <button
                                        type="submit"
                                        disabled={!commentText.trim() || isSubmittingComment}
                                        className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg transition-colors"
                                    >
                                        {isSubmittingComment ? "Posting..." : "Post Comment"}
                                    </button>
                                </form>
                            )}

                            {/* Comments list */}
                            <div className="space-y-4">
                                {comments.length === 0 ? (
                                    <p className="text-neutral-400 text-center py-8">No comments yet</p>
                                ) : (
                                    comments.map((comment) => (
                                        <div key={comment.id} className="border-b border-neutral-700 pb-4 last:border-0">
                                            <div className="flex items-start gap-3">
                                                <Image
                                                    src={comment.author.profile?.avatar || "/img/nacho.png"}
                                                    alt={comment.author.username}
                                                    width={32}
                                                    height={32}
                                                    className="rounded-full"
                                                />
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="font-semibold text-white">
                                                            {comment.author.username}
                                                        </span>
                                                        <span className="text-xs text-neutral-400">
                                                            {formatDate(comment.created_at)}
                                                        </span>
                                                    </div>
                                                    <p className="text-neutral-300 break-words">{comment.text}</p>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
}

