"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useAuth } from "@/app/provider/authProvider";
import { Notification, NotificationList } from "@/app/components/interfaces/BackdendRes";

const API_HOST = process.env.NEXT_PUBLIC_BACKEND_API || "http://localhost:8000/api";

export const NotificationBell = () => {
    const auth = useAuth();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const makeAuthenticatedRequest = auth.makeAuthenticatedRequest as (url: string, options?: RequestInit) => Promise<Response>;

    const fetchNotifications = async () => {
        if (!auth.token) return;
        try {
            const res = await makeAuthenticatedRequest(`${API_HOST}/notifications/`);
            if (res.ok) {
                const data: NotificationList = await res.json();
                setNotifications(data.results);
                setUnreadCount(data.results.filter(n => !n.is_read).length);
            }
        } catch (e) { console.error(e); }
    };

    useEffect(() => {
        fetchNotifications();
        const interval = setInterval(fetchNotifications, 60000);
        return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [auth.token]);

    const markAsRead = async (e: React.MouseEvent, id: number) => {
        // ОСТАНАВЛИВАЕМ всплытие события, чтобы окно не дергалось
        e.preventDefault();
        e.stopPropagation();

        try {
            const res = await makeAuthenticatedRequest(`${API_HOST}/notifications/${id}/`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ is_read: true }),
            });
            if (res.ok) {
                setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
                setUnreadCount(prev => Math.max(0, prev - 1));
            }
        } catch (e) { console.error(e); }
    };

    const getNotificationLink = (n: Notification) => {
        if (n.image) return `/image/${n.image}`;
        if (n.aimodel) return `/model/${n.aimodel}`;
        return `/user/${n.actor.username}`;
    };

    const getNotificationText = (n: Notification) => {
        switch (n.type) {
            case 'LIKE': return `liked your post`;
            case 'COMMENT': return `commented on your post`;
            case 'FOLLOW': return `started following you`;
            case 'NEW_POST': return `published a new post`;
            default: return `interacted with you`;
        }
    };

    if (!auth.token) return null;

    return (
        /* Используем details вместо div, чтобы контролировать закрытие */
        <details className="dropdown dropdown-end">
            <summary className="cursor-pointer bg-transparent list-none">
                <div className="indicator">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                    {unreadCount > 0 && (
                        <span className="badge badge-xs badge-accent indicator-item font-bold border-none">{unreadCount}</span>
                    )}
                </div>
            </summary>
            
            {/* flex-col гарантирует вертикальный список */}
            <ul className="dropdown-content z-[100] mt-3 p-2 shadow-2xl bg-neutral-800 border border-neutral-700 rounded-xl w-80 sm:w-96 flex flex-col gap-1 max-h-[500px] overflow-y-auto overflow-x-hidden">
                <li className="p-3 border-b border-neutral-700 flex justify-between items-center sticky top-0 bg-neutral-800 z-10">
                    <span className="font-bold text-white">Notifications</span>
                    {unreadCount > 0 && (
                        <span className="text-[10px] bg-accent/20 text-accent px-2 py-0.5 rounded-full font-black">
                            {unreadCount} NEW
                        </span>
                    )}
                </li>
                
                <div className="flex flex-col w-full">
                    {notifications.length === 0 ? (
                        <div className="p-10 text-center text-sm text-neutral-500 italic">No notifications yet</div>
                    ) : (
                        notifications.map((n) => (
                            <li key={n.id} className={`flex flex-col w-full border-b border-neutral-700/30 last:border-0 ${!n.is_read ? 'bg-accent/5' : ''}`}>
                                <div className="p-4 flex items-start gap-3 w-full relative">
                                    {/* Аватар */}
                                    <Link href={`/user/${n.actor.username}`} className="flex-shrink-0">
                                        <Image 
                                            src={n.actor.profile?.avatar || "/img/nacho.png"} 
                                            alt="" width={40} height={40} 
                                            className="rounded-full border border-neutral-600"
                                        />
                                    </Link>

                                    {/* Текст уведомления */}
                                    <div className="flex-1 flex flex-col gap-0.5 min-w-0">
                                        <div className="text-sm leading-tight text-neutral-200">
                                            <Link href={`/user/${n.actor.username}`} className="font-bold text-white hover:text-accent mr-1">
                                                {n.actor.username}
                                            </Link>
                                            <Link href={getNotificationLink(n)} className="hover:text-neutral-400">
                                                {getNotificationText(n)}
                                            </Link>
                                        </div>
                                        <span className="text-[10px] text-neutral-500 uppercase font-mono mt-1">
                                            {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {new Date(n.created_at).toLocaleDateString()}
                                        </span>
                                    </div>

                                    {/* Кнопка прочитано */}
                                    {!n.is_read && (
                                        <button 
                                            onClick={(e) => markAsRead(e, n.id)}
                                            className="flex-shrink-0 w-6 h-6 rounded-full bg-neutral-700 hover:bg-accent hover:text-black flex items-center justify-center transition-all shadow-lg"
                                            title="Mark as read"
                                        >
                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
                                        </button>
                                    )}
                                </div>
                            </li>
                        ))
                    )}
                </div>
            </ul>
        </details>
    );
};