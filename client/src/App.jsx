import React, { useEffect, useState } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import Navigation from "./components/common/Navigation";
import FishingMap from "./features/fishing-map/FishingMap";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import MyAlerts from "./pages/MyAlerts";
import LakeDetails from "./pages/LakeDetails";
import MyCatches from "./pages/MyCatches";
import ReservationsPage from "./pages/ReservationsPage";
import OwnerPanel from "./pages/OwnerPanel";
import AdminDashboard from "./pages/AdminDashboard";
import Profile from "./pages/Profile";
import { getCurrentUser } from "./api/authApi";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

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

      if (!token || !isAuthenticated || currentUser) return;

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
          path="/"
          element={
            isAuthenticated ? <FishingMap /> : <Navigate to="/login" replace />
          }
        />

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

        <Route
          path="/profile"
          element={
            isAuthenticated ? (
              <Profile setCurrentUser={setCurrentUser} />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

        <Route
          path="/dashboard"
          element={
            isAuthenticated ? <Dashboard /> : <Navigate to="/login" replace />
          }
        />

        <Route
          path="/catches"
          element={
            isAuthenticated ? <MyCatches /> : <Navigate to="/login" replace />
          }
        />

        <Route
          path="/alerts"
          element={
            isAuthenticated ? <MyAlerts /> : <Navigate to="/login" replace />
          }
        />

        <Route
          path="/reservations"
          element={
            isAuthenticated ? (
              <ReservationsPage />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

        <Route
          path="/owner"
          element={
            isAuthenticated ? <OwnerPanel /> : <Navigate to="/login" replace />
          }
        />

        <Route
          path="/admin"
          element={
            isAuthenticated ? (
              currentUser?.role === "admin" ? (
                <AdminDashboard />
              ) : (
                <Navigate to="/" replace />
              )
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

        <Route
          path="/lakes/:id"
          element={
            isAuthenticated ? <LakeDetails /> : <Navigate to="/login" replace />
          }
        />

        <Route
          path="*"
          element={<Navigate to={isAuthenticated ? "/" : "/login"} replace />}
        />
      </Routes>

      <ToastContainer
        position="bottom-center"
        style={{ bottom: "20px" }}
        autoClose={2500}
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        pauseOnHover
        draggable
        toastStyle={{
          borderRadius: "12px",
          padding: "12px 16px",
          minHeight: "56px",
        }}
      />
    </Router>
  );
}

export default App;