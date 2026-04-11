import React, { useState, useEffect, useRef } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  FaFish,
  FaUserCircle,
  FaSignOutAlt,
  FaList,
  FaStar,
  FaCalendarAlt,
  FaTools,
  FaUserShield,
  FaUserCog,
  FaMapMarkedAlt,
  FaChartPie,
  FaSignInAlt,
  FaUserPlus,
  FaFileSignature,
} from "react-icons/fa";

const Navigation = ({ isAuthenticated, onLogout, currentUser }) => {
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const isAdmin = currentUser?.role === "admin";
  const isOwner = currentUser?.role === "owner" || isAdmin;

  const linkClassName = ({ isActive }) =>
    `main-nav-link ${isActive ? "active" : ""}`;

  return (
    <>
      <nav className="main-navigation">
        <div className="main-navigation-brand">
          <FaFish />
          <span>Fishing Atlas AI</span>
        </div>

        <div className="main-navigation-links">
          {isAuthenticated ? (
            <>
              <NavLink to="/" className={linkClassName}>
                <FaMapMarkedAlt />
                <span>Map</span>
              </NavLink>

              <NavLink to="/dashboard" className={linkClassName}>
                <FaChartPie />
                <span>Dashboard</span>
              </NavLink>

              <NavLink to="/catches" className={linkClassName}>
                <FaList />
                <span>My Catches</span>
              </NavLink>

              <NavLink to="/saved-lakes" className={linkClassName}>
                <FaStar />
                <span>Saved Lakes</span>
              </NavLink>

              <NavLink to="/reservations" className={linkClassName}>
                <FaCalendarAlt />
                <span>Reservations</span>
              </NavLink>

              <NavLink to="/become-owner" className={linkClassName}>
                <FaFileSignature />
                <span>Become Owner</span>
              </NavLink>

              {isOwner && (
                <NavLink to="/owner" className={linkClassName}>
                  <FaTools />
                  <span>Owner Panel</span>
                </NavLink>
              )}

              {isAdmin && (
                <NavLink to="/admin" className={linkClassName}>
                  <FaUserShield />
                  <span>Admin</span>
                </NavLink>
              )}

              <div ref={menuRef} className="main-user-menu-wrap">
                <button
                  onClick={() => setShowMenu((prev) => !prev)}
                  className="main-user-avatar-button"
                >
                  <FaUserCircle size={26} />
                </button>

                {showMenu && (
                  <div className="main-user-dropdown">
                    <div className="main-user-dropdown-header">
                      {currentUser?.full_name || "User"}
                      {currentUser?.role ? ` • ${currentUser.role}` : ""}
                    </div>

                    <div
                      onClick={() => {
                        setShowMenu(false);
                        navigate("/profile");
                      }}
                      className="main-user-dropdown-item"
                    >
                      <FaUserCog />
                      <span>Profile</span>
                    </div>

                    <div
                      onClick={() => {
                        setShowMenu(false);
                        navigate("/catches");
                      }}
                      className="main-user-dropdown-item"
                    >
                      <FaList />
                      <span>My Catches</span>
                    </div>

                    <div
                      onClick={() => {
                        setShowMenu(false);
                        navigate("/saved-lakes");
                      }}
                      className="main-user-dropdown-item"
                    >
                      <FaStar />
                      <span>Saved Lakes</span>
                    </div>

                    <div
                      onClick={() => {
                        setShowMenu(false);
                        navigate("/reservations");
                      }}
                      className="main-user-dropdown-item"
                    >
                      <FaCalendarAlt />
                      <span>Reservations</span>
                    </div>

                    <div
                      onClick={() => {
                        setShowMenu(false);
                        navigate("/become-owner");
                      }}
                      className="main-user-dropdown-item"
                    >
                      <FaFileSignature />
                      <span>Become Owner</span>
                    </div>

                    {isOwner && (
                      <div
                        onClick={() => {
                          setShowMenu(false);
                          navigate("/owner");
                        }}
                        className="main-user-dropdown-item"
                      >
                        <FaTools />
                        <span>Owner Panel</span>
                      </div>
                    )}

                    {isAdmin && (
                      <div
                        onClick={() => {
                          setShowMenu(false);
                          navigate("/admin");
                        }}
                        className="main-user-dropdown-item"
                      >
                        <FaUserShield />
                        <span>Admin Dashboard</span>
                      </div>
                    )}

                    <div
                      onClick={() => {
                        setShowMenu(false);
                        onLogout();
                      }}
                      className="main-user-dropdown-item danger"
                    >
                      <FaSignOutAlt />
                      <span>Sign Out</span>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <NavLink to="/login" className={linkClassName}>
                <FaSignInAlt />
                <span>Login</span>
              </NavLink>

              <NavLink to="/register" className={linkClassName}>
                <FaUserPlus />
                <span>Register</span>
              </NavLink>
            </>
          )}
        </div>
      </nav>

      <style>{`
        .main-navigation {
          height: 64px;
          background: linear-gradient(180deg, #1f2937 0%, #111827 100%);
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 22px;
          color: white;
          position: relative;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          box-shadow: 0 10px 24px rgba(15, 23, 42, 0.18);
          z-index: 5000;
        }

        .main-navigation-brand {
          font-size: 20px;
          margin-right: 24px;
          display: flex;
          align-items: center;
          gap: 10px;
          font-weight: 800;
          letter-spacing: -0.02em;
          white-space: nowrap;
        }

        .main-navigation-links {
          display: flex;
          gap: 10px;
          align-items: center;
        }

        .main-nav-link {
          color: rgba(255, 255, 255, 0.88);
          text-decoration: none;
          font-weight: 700;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 9px 12px;
          border-radius: 12px;
          transition: all 0.18s ease;
        }

        .main-nav-link:hover {
          background: rgba(255, 255, 255, 0.08);
          color: white;
        }

        .main-nav-link.active {
          background: rgba(59, 130, 246, 0.18);
          color: white;
          box-shadow: inset 0 0 0 1px rgba(96, 165, 250, 0.24);
        }

        .main-user-menu-wrap {
          position: relative;
          display: flex;
          align-items: center;
        }

        .main-user-avatar-button {
          background: transparent;
          color: white;
          border: none;
          padding: 0;
          display: flex;
          align-items: center;
          cursor: pointer;
          opacity: 0.95;
        }

        .main-user-avatar-button:hover {
          opacity: 1;
        }

        .main-user-dropdown {
          position: absolute;
          right: 0;
          top: 44px;
          background: white;
          color: #0f172a;
          border-radius: 16px;
          z-index: 3000;
          box-shadow: 0 20px 50px rgba(15, 23, 42, 0.22);
          overflow: hidden;
          min-width: 240px;
          border: 1px solid #e2e8f0;
        }

        .main-user-dropdown-header {
          padding: 12px 16px;
          background: #f8fafc;
          border-bottom: 1px solid #e2e8f0;
          font-size: 12px;
          color: #475569;
          font-weight: 700;
        }

        .main-user-dropdown-item {
          padding: 12px 16px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 10px;
          white-space: nowrap;
          transition: background 0.18s ease;
          font-weight: 600;
        }

        .main-user-dropdown-item:hover {
          background: #f8fafc;
        }

        .main-user-dropdown-item.danger {
          color: #b91c1c;
        }

        @media (max-width: 1100px) {
          .main-navigation-links {
            gap: 6px;
          }

          .main-nav-link {
            padding: 8px 10px;
            font-size: 14px;
          }
        }

        @media (max-width: 900px) {
          .main-navigation {
            padding: 0 14px;
          }

          .main-navigation-brand {
            font-size: 18px;
          }

          .main-navigation-links {
            gap: 4px;
          }

          .main-nav-link span {
            display: none;
          }
        }

        @media (max-width: 640px) {
          .main-navigation-brand span {
            display: none;
          }
        }
      `}</style>
    </>
  );
};

export default Navigation;