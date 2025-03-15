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
        if(props.users.length !== 0) {
            setUsersAsync(props.users)
        }
    }, [props.users])

    useEffect(() => {
        if (users.length !== 0) {
            gettingAllUserData();
        }
    }, [users]); // Run when `users` changes

    async function gettingAllUserData() {
        for (let user of users) { // Remove `: any`
            try {
                let response = await fetch(`${authServer}/getUserData/`, {
                    method: 'GET',
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ userId: user?.id }) // Fix JSON body format
                });

                if (!response.ok) {
                    throw new Error(`Failed to fetch user data: ${response.status}`);
                }

                let user_data = await response.json(); // Parse JSON

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
                                <div className="w-[30%] h-auto bg-slate-500 flex flex-col">
                                    <div className="">{elem.username}</div>
                                </div>
                            })
                        }
                    </div>
                </div>
            }
        </div>
    );

}