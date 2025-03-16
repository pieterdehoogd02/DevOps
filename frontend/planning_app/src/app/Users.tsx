import react, {useState, useEffect} from "react"

const authServer = process.env.NEXT_PUBLIC_AUTH_SERVER;

export default function Users(props: any) {


    const [users, setUsers]: any[] = useState([]) 
    const [userData, setUserData]: any[] = useState([])

    const setUsersAsync = async (users: any) => {
        setUsers(users)
    }
    
    const setUserDataAsync = async (userData: any) => {
        setUserData(userData)
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
            {userData.length > 0 && 
                <div className="left-[2%] top-[2%] w-[96%] h-auto flex flex-col gap-4">
                    <div className="flex top-0 left-0 indent-[10px] h-auto w-full text-white text-xl font-semibold text-start">CIO(s)</div>
                    <div className="flex h-auto w-full grid-cols-3 gap-x-2 gap-y-2">
                        {
                            userData.map((elem: any) => {
                                // if(userData.r)
                                if(elem.roles && elem.roles.includes())
                                return(
                                    <div className="w-[30%] h-auto bg-slate-500 flex flex-col gap-3 rounded-xl">
                                        <div className="flex w-full flex-row h-[100px]">
                                            <div className="w-[40px] h-[40px] flex items-center">
                                                <img className="w-full h-full" src="./defaultProfile.png"></img>
                                            </div>
                                            <div className="flex w-full text-lg text-black font-semibold indent-[10px] items-center">{elem.user.username}</div>
                                        </div>
                                        <div className="flex flex-col w-full">
                                            <div className="text-sm font-semibold text-black indent-[10px]">Roles</div>
                                            <div className="text-sm font-medium text-white flex flex-row gap-[2px] overflow-x-auto">
                                                {
                                                    elem.roles.map((role: any) => {
                                                        return <div className="text-sm indent-[20px]">{role.name}</div>
                                                    })
                                                }
                                            </div>
                                        </div>
                                        <div className="flex w-full flex-col">
                                            <div className="text-sm font-semibold text-black indent-[10px]">Groups</div>
                                            <div className="flex flex-col text-white w-full gap-[2px] overflow-x-auto">
                                                {
                                                    elem.groups.map((group: any) => {
                                                        return <div className="text-sm font-medium indent-[20px]">{group.name}</div>
                                                    })
                                                }
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        }
                    </div>
                </div>
            }
            
        </div>
    );

}