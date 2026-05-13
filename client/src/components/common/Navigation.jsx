import React, { useState, useEffect, useRef } from "react";
import { getReservationBadgeCounts } from "../../api/reservationsApi";
import { NavLink, useNavigate } from "react-router-dom";
import {
  FaFish,
  FaBars,
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
  const [reservationBadges, setReservationBadges] = useState({ user_reservation_updates: 0, owner_pending_reservations: 0 });
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
  const userReservationBadgeCount = Number(reservationBadges.user_reservation_updates || 0);
  const ownerReservationBadgeCount = Number(reservationBadges.owner_pending_reservations || 0);

  useEffect(() => {
    let cancelled = false;

    const loadReservationBadges = async () => {
      if (!isAuthenticated) {
        setReservationBadges({ user_reservation_updates: 0, owner_pending_reservations: 0 });
        return;
      }

      try {
        const data = await getReservationBadgeCounts();
        if (!cancelled) {
          setReservationBadges(data || { user_reservation_updates: 0, owner_pending_reservations: 0 });
        }
      } catch (_error) {
        if (!cancelled) {
          setReservationBadges({ user_reservation_updates: 0, owner_pending_reservations: 0 });
        }
      }
    };

    loadReservationBadges();
    const intervalId = window.setInterval(loadReservationBadges, 60000);

    const refreshOnFocus = () => loadReservationBadges();
    window.addEventListener("focus", refreshOnFocus);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", refreshOnFocus);
    };
  }, [isAuthenticated, currentUser?.id, currentUser?.role]);

  const Badge = ({ count }) => {
    if (!count) return null;
    const safeCount = Number(count) > 99 ? "99+" : String(count);
    return <span className="nav-notification-badge">{safeCount}</span>;
  };

  const closeMenuAndNavigate = (path) => {
    setShowMenu(false);
    navigate(path);
  };

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

              <NavLink to="/reservations" className={(state) => `${linkClassName(state)} secondary-nav-link has-badge`}>
                <FaCalendarAlt />
                <span>Reservations</span>
                <Badge count={userReservationBadgeCount} />
              </NavLink>


              {isOwner && (
                <NavLink to="/owner" className={(state) => `${linkClassName(state)} secondary-nav-link has-badge`}>
                  <FaTools />
                  <span>Owner Panel</span>
                  <Badge count={ownerReservationBadgeCount} />
                </NavLink>
              )}

              {isAdmin && (
                <NavLink to="/admin" className={(state) => `${linkClassName(state)} secondary-nav-link`}>
                  <FaUserShield />
                  <span>Admin</span>
                </NavLink>
              )}


              <div ref={menuRef} className="main-user-menu-wrap">
                <button
                  onClick={() => setShowMenu((prev) => !prev)}
                  className={`main-user-avatar-button ${showMenu ? "open" : ""}`}
                  aria-label={showMenu ? "Close navigation menu" : "Open navigation menu"}
                  aria-expanded={showMenu}
                  type="button"
                >
                  <FaBars size={22} />
                </button>

                {showMenu && (
                  <div className="main-user-dropdown">
                    <div className="main-user-dropdown-header">
                      {currentUser?.full_name || "User"}
                      {currentUser?.role ? ` • ${currentUser.role}` : ""}
                    </div>

                    <div
                      onClick={() => closeMenuAndNavigate("/")}
                      className="main-user-dropdown-item responsive-menu-item"
                    >
                      <FaMapMarkedAlt />
                      <span>Map</span>
                    </div>

                    <div
                      onClick={() => closeMenuAndNavigate("/dashboard")}
                      className="main-user-dropdown-item responsive-menu-item"
                    >
                      <FaChartPie />
                      <span>Dashboard</span>
                    </div>

                    <div
                      onClick={() => closeMenuAndNavigate("/profile")}
                      className="main-user-dropdown-item"
                    >
                      <FaUserCog />
                      <span>Profile</span>
                    </div>

                    <div
                      onClick={() => closeMenuAndNavigate("/catches")}
                      className="main-user-dropdown-item responsive-menu-item"
                    >
                      <FaList />
                      <span>My Catches</span>
                    </div>

                    <div
                      onClick={() => closeMenuAndNavigate("/saved-lakes")}
                      className="main-user-dropdown-item responsive-menu-item"
                    >
                      <FaStar />
                      <span>Saved Lakes</span>
                    </div>

                    <div
                      onClick={() => closeMenuAndNavigate("/reservations")}
                      className="main-user-dropdown-item responsive-menu-item"
                    >
                      <FaCalendarAlt />
                      <span>Reservations</span>
                      <Badge count={userReservationBadgeCount} />
                    </div>

                    <div
                      onClick={() => closeMenuAndNavigate("/become-owner")}
                      className="main-user-dropdown-item"
                    >
                      <FaFileSignature />
                      <span>Become Owner</span>
                    </div>

                    {isOwner && (
                      <div
                        onClick={() => closeMenuAndNavigate("/owner")}
                        className="main-user-dropdown-item responsive-menu-item"
                      >
                        <FaTools />
                        <span>Owner Panel</span>
                        <Badge count={ownerReservationBadgeCount} />
                      </div>
                    )}

                    {isAdmin && (
                      <div
                        onClick={() => closeMenuAndNavigate("/admin")}
                        className="main-user-dropdown-item responsive-menu-item"
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


        .main-nav-link.has-badge,
        .main-user-dropdown-item {
          position: relative;
        }

        .nav-notification-badge {
          min-width: 18px;
          height: 18px;
          padding: 0 6px;
          border-radius: 999px;
          background: #ef4444;
          color: white;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 11px;
          font-weight: 900;
          line-height: 1;
          box-shadow: 0 0 0 2px rgba(17, 24, 39, 0.92);
        }

        .main-user-dropdown-item .nav-notification-badge {
          margin-left: auto;
          box-shadow: none;
        }

        .main-user-menu-wrap {
          position: relative;
          display: flex;
          align-items: center;
        }

        .main-user-avatar-button {
          width: 42px;
          height: 42px;
          background: rgba(255, 255, 255, 0.08);
          color: white;
          border: 1px solid rgba(255, 255, 255, 0.14);
          border-radius: 999px;
          padding: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          opacity: 0.95;
          transition: background 0.18s ease, border-color 0.18s ease, transform 0.18s ease;
        }

        .main-user-avatar-button:hover,
        .main-user-avatar-button.open {
          opacity: 1;
          background: rgba(59, 130, 246, 0.22);
          border-color: rgba(96, 165, 250, 0.38);
        }

        .main-user-avatar-button.open {
          transform: rotate(90deg);
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

        .responsive-menu-item {
          display: none;
        }

        @media (max-width: 1380px) {
          .main-navigation-links {
            gap: 6px;
          }

          .main-navigation-links > .main-nav-link {
            display: none;
          }

          .responsive-menu-item {
            display: flex;
          }
        }

        @media (max-width: 1120px) {
          .main-navigation {
            height: 56px;
            padding: 0 12px;
          }

          .main-navigation-brand {
            font-size: 18px;
            margin-right: 10px;
          }

          .main-navigation-links {
            gap: 4px;
            min-width: 0;
          }

          .main-nav-link {
            padding: 8px 9px;
            border-radius: 11px;
            flex: 0 0 auto;
          }

          .main-nav-link span {
            display: none;
          }

          .responsive-menu-item {
            display: flex;
          }
        }

        @media (max-width: 720px) {
          .main-navigation-brand span {
            display: none;
          }
        }

        @media (max-width: 560px) {
          .main-navigation {
            overflow: visible;
            padding: 0 10px;
          }

          .main-navigation-brand {
            gap: 0;
            margin-right: 4px;
          }

          .main-navigation-links > .main-nav-link {
            display: none;
          }

          .main-user-avatar-button {
            width: 42px;
            height: 42px;
            justify-content: center;
          }

          .main-user-dropdown {
            right: -2px;
            top: 44px;
            min-width: min(248px, calc(100vw - 28px));
            max-height: calc(100svh - 76px);
            overflow-y: auto;
            border-radius: 14px;
          }

          .main-user-dropdown-header {
            padding: 9px 13px;
            font-size: 11px;
          }

          .main-user-dropdown-item {
            padding: 10px 13px;
            gap: 9px;
            font-size: 14px;
          }

          .main-user-dropdown-item svg {
            width: 16px;
            height: 16px;
            flex: 0 0 16px;
          }

          .responsive-menu-item {
            display: flex;
          }
        }

      `}</style>
    </>
  );
};

export default Navigation;