"use client"

import React, { createContext, useContext, useState } from "react"

export interface User {
    id: string
    name: string
    role: "admin" | "cashier" | "manager"
    avatar?: string
}

interface UserContextType {
    currentUser: User | null
    setCurrentUser: (user: User | null) => void
}

const UserContext = createContext<UserContextType | undefined>(undefined)

const mockUsers: User[] = [
    { id: "1", name: "Samuel", role: "admin" },
    { id: "2", name: "Maria", role: "cashier" },
    { id: "3", name: "Juan", role: "manager" },
]

export function UserProvider({ children }: { children: React.ReactNode }) {
    // Logic to initialize with a mock admin for now
    const [currentUser, setCurrentUser] = useState<User | null>(mockUsers[0])

    return (
        <UserContext.Provider value={{ currentUser, setCurrentUser }}>
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
