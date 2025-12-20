"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { GalleryImage, ModelList } from "./interfaces/BackdendRes";

const API_HOST = process.env.NEXT_PUBLIC_BACKEND_API || "http://localhost:8000/api";

export const NavbarSearch = () => {
    const [query, setQuery] = useState("");
    const [isOpen, setIsOpen] = useState(false);
    const [results, setResults] = useState<{ images: GalleryImage[], models: ModelList[] }>({
        images: [],
        models: []
    });
    const [isLoading, setIsLoading] = useState(false);
    const searchRef = useRef<HTMLDivElement>(null);

    // Закрытие при клике вне области поиска
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Поиск при изменении запроса (с задержкой/debounce)
    useEffect(() => {
        if (query.length < 2) {
            setResults({ images: [], models: [] });
            setIsOpen(false);
            return;
        }

        const timer = setTimeout(async () => {
            setIsLoading(true);
            try {
                // Выполняем два запроса параллельно
                const [imgRes, modelRes] = await Promise.all([
                    fetch(`${API_HOST}/images/?search=${query}`),
                    fetch(`${API_HOST}/models/?search=${query}`)
                ]);

                const imgData = await imgRes.json();
                const modelData = await modelRes.json();

                setResults({
                    images: imgData.results.slice(0, 4), // Берем первые 4
                    models: modelData.results.slice(0, 4)
                });
                setIsOpen(true);
            } catch (e) {
                console.error("Search error:", e);
            } finally {
                setIsLoading(false);
            }
        }, 400); // Ждем 400мс после последнего нажатия клавиши

        return () => clearTimeout(timer);
    }, [query]);

    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (query.trim()) {
            setIsOpen(false);
            // Если нужно переходить на отдельную страницу поиска:
            // router.push(`/search?q=${encodeURIComponent(query)}`);
        }
    };

    return (
        <div className="relative w-full max-w-md" ref={searchRef}>
            <form onSubmit={handleSearchSubmit} className="relative">
                <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onFocus={() => query.length >= 2 && setIsOpen(true)}
                    placeholder="Search images or models..."
                    className="w-full bg-neutral-800 border border-neutral-700 text-white text-sm rounded-full py-2 px-10 focus:outline-none focus:border-accent transition-all"
                />
                <div className="absolute left-3 top-2.5 text-neutral-500">
                    {isLoading ? (
                        <span className="loading loading-spinner loading-xs"></span>
                    ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    )}
                </div>
            </form>

            {/* Выпадающий список результатов */}
            {isOpen && (results.images.length > 0 || results.models.length > 0) && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-neutral-800 border border-neutral-700 rounded-xl shadow-2xl overflow-hidden z-[1000]">
                    
                    {/* Секция Моделей */}
                    {results.models.length > 0 && (
                        <div className="p-2 border-b border-neutral-700">
                            <span className="text-[10px] uppercase font-bold text-neutral-500 px-2">Models</span>
                            {results.models.map(model => (
                                <Link 
                                    key={`m-${model.id}`} 
                                    href={`/model/${model.id}`}
                                    onClick={() => {setIsOpen(false); setQuery("")}}
                                    className="flex items-center gap-3 p-2 hover:bg-neutral-700 rounded-lg transition-colors group"
                                >
                                    <div className="relative w-10 h-10 flex-shrink-0 bg-neutral-900 rounded overflow-hidden">
                                        <Image src={model.featured_image_url || "/image404.png"} alt="" fill className="object-cover" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-sm font-bold text-white truncate group-hover:text-accent">{model.name}</div>
                                        <div className="text-[10px] text-neutral-500 uppercase">{model.model_type} • {model.author.username}</div>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}

                    {/* Секция Изображений */}
                    {results.images.length > 0 && (
                        <div className="p-2">
                            <span className="text-[10px] uppercase font-bold text-neutral-500 px-2">Images</span>
                            <div className="grid grid-cols-2 gap-2 p-2">
                                {results.images.map(img => (
                                    <Link 
                                        key={`i-${img.id}`} 
                                        href={`/image/${img.id}`}
                                        onClick={() => {setIsOpen(false); setQuery("")}}
                                        className="relative aspect-square rounded overflow-hidden hover:ring-2 ring-accent transition-all"
                                    >
                                        <Image src={img.image} alt="" fill className="object-cover" />
                                        <div className="absolute bottom-0 left-0 right-0 bg-black/60 p-1 text-[9px] text-white truncate">
                                            @{img.author.username}
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        </div>
                    )}

                    {/*<div className="bg-neutral-900/50 p-2 text-center border-t border-neutral-700">
                        <button className="text-[10px] text-neutral-500 hover:text-white transition-colors uppercase font-bold">
                            Press Enter for full results
                        </button>
                    </div>*/}
                </div>
            )}

            {/* Ничего не найдено */}
            {isOpen && query.length >= 2 && results.images.length === 0 && results.models.length === 0 && !isLoading && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-neutral-800 border border-neutral-700 rounded-xl p-4 text-center text-sm text-neutral-500 z-[1000]">
                    No results for &quot;{query}&quot;
                </div>
            )}
        </div>
    );
};