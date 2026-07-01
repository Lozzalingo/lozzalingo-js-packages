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

type BookingSummary = {
  id: string;
  bookingNumber: string;
  customerName: string;
  status: string;
  eventDate: string;
  totalAmount?: number;
  groupSize: number;
  createdAt: string;
};

type CampaignSendSummary = {
  id: string;
  sentAt: string;
  opened: boolean;
  openedAt?: string;
  clicked: boolean;
  clickedAt?: string;
  campaign: { name: string; subject: string };
};

type CustomerDetail = Customer & {
  jobTitle?: string;
  dateOfBirth?: string;
  country?: string;
  region?: string;
  referralName?: string;
  referralEmail?: string;
  linkedinUrl?: string;
  instagramHandle?: string;
  websiteUrl?: string;
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
  bookings?: BookingSummary[];
  campaignSends?: CampaignSendSummary[];
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
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState<Record<string, string | boolean>>({});
  const [saving, setSaving] = useState(false);
  const [detailTab, setDetailTab] = useState<"overview" | "bookings" | "campaigns" | "activity">("overview");

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

  const handleEdit = () => {
    if (!selectedCustomer) return;
    setEditData({
      firstName: selectedCustomer.firstName,
      lastName: selectedCustomer.lastName,
      phone: selectedCustomer.phone || "",
      company: selectedCustomer.company || "",
      jobTitle: selectedCustomer.jobTitle || "",
      country: selectedCustomer.country || "",
      region: selectedCustomer.region || "",
      source: selectedCustomer.source || "",
      status: selectedCustomer.status,
      marketingOptIn: selectedCustomer.marketingOptIn,
      referralName: selectedCustomer.referralName || "",
      referralEmail: selectedCustomer.referralEmail || "",
      linkedinUrl: selectedCustomer.linkedinUrl || "",
      instagramHandle: selectedCustomer.instagramHandle || "",
      websiteUrl: selectedCustomer.websiteUrl || "",
      notes: selectedCustomer.notes || "",
    });
    setEditing(true);
  };

  const handleCancelEdit = () => {
    setEditing(false);
    setEditData({});
  };

  const handleSave = async () => {
    if (!selectedCustomer) return;
    setSaving(true);
    try {
      console.log("[CrmAdmin] Saving customer:", selectedCustomer.customerNumber);
      const res = await fetch(`${apiBase}/api/crm/customers/${selectedCustomer.id}`, {
        method: "PUT",
        headers: { ...headers(), "Content-Type": "application/json" },
        body: JSON.stringify(editData),
      });

      if (res.ok) {
        const updated = await res.json();
        console.log("[CrmAdmin] Saved:", updated.customerNumber);
        setEditing(false);
        // Refetch full detail to get fresh data
        fetchCustomerDetail(selectedCustomer.id);
        fetchCustomers(pagination.page);
        fetchDashboard();
      } else {
        const data = await res.json();
        console.error("[CrmAdmin] Save failed:", data.error);
        alert(`Failed to save: ${data.error}`);
      }
    } catch (err) {
      console.error("[CrmAdmin] Error saving:", err);
      alert("Failed to save customer.");
    } finally {
      setSaving(false);
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
    const bookings = selectedCustomer.bookings || [];
    const campaigns = selectedCustomer.campaignSends || [];
    const activities = selectedCustomer.activities || [];

    return (
      <div className="p-8 text-white">
        {/* Back link */}
        <button
          onClick={handleBack}
          className="inline-flex items-center gap-2 text-gray-400 hover:text-white text-sm mb-6 transition"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
            <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
          </svg>
          Customers
        </button>

        {/* Header */}
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
            {editing ? (
              <>
                <button
                  onClick={handleCancelEdit}
                  className="inline-flex items-center gap-2 bg-gray-700/50 hover:bg-gray-700 text-gray-300 text-sm font-medium px-4 py-2.5 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save"}
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={handleEdit}
                  className="inline-flex items-center gap-2 bg-violet-600/20 hover:bg-violet-600/40 text-violet-400 hover:text-violet-300 text-sm font-medium px-4 py-2.5 rounded-lg transition"
                >
                  <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                    <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                  </svg>
                  Edit
                </button>
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
              </>
            )}
          </div>
        </div>

        {/* Top cards: Score + Marketing Preferences (always visible) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* Customer info / edit card */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
              Customer Details
            </h3>
            {editing ? (
              <div className="space-y-3">
                <EditField label="First Name" field="firstName" editData={editData} setEditData={setEditData} />
                <EditField label="Last Name" field="lastName" editData={editData} setEditData={setEditData} />
                <EditField label="Phone" field="phone" editData={editData} setEditData={setEditData} />
                <EditField label="Company" field="company" editData={editData} setEditData={setEditData} />
                <EditField label="Job Title" field="jobTitle" editData={editData} setEditData={setEditData} />
                <EditField label="Country" field="country" editData={editData} setEditData={setEditData} />
                <EditField label="Region" field="region" editData={editData} setEditData={setEditData} />
                <EditField label="Source" field="source" editData={editData} setEditData={setEditData} />
                <div className="flex justify-between items-center">
                  <span className="text-gray-500 text-xs">Status</span>
                  <select
                    value={String(editData.status || "ACTIVE")}
                    onChange={(e) => setEditData({ ...editData, status: e.target.value })}
                    className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white"
                  >
                    <option value="ACTIVE">Active</option>
                    <option value="UNSUBSCRIBED">Unsubscribed</option>
                    <option value="BOUNCED">Bounced</option>
                  </select>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500 text-xs">Marketing Opt-in</span>
                  <button
                    onClick={() => setEditData({ ...editData, marketingOptIn: !editData.marketingOptIn })}
                    className={`px-2 py-1 rounded text-xs font-medium ${editData.marketingOptIn ? "bg-emerald-500/20 text-emerald-400" : "bg-gray-700 text-gray-400"}`}
                  >
                    {editData.marketingOptIn ? "Yes" : "No"}
                  </button>
                </div>
                <EditField label="Referral Name" field="referralName" editData={editData} setEditData={setEditData} />
                <EditField label="Referral Email" field="referralEmail" editData={editData} setEditData={setEditData} />
                <EditField label="LinkedIn" field="linkedinUrl" editData={editData} setEditData={setEditData} />
                <EditField label="Instagram" field="instagramHandle" editData={editData} setEditData={setEditData} />
                <EditField label="Website" field="websiteUrl" editData={editData} setEditData={setEditData} />
                <div>
                  <span className="text-gray-500 text-xs block mb-1">Notes</span>
                  <textarea
                    value={String(editData.notes || "")}
                    onChange={(e) => setEditData({ ...editData, notes: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white resize-none"
                    rows={3}
                  />
                </div>
              </div>
            ) : (
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
                  <DetailRow label="Referral" value={selectedCustomer.referralName} />
                )}
                {selectedCustomer.linkedinUrl && (
                  <DetailRow label="LinkedIn">
                    <a href={selectedCustomer.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 text-xs break-all">
                      {selectedCustomer.linkedinUrl.replace(/https?:\/\/(www\.)?linkedin\.com\/in\//i, "")}
                    </a>
                  </DetailRow>
                )}
                {selectedCustomer.instagramHandle && (
                  <DetailRow label="Instagram">
                    <a href={`https://instagram.com/${selectedCustomer.instagramHandle.replace(/^@/, "")}`} target="_blank" rel="noopener noreferrer" className="text-pink-400 hover:text-pink-300 text-xs">
                      @{selectedCustomer.instagramHandle.replace(/^@/, "")}
                    </a>
                  </DetailRow>
                )}
                {selectedCustomer.websiteUrl && (
                  <DetailRow label="Website">
                    <a href={selectedCustomer.websiteUrl.startsWith("http") ? selectedCustomer.websiteUrl : `https://${selectedCustomer.websiteUrl}`} target="_blank" rel="noopener noreferrer" className="text-violet-400 hover:text-violet-300 text-xs break-all">
                      {selectedCustomer.websiteUrl.replace(/https?:\/\/(www\.)?/, "")}
                    </a>
                  </DetailRow>
                )}
                {selectedCustomer.notes && (
                  <DetailRow label="Notes" value={selectedCustomer.notes} />
                )}
                <DetailRow label="Created" value={formatDate(selectedCustomer.createdAt)} />
                <DetailRow label="Last Activity" value={formatDate(selectedCustomer.lastActivityAt)} />
              </div>
            )}
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
                    <div key={key} className="flex items-center justify-between text-xs">
                      <span className="text-gray-400 capitalize">{key}</span>
                      <span className={typeof val === "number" && val < 0 ? "text-red-400" : "text-emerald-400"}>
                        {typeof val === "number" && val > 0 ? "+" : ""}{val}
                      </span>
                    </div>
                  )
                )}
              </div>
            )}
            <div className="pt-2 space-y-2 text-sm">
              <DetailRow label="Bookings" value={String(selectedCustomer.totalBookings)} />
              <DetailRow label="Total Spent" value={formatPence(selectedCustomer.totalSpent)} />
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
                  <div key={pref.id} className="flex items-center justify-between text-sm">
                    <span className="text-gray-300">{pref.preference}</span>
                    <span className={pref.optedIn ? "text-emerald-400" : "text-red-400"}>
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

        {/* Tabs */}
        <div className="flex gap-1 mb-4 border-b border-gray-800">
          {[
            { key: "overview" as const, label: "Activity", count: activities.length },
            { key: "bookings" as const, label: "Bookings", count: bookings.length },
            { key: "campaigns" as const, label: "Campaigns", count: campaigns.length },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setDetailTab(tab.key)}
              className={`px-4 py-2.5 text-sm font-medium transition border-b-2 -mb-px ${
                detailTab === tab.key
                  ? "border-violet-500 text-violet-400"
                  : "border-transparent text-gray-500 hover:text-gray-300"
              }`}
            >
              {tab.label}
              {tab.count > 0 && (
                <span className="ml-1.5 text-xs bg-gray-800 text-gray-400 px-1.5 py-0.5 rounded-full">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Tab content: Activity */}
        {detailTab === "overview" && (
          activities.length > 0 ? (
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
                  {activities.map((act) => (
                    <tr key={act.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                      <td className="p-4"><ActivityTypeBadge type={act.type} /></td>
                      <td className="p-4 text-gray-300">{act.productName || act.productCategory || "-"}</td>
                      <td className="p-4 text-gray-400 text-xs">{act.channel || act.source || "-"}</td>
                      <td className="p-4 text-gray-400 text-xs">{formatDate(act.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-gray-500 text-sm py-8 text-center">No activity recorded</p>
          )
        )}

        {/* Tab content: Bookings */}
        {detailTab === "bookings" && (
          bookings.length > 0 ? (
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800 text-gray-400 text-xs uppercase tracking-wider">
                    <th className="text-left p-4">Booking #</th>
                    <th className="text-left p-4">Status</th>
                    <th className="text-left p-4">Event Date</th>
                    <th className="text-left p-4">Group Size</th>
                    <th className="text-left p-4">Amount</th>
                    <th className="text-left p-4">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {bookings.map((b) => (
                    <tr key={b.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                      <td className="p-4 text-violet-400 font-mono text-xs">{b.bookingNumber}</td>
                      <td className="p-4"><BookingStatusBadge status={b.status} /></td>
                      <td className="p-4 text-gray-300 text-xs">{formatDate(b.eventDate)}</td>
                      <td className="p-4 text-gray-300 text-center">{b.groupSize}</td>
                      <td className="p-4 text-gray-300 text-xs">{b.totalAmount ? formatPence(b.totalAmount) : "-"}</td>
                      <td className="p-4 text-gray-400 text-xs">{formatDate(b.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-gray-500 text-sm py-8 text-center">No bookings</p>
          )
        )}

        {/* Tab content: Campaigns */}
        {detailTab === "campaigns" && (
          campaigns.length > 0 ? (
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800 text-gray-400 text-xs uppercase tracking-wider">
                    <th className="text-left p-4">Campaign</th>
                    <th className="text-left p-4">Subject</th>
                    <th className="text-left p-4">Sent</th>
                    <th className="text-left p-4">Opened</th>
                    <th className="text-left p-4">Clicked</th>
                  </tr>
                </thead>
                <tbody>
                  {campaigns.map((cs) => (
                    <tr key={cs.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                      <td className="p-4 text-gray-200 font-medium text-xs">{cs.campaign?.name || "-"}</td>
                      <td className="p-4 text-gray-400 text-xs">{cs.campaign?.subject || "-"}</td>
                      <td className="p-4 text-gray-400 text-xs">{formatDate(cs.sentAt)}</td>
                      <td className="p-4">
                        {cs.opened ? (
                          <span className="text-emerald-400 text-xs">{cs.openedAt ? formatDate(cs.openedAt) : "Yes"}</span>
                        ) : (
                          <span className="text-gray-600 text-xs">No</span>
                        )}
                      </td>
                      <td className="p-4">
                        {cs.clicked ? (
                          <span className="text-violet-400 text-xs">{cs.clickedAt ? formatDate(cs.clickedAt) : "Yes"}</span>
                        ) : (
                          <span className="text-gray-600 text-xs">No</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-gray-500 text-sm py-8 text-center">No campaigns sent</p>
          )
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

function EditField({
  label,
  field,
  editData,
  setEditData,
}: {
  label: string;
  field: string;
  editData: Record<string, string | boolean>;
  setEditData: (data: Record<string, string | boolean>) => void;
}) {
  return (
    <div className="flex justify-between items-center gap-2">
      <span className="text-gray-500 text-xs shrink-0">{label}</span>
      <input
        type="text"
        value={String(editData[field] || "")}
        onChange={(e) => setEditData({ ...editData, [field]: e.target.value })}
        className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white text-right w-40 focus:outline-none focus:border-violet-500"
      />
    </div>
  );
}

function BookingStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    ENQUIRY: "bg-blue-500/20 text-blue-400",
    INVOICE_SENT: "bg-amber-500/20 text-amber-400",
    QUOTED: "bg-amber-500/20 text-amber-400",
    PENCILLED: "bg-cyan-500/20 text-cyan-400",
    CONFIRMED: "bg-emerald-500/20 text-emerald-400",
    DEPOSIT_PAID: "bg-emerald-500/20 text-emerald-400",
    PAID: "bg-emerald-500/20 text-emerald-400",
    COMPLETED: "bg-violet-500/20 text-violet-400",
    LOST: "bg-gray-500/20 text-gray-400",
    QUALIFIED_OUT: "bg-gray-500/20 text-gray-400",
    CANCELLED: "bg-red-500/20 text-red-400",
  };

  const label = status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${styles[status] || "bg-gray-500/20 text-gray-400"}`}>
      {label}
    </span>
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
