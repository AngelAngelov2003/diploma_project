import React from "react";
import { Navigate, Outlet } from "react-router-dom";

export default function ProtectedRoute({ isAuthenticated, redirectTo = "/login", children }) {
  if (!isAuthenticated) {
    return <Navigate to={redirectTo} replace />;
  }

  if (children) {
    return children;
  }

  return <Outlet />;
}
