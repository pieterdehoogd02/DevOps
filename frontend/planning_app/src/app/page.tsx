"use client";

import { useState, useEffect } from "react";
import Checklists from "./createChecklistsGroup";
import ViewSubmissions from "./ViewSubmissions";
import Users from "./Users";

import { jwtDecode } from "jwt-decode";

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
      localStorage.setItem("access_token", data.access_token);
      console.log("access token = " + JSON.stringify(jwtDecode(data.access_token)))
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
        <Dashboard handleLogout={handleLogout} token={token}/>
      )}
    </div>
  );
}

function Dashboard(props: any) {

  const [roles, setRoles] : any = useState([])
  const [members, setMembers] : any = useState([])
  const [showChecklists, setShowChecklists] = useState(true)
  const [showUsers, setShowUsers] = useState(false)

  const [showSubmissions, setShowSubmissions] = useState(false);

  // once we get the token update roles
  useEffect(() => {
    console.log("localStorage has changed")
    // if(!props.token) {
    //   console.log("decoded access_token = " + JSON.stringify(jwtDecode(props.token || "")))
    //   setRolesAsync(getRoles(jwtDecode(props.token || "")))
    //   console.log("roles = " + JSON.stringify(roles))
    // }

    if (props.token) { 
      const decodedToken = jwtDecode(props.token || "");
      console.log("Decoded token:", decodedToken);
  
      const extractedRoles = getRoles(decodedToken);
      console.log("✅ Extracted roles:", extractedRoles);
      
      setRoles(extractedRoles);
    }
  }, [props.token]); // this runs when `props.token` changes

  const setRolesAsync = async (roles : any) => {
    setRoles(roles)
  }

   const setMembersAsync = async (members : any) => {
    setMembers(members)
  }

   const setShowChecklistsAsync = async () => {
    setShowChecklists(!showChecklists)
  }
   
  const setShowUsersAsync = async () => {
    setShowUsers(!showUsers)
  }
  
  // function getRoles(token: any) {
  //   return token?.payload?.resource_access?.DevOpsAuthService?.roles || []
  // }

  async function getProjectMembers() {
    try {
      const token = props.token;

      if (!token) {
        throw new Error("No access token found");
      }

      const response = await fetch(`${authServer}/project/members`, {
        method: "GET", // Explicitly set the method
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }

      const data = await response.json()    
      console.log("data = " + JSON.stringify(data))
      setMembersAsync(data.users)

      return data; // Convert response to JSON
    } catch (error) {
      console.error("Error fetching project members:", error);
      return null; // Return null or handle errors appropriately
    }
  }

  function getRoles (token : any) {
    // Ensure we extract roles correctly from `realm_access`
    const roles = token?.realm_access?.roles || [];
    console.log("Extracted roles from token:", roles); // Debugging

    return roles;
  }

  console.log("Roles before rendering sidebar: ", roles); // Debugging

  return (
    <div className="left-0 top-0 w-full h-full">
      {/* Top Navigation Bar */}
      <div className="absolute top-[2%] left-[2%] w-[96%] h-[10%] bg-gray-600 bg-opacity-70 rounded-xl flex flex-row">
        <div className="relative left-[20%] top-0 w-[40%] h-full flex flex-row">
          <div className="flex w-[33%] text-base font-semibold justify-start items-center hover:underline-offset-4 hover:underline hover:cursor-pointer" onClick={() => {}}>My projects</div>
          <div className="flex w-[33%] text-base font-semibold justify-start items-center hover:underline-offset-4 hover:underline hover:cursor-pointer" 
            onClick={async () => {await getProjectMembers(); await setShowUsersAsync(); await setShowChecklistsAsync();}}>People</div>
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
          onClick={async () => {await setShowUsersAsync(); await setShowChecklistsAsync();}}>Backlog</div>
        {/* <div className="relative flex w-full h-[1/10] top-[12%] text-white text-md justify-center items-center font-semibold hover:underline-offset-4 hover:underline hover:cursor-pointer" 
          onClick={() => {}}>Roles</div> */}

        {/* New section for CIO to view submissions */}
        {roles.includes("CIO") && (
          <div
            className="relative flex w-full h-[1/10] top-[12%] text-white text-md justify-center items-center font-semibold hover:underline-offset-4 hover:underline hover:cursor-pointer"
            onClick={() => {
              console.log("📌 View Submissions clicked!"); // Debugging
              setShowSubmissions(true);
              setShowChecklists(false);
              setShowUsers(false);
            }}
          >
            View Submissions
          </div>
        )}
      </div>

      {/* Main Content Area */}
      {showChecklists && <Checklists token={props.token}></Checklists>}
      {showUsers && <Users users={members} token={props.token}></Users>}
      {showSubmissions && <ViewSubmissions token={props.token}></ViewSubmissions>}
    </div>
  );
}
