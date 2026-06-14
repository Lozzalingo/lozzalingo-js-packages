"use client";

import { useState } from "react";
import { FaChevronDown } from "react-icons/fa";

export type CollapsibleSectionProps = {
  title: string;
  content: string;
  defaultOpen?: boolean;
  isCollapsible?: boolean;
  renderCustomContent?: () => React.ReactNode;
};

export function CollapsibleSection({ title, content, defaultOpen = false, isCollapsible = true, renderCustomContent }: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen || !isCollapsible);

  const isOpen = !isCollapsible || open;

  return (
    <div className="border-b border-border last:border-b-0">
      {isCollapsible ? (
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="w-full flex items-center justify-between py-3 text-left hover:bg-gray-50 transition px-1"
          data-action={`toggle_section_${title.toLowerCase().replace(/\s+/g, "_")}`}
        >
          <span className="font-bold text-sm text-text-primary">{title}</span>
          <FaChevronDown className={`text-text-secondary text-xs flex-shrink-0 transition-transform duration-300 ${open ? "rotate-180" : ""}`} />
        </button>
      ) : (
        <div className="py-3 px-1">
          <span className="font-bold text-sm text-text-primary">{title}</span>
        </div>
      )}
      <div
        className={`grid transition-all duration-300 ease-in-out ${isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
      >
        <div className="overflow-hidden">
          {renderCustomContent ? (
            renderCustomContent()
          ) : (
            <div
              className="prose prose-sm max-w-none prose-headings:text-text-primary prose-p:text-text-secondary pb-4 px-1"
              dangerouslySetInnerHTML={{ __html: content }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
