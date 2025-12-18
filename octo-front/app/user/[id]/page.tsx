"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { GalleryImage, ModelList, BackdendResIMG, BackdendResMODEL, Author } from "../../components/interfaces/BackdendRes";
import { ImgCard } from "../../components/imageCard";
import { ModelCard } from "../../components/modelCard";
import Image from "next/image";
import Link from "next/link";
import { useAuth } from "../../provider/authProvider";

const API_HOST = process.env.NEXT_PUBLIC_BACKEND_API || "http://localhost:8000/api";

interface UserProfileData {
    id: number;
    username: string;
    profile: {
        username: string;
        bio: string;
        avatar: string | null;
    };
    followers_count: number;
    is_following: boolean;
    stats?: {
        total_downloads: number;
        total_likes: number;
        followers: number;
        models_count: number;
        images_count: number;
    };
}

export default function UserPage() {
    const params = useParams();
    const router = useRouter();
    const userId = params?.id as string;
    const auth = useAuth();
    const makeAuthenticatedRequest = auth.makeAuthenticatedRequest as (url: string, options?: RequestInit) => Promise<Response>;
    
    const [userProfile, setUserProfile] = useState<UserProfileData | null>(null);
    const [gallery, setGallery] = useState<GalleryImage[]>([]);
    const [models, setModels] = useState<ModelList[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isFollowing, setIsFollowing] = useState<boolean>(false);
    const [isUpdatingFollow, setIsUpdatingFollow] = useState(false);
    const [activeTab, setActiveTab] = useState<"images" | "models">("images");
    const [isOwnProfile, setIsOwnProfile] = useState<boolean>(false);
    const [currentUsername, setCurrentUsername] = useState<string | null>(null);

    useEffect(() => {
        if (!userId || auth.isLoading) return;

        const fetchUserData = async () => {
            try {
                setIsLoading(true);
                setError(null);

                // Fetch user profile by ID
                const userRes = auth.token
                    ? await makeAuthenticatedRequest(`${API_HOST}/users/${userId}/`)
                    : await fetch(`${API_HOST}/users/${userId}/`);
                
                if (!userRes.ok) {
                    throw new Error("Failed to fetch user profile");
                }
                
                const userData: UserProfileData = await userRes.json();
                setUserProfile(userData);
                setIsFollowing(userData.is_following || false);

                // Check if this is the logged-in user's own profile
                if (auth.token) {
                    try {
                        const meRes = await makeAuthenticatedRequest(`${API_HOST}/users/me/`);
                        if (meRes.ok) {
                            const meData = await meRes.json();
                            setCurrentUsername(meData.username);
                            setIsOwnProfile(meData.username === userData.username);
                        }
                    } catch {}
                }

                // Fetch user's images - filter by author
                const imagesRes = auth.token
                    ? await makeAuthenticatedRequest(`${API_HOST}/images/`)
                    : await fetch(`${API_HOST}/images/`);
                
                if (imagesRes.ok) {
                    const imagesData: BackdendResIMG = await imagesRes.json();
                    const userImages = imagesData.results.filter(
                        (img) => img.author.id === userData.id
                    );
                    setGallery(userImages.reverse());
                }

                // Fetch user's models
                const modelsRes = auth.token
                    ? await makeAuthenticatedRequest(`${API_HOST}/models/`)
                    : await fetch(`${API_HOST}/models/`);
                
                if (modelsRes.ok) {
                    const modelsData: BackdendResMODEL = await modelsRes.json();
                    const userModels = modelsData.results.filter(
                        (model) => model.author.id === userData.id
                    );
                    setModels(userModels.reverse());
                }
            } catch (err: any) {
                console.error("Error loading user data:", err);
                setError(err.message || "Failed to load user data");
            } finally {
                setIsLoading(false);
            }
        };

        fetchUserData();
    }, [userId, auth.token, auth.isLoading, makeAuthenticatedRequest]);

    const handleFollow = async () => {
        if (!auth.token || !userProfile || isUpdatingFollow) return;

        setIsUpdatingFollow(true);
        try {
            const response = await makeAuthenticatedRequest(`${API_HOST}/follows/`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ following: userProfile.id }),
            });

            if (response.ok) {
                setIsFollowing(!isFollowing);
                // Update followers count optimistically
                setUserProfile(prev => prev ? {
                    ...prev,
                    followers_count: isFollowing ? prev.followers_count - 1 : prev.followers_count + 1,
                    is_following: !isFollowing
                } : null);
            }
        } catch (error) {
            console.error("Error toggling follow:", error);
        } finally {
            setIsUpdatingFollow(false);
        }
    };


    if (isLoading) {
        return (
            <main className="flex w-screen items-center justify-center min-h-screen bg-neutral-900">
                <div className="text-white text-xl"><span className="loading loading-ring loading-xl"></span></div>
            </main>
        );
    }

    if (error || !userProfile) {
        return (
            <main className="flex w-screen items-center justify-center min-h-screen bg-neutral-900">
                <div className="text-red-400 text-xl">
                    {error || "User not found"}
                </div>
                <Link href="/" className="ml-4 text-blue-400 hover:underline">
                    Go back
                </Link>
            </main>
        );
    }

    return (
        <main className="flex w-screen min-h-screen bg-neutral-900">
            <div className="flex w-full flex-col">
                {/* Header with banner */}
                <div className="h-64 border-b border-neutral-950 bg-[url(/img/nachosmile.jpg)] inset-0 bg-no-repeat bg-cover bg-center relative">
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent to-neutral-900"></div>
                    <div className="relative z-10 flex items-end justify-between p-4 h-full">
                        {auth.token && isOwnProfile && (
                            <Link
                                href={`/user/${userId}/edit`}
                                className="btn bg-neutral-950 rounded-xl font-light opacity-80 hover:opacity-100 transition-opacity"
                            >
                                Редактировать
                            </Link>
                        )}
                        <div></div>
                    </div>
                </div>

                {/* Content */}
                <div className="flex flex-col lg:flex-row">
                    {/* Main content - Gallery/Models */}
                    <div className="flex-1 overflow-y-auto pt-4 pl-4 pr-4 lg:pr-8">
                        {/* Tabs */}
                        <div className="flex gap-4 mb-6 border-b border-neutral-800">
                            <button
                                onClick={() => setActiveTab("images")}
                                className={`pb-2 px-4 font-semibold transition-colors ${
                                    activeTab === "images"
                                        ? "text-white border-b-2 border-blue-500"
                                        : "text-neutral-400 hover:text-white"
                                }`}
                            >
                                Images ({gallery.length})
                            </button>
                            <button
                                onClick={() => setActiveTab("models")}
                                className={`pb-2 px-4 font-semibold transition-colors ${
                                    activeTab === "models"
                                        ? "text-white border-b-2 border-blue-500"
                                        : "text-neutral-400 hover:text-white"
                                }`}
                            >
                                Models ({models.length})
                            </button>
                        </div>

                        {/* Content based on active tab */}
                        {activeTab === "images" ? (
                            gallery.length > 0 ? (
                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                                    {gallery.map((img, index) => (
                                        <ImgCard key={img.id ?? index} img={img} index={index} />
                                    ))}
                                </div>
                            ) : (
                                <div className="flex items-center justify-center h-64">
                                    <p className="text-neutral-400 text-lg">No images yet</p>
                                </div>
                            )
                        ) : (
                            models.length > 0 ? (
                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                                    {models.map((model, index) => (
                                        <ModelCard key={model.id ?? index} model={model} index={index} />
                                    ))}
                                </div>
                            ) : (
                                <div className="flex items-center justify-center h-64">
                                    <p className="text-neutral-400 text-lg">No models yet</p>
                                </div>
                            )
                        )}
                    </div>

                    {/* Sidebar - User info */}
                    <div className="w-full lg:w-96 bg-neutral-900 border-l border-neutral-800">
                        <div className="w-full flex flex-col items-center justify-center pt-10 px-4">
                            <div className="relative">
                                <Image
                                    src={userProfile.profile?.avatar || "/img/nacho.png"}
                                    width={128}
                                    height={128}
                                    alt={userProfile.username}
                                    className="rounded-full"
                                />
                            </div>
                            <p className="text-2xl font-mono mt-4 text-white">{userProfile.username}</p>
                            {userProfile.profile?.bio && (
                                <p className="text-sm text-neutral-300 mt-2 text-center max-w-xs">
                                    {userProfile.profile.bio}
                                </p>
                            )}
                            <p className="text-sm font-extralight text-neutral-400 mt-2">
                                {userProfile.followers_count} подписчиков
                            </p>
                            
                            {/* Follow button (if not own profile and authenticated) */}
                            {auth.token && !isOwnProfile && (
                                <button
                                    onClick={handleFollow}
                                    disabled={isUpdatingFollow}
                                    className={`mt-4 px-6 py-2 rounded-lg font-semibold transition-colors disabled:opacity-50 ${
                                        isFollowing
                                            ? "bg-neutral-700 hover:bg-neutral-600 text-white"
                                            : "bg-blue-600 hover:bg-blue-700 text-white"
                                    }`}
                                >
                                    {isUpdatingFollow ? "..." : isFollowing ? "Unfollow" : "Follow"}
                                </button>
                            )}
                            
                            {/* Statistics */}
                            {userProfile.stats && (
                                <div className="flex gap-6 mt-6 text-center">
                                    <div>
                                        <p className="text-xl font-semibold text-white">{userProfile.stats.total_likes}</p>
                                        <p className="text-xs text-neutral-400">Лайков</p>
                                    </div>
                                    <div>
                                        <p className="text-xl font-semibold text-white">{userProfile.stats.total_downloads}</p>
                                        <p className="text-xs text-neutral-400">Скачиваний</p>
                                    </div>
                                    <div>
                                        <p className="text-xl font-semibold text-white">{userProfile.stats.images_count}</p>
                                        <p className="text-xs text-neutral-400">Изображений</p>
                                    </div>
                                    <div>
                                        <p className="text-xl font-semibold text-white">{userProfile.stats.models_count}</p>
                                        <p className="text-xs text-neutral-400">Моделей</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
}
