"use client";

import React from "react";
import { ModulePageHeader } from "./shared";

export default function PaymentsPage() {
  const icon = <svg viewBox="0 0 20 20" fill="currentColor" className="w-8 h-8 text-blue-400"><path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z" /><path fillRule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" clipRule="evenodd" /></svg>;

  return (
    <div className="p-8 text-white">
      <ModulePageHeader icon={icon} title="Payments" description="Stripe checkout, invoicing, and webhook handling" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {[
          { href: "https://dashboard.stripe.com/payments", title: "Stripe Dashboard", desc: "View payments, refunds, and customer details in Stripe." },
          { href: "https://dashboard.stripe.com/invoices", title: "Invoices", desc: "Manage invoices sent to customers via the booking system." },
          { href: "https://dashboard.stripe.com/webhooks", title: "Webhooks", desc: "Check webhook delivery and event logs." },
        ].map((link) => (
          <a key={link.title} href={link.href} target="_blank" rel="noopener noreferrer"
            className="bg-gray-900 border border-gray-800 rounded-xl p-6 hover:border-gray-600 transition group">
            <div className="flex items-center justify-between mb-3">
              <span className="text-lg font-semibold">{link.title}</span>
              <svg viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3 text-gray-500 group-hover:text-white transition"><path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" /><path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" /></svg>
            </div>
            <p className="text-sm text-gray-400">{link.desc}</p>
          </a>
        ))}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <span className="text-lg font-semibold mb-3 block">Integration</span>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-gray-400">Webhook endpoint</span><code className="text-gray-300 bg-gray-800 px-2 py-0.5 rounded font-mono text-xs">/api/payments/webhook</code></div>
            <div className="flex justify-between"><span className="text-gray-400">Checkout flow</span><span className="text-emerald-400 text-xs font-medium">Active</span></div>
            <div className="flex justify-between"><span className="text-gray-400">Invoicing</span><span className="text-emerald-400 text-xs font-medium">Active</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}
