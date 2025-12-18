"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { ModelList, Comment, CommentList } from "../../components/interfaces/BackdendRes";
import { useAuth } from "../../provider/authProvider";

const API_HOST = process.env.NEXT_PUBLIC_BACKEND_API || "http://localhost:8000/api";

export default function ModelDetailPage() {
    const params = useParams();
    const router = useRouter();
    const modelId = params?.id as string;
    
    const [model, setModel] = useState<ModelList | null>(null);
    const [comments, setComments] = useState<Comment[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [commentText, setCommentText] = useState("");
    const [isSubmittingComment, setIsSubmittingComment] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);
    
    const auth = useAuth();
    const makeAuthenticatedRequest = auth.makeAuthenticatedRequest as (url: string, options?: RequestInit) => Promise<Response>;
    
    // Like state management (similar to imageCard)
    const [optimisticLiked, setOptimisticLiked] = useState<boolean | null>(null);
    const [optimisticCount, setOptimisticCount] = useState<number | null>(null);
    const [isUpdatingLike, setIsUpdatingLike] = useState<boolean>(false);
    const pendingLikeRef = useRef<boolean | null>(null);

    useEffect(() => {
        if (!modelId || auth.isLoading) return;

        const fetchModelData = async () => {
            try {
                setIsLoading(true);
                setError(null);

                // Fetch model details
                const modelRes = auth.token
                    ? await makeAuthenticatedRequest(`${API_HOST}/models/${modelId}/`)
                    : await fetch(`${API_HOST}/models/${modelId}/`);
                
                if (!modelRes.ok) {
                    throw new Error("Failed to fetch model");
                }
                
                const modelData: ModelList = await modelRes.json();
                setModel(modelData);
                setOptimisticLiked(null);
                setOptimisticCount(null);

                // Fetch comments
                const commentsRes = auth.token
                    ? await makeAuthenticatedRequest(`${API_HOST}/comments/?aimodel=${modelId}`)
                    : await fetch(`${API_HOST}/comments/?aimodel=${modelId}`);
                
                if (commentsRes.ok) {
                    const commentsData: CommentList = await commentsRes.json();
                    setComments(commentsData.results || []);
                }
            } catch (err: any) {
                console.error("Error loading model:", err);
                setError(err.message || "Failed to load model");
            } finally {
                setIsLoading(false);
            }
        };

        fetchModelData();
    }, [modelId, auth.token, auth.isLoading, makeAuthenticatedRequest]);

    // Clear optimistic updates when props catch up
    useEffect(() => {
        if (!model || auth.isLoading || !auth.token) return;
        
        setOptimisticLiked(prev => {
            if (prev !== null && model.is_liked === prev) {
                return null;
            }
            return prev;
        });
        
        setOptimisticCount(prev => {
            if (prev !== null && model.likes_count === prev) {
                return null;
            }
            return prev;
        });
    }, [model?.is_liked, model?.likes_count, auth.isLoading, auth.token, model]);

    const displayLiked = (() => {
        if (pendingLikeRef.current !== null) {
            return pendingLikeRef.current;
        }
        if (optimisticLiked !== null) {
            return optimisticLiked;
        }
        if (!auth.token || auth.isLoading || !model) {
            return false;
        }
        return model.is_liked ?? false;
    })();

    const displayCount = (() => {
        if (optimisticCount !== null) {
            return optimisticCount;
        }
        return model?.likes_count ?? 0;
    })();

    const handleLikeClick = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        
        if (!auth.token || isUpdatingLike || auth.isLoading || !model) return;

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
            body: JSON.stringify({ image: null, aimodel: model.id }),
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

    const handleDownload = async () => {
        if (!model || isDownloading) return;

        setIsDownloading(true);
        try {
            // The download endpoint redirects to the file and increments the counter
            const downloadUrl = `${API_HOST}/models/${model.id}/download/`;
            
            if (auth.token) {
                // For authenticated users, use authenticated request
                const response = await makeAuthenticatedRequest(downloadUrl, {
                    method: "GET",
                    redirect: "follow",
                });
                
                if (response.ok || response.redirected) {
                    // If redirected, get the final URL and download
                    const finalUrl = response.url || downloadUrl;
                    const a = document.createElement("a");
                    a.href = finalUrl;
                    a.download = model.file.split("/").pop() || `model-${model.id}`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    
                    // Refresh model data to update download count
                    const modelRes = await makeAuthenticatedRequest(`${API_HOST}/models/${model.id}/`);
                    if (modelRes.ok) {
                        const updatedModel: ModelList = await modelRes.json();
                        setModel(updatedModel);
                    }
                }
            } else {
                // For unauthenticated users, just open the URL (will redirect)
                window.open(downloadUrl, "_blank");
            }
        } catch (error) {
            console.error("Error downloading model:", error);
        } finally {
            setIsDownloading(false);
        }
    };

    const handleSubmitComment = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!auth.token || !commentText.trim() || isSubmittingComment || !model) return;

        setIsSubmittingComment(true);

        try {
            const response = await makeAuthenticatedRequest(`${API_HOST}/comments/`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ aimodel: model.id, text: commentText.trim() }),
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
                <div className="text-white text-xl">Loading...</div>
            </main>
        );
    }

    if (error || !model) {
        return (
            <main className="flex w-screen items-center justify-center min-h-screen bg-neutral-900">
                <div className="text-red-400 text-xl">
                    {error || "Model not found"}
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
                    {/* Left side - Featured Image */}
                    <div className="flex flex-col">
                        <div className="relative w-full aspect-square bg-neutral-800 rounded-lg overflow-hidden">
                            <Image
                                src={model.featured_image_url || "/image404.png"}
                                alt={model.name || "Model"}
                                fill
                                className="object-cover"
                                priority
                            />
                        </div>
                    </div>

                    {/* Right side - Info */}
                    <div className="flex flex-col gap-6">
                        {/* Model name and type */}
                        <div>
                            <h1 className="text-3xl font-bold text-white mb-2">
                                {model.name || "Unnamed Model"}
                            </h1>
                            <div className="flex items-center gap-4">
                                <span className="px-3 py-1 bg-blue-600 text-white rounded-full text-sm">
                                    {model.model_type || "Unknown Type"}
                                </span>
                                {model.is_published ? (
                                    <span className="px-3 py-1 bg-green-600 text-white rounded-full text-sm">
                                        Published
                                    </span>
                                ) : (
                                    <span className="px-3 py-1 bg-yellow-600 text-white rounded-full text-sm">
                                        Draft
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Author info */}
                        <div className="flex items-center gap-4">
                            <Link href={`/user/${model.author.id}`} className="flex items-center gap-3">
                                <Image
                                    src={model.author.profile?.avatar || "/img/nacho.png"}
                                    alt={model.author.username}
                                    width={48}
                                    height={48}
                                    className="rounded-full"
                                />
                                <div>
                                    <h2 className="text-xl font-semibold text-white">
                                        {model.author.username}
                                    </h2>
                                    <p className="text-sm text-neutral-400">
                                        {model.author.followers_count} подписчиков
                                    </p>
                                </div>
                            </Link>
                        </div>

                        {/* Description */}
                        {model.description && (
                            <div className="bg-neutral-800 rounded-lg p-6">
                                <h3 className="text-xl font-semibold mb-3 text-white">Description</h3>
                                <p className="text-neutral-300 whitespace-pre-wrap break-words">
                                    {model.description}
                                </p>
                            </div>
                        )}

                        {/* Stats and actions */}
                        <div className="flex flex-wrap items-center gap-4">
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
                            
                            <div className="flex items-center gap-2 text-neutral-400">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                </svg>
                                <span>{model.downloads_count} downloads</span>
                            </div>
                            
                            <span className="text-neutral-400 text-sm">
                                {formatDate(model.created_at)}
                            </span>
                        </div>

                        {/* Download button */}
                        <button
                            onClick={handleDownload}
                            disabled={isDownloading}
                            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2"
                        >
                            {isDownloading ? (
                                <>
                                    <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Downloading...
                                </>
                            ) : (
                                <>
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                    </svg>
                                    Download Model
                                </>
                            )}
                        </button>

                        {/* Model details */}
                        <div className="bg-neutral-800 rounded-lg p-6">
                            <h3 className="text-xl font-semibold mb-4 text-white">Model Details</h3>
                            <div className="space-y-3 text-sm">
                                {model.file && (
                                    <div>
                                        <span className="text-neutral-400">File:</span>
                                        <span className="ml-2 text-white font-mono break-all">{model.file}</span>
                                    </div>
                                )}
                                {model.file_hash && (
                                    <div>
                                        <span className="text-neutral-400">File Hash:</span>
                                        <span className="ml-2 text-white font-mono break-all text-xs">{model.file_hash}</span>
                                    </div>
                                )}
                            </div>
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

