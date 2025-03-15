import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://checklist.planmeet.net:5002";

function Checklist({ title, assignedTeam, userRole }: { title: string; assignedTeam?: string; userRole: string }) {
  const [checklists, setChecklists] = useState<any[]>([]);

  useEffect(() => {
    const fetchChecklists = async () => {
      try {
        let endpoint = `${API_URL}/checklists`; // Default for CIO

        // ✅ If user is NOT CIO, fetch checklists by assigned team
        if (userRole !== "CIO" && assignedTeam) {
          endpoint = `${API_URL}/checklists/team/${assignedTeam}`;
        }

        const response = await fetch(endpoint);
        const data = await response.json();

        if (!Array.isArray(data)) {
          console.error("Unexpected response format:", data);
          return;
        }

        // ✅ Filter checklists based on status
        const filteredChecklists = data.filter((item: any) => item.status?.S === title);
        setChecklists(filteredChecklists);
      } catch (error) {
        console.error("Error fetching checklists:", error);
      }
    };

    fetchChecklists();
  }, [title, assignedTeam, userRole]); // ✅ Ensure re-fetch when relevant props change

  return (
    <div className="flex flex-col top-[2%] w-[19%] h-[96%] bg-black rounded-xl bg-opacity-30">
      <div className="relative flex left-[5%] w-[90%] top-[1%] h-[5%] flex-row items-center">
        <div
          className={`relative flex top-0 left-0 h-[20px] w-[20px] justify-center items-center rounded-full 
            ${title === "Todo" ? "bg-green-600" 
            : title === "In progress" ? "bg-orange-600"
            : title === "In review" ? "bg-yellow-600" 
            : title === "Done" ? "bg-green-800" 
            : "bg-red-600"
          } `}
        >
          <div className="flex top-0 left-0 w-[15px] h-[15px] justify-center items-center rounded-full bg-black"></div>
        </div>
        <div className="relative flex top-0 left-[5%] h-[1/2] w-[50%] items-center rounded-full font-sans font-medium text-white">
          {title}
        </div>
      </div>
      <div className="relative flex left-[5%] w-[90%] top-[2%] h-[85%] flex-col items-center overflow-y-scroll scrollbar-hide gap-2">
        {checklists.length === 0 ? (
          <div className="text-gray-400 text-sm">No checklists found.</div>
        ) : (
          checklists.map((checklist, index) => (
            <div key={index} className="w-full h-[10%] bg-gray-300 rounded-md flex flex-col p-2">
              <div className="font-bold">{checklist.title?.S || "No Title"}</div>
              <div className="text-sm">{checklist.description?.S || "No Description"}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default Checklist; 
