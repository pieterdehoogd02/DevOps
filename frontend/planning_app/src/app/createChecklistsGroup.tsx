import react from 'react';

export default function Checklists(props: any) {    
    return (
        <div className="absolute top-[14%] left-[19%] w-[79%] h-[84%] bg-gray-600 rounded-xl flex flex-row justify-between items-center px-[0.67%] bg-opacity-70">
            <Checklist title={"Todo"}></Checklist>
            <Checklist title={"In progress"}></Checklist>
            <Checklist title={"In review"}></Checklist>
            <Checklist title={"Done"}></Checklist>
            <Checklist title={"Backlog"}></Checklist>
        </div>
    );
}

function Checklist(props : any) {
    return (

        <div className="flex flex-col top-[2%] w-[19%] h-[96%] bg-black rounded-xl bg-opacity-30">
            <div className="relative flex left-[5%] w-[90%] top-[1%] h-[5%] flex-row items-center">
                <div className={`relative flex top-0 left-0 h-[20px] w-[20px] justify-center items-center rounded-full 
                    ${ props.title === 'Todo' ? 'bg-green-600' : props.title === 'In progress' ? 'bg-orange-600' 
                     : props.title ===  'In review' ? 'bg-yellow-600' : props.title === 'Done' ? 'bg-green-800' : 'bg-red-600'} `}>

                        <div className="flex top-0 left-0 w-[15px] h-[15px] justify-center items-center rounded-full bg-black "></div>
                     </div>
                <div className="relative flex top-0 left-[5%] h-[1/2] w-[50%] items-center rounded-full font-sans font-medium text-white">{props.title}</div>
            </div>
            <div className="flex flex-col justify-center items-center w-[90%] h-full relative">
                {/* Plus Icon and Add Item Text Wrapper */}
                <div className="absolute top-[93%] left-[10%] transform w-[90%] h-[5%] flex justify-between items-center hover:bg-gray-500 rounded-md" 
                    onClick={() => {}}> {/* add checklists */}
                    {/* Plus Icon */}
                    <div className="w-[10%] h-full flex justify-center items-center">
                        <img src="./plus_icon.png" className="h-[60%] w-auto flex flex-row justify-center items-center" alt="plus icon" />
                    </div>

                    {/* Add Item Text */}
                    <div className="w-[90%] h-full flex justify-start items-center indent-[10px] hover:cursor-pointer">
                        Add item
                    </div>
                </div>
            </div>
        </div>

    );
}