"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../provider/authProvider";

const API_HOST = process.env.NEXT_PUBLIC_BACKEND_API || "http://localhost:8000/api";

export default function AuthPage() {
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
          return userData.id;
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
            return userImage.author.id;
          }
        }
      }
    } catch (error) {
      console.error("Error fetching user ID:", error);
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      if (isLogin) {
        await (login as (username: string, password: string) => Promise<any>)(username, password);
      } else {
        await (register as (username: string, email: string, password: string) => Promise<any>)(username, email, password);
      }
      
      // Fetch user ID and redirect to user profile page
      const userId = await fetchUserId();
      if (userId) {
        router.push(`/user/${userId}`);
      } else {
        // Fallback to home page if we can't get user ID
        router.push("/");
      }
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-neutral-900 p-4">
      <div className="w-full max-w-md bg-neutral-800 rounded-lg shadow-lg p-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-white mb-2">
            {isLogin ? "Login" : "Register"}
          </h1>
          <p className="text-neutral-400">
            {isLogin
              ? "Welcome back! Please login to your account."
              : "Create a new account to get started."}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-neutral-300 mb-1">
              Username
            </label>
            <input
              type="text"
              id="username"
              name="username"
              required
              className="w-full px-4 py-2 bg-neutral-700 border border-neutral-600 rounded-lg text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter your username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>

          {!isLogin && (
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-neutral-300 mb-1">
                Email
              </label>
              <input
                type="email"
                id="email"
                name="email"
                required
                className="w-full px-4 py-2 bg-neutral-700 border border-neutral-600 rounded-lg text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          )}

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-neutral-300 mb-1">
              Password
            </label>
            <input
              type="password"
              id="password"
              name="password"
              required
              className="w-full px-4 py-2 bg-neutral-700 border border-neutral-600 rounded-lg text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error && (
            <div className="p-3 bg-red-900/30 border border-red-700 rounded-lg text-red-300 text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
          >
            {isLoading ? <span className="loading loading-ring loading-xl"></span> : isLogin ? "Login" : "Register"}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => {
              setIsLogin(!isLogin);
              setError("");
              setEmail("");
            }}
            className="text-blue-400 hover:text-blue-300 text-sm"
          >
            {isLogin
              ? "Don't have an account? Register"
              : "Already have an account? Login"}
          </button>
        </div>
      </div>
    </div>
  );
}

