import react, {useState, useEffect, useRef} from "react"

const authServer = process.env.NEXT_PUBLIC_AUTH_SERVER;

export default function Users(props: any) {


    const [users, setUsers]: any[] = useState([]) 
    const [userData, setUserData]: any[] = useState([])
    const [clickedDropdown, setClickDropdown] = useState(false)
    const [userToChange, setUserToChange] = useState(null)
    const prevUserChanged = useRef(null)
    const [assignTeam, setAssignTeam] = useState(false)
    const [assignRole, setAssignRole] = useState(false)

    const setUsersAsync = async (users: any) => {
        setUsers(users)
    }
    
    const setUserDataAsync = async (userData: any) => {
        setUserData(userData)
    }

    const setUserToChangeAsync = async (userData: any) => {
        setUserToChange(userData)
    }

    const setClickDropdownAsync = async () => {
        setClickDropdown(!clickedDropdown)
    }
    
    const setClickDropdownAsync2 = async (val: boolean) => {
        setClickDropdown(val)
    }

    const setAssignTeamAsync = async (val: boolean) => {
        setAssignTeam(val)
    }
    
    const setAssignRoleAsync = async (val: boolean) => {
        setAssignRole(val)
    }


    useEffect(() => {
        console.log("users changed")
        if(props.users.length !== 0) {
            console.log("changing users state = "+ JSON.stringify(props.users))
            setUsersAsync(props.users)
        }
    }, [props.users])

    useEffect(() => {
        if (users.length !== 0) {
            console.log("changing user data = " + JSON.stringify(users))
            gettingAllUserData();
        }
    }, [users]); // Run when `users` changes

    async function gettingAllUserData() {
        for (let user of users) { // Remove `: any`
            try {
                console.log("user id = " + user.id)
                let response = await fetch(`${authServer}/getUserData?userId=${encodeURIComponent(user.id)}`, {
                    method: 'GET',
                    headers: { 
                        "Authorization": `Bearer ${props.token}`,
                        "Content-Type": "application/json"
                    }, 
                });

                if (!response.ok) {
                    throw new Error(`Failed to fetch user data: ${response.status}`);
                }
                
                let user_data = await response.json(); // Parse JSON

                console.log("response user = " + JSON.stringify(user_data))
                
                setUserDataAsync((prevUserData: any) => [...prevUserData, user_data]);
            } catch (error) {
                console.error("Error fetching user data:", error);
            }
        }
    }

    return (
        <div className="absolute top-[14%] left-[19%] w-[79%] h-[84%] bg-gray-600 rounded-xl flex flex-col px-[0.67%] bg-opacity-70 overflow-y-scroll">
            {userToChange !== prevUserChanged && assignTeam && <div className="absolute inset-0 flex items-center justify-center z-10 backdrop">
                    <AssignTeam token={props.token} userToChange={userToChange} setClickDropdownAsync={setClickDropdownAsync} setClickDropdownAsync2={setClickDropdownAsync2} 
                        clickedDropdown={clickedDropdown} setAssignTeam={setAssignTeam}/>
                </div>}
            {userToChange !== prevUserChanged && assignRole && <div className="absolute inset-0 flex items-center justify-center z-10">
                    <AssignRole userToChange={userToChange} setClickDropdownAsync={setClickDropdownAsync} setClickDropdownAsync2={setClickDropdownAsync2}
                        token={props.token} clickedDropdown={clickedDropdown} setAssignRole={setAssignRole}/>
                </div>}
            {userData.length > 0 && 
                <div className={`${(assignTeam || assignRole) ? 'shadow-lg' : 'shadow-none'} relative w-full h-full`}>
                    <div className="left-[2%] top-[2%] w-[96%] h-auto flex flex-col gap-4">
                        <div className="flex top-0 left-0 indent-[10px] h-auto w-full text-white text-xl font-semibold text-start">CIO(s)</div>
                        <div className="flex h-auto w-full grid-cols-3 gap-x-2 gap-y-2">
                            {
                                userData.map((elem: any, idx: number) => {
                                    // if(userData.r)
                                    let user_cio = false
                                    if(elem.roles){
                                        for(let role of elem.roles){
                                            if(role.name.includes("CIO")) user_cio = true
                                        }
                                    }
                                    if(!user_cio) return <div></div>;
                                    return <UserData elem={elem} userToChange={userToChange} setUserToChangeAsync={setUserToChangeAsync} prevUserChanged={prevUserChanged}
                                        setAssignTeamAsync={setAssignTeamAsync} setAssignRoleAsync={setAssignRoleAsync}></UserData>
                                })
                            }
                        </div>
                        <div className="flex top-0 left-0 indent-[10px] h-auto w-full text-white text-xl font-semibold text-start">PO(s)</div>
                        <div className="flex h-auto w-full grid-cols-3 gap-x-2 gap-y-2">
                            {
                                userData.map((elem: any, idx: number) => {
                                    // if(userData.r)
                                    let user_po = false
                                    if(elem.roles){
                                        for(let role of elem.roles){
                                            if(role.name.includes("PO")) user_po = true
                                        }
                                    }
                                    if(!user_po) return <div></div>;
                                    return <UserData elem={elem} userToChange={userToChange} setUserToChangeAsync={setUserToChangeAsync} prevUserChanged={prevUserChanged}
                                        setAssignTeamAsync={setAssignTeamAsync} setAssignRoleAsync={setAssignRoleAsync}></UserData>
                                })
                            }
                        </div>
                        <div className="flex top-0 left-0 indent-[10px] h-auto w-full text-white text-xl font-semibold text-start">Devs</div>
                        <div className="flex h-auto w-full grid-cols-3 gap-x-2 gap-y-2">
                            {
                                userData.map((elem: any, idx: number) => {
                                    // if(userData.r)
                                    let user_dev = false
                                    if(elem.roles){
                                        for(let role of elem.roles){
                                            if(role.name.includes("Dev")) user_dev = true
                                        }
                                    }
                                    if(!user_dev) return <div></div>;
                                    return <UserData elem={elem} userToChange={userToChange} setUserToChangeAsync={setUserToChangeAsync} prevUserChanged={prevUserChanged}
                                        setAssignTeamAsync={setAssignTeamAsync} setAssignRoleAsync={setAssignRoleAsync}></UserData>
                                })
                            }
                        </div>
                    </div>
                </div>
            }
            
        </div>
    );

    function UserData(props : any) {
        return (
            <div className="w-[30%] h-auto bg-black bg-opacity-30 flex flex-col gap-3 rounded-xl">
                <div className="flex w-full flex-row h-[100px]">
                    <div className="w-[20%] h-[40px] flex flex-row items-center justify-center">
                        <img className="w-full h-full object-cover" src="./defaultProfile.png"></img>
                    </div>
                    <div className="flex w-[50%] text-lg text-white font-semibold indent-[10px] items-center font-sans">{props.elem.user.username}</div>
                    <div className="flex w-[40%] h-full flex-col justify-center gap-[10px]">
                        <div className="flex h-[40px] w-[95%] bg-green-700 text-base text-white font-sans 
                            rounded-lg justify-center items-center font-semibold hover:cursor-pointer" 
                            onClick={() => {
                                props.prevUserChanged.current = props.elem; 
                                props.setUserToChangeAsync(props.elem)
                                props.setAssignRoleAsync(true)
                            }}>Assign role</div>
                        <div className="flex h-[40px] w-[95%] bg-orange-600 text-base text-white font-sans 
                        rounded-lg flex-row justify-center items-center font-semibold hover:cursor-pointer" 
                        onClick={() => {
                            props.prevUserChanged.current = props.elem; 
                            props.setUserToChangeAsync(props.elem)
                            props.setAssignTeamAsync(true)
                        }}>Assign team</div>
                    </div>
                </div>
                <div className="flex flex-col w-full">
                    <div className="text-sm font-semibold text-white indent-[10px] font-sans">Roles</div>
                    <div className="text-sm font-medium text-gray-500 flex flex-row gap-[2px] overflow-x-auto">
                        {
                            props.elem.roles.map((role: any) => {
                                return <div className="text-sm indent-[20px]">{role.name}</div>
                            })
                        }
                    </div>
                </div>
                <div className="flex w-full flex-col">
                    <div className="text-sm font-semibold text-white indent-[10px] font-sans">Groups</div>
                    <div className="flex flex-col text-gray-500 w-full gap-[2px] overflow-x-auto">
                        {
                            props.elem.groups.map((group: any) => {
                                return <div className="text-sm font-medium indent-[20px] font-sans">{group.name}</div>
                            })
                        }
                    </div>
                </div>
            </div>
        );
    }
}

