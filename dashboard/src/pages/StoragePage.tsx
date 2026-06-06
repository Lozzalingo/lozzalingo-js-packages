"use client";

import React, { useState, useEffect } from "react";
import { useModulePage, ModulePageHeader, ModulePageSkeleton, ModulePageEmpty } from "./shared";

type StorageStats = { totalFiles: number; totalSize: string; folders: string[] };
type StorageFile = { key: string; size: number; lastModified: string };

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024; const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

export default function StoragePage() {
  const { apiBase, adminSecret } = useModulePage();
  const [stats, setStats] = useState<StorageStats | null>(null);
  const [files, setFiles] = useState<StorageFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFolder, setActiveFolder] = useState<string | null>(null);

  useEffect(() => {
    if (!adminSecret) return;
    async function fetchData() {
      try {
        console.log("[StorageAdmin] Fetching storage stats");
        const headers: Record<string, string> = { "x-admin-key": adminSecret };
        const [statsRes, filesRes] = await Promise.all([
          fetch(`${apiBase}/api/storage/stats`, { headers }),
          fetch(`${apiBase}/api/storage/files`, { headers }),
        ]);
        if (statsRes.ok) setStats(await statsRes.json());
        if (filesRes.ok) { const d = await filesRes.json(); setFiles(d.files || []); }
      } catch (err) { console.error("[StorageAdmin] Error:", err); }
      finally { setLoading(false); }
    }
    fetchData();
  }, [apiBase, adminSecret]);

  async function loadFolder(folder: string) {
    setActiveFolder(folder);
    try {
      const res = await fetch(`${apiBase}/api/storage/files/${folder}`, { headers: { "x-admin-key": adminSecret } });
      if (res.ok) { const d = await res.json(); setFiles(d.files || []); }
    } catch (err) { console.error("[StorageAdmin] Error loading folder:", err); }
  }

  const icon = <svg viewBox="0 0 20 20" fill="currentColor" className="w-8 h-8 text-blue-400"><path d="M5.5 13a3.5 3.5 0 01-.369-6.98 4 4 0 117.753-1.977A4.5 4.5 0 0113.5 13H11V9.413l1.293 1.293a1 1 0 001.414-1.414l-3-3a1 1 0 00-1.414 0l-3 3a1 1 0 001.414 1.414L9 9.414V13H5.5z" /></svg>;

  return (
    <div className="p-8 text-white">
      <ModulePageHeader icon={icon} title="Storage" description="Cloud storage and file management" />
      {loading ? <ModulePageSkeleton /> : (
        <div className="space-y-6">
          {stats && (
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-5"><p className="text-gray-400 text-sm mb-1">Total Files</p><p className="text-2xl font-bold">{stats.totalFiles}</p></div>
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-5"><p className="text-gray-400 text-sm mb-1">Total Size</p><p className="text-2xl font-bold">{stats.totalSize}</p></div>
            </div>
          )}
          {stats?.folders && stats.folders.length > 0 && (
            <div>
              <p className="text-gray-500 text-[10px] uppercase tracking-wider mb-3 font-semibold">Folders</p>
              <div className="flex flex-wrap gap-2">{stats.folders.map((folder) => (
                <button key={folder} onClick={() => loadFolder(folder)}
                  className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition ${activeFolder === folder ? "bg-blue-600/20 text-blue-400 border border-blue-500/30" : "bg-gray-800 text-gray-300 hover:bg-gray-700 border border-gray-700"}`}>
                  {folder}
                </button>
              ))}</div>
            </div>
          )}
          {files.length > 0 ? (
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-gray-800 text-gray-400 text-xs uppercase tracking-wider">
                  <th className="text-left p-4">File</th><th className="text-left p-4 w-24">Size</th><th className="text-left p-4 w-40">Modified</th>
                </tr></thead>
                <tbody>{files.map((file) => (
                  <tr key={file.key} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                    <td className="p-4 text-gray-300 font-mono text-xs">{file.key}</td>
                    <td className="p-4 text-gray-400 text-xs">{formatBytes(file.size)}</td>
                    <td className="p-4 text-gray-400 text-xs">{new Date(file.lastModified).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          ) : <ModulePageEmpty icon={icon} message="No files found." />}
        </div>
      )}
    </div>
  );
}
