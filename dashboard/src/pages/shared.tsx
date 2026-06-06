"use client";

import React from "react";
import { createContext, useContext } from "react";

/**
 * Shared context for all dashboard module pages.
 * Each app wraps pages with <ModulePageProvider> to inject
 * its own API base URL and admin secret.
 */

export type ModulePageContext = {
  apiBase: string;
  adminSecret: string;
};

const PageContext = createContext<ModulePageContext>({
  apiBase: "",
  adminSecret: "",
});

export function ModulePageProvider({
  apiBase,
  adminSecret,
  children,
}: ModulePageContext & { children: React.ReactNode }) {
  return (
    <PageContext.Provider value={{ apiBase, adminSecret }}>
      {children}
    </PageContext.Provider>
  );
}

export function useModulePage() {
  return useContext(PageContext);
}

/**
 * Standard page header with back-to-dashboard link.
 */
export function ModulePageHeader({
  icon,
  title,
  description,
  backHref = "/admin",
  backLabel = "Dashboard",
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  backHref?: string;
  backLabel?: string;
  children?: React.ReactNode;
}) {
  return (
    <>
      <a
        href={backHref}
        className="inline-flex items-center gap-2 text-gray-400 hover:text-white text-sm mb-6 transition"
      >
        <svg viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
          <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
        </svg>
        {backLabel}
      </a>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            {icon} {title}
          </h1>
          <p className="text-gray-400 mt-1">{description}</p>
        </div>
        {children && <div className="flex items-center gap-2">{children}</div>}
      </div>
    </>
  );
}

/**
 * Standard loading skeleton.
 */
export function ModulePageSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="animate-pulse space-y-4">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-28 bg-gray-800 rounded-xl" />
      ))}
    </div>
  );
}

/**
 * Standard empty state.
 */
export function ModulePageEmpty({
  icon,
  message,
  hint,
}: {
  icon: React.ReactNode;
  message: string;
  hint?: string;
}) {
  return (
    <div className="text-center py-12 text-gray-500">
      <div className="text-4xl mb-3 flex justify-center">{icon}</div>
      <p>{message}</p>
      {hint && <p className="text-sm mt-2">{hint}</p>}
    </div>
  );
}
