/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState } from "react";
import { notFound, useParams } from "next/navigation";
import { GalleryImage, ModelList, BackdendResIMG, BackdendResMODEL, UserProfileData, Analytics } from "../../components/interfaces/BackdendRes";
import { ImgCard } from "../../components/imageCard";
import { ModelCard } from "../../components/modelCard";
import Image from "next/image";
import Link from "next/link";
import { useAuth } from "../../provider/authProvider";


const API_HOST = process.env.NEXT_PUBLIC_BACKEND_API || "http://localhost:8000/api";

export default function UserPage() {
    const params = useParams();
    const userId = params?.id as string;
    const auth = useAuth();
    const makeAuthenticatedRequest = auth.makeAuthenticatedRequest as (url: string, options?: RequestInit) => Promise<Response>;

    const [userProfile, setUserProfile] = useState<UserProfileData | null>(null);
    const [currentUserProfile, setCurUserProfile] = useState<UserProfileData | null>(null);
    const [analytics, setAnalytics] = useState<Analytics | null>(null); // Состояние для аналитики
    const [gallery, setGallery] = useState<GalleryImage[]>([]);
    const [models, setModels] = useState<ModelList[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isFollowing, setIsFollowing] = useState<boolean>(false);
    const [isUpdatingFollow, setIsUpdatingFollow] = useState(false);
    const [activeTab, setActiveTab] = useState<"images" | "models" | "analytics">("images"); // Добавлена вкладка
    const [isOwnProfile, setIsOwnProfile] = useState<boolean>(false);
    const [, setCurrentUsername] = useState<string | null>(null);

    useEffect(() => {
        if (!userId || auth.isLoading) return;

        const fetchUserData = async () => {
            try {
                setIsLoading(true);
                setError(null);

                const userRes = auth.token
                    ? await makeAuthenticatedRequest(`${API_HOST}/users/${userId}/`)
                    : await fetch(`${API_HOST}/users/${userId}/`);

                if (!userRes.ok) notFound();

                const userData: UserProfileData = await userRes.json();
                setUserProfile(userData);
                setIsFollowing(userData.is_following || false);

                // Параллельно загружаем аналитику, если доступно
                const analyticsRes = auth.token
                    ? await makeAuthenticatedRequest(`${API_HOST}/users/analytics/`)
                    : await fetch(`${API_HOST}/users/analytics/`);
                
                if (analyticsRes.ok) {
                    const analyticsData: Analytics = await analyticsRes.json();
                    setAnalytics(analyticsData);
                }

                if (auth.token) {
                    try {
                        const meRes = await makeAuthenticatedRequest(`${API_HOST}/users/me/`);
                        if (meRes.ok) {
                            const meData = await meRes.json();
                            setCurUserProfile(meData)
                            setCurrentUsername(meData.username);
                            setIsOwnProfile(meData.username === userData.username);
                        }
                    } catch { }
                }

                const imagesRes = auth.token
                    ? await makeAuthenticatedRequest(`${API_HOST}/images/`)
                    : await fetch(`${API_HOST}/images/`);

                if (imagesRes.ok) {
                    const imagesData: BackdendResIMG = await imagesRes.json();
                    const userImages = imagesData.results.filter((img) => img.author.id === userData.id);
                    setGallery(userImages.reverse());
                }

                const modelsRes = auth.token
                    ? await makeAuthenticatedRequest(`${API_HOST}/models/`)
                    : await fetch(`${API_HOST}/models/`);

                if (modelsRes.ok) {
                    const modelsData: BackdendResMODEL = await modelsRes.json();
                    const userModels = modelsData.results.filter((model) => model.author.username === userData.username);
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
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ following: userProfile.id }),
            });
            if (response.ok) {
                setIsFollowing(!isFollowing);
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

    // Вспомогательный компонент для графика (простой SVG)
    const ActivityGraph = ({ data }: { data: Analytics['activity_graph'] }) => {
        if (!data) return <p className="text-neutral-500">Нет данных для графика</p>;
        const maxCount = Math.max(...data.map(d => d.count), 1);
        const height = 100;
        const width = 400;
        const step = width / (data.length - 1 || 1);
        
        const points = data.map((d, i) => `${i * step},${height - (d.count / maxCount) * height}`).join(' ');

        return (
            <div className="w-full bg-neutral-800/50 p-4 rounded-xl border border-neutral-700">
                <h3 className="text-sm font-semibold mb-4 text-neutral-300 uppercase tracking-wider">Активность за последнее время</h3>
                <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-32 overflow-visible">
                    <polyline
                        fill="none"
                        stroke="#3b82f6"
                        strokeWidth="2"
                        strokeLinejoin="round"
                        points={points}
                    />
                    {data.map((d, i) => (
                        <circle key={i} cx={i * step} cy={height - (d.count / maxCount) * height} r="3" fill="#3b82f6" className="hover:r-4 transition-all cursor-pointer" />
                    ))}
                </svg>
                <div className="flex justify-between mt-2 text-[10px] text-neutral-500">
                    <span>{data[0].date}</span>
                    <span>{data[data.length-1].date}</span>
                </div>
            </div>
        );
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
                <div className="text-red-100 text-xl">{"User not found"}</div>
                <Link href="/" className="ml-4 text-blue-400 hover:underline">Go back</Link>
            </main>
        );
    }

    return (
        <main className="flex w-screen min-h-screen bg-neutral-900 text-neutral-200">
            <div className="flex w-full flex-col">
                <div className="h-64 border-b border-neutral-950 bg-[url(/img/nachosmile.jpg)] inset-0 bg-no-repeat bg-cover bg-center relative">
                    <div className="absolute inset-0 bg-linear-to-b from-transparent to-neutral-900"></div>
                    <div className="relative z-10 flex items-end justify-between p-4 h-full">
                        {auth.token && isOwnProfile && (
                            <Link href={`/user/${userId}/edit`} className="btn bg-neutral-950 rounded-xl font-light opacity-80 hover:opacity-100 transition-opacity">
                                Редактировать
                            </Link>
                        )}
                    </div>
                </div>

                <div className="flex flex-col lg:flex-row">
                    <div className="flex-1 overflow-y-auto pt-4 pl-4 pr-4 lg:pr-8">
                        {/* Tabs */}
                        <div className="flex gap-4 mb-6 border-b border-neutral-800">
                            {["images", "models", "analytics"].map((tab) => (
                                <button
                                    key={tab}
                                    onClick={() => setActiveTab(tab as any)}
                                    className={`pb-2 px-4 font-semibold transition-colors capitalize ${
                                        activeTab === tab ? "text-white border-b-2 border-blue-500" : "text-neutral-400 hover:text-white"
                                    }`}
                                >
                                    {tab} {tab === "images" && `(${gallery.length})`} {tab === "models" && `(${models.length})`}
                                </button>
                            ))}
                        </div>

                        {activeTab === "images" && (
                            gallery.length > 0 ? (
                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                                    {gallery.map((img, index) => <ImgCard key={img.id ?? index} img={img} index={index} />)}
                                </div>
                            ) : <div className="flex items-center justify-center h-64 text-neutral-400">No images yet</div>
                        )}

                        {activeTab === "models" && (
                            models.length > 0 ? (
                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                                    {models.map((model, index) => <ModelCard key={model.id ?? index} model={model} index={index} />)}
                                </div>
                            ) : <div className="flex items-center justify-center h-64 text-neutral-400">No models yet</div>
                        )}

                        {activeTab === "analytics" && (
                            <div className="space-y-8 pb-10">
                                {analytics ? (
                                    <>
                                        <ActivityGraph data={analytics.activity_graph} />
                                        
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            {/* Top Models */}
                                            <div className="bg-neutral-800/30 p-4 rounded-xl border border-neutral-800">
                                                <h3 className="text-white font-bold mb-4 flex items-center gap-2">
                                                    🔥 Популярные модели
                                                </h3>
                                                <div className="space-y-3">
                                                    {analytics.top_models.map(m => (
                                                        <div key={m.id} className="flex justify-between items-center bg-neutral-900/50 p-3 rounded-lg">
                                                            <Link href={"/model/"+m.id} className="text-sm truncate max-w-[150px]">{m.name}</Link>
                                                            <div className="flex gap-3 text-xs">
                                                                <span className="text-blue-400">⬇ {m.downloads_count}</span>
                                                                <span className="text-pink-400">❤ {m.likes_count}</span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Top Images */}
                                            <div className="bg-neutral-800/30 p-4 rounded-xl border border-neutral-800">
                                                <h3 className="text-white font-bold mb-4 flex items-center gap-2">
                                                    🖼 Топ изображений
                                                </h3>
                                                <div className="space-y-3">
                                                    {analytics.top_images.map(img => (
                                                        <div key={img.id} className="flex justify-between items-center bg-neutral-900/50 p-3 rounded-lg">
                                                            <Link href={"/image/"+img.id} className="text-sm text-neutral-500">ID: {img.id}</Link>
                                                            <span className="text-pink-400 text-xs font-bold">❤ {img.likes_count} лайков</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-neutral-800 rounded-3xl text-neutral-500">
                                        <p>Аналитика для этого пользователя пока недоступна</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="w-full lg:w-96 bg-neutral-900 border-l border-neutral-800">
                        <div className="w-full flex flex-col items-center justify-center pt-10 px-4">
                            <div className="relative">
                                <Image src={userProfile.avatar || "/img/nacho.png"} width={128} height={128} alt={userProfile.username} className="rounded-full h-32 w-32 object-cover border-4 border-neutral-800" />
                            </div>
                            <p className="text-2xl font-mono mt-4 text-white">{userProfile.username}</p>
                            {userProfile.bio && <p className="text-sm text-neutral-300 mt-2 text-center max-w-xs">{userProfile.bio}</p>}
                            <p className="text-sm font-extralight text-neutral-400 mt-2">{userProfile.followers_count} подписчиков</p>

                            {auth.token && !isOwnProfile && (
                                <button
                                    onClick={handleFollow}
                                    disabled={isUpdatingFollow}
                                    className={`mt-4 px-6 py-2 rounded-lg font-semibold transition-colors disabled:opacity-50 ${isFollowing ? "bg-neutral-700 hover:bg-neutral-600 text-white" : "bg-blue-600 hover:bg-blue-700 text-white"}`}
                                >
                                    {isUpdatingFollow ? "..." : isFollowing ? "Unfollow" : "Follow"}
                                </button>
                            )}

                            {/* Statistics из UserProfileData */}
                            {currentUserProfile && (
                                <div className="grid grid-cols-2 gap-4 mt-8 w-full">
                                    <div className="bg-neutral-800/40 p-3 rounded-xl text-center">
                                        <p className="text-xl font-bold text-white">{currentUserProfile.stats.total_likes}</p>
                                        <p className="text-[10px] uppercase text-neutral-500">Лайков</p>
                                    </div>
                                    <div className="bg-neutral-800/40 p-3 rounded-xl text-center">
                                        <p className="text-xl font-bold text-white">{currentUserProfile.stats.total_downloads}</p>
                                        <p className="text-[10px] uppercase text-neutral-500">Загрузок</p>
                                    </div>
                                    <div className="bg-neutral-800/40 p-3 rounded-xl text-center">
                                        <p className="text-xl font-bold text-white">{currentUserProfile.stats.images_count}</p>
                                        <p className="text-[10px] uppercase text-neutral-500">Изображений</p>
                                    </div>
                                    <div className="bg-neutral-800/40 p-3 rounded-xl text-center">
                                        <p className="text-xl font-bold text-white">{currentUserProfile.stats.models_count}</p>
                                        <p className="text-[10px] uppercase text-neutral-500">Моделей</p>
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