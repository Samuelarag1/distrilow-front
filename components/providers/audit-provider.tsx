"use client"

import React, { createContext, useContext, useState, useEffect } from "react"
import { useUser } from "./user-provider"

export type AuditAction = "create" | "update" | "delete" | "login" | "logout" | "close_cashbox" | "adjust_stock"

export interface AuditEvent {
    id: string
    timestamp: string
    userId: string
    userName: string
    action: AuditAction
    entityType: string
    entityId?: string
    description: string
    metadata?: any
}

interface AuditContextType {
    events: AuditEvent[]
    logEvent: (action: AuditAction, entityType: string, description: string, entityId?: string, metadata?: any) => void
    getEventsByDateRange: (start: Date, end: Date) => AuditEvent[]
}

const AuditContext = createContext<AuditContextType | undefined>(undefined)

export function AuditProvider({ children }: { children: React.ReactNode }) {
    const [events, setEvents] = useState<AuditEvent[]>([])
    const { currentUser } = useUser()

    const logEvent = (action: AuditAction, entityType: string, description: string, entityId?: string, metadata?: any) => {
        if (!currentUser) return

        const newEvent: AuditEvent = {
            id: Math.random().toString(36).substr(2, 9),
            timestamp: new Date().toISOString(),
            userId: currentUser.id,
            userName: currentUser.name,
            action,
            entityType,
            entityId,
            description,
            metadata
        }

        setEvents(prev => [newEvent, ...prev])
    }

    const getEventsByDateRange = (start: Date, end: Date) => {
        return events.filter(e => {
            const date = new Date(e.timestamp)
            return date >= start && date <= end
        })
    }

    // Example initial log
    useEffect(() => {
        if (events.length === 0 && currentUser) {
            logEvent("login", "system", "Inicio de sesión de administrador")
        }
    }, [currentUser])

    return (
        <AuditContext.Provider value={{ events, logEvent, getEventsByDateRange }}>
            {children}
        </AuditContext.Provider>
    )
}

export function useAudit() {
    const context = useContext(AuditContext)
    if (context === undefined) {
        throw new Error("useAudit must be used within an AuditProvider")
    }
    return context
}
