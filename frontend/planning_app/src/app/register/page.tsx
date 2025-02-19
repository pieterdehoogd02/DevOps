import react, { useState, useEffect } from 'react';

function Login() {

    return (
        <div className="relative left-[35%] top-[35%] h-[30%] w-[30%] bg-[#312C2C] bg-opacity-70">
            <div className="absolute left-0 top-0 h-[10%] w-full flex flex-row justify-center items-center text-xl">
                Login
            </div>
            <div className="relative left-0 top-0 h-[60%] w-full flex flex-row justify-center items-center">
                <div className="h-[20%] w-[80%]">
                    <input type="text" >
                        
                    </input>
                </div>
            </div>
        </div>
    );
}