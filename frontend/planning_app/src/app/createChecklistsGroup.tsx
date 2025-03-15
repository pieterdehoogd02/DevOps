"use client";

import { useEffect, useState } from "react";
import { jwtDecode } from "jwt-decode";

const API_URL = process.env.NEXT_PUBLIC_CHECKLIST_SERVER || "https://checklist.planmeet.net:5002";

interface DecodedToken {
  realm_access?: { roles?: string[] };
}

export default function Checklists({ token }: { token: string }) {
  const [userRole, setUserRole] = useState<string>("Other");
  const [assignedTeam, setAssignedTeam] = useState<string | null>(null);
  const [teams, setTeams] = useState<string[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<string>("");

  useEffect(() => {
    try {
      if (!token) return;
      const decoded: DecodedToken = jwtDecode(token || "");
      const roles = decoded?.realm_access?.roles || [];

      if (roles.includes("CIO")) {
        setUserRole("CIO");
        setAssignedTeam(null);
        setTeams(roles.filter((role) => role.startsWith("dev_team_")) || []);
      } else {
        setUserRole("Other");
        const groups = roles.filter((role) => role.startsWith("dev_team_")) || [];
        if (groups.length > 0) {
          setAssignedTeam(groups[0]);
          setSelectedTeam(groups[0]);
        }
      }
    } catch (error) {
      console.error("Error decoding token:", error);
    }
  }, [token]);

  return (
    <div className="absolute top-[14%] left-[19%] w-[79%] h-[84%] bg-gray-600 rounded-xl flex flex-col px-[0.67%] bg-opacity-70">
      {userRole === "CIO" && (
        <div className="p-4 flex flex-row gap-2">
          <label className="text-white">Select Team:</label>
          <select 
            className="p-2 bg-gray-300 rounded-md" 
            value={selectedTeam} 
            onChange={(e) => setSelectedTeam(e.target.value)}
          >
            <option value="">-- Select Team --</option>
            {teams.map((team) => (
              <option key={team} value={team}>{team}</option>
            ))}
          </select>
        </div>
      )}

      <div className="flex flex-row justify-between items-center">
        <Checklist title="Todo" assignedTeam={selectedTeam || assignedTeam} userRole={userRole} token={token} />
        <Checklist title="In progress" assignedTeam={selectedTeam || assignedTeam} userRole={userRole} token={token} />
        <Checklist title="In review" assignedTeam={selectedTeam || assignedTeam} userRole={userRole} token={token} />
        <Checklist title="Done" assignedTeam={selectedTeam || assignedTeam} userRole={userRole} token={token} />
        <Checklist title="Backlog" assignedTeam={selectedTeam || assignedTeam} userRole={userRole} token={token} />
      </div>
    </div>
  );
}

function Checklist({ title, assignedTeam, userRole, token }: { title: string; assignedTeam: string | null; userRole: string; token: string }) {
  const [checklists, setChecklists] = useState<any[]>([]);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");

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

  const handleAddChecklist = async () => {
    if (!newTitle || !assignedTeam) {
      alert("Title and Assigned Team are required.");
      return;
    }
    try {
      const response = await fetch(`${API_URL}/checklists`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: newTitle,
          description: newDescription,
          assignedTeam,
        }),
      });
      if (response.ok) {
        setNewTitle("");
        setNewDescription("");
      }
    } catch (error) {
      console.error("Error adding checklist:", error);
    }
  };

  return (
    <div className="flex flex-col top-[2%] w-[19%] min-h-[96%] bg-black rounded-xl bg-opacity-30 p-3">
      <div className="flex items-center mb-2">
        <div className={`h-[20px] w-[20px] rounded-full 
          ${title === "Todo" ? "bg-orange-600" : title === "In progress" ? "bg-yellow-400" :
            title === "In review" ? "bg-blue-600" : title === "Done" ? "bg-green-600" : "bg-red-600"}`}>
        </div>
        <span className="ml-2 font-medium text-white">{title}</span>
      </div>
      <div className="flex flex-col gap-2 overflow-y-auto scrollbar-hide">
        {checklists.length === 0 ? (
          <div className="text-gray-400 text-sm">No checklists found.</div>
        ) : (
          checklists.map((checklist, index) => (
            <div key={index} className="bg-gray-300 rounded-md p-3 flex flex-col break-words">
              <div className="font-bold">{checklist.title?.S || "No Title"}</div>
              <div className="text-xs text-gray-700">{checklist.description?.S || "No Description"}</div>
            </div>
          ))
        )}
      </div>
      {userRole === "CIO" && (
        <button className="mt-2 p-2 w-full bg-blue-500 text-white rounded hover:bg-blue-600" onClick={handleAddChecklist}>
          + Add Item
        </button>
      )}
    </div>
  );
}
