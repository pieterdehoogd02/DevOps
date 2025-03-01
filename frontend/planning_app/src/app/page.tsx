'use client'

import react, { useState, useEffect, useRef } from "react";
import Login from "./login/page";
import dotenv from 'dotenv';
import axios from "axios";
import jwt from 'jsonwebtoken';

dotenv.config();


// Load environment variables from the .env file

const server_ip = "54.243.10.234:8080"

export default function Home() {

  const [loggedIn, setLogIn] = useState(false)
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [decodedToken, setToken] = useState("")

  const loggingIn = async () => {
    setLogIn(true)
  }

  const settingToken = async (str : string) => {
    setToken(str)
  }

  useEffect(() => {
    console.log('EC2 Keycloak URL:', server_ip);
  }, []);
  
  useEffect(() => {
    console.log("Updated token state:", decodedToken);
  }, [decodedToken]); // This will run whenever `decodedToken` changes


    const handleLogin = async (username: string, password: string) => {
      const url = `http://54.164.144.99:5001/auth/login`; // Your AuthService URL
      // const url = `http://localhost:5001/auth/login`; // Your AuthService URL

      console.log("username = " + username + ", password = " + password);

      const payload = {
        username,
        password
    };

      try {
          const response = await fetch(url, {
              method: "POST",
              headers: {
                  "Content-Type": "application/json"
              },
              body: JSON.stringify({ username, password })  // Sending JSON directly
          });

          if (!response.ok) {
              const errorData = await response.json();
              console.error("Login failed:", errorData);
              console.log("Login failed! Check credentials.");
              return;
          }

          const data = await response.json();
          console.log("Login success! Token:", data.access_token);

          const decoded = jwt.decode(data.access_token);

          console.log("decoded response = " + JSON.stringify(decoded));

          loggingIn(); // sets the loggedIn to true so we can now enter the dashboard

          // Store token somewhere (localStorage, sessionStorage, etc.)
          localStorage.setItem("access_token", JSON.stringify(decoded));
          await settingToken(JSON.stringify(decoded))
          console.log("Login successful!");
      } catch (error) {
          console.error("Error logging in:", error);
          console.log("An error occurred while logging in.");
      }
  };



  return (
    <div className="w-full h-full">
      {!loggedIn && <Login username={username} setUsername={setUsername} password={password} setPassword={setPassword} handleLogin={handleLogin}></Login>}
      {loggedIn && <Dashboard decodedToken={decodedToken}></Dashboard>}
    </div>
  );
}


function Dashboard(props : any) {
  return (
    <div className="absolute left-0 top-0 w-full h-full bg-[#166E89]">
      <TopBar token={props.decodedToken}></TopBar>
      <div className="relative left-0 top-[2%] h-[90%] flex flex-row">
        <LeftPanel></LeftPanel>
        <div className="relative left-[4%] top-[4%] w-[78%] h-[95%] bg-[#312C2C] bg-opacity-70 rounded-xl"></div>
      </div>
    </div>
  );
}

function TopBar(props: any) {
  const tokenState = useRef<any>(null);

  useEffect(() => {
    // If the token from props is not null or empty, update the ref
    if (props.token !== null && props.token !== '') {
      console.log("updating tokenState in top bar")
      tokenState.current = JSON.parse(props.token);
      console.log("tokenState = " + JSON.stringify(tokenState.current) + " tokenState type = " + typeof(tokenState.current))
    }
  }, [props.token]);

  return (
    <div className="relative top-[2%] left-[2%] h-[6%] w-[96%] bg-[#312C2C] bg-opacity-70 rounded-xl flex flex-row">
      <div className="relative left-[20%] w-[40%] top-0 h-full flex flex-row items-center justify-center">
        <div className="flex flex-row w-[35%] h-full font-sans font-semibold text-white justify-start items-center hover:underline hover:cursor-pointer hover:underline-offset-4">My projects</div>
        <div className="flex flex-row w-[35%]  h-full font-sans font-semibold text-white justify-start items-center hover:underline hover:cursor-pointer hover:underline-offset-4">People</div>
        <div className="flex flex-row w-[30%] h-full font-sans font-semibold text-white justify-start items-center">
          {JSON.parse(props.token).group.includes("/CIO") && <div className="h-[70%] rounded-md bg-blue-600 w-[50%] flex flex-row justify-center items-center hover:cursor-pointer">Create</div>}
        </div>
      </div>
      <div className="absolute left-[80%] top-0 w-[20%] h-full flex flex-row justify-center items-center">
        <div className="relative flex left-0 top-0 w-[20%] h-[50%] justify-center items-center ">
          <img src="./cog.png" className="w-[60%] h-[100%]" alt="Profile settings" />
        </div>
        <div className="relative flex left-0 top-0 w-[50%] h-full justify-center items-center ">
          {tokenState.current !== null && tokenState.current !== '' && (
            <div className="flex left-0 w-[60%] h-full flex-col text-xs">
              <div className="flex w-full h-[50%] text-md justify-start items-end font-semibold font-sans">{tokenState.current?.name}</div>
              {tokenState.current?.group !== null && (
                <div className="flex w-full h-[50%] text-md justify-start items-start font-medium font-sans">{tokenState.current?.group[0].slice(1, tokenState.current?.group[0].length)}</div>
              )}
            </div>
          )}
          <div className="flex w-[30px] h-[30px] justify-center items-center rounded-full bg-blue-500">

          </div>
        </div>
      </div>
    </div>
  );
}

function LeftPanel() {
  return (
    <div className="relative left-[2%] top-[4%] w-[16%] h-[95%] bg-[#312C2C] bg-opacity-70 rounded-xl flex flex-col">
      <div className="relative top-[10%] left-0 flex flex-row w-full h-[10%]">
        {/* Left icon */}
        <div className="left-0 top-0 w-[25%] h-full flex flex-row justify-end items-center">
          <img src="./GroupPic2.png" className="h-[50%] w-[50%]" />
        </div>

        {/* Text container */}
        <div className="left-0 top-0 w-[80%] h-full flex flex-col justify-end">
          <div className="indent-[15px] left-0 top-0 w-[80%] h-[55%] text-lg text-white flex items-end">
            Project name
          </div>
          <div className="indent-[15px] left-0 top-0 w-[80%] h-[45%] text-xs text-white flex items-start">
            Software Engineering
          </div>
        </div>
      </div>
      <div className="relative top-[10%] left-0 flex flex-row w-full h-[10%] justify-center items-center text-white">
        <div className="relative flex flex-row w-[60%] h-[60%] justify-center items-center hover:bg-gray-400 text-lg font-semibold hover:rounded-md hover:cursor-pointer">
          Backlog
        </div>
      </div>
      <div className="relative top-[10%] left-0 flex flex-row w-full h-[10%] justify-center items-center text-white rounded-md">
        <div className="relative flex flex-row w-[60%] h-[60%] justify-center items-center hover:bg-gray-400 hover:rounded-md text-lg font-semibold hover:cursor-pointer">
          Roles
        </div>
      </div>
    </div>
  );
}
