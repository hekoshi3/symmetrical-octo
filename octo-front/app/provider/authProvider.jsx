"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

const API_HOST = process.env.NEXT_PUBLIC_BACKEND_API || "http://localhost:8000/api";

const AuthContext = createContext({
  token: null,
  refreshToken: null,
  role: null,
  isLoading: true,
  login: async () => ({ success: false }),
  register: async () => ({ success: false }),
  logout: () => {},
  refreshAccessToken: async () => "",
  makeAuthenticatedRequest: async (url, options) => fetch(url, options),
});

const AuthProvider = ({ children }) => {
  const [token, setToken_] = useState(null);
  const [refreshToken, setRefreshToken_] = useState(null);
  const [role, setRole] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load tokens from sessionStorage on mount
  useEffect(() => {
    const storedToken = sessionStorage.getItem("access_token");
    const storedRefreshToken = sessionStorage.getItem("refresh_token");
    const storedRole = sessionStorage.getItem("role");

    if (storedToken) {
      setToken_(storedToken);
      setRefreshToken_(storedRefreshToken);
      setRole(storedRole);
    }

    setIsLoading(false);
  }, []);

  // Login function
  const login = async (username, password) => {
    try {
      const response = await fetch(`${API_HOST}/token/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Login failed");
      }

      const data = await response.json();
      const { access, refresh } = data;

      // Store tokens
      sessionStorage.setItem("access_token", access);
      sessionStorage.setItem("refresh_token", refresh);
      setToken_(access);
      setRefreshToken_(refresh);

      // Try to get user role from token (you might need to decode JWT or fetch user info)
      // For now, we'll leave role as null unless backend provides it
      return { success: true };
    } catch (error) {
      console.error("Login error:", error);
      throw error;
    }
  };

  // Register function
  const register = async (username, email, password) => {
    try {
      const response = await fetch(`${API_HOST}/register/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, email, password }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(
          error.username?.[0] ||
            error.email?.[0] ||
            error.password?.[0] ||
            "Registration failed"
        );
      }

      // After registration, automatically log in
      return await login(username, password);
    } catch (error) {
      console.error("Registration error:", error);
      throw error;
    }
  };

  // Refresh access token
  const refreshAccessToken = async () => {
    const storedRefreshToken = sessionStorage.getItem("refresh_token");
    if (!storedRefreshToken) {
      throw new Error("No refresh token available");
    }

    try {
      const response = await fetch(`${API_HOST}/token/refresh/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ refresh: storedRefreshToken }),
      });

      if (!response.ok) {
        // Refresh token expired or invalid, logout user
        logout();
        throw new Error("Refresh token expired");
      }

      const data = await response.json();
      const { access } = data;

      sessionStorage.setItem("access_token", access);
      setToken_(access);
      return access;
    } catch (error) {
      console.error("Token refresh error:", error);
      logout();
      throw error;
    }
  };

  // Logout function
  const logout = () => {
    sessionStorage.removeItem("access_token");
    sessionStorage.removeItem("refresh_token");
    sessionStorage.removeItem("role");
    setToken_(null);
    setRefreshToken_(null);
    setRole(null);
  };

  // Helper function to make authenticated requests with automatic token refresh
  const makeAuthenticatedRequest = async (url, options = {}) => {
    let accessToken = token || sessionStorage.getItem("access_token");

    const makeRequest = async (tokenToUse) => {
      return fetch(url, {
        ...options,
        headers: {
          ...options.headers,
          Authorization: `Bearer ${tokenToUse}`,
          "Content-Type": options.headers?.["Content-Type"] || "application/json",
        },
      });
    };

    let response = await makeRequest(accessToken);

    // If 401, try to refresh token and retry
    if (response.status === 401) {
      try {
        const newAccessToken = await refreshAccessToken();
        response = await makeRequest(newAccessToken);
      } catch (error) {
        // Refresh failed, user will be logged out
        throw error;
      }
    }

    return response;
  };

  const contextValue = useMemo(
    () => ({
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
    [token, refreshToken, role, isLoading]
  );

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);

export default AuthProvider;
