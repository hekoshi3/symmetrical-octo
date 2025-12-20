'use client'

import React, { useState } from 'react';
import "@/app/css/Login.css";

export default function LoginPage() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleLogin = async (event: React.FormEvent) => {
        event.preventDefault();

        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username, password }),
            });

            const data = await response.json();

            if (response.ok) {
                sessionStorage.setItem('token', data.token);
                window.location.href = '/user';
            } else {
                setError(data.error || 'Login failed');
            }
        } catch (err) {
            setError('An error occurred.'+err);
        }
    };

    return (
        <div id="authWindow">
            <form onSubmit={handleLogin}>
                <div className="text_area">
                    <input
                        type="text"
                        id="username"
                        name="username"
                        className="text_input"
                        placeholder="Username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                    />
                </div>
                <div className="text_area">
                    <input
                        type="password"
                        id="password"
                        name="password"
                        className="text_input"
                        placeholder="Password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                    />
                </div>
                <button type="submit" className="btn">
                    <p>Login</p>
                </button>
            </form>

            {error && <p className="error">{error}</p>}
        </div>
    );
}
