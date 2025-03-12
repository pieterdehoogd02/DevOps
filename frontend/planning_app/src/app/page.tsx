"use client";

import { useState, useEffect } from "react";

const authServer = process.env.NEXT_PUBLIC_AUTH_SERVER; // ✅ Read from .env file

export default function Home() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    console.log("Backend Authentication Server:", authServer);

    // ✅ Check if already logged in
    const token = localStorage.getItem("access_token");
    if (token) {
      setLoggedIn(true);
    }
  }, []);

  const handleLogin = async () => {
    console.log("Logging in with:", username, password);
    
    if (!username || !password) {
      alert("Please enter both username and password");
      return;
    }

    try {
      const response = await fetch(`${authServer}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Login failed:", errorData);
        alert("Login failed: " + (errorData.error || "Unknown error"));
        return;
      }

      const data = await response.json();
      console.log("Login success! Token:", data.access_token);

      // ✅ Store token in localStorage
      localStorage.setItem("access_token", data.access_token);
      setLoggedIn(true);
      alert("Login successful!");

    } catch (error) {
      console.error("Error logging in:", error);
      alert("An error occurred while logging in.");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    setLoggedIn(false);
  };

  return (
    <div className="w-full h-full flex flex-col items-center justify-center space-y-4">
      {!loggedIn ? (
        <div className="border p-6 rounded shadow-lg w-96">
          <h2 className="text-xl font-bold mb-4">Login</h2>
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => {setUsername(e.target.value) ; console.log("username = " + username)}}
            className="border p-2 w-full rounded mb-2 text-black text-lg indent-[20px]"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => {setPassword(e.target.value); console.log("password = " + password)}}
            className="border p-2 w-full rounded mb-2 text-black text-lg indent-[20px]"
          />
          <button
            onClick={handleLogin}
            className="bg-blue-500 text-white p-2 w-full rounded"
          >
            Login
          </button>
        </div>
      ) : (
        <div className="text-center">
          <h2 className="text-xl font-bold">Welcome!</h2>
          <p>You are logged in.</p>
          <button
            onClick={handleLogout}
            className="bg-red-500 text-white p-2 w-full rounded mt-4"
          >
            Logout
          </button>
        </div>
      )}
    </div>
  );
}
