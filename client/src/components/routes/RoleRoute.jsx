import React from "react";
import { Navigate, Outlet } from "react-router-dom";

export default function RoleRoute({
  isAuthenticated,
  currentUser,
  allowedRoles = [],
  redirectTo = "/",
  children,
}) {
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  const normalizedRole = String(currentUser?.role || "").trim().toLowerCase();
  const hasAccess = allowedRoles.map((role) => String(role).trim().toLowerCase()).includes(normalizedRole);

  if (!hasAccess) {
    return <Navigate to={redirectTo} replace />;
  }

  if (children) {
    return children;
  }

  return <Outlet />;
}
