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
        setUserRole(roles.includes("PO") ? "PO" : "Dev");
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
            <option value="">-- {selectedTeam || "Select Team"} --</option>
            {teams.map((team) => (
              <option key={team} value={team}>{team}</option>
            ))}
          </select>
        </div>
      )}

      <div className="flex flex-row justify-between items-center">
        {["Todo", "In progress", "In review", "Done", "Backlog"].map((title) => (
          <Checklist
            key={title}
            title={title}
            assignedTeam={selectedTeam || assignedTeam}
            userRole={userRole}
            token={token}
          />
        ))}
      </div>
    </div>
  );
}

function Checklist({ title, assignedTeam, userRole, token }: { title: string; assignedTeam: string | null; userRole: string; token: string }) {
  const [checklists, setChecklists] = useState<any[]>([]);
  const [menuOpen, setMenuOpen] = useState<{ [key: string]: boolean }>({});
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [updateStatusId, setUpdateStatusId] = useState<string | null>(null);
  const [newStatus, setNewStatus] = useState("");

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

  const handleDeleteChecklist = async (id: string) => {
    if (!assignedTeam) return;
    try {
      const response = await fetch(`${API_URL}/checklists/${id}/${assignedTeam}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        setChecklists(checklists.filter((item) => item.id.S !== id));
        setConfirmDeleteId(null);
      }
    } catch (error) {
      console.error("Error deleting checklist:", error);
    }
  };

  const handleUpdateChecklist = async (id: string) => {
    if (!assignedTeam || !newStatus) return;
    try {
      const response = await fetch(`${API_URL}/checklists/${id}/${assignedTeam}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        setChecklists(checklists.map((item) => (item.id.S === id ? { ...item, status: { S: newStatus } } : item)));
        setUpdateStatusId(null);
      }
    } catch (error) {
      console.error("Error updating checklist:", error);
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
        {checklists.map((checklist, index) => (
          <div key={index} className="bg-gray-300 rounded-md p-3 flex flex-col relative">
            <div className="font-bold">{checklist.title?.S || "No Title"}</div>
            <div className="text-xs text-gray-700">{checklist.description?.S || "No Description"}</div>

            {(userRole === "CIO" || userRole === "PO") && (
              <div className="absolute top-2 right-2">
                <button className="text-gray-600" onClick={() => setMenuOpen({ ...menuOpen, [checklist.id.S]: !menuOpen[checklist.id.S] })}>
                  ⋮
                </button>
                {menuOpen[checklist.id.S] && (
                  <div className="absolute right-0 mt-1 bg-white shadow-md rounded-md p-2">
                    {userRole === "CIO" && (
                      <button onClick={() => setConfirmDeleteId(checklist.id.S)} className="text-red-500">
                        Delete
                      </button>
                    )}
                    {userRole === "PO" && (
                      <button onClick={() => setUpdateStatusId(checklist.id.S)} className="text-blue-500">
                        Update
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
