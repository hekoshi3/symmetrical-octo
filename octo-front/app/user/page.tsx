"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../provider/authProvider";

const API_HOST = process.env.NEXT_PUBLIC_BACKEND_API || "http://localhost:8000/api";

export default function PushToUser() {
    const [isLogin, setIsLogin] = useState(true);
    const [username, setUsername] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const { login, register, makeAuthenticatedRequest } = useAuth();
    const router = useRouter();

    const fetchUserId = async (): Promise<number | null> => {
        try {
            const makeRequest = makeAuthenticatedRequest as (url: string, options?: RequestInit) => Promise<Response>;

            // First try to get ID from /users/me/
            const meResponse = await makeRequest(`${API_HOST}/users/me/`);
            if (meResponse.ok) {
                const userData = await meResponse.json();
                // Check if ID is directly in the response
                if (userData.id) {
                    router.push(`/user/${userData.id}`);
                }

                // If no ID, try to get it from user's images
                const imagesResponse = await makeRequest(`${API_HOST}/images/`);
                if (imagesResponse.ok) {
                    const imagesData = await imagesResponse.json();
                    // Find an image by the current user
                    const userImage = imagesData.results?.find(
                        (img: any) => img.author?.username === userData.username
                    );
                    if (userImage?.author?.id) {
                        router.push(`/user/${userImage.author.id}`);
                    }
                }
            }
        } catch (error) {
            console.error("Error fetching user ID:", error);
        }
        return null;
    };

    fetchUserId()
    return (
        <>
        </>
    );
}