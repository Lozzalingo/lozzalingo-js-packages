"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FaChartBar,
  FaNewspaper,
  FaEnvelope,
  FaHeartPulse,
  FaFileLines,
  FaCloud,
  FaWrench,
  FaGear,
  FaBars,
  FaRightFromBracket,
} from "react-icons/fa6";
import { MdDashboard } from "react-icons/md";
import { IoIosArrowDown, IoIosArrowUp } from "react-icons/io";
import { IoClose } from "react-icons/io5";

/* -- Types ---------------------------------------------------------------- */

export type NavSubItem = {
  path: string;
  icon: React.ReactNode;
  label: string;
  id?: string;
};

export type NavItem = {
  path?: string;
  icon: React.ReactNode;
  label: string;
  id?: string;
  subItems?: NavSubItem[];
};

export type UnifiedSidebarProps = {
  /** Brand name shown in the header, e.g. "Fat Big Quiz" */
  brandName: string;
  /**
   * Tailwind colour keyword for the active-state accent.
   * Mapped to predefined classes (not dynamic) to stay Tailwind-safe.
   * Options: "emerald" | "pink" | "blue" | "amber" | "indigo" | "purple"
   * Default: "blue"
   */
  accentColour?: string;

  /* -- Legacy props (backward compatible, admin-only mode) --------------- */

  /** Site-specific nav items rendered ABOVE the core admin items (legacy mode) */
  customNavItems?: NavItem[];
  /** Override specific core items by label (e.g. replace "Blog" with a custom submenu) */
  coreNavOverrides?: Record<string, NavItem>;
  /** Hide specific core items by label */
  hideCore?: string[];

  /* -- New unified props ------------------------------------------------- */

  /**
   * User role. When provided alongside userNavItems, enables unified mode
   * with separate user and admin sections.
   * "admin" shows both user and admin sections.
   * "user" shows only the user section.
   */
  role?: "admin" | "user";
  /** Nav items for the user section (visible to all authenticated users) */
  userNavItems?: NavItem[];
  /** Nav items for the admin section (visible only when role === "admin") */
  adminNavItems?: NavItem[];
  /**
   * URL prefix for active-state matching on user section items.
   * Defaults to "/admin". Apps can set their own prefix, e.g. "/dashboard".
   */
  basePath?: string;

  /* -- Common props ------------------------------------------------------ */

  /** Content rendered below the nav (credits widget, etc.) */
  footerSlot?: React.ReactNode;
  /** Subtitle under the brand name (e.g. user email) */
  subtitle?: string;
  /**
   * Called when the user clicks the sign-out button.
   * When provided, a sign-out button is rendered at the bottom of the sidebar.
   */
  onSignOut?: () => void;
};

/** @deprecated Use UnifiedSidebarProps instead */
export type AdminSidebarProps = UnifiedSidebarProps;

/* -- Accent colour mapping (Tailwind-safe, no dynamic classes) ----------- */

const ACCENT_CLASSES: Record<string, { active: string; border: string }> = {
  emerald: {
    active: "bg-emerald-600/20 text-emerald-400",
    border: "border-r-2 border-emerald-500",
  },
  pink: {
    active: "bg-pink-600/20 text-pink-400",
    border: "border-r-2 border-pink-500",
  },
  blue: {
    active: "bg-blue-600/20 text-blue-400",
    border: "border-r-2 border-blue-500",
  },
  amber: {
    active: "bg-amber-600/20 text-amber-400",
    border: "border-r-2 border-amber-500",
  },
  indigo: {
    active: "bg-indigo-600/20 text-indigo-400",
    border: "border-r-2 border-indigo-500",
  },
  purple: {
    active: "bg-purple-600/20 text-purple-400",
    border: "border-r-2 border-purple-500",
  },
};

/* -- Core admin nav items (always present unless hidden) ----------------- */

function getCoreNavItems(): NavItem[] {
  return [
    {
      path: "/admin",
      icon: <MdDashboard className="text-lg" />,
      label: "Dashboard",
      id: "dashboard",
    },
    {
      path: "/admin/analytics",
      icon: <FaChartBar className="text-lg" />,
      label: "Analytics",
      id: "analytics",
    },
    {
      path: "/admin/blog",
      icon: <FaNewspaper className="text-lg" />,
      label: "Blog",
      id: "blog",
    },
    {
      path: "/admin/email",
      icon: <FaEnvelope className="text-lg" />,
      label: "Email",
      id: "email",
    },
    {
      path: "/admin/ops",
      icon: <FaHeartPulse className="text-lg" />,
      label: "Ops/Health",
      id: "ops",
    },
    {
      path: "/admin/logs",
      icon: <FaFileLines className="text-lg" />,
      label: "Logs",
      id: "logs",
    },
    {
      path: "/admin/storage",
      icon: <FaCloud className="text-lg" />,
      label: "Storage",
      id: "storage",
    },
    {
      path: "/admin/config",
      icon: <FaWrench className="text-lg" />,
      label: "Config",
      id: "config",
    },
    {
      path: "/admin/settings",
      icon: <FaGear className="text-lg" />,
      label: "Settings",
      id: "settings",
    },
  ];
}

/* -- Component ----------------------------------------------------------- */

export function UnifiedSidebar({
  brandName,
  accentColour = "blue",
  customNavItems = [],
  coreNavOverrides = {},
  hideCore = [],
  role,
  userNavItems,
  adminNavItems,
  basePath = "/admin",
  footerSlot,
  subtitle,
  onSignOut,
}: UnifiedSidebarProps) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("adminSidebarOpenMenus");
      return saved ? JSON.parse(saved) : {};
    }
    return {};
  });

  const accent = ACCENT_CLASSES[accentColour] || ACCENT_CLASSES.blue;

  // Determine if we are in unified mode (role + userNavItems provided)
  const isUnifiedMode = !!(role && userNavItems);

  console.log("[UnifiedSidebar] Mode:", isUnifiedMode ? "unified" : "legacy", "| Role:", role || "n/a");

  // Responsive behaviour
  useEffect(() => {
    const check = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      setIsOpen(!mobile);
    };
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const toggleMenu = (label: string) => {
    setOpenMenus((prev) => {
      const next = { ...prev, [label]: !prev[label] };
      localStorage.setItem("adminSidebarOpenMenus", JSON.stringify(next));
      return next;
    });
  };

  // Build core items with overrides and hiding
  const coreItems = getCoreNavItems()
    .filter((item) => !hideCore.includes(item.label))
    .map((item) => coreNavOverrides[item.label] || item);

  // Active state check
  const isActive = (href?: string) => {
    if (!href) return false;
    // Exact match for the base path root (e.g. "/admin" or "/dashboard")
    if (href === basePath) return pathname === basePath;
    return pathname.startsWith(href);
  };

  // Render a single nav link
  const renderLink = (item: NavItem, isSubItem = false) => {
    if (!item.path) return null;
    const active = isActive(item.path);
    return (
      <Link
        href={item.path}
        className={`
          flex items-center gap-x-4 px-6 ${isSubItem ? "py-3" : "py-3.5"} text-sm font-medium transition
          ${active
            ? `${accent.active} ${accent.border}`
            : `text-gray-400 hover:text-white hover:bg-gray-800`
          }
        `}
        onClick={() => isMobile && setIsOpen(false)}
      >
        <span className={`${isSubItem ? "text-base" : "text-lg"} ${active ? "" : "text-gray-500"}`}>
          {item.icon}
        </span>
        <span>{item.label}</span>
      </Link>
    );
  };

  // Render a collapsible group
  const renderGroup = (item: NavItem) => {
    const expanded = openMenus[item.label] || false;
    const childActive = item.subItems?.some((si) => isActive(si.path));
    return (
      <div>
        <button
          type="button"
          className={`
            w-full flex items-center justify-between gap-x-4 px-6 py-3.5 text-sm font-medium transition cursor-pointer
            ${childActive
              ? `${accent.active}`
              : "text-gray-400 hover:text-white hover:bg-gray-800"
            }
          `}
          onClick={() => toggleMenu(item.label)}
        >
          <div className="flex items-center gap-x-4">
            <span className={`text-lg ${childActive ? "" : "text-gray-500"}`}>
              {item.icon}
            </span>
            <span>{item.label}</span>
          </div>
          {expanded ? (
            <IoIosArrowUp className="text-gray-400 text-sm" />
          ) : (
            <IoIosArrowDown className="text-gray-400 text-sm" />
          )}
        </button>
        {expanded && (
          <div className="pl-6">
            {item.subItems?.map((sub, i) => (
              <React.Fragment key={sub.path || i}>
                {renderLink({ ...sub }, true)}
              </React.Fragment>
            ))}
          </div>
        )}
      </div>
    );
  };

  // Render a list of nav items
  const renderItems = (items: NavItem[]) =>
    items.map((item, i) => (
      <React.Fragment key={item.path || item.label || i}>
        {item.subItems ? renderGroup(item) : renderLink(item)}
      </React.Fragment>
    ));

  // Section heading label
  const renderSectionLabel = (label: string) => (
    <div className="px-5 pt-4 pb-2">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-500">
        {label}
      </p>
    </div>
  );

  return (
    <>
      {/* Mobile hamburger */}
      <div className="md:hidden fixed top-4 left-4 z-50">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="p-2 rounded-md bg-gray-900 text-gray-200 hover:bg-gray-800 transition-all"
        >
          {isOpen ? <IoClose className="text-xl" /> : <FaBars className="text-xl" />}
        </button>
      </div>

      {/* Mobile overlay */}
      {isMobile && isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Spacer for desktop layout */}
      {isOpen && <div className="hidden md:block w-[250px] min-w-[250px] flex-shrink-0" />}

      {/* Sidebar */}
      <div
        className={`
          ${isOpen ? "translate-x-0" : "-translate-x-full"}
          w-[250px] min-w-[250px] bg-gray-900 h-screen flex-shrink-0
          fixed top-0 left-0 z-40
          transform transition-transform duration-300 ease-in-out
          flex flex-col
        `}
      >
        {/* Header */}
        <div className="py-5 px-5 border-b border-gray-800">
          <h2 className="text-white font-bold text-lg">{brandName}</h2>
          {subtitle && (
            <p className="text-gray-500 text-xs mt-1 truncate">{subtitle}</p>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 overflow-y-auto">
          {isUnifiedMode ? (
            <>
              {/* USER SECTION - visible to all authenticated users */}
              {userNavItems && userNavItems.length > 0 && (
                <>
                  {renderItems(userNavItems)}
                </>
              )}

              {/* ADMIN SECTION - only visible when role === "admin" */}
              {role === "admin" && (
                <>
                  <div className="my-3 mx-5 border-t border-gray-800" />
                  {renderSectionLabel("Admin")}

                  {/* Admin nav items passed via adminNavItems prop */}
                  {adminNavItems && adminNavItems.length > 0 && (
                    <>
                      {renderItems(adminNavItems)}
                      {/* Divider between admin nav items and core items */}
                      {coreItems.length > 0 && (
                        <div className="my-3 mx-5 border-t border-gray-800" />
                      )}
                    </>
                  )}

                  {/* Core admin items */}
                  {renderItems(coreItems)}
                </>
              )}
            </>
          ) : (
            <>
              {/* LEGACY MODE - behaves exactly as the old AdminSidebar */}
              {customNavItems.length > 0 && (
                <>
                  {renderItems(customNavItems)}
                  {/* Divider between custom and core */}
                  <div className="my-3 mx-5 border-t border-gray-800" />
                </>
              )}

              {/* Core items */}
              {renderItems(coreItems)}
            </>
          )}
        </nav>

        {/* Footer slot */}
        {footerSlot && (
          <div className="border-t border-gray-800">{footerSlot}</div>
        )}

        {/* Sign-out button */}
        {onSignOut && (
          <div className={`${footerSlot ? "" : "border-t border-gray-800"} p-4`}>
            <button
              type="button"
              onClick={() => {
                console.log("[UnifiedSidebar] Sign out clicked");
                onSignOut();
              }}
              className="w-full flex items-center gap-x-3 px-3 py-2.5 text-sm font-medium text-gray-400 hover:text-white hover:bg-gray-800 rounded-md transition cursor-pointer"
            >
              <FaRightFromBracket className="text-base text-gray-500" />
              <span>Sign Out</span>
            </button>
          </div>
        )}
      </div>
    </>
  );
}

/**
 * @deprecated Use UnifiedSidebar instead. AdminSidebar is kept for backward
 * compatibility and behaves identically when only legacy props are passed.
 */
export const AdminSidebar = UnifiedSidebar;
