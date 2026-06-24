"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  useModulePage,
  ModulePageHeader,
  ModulePageSkeleton,
  ModulePageEmpty,
} from "./shared";

// -- Types --------------------------------------------------------------------

type Customer = {
  id: string;
  customerNumber: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  company?: string;
  status: "ACTIVE" | "UNSUBSCRIBED" | "BOUNCED";
  marketingOptIn: boolean;
  totalBookings: number;
  totalSpent: number;
  source?: string;
  lastActivityAt?: string;
  createdAt: string;
  score?: { score: number };
};

type DashboardStats = {
  totalCustomers: number;
  activeCustomers: number;
  unsubscribed: number;
  averageScore: number;
  maxScore: number;
  recentActivityCount: number;
  topCustomers: Array<{
    id: string;
    customerNumber: string;
    firstName: string;
    lastName: string;
    email: string;
    company?: string;
    score: number;
  }>;
};

type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

type CustomerDetail = Customer & {
  jobTitle?: string;
  dateOfBirth?: string;
  country?: string;
  region?: string;
  referralName?: string;
  referralEmail?: string;
  notes?: string;
  score?: { score: number; breakdown?: Record<string, number> };
  activities?: Array<{
    id: string;
    type: string;
    source?: string;
    channel?: string;
    productName?: string;
    productCategory?: string;
    createdAt: string;
  }>;
  marketingPreferences?: Array<{
    id: string;
    preference: string;
    optedIn: boolean;
  }>;
};

// -- Main Component -----------------------------------------------------------

export default function CrmPage() {
  const { apiBase, adminSecret } = useModulePage();

  // State
  const [view, setView] = useState<"list" | "detail">("list");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [selectedCustomer, setSelectedCustomer] =
    useState<CustomerDetail | null>(null);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const headers = useCallback((): Record<string, string> => {
    const h: Record<string, string> = {};
    if (adminSecret) h["x-admin-key"] = adminSecret;
    return h;
  }, [adminSecret]);

  // -- Fetch functions --------------------------------------------------------

  const fetchDashboard = useCallback(async () => {
    try {
      console.log("[CrmAdmin] Fetching dashboard stats");
      const res = await fetch(`${apiBase}/api/crm/dashboard`, {
        headers: headers(),
      });
      if (res.ok) {
        const data = await res.json();
        setStats(data);
        console.log("[CrmAdmin] Dashboard loaded:", data.totalCustomers, "customers");
      } else {
        console.error("[CrmAdmin] Failed to fetch dashboard:", res.status);
      }
    } catch (err) {
      console.error("[CrmAdmin] Error fetching dashboard:", err);
    }
  }, [apiBase, headers]);

  const fetchCustomers = useCallback(
    async (page = 1) => {
      try {
        console.log("[CrmAdmin] Fetching customers, page:", page);
        const params = new URLSearchParams({
          page: String(page),
          limit: String(pagination.limit),
          sortBy,
          sortOrder,
        });
        if (search) params.set("search", search);
        if (statusFilter) params.set("status", statusFilter);

        const res = await fetch(
          `${apiBase}/api/crm/customers?${params.toString()}`,
          { headers: headers() }
        );

        if (res.ok) {
          const data = await res.json();
          setCustomers(data.customers || []);
          if (data.pagination) setPagination(data.pagination);
          console.log(
            "[CrmAdmin] Loaded",
            data.customers?.length || 0,
            "customers"
          );
        } else {
          console.error("[CrmAdmin] Failed to fetch customers:", res.status);
        }
      } catch (err) {
        console.error("[CrmAdmin] Error fetching customers:", err);
      } finally {
        setLoading(false);
      }
    },
    [apiBase, headers, pagination.limit, search, statusFilter, sortBy, sortOrder]
  );

  const fetchCustomerDetail = useCallback(
    async (id: string) => {
      try {
        console.log("[CrmAdmin] Fetching customer detail:", id);
        const res = await fetch(`${apiBase}/api/crm/customers/${id}`, {
          headers: headers(),
        });
        if (res.ok) {
          const data = await res.json();
          setSelectedCustomer(data);
          setView("detail");
          console.log("[CrmAdmin] Loaded customer:", data.customerNumber);
        } else {
          console.error("[CrmAdmin] Failed to fetch customer:", res.status);
        }
      } catch (err) {
        console.error("[CrmAdmin] Error fetching customer:", err);
      }
    },
    [apiBase, headers]
  );

  // -- Effects ----------------------------------------------------------------

  useEffect(() => {
    fetchDashboard();
    fetchCustomers();
  }, []);

  useEffect(() => {
    setLoading(true);
    const timer = setTimeout(() => {
      fetchCustomers(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search, statusFilter, sortBy, sortOrder]);

  // -- Handlers ---------------------------------------------------------------

  const handlePageChange = (page: number) => {
    setLoading(true);
    fetchCustomers(page);
  };

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortOrder("desc");
    }
  };

  const handleBack = () => {
    setView("list");
    setSelectedCustomer(null);
  };

  const handleDelete = async (id: string, customerNumber: string) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete customer ${customerNumber}? This will remove all their activities, scores, and campaign history. This cannot be undone.`
    );
    if (!confirmed) return;

    try {
      console.log("[CrmAdmin] Deleting customer:", customerNumber);
      const res = await fetch(`${apiBase}/api/crm/customers/${id}`, {
        method: "DELETE",
        headers: headers(),
      });

      if (res.ok) {
        console.log("[CrmAdmin] Deleted:", customerNumber);
        // If we're in detail view, go back to list
        if (view === "detail") {
          setView("list");
          setSelectedCustomer(null);
        }
        // Refresh the list and stats
        fetchCustomers(pagination.page);
        fetchDashboard();
      } else {
        const data = await res.json();
        console.error("[CrmAdmin] Failed to delete:", data.error);
        alert(`Failed to delete customer: ${data.error}`);
      }
    } catch (err) {
      console.error("[CrmAdmin] Error deleting customer:", err);
      alert("Failed to delete customer. Check the console for details.");
    }
  };

  // -- Icon -------------------------------------------------------------------

  const icon = (
    <svg
      viewBox="0 0 20 20"
      fill="currentColor"
      className="w-8 h-8 text-violet-400"
    >
      <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
    </svg>
  );

  // -- Render: Customer Detail ------------------------------------------------

  if (view === "detail" && selectedCustomer) {
    return (
      <div className="p-8 text-white">
        {/* Custom back link that uses onClick instead of href */}
        <button
          onClick={handleBack}
          className="inline-flex items-center gap-2 text-gray-400 hover:text-white text-sm mb-6 transition"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
            <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
          </svg>
          Customers
        </button>
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              {icon} {selectedCustomer.firstName} {selectedCustomer.lastName}
            </h1>
            <p className="text-gray-400 mt-1">
              {selectedCustomer.customerNumber} - {selectedCustomer.email}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() =>
                handleDelete(selectedCustomer.id, selectedCustomer.customerNumber)
              }
              className="inline-flex items-center gap-2 bg-red-600/20 hover:bg-red-600/40 text-red-400 hover:text-red-300 text-sm font-medium px-4 py-2.5 rounded-lg transition"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              Delete
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Customer info card */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
              Customer Details
            </h3>
            <div className="space-y-3 text-sm">
              <DetailRow label="Status">
                <StatusBadge status={selectedCustomer.status} />
              </DetailRow>
              <DetailRow label="Email" value={selectedCustomer.email} />
              <DetailRow label="Phone" value={selectedCustomer.phone} />
              <DetailRow label="Company" value={selectedCustomer.company} />
              <DetailRow label="Job Title" value={selectedCustomer.jobTitle} />
              <DetailRow label="Country" value={selectedCustomer.country} />
              <DetailRow label="Region" value={selectedCustomer.region} />
              <DetailRow label="Source" value={selectedCustomer.source} />
              <DetailRow
                label="Marketing Opt-in"
                value={selectedCustomer.marketingOptIn ? "Yes" : "No"}
              />
              {selectedCustomer.referralName && (
                <DetailRow
                  label="Referral"
                  value={selectedCustomer.referralName}
                />
              )}
              {selectedCustomer.notes && (
                <DetailRow label="Notes" value={selectedCustomer.notes} />
              )}
              <DetailRow
                label="Created"
                value={formatDate(selectedCustomer.createdAt)}
              />
              <DetailRow
                label="Last Activity"
                value={formatDate(selectedCustomer.lastActivityAt)}
              />
            </div>
          </div>

          {/* Score card */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
              CRM Score
            </h3>
            <div className="text-center py-4">
              <span className="text-5xl font-bold text-violet-400">
                {selectedCustomer.score?.score ?? 0}
              </span>
              <p className="text-gray-500 text-xs mt-1">points</p>
            </div>
            {selectedCustomer.score?.breakdown && (
              <div className="space-y-2">
                {Object.entries(selectedCustomer.score.breakdown).map(
                  ([key, val]) => (
                    <div
                      key={key}
                      className="flex items-center justify-between text-xs"
                    >
                      <span className="text-gray-400 capitalize">{key}</span>
                      <span
                        className={
                          typeof val === "number" && val < 0
                            ? "text-red-400"
                            : "text-emerald-400"
                        }
                      >
                        {typeof val === "number" && val > 0 ? "+" : ""}
                        {val}
                      </span>
                    </div>
                  )
                )}
              </div>
            )}
            <div className="pt-2 space-y-2 text-sm">
              <DetailRow
                label="Bookings"
                value={String(selectedCustomer.totalBookings)}
              />
              <DetailRow
                label="Total Spent"
                value={formatPence(selectedCustomer.totalSpent)}
              />
            </div>
          </div>

          {/* Marketing Preferences */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
              Marketing Preferences
            </h3>
            {selectedCustomer.marketingPreferences &&
            selectedCustomer.marketingPreferences.length > 0 ? (
              <div className="space-y-2">
                {selectedCustomer.marketingPreferences.map((pref) => (
                  <div
                    key={pref.id}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="text-gray-300">{pref.preference}</span>
                    <span
                      className={
                        pref.optedIn ? "text-emerald-400" : "text-red-400"
                      }
                    >
                      {pref.optedIn ? "Opted in" : "Opted out"}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-sm">No preferences set</p>
            )}
          </div>
        </div>

        {/* Activity history */}
        {selectedCustomer.activities &&
          selectedCustomer.activities.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3">
                Recent Activity
              </h3>
              <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-800 text-gray-400 text-xs uppercase tracking-wider">
                      <th className="text-left p-4">Type</th>
                      <th className="text-left p-4">Product</th>
                      <th className="text-left p-4">Channel</th>
                      <th className="text-left p-4">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedCustomer.activities.map((act) => (
                      <tr
                        key={act.id}
                        className="border-b border-gray-800/50 hover:bg-gray-800/30"
                      >
                        <td className="p-4">
                          <ActivityTypeBadge type={act.type} />
                        </td>
                        <td className="p-4 text-gray-300">
                          {act.productName || act.productCategory || "-"}
                        </td>
                        <td className="p-4 text-gray-400 text-xs">
                          {act.channel || act.source || "-"}
                        </td>
                        <td className="p-4 text-gray-400 text-xs">
                          {formatDate(act.createdAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
      </div>
    );
  }

  // -- Render: Customer List --------------------------------------------------

  return (
    <div className="p-8 text-white">
      <ModulePageHeader icon={icon} title="CRM" description="Customer relationship management">
        <div className="flex items-center gap-3">
          <span className="text-gray-400 text-sm">
            {stats
              ? `${stats.totalCustomers} customers, avg score ${stats.averageScore}`
              : "Loading..."}
          </span>
        </div>
      </ModulePageHeader>

      {/* Stats cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatCard
            label="Total Customers"
            value={stats.totalCustomers}
            colour="violet"
          />
          <StatCard
            label="Active"
            value={stats.activeCustomers}
            colour="emerald"
          />
          <StatCard
            label="Unsubscribed"
            value={stats.unsubscribed}
            colour="amber"
          />
          <StatCard
            label="Avg Score"
            value={stats.averageScore}
            colour="blue"
          />
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <input
          type="text"
          placeholder="Search by name, email, company, or #number..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-[250px] bg-gray-900 border border-gray-700 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-violet-500 transition"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-gray-900 border border-gray-700 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500 transition"
        >
          <option value="">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="UNSUBSCRIBED">Unsubscribed</option>
          <option value="BOUNCED">Bounced</option>
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <ModulePageSkeleton rows={6} />
      ) : customers.length === 0 ? (
        <ModulePageEmpty
          icon={icon}
          message="No customers found."
          hint="Try adjusting your search or filters."
        />
      ) : (
        <div className="space-y-6">
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-gray-400 text-xs uppercase tracking-wider">
                  <SortHeader
                    label="#"
                    field="customerNumber"
                    current={sortBy}
                    order={sortOrder}
                    onClick={handleSort}
                  />
                  <SortHeader
                    label="Name"
                    field="firstName"
                    current={sortBy}
                    order={sortOrder}
                    onClick={handleSort}
                  />
                  <th className="text-left p-4">Email</th>
                  <th className="text-left p-4 w-24">Status</th>
                  <th className="text-left p-4 w-20">Score</th>
                  <th className="text-left p-4 w-24">Bookings</th>
                  <SortHeader
                    label="Last Active"
                    field="lastActivityAt"
                    current={sortBy}
                    order={sortOrder}
                    onClick={handleSort}
                  />
                  <th className="text-left p-4 w-20">Actions</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((customer) => (
                  <tr
                    key={customer.id}
                    className="border-b border-gray-800/50 hover:bg-gray-800/30 cursor-pointer"
                    onClick={() => fetchCustomerDetail(customer.id)}
                  >
                    <td className="p-4 text-violet-400 font-mono text-xs">
                      {customer.customerNumber}
                    </td>
                    <td className="p-4 text-gray-200 font-medium">
                      {customer.firstName} {customer.lastName}
                    </td>
                    <td className="p-4 text-gray-400 text-xs">
                      {customer.email}
                    </td>
                    <td className="p-4">
                      <StatusBadge status={customer.status} />
                    </td>
                    <td className="p-4">
                      <ScoreBadge score={customer.score?.score ?? 0} />
                    </td>
                    <td className="p-4 text-gray-300 text-center">
                      {customer.totalBookings || 0}
                    </td>
                    <td className="p-4 text-gray-400 text-xs">
                      {formatDate(customer.lastActivityAt)}
                    </td>
                    <td className="p-4">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          fetchCustomerDetail(customer.id);
                        }}
                        className="text-violet-400 hover:text-violet-300 text-xs font-medium transition"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              {pagination.page > 1 && (
                <button
                  onClick={() => handlePageChange(pagination.page - 1)}
                  className="px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white transition"
                >
                  Prev
                </button>
              )}
              {Array.from(
                { length: Math.min(pagination.totalPages, 10) },
                (_, i) => {
                  // Show pages around current page
                  const start = Math.max(
                    1,
                    pagination.page - 4
                  );
                  const pageNum = start + i;
                  if (pageNum > pagination.totalPages) return null;
                  return (
                    <button
                      key={pageNum}
                      onClick={() => handlePageChange(pageNum)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                        pagination.page === pageNum
                          ? "bg-violet-600 text-white"
                          : "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white"
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                }
              )}
              {pagination.page < pagination.totalPages && (
                <button
                  onClick={() => handlePageChange(pagination.page + 1)}
                  className="px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white transition"
                >
                  Next
                </button>
              )}
            </div>
          )}

          <p className="text-center text-gray-500 text-xs">
            Showing {customers.length} of {pagination.total} customers
          </p>
        </div>
      )}
    </div>
  );
}

// -- Sub-components -----------------------------------------------------------

function StatCard({
  label,
  value,
  colour,
}: {
  label: string;
  value: number;
  colour: string;
}) {
  const colourMap: Record<string, string> = {
    violet: "text-violet-400 border-violet-500/30",
    emerald: "text-emerald-400 border-emerald-500/30",
    amber: "text-amber-400 border-amber-500/30",
    blue: "text-blue-400 border-blue-500/30",
    red: "text-red-400 border-red-500/30",
  };
  const cls = colourMap[colour] || colourMap.violet;

  return (
    <div
      className={`bg-gray-900 border border-gray-800 rounded-xl p-4 ${cls.split(" ")[1]}`}
    >
      <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">
        {label}
      </p>
      <p className={`text-2xl font-bold ${cls.split(" ")[0]}`}>
        {value.toLocaleString()}
      </p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    ACTIVE: "bg-emerald-500/20 text-emerald-400",
    UNSUBSCRIBED: "bg-amber-500/20 text-amber-400",
    BOUNCED: "bg-red-500/20 text-red-400",
  };
  const dotStyles: Record<string, string> = {
    ACTIVE: "bg-emerald-400",
    UNSUBSCRIBED: "bg-amber-400",
    BOUNCED: "bg-red-400",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
        styles[status] || styles.ACTIVE
      }`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${
          dotStyles[status] || dotStyles.ACTIVE
        }`}
      />
      {status === "ACTIVE"
        ? "Active"
        : status === "UNSUBSCRIBED"
          ? "Unsubscribed"
          : "Bounced"}
    </span>
  );
}

function ScoreBadge({ score }: { score: number }) {
  let colour = "text-gray-500";
  if (score >= 50) colour = "text-violet-400";
  else if (score >= 30) colour = "text-blue-400";
  else if (score >= 15) colour = "text-emerald-400";

  return <span className={`font-mono text-xs font-bold ${colour}`}>{score}</span>;
}

function ActivityTypeBadge({ type }: { type: string }) {
  const styles: Record<string, string> = {
    GAME_PLAYED: "bg-violet-500/20 text-violet-400",
    PRODUCT_USED: "bg-blue-500/20 text-blue-400",
    WEBSITE_VISIT: "bg-gray-500/20 text-gray-400",
    APP_INTERACTION: "bg-cyan-500/20 text-cyan-400",
    FREE_CONTENT: "bg-emerald-500/20 text-emerald-400",
    ENQUIRY: "bg-amber-500/20 text-amber-400",
    SIGNUP: "bg-pink-500/20 text-pink-400",
  };

  const labels: Record<string, string> = {
    GAME_PLAYED: "Game Played",
    PRODUCT_USED: "Product Used",
    WEBSITE_VISIT: "Website Visit",
    APP_INTERACTION: "App Interaction",
    FREE_CONTENT: "Free Content",
    ENQUIRY: "Enquiry",
    SIGNUP: "Sign Up",
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
        styles[type] || "bg-gray-500/20 text-gray-400"
      }`}
    >
      {labels[type] || type}
    </span>
  );
}

function SortHeader({
  label,
  field,
  current,
  order,
  onClick,
}: {
  label: string;
  field: string;
  current: string;
  order: string;
  onClick: (field: string) => void;
}) {
  const active = current === field;
  return (
    <th
      className="text-left p-4 cursor-pointer hover:text-gray-200 transition select-none"
      onClick={() => onClick(field)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {active && (
          <span className="text-violet-400">
            {order === "asc" ? "\u2191" : "\u2193"}
          </span>
        )}
      </span>
    </th>
  );
}

function DetailRow({
  label,
  value,
  children,
}: {
  label: string;
  value?: string | null;
  children?: React.ReactNode;
}) {
  if (!value && !children) return null;
  return (
    <div className="flex justify-between items-start gap-2">
      <span className="text-gray-500 text-xs shrink-0">{label}</span>
      {children || (
        <span className="text-gray-300 text-xs text-right break-all">
          {value}
        </span>
      )}
    </div>
  );
}

// -- Helpers ------------------------------------------------------------------

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatPence(pence: number): string {
  if (!pence) return "\u00A30.00";
  return `\u00A3${(pence / 100).toFixed(2)}`;
}
