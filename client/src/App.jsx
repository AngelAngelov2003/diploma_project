import React, { useEffect, useState } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import Navigation from "./components/common/Navigation";
import ProtectedRoute from "./components/routes/ProtectedRoute";
import RoleRoute from "./components/routes/RoleRoute";
import FishingMap from "./features/fishing-map/FishingMap";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import MyAlerts from "./pages/MyAlerts";
import FavoritesPage from "./pages/FavoritesPage";
import SavedLakesPage from "./pages/SavedLakesPage";
import LakeDetails from "./pages/LakeDetails";
import MyCatches from "./pages/MyCatches";
import ReservationsPage from "./pages/ReservationsPage";
import OwnerPanel from "./pages/OwnerPanel";
import BecomeOwner from "./pages/BecomeOwner";
import AdminDashboard from "./pages/AdminDashboard";
import Profile from "./pages/Profile";
import { getCurrentUser } from "./api/authApi";
import { AUTH_EXPIRED_EVENT } from "./api/client";
import { notifyInfo } from "./ui/toast";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const shouldResetToMapOnReload = () => {
  if (typeof window === "undefined") {
    return false;
  }

  const navigationEntries =
    typeof window.performance?.getEntriesByType === "function"
      ? window.performance.getEntriesByType("navigation")
      : [];

  return navigationEntries?.[0]?.type === "reload";
};

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    if (!shouldResetToMapOnReload()) {
      return;
    }

    if (window.location.pathname !== "/") {
      window.history.replaceState({}, "", "/");
    }
  }, []);

  useEffect(() => {
    const handleAuthExpired = () => {
      setCurrentUser(null);
      setIsAuthenticated(false);
      setAuthChecked(true);
    };

    window.addEventListener(AUTH_EXPIRED_EVENT, handleAuthExpired);

    return () => {
      window.removeEventListener(AUTH_EXPIRED_EVENT, handleAuthExpired);
    };
  }, []);

  useEffect(() => {
    const expiredMessage = sessionStorage.getItem("auth_expired_message");

    if (!expiredMessage) {
      return;
    }

    sessionStorage.removeItem("auth_expired_message");
    notifyInfo(expiredMessage);
  }, []);

  useEffect(() => {
    const initializeAuth = async () => {
      const token = localStorage.getItem("token");

      if (!token) {
        setIsAuthenticated(false);
        setCurrentUser(null);
        setAuthChecked(true);
        return;
      }

      try {
        const user = await getCurrentUser();
        setIsAuthenticated(true);
        setCurrentUser(user || null);
      } catch (err) {
        localStorage.removeItem("token");
        setIsAuthenticated(false);
        setCurrentUser(null);
      } finally {
        setAuthChecked(true);
      }
    };

    initializeAuth();
  }, []);

  useEffect(() => {
    const loadCurrentUser = async () => {
      const token = localStorage.getItem("token");

      if (!token || !isAuthenticated || currentUser) {
        return;
      }

      try {
        const user = await getCurrentUser();
        setCurrentUser(user || null);
      } catch (err) {
        localStorage.removeItem("token");
        setIsAuthenticated(false);
        setCurrentUser(null);
      }
    };

    loadCurrentUser();
  }, [isAuthenticated, currentUser]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    setCurrentUser(null);
    setIsAuthenticated(false);
  };

  if (!authChecked) {
    return <div style={{ padding: 20 }}>Loading...</div>;
  }

  return (
    <Router>
      <Navigation
        isAuthenticated={isAuthenticated}
        onLogout={handleLogout}
        currentUser={currentUser}
      />

      <Routes>
        <Route
          path="/login"
          element={
            !isAuthenticated ? (
              <Login
                setAuth={setIsAuthenticated}
                setCurrentUser={setCurrentUser}
              />
            ) : (
              <Navigate to="/" replace />
            )
          }
        />

        <Route
          path="/register"
          element={
            !isAuthenticated ? (
              <Register
                setAuth={setIsAuthenticated}
                setCurrentUser={setCurrentUser}
              />
            ) : (
              <Navigate to="/" replace />
            )
          }
        />

        <Route element={<ProtectedRoute isAuthenticated={isAuthenticated} />}>
          <Route path="/" element={<FishingMap />} />
          <Route path="/profile" element={<Profile setCurrentUser={setCurrentUser} />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/catches" element={<MyCatches />} />
          <Route path="/saved-lakes" element={<SavedLakesPage />} />
          <Route path="/alerts" element={<MyAlerts />} />
          <Route path="/favorites" element={<FavoritesPage />} />
          <Route path="/reservations" element={<ReservationsPage currentUser={currentUser} />} />
          <Route path="/become-owner" element={<BecomeOwner />} />
          <Route path="/lakes/:id" element={<LakeDetails />} />
        </Route>

        <Route
          element={
            <RoleRoute
              isAuthenticated={isAuthenticated}
              currentUser={currentUser}
              allowedRoles={["owner", "admin"]}
              redirectTo="/become-owner"
            />
          }
        >
          <Route path="/owner" element={<OwnerPanel />} />
        </Route>

        <Route
          element={
            <RoleRoute
              isAuthenticated={isAuthenticated}
              currentUser={currentUser}
              allowedRoles={["admin"]}
              redirectTo="/"
            />
          }
        >
          <Route path="/admin" element={<AdminDashboard />} />
        </Route>

        <Route
          path="*"
          element={<Navigate to={isAuthenticated ? "/" : "/login"} replace />}
        />
      </Routes>

      <ToastContainer position="bottom-center" autoClose={3000} />
    </Router>
  );
}

export default App;
