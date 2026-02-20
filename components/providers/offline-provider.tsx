
"use client";

import React, { createContext, useContext, useEffect } from "react";
import { useNetworkStatus } from "@/hooks/use-network";
import { syncPendingActions } from "@/lib/sync-manager";
import { useToast } from "@/hooks/use-toast";

interface OfflineContextType {
    isOnline: boolean;
}

const OfflineContext = createContext<OfflineContextType>({ isOnline: true });

export function OfflineProvider({ children }: { children: React.ReactNode }) {
    const isOnline = useNetworkStatus();
    const { toast } = useToast();

    useEffect(() => {
        if (isOnline) {
            syncPendingActions().then(() => {
                // Optionally toast "Sync complete"
            });

            const interval = setInterval(() => {
                syncPendingActions();
            }, 30000); // Try sync every 30s

            return () => clearInterval(interval);
        }
    }, [isOnline]);

    useEffect(() => {
        if (!isOnline) {
            toast({
                title: "Estás Offline",
                description: "Tus cambios se guardarán localmente y se sincronizarán cuando vuelva la conexión.",
                variant: "default",
                duration: 5000,
            });
        } else {
            toast({
                title: "Conexión Restaurada",
                description: "Sincronizando datos...",
                variant: "default",
                duration: 3000,
            });
        }
    }, [isOnline, toast]);

    return (
        <OfflineContext.Provider value={{ isOnline }}>
            {children}
            {!isOnline && (
                <div className="fixed bottom-4 right-4 z-50 bg-yellow-500 text-white px-4 py-2 rounded-full shadow-lg text-sm font-medium animate-pulse">
                    Modo Offline
                </div>
            )}
        </OfflineContext.Provider>
    );
}

export const useOffline = () => useContext(OfflineContext);
