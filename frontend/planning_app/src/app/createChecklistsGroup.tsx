"use client";

import { useEffect, useState } from "react";
import { jwtDecode } from "jwt-decode";

// API URL for the backend server 
const API_URL = process.env.NEXT_PUBLIC_CHECKLIST_SERVER || "https://checklist.planmeet.net:5002";

interface DecodedToken {
  realm_access?: { roles?: string[] };
}

export default function Checklists({ token }: { token: string }) {
  const [userRole, setUserRole] = useState<string>("Other"); // Stores the role of the logged-in user
  const [selectedTeam, setSelectedTeam] = useState<string>("dev_team_1"); // Default team for CIO
  const [teams, setTeams] = useState<string[]>([]); // List of available teams (for CIOs)

  // Extract user role and assigned team from JWT token
  useEffect(() => {
    try {
      if (!token) return;
      const decoded: DecodedToken = jwtDecode(token || "");
      const roles = decoded?.realm_access?.roles || [];

      if (roles.includes("CIO")) {
        // CIOs can switch between teams
        setUserRole("CIO");
        setTeams(roles.filter((role) => role.startsWith("dev_team_")) || []);
      } else {
        // Set role to PO or Dev
        setUserRole(roles.includes("PO") ? "PO" : "Dev");

        // Assign the user to their respective team
        const groups = roles.filter((role) => role.startsWith("dev_team_")) || [];
        if (groups.length > 0) {
          setSelectedTeam(groups[0]); // Set their assigned team
        }
      }
    } catch (error) {
      console.error("Error decoding token:", error);
    }
  }, [token]);

  return (
    <div className="absolute top-[14%] left-[19%] w-[79%] h-[84%] bg-gray-600 rounded-xl flex flex-col px-[0.67%] bg-opacity-70">
      
      {/* CIO Team Selection Dropdown */}
      {userRole === "CIO" && (
        <div className="p-4 flex flex-row gap-2 items-center">
          <label className="text-white font-semibold">Viewing Team:</label>
          <select
            className="p-2 bg-gray-300 rounded-md"
            value={selectedTeam || (teams.length > 0 ? teams[0] : "")} // ✅ Always show the current team
            onChange={(e) => setSelectedTeam(e.target.value)}
          >
            {teams.length === 0 ? (
              <option value="">No Teams Available</option> // ✅ Show message if no teams exist
            ) : (
              teams.map((team) => (
                <option key={team} value={team}>
                  {team} {/* ✅ Ensure team name is displayed */}
                </option>
              ))
            )}
          </select>
        </div>
      )}

      {/* Render Checklist Columns (For Selected Team) */}
      <div className="flex flex-row justify-between items-center">
        {["Todo", "In progress", "In review", "Done", "Backlog"].map((title) => (
          <Checklist
            key={title}
            title={title}
            assignedTeam={selectedTeam} // Always pass the selected team
            userRole={userRole}
            token={token}
          />
        ))}
      </div>
    </div>
  );
}

function Checklist({ title, assignedTeam, userRole, token }: { title: string; assignedTeam: string; userRole: string; token: string }) {
  const [checklists, setChecklists] = useState<any[]>([]);
  
  const [menuOpen, setMenuOpen] = useState<{ [key: string]: boolean }>({});
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  
  const [showUpdateModal, setShowUpdateModal] = useState<string | null>(null);
  const [newStatus, setNewStatus] = useState<string>("");

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // ✅ Stores the category for new checklists
  const [newChecklistStatus, setNewChecklistStatus] = useState<string>(""); 

  // Fetch checklists **for the selected team**
  useEffect(() => {
    const fetchChecklists = async () => {
      try {
        const response = await fetch(`${API_URL}/checklists/team/${assignedTeam}`, {
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
  }, [title, assignedTeam, token]);

  // CIO: Delete a checklist with confirmation
  const handleDeleteChecklist = async (id: string) => {
    if (!assignedTeam) return;

    if (!window.confirm("Are you sure you want to delete this checklist?")) return; // Confirmation dialog

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

  // PO: Update checklist status
  const handleUpdateStatus = async (id: string) => {
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
        setShowUpdateModal(null);
        setNewStatus("");
        setChecklists((prevChecklists) =>
          prevChecklists.map((item) =>
            item.id.S === id ? { ...item, status: { S: newStatus } } : item
          )
        );
      }
    } catch (error) {
      console.error("Error updating checklist status:", error);
    }
  };

  // CIO correctly adds a new checklist to the selected team
  const handleAddChecklist = async (status: string) => {
    if (!newTitle) {
      alert("Title is required.");
      return;
    }

    console.log("🚀 Adding checklist with status:", status); // ✅ Debugging

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
          assignedTeam, // Pass the currently viewed team
          status, // Add the checklist category (column) to the request
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

      {/* Checklist Items */}
      <div className="flex flex-col gap-2 overflow-y-auto scrollbar-hide">
        {checklists.map((checklist, index) => (
          <div key={index} className="bg-gray-300 rounded-md p-3 flex flex-col relative">
            <div className="font-bold">{checklist.title?.S || "No Title"}</div>
            <div className="text-xs text-gray-700">{checklist.description?.S || "No Description"}</div>

            {/* Three-dot menu for CIOs and POs */}
            {(userRole === "CIO" || userRole === "PO") && (
              <div className="absolute top-2 right-2">
                <button 
                  className="text-gray-600" 
                  onClick={() => setMenuOpen({ ...menuOpen, [checklist.id.S]: !menuOpen[checklist.id.S] })}
                >
                  ⋮
                </button>

                {menuOpen[checklist.id.S] && (
                  <div className="absolute right-0 mt-1 bg-white shadow-md rounded-md p-2">
                    {userRole === "CIO" && (
                      <button 
                        onClick={() => handleDeleteChecklist(checklist.id.S)} 
                        className="text-red-500 block px-2 py-1 hover:bg-gray-200 w-full text-left"
                      >  
                        Delete
                      </button>
                    )}
                    {userRole === "PO" && (
                      <button 
                        onClick={() => setShowUpdateModal(checklist.id.S)} 
                        className="text-blue-500 block px-2 py-1 hover:bg-gray-200 w-full text-left"
                      >
                        Update Status
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
        <button 
          className="mt-2 p-2 w-full bg-blue-500 text-white rounded hover:bg-blue-600" 
          onClick={() => {
            console.log("✅ Setting newChecklistStatus:", title); // Debugging
            setNewChecklistStatus(title);
            // setShowAddModal(true);
            setTimeout(() => setShowAddModal(true), 100);
          }}
        >
          + Add Item
        </button>
      )}

      {/* Update Status Modal (for PO) */}
      {showUpdateModal && (
        <div className="fixed inset-0 flex justify-center items-center bg-black bg-opacity-50 z-50">
          <div className="bg-white p-6 rounded shadow-xl">
            <h2 className="text-lg font-semibold mb-4">Update Checklist Status</h2>
            <select 
              value={newStatus} 
              onChange={(e) => setNewStatus(e.target.value)} 
              className="border p-2 w-full"
            >
              <option value="">Select Status</option>
              <option value="Todo">Todo</option>
              <option value="In progress">In Progress</option>
              <option value="In review">In Review</option>
              <option value="Done">Done</option>
              <option value="Backlog">Backlog</option>
            </select>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setShowUpdateModal(null)} className="p-2 bg-gray-300 rounded">Cancel</button>
              <button onClick={() => handleUpdateStatus(showUpdateModal)} className="p-2 bg-blue-500 text-white rounded">Update</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Item Modal */}
      {showAddModal && (
        <div className="fixed inset-0 flex justify-center items-center bg-black bg-opacity-50 z-50">
          <div className="bg-white p-6 rounded shadow-xl">
            <input 
              type="text" 
              placeholder="Title" 
              value={newTitle} 
              onChange={(e) => setNewTitle(e.target.value)} 
              className="border p-2 w-full" 
            />
            <textarea 
              placeholder="Description" 
              value={newDescription} 
              onChange={(e) => setNewDescription(e.target.value)} 
              className="border p-2 w-full mt-2">
            </textarea>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setShowAddModal(false)} className="p-2 bg-gray-300 rounded">
                Cancel
              </button>
              <button 
                onClick={() => handleAddChecklist(newChecklistStatus)} 
                className="p-2 bg-blue-500 text-white rounded"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}