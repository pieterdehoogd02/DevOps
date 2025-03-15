"use client";

import { useEffect, useState } from "react";
import { jwtDecode } from "jwt-decode";

// API URL for the backend server 
const API_URL = process.env.NEXT_PUBLIC_CHECKLIST_SERVER || "https://checklist.planmeet.net:5002";

interface DecodedToken {
  realm_access?: { roles?: string[] };
}

export default function Checklists({ token }: { token: string }) {
  const [userRole, setUserRole] = useState<string>("Other"); // State to track the user's role (CIO, PO, Dev)
  const [assignedTeam, setAssignedTeam] = useState<string | null>(null); // State to track the assigned team for non-CIO users
  const [teams, setTeams] = useState<string[]>([]); // State to track all teams (for CIO role)
  const [selectedTeam, setSelectedTeam] = useState<string>(""); // State to track the currently selected team (for CIO role)

  // Extract user role and assigned team from JWT token
  useEffect(() => {
    try {
      if (!token) return;
      const decoded: DecodedToken = jwtDecode(token || "");
      const roles = decoded?.realm_access?.roles || [];

      if (roles.includes("CIO")) {
        // CIOs can switch between teams
        setUserRole("CIO");
        setAssignedTeam(null);
        setTeams(roles.filter((role) => role.startsWith("dev_team_")) || []);
      } else {
        // Set role to PO or Dev
        setUserRole(roles.includes("PO") ? "PO" : "Dev");

        // Identify the team the user belongs to
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
      {/* Dropdown for CIO to switch between teams */}
      {userRole === "CIO" && (
        <div className="p-4 flex flex-row gap-2">
          <label className="text-white">Viewing Team:</label>
          <select
            className="p-2 bg-gray-300 rounded-md"
            value={selectedTeam}
            onChange={(e) => setSelectedTeam(e.target.value)}
          >
            {teams.map((team) => (
              <option key={team} value={team}>{team}</option>
            ))}
          </select>
        </div>
      )}

      {/* Render columns for different checklist categories */}
      <div className="flex flex-row justify-between items-center">
        {["Todo", "In progress", "In review", "Done", "Backlog"].map((title) => (
          <Checklist
            key={title}
            title={title}
            assignedTeam={selectedTeam || assignedTeam}
            userRole={userRole}
            token={token}
            teams={teams}
          />
        ))}
      </div>
    </div>
  );
}

function Checklist({ title, assignedTeam, userRole, token, teams }: { title: string; assignedTeam: string | null; userRole: string; token: string; teams: string[] }) {
  const [checklists, setChecklists] = useState<any[]>([]);
  const [menuOpen, setMenuOpen] = useState<{ [key: string]: boolean }>({});
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newAssignedTeam, setNewAssignedTeam] = useState(assignedTeam || "");

  // Fetch checklists for this category from the backend
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

  // CIO: Delete a checklist
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

  // CIO: Add a new checklist
  const handleAddChecklist = async () => {

    const teamToAssign = assignedTeam || selectedTeam; // Ensure assignedTeam is not null

    if (!newTitle || !teamToAssign) {
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
          assignedTeam: teamToAssign,
        }),
      });

      if (response.ok) {
        setShowAddModal(false); // Close the modal after adding successfully
        setNewTitle("");
        setNewDescription("");
      }
    } catch (error) {
      console.error("Error adding checklist:", error);
    }
  };

  return (
    <div className="flex flex-col top-[2%] w-[19%] min-h-[96%] bg-black rounded-xl bg-opacity-30 p-3">
      {/* Column Header */}
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
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Add Checklist Button for CIO */}
      {userRole === "CIO" && (
        <button className="mt-2 p-2 w-full bg-blue-500 text-white rounded hover:bg-blue-600" onClick={() => setShowAddModal(true)}>
          + Add Item
        </button>
      )}

      {/* Add Item Modal */}
      {showAddModal && (
        <div className="fixed inset-0 flex justify-center items-center bg-black bg-opacity-50 z-50">
          <div className="bg-white p-6 rounded shadow-xl w-[400px]">
            <h2 className="text-lg font-bold mb-2">Add New Checklist</h2>
            <input 
              type="text" 
              placeholder="Title" 
              value={newTitle} 
              onChange={(e) => setNewTitle(e.target.value)} 
              className="border p-2 w-full mb-2"
            />
            <textarea 
              placeholder="Description" 
              value={newDescription} 
              onChange={(e) => setNewDescription(e.target.value)} 
              className="border p-2 w-full mb-2"
            ></textarea>

            {/* Show Assigned Team selection for CIOs */}
            {userRole === "CIO" && (
              <select 
                className="p-2 bg-gray-300 rounded-md w-full mb-2"
                value={selectedTeam}
                onChange={(e) => setSelectedTeam(e.target.value)}
              >
                <option value="">-- Select Team --</option>
                {teams.map((team) => (
                  <option key={team} value={team}>{team}</option>
                ))}
              </select>
            )}

            <div className="flex justify-end gap-2">
              <button onClick={() => setShowAddModal(false)} className="p-2 bg-gray-300 rounded">Cancel</button>
              <button onClick={handleAddChecklist} className="p-2 bg-blue-500 text-white rounded">Add</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}