import Image from "next/image";

export default function Home() {

  return (
    <Dashboard></Dashboard>
  );
}


function Dashboard() {
  return (
    <div className="absolute left-0 top-0 w-full h-full bg-[#166E89]">
      <TopBar></TopBar>
      <div className="relative left-0 top-[2%] h-[90%] flex flex-row">
        <LeftPanel></LeftPanel>
        <div className="relative left-[4%] top-[4%] w-[78%] h-[95%] bg-[#312C2C] bg-opacity-70 rounded-xl"></div>
      </div>
    </div>
  );
}

function TopBar() {
  return (
    <div className="relative top-[2%] left-[2%] h-[6%] w-[96%] bg-[#312C2C] bg-opacity-70 rounded-xl flex flex-row">
        <div className="relative left-[20%] w-[40%] top-0 h-full flex flex-row items-center justify-center">
          <div className="flex flex-row w-[35%] h-full font-sans font-semibold text-white justify-start items-center hover:underline hover:cursor-pointer hover:underline-offset-4">My projects</div>
          <div className="flex flex-row w-[35%]  h-full font-sans font-semibold text-white justify-start items-center hover:underline hover:cursor-pointer hover:underline-offset-4">People</div>
          <div className="flex flex-row w-[30%] h-full font-sans font-semibold text-white justify-start items-center">
            <div className="h-[70%] rounded-md bg-blue-600 w-[50%] flex flex-row justify-center items-center hover:cursor-pointer">Create</div>
          </div>
        </div>
        <div className="absolute left-[88%] top-0 w-[10%] h-full flex flex-row justify-center items-center">
          <div className="relative flex left-0 top-0 w-[50%] h-[50%] justify-center items-center ">
            <img src="./cog.png" className="w-[60%] h-[100%]"></img>
          </div>
          <div className="relative flex left-0 top-0 w-[50%] h-[50%] justify-center items-center ">
            <img src="./ProfilePic.png" className="w-[60%] h-[100%]"></img>
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
