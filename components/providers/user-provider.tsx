"use client"

import React, { createContext, useContext, useState, useEffect } from "react"

export interface User {
    id: string
    name: string
    role: "admin" | "cashier" | "manager"
    avatar?: string
    branchId?: string
}

interface UserContextType {
    currentUser: User | null
    token: string | null
    branchId: string | null
    setCurrentUser: (user: User | null) => void
    setToken: (token: string | null) => void
    setBranchId: (id: string | null) => void
    logout: () => void
}

const UserContext = createContext<UserContextType | undefined>(undefined)

export function UserProvider({ children }: { children: React.ReactNode }) {
    const [currentUser, setCurrentUser] = useState<User | null>(null)
    const [token, setToken] = useState<string | null>(null)
    const [branchId, setBranchId] = useState<string | null>(null)

    useEffect(() => {
        // Cargar usuario desde cookies al iniciar
        const cookies = document.cookie.split("; ");
        const userCookie = cookies.find((row) => row.startsWith("user="));
        const tokenCookie = cookies.find((row) => row.startsWith("token="));
        const branchCookie = cookies.find((row) => row.startsWith("branchId="));

        if (userCookie) {
            try {
                const userData = JSON.parse(decodeURIComponent(userCookie.split("=")[1]));
                setCurrentUser(userData);
            } catch (error) {
                console.error("Error parsing user cookie:", error);
            }
        }

        if (tokenCookie) {
            setToken(tokenCookie.split("=")[1]);
        }

        if (branchCookie) {
            setBranchId(branchCookie.split("=")[1]);
        }
    }, [])

    const logout = () => {
        document.cookie = "token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC";
        document.cookie = "user=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC";
        document.cookie = "branchId=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC";
        document.cookie = "auth=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC";
        setCurrentUser(null);
        setToken(null);
        setBranchId(null);
        window.location.href = "/login";
    }

    return (
        <UserContext.Provider value={{ currentUser, token, branchId, setCurrentUser, setToken, setBranchId, logout }}>
            {children}
        </UserContext.Provider>
    )
}

export function useUser() {
    const context = useContext(UserContext)
    if (context === undefined) {
        throw new Error("useUser must be used within a UserProvider")
    }
    return context
}
