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
} from "react-icons/fa6";
import { MdDashboard } from "react-icons/md";
import { IoClose, IoIosArrowDown, IoIosArrowUp } from "react-icons/io";

/* ── Types ─────────────────────────────────────────────────────────────── */

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

export type AdminSidebarProps = {
  /** Brand name shown in the header, e.g. "Fat Big Quiz" */
  brandName: string;
  /**
   * Tailwind colour keyword for the active-state accent.
   * Mapped to predefined classes (not dynamic) to stay Tailwind-safe.
   * Options: "emerald" | "pink" | "blue" | "amber" | "indigo" | "purple"
   * Default: "blue"
   */
  accentColour?: string;
  /** Site-specific nav items rendered ABOVE the core 9 */
  customNavItems?: NavItem[];
  /** Override specific core items by label (e.g. replace "Blog" with a custom submenu) */
  coreNavOverrides?: Record<string, NavItem>;
  /** Hide specific core items by label */
  hideCore?: string[];
  /** Content rendered below the nav (sign-out button, credits, etc.) */
  footerSlot?: React.ReactNode;
  /** Subtitle under the brand name (e.g. user email) */
  subtitle?: string;
};

/* ── Accent colour mapping (Tailwind-safe, no dynamic classes) ─────── */

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

/* ── Core 9 nav items (always present unless hidden) ───────────────── */

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

/* ── Component ─────────────────────────────────────────────────────── */

export function AdminSidebar({
  brandName,
  accentColour = "blue",
  customNavItems = [],
  coreNavOverrides = {},
  hideCore = [],
  footerSlot,
  subtitle,
}: AdminSidebarProps) {
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

  // Final nav: custom items first, then a divider concept, then core
  const allItems = [...customNavItems, ...coreItems];

  // Active state check
  const isActive = (href?: string) => {
    if (!href) return false;
    if (href === "/admin") return pathname === "/admin";
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
          {/* Custom items */}
          {customNavItems.length > 0 && (
            <>
              {customNavItems.map((item, i) => (
                <React.Fragment key={item.path || item.label || i}>
                  {item.subItems ? renderGroup(item) : renderLink(item)}
                </React.Fragment>
              ))}
              {/* Divider between custom and core */}
              <div className="my-3 mx-5 border-t border-gray-800" />
            </>
          )}

          {/* Core items */}
          {coreItems.map((item, i) => (
            <React.Fragment key={item.path || item.label || i}>
              {item.subItems ? renderGroup(item) : renderLink(item)}
            </React.Fragment>
          ))}
        </nav>

        {/* Footer slot */}
        {footerSlot && (
          <div className="border-t border-gray-800">{footerSlot}</div>
        )}
      </div>
    </>
  );
}
