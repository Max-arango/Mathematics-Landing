"use client";

/**
 * AdminDashboard — panel de administración (solo UI, en español).
 *
 * Se autoabastece de datos contra la API de administración (contrato en
 * ./admin-types.ts) y gestiona: métricas generales, CRUD de usuarios,
 * permisos granulares y auditoría de intentos de acceso.
 *
 * Estilo: laboratorio matemático del landing — tokens semánticos
 * (bg-card / text-muted-foreground / …), kickers `mono-label` y acentos
 * serif `math`. Seguro en modo oscuro sin overrides `dark:`.
 */

import {
  Activity,
  ChevronDown,
  Ellipsis,
  KeyRound,
  LoaderCircle,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  TriangleAlert,
  UserCheck,
  UserPlus,
  Users,
  type LucideIcon,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

import {
  ApiError,
  EMAIL_PATTERN,
  MIN_PASSWORD_LENGTH,
  PERMISSION_CATALOG,
  ROLE_OPTIONS,
  apiFetch,
  attemptReasonLabel,
  formatDate,
  formatDateTime,
  formatNumber,
  getErrorMessage,
  normalizeAttempts,
  normalizeStats,
  normalizeUser,
  normalizeUsers,
  userInitials,
  type AdminRole,
  type AdminStats,
  type AdminUser,
  type AttemptsPayload,
  type LoginAttempt,
  type OkPayload,
  type OverviewPayload,
  type UserMutationPayload,
  type UsersPayload,
} from "./admin-types";

type LoadStatus = "loading" | "ready" | "error";

interface CreateUserPayload {
  email: string;
  name?: string;
  password: string;
  role: AdminRole;
}

/* --------------------------------------------------------------------------
 * Componente principal
 * ------------------------------------------------------------------------ */

export function AdminDashboard() {
  const [status, setStatus] = useState<LoadStatus>("loading");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [attempts, setAttempts] = useState<LoginAttempt[]>([]);
  const [attemptsNote, setAttemptsNote] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isRefreshingAttempts, setIsRefreshingAttempts] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [passwordTarget, setPasswordTarget] = useState<AdminUser | null>(null);
  const [savingPassword, setSavingPassword] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [pendingPermissionIds, setPendingPermissionIds] = useState<ReadonlySet<string>>(
    () => new Set<string>(),
  );

  const loadAll = useCallback(async () => {
    const [overview, usersResult, attemptsResult] = await Promise.allSettled([
      apiFetch<OverviewPayload>("/api/admin/overview"),
      apiFetch<UsersPayload>("/api/admin/users"),
      apiFetch<AttemptsPayload>("/api/admin/login-attempts?limit=50"),
    ]);

    if (overview.status === "fulfilled" && usersResult.status === "fulfilled") {
      setStats(normalizeStats(overview.value.stats));
      setUsers(normalizeUsers(usersResult.value.users));

      if (attemptsResult.status === "fulfilled") {
        setAttempts(normalizeAttempts(attemptsResult.value.attempts));
        setAttemptsNote(null);
      } else if (Array.isArray(overview.value.recentAttempts)) {
        setAttempts(normalizeAttempts(overview.value.recentAttempts));
        setAttemptsNote(
          "No se pudo cargar el historial completo; se muestran los intentos recientes del resumen.",
        );
      } else {
        setAttempts([]);
        setAttemptsNote(
          getErrorMessage(attemptsResult.reason, "No se pudo cargar el registro de intentos de acceso."),
        );
      }
      setLoadError(null);
      setStatus("ready");
      return;
    }

    const failed =
      overview.status === "rejected"
        ? overview.reason
        : usersResult.status === "rejected"
          ? usersResult.reason
          : null;
    setLoadError(getErrorMessage(failed, "Ocurrió un error inesperado al cargar los datos del panel."));
    setStatus("error");
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await loadAll();
    } finally {
      setIsRefreshing(false);
    }
  }, [loadAll]);

  /* Revalidación silenciosa de métricas tras una mutación exitosa. */
  const refreshStats = useCallback(async () => {
    try {
      const data = await apiFetch<OverviewPayload>("/api/admin/overview");
      setStats(normalizeStats(data.stats));
    } catch {
      /* Silencioso: las métricas se sincronizan en el próximo refresco. */
    }
  }, []);

  const handleRefreshAttempts = useCallback(async () => {
    setIsRefreshingAttempts(true);
    try {
      const data = await apiFetch<AttemptsPayload>("/api/admin/login-attempts?limit=50");
      setAttempts(normalizeAttempts(data.attempts));
      setAttemptsNote(null);
    } catch (error) {
      toast.error(getErrorMessage(error, "No se pudieron actualizar los intentos de acceso."));
    } finally {
      setIsRefreshingAttempts(false);
    }
  }, []);

  const patchUser = useCallback(
    async (id: string, body: Record<string, unknown>): Promise<AdminUser> => {
      const data = await apiFetch<UserMutationPayload>(`/api/admin/users/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      const user = normalizeUser(data.user);
      if (user === null) {
        throw new ApiError(500, "La respuesta del servidor no tiene el formato esperado.");
      }
      return user;
    },
    [],
  );

  const replaceUser = useCallback((updated: AdminUser) => {
    setUsers((prev) => prev.map((user) => (user.id === updated.id ? updated : user)));
  }, []);

  /* Actualización optimista + reversión ante error. */
  const handleToggleActive = useCallback(
    (target: AdminUser, next: boolean) => {
      setUsers((prev) => prev.map((u) => (u.id === target.id ? { ...u, isActive: next } : u)));
      void patchUser(target.id, { isActive: next })
        .then((updated) => {
          replaceUser(updated);
          void refreshStats();
        })
        .catch((error: unknown) => {
          setUsers((prev) => prev.map((u) => (u.id === target.id ? { ...u, isActive: !next } : u)));
          toast.error(getErrorMessage(error, "No se pudo cambiar el estado de la cuenta."));
        });
    },
    [patchUser, refreshStats, replaceUser],
  );

  const handleTogglePermission = useCallback(
    (target: AdminUser, permissionId: string, granted: boolean) => {
      const previousPermissions = target.permissions;
      const nextPermissions = granted
        ? Array.from(new Set([...previousPermissions, permissionId]))
        : previousPermissions.filter((permission) => permission !== permissionId);

      setUsers((prev) =>
        prev.map((u) => (u.id === target.id ? { ...u, permissions: nextPermissions } : u)),
      );
      setPendingPermissionIds((prev) => new Set(prev).add(target.id));

      void patchUser(target.id, { permissions: nextPermissions })
        .then((updated) => {
          replaceUser(updated);
        })
        .catch((error: unknown) => {
          setUsers((prev) =>
            prev.map((u) => (u.id === target.id ? { ...u, permissions: previousPermissions } : u)),
          );
          toast.error(getErrorMessage(error, "No se pudieron guardar los permisos."));
        })
        .finally(() => {
          setPendingPermissionIds((prev) => {
            const next = new Set(prev);
            next.delete(target.id);
            return next;
          });
        });
    },
    [patchUser, replaceUser],
  );

  const handleCreateUser = useCallback(
    async (payload: CreateUserPayload): Promise<boolean> => {
      setCreating(true);
      try {
        const data = await apiFetch<UserMutationPayload>("/api/admin/users", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        toast.success(`Usuario ${payload.email} creado correctamente.`);
        setCreateOpen(false);
        const created = normalizeUser(data.user);
        if (created !== null) {
          setUsers((prev) => [created, ...prev.filter((u) => u.id !== created.id)]);
        }
        void refreshStats();
        return true;
      } catch (error) {
        toast.error(getErrorMessage(error, "No se pudo crear el usuario."));
        return false;
      } finally {
        setCreating(false);
      }
    },
    [refreshStats],
  );

  const handleChangePassword = useCallback(
    async (password: string) => {
      const target = passwordTarget;
      if (target === null) return;
      setSavingPassword(true);
      try {
        await patchUser(target.id, { password });
        toast.success(`Contraseña actualizada para ${target.email}.`);
        setPasswordTarget(null);
      } catch (error) {
        toast.error(getErrorMessage(error, "No se pudo actualizar la contraseña."));
      } finally {
        setSavingPassword(false);
      }
    },
    [passwordTarget, patchUser],
  );

  const handleDeleteUser = useCallback(async () => {
    const target = deleteTarget;
    if (target === null) return;
    setDeleting(true);
    try {
      await apiFetch<OkPayload>(`/api/admin/users/${encodeURIComponent(target.id)}`, {
        method: "DELETE",
      });
      toast.success(`Usuario ${target.email} eliminado.`);
      setDeleteTarget(null);
      setUsers((prev) => prev.filter((u) => u.id !== target.id));
      void refreshStats();
    } catch (error) {
      // P. ej. "no puedes eliminar tu propia cuenta" o "último administrador".
      toast.error(getErrorMessage(error, "No se pudo eliminar el usuario."));
    } finally {
      setDeleting(false);
    }
  }, [deleteTarget, refreshStats]);

  return (
    <section
      aria-labelledby="admin-dashboard-title"
      className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 sm:py-12 lg:px-8"
    >
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <p className="mono-label flex items-center gap-2.5 text-muted-foreground">
            <span aria-hidden="true" className="inline-block size-[7px] bg-vermilion" />
            Panel de control
          </p>
          <h1
            id="admin-dashboard-title"
            className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl"
          >
            Administración <span className="math text-primary">segura</span>
          </h1>
          <p className="mt-3 text-base leading-relaxed text-muted-foreground">
            Gestiona cuentas y permisos, y audita los intentos de acceso al laboratorio matemático.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-10"
          onClick={() => void handleRefresh()}
          disabled={isRefreshing || status === "loading"}
          aria-label="Actualizar todos los datos del panel"
        >
          <RefreshCw className={cn("size-4", isRefreshing && "animate-spin")} aria-hidden="true" />
        </Button>
      </header>

      {status === "loading" ? <DashboardSkeleton /> : null}

      {status === "error" ? (
        <ErrorState message={loadError ?? ""} onRetry={() => void loadAll()} />
      ) : null}

      {status === "ready" ? (
        <>
          <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
            <StatCard label="Usuarios totales" value={stats?.totalUsers ?? 0} icon={Users} />
            <StatCard label="Activos" value={stats?.activeUsers ?? 0} icon={UserCheck} />
            <StatCard label="Administradores" value={stats?.adminUsers ?? 0} icon={ShieldCheck} />
            <StatCard label="Sesiones activas" value={stats?.activeSessions ?? 0} icon={KeyRound} />
            <StatCard
              label="Intentos fallidos 24h"
              value={stats?.failedAttempts24h ?? 0}
              icon={ShieldAlert}
              tone={(stats?.failedAttempts24h ?? 0) > 0 ? "destructive" : "default"}
            />
            <StatCard label="Intentos totales 24h" value={stats?.totalAttempts24h ?? 0} icon={Activity} />
          </div>

          <Tabs defaultValue="usuarios" className="mt-8">
            <TabsList>
              <TabsTrigger value="usuarios" className="px-4">
                <Users aria-hidden="true" /> Usuarios
              </TabsTrigger>
              <TabsTrigger value="seguridad" className="px-4">
                <ShieldCheck aria-hidden="true" /> Seguridad
              </TabsTrigger>
            </TabsList>

            <TabsContent value="usuarios" className="mt-4">
              <UsersPanel
                users={users}
                query={searchQuery}
                onQueryChange={setSearchQuery}
                onCreateClick={() => setCreateOpen(true)}
                onToggleActive={handleToggleActive}
                onTogglePermission={handleTogglePermission}
                pendingPermissionIds={pendingPermissionIds}
                onChangePassword={setPasswordTarget}
                onRequestDelete={setDeleteTarget}
              />
            </TabsContent>

            <TabsContent value="seguridad" className="mt-4">
              <SecurityPanel
                attempts={attempts}
                note={attemptsNote}
                isRefreshing={isRefreshingAttempts}
                onRefresh={() => void handleRefreshAttempts()}
              />
            </TabsContent>
          </Tabs>
        </>
      ) : null}

      <CreateUserDialog
        open={createOpen}
        submitting={creating}
        onSubmit={handleCreateUser}
        onOpenChange={setCreateOpen}
      />
      <ChangePasswordDialog
        target={passwordTarget}
        submitting={savingPassword}
        onSubmit={handleChangePassword}
        onClose={() => setPasswordTarget(null)}
      />
      <DeleteUserDialog
        target={deleteTarget}
        deleting={deleting}
        onConfirm={() => void handleDeleteUser()}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      />
    </section>
  );
}

/* --------------------------------------------------------------------------
 * Métricas
 * ------------------------------------------------------------------------ */

interface StatCardProps {
  label: string;
  value: number;
  icon: LucideIcon;
  tone?: "default" | "destructive";
}

function StatCard({ label, value, icon: Icon, tone = "default" }: StatCardProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <span className="mono-label text-muted-foreground">{label}</span>
        <span
          aria-hidden="true"
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-md",
            tone === "destructive"
              ? "bg-destructive/10 text-destructive"
              : "bg-secondary text-secondary-foreground",
          )}
        >
          <Icon className="size-4" />
        </span>
      </div>
      <p className="mt-2 font-mono text-2xl font-semibold tabular-nums text-foreground">
        {formatNumber(value)}
      </p>
    </div>
  );
}

/* --------------------------------------------------------------------------
 * Pestaña: usuarios
 * ------------------------------------------------------------------------ */

interface UsersPanelProps {
  users: AdminUser[];
  query: string;
  onQueryChange: (query: string) => void;
  onCreateClick: () => void;
  onToggleActive: (user: AdminUser, next: boolean) => void;
  onTogglePermission: (user: AdminUser, permissionId: string, granted: boolean) => void;
  pendingPermissionIds: ReadonlySet<string>;
  onChangePassword: (user: AdminUser) => void;
  onRequestDelete: (user: AdminUser) => void;
}

function UsersPanel({
  users,
  query,
  onQueryChange,
  onCreateClick,
  onToggleActive,
  onTogglePermission,
  pendingPermissionIds,
  onChangePassword,
  onRequestDelete,
}: UsersPanelProps) {
  const filteredUsers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (normalizedQuery.length === 0) return users;
    return users.filter(
      (user) =>
        user.email.toLowerCase().includes(normalizedQuery) ||
        (user.name ?? "").toLowerCase().includes(normalizedQuery),
    );
  }, [users, query]);

  return (
    <Card className="gap-0 overflow-hidden py-0">
      <CardHeader className="gap-3 border-b px-4 py-4 sm:px-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardTitle className="text-base">Cuentas registradas</CardTitle>
            <CardDescription>
              {users.length === 0
                ? "Aún no hay usuarios."
                : `${formatNumber(users.length)} ${users.length === 1 ? "usuario" : "usuarios"} en total.`}
            </CardDescription>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                type="search"
                value={query}
                onChange={(event) => onQueryChange(event.target.value)}
                placeholder="Buscar por nombre o correo…"
                aria-label="Buscar usuarios por nombre o correo"
                className="h-10 w-full pl-9 sm:w-64"
              />
            </div>
            <Button type="button" className="h-10" onClick={onCreateClick}>
              <UserPlus aria-hidden="true" /> Nuevo usuario
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="scroll-thin max-h-[32rem] overflow-y-auto">
          <Table className="min-w-[56rem]">
            <TableHeader className="sticky top-0 z-10 bg-card">
              <TableRow className="hover:bg-transparent">
                <TableHead className="mono-label px-4 font-normal text-muted-foreground sm:px-6">
                  Usuario
                </TableHead>
                <TableHead className="mono-label px-3 font-normal text-muted-foreground">Rol</TableHead>
                <TableHead className="mono-label px-3 font-normal text-muted-foreground">Estado</TableHead>
                <TableHead className="mono-label px-3 font-normal text-muted-foreground">Permisos</TableHead>
                <TableHead className="mono-label px-3 text-right font-normal text-muted-foreground">
                  Sesiones
                </TableHead>
                <TableHead className="mono-label px-3 font-normal text-muted-foreground">Creado</TableHead>
                <TableHead className="mono-label px-3 text-right font-normal text-muted-foreground sm:pr-6">
                  Acciones
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="h-28 px-4 text-center text-sm text-muted-foreground sm:px-6"
                  >
                    {query.trim().length > 0
                      ? "Ningún usuario coincide con la búsqueda."
                      : "Todavía no hay cuentas registradas."}
                  </TableCell>
                </TableRow>
              ) : (
                filteredUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="max-w-[18rem] px-4 sm:px-6">
                      <div className="flex items-center gap-3">
                        <UserAvatar user={user} />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">
                            {user.name ?? "Sin nombre"}
                          </p>
                          <UserEmails user={user} />
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="px-3">
                      {user.role === "ADMIN" ? (
                        <Badge variant="default">Admin</Badge>
                      ) : (
                        <Badge variant="outline">Usuario</Badge>
                      )}
                    </TableCell>
                    <TableCell className="px-3">
                      <Switch
                        checked={user.isActive}
                        onCheckedChange={(next) => onToggleActive(user, next)}
                        aria-label={
                          user.isActive
                            ? `Desactivar cuenta de ${user.email}`
                            : `Activar cuenta de ${user.email}`
                        }
                      />
                    </TableCell>
                    <TableCell className="px-3">
                      <PermissionsCell
                        user={user}
                        busy={pendingPermissionIds.has(user.id)}
                        onToggle={onTogglePermission}
                      />
                    </TableCell>
                    <TableCell className="px-3 text-right font-mono text-sm tabular-nums text-foreground">
                      {user.activeSessions}
                    </TableCell>
                    <TableCell className="whitespace-nowrap px-3 text-sm text-muted-foreground">
                      {formatDate(user.createdAt)}
                    </TableCell>
                    <TableCell className="px-3 text-right sm:pr-6">
                      <UserRowMenu
                        user={user}
                        onChangePassword={onChangePassword}
                        onRequestDelete={onRequestDelete}
                      />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function UserAvatar({ user }: { user: AdminUser }) {
  return (
    <span
      aria-hidden="true"
      className="flex size-9 shrink-0 select-none items-center justify-center rounded-full border border-border bg-secondary text-xs font-semibold uppercase tracking-wide text-secondary-foreground"
    >
      {userInitials(user)}
    </span>
  );
}

function UserEmails({ user }: { user: AdminUser }) {
  const emails =
    user.emails.length > 0
      ? user.emails
      : [{ address: user.email, isPrimary: true, isVerified: false }];
  return (
    <div className="mt-0.5 flex flex-col gap-0.5">
      {emails.map((email) => (
        <span
          key={`${email.address}-${String(email.isPrimary)}`}
          className="flex items-center gap-1.5 text-xs text-muted-foreground"
        >
          <span
            aria-hidden="true"
            className={cn(
              "inline-block size-1.5 shrink-0 rounded-full",
              email.isVerified ? "bg-teal" : "bg-muted-foreground/30",
            )}
          />
          <span className="truncate" title={email.address}>
            {email.address}
          </span>
          <span className="sr-only">{email.isVerified ? "(verificado)" : "(sin verificar)"}</span>
        </span>
      ))}
    </div>
  );
}

interface PermissionsCellProps {
  user: AdminUser;
  busy: boolean;
  onToggle: (user: AdminUser, permissionId: string, granted: boolean) => void;
}

function PermissionsCell({ user, busy, onToggle }: PermissionsCellProps) {
  const popoverId = useId();

  if (user.role === "ADMIN") {
    return <Badge variant="secondary">Todos</Badge>;
  }

  const grantedCount = user.permissions.length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 px-2.5"
          disabled={busy}
          aria-label={`Editar permisos de ${user.email}`}
        >
          {grantedCount}
          <span className="text-muted-foreground">/{PERMISSION_CATALOG.length}</span>
          {busy ? (
            <LoaderCircle className="size-3.5 animate-spin text-muted-foreground" aria-hidden="true" />
          ) : (
            <ChevronDown className="size-3.5 text-muted-foreground" aria-hidden="true" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-4">
        <p className="mono-label text-muted-foreground">Permisos</p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          Se guardan automáticamente para {user.email}.
        </p>
        <Separator className="my-3" />
        <div className="flex flex-col gap-3">
          {PERMISSION_CATALOG.map((permission) => {
            const inputId = `${popoverId}-${permission.id}`;
            return (
              <div key={permission.id} className="flex items-start gap-2.5">
                <Checkbox
                  id={inputId}
                  className="mt-0.5"
                  checked={user.permissions.includes(permission.id)}
                  disabled={busy}
                  onCheckedChange={(checked) => onToggle(user, permission.id, checked === true)}
                />
                <div className="grid gap-0.5">
                  <Label htmlFor={inputId} className="text-sm font-normal">
                    {permission.label}
                  </Label>
                  <p className="text-xs text-muted-foreground">{permission.description}</p>
                </div>
              </div>
            );
          })}
        </div>
        <Separator className="my-3" />
        <p className="text-xs leading-relaxed text-muted-foreground">
          Los administradores tienen todos los permisos de forma implícita.
        </p>
      </PopoverContent>
    </Popover>
  );
}

interface UserRowMenuProps {
  user: AdminUser;
  onChangePassword: (user: AdminUser) => void;
  onRequestDelete: (user: AdminUser) => void;
}

function UserRowMenu({ user, onChangePassword, onRequestDelete }: UserRowMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-10 text-muted-foreground"
          aria-label={`Acciones para ${user.email}`}
        >
          <Ellipsis aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem onSelect={() => onChangePassword(user)}>
          <KeyRound aria-hidden="true" />
          Cambiar contraseña
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={() => onRequestDelete(user)}>
          <Trash2 aria-hidden="true" />
          Eliminar usuario
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* --------------------------------------------------------------------------
 * Pestaña: seguridad (auditoría de intentos)
 * ------------------------------------------------------------------------ */

interface SecurityPanelProps {
  attempts: LoginAttempt[];
  note: string | null;
  isRefreshing: boolean;
  onRefresh: () => void;
}

function SecurityPanel({ attempts, note, isRefreshing, onRefresh }: SecurityPanelProps) {
  return (
    <Card className="gap-0 overflow-hidden py-0">
      <CardHeader className="gap-3 border-b px-4 py-4 sm:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-base">Intentos de acceso</CardTitle>
            <CardDescription>
              Últimos intentos de inicio de sesión registrados por el sistema.
            </CardDescription>
          </div>
          <Button
            type="button"
            variant="outline"
            className="h-10"
            onClick={onRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw className={cn("size-4", isRefreshing && "animate-spin")} aria-hidden="true" />
            Actualizar
          </Button>
        </div>
      </CardHeader>
      {note !== null ? (
        <p className="border-b bg-secondary/60 px-4 py-2.5 text-xs text-muted-foreground sm:px-6">
          {note}
        </p>
      ) : null}
      <CardContent className="p-0">
        <div className="scroll-thin max-h-[32rem] overflow-y-auto">
          <Table className="min-w-[52rem]">
            <TableHeader className="sticky top-0 z-10 bg-card">
              <TableRow className="hover:bg-transparent">
                <TableHead className="mono-label px-4 font-normal text-muted-foreground sm:px-6">
                  Fecha
                </TableHead>
                <TableHead className="mono-label px-3 font-normal text-muted-foreground">Correo</TableHead>
                <TableHead className="mono-label px-3 font-normal text-muted-foreground">IP</TableHead>
                <TableHead className="mono-label px-3 font-normal text-muted-foreground">Resultado</TableHead>
                <TableHead className="mono-label px-3 font-normal text-muted-foreground">Motivo</TableHead>
                <TableHead className="mono-label px-3 font-normal text-muted-foreground sm:pr-6">
                  Navegador
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {attempts.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="h-28 px-4 text-center text-sm text-muted-foreground sm:px-6"
                  >
                    Sin intentos de acceso registrados por ahora.
                  </TableCell>
                </TableRow>
              ) : (
                attempts.map((attempt) => (
                  <TableRow key={attempt.id}>
                    <TableCell className="whitespace-nowrap px-4 text-sm text-muted-foreground sm:px-6">
                      {formatDateTime(attempt.createdAt)}
                    </TableCell>
                    <TableCell className="max-w-[16rem] px-3">
                      <span
                        className="block truncate text-sm font-medium text-foreground"
                        title={attempt.email}
                      >
                        {attempt.email}
                      </span>
                    </TableCell>
                    <TableCell className="whitespace-nowrap px-3 font-mono text-xs text-muted-foreground">
                      {attempt.ip}
                    </TableCell>
                    <TableCell className="px-3">
                      {attempt.success ? (
                        <Badge variant="outline" className="border-teal/30 bg-teal/10 text-teal">
                          Exitoso
                        </Badge>
                      ) : (
                        <Badge variant="destructive">Fallido</Badge>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap px-3 text-sm text-muted-foreground">
                      {attemptReasonLabel(attempt.reason)}
                    </TableCell>
                    <TableCell className="max-w-[14rem] px-3 sm:pr-6">
                      <span
                        className="block truncate text-xs text-muted-foreground"
                        title={attempt.userAgent.length > 0 ? attempt.userAgent : undefined}
                      >
                        {attempt.userAgent.length > 0 ? attempt.userAgent : "—"}
                      </span>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

/* --------------------------------------------------------------------------
 * Diálogos
 * ------------------------------------------------------------------------ */

interface CreateUserDialogProps {
  open: boolean;
  submitting: boolean;
  onSubmit: (payload: CreateUserPayload) => Promise<boolean>;
  onOpenChange: (open: boolean) => void;
}

function CreateUserDialog({ open, submitting, onSubmit, onOpenChange }: CreateUserDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nuevo usuario</DialogTitle>
          <DialogDescription>
            Registra una cuenta con acceso al simulador. La contraseña debe tener al menos{" "}
            {MIN_PASSWORD_LENGTH} caracteres.
          </DialogDescription>
        </DialogHeader>
        {/* Montado solo mientras el diálogo está abierto: el estado del
            formulario se reinicia solo al cerrar (sin efectos). */}
        {open ? (
          <CreateUserForm
            submitting={submitting}
            onSubmit={onSubmit}
            onCancel={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function CreateUserForm({
  submitting,
  onSubmit,
  onCancel,
}: {
  submitting: boolean;
  onSubmit: (payload: CreateUserPayload) => Promise<boolean>;
  onCancel: () => void;
}) {
  const fieldId = useId();
  const emailId = `${fieldId}-email`;
  const nameId = `${fieldId}-name`;
  const passwordId = `${fieldId}-password`;
  const roleId = `${fieldId}-role`;

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<AdminRole>("USER");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanEmail = email.trim();
    const cleanName = name.trim();
    if (!EMAIL_PATTERN.test(cleanEmail)) {
      setError("Introduce una dirección de correo válida.");
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`);
      return;
    }
    setError(null);
    void onSubmit({
      email: cleanEmail,
      name: cleanName.length > 0 ? cleanName : undefined,
      password,
      role,
    });
  }

  return (
    <form className="grid gap-4" onSubmit={handleSubmit} noValidate>
      <div className="grid gap-2">
        <Label htmlFor={emailId}>Correo electrónico</Label>
        <Input
          id={emailId}
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="nombre@ejemplo.com"
          autoComplete="off"
          disabled={submitting}
          required
          aria-invalid={error !== null}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor={nameId}>
          Nombre <span className="font-normal text-muted-foreground">(opcional)</span>
        </Label>
        <Input
          id={nameId}
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Ada Lovelace"
          autoComplete="off"
          disabled={submitting}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor={passwordId}>Contraseña</Label>
        <Input
          id={passwordId}
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="new-password"
          disabled={submitting}
          required
          minLength={MIN_PASSWORD_LENGTH}
          aria-describedby={`${passwordId}-hint`}
        />
        <p id={`${passwordId}-hint`} className="text-xs text-muted-foreground">
          Mínimo {MIN_PASSWORD_LENGTH} caracteres.
        </p>
      </div>
      <div className="grid gap-2">
        <Label htmlFor={roleId}>Rol</Label>
        <Select
          value={role}
          onValueChange={(value) => setRole(value === "ADMIN" ? "ADMIN" : "USER")}
        >
          <SelectTrigger id={roleId} className="w-full" disabled={submitting}>
            <SelectValue placeholder="Selecciona un rol" />
          </SelectTrigger>
          <SelectContent>
            {ROLE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Los administradores tienen acceso total al panel.
        </p>
      </div>
      {error !== null ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
          Cancelar
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? (
            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <UserPlus aria-hidden="true" />
          )}
          Crear usuario
        </Button>
      </DialogFooter>
    </form>
  );
}

interface ChangePasswordDialogProps {
  target: AdminUser | null;
  submitting: boolean;
  onSubmit: (password: string) => Promise<void>;
  onClose: () => void;
}

function ChangePasswordDialog({ target, submitting, onSubmit, onClose }: ChangePasswordDialogProps) {
  return (
    <Dialog
      open={target !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cambiar contraseña</DialogTitle>
          <DialogDescription>
            Define una contraseña nueva para{" "}
            <span className="font-medium text-foreground">{target?.email ?? ""}</span>. Mínimo{" "}
            {MIN_PASSWORD_LENGTH} caracteres.
          </DialogDescription>
        </DialogHeader>
        {/* Montado solo mientras hay objetivo: el estado se reinicia solo al
            cerrar o al cambiar de usuario (sin efectos). */}
        {target !== null ? (
          <ChangePasswordForm
            key={target.id}
            submitting={submitting}
            onSubmit={onSubmit}
            onCancel={onClose}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function ChangePasswordForm({
  submitting,
  onSubmit,
  onCancel,
}: {
  submitting: boolean;
  onSubmit: (password: string) => Promise<void>;
  onCancel: () => void;
}) {
  const fieldId = useId();
  const passwordId = `${fieldId}-new`;
  const confirmId = `${fieldId}-confirm`;

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`);
      return;
    }
    if (password !== confirm) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    setError(null);
    void onSubmit(password);
  }

  return (
    <form className="grid gap-4" onSubmit={handleSubmit} noValidate>
      <div className="grid gap-2">
        <Label htmlFor={passwordId}>Contraseña nueva</Label>
        <Input
          id={passwordId}
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="new-password"
          disabled={submitting}
          required
          minLength={MIN_PASSWORD_LENGTH}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor={confirmId}>Confirmar contraseña</Label>
        <Input
          id={confirmId}
          type="password"
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
          autoComplete="new-password"
          disabled={submitting}
          required
          minLength={MIN_PASSWORD_LENGTH}
        />
      </div>
      {error !== null ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
          Cancelar
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? (
            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <KeyRound aria-hidden="true" />
          )}
          Guardar contraseña
        </Button>
      </DialogFooter>
    </form>
  );
}

interface DeleteUserDialogProps {
  target: AdminUser | null;
  deleting: boolean;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
}

function DeleteUserDialog({ target, deleting, onConfirm, onOpenChange }: DeleteUserDialogProps) {
  return (
    <AlertDialog open={target !== null} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Eliminar este usuario?</AlertDialogTitle>
          <AlertDialogDescription>
            La cuenta{" "}
            <span className="font-medium text-foreground">{target?.email ?? ""}</span> se eliminará de
            forma permanente junto con sus sesiones activas. Esta acción no se puede deshacer.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-white hover:bg-destructive/90"
            disabled={deleting}
            onClick={(event) => {
              event.preventDefault();
              onConfirm();
            }}
          >
            {deleting ? (
              <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Trash2 aria-hidden="true" />
            )}
            Eliminar usuario
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/* --------------------------------------------------------------------------
 * Estados de carga y error
 * ------------------------------------------------------------------------ */

function DashboardSkeleton() {
  return (
    <div role="status" aria-live="polite" className="mt-8">
      <span className="sr-only">Cargando panel de administración…</span>
      <div aria-hidden="true" className="flex flex-col gap-6">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="rounded-xl border border-border bg-card p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="size-8 rounded-md" />
              </div>
              <Skeleton className="mt-3 h-7 w-12" />
            </div>
          ))}
        </div>
        <Skeleton className="h-9 w-56 rounded-lg" />
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <div className="grid gap-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-52" />
            </div>
            <Skeleton className="h-10 w-full sm:w-72" />
          </div>
          <div className="flex flex-col gap-3 p-4 sm:p-6">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-12 w-full" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

interface ErrorStateProps {
  message: string;
  onRetry: () => void;
}

function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <Alert variant="destructive" className="mt-8">
      <TriangleAlert aria-hidden="true" />
      <AlertTitle>No se pudo cargar el panel</AlertTitle>
      <AlertDescription>
        <p>{message}</p>
        <Button type="button" variant="outline" size="sm" className="mt-2" onClick={onRetry}>
          <RefreshCw className="size-4" aria-hidden="true" />
          Reintentar
        </Button>
      </AlertDescription>
    </Alert>
  );
}
