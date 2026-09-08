"use client";

import { useAuth } from "@/components/auth/auth-provider";
import { AdminDashboard } from "@/components/admin/admin-dashboard";

/**
 * Sección de administración en la página principal.
 * Se renderiza ÚNICAMENTE para usuarios con rol ADMIN — el resto de
 * visitantes no ven ni el enlace ni la sección. La seguridad real vive
 * en el servidor: todas las rutas /api/admin/* exigen rol ADMIN
 * (requireAdmin), así que ocultar la UI es solo cortesía visual.
 */
export function AdminSection() {
  const { user, loading } = useAuth();

  if (loading || !user || user.role !== "ADMIN") return null;

  return (
    <div id="admin" className="relative scroll-mt-16 border-t border-line bg-background">
      <div
        aria-hidden="true"
        className="graph-paper pointer-events-none absolute inset-0 opacity-60"
      />
      <div className="relative">
        <AdminDashboard />
      </div>
    </div>
  );
}
