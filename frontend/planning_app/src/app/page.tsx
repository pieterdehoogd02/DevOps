"use client";

import { useState, useEffect } from "react";
import Checklists from "./createChecklistsGroup";

const authServer = process.env.NEXT_PUBLIC_AUTH_SERVER;
const apiServer = process.env.NEXT_PUBLIC_CHECKLIST_SERVER;

export default function Home() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const storedToken = localStorage.getItem("access_token");
    if (storedToken) {
      setLoggedIn(true);
      setToken(storedToken);
    }
  }, []);

  function decodeJWT(token: string) {
    const [header, payload] = token.split(".").slice(0, 2);
    return {
      header: JSON.parse(atob(header.replace(/-/g, "+").replace(/_/g, "/"))),
      payload: JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/"))),
    };
  }

  const handleLogin = async () => {
    if (!username || !password) {
      alert("Please enter both username and password");
      return;
    }

    try {
      const response = await fetch(`${authServer}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        alert("Login failed");
        return;
      }

      const data = await response.json();
      localStorage.setItem("access_token", data.access_token);
      setLoggedIn(true);
      setToken(data.access_token);
    } catch (error) {
      console.error("Login error:", error);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    setLoggedIn(false);
    setToken(null);
  };

  return (
    <div className="w-full h-screen flex">
      {!loggedIn ? (
        <div className="flex justify-center items-center w-full h-full">
          <div className="border p-6 rounded shadow-lg w-96">
            <h2 className="text-xl font-bold mb-4">Login</h2>
            <input
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="border p-2 w-full rounded mb-2 text-black"
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="border p-2 w-full rounded mb-2 text-black"
            />
            <button onClick={handleLogin} className="bg-blue-500 text-white p-2 w-full rounded">
              Login
            </button>
          </div>
        </div>
      ) : (
        <Dashboard handleLogout={handleLogout} token={token} decodeJWT={decodeJWT} />
      )}
    </div>
  );
}

function Dashboard(props: { handleLogout: () => void; token: string | null }) {
  return (
    <div className="left-0 top-0 w-full h-full">
      {/* ✅ Pass `token` to `Checklists` */}
      <Checklists token={props.token || ""} />
    </div>
  );
}
