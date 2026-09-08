"use client";

import { useState, type FormEvent } from "react";
import { LoaderCircle, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ChangePasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Self-service password change. The server verifies the current password,
 * re-hashes with a fresh unique Argon2id salt and revokes all other sessions.
 */
export function ChangePasswordDialog({ open, onOpenChange }: ChangePasswordDialogProps) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setCurrent("");
    setNext("");
    setConfirm("");
    setError(null);
    setPending(false);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (next !== confirm) {
      setError("Las nuevas contraseñas no coinciden.");
      return;
    }
    if (next === current) {
      setError("La nueva contraseña debe ser distinta de la actual.");
      return;
    }
    setPending(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "No se pudo cambiar la contraseña.");
        return;
      }
      onOpenChange(false);
      toast.success("Contraseña actualizada. Las demás sesiones fueron cerradas.");
    } catch {
      setError("Error de conexión. Inténtalo de nuevo.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) reset();
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-left">Cambiar contraseña</DialogTitle>
          <DialogDescription className="text-left">
            Se aplicará un hash Argon2id con una sal nueva y única, y se cerrarán tus
            otras sesiones activas.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="pw-current">Contraseña actual</Label>
            <Input
              id="pw-current"
              type="password"
              autoComplete="current-password"
              required
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pw-new">Nueva contraseña</Label>
            <Input
              id="pw-new"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={next}
              onChange={(e) => setNext(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Mínimo 8 caracteres, con mayúscula, minúscula y un número.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="pw-confirm">Confirmar nueva contraseña</Label>
            <Input
              id="pw-confirm"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </div>

          {error ? (
            <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          ) : null}

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={pending} className="font-semibold">
              {pending ? (
                <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <KeyRound className="size-4" aria-hidden="true" />
              )}
              {pending ? "Guardando…" : "Guardar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
