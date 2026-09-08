"use client";

import { useState } from "react";
import { KeyRound, LoaderCircle, LogIn, LogOut, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/components/auth/auth-provider";
import { AuthDialog } from "@/components/auth/auth-dialog";
import { ChangePasswordDialog } from "@/components/auth/change-password-dialog";

function initials(name: string | null, email: string): string {
  if (name) {
    const parts = name.trim().split(/\s+/).slice(0, 2);
    const computed = parts.map((p) => p[0]?.toUpperCase() ?? "").join("");
    return computed || email[0]?.toUpperCase() || "?";
  }
  return email[0]?.toUpperCase() || "?";
}

/**
 * Navbar auth slot:
 * - logged out → "Acceder" button + login/registration dialog
 * - logged in → user dropdown (admin panel link, password change, logout)
 */
export function AuthControls() {
  const { user, loading, logout } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  if (loading) {
    return (
      <div
        aria-hidden="true"
        className="size-9 animate-pulse rounded-full bg-muted"
      />
    );
  }

  if (!user) {
    return (
      <>
        <Button
          type="button"
          size="sm"
          onClick={() => setDialogOpen(true)}
          className="font-semibold shadow-none"
          aria-haspopup="dialog"
        >
          <LogIn className="size-4" aria-hidden="true" />
          Acceder
        </Button>
        <AuthDialog open={dialogOpen} onOpenChange={setDialogOpen} />
      </>
    );
  }

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await logout();
      toast.success("Sesión cerrada.");
    } catch {
      toast.error("No se pudo cerrar la sesión. Inténtalo de nuevo.");
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={`Cuenta de ${user.name ?? user.email}`}
            className="focusable flex h-9 items-center gap-2 rounded-full border border-transparent pr-1 pl-1 transition-colors hover:border-line hover:bg-secondary sm:pr-2.5"
          >
            <Avatar className="size-7">
              <AvatarFallback className="bg-primary text-[11px] font-semibold text-primary-foreground">
                {initials(user.name, user.email)}
              </AvatarFallback>
            </Avatar>
            <span className="hidden max-w-28 truncate text-sm font-medium text-ink lg:inline">
              {user.name ?? user.email.split("@")[0]}
            </span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel className="space-y-1">
            <p className="truncate text-sm font-semibold">{user.name ?? "Mi cuenta"}</p>
            <p className="truncate text-xs font-normal text-muted-foreground">{user.email}</p>
            <div className="flex items-center gap-1.5 pt-1">
              <Badge variant={user.role === "ADMIN" ? "default" : "outline"} className="text-[10px]">
                {user.role === "ADMIN" ? "Administrador" : "Usuario"}
              </Badge>
              {user.role === "ADMIN" ? (
                <ShieldCheck className="size-3.5 text-teal" aria-hidden="true" />
              ) : null}
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {user.role === "ADMIN" ? (
            <DropdownMenuItem asChild>
              <a href="#admin">
                <ShieldCheck aria-hidden="true" />
                Panel de administración
              </a>
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem onSelect={() => setPwOpen(true)}>
            <KeyRound aria-hidden="true" />
            Cambiar contraseña
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" disabled={loggingOut} onSelect={(e) => { e.preventDefault(); void handleLogout(); }}>
            {loggingOut ? (
              <LoaderCircle className="animate-spin" aria-hidden="true" />
            ) : (
              <LogOut aria-hidden="true" />
            )}
            Cerrar sesión
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ChangePasswordDialog open={pwOpen} onOpenChange={setPwOpen} />
    </>
  );
}
