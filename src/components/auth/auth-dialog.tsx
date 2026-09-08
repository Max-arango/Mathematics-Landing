"use client";

import { useState, type FormEvent } from "react";
import { LoaderCircle, LogIn, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AuthRequestError, useAuth } from "@/components/auth/auth-provider";

interface AuthDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function errorText(err: unknown): string {
  if (err instanceof AuthRequestError) {
    if (err.retryAfterSeconds && err.retryAfterSeconds > 0) {
      const minutes = Math.ceil(err.retryAfterSeconds / 60);
      return `${err.message} Reintenta en ~${minutes} min.`;
    }
    return err.message;
  }
  return "Error de conexión. Inténtalo de nuevo.";
}

/**
 * Login / registration dialog (single "apartado de login", Spanish UI).
 * On success the session cookie is already set by the server.
 */
export function AuthDialog({ open, onOpenChange }: AuthDialogProps) {
  const { login, register } = useAuth();
  const [tab, setTab] = useState<"login" | "register">("login");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");

  function reset() {
    setError(null);
    setPending(false);
  }

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const user = await login(loginEmail.trim(), loginPassword);
      onOpenChange(false);
      toast.success(
        user.role === "ADMIN"
          ? "Sesión iniciada como administrador."
          : `Bienvenido de nuevo${user.name ? `, ${user.name}` : ""}.`,
      );
    } catch (err) {
      setError(errorText(err));
    } finally {
      setPending(false);
    }
  }

  async function handleRegister(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const name = regName.trim();
      const user = await register(regEmail.trim(), name.length >= 2 ? name : undefined, regPassword);
      onOpenChange(false);
      toast.success(`Cuenta creada${user.name ? `, ${user.name}` : ""}. ¡Bienvenido!`);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <p className="mono-label text-muted-foreground">Acceso a la plataforma</p>
          <DialogTitle className="text-left text-xl font-semibold tracking-tight">
            Inicia sesión en <span className="math text-primary">Mathematics Simulator</span>
          </DialogTitle>
          <DialogDescription className="text-left">
            Tus credenciales viajan cifradas y tu contraseña se guarda con Argon2id.
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={tab}
          onValueChange={(v) => {
            setTab(v as "login" | "register");
            setError(null);
          }}
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login">Iniciar sesión</TabsTrigger>
            <TabsTrigger value="register">Crear cuenta</TabsTrigger>
          </TabsList>

          {/* ---- Login ---- */}
          <TabsContent value="login">
            <form onSubmit={handleLogin} className="mt-2 space-y-4" noValidate>
              <div className="space-y-2">
                <Label htmlFor="login-email">Correo electrónico</Label>
                <Input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  placeholder="tu@correo.com"
                  required
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="login-password">Contraseña</Label>
                <Input
                  id="login-password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  required
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                />
              </div>

              {error ? (
                <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </p>
              ) : null}

              <Button type="submit" className="w-full font-semibold" disabled={pending}>
                {pending ? (
                  <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <LogIn className="size-4" aria-hidden="true" />
                )}
                {pending ? "Verificando…" : "Entrar"}
              </Button>
            </form>
          </TabsContent>

          {/* ---- Register ---- */}
          <TabsContent value="register">
            <form onSubmit={handleRegister} className="mt-2 space-y-4" noValidate>
              <div className="space-y-2">
                <Label htmlFor="reg-name">
                  Nombre <span className="text-muted-foreground">(opcional)</span>
                </Label>
                <Input
                  id="reg-name"
                  type="text"
                  autoComplete="name"
                  placeholder="Ada Lovelace"
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reg-email">Correo electrónico</Label>
                <Input
                  id="reg-email"
                  type="email"
                  autoComplete="email"
                  placeholder="tu@correo.com"
                  required
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reg-password">Contraseña</Label>
                <Input
                  id="reg-password"
                  type="password"
                  autoComplete="new-password"
                  placeholder="••••••••"
                  required
                  minLength={8}
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Mínimo 8 caracteres, con mayúscula, minúscula y un número. Se guarda con
                  Argon2id y una sal única.
                </p>
              </div>

              {error ? (
                <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </p>
              ) : null}

              <Button type="submit" className="w-full font-semibold" disabled={pending}>
                {pending ? (
                  <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <UserPlus className="size-4" aria-hidden="true" />
                )}
                {pending ? "Creando cuenta…" : "Crear cuenta"}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
