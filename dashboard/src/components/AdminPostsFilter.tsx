"use client";

import React, { useState, useEffect, useRef } from "react";

export type PostsFilterValue =
  | { type: "my-posts"; userId: string }
  | { type: "all-posts" }
  | { type: "user"; userId: string; userName: string };

export type UserListItem = {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
};

export type AdminPostsFilterProps = {
  /** Current user's role - dropdown only shows for admin */
  role: "admin" | "user";
  /** Current user's ID */
  currentUserId: string;
  /** Current user's display name (for "My Posts" label) */
  currentUserName?: string;
  /** API base URL for fetching user list */
  apiBase: string;
  /** Optional admin secret header */
  adminSecret?: string;
  /** Custom endpoint path for fetching users (default: /api/users) */
  usersEndpoint?: string;
  /** Callback when filter changes */
  onChange: (filter: PostsFilterValue) => void;
  /** Initial filter value */
  initialFilter?: PostsFilterValue;
  /** Accent colour for active state */
  accentColour?: "blue" | "emerald" | "pink" | "purple" | "amber";
};

const ACCENT_MAP: Record<string, { bg: string; text: string; ring: string }> = {
  blue: { bg: "bg-blue-500/20", text: "text-blue-400", ring: "ring-blue-500/30" },
  emerald: { bg: "bg-emerald-500/20", text: "text-emerald-400", ring: "ring-emerald-500/30" },
  pink: { bg: "bg-pink-500/20", text: "text-pink-400", ring: "ring-pink-500/30" },
  purple: { bg: "bg-purple-500/20", text: "text-purple-400", ring: "ring-purple-500/30" },
  amber: { bg: "bg-amber-500/20", text: "text-amber-400", ring: "ring-amber-500/30" },
};

function getUserDisplayName(user: UserListItem): string {
  const parts = [user.firstName, user.lastName].filter(Boolean);
  if (parts.length > 0) return parts.join(" ");
  if (user.email) return user.email;
  return user.id.slice(0, 8);
}

/**
 * AdminPostsFilter - a reusable dropdown for admin pages that lets
 * admins switch between "My Posts", "All Posts", and a specific user's posts.
 *
 * For non-admin users, this renders nothing (the filter is irrelevant).
 */
export default function AdminPostsFilter({
  role,
  currentUserId,
  currentUserName,
  apiBase,
  adminSecret,
  usersEndpoint = "/api/users",
  onChange,
  initialFilter,
  accentColour = "blue",
}: AdminPostsFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentFilter, setCurrentFilter] = useState<PostsFilterValue>(
    initialFilter || { type: "all-posts" }
  );
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const accent = ACCENT_MAP[accentColour] || ACCENT_MAP.blue;

  // Non-admin users do not see this filter
  if (role !== "admin") return null;

  // Fetch user list when dropdown opens for the first time
  useEffect(() => {
    if (!isOpen || users.length > 0 || loadingUsers) return;

    const fetchUsers = async () => {
      setLoadingUsers(true);
      try {
        console.log("[AdminPostsFilter] Fetching user list");
        const headers: Record<string, string> = {};
        if (adminSecret) headers["x-admin-key"] = adminSecret;

        const res = await fetch(`${apiBase}${usersEndpoint}`, { headers });
        if (res.ok) {
          const data = await res.json();
          // Support both { users: [...] } and direct array responses
          const userList: UserListItem[] = Array.isArray(data)
            ? data
            : data.users || [];
          console.log("[AdminPostsFilter] Loaded", userList.length, "users");
          setUsers(userList);
        } else {
          console.error("[AdminPostsFilter] Failed to fetch users:", res.status);
        }
      } catch (err) {
        console.error("[AdminPostsFilter] Error fetching users:", err);
      } finally {
        setLoadingUsers(false);
      }
    };

    fetchUsers();
  }, [isOpen, users.length, loadingUsers, apiBase, adminSecret, usersEndpoint]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearchQuery("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Focus search when dropdown opens
  useEffect(() => {
    if (isOpen && searchRef.current) {
      setTimeout(() => searchRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const handleSelect = (filter: PostsFilterValue) => {
    console.log("[AdminPostsFilter] Filter changed:", filter.type, filter.type === "user" ? filter.userId : "");
    setCurrentFilter(filter);
    onChange(filter);
    setIsOpen(false);
    setSearchQuery("");
  };

  const getLabel = (): string => {
    switch (currentFilter.type) {
      case "my-posts":
        return currentUserName ? `My Posts (${currentUserName})` : "My Posts";
      case "all-posts":
        return "All Posts";
      case "user":
        return currentFilter.userName;
    }
  };

  // Filter users by search query
  const filteredUsers = users.filter((u) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const name = getUserDisplayName(u).toLowerCase();
    const email = (u.email || "").toLowerCase();
    return name.includes(q) || email.includes(q);
  });

  return (
    <div ref={dropdownRef} className="relative inline-block">
      {/* Trigger button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${accent.bg} ${accent.text} hover:opacity-80 ring-1 ${accent.ring}`}
      >
        <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
          <path
            fillRule="evenodd"
            d="M3 3a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-.293.707L12 11.414V15a1 1 0 01-.293.707l-2 2A1 1 0 018 17v-5.586L3.293 6.707A1 1 0 013 6V3z"
            clipRule="evenodd"
          />
        </svg>
        {getLabel()}
        <svg
          viewBox="0 0 20 20"
          fill="currentColor"
          className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
        >
          <path
            fillRule="evenodd"
            d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {/* Dropdown panel */}
      {isOpen && (
        <div className="absolute left-0 top-full mt-2 w-72 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl z-50 overflow-hidden">
          {/* Fixed options */}
          <div className="border-b border-gray-800">
            <button
              onClick={() => handleSelect({ type: "all-posts" })}
              className={`w-full text-left px-4 py-3 text-sm transition-colors flex items-center gap-3 ${
                currentFilter.type === "all-posts"
                  ? `${accent.bg} ${accent.text} font-medium`
                  : "text-gray-300 hover:bg-gray-800"
              }`}
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 flex-shrink-0">
                <path d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a2 2 0 012-2h12a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4z" />
              </svg>
              All Posts
            </button>
            <button
              onClick={() => handleSelect({ type: "my-posts", userId: currentUserId })}
              className={`w-full text-left px-4 py-3 text-sm transition-colors flex items-center gap-3 ${
                currentFilter.type === "my-posts"
                  ? `${accent.bg} ${accent.text} font-medium`
                  : "text-gray-300 hover:bg-gray-800"
              }`}
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 flex-shrink-0">
                <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
              </svg>
              My Posts
            </button>
          </div>

          {/* User search */}
          <div className="p-2 border-b border-gray-800">
            <div className="relative">
              <svg
                viewBox="0 0 20 20"
                fill="currentColor"
                className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
              >
                <path
                  fillRule="evenodd"
                  d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
                  clipRule="evenodd"
                />
              </svg>
              <input
                ref={searchRef}
                type="text"
                placeholder="Search users..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-gray-800 text-gray-200 text-sm rounded-lg pl-9 pr-3 py-2 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-600"
              />
            </div>
          </div>

          {/* User list */}
          <div className="max-h-64 overflow-y-auto">
            {loadingUsers ? (
              <div className="flex items-center justify-center py-6">
                <div className="w-5 h-5 border-2 border-gray-600 border-t-gray-300 rounded-full animate-spin" />
                <span className="ml-2 text-gray-500 text-sm">Loading users...</span>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="text-center py-6 text-gray-500 text-sm">
                {searchQuery ? "No users match your search" : "No users found"}
              </div>
            ) : (
              filteredUsers.map((user) => {
                const isSelected =
                  currentFilter.type === "user" && currentFilter.userId === user.id;
                const displayName = getUserDisplayName(user);
                return (
                  <button
                    key={user.id}
                    onClick={() =>
                      handleSelect({
                        type: "user",
                        userId: user.id,
                        userName: displayName,
                      })
                    }
                    className={`w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center gap-3 ${
                      isSelected
                        ? `${accent.bg} ${accent.text} font-medium`
                        : "text-gray-300 hover:bg-gray-800"
                    }`}
                  >
                    <div className="w-6 h-6 rounded-full bg-gray-700 flex items-center justify-center text-xs text-gray-400 flex-shrink-0 uppercase">
                      {(user.firstName?.[0] || user.email?.[0] || "?").toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate">{displayName}</div>
                      {user.email && displayName !== user.email && (
                        <div className="text-xs text-gray-500 truncate">{user.email}</div>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
