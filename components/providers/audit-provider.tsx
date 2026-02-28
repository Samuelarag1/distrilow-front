"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { useUser } from "./user-provider";
import { backendApi } from "@/lib/backend-api";

export type AuditAction =
  | "create"
  | "update"
  | "delete"
  | "login"
  | "logout"
  | "close_cashbox"
  | "adjust_stock";

export interface AuditEvent {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  action: string;
  entityType: string;
  entityId?: string;
  description: string;
  metadata?: any;
}

interface AuditContextType {
  events: AuditEvent[];
  isLoading: boolean;
  error: string | null;
  logEvent: (
    action: AuditAction,
    entityType: string,
    description: string,
    entityId?: string,
    metadata?: any
  ) => void;
  getEventsByDateRange: (start: Date, end: Date) => AuditEvent[];
}

const AuditContext = createContext<AuditContextType | undefined>(undefined);

function normalizeAction(action: string): string {
  return String(action || "update").toLowerCase();
}

function normalizeAudit(log: any): AuditEvent {
  return {
    id: String(log.id),
    timestamp: String(log.createdAt ?? new Date().toISOString()),
    userId: String(log.userId ?? "unknown"),
    userName: String(log.user?.email ?? "Usuario"),
    action: normalizeAction(log.action),
    entityType: String(log.entityType ?? "system"),
    entityId: log.entityId ?? undefined,
    description: `${String(log.action ?? "ACTION")} ${String(log.entityType ?? "ENTITY")}`,
    metadata: log.metadata,
  };
}

export function AuditProvider({ children }: { children: React.ReactNode }) {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { currentUser, token } = useUser();

  useEffect(() => {
    const fetchAudit = async () => {
      if (!token || currentUser?.role !== "admin") {
        setEvents([]);
        return;
      }

      setIsLoading(true);
      setError(null);
      try {
        const rows = await backendApi.audit.list();
        setEvents(rows.map(normalizeAudit));
      } catch (err: any) {
        setError(err?.message || "No se pudo cargar auditoria.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchAudit();
  }, [token, currentUser?.role]);

  const logEvent = (
    action: AuditAction,
    entityType: string,
    description: string,
    entityId?: string,
    metadata?: any
  ) => {
    if (!currentUser) return;

    const newEvent: AuditEvent = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      userId: currentUser.id,
      userName: currentUser.name ?? currentUser.email ?? "Usuario",
      action,
      entityType,
      entityId,
      description,
      metadata,
    };

    setEvents((prev) => [newEvent, ...prev]);
  };

  const getEventsByDateRange = (start: Date, end: Date) => {
    return events.filter((event) => {
      const date = new Date(event.timestamp);
      return date >= start && date <= end;
    });
  };

  return (
    <AuditContext.Provider value={{ events, isLoading, error, logEvent, getEventsByDateRange }}>
      {children}
    </AuditContext.Provider>
  );
}

export function useAudit() {
  const context = useContext(AuditContext);
  if (context === undefined) {
    throw new Error("useAudit must be used within an AuditProvider");
  }
  return context;
}
