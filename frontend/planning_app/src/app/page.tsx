"use client";

import { useState, useEffect } from "react";
import Checklists from "./createChecklistsGroup"

const authServer = process.env.NEXT_PUBLIC_AUTH_SERVER;
const apiServer = process.env.NEXT_PUBLIC_CHECKLIST_SERVER;

console.log("authServer = " + authServer)

export default function Home() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [checklists, setChecklists] = useState<{ id: string; title: string; description: string; assignedTeam: string }[]>([]);
  const [newChecklist, setNewChecklist] = useState({ title: "", description: "", assignedTeam: "" });

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (token) {
      setLoggedIn(true);
      fetchChecklists(token);
    }
  }, []);

  function decodeJWT(token : any) {
      const [header, payload] = token.split('.').slice(0, 2); // Ignore signature
      return {
          header: JSON.parse(atob(header.replace(/-/g, '+').replace(/_/g, '/'))),
          payload: JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')))
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

      console.log("Logged in!!!")

      const data = await response.json();

      console.log("access token = " + data.access_token)
      
      const decrypted = decodeJWT(data.access_token)
      console.log("decrypted access token = " + JSON.stringify(decrypted))

      localStorage.setItem("access_token", data.access_token);
      setLoggedIn(true);
      fetchChecklists(data.access_token);
    } catch (error) {
      console.error("Login error:", error);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    setLoggedIn(false);
    setChecklists([]);
  };

  const fetchChecklists = async (token: string | null) => {
    try {
      const response = await fetch(`${apiServer}/checklists`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      setChecklists(data);
    } catch (error) {
      console.error("Fetch error:", error);
    }
  };

  const createChecklist = async () => {
    if (!newChecklist.title || !newChecklist.description || !newChecklist.assignedTeam) return;
    const token = localStorage.getItem("access_token");
    try {
      const response = await fetch(`${apiServer}/checklists`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(newChecklist),
      });
      if (response.ok) {
        setNewChecklist({ title: "", description: "", assignedTeam: "" });
        fetchChecklists(token);
      }
    } catch (error) {
      console.error("Create error:", error);
    }
  };

  const deleteChecklist = async (id: any) => {
    const token = localStorage.getItem("access_token");
    try {
      await fetch(`${apiServer}/checklists/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchChecklists(token);
    } catch (error) {
      console.error("Delete error:", error);
    }
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
      ):
        <Dashboard handleLogout={handleLogout} decodeJWT={decodeJWT}></Dashboard>
      }
    </div>
  );
}

function Dashboard(props: any) {

  const [roles, setRoles] : any = useState([])

  useEffect(() => {
    if(localStorage.getItem("access_token") !== null) setRolesAsync(getRoles(props.decodeJWT(localStorage.getItem("access_token"))))
  }, [localStorage])

  const setRolesAsync = async (roles : any) => {
    setRoles(roles)
  }


  function getRoles(token: any) {
    return token?.resource_access?.DevOpsAuthService?.roles || []
  }

  function getPeopleAllocatedToProject(projectName: string) {

  }

  return (
    <div className="left-0 top-0 w-full h-full">
      {/* Top Navigation Bar */}
      <div className="absolute top-[2%] left-[2%] w-[96%] h-[10%] bg-gray-600 bg-opacity-70 rounded-xl flex flex-row">
        <div className="relative left-[20%] top-0 w-[40%] h-full flex flex-row">
          <div className="flex w-[33%] text-base font-semibold justify-start items-center hover:underline-offset-4 hover:underline hover:cursor-pointer" onClick={() => {}}>My projects</div>
          <div className="flex w-[33%] text-base font-semibold justify-start items-center hover:underline-offset-4 hover:underline hover:cursor-pointer" onClick={() => {}}>People</div>
          {roles.includes("CIO") && <div className="flex w-[34%] text-base font-semibold justify-start items-center hover:underline-offset-4 hover:underline hover:cursor-pointer"
            onClick={() => {}}>Create</div>}
        </div>
        <div className="relative left-[46%] top-0 w-[14%] h-full flex flex-row items-center justify-center">
          <div className="flex flex-row h-[50%] w-[25%] items-center justify-start font-semibold font-sans text-base hover:underline-offset-4 hover:underline hover:cursor-pointer" 
            onClick={() => { props.handleLogout() }}>Logout</div>
        </div>
      </div>  

      {/* Sidebar */}
      <div className="absolute top-[14%] h-[84%] left-[2%] w-[16%] bg-gray-600 bg-opacity-70 rounded-xl flex flex-col gap-[12%] py-6">
        {/* Project Section */}
        <div className="relative flex flex-row w-full top-[20%] h-[1/10]">
          <div className="w-[30%] h-full flex flex-row justify-end items-center rounded-xl">
            <div className="w-[60%] h-[80%] flex bg-blue-700 rounded-md justify-center items-center"></div>
          </div>
          <div className="flex flex-col w-[70%] h-full">
            <div className="flex h-[50%] w-full text-md justify-start items-center indent-[10px] font-sans font-semibold">Project name</div>
            <div className="flex h-[50%] w-full text-sm justify-start items-center indent-[10px] font-sans font-medium">Software Engineering</div>
          </div>
        </div>

        {/* Sidebar Menu Items */}
        <div className="relative flex w-full h-[1/10] top-[12%] text-white text-md justify-center items-center font-semibold hover:underline-offset-4 hover:underline hover:cursor-pointer" 
          onClick={() => {}}>Backlog</div>
        <div className="relative flex w-full h-[1/10] top-[12%] text-white text-md justify-center items-center font-semibold hover:underline-offset-4 hover:underline hover:cursor-pointer" 
          onClick={() => {}}>Roles</div>
      </div>

      {/* Main Content Area */}
      <Checklists></Checklists>
    </div>
  );
}


function OldDashboard() {

  return (
    <div className="w-full h-full flex">
          {/* <div className="w-3/4 p-6">
            <h2 className="text-2xl font-bold">Dashboard</h2>
            <button onClick={handleLogout} className="bg-red-500 text-white p-2 rounded mt-4">
              Logout
            </button>
          </div>
          <div className="w-1/4 p-6 bg-gray-100 border-l">
            <h2 className="text-xl font-bold">Checklists</h2>
            <div className="flex flex-col space-y-2 my-4">
              <input
                type="text"
                placeholder="Title"
                value={newChecklist.title}
                onChange={(e) => setNewChecklist({ ...newChecklist, title: e.target.value })}
                className="border p-2 rounded text-black"
              />
              <input
                type="text"
                placeholder="Description"
                value={newChecklist.description}
                onChange={(e) => setNewChecklist({ ...newChecklist, description: e.target.value })}
                className="border p-2 rounded text-black"
              />
              <input
                type="text"
                placeholder="Assigned Team"
                value={newChecklist.assignedTeam}
                onChange={(e) => setNewChecklist({ ...newChecklist, assignedTeam: e.target.value })}
                className="border p-2 rounded text-black"
              />
              <button onClick={createChecklist} className="bg-green-500 text-white p-2 rounded">
                Add Checklist
              </button>
            </div>
            <ul>
              {checklists.map((checklist) => (
                <li key={checklist.id} className="flex justify-between p-2 border-b">
                  <div>
                    <strong>{checklist.title}</strong> ({checklist.assignedTeam})
                    <p className="text-sm">{checklist.description}</p>
                  </div>
                  <button onClick={() => deleteChecklist(checklist.id)} className="text-red-500">
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          </div> */}
        </div>
  );
}