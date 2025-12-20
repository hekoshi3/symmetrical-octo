"use client";

import React, { createContext, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { UserProfileData } from "@/app/components/interfaces/BackdendRes";

const API_HOST = process.env.NEXT_PUBLIC_BACKEND_API || "http://localhost:8000/api";

// 1. Описываем форму контекста
interface AuthContextType {
  user: UserProfileData | null;
  token: string | null;
  refreshToken: string | null;
  role: string | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<{ success: boolean }>;
  register: (username: string, email: string, password: string) => Promise<{ success: boolean }>;
  logout: () => void;
  refreshAccessToken: () => Promise<string>;
  makeAuthenticatedRequest: (url: string, options?: RequestInit) => Promise<Response>;
}

// 2. Создаем контекст с начальным значением
const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<UserProfileData | null>(null);
  const [token, setToken_] = useState<string | null>(null);
  const [refreshToken, setRefreshToken_] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Функция для загрузки профиля пользователя
  const fetchMe = async (currentToken: string) => {
    try {
      const res = await fetch(`${API_HOST}/users/me/`, {
        headers: { Authorization: `Bearer ${currentToken}` },
      });
      if (res.ok) {
        const data: UserProfileData = await res.json();
        setUser(data);
      }
    } catch (e) {
      console.error("Failed to fetch user profile", e);
    }
  };

  // Загрузка токенов при монтировании
  useEffect(() => {
    const storedToken = sessionStorage.getItem("access_token");
    const storedRefreshToken = sessionStorage.getItem("refresh_token");
    const storedRole = sessionStorage.getItem("role");

    if (storedToken) {
      setToken_(storedToken);
      setRefreshToken_(storedRefreshToken);
      setRole(storedRole);
      fetchMe(storedToken); // Загружаем данные пользователя, если есть токен
    }

    setIsLoading(false);
  }, []);

  // Вход
  const login = async (username: string, password: string) => {
    try {
      const response = await fetch(`${API_HOST}/token/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Login failed");
      }

      const data = await response.json();
      const { access, refresh } = data;

      sessionStorage.setItem("access_token", access);
      sessionStorage.setItem("refresh_token", refresh);
      setToken_(access);
      setRefreshToken_(refresh);
      
      await fetchMe(access); // Получаем профиль после входа
      
      return { success: true };
    } catch (error) {
      console.error("Login error:", error);
      throw error;
    }
  };

  // Регистрация
  const register = async (username: string, email: string, password: string) => {
    try {
      const response = await fetch(`${API_HOST}/register/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, password }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(
          error.username?.[0] || error.email?.[0] || error.password?.[0] || "Registration failed"
        );
      }

      return await login(username, password);
    } catch (error) {
      console.error("Registration error:", error);
      throw error;
    }
  };

  // Обновление токена
  const refreshAccessToken = async (): Promise<string> => {
    const storedRefreshToken = sessionStorage.getItem("refresh_token");
    if (!storedRefreshToken) {
      logout();
      throw new Error("No refresh token available");
    }

    try {
      const response = await fetch(`${API_HOST}/token/refresh/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh: storedRefreshToken }),
      });

      if (!response.ok) {
        logout();
        throw new Error("Refresh token expired");
      }

      const data = await response.json();
      const { access } = data;

      sessionStorage.setItem("access_token", access);
      setToken_(access);
      return access;
    } catch (error) {
      logout();
      throw error;
    }
  };

  // Выход
  const logout = () => {
    sessionStorage.removeItem("access_token");
    sessionStorage.removeItem("refresh_token");
    sessionStorage.removeItem("role");
    setToken_(null);
    setRefreshToken_(null);
    setRole(null);
    setUser(null);
  };

  // Запросы с авторизацией (обработка FormData и JSON)
  const makeAuthenticatedRequest = async (url: string, options: RequestInit = {}): Promise<Response> => {
    const accessToken = token || sessionStorage.getItem("access_token");

    const makeRequest = async (tokenToUse: string | null) => {
      // Клонируем заголовки, чтобы не мутировать исходные
      const headers = new Headers(options.headers);

      if (tokenToUse) {
        headers.set("Authorization", `Bearer ${tokenToUse}`);
      }

      // Если это НЕ FormData и Content-Type не задан, ставим JSON
      if (!(options.body instanceof FormData)) {
        if (!headers.has("Content-Type")) {
          headers.set("Content-Type", "application/json");
        }
      } else {
        // Если это FormData, браузер САМ должен выставить Content-Type с boundary
        headers.delete("Content-Type");
      }

      return fetch(url, {
        ...options,
        headers: headers,
      });
    };

    let response = await makeRequest(accessToken);

    if (response.status === 401) {
      try {
        const newAccessToken = await refreshAccessToken();
        response = await makeRequest(newAccessToken);
      } catch (error) {
        throw error;
      }
    }

    return response;
  };

  const contextValue = useMemo(
    () => ({
      user,
      token,
      refreshToken,
      role,
      isLoading,
      login,
      register,
      logout,
      refreshAccessToken,
      makeAuthenticatedRequest,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user, token, refreshToken, role, isLoading]
  );

  return (
    <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
  );
};

// Хук для использования контекста
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export default AuthProvider;