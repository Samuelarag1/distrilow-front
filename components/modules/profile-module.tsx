"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, ImageIcon, RefreshCw } from "lucide-react";

import { useUser } from "@/components/providers/user-provider";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  buildDefaultAvatarUrl,
  getPresetAvatarOptions,
  resolveUserAvatar,
} from "@/lib/avatar-utils";

function dedupe(values: string[]) {
  return Array.from(new Set(values));
}

export function ProfileModule() {
  const { currentUser, setAvatar } = useUser();
  const { toast } = useToast();

  const defaultAvatar = useMemo(() => {
    if (!currentUser) return buildDefaultAvatarUrl("usuario");
    return buildDefaultAvatarUrl(
      currentUser.name || currentUser.email || currentUser.id
    );
  }, [currentUser]);

  const avatarOptions = useMemo(() => {
    return dedupe([defaultAvatar, ...getPresetAvatarOptions(currentUser)]);
  }, [defaultAvatar, currentUser]);

  const [selectedAvatar, setSelectedAvatar] = useState<string>(defaultAvatar);

  useEffect(() => {
    setSelectedAvatar(resolveUserAvatar(currentUser));
  }, [currentUser]);

  if (!currentUser) {
    return (
      <div className="rounded-lg border p-6 text-sm text-muted-foreground">
        No hay usuario activo.
      </div>
    );
  }

  const handleSaveAvatar = () => {
    setAvatar(selectedAvatar);
    toast({
      title: "Perfil actualizado",
      description: "Tu avatar quedo guardado para este usuario.",
    });
  };

  const handleResetAvatar = () => {
    setAvatar(null);
    setSelectedAvatar(defaultAvatar);
    toast({
      title: "Avatar restablecido",
      description: "Se aplico tu avatar predeterminado.",
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Perfil</h1>
        <p className="text-muted-foreground">
          Configura la foto predeterminada de tu cuenta.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base sm:text-lg">Vista previa</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16 rounded-xl border">
              <AvatarImage src={selectedAvatar} alt={currentUser.name} />
              <AvatarFallback className="rounded-xl">
                {currentUser.name?.substring(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-semibold">{currentUser.name ?? currentUser.email}</p>
              <p className="text-sm text-muted-foreground">{currentUser.email}</p>
              <Badge variant="secondary" className="mt-1 capitalize">
                {currentUser.role}
              </Badge>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={handleSaveAvatar}>Guardar avatar</Button>
            <Button variant="outline" onClick={handleResetAvatar}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Usar predeterminado
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base sm:text-lg">Avatares disponibles</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
            {avatarOptions.map((avatarUrl) => {
              const isSelected = selectedAvatar === avatarUrl;
              return (
                <button
                  key={avatarUrl}
                  type="button"
                  onClick={() => setSelectedAvatar(avatarUrl)}
                  className={`relative rounded-xl border p-2 transition ${
                    isSelected
                      ? "border-primary bg-primary/5 ring-2 ring-primary/40"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <Avatar className="h-14 w-14 rounded-lg">
                    <AvatarImage src={avatarUrl} alt="Avatar" />
                    <AvatarFallback className="rounded-lg">
                      <ImageIcon className="h-4 w-4" />
                    </AvatarFallback>
                  </Avatar>
                  {isSelected && (
                    <span className="absolute right-1 top-1 rounded-full bg-primary p-1 text-primary-foreground">
                      <Check className="h-3 w-3" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