function AssignTeam(props: any) {

    const [chosenTeam, chooseTeam] : any = useState(null)
    const [groupsChosen, setGroupsChosen]  = useState<boolean[]>([]);
    const prevChosenTeam = useRef(null)
    const [clickedDropdown, setClickDropdown] = useState(false)
    const [groups, setGroups] = useState([])
    const dropdownRef = useRef<HTMLDivElement>(null);

    const chooseTeamAsync = async (team: any) => {
        chooseTeam(team)
    }
    
    const setClickDropdownAsync = async (val: boolean) => {
        setClickDropdown(val)
    }

    const setGroupsAsync = async (groups: any) => {
        setGroups(groups)
    }
    
    const setGroupsChosenAsync = async (groups: any) => {
        setGroupsChosen(groups)
    }

    const setGroupChosenAsync = async (idx: number) => {
        console.log("in setGroupsChosenAsync")
        setGroupsChosenAsync((prevState : any) => 
            prevState.map((elem : boolean, idx2 : number) => idx === idx2 ? !elem : elem)
        );
        console.log("after setGroupsChosenAsync")
    }

    useEffect(() => {
        console.log("user to change = " + JSON.stringify(props.userToChange))
        console.log("user to change = " + JSON.stringify(props.userToChange))
        console.log("user to change = " + JSON.stringify(props.userToChange))
    }, [props.userToChange])

    useEffect(() => {
        if (prevChosenTeam.current !== chosenTeam) {
            prevChosenTeam.current = chosenTeam;
            assignTeam();
        }
    }, [chosenTeam])

    // Detect clicks outside dropdown
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                props.setClickDropdownAsync(false); // Close dropdown if clicked outside
            }
        }

        if (clickedDropdown) {
            document.addEventListener("mousedown", handleClickOutside);
        }

        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [clickedDropdown]);

    async function fetchGroups() {
        try{
            console.log("In fetch groups")
            let response = await fetch(`${authServer}/groups`, {
                method: 'GET',
                headers: { 
                    "Authorization": `Bearer ${props.token}`,
                    "Content-Type": "application/json"
                }, 
            });

            let fetchedGroups = await response.json()
            console.log("groups = " + JSON.stringify(fetchedGroups))
            
            await setGroupsAsync(fetchedGroups.groups)
            setGroupsChosen(new Array(fetchedGroups.groups.length).fill(false));
        } catch(err) {
            console.error("Error: " + JSON.stringify(err))
        }
    }

    
    async function assignTeam() {
        try{
            console.log("In assign teams")
            let response = await fetch(`${authServer}/assign-team`, {
                method: 'POST',
                headers: { 
                    "Authorization": `Bearer ${props.token}`,
                    "Content-Type": "application/json",
                }, 
                body: JSON.stringify({ userId: props.userToChange.id, teamName: chosenTeam })
            });

            if(!response.ok){
                console.log("Could not assign team to user: " + response.status)
            }
        }catch(err){
            console.error("Error: " + JSON.stringify(err))
        }
    }


    return (
        <div className="absolute bg-slate-200 w-[20%] h-[20%] flex flex-col gap-[20px] left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 rounded-md">
            {/* Header */}
            <div className="h-[20%] w-full flex flex-row justify-center items-center">
                <div className="text-black text-base font-semibold">
                    Assign {props.userToChange.username} to team..
                </div>
            </div>

            {/* Dropdown Container */}
            <div ref={dropdownRef} className="relative h-[50%] w-full flex flex-col justify-center items-center">
                {/* Dropdown Trigger (Centered) */}
                <div
                    className="flex w-[60%] h-[50px] border-2 rounded-md bg-slate-500 border-black text-white 
                    flex-row justify-center items-center cursor-pointer"
                    onClick={async () => {
                        await setClickDropdownAsync(!clickedDropdown);
                        if (groups.length === 0) await fetchGroups();
                    }}
                >
                    {chosenTeam ? chosenTeam.name : "Select a team..."}
                </div>

                {/* Dropdown List (Centered) */}
                {clickedDropdown && (
                    <div className="relative h-[200%] w-[60%] border-2 rounded-md bg-slate-500 border-black text-white 
                    overflow-y-scroll flex flex-col items-center">
                        {groups.map((elem: any, idx: number) => (
                            <div
                                key={idx}
                                className={`w-full h-[2/3] flex flex-row justify-center items-center bg-transparent border-2 border-black 
                                hover:bg-slate-600 cursor-pointer 
                                ${idx === 0 ? "rounded-t-md" : idx === groups.length - 1 ? "rounded-b-md" : "rounded-none"}`}
                                onClick={async () => {
                                    await chooseTeamAsync(elem);
                                    await setClickDropdownAsync(false);
                                }}
                            >
                                {!groupsChosen[idx] && <div className="flex w-full h-full flex-row justify-center hover:cursor-pointer" onClick={() => {setGroupChosenAsync(idx)}}>{elem.name}</div>}
                                {groupsChosen[idx] && <div className="flex w-[80%] h-full flex-row justify-center hover:cursor-pointer" onClick={() => {setGroupChosenAsync(idx)}}>{elem.name}</div>}
                                {groupsChosen[idx] && <div className="flex w-[20%] h-full flex-row justify-center items-center hover:cursor-pointer" onClick={() => {setGroupChosenAsync(idx)}}>
                                    <img src="./tick.png" className="w-full h-[80%] flex flex-row justify-center items-center"></img>
                                </div>}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}


function AssignRole(props: any) {

    const [chosenRole, chooseRole] : any = useState(null)
    const [clickedDropdown, setClickDropdown] = useState(false)
    const [roles, setRoles] = useState([])
    const ref = useRef(null);

    const chooseRoleAsync = async (team: any) => {
        chooseRole(team)
    }
    
    const setClickDropdownAsync = async (val: boolean) => {
        setClickDropdown(val)
    }

    const setRolesAsync = async (groups: any) => {
        setRoles(groups)
    }


    async function fetchRoles() {
        let response = await fetch(`${authServer}/roles`, {
            method: 'GET',
            headers: { 
                "Authorization": `Bearer ${props.token}`,
                "Content-Type": "application/json"
            }, 
        });

        let fetchedRoles = await response.json()
        console.log("roles = " + JSON.stringify(fetchedRoles))
        
        await setRolesAsync(fetchedRoles.roles)
    }

    return (
        <div className="fixed bg-slate-200 w-[30%] h-[30%] flex-col gap-[20px] left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2">
            <div className="h-[20%] w-full flex flex-row justify-center items-center">
                <div className="text-black text-base font-semibold">Assign {props.userToChange.name} to team..</div>
            </div>
            <div ref={ref} className="relative h-[50%] w-full flex flex-col justify-center items-center">
                {chosenRole === null && <div className="flex w-[60%] h-[50px] border-2 rounded-md bg-slate-500 border-black text-white 
                    flex-row justify-center items-center" onClick={async () => {
                    await setClickDropdownAsync(!clickedDropdown); if(roles.length === 0) await fetchRoles()}}>
                    Select a team...
                </div>}
                {chosenRole !== null && <div className="flex w-[60%] h-[50px] border-2 rounded-md bg-slate-500 border-black text-white 
                    flex-row justify-center items-center" 
                    onClick={async () => {await setClickDropdownAsync(!clickedDropdown); if(roles.length === 0) await fetchRoles()}}>
                    {chosenRole.name}
                </div>}
                {
                    clickedDropdown === true && 
                    <div className="relative flex w-full h-[200%] border-2 rounded-md bg-slate-500 border-black text-white overflow-y-scroll flex-col justify-center items-center" onClick={() => {}}>
                        {
                            roles.map((elem: any, idx: number) => {
                                return <div className="bg-transparent w-full h-[2/3] text-white flex flex-row justify-center items-center" 
                                    onClick={async () => {await chooseRoleAsync(elem); setClickDropdownAsync(!clickedDropdown)}}>
                                        {elem.name}

                                    </div>
                            })
                        }
                    </div>
                }
            </div>
            {/* <div className="relative flex flex-row w-full h-[30%]">
                <div className=""
            </div> */}
        </div>
    );
}