"use client";

import { useEffect, useState } from "react";
import { jwtDecode } from "jwt-decode";

const API_URL = process.env.NEXT_PUBLIC_CHECKLIST_SERVER || "https://checklist.planmeet.net:5002";

interface DecodedToken {
  realm_access?: { roles?: string[] };
}

export default function Checklists({ token }: { token: string }) {
  const [userRole, setUserRole] = useState<string>("Other");
  const [assignedTeam, setAssignedTeam] = useState<string | null>(null); // CIO sees all

  useEffect(() => {
    try {
      if (!token) return;

      const decoded: DecodedToken = jwtDecode(token || "");
      const roles = decoded?.realm_access?.roles || [];

      if (roles.includes("CIO")) {
        setUserRole("CIO");
        setAssignedTeam(null); // CIO can see all checklists
      } else {
        setUserRole("Other");

        const groups = roles.filter((role) => role.startsWith("dev_team_")) || [];
        if (groups.length > 0) {
          setAssignedTeam(groups[0]); // Assign team for Dev/PO
        }
      }
    } catch (error) {
      console.error("Error decoding token:", error);
    }
  }, [token]);

  return (
    // <div className="absolute top-[14%] left-[19%] w-[79%] h-[84%] bg-gray-600 rounded-xl flex flex-row justify-between items-center px-[0.67%] bg-opacity-70">
    //   <Checklist title="Todo" assignedTeam={assignedTeam} userRole={userRole} token={token} />
    //   <Checklist title="In progress" assignedTeam={assignedTeam} userRole={userRole} token={token} />
    //   <Checklist title="In review" assignedTeam={assignedTeam} userRole={userRole} token={token} />
    //   <Checklist title="Done" assignedTeam={assignedTeam} userRole={userRole} token={token} />
    //   <Checklist title="Backlog" assignedTeam={assignedTeam} userRole={userRole} token={token} />
    // </div>
    <div className="absolute top-[14%] left-[19%] w-[79%] h-[84%] bg-gray-600 rounded-xl flex flex-row justify-between items-start px-[0.67%] bg-opacity-70 overflow-x-auto">
      {["Todo", "In progress", "In review", "Done", "Backlog"].map((status) => (
        <Checklist key={status} title={status} assignedTeam={assignedTeam} userRole={userRole} token={token} />
      ))}
    </div>
  );
}

function Checklist({ title, assignedTeam, userRole, token }: { title: string; assignedTeam: string | null; userRole: string; token: string }) {
  const [checklists, setChecklists] = useState<any[]>([]);

  useEffect(() => {
    const fetchChecklists = async () => {
      try {
        let endpoint = `${API_URL}/checklists`;

        if (userRole !== "CIO" && assignedTeam) {
          endpoint = `${API_URL}/checklists/team/${assignedTeam}`;
        }

        const response = await fetch(endpoint, {
          headers: { Authorization: `Bearer ${token}` },
        });

        const data = await response.json();
        const filteredChecklists = data.filter((item: any) => item.status?.S === title);
        setChecklists(filteredChecklists);
      } catch (error) {
        console.error("Error fetching checklists:", error);
      }
    };

    fetchChecklists();
  }, [title, assignedTeam, userRole, token]);

  return (
    <div className="flex flex-col top-[2%] w-[19%] h-[96%] bg-black rounded-xl bg-opacity-30">
      {/* <div className="relative flex left-[5%] w-[90%] top-[1%] h-[5%] flex-row items-center">
        <div className="relative flex top-0 left-0 h-[20px] w-[20px] justify-center items-center rounded-full bg-green-600"></div>
        <div className="relative flex top-0 left-[5%] h-[1/2] w-[50%] items-center font-medium text-white">{title}</div>
      </div> */}

      {/* Column Header */}
      <div className="flex items-center mb-2">
        <div className="h-[20px] w-[20px] rounded-full bg-green-600"></div>
        <span className="ml-2 font-medium text-white">{title}</span>
      </div>

      {/* Checklist Items */}
      <div className="flex flex-col gap-2 overflow-y-auto scrollbar-hide">
        {checklists.length === 0 ? (
          <div className="text-gray-400 text-sm">No checklists found.</div>
        ) : (
          checklists.map((checklist, index) => (
            <div key={index} className="bg-gray-300 rounded-md p-3">
              <div className="font-bold">{checklist.title?.S || "No Title"}</div>
              <div className="text-xs text-gray-700">{checklist.description?.S || "No Description"}</div>
            </div>
          ))
        )}
      </div>

      {/* <div className="relative flex left-[5%] w-[90%] top-[2%] h-[85%] flex-col items-center overflow-y-scroll gap-2">
        {checklists.map((checklist, index) => (
          <div key={index} className="w-full h-[10%] bg-gray-300 rounded-md flex flex-col p-2">
            <div className="font-bold">{checklist.title?.S || "No Title"}</div>
            <div className="text-sm">{checklist.description?.S || "No Description"}</div>
          </div>
        ))}
      </div> */}

      {/* Add Item Button for CIO */}
      {userRole === "CIO" && (
        <button className="mt-2 p-2 w-full bg-blue-500 text-white rounded hover:bg-blue-600">
          + Add Item
        </button>
      )}
      
    </div>
  );
}
