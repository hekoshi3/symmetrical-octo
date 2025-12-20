/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-explicit-any */
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

    // Состояние тегов (нормализованное)
    const [tags, setTags] = useState<string[]>([]);
    
    const auth = useAuth();
    const makeAuthenticatedRequest = auth.makeAuthenticatedRequest as (url: string, options?: RequestInit) => Promise<Response>;
    
    // Проверка на авторство
    const isAuthor = auth.user && model && auth.user.username === model.author.username;

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

                const modelRes = auth.token
                    ? await makeAuthenticatedRequest(`${API_HOST}/models/${modelId}/`)
                    : await fetch(`${API_HOST}/models/${modelId}/`);
                
                if (!modelRes.ok) throw new Error("Failed to fetch model");
                
                const modelData: ModelList = await modelRes.json();
                setModel(modelData);

                // Нормализация тегов django-taggit
                if (Array.isArray(modelData.tags)) {
                    setTags(modelData.tags.map((t: any) => typeof t === "string" ? t : t.name));
                }

                const commentsRes = auth.token
                    ? await makeAuthenticatedRequest(`${API_HOST}/comments/?aimodel=${modelId}`)
                    : await fetch(`${API_HOST}/comments/?aimodel=${modelId}`);
                
                if (commentsRes.ok) {
                    const commentsData: CommentList = await commentsRes.json();
                    setComments(commentsData.results || []);
                }
            } catch (err: any) {
                setError(err.message || "Failed to load model");
            } finally {
                setIsLoading(false);
            }
        };

        fetchModelData();
    }, [modelId, auth.token, auth.isLoading]);

    useEffect(() => {
        if (!model || auth.isLoading || !auth.token) return;
        setOptimisticLiked(prev => (prev !== null && model.is_liked === prev) ? null : prev);
        setOptimisticCount(prev => (prev !== null && model.likes_count === prev) ? null : prev);
    }, [model?.is_liked, model?.likes_count, auth.isLoading, auth.token, model]);

    const displayLiked = pendingLikeRef.current !== null ? pendingLikeRef.current : (optimisticLiked !== null ? optimisticLiked : (model?.is_liked ?? false));
    const displayCount = optimisticCount !== null ? optimisticCount : (model?.likes_count ?? 0);

    const handleLikeClick = async (e: React.MouseEvent) => {
        e.preventDefault(); e.stopPropagation();
        if (!auth.token || isUpdatingLike || auth.isLoading || !model) return;
        const currentCount = displayCount;
        const nextLiked = !displayLiked;
        pendingLikeRef.current = nextLiked;
        setIsUpdatingLike(true);
        setOptimisticLiked(nextLiked);
        setOptimisticCount(nextLiked ? currentCount + 1 : Math.max(currentCount - 1, 0));

        makeAuthenticatedRequest(`${API_HOST}/likes/`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ image: null, aimodel: model.id }),
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
            const downloadUrl = `${API_HOST}/models/${model.id}/download/`;
            if (auth.token) {
                const response = await makeAuthenticatedRequest(downloadUrl, { method: "GET", redirect: "follow" });
                if (response.ok || response.redirected) {
                    window.location.href = response.url || downloadUrl;
                    const modelRes = await makeAuthenticatedRequest(`${API_HOST}/models/${model.id}/`);
                    if (modelRes.ok) setModel(await modelRes.json());
                }
            } else {
                window.open(downloadUrl, "_blank");
            }
        } catch (error) {
            console.error(error);
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
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ aimodel: model.id, text: commentText.trim() }),
            });
            if (response.ok) {
                const newComment: Comment = await response.json();
                setComments(prev => [newComment, ...prev]);
                setCommentText("");
            }
        } catch (error) {
            console.error(error);
        } finally {
            setIsSubmittingComment(false);
        }
    };

    const formatDate = (dateString: string | Date) => {
        return new Date(dateString).toLocaleDateString("ru-RU", {
            year: "numeric", month: "long", day: "numeric"
        });
    };

    if (isLoading) return <main className="flex w-screen items-center justify-center min-h-screen bg-neutral-900"><div className="loading loading-ring loading-xl text-white"></div></main>;
    if (error || !model) return <main className="flex w-screen flex-col items-center justify-center min-h-screen bg-neutral-900 text-white"><p className="text-red-400 text-xl">{error || "Model not found"}</p><Link href="/" className="mt-4 text-accent hover:underline">Go back</Link></main>;

    return (
        <main className="bg-neutral-900 min-h-screen pb-20">
            <div className="container mx-auto px-4 py-8 max-w-7xl">
                <button onClick={() => router.back()} className="mb-6 text-neutral-400 hover:text-white transition-colors flex items-center gap-2">← Back</button>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                    {/* Left Column - Visuals */}
                    <div className="flex flex-col gap-6">
                        <div className="relative w-full aspect-square bg-neutral-800 rounded-2xl overflow-hidden border border-neutral-700 shadow-2xl">
                            <Image
                                src={model.featured_image_url || "/image404.png"}
                                alt={model.name}
                                fill
                                className="object-cover"
                                priority
                            />
                        </div>
                    </div>

                    {/* Right Column - Information */}
                    <div className="flex flex-col gap-8">
                        {/* Header Section */}
                        <div className="flex justify-between items-start gap-4">
                            <div className="flex-1">
                                <h1 className="text-4xl font-bold text-white mb-3 leading-tight">{model.name || "Unnamed Model"}</h1>
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="px-3 py-1 bg-accent/20 text-accent border border-accent/30 rounded-full text-xs font-bold uppercase">
                                        {model.model_type || "Unknown Type"}
                                    </span>
                                    {!model.is_published && (
                                        <span className="px-3 py-1 bg-yellow-500/20 text-yellow-500 border border-yellow-500/30 rounded-full text-xs font-bold uppercase">Draft</span>
                                    )}
                                </div>
                            </div>
                            {isAuthor && (
                                <Link 
                                    href={`/model/edit/${model.id}`}
                                    className="bg-neutral-700 hover:bg-neutral-600 text-white px-4 py-2 rounded-lg transition-colors text-sm font-semibold flex items-center gap-2"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                    Edit
                                </Link>
                            )}
                        </div>

                        {/* Author */}
                        <div className="flex items-center gap-4 bg-neutral-800/50 p-4 rounded-xl border border-neutral-700/50">
                            <Link href={`/user/${model.author.username}`} className="flex items-center gap-4 group">
                                <Image
                                    src={model.author.profile?.avatar || "/img/nacho.png"}
                                    alt={model.author.username}
                                    width={56} height={56}
                                    className="rounded-full border-2 border-neutral-600 group-hover:border-accent transition-all"
                                />
                                <div>
                                    <h2 className="text-xl font-bold text-white group-hover:text-accent transition-colors">@{model.author.username}</h2>
                                    <p className="text-sm text-neutral-400">{model.author.followers_count} followers</p>
                                </div>
                            </Link>
                        </div>

                        {/* Tags */}
                        {tags.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                                {tags.map(tag => (
                                    <span key={tag} className="bg-neutral-800 text-neutral-300 px-3 py-1 rounded-md text-sm border border-neutral-700">#{tag}</span>
                                ))}
                            </div>
                        )}

                        {/* Description */}
                        <div className="bg-neutral-800 p-6 rounded-2xl border border-neutral-700">
                            <h3 className="text-sm uppercase tracking-widest text-neutral-500 font-bold mb-4">Description</h3>
                            <p className="text-neutral-300 leading-relaxed whitespace-pre-wrap break-words">
                                {model.description || <span className="italic opacity-50">No description provided.</span>}
                            </p>
                        </div>

                        {/* Stats & Download */}
                        <div className="flex flex-col gap-4">
                            <div className="flex items-center justify-between p-4 bg-neutral-800/30 rounded-xl border border-neutral-700/30">
                                <div className="flex items-center gap-6">
                                    <button
                                        onClick={handleLikeClick}
                                        disabled={isUpdatingLike || auth.isLoading || !auth.token}
                                        className={`flex items-center gap-2 transition-all ${displayLiked ? 'text-accent scale-110' : 'text-neutral-400 hover:text-white'}`}
                                    >
                                        <Image src={displayLiked ? "/heart-full-white.svg" : "/heart-white.svg"} alt="Like" width={24} height={24} className={displayLiked ? "invert-0" : ""} />
                                        <span className="text-xl font-bold">{displayCount}</span>
                                    </button>
                                    <div className="flex items-center gap-2 text-neutral-400">
                                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                        <span className="text-xl font-bold text-neutral-200">{model.downloads_count}</span>
                                    </div>
                                </div>
                                <span className="text-neutral-500 text-xs font-mono uppercase">{formatDate(model.created_at)}</span>
                            </div>

                            <button
                                onClick={handleDownload}
                                disabled={isDownloading}
                                className="w-full bg-accent hover:bg-opacity-80 text-black font-black py-4 rounded-xl transition-all flex items-center justify-center gap-3 shadow-lg shadow-accent/10 disabled:opacity-50"
                            >
                                {isDownloading ? <span className="loading loading-spinner"></span> : <>DOWNLOAD MODEL <span className="opacity-50 text-xs">({model.file_hash?.substring(0,8) || "N/A"})</span></>}
                            </button>
                        </div>

                        {/* Comments Section */}
                        <div className="mt-8 border-t border-neutral-800 pt-10">
                            <h3 className="text-2xl font-bold text-white mb-8 flex items-center gap-3">
                                Comments <span className="text-sm bg-neutral-800 px-3 py-1 rounded-full text-neutral-500">{comments.length}</span>
                            </h3>

                            {auth.token ? (
                                <form onSubmit={handleSubmitComment} className="mb-10 group">
                                    <textarea
                                        value={commentText}
                                        onChange={(e) => setCommentText(e.target.value)}
                                        placeholder="Add a comment..."
                                        className="w-full bg-neutral-800 border border-neutral-700 text-white rounded-xl p-4 min-h-[100px] focus:border-accent outline-none transition-all"
                                        disabled={isSubmittingComment}
                                    />
                                    <div className="flex justify-end mt-2">
                                        <button
                                            type="submit"
                                            disabled={!commentText.trim() || isSubmittingComment}
                                            className="bg-neutral-200 text-black px-6 py-2 rounded-lg font-bold hover:bg-white transition-colors disabled:opacity-50"
                                        >
                                            {isSubmittingComment ? "Posting..." : "Post Comment"}
                                        </button>
                                    </div>
                                </form>
                            ) : (
                                <div className="bg-neutral-800/50 border border-neutral-700 border-dashed p-6 rounded-xl text-center mb-8">
                                    <p className="text-neutral-400 text-sm">Please <Link href="/login" className="text-accent hover:underline">login</Link> to leave a comment</p>
                                </div>
                            )}

                            <div className="space-y-6">
                                {comments.length === 0 ? (
                                    <p className="text-neutral-500 text-center py-10 italic">No comments yet. Be the first!</p>
                                ) : (
                                    comments.map((comment) => (
                                        <div key={comment.id} className="flex gap-4 group">
                                            <Image
                                                src={comment.author.profile?.avatar || "/img/nacho.png"}
                                                alt={comment.author.username}
                                                width={40} height={40}
                                                className="rounded-full flex-shrink-0 h-10 w-10 border border-neutral-700"
                                            />
                                            <div className="flex-1 bg-neutral-800/30 p-4 rounded-2xl border border-neutral-700/30">
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className="font-bold text-white text-sm">@{comment.author.username}</span>
                                                    <span className="text-[10px] text-neutral-500 uppercase">{formatDate(comment.created_at)}</span>
                                                </div>
                                                <p className="text-neutral-300 text-sm leading-relaxed break-words">{comment.text}</p>
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