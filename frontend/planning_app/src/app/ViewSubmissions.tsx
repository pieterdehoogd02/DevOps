"use client";

import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_CHECKLIST_SERVER;

export default function ViewSubmissions({ token }: { token: string}) {
    const [submissions, setSubmissions] = useState<any[]>([]);

    // Fetch all submitted checklists
    useEffect(() => {
        const fetchSubmissions = async () => {
            try {
              console.log("📌 Fetching submissions...");
              const response = await fetch(`${API_URL}/submissions`, {
                headers: { Authorization: `Bearer ${token}` },
              });
      
              if (!response.ok) {
                throw new Error("Failed to fetch submissions");
              }
      
              const data = await response.json();
              console.log("✅ Submissions fetched:", data); // Debugging
              setSubmissions(data);
            } catch (error) {
              console.error("Error fetching submissions:", error);
            }
          };

        fetchSubmissions();
    }, [token]);

    return (
        <div className="absolute top-[14%] left-[19%] w-[79%] h-[84%] bg-gray-600 rounded-xl flex flex-col px-[0.67%] bg-opacity-70">
            <h2 className="text-xl font-semibold text-white p-4">Submitted Checklists</h2>

            <div className="overflow-y-auto p-4">
                {submissions.length === 0 ? (
                    <p className="text-white">No submissions found.</p>
                ) : (
                    <table className="w-full text-white border-collapse">
                        <thead>
                            <tr className="border-b">
                                <th className="p-2 text-left">Title</th>
                                <th className="p-2 text-left">Team</th>
                                <th className="p-2 text-left">Submitted At</th>
                            </tr>
                        </thead>
                        <tbody>
                            {submissions.map((submission, index) => (
                                <tr key={index} className="border-b">
                                <td className="p-2">{submission.title?.S}</td>
                                <td className="p-2">{submission.assignedTeam?.S}</td>
                                <td className="p-2">{submission.submittedAt?.S}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}