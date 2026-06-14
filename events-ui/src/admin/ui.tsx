"use client";

import React from "react";
import { FaEdit, FaTrash, FaEye, FaTimes, FaSave, FaPlus, FaChevronDown, FaChevronRight, FaExternalLinkAlt, FaToggleOn, FaToggleOff, FaCopy } from "react-icons/fa";

// Re-export utilities from lib so consumers can import from one place
export { slugify, formatDate, formatPrice, poundsToPence, penceToPounds } from "../lib/utils";

// ─── Constants ──────────────────────────────────────────────────────────────────

export const statusColors: Record<string, string> = {
  ENQUIRY: "bg-blue-500/20 text-blue-400",
  CONFIRMED: "bg-emerald-500/20 text-emerald-400",
  DEPOSIT_PAID: "bg-cyan-500/20 text-cyan-400",
  PAID: "bg-emerald-500/20 text-emerald-400",
  COMPLETED: "bg-gray-500/20 text-gray-400",
  CANCELLED: "bg-red-500/20 text-red-400",
};

export const bookingTypeColors: Record<string, string> = {
  PRIVATE: "bg-purple-500/20 text-purple-400",
  PUBLIC: "bg-amber-500/20 text-amber-400",
  PLAY_TODAY: "bg-pink-500/20 text-pink-400",
};

// ─── Badge ──────────────────────────────────────────────────────────────────────

type BadgeVariant = "status" | "type" | "info" | "count";

type BadgeProps = {
  children: React.ReactNode;
  colorClass?: string;
  variant?: BadgeVariant;
  size?: "sm" | "md";
};

const badgeSizeClasses = {
  sm: "text-[10px] px-1.5 py-0.5",
  md: "text-xs px-2.5 py-1",
};

export function Badge({ children, colorClass, variant = "info", size = "md" }: BadgeProps) {
  const defaultColors: Record<BadgeVariant, string> = {
    status: "bg-gray-500/20 text-gray-400",
    type: "bg-purple-500/20 text-purple-400",
    info: "bg-gray-700/50 text-gray-300",
    count: "bg-gray-700 text-gray-400",
  };

  const color = colorClass || defaultColors[variant];

  return (
    <span className={`inline-flex items-center font-semibold rounded-full ${badgeSizeClasses[size]} ${color}`}>
      {children}
    </span>
  );
}

/** Status badge with automatic colour lookup */
export function StatusBadge({ status, size = "md" }: { status: string; size?: "sm" | "md" }) {
  return (
    <Badge colorClass={statusColors[status]} size={size}>
      {status.replace(/_/g, " ")}
    </Badge>
  );
}

/** Booking type badge with automatic colour lookup */
export function TypeBadge({ type, size = "md" }: { type: string; size?: "sm" | "md" }) {
  return (
    <Badge colorClass={bookingTypeColors[type]} size={size}>
      {type.replace(/_/g, " ")}
    </Badge>
  );
}

// ─── Buttons ────────────────────────────────────────────────────────────────────

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";
type ButtonSize = "sm" | "md" | "lg";

type ButtonProps = {
  children: React.ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
  "data-action"?: string;
  type?: "button" | "submit";
};

const btnBase = "inline-flex items-center gap-1.5 font-medium transition rounded-lg";

const btnVariants: Record<ButtonVariant, string> = {
  primary: "bg-blue-600 hover:bg-blue-700 text-white disabled:bg-gray-700 disabled:text-gray-500",
  secondary: "bg-gray-700/50 text-gray-300 hover:bg-gray-600/50 hover:text-white",
  danger: "bg-red-600/10 text-red-400 hover:bg-red-600/20",
  ghost: "text-gray-500 hover:text-white",
};

const btnSizes: Record<ButtonSize, string> = {
  sm: "px-2.5 py-1 text-[11px] rounded-md",
  md: "px-3 py-1.5 text-xs",
  lg: "px-4 py-2 text-sm",
};

export function Button({ children, variant = "primary", size = "md", disabled, onClick, className = "", type = "button", ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`${btnBase} ${btnVariants[variant]} ${btnSizes[size]} ${className}`}
      data-action={rest["data-action"]}
    >
      {children}
    </button>
  );
}

/** Green add/create button */
export function AddButton({ children, onClick, size = "md", ...rest }: Omit<ButtonProps, "variant"> & { "data-action"?: string }) {
  return (
    <button
      onClick={onClick}
      className={`${btnBase} bg-emerald-600 hover:bg-emerald-700 text-white ${btnSizes[size]}`}
      data-action={rest["data-action"]}
    >
      <FaPlus className="text-[10px]" />
      {children}
    </button>
  );
}

// ─── Icon Buttons (small action row) ────────────────────────────────────────────

type IconBtnProps = {
  onClick?: () => void;
  title?: string;
  "data-action"?: string;
  disabled?: boolean;
  className?: string;
};

const iconBtnBase = "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition";

/** View on site - opens in new tab */
export function ViewLinkBtn({ href, title = "View on site", onClick, ...rest }: IconBtnProps & { href: string; onClick?: (e: React.MouseEvent) => void }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={onClick}
      className={`${iconBtnBase} bg-gray-700/50 text-gray-300 hover:bg-gray-600/50 hover:text-white`}
      title={title}
      data-action={rest["data-action"]}
    >
      <FaEye className="text-[10px]" />
      View
    </a>
  );
}

/** External link icon button (no label) */
export function ExternalLinkBtn({ href, title = "Open", ...rest }: IconBtnProps & { href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-blue-400 hover:text-blue-300 transition"
      title={title}
      data-action={rest["data-action"]}
    >
      <FaExternalLinkAlt className="text-xs" />
    </a>
  );
}

/** Edit button */
export function EditBtn({ onClick, title = "Edit", ...rest }: IconBtnProps) {
  return (
    <button
      onClick={onClick}
      className={`${iconBtnBase} bg-emerald-600/10 text-emerald-400 hover:bg-emerald-600/20`}
      title={title}
      data-action={rest["data-action"]}
    >
      <FaEdit className="text-[10px]" />
      Edit
    </button>
  );
}

/** Duplicate button */
export function DuplicateBtn({ onClick, disabled, title = "Duplicate", ...rest }: IconBtnProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${iconBtnBase} bg-blue-600/10 text-blue-400 hover:bg-blue-600/20 disabled:opacity-30`}
      title={title}
      data-action={rest["data-action"]}
    >
      <FaCopy className="text-[10px]" />
      Duplicate
    </button>
  );
}

/** Delete button */
export function DeleteBtn({ onClick, title = "Delete", ...rest }: IconBtnProps) {
  return (
    <button
      onClick={onClick}
      className={`${iconBtnBase} bg-red-600/10 text-red-400 hover:bg-red-600/20`}
      title={title}
      data-action={rest["data-action"]}
    >
      <FaTrash className="text-[10px]" />
    </button>
  );
}

/** Save button */
export function SaveBtn({ onClick, disabled, children = "Save", ...rest }: IconBtnProps & { children?: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${iconBtnBase} bg-emerald-600/10 text-emerald-400 hover:bg-emerald-600/20 disabled:opacity-30`}
      data-action={rest["data-action"]}
    >
      <FaSave className="text-[10px]" />
      {children}
    </button>
  );
}

/** Cancel/close button */
export function CancelBtn({ onClick, ...rest }: IconBtnProps) {
  return (
    <button
      onClick={onClick}
      className="text-gray-500 hover:text-white transition"
      data-action={rest["data-action"]}
    >
      <FaTimes className="text-sm" />
    </button>
  );
}

/** Toggle active/inactive */
export function ToggleBtn({ isActive, onClick, ...rest }: IconBtnProps & { isActive: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`text-lg transition ${isActive ? "text-emerald-400 hover:text-emerald-300" : "text-gray-600 hover:text-gray-400"}`}
      title={isActive ? "Deactivate" : "Activate"}
      data-action={rest["data-action"]}
    >
      {isActive ? <FaToggleOn /> : <FaToggleOff />}
    </button>
  );
}

/** Expand/collapse chevron */
export function ExpandBtn({ isExpanded, onClick, ...rest }: IconBtnProps & { isExpanded: boolean }) {
  return (
    <button
      onClick={onClick}
      className="text-gray-500 hover:text-white transition"
      data-action={rest["data-action"]}
    >
      {isExpanded ? <FaChevronDown className="text-xs" /> : <FaChevronRight className="text-xs" />}
    </button>
  );
}

// ─── Action Bar (row of icon buttons) ───────────────────────────────────────────

export function ActionBar({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`flex items-center gap-1.5 flex-shrink-0 ${className}`}>
      {children}
    </div>
  );
}

// ─── Form Elements ──────────────────────────────────────────────────────────────

type InputProps = {
  label?: string;
  value: string | number;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  type?: string;
  "data-action"?: string;
  className?: string;
  disabled?: boolean;
};

const inputClass = "w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:border-blue-500 outline-none";

export function Input({ label, className = "", ...rest }: InputProps) {
  return (
    <div className={className}>
      {label && <label className="text-gray-400 text-xs block mb-1">{label}</label>}
      <input
        type={rest.type || "text"}
        value={rest.value}
        onChange={rest.onChange}
        placeholder={rest.placeholder}
        disabled={rest.disabled}
        className={inputClass}
        data-action={rest["data-action"]}
      />
    </div>
  );
}

type TextAreaProps = {
  label?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  rows?: number;
  "data-action"?: string;
  className?: string;
};

export function TextArea({ label, rows = 3, className = "", ...rest }: TextAreaProps) {
  return (
    <div className={className}>
      {label && <label className="text-gray-400 text-xs block mb-1">{label}</label>}
      <textarea
        value={rest.value}
        onChange={rest.onChange}
        placeholder={rest.placeholder}
        rows={rows}
        className={`${inputClass} resize-none`}
        data-action={rest["data-action"]}
      />
    </div>
  );
}

type SelectProps = {
  label?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  options: { value: string; label: string }[];
  "data-action"?: string;
  className?: string;
};

export function Select({ label, options, className = "", ...rest }: SelectProps) {
  return (
    <div className={className}>
      {label && <label className="text-gray-400 text-xs block mb-1">{label}</label>}
      <select
        value={rest.value}
        onChange={rest.onChange}
        className={inputClass}
        data-action={rest["data-action"]}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

// ─── Section Heading ────────────────────────────────────────────────────────────

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-gray-500 text-[10px] uppercase tracking-wider mb-2 font-semibold">{children}</p>
  );
}

// ─── Layout Components ──────────────────────────────────────────────────────────

/** Standard admin card container */
export function Card({ children, className = "", highlight = false }: { children: React.ReactNode; className?: string; highlight?: boolean }) {
  const border = highlight ? "border-blue-500/30" : "border-gray-800";
  return (
    <div className={`bg-gray-900 border ${border} rounded-lg ${className}`}>
      {children}
    </div>
  );
}

/** Page header with title and optional actions */
export function PageHeader({ icon, title, children }: { icon?: React.ReactNode; title: string; children?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-6">
      <h1 className="text-3xl font-bold flex items-center gap-3">
        {icon}
        {title}
      </h1>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  );
}

/** Pagination controls */
export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
}: {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center gap-2 mt-4">
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage <= 1}
        className="px-4 py-2 rounded-lg border border-gray-700 text-sm text-gray-400 hover:bg-gray-800 disabled:opacity-30 transition"
        data-action="admin_pagination_prev"
      >
        Previous
      </button>
      <span className="text-sm text-gray-500">
        {currentPage} / {totalPages}
      </span>
      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage >= totalPages}
        className="px-4 py-2 rounded-lg border border-gray-700 text-sm text-gray-400 hover:bg-gray-800 disabled:opacity-30 transition"
        data-action="admin_pagination_next"
      >
        Next
      </button>
    </div>
  );
}

/** Empty state placeholder */
export function EmptyState({ icon, message }: { icon?: React.ReactNode; message: string }) {
  return (
    <div className="text-center py-12 text-gray-500">
      {icon && <div className="text-4xl mb-3 flex justify-center">{icon}</div>}
      <p>{message}</p>
    </div>
  );
}

/** Inline form panel (e.g. for editing a location, package, etc.) */
export function InlineFormPanel({
  title,
  onCancel,
  children,
}: {
  title: string;
  onCancel: () => void;
  children: React.ReactNode;
}) {
  return (
    <Card highlight className="p-4 mb-2">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-blue-400">{title}</h3>
        <CancelBtn onClick={onCancel} data-action="admin_form_cancel" />
      </div>
      {children}
    </Card>
  );
}
