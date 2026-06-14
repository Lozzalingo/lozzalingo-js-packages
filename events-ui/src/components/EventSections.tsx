"use client";

import { FaMapMarkerAlt } from "react-icons/fa";
import { CollapsibleSection } from "./CollapsibleSection";
import { EventGallery } from "./EventGallery";
import { parseJson, parseThemes } from "../lib/utils";

export type ProductSection = {
  id: number;
  title: string;
  type: "text" | "list" | "steps" | "bullets" | "cards" | "checklist" | "gallery" | "themes" | "venue";
  content: string | null;
  listItems: string | null;
  displayOrder: number;
  isCollapsible: boolean;
};

export type Venue = {
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  nearestStation: string;
};

export type EventSectionsProps = {
  sections: ProductSection[];
  galleryImages: string[];
  themes: string[];
  venue: Venue | null;
  productName: string;
  isPublicEvent: boolean;
};

/** Renders all structured sections (gallery, themes, venue, text, list, steps, bullets, cards, checklist) */
export function EventSections({ sections, galleryImages, themes, venue, productName, isPublicEvent }: EventSectionsProps) {
  return (
    <div className="border-t border-border mt-4">
      {sections.map((section) => {
        const items = section.listItems ? (parseJson<string[]>(section.listItems) || []) : [];
        const collapsible = section.isCollapsible !== false;

        // Gallery section
        if (section.type === "gallery" && galleryImages.length > 0) {
          return (
            <div key={section.id} className="py-4 border-b border-border">
              <EventGallery images={galleryImages} title={productName} />
            </div>
          );
        }

        // Themes section
        if (section.type === "themes" && themes.length > 0) {
          return (
            <CollapsibleSection
              key={section.id}
              title={section.title}
              content=""
              defaultOpen={true}
              isCollapsible={collapsible}
              renderCustomContent={() => (
                <div className="flex flex-wrap gap-2 pb-4 px-1">
                  {themes.map((theme) => (
                    <span key={theme} className="inline-flex items-center bg-orange-50 text-orange-700 border border-orange-200 px-3 py-1 rounded-full text-xs font-medium">{theme}</span>
                  ))}
                </div>
              )}
            />
          );
        }

        // Venue section
        if (section.type === "venue" && venue) {
          return (
            <CollapsibleSection
              key={section.id}
              title={section.title}
              content=""
              defaultOpen={true}
              isCollapsible={collapsible}
              renderCustomContent={() => (
                <div className={`rounded-lg p-3 border mb-2 flex items-center gap-3 ${
                  isPublicEvent
                    ? "bg-red-500/10 border-red-500/20"
                    : "bg-gray-50 border-border"
                }`}>
                  <FaMapMarkerAlt className={`flex-shrink-0 ${isPublicEvent ? "text-red-400" : "text-primary"}`} />
                  <div className="text-sm">
                    <span className={`font-bold ${isPublicEvent ? "text-red-700" : "text-text-primary"}`}>{venue.name}</span>
                    <span className={isPublicEvent ? "text-red-600" : "text-text-secondary"}> - {venue.address}</span>
                    {venue.nearestStation && (
                      <span className={isPublicEvent ? "text-red-600" : "text-text-secondary"}> (Nearest: {venue.nearestStation})</span>
                    )}
                  </div>
                </div>
              )}
            />
          );
        }

        // Skip gallery/themes/venue with no data
        if (["gallery", "themes", "venue"].includes(section.type)) return null;

        // Standard content sections
        return (
          <CollapsibleSection
            key={section.id}
            title={section.title}
            content={section.type === "text" ? (section.content || "") : ""}
            defaultOpen={false}
            isCollapsible={collapsible}
            renderCustomContent={
              section.type === "list" ? () => (
                <div className="flex flex-wrap gap-2 pb-4 px-1">
                  {items.map((item, i) => (
                    <span key={i} className="inline-flex items-center bg-orange-50 text-orange-700 border border-orange-200 px-3 py-1 rounded-full text-xs font-medium">{item}</span>
                  ))}
                </div>
              ) : section.type === "steps" ? () => (
                <div className="space-y-3 pb-4 px-1">
                  {items.map((item, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <span className="bg-green-500 text-white rounded-full w-7 h-7 flex items-center justify-center text-sm font-bold flex-shrink-0">{i + 1}</span>
                      <p className="text-text-secondary text-sm pt-1">{item}</p>
                    </div>
                  ))}
                </div>
              ) : section.type === "bullets" ? () => (
                <ul className="space-y-2 pb-4 px-1 list-none">
                  {items.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-text-secondary">
                      <span className="text-orange-500 mt-1 flex-shrink-0">&#8226;</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              ) : section.type === "cards" ? () => (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pb-4 px-1">
                  {items.map((item, i) => {
                    const hasCategory = item.includes(":");
                    const category = hasCategory ? item.split(":")[0] : "";
                    const detail = hasCategory ? item.split(":").slice(1).join(":").trim() : item;
                    return (
                      <div key={i} className="bg-red-50 border border-red-200 rounded-lg p-3">
                        {hasCategory && <span className="text-xs font-semibold text-red-600 uppercase tracking-wide">{category}</span>}
                        <p className="text-sm text-text-secondary mt-0.5">{detail}</p>
                      </div>
                    );
                  })}
                </div>
              ) : section.type === "checklist" ? () => (
                <div className="pb-4 px-1">
                  <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-4 shadow-sm">
                    <div className="space-y-2.5">
                      {items.map((item, i) => {
                        const hasCategory = item.includes(":");
                        const category = hasCategory ? item.split(":")[0].trim() : "";
                        const task = hasCategory ? item.split(":").slice(1).join(":").trim() : item;
                        const pointsMatch = task.match(/\((\d+)\s*pts?\)/i);
                        const points = pointsMatch ? pointsMatch[1] : null;
                        const taskText = points ? task.replace(pointsMatch![0], "").trim() : task;
                        const categoryColours: Record<string, { text: string; bg: string; border: string; num: string }> = {
                          location: { text: "text-blue-700", bg: "bg-blue-100", border: "border-blue-400", num: "text-blue-500" },
                          miscellaneous: { text: "text-purple-700", bg: "bg-purple-100", border: "border-purple-400", num: "text-purple-500" },
                          bespoke: { text: "text-rose-700", bg: "bg-rose-100", border: "border-rose-400", num: "text-rose-500" },
                        };
                        const catKey = category.toLowerCase();
                        const catColour = categoryColours[catKey] || { text: "text-amber-700", bg: "bg-amber-100", border: "border-amber-400", num: "text-amber-500" };
                        return (
                          <div key={i} className="flex items-start gap-3 group">
                            <div className={`w-5 h-5 mt-0.5 border-2 ${catColour.border} rounded flex-shrink-0 flex items-center justify-center bg-white`}>
                              <span className={`text-[9px] font-bold ${catColour.num}`}>{i + 1}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-baseline gap-2">
                                {hasCategory && (
                                  <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${catColour.text} ${catColour.bg}`}>{category}</span>
                                )}
                                <span className="text-sm text-text-primary">{taskText}</span>
                                {points && (
                                  <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded ml-auto flex-shrink-0">{points} pts</span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : undefined
            }
          />
        );
      })}
    </div>
  );
}
