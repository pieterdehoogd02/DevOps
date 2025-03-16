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
                // let response = await fetch(`${authServer}/getUserData?userId=${encodeURIComponent(user.id)}`, {
                //     method: 'GET',
                //     headers: { 
                //         "Authorization": `Bearer ${props.token}`,
                //         "Content-Type": "application/json"
                //     }, 
                // });

                // if (!response.ok) {
                //     throw new Error(`Failed to fetch user data: ${response.status}`);
                // }
                
                // console.log("response user = " + response.json())
                
                console.log("before request role")

                let responseRole = await fetch(`${authServer}/getUserGroups?userId=${encodeURIComponent(user.id)}`, {
                    method: 'GET',
                    headers: { 
                        "Authorization": `Bearer ${props.token}`,
                        "Content-Type": "application/json"
                    }, 
                });

                if (!responseRole.ok) {
                    throw new Error(`Failed to fetch user data: ${responseRole.status}`);
                }

                console.log("response Role = " + responseRole.json())
                
                let responseGroup = await fetch(`${authServer}/getUserRoles?userId=${encodeURIComponent(user.id)}`, {
                    method: 'GET',
                    headers: { 
                        "Authorization": `Bearer ${props.token}`,
                        "Content-Type": "application/json"
                    }, 
                });

                if (!responseGroup.ok) {
                    throw new Error(`Failed to fetch user data: ${responseGroup.status}`);
                }
                
                console.log("response group = " + responseGroup.json())

                let user_roles = await responseRole.json(); // Parse JSON
                let user_groups = await responseGroup.json(); // Parse JSON

                let user_full = {user, user_groups, user_roles}
                console.log("user data = " + JSON.stringify(user_full))

                setUserDataAsync((prevUserData: any) => [...prevUserData, user_full]);
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
                                return(
                                    <div className="w-[30%] h-auto bg-slate-500 flex flex-col">
                                        <div className="">A</div>
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