"use client";
import { useEffect, useState } from "react";

// API URL
const API_URL = process.env.NEXT_PUBLIC_CHECKLIST_SERVER || "https://checklist.planmeet.net:5002";

export default function ViewSubmittedForms({ token }: { token: string }) {
  const [submittedChecklists, setSubmittedChecklists] = useState<any[]>([]);
  const [showEditModal, setShowEditModal] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [assignedTeam, setAssignedTeam] = useState<string>("");

  // Extract PO's assigned team from the token
  useEffect(() => {
    try {
      const decoded: any = token ? JSON.parse(atob(token.split(".")[1])) : {};
      const teams = decoded?.group?.filter((g: string) => g.startsWith("/dev_team_")).map((g: string) => g.replace("/", ""));
      setAssignedTeam(teams.length > 0 ? teams[0] : ""); // Default to the first team
    } catch (error) {
      console.error("Error extracting assigned team:", error);
    }
  }, [token]);

  // Fetch submitted checklists
  useEffect(() => {
    if (assignedTeam) {
      fetchSubmittedChecklists();
    }
  }, [assignedTeam]);

  const fetchSubmittedChecklists = async () => {
    try {
      const response = await fetch(`${API_URL}/submissions/${assignedTeam}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error("Failed to fetch submitted checklists");

      const data = await response.json();
      setSubmittedChecklists(data);
    } catch (error) {
      console.error("❌ Error fetching submitted checklists:", error);
    }
  };

  // Modify a submitted checklist
  const handleModifyChecklist = async (id: string) => {
    if (!editTitle) {
      alert("Title is required.");
      return;
    }

    try {
      const response = await fetch(`${API_URL}/submissions/${id}/${assignedTeam}/edit`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ title: editTitle, description: editDescription }),
      });

      if (response.ok) {
        setShowEditModal(null);
        fetchSubmittedChecklists(); // Refresh UI
      }
    } catch (error) {
      console.error("Error modifying submitted checklist:", error);
    }
  };

  return (
    <div className="p-4">
      <h2 className="text-xl font-semibold mb-4">Submitted Forms</h2>
      <table className="w-full border-collapse border border-gray-300">
        <thead>
          <tr className="bg-gray-200">
            <th className="border border-gray-300 p-2">Title</th>
            <th className="border border-gray-300 p-2">Description</th>
            <th className="border border-gray-300 p-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {submittedChecklists.length === 0 ? (
            <tr>
              <td colSpan={3} className="text-center p-4">No submitted forms available.</td>
            </tr>
          ) : (
            submittedChecklists.map((checklist) => (
              <tr key={checklist.id.S} className="border border-gray-300">
                <td className="border border-gray-300 p-2">{checklist.title?.S || "No Title"}</td>
                <td className="border border-gray-300 p-2">{checklist.description?.S || "No Description"}</td>
                <td className="border border-gray-300 p-2">
                  <button 
                    onClick={() => {
                      setShowEditModal(checklist.id.S);
                      setEditTitle(checklist.title.S);
                      setEditDescription(checklist.description.S);
                    }} 
                    className="text-yellow-500 px-2 py-1 hover:bg-gray-200"
                  >
                    Modify
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      {/* Edit Modal */}
      {showEditModal && (
        <div className="fixed inset-0 flex justify-center items-center bg-black bg-opacity-50">
          <div className="bg-white p-6 rounded shadow-xl">
            <h2 className="text-lg font-semibold mb-4">Edit Submitted Checklist</h2>
            <input type="text" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="border p-2 w-full" />
            <textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} className="border p-2 w-full mt-2"></textarea>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setShowEditModal(null)} className="p-2 bg-gray-300 rounded">Cancel</button>
              <button onClick={() => handleModifyChecklist(showEditModal)} className="p-2 bg-yellow-500 text-white rounded">Save Changes</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
