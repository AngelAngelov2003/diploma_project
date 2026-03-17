import React, { useEffect, useState } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Navigation from "./components/Navigation";
import FishingMap from "./features/FishingMap";
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
import api from "./api/client";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    setIsAuthenticated(!!token);
    setAuthChecked(true);
  }, []);

  useEffect(() => {
    const loadMe = async () => {
      if (!isAuthenticated) {
        setCurrentUser(null);
        return;
      }

      try {
        const res = await api.get("/auth/me");
        setCurrentUser(res.data || null);
      } catch {
        setCurrentUser(null);
      }
    };

    if (authChecked) {
      loadMe();
    }
  }, [isAuthenticated, authChecked]);

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
      <Navigation isAuthenticated={isAuthenticated} onLogout={handleLogout} currentUser={currentUser} />

      <Routes>
        <Route path="/" element={isAuthenticated ? <FishingMap /> : <Navigate to="/login" />} />

        <Route
          path="/login"
          element={!isAuthenticated ? <Login setAuth={setIsAuthenticated} /> : <Navigate to="/" />}
        />

        <Route
          path="/register"
          element={!isAuthenticated ? <Register setAuth={setIsAuthenticated} /> : <Navigate to="/" />}
        />

        <Route path="/dashboard" element={isAuthenticated ? <Dashboard /> : <Navigate to="/login" />} />

        <Route path="/catches" element={isAuthenticated ? <MyCatches /> : <Navigate to="/login" />} />

        <Route path="/alerts" element={isAuthenticated ? <MyAlerts /> : <Navigate to="/login" />} />

        <Route path="/reservations" element={isAuthenticated ? <ReservationsPage /> : <Navigate to="/login" />} />

        <Route path="/owner" element={isAuthenticated ? <OwnerPanel /> : <Navigate to="/login" />} />

        <Route path="/profile" element={isAuthenticated ? <Profile /> : <Navigate to="/login" />} />

        <Route
          path="/admin"
          element={
            isAuthenticated ? currentUser?.role === "admin" ? <AdminDashboard /> : <Navigate to="/" /> : <Navigate to="/login" />
          }
        />

        <Route path="/lakes/:id" element={isAuthenticated ? <LakeDetails /> : <Navigate to="/login" />} />

        <Route path="*" element={<Navigate to="/" />} />
      </Routes>

      <ToastContainer
        position="top-right"
        autoClose={2500}
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        pauseOnHover
        draggable
      />
    </Router>
  );
}

export default App;