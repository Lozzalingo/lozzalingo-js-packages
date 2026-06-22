"use client";

import React, { useState, useEffect } from "react";
import {
  useModulePage,
  ModulePageHeader,
  ModulePageSkeleton,
  ModulePageEmpty,
} from "./shared";

type BlogPost = {
  id: number | string;
  title: string;
  coverImage?: string;
  published: boolean;
  createdAt: string;
  author?: { firstName?: string; avatar?: string };
  category?: { name?: string };
};

type Pagination = {
  total: number;
  pages: number;
  currentPage: number;
  perPage: number;
};

export default function BlogAdminPage() {
  const { apiBase, adminSecret } = useModulePage();
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    total: 0,
    pages: 0,
    currentPage: 1,
    perPage: 10,
  });
  const [loading, setLoading] = useState(true);

  const fetchPosts = async (page = 1) => {
    try {
      console.log("[BlogAdmin] Fetching blog posts, page:", page);
      const headers: Record<string, string> = {};
      if (adminSecret) headers["x-admin-key"] = adminSecret;

      const res = await fetch(
        `${apiBase}/api/blog?mode=admin&page=${page}&perPage=${pagination.perPage}`,
        { headers }
      );

      if (res.ok) {
        const data = await res.json();
        setPosts(data.posts || []);
        if (data.pagination) setPagination(data.pagination);
        console.log(
          "[BlogAdmin] Loaded",
          data.posts?.length || 0,
          "posts"
        );
      } else {
        console.error("[BlogAdmin] Failed to fetch posts:", res.status);
      }
    } catch (err) {
      console.error("[BlogAdmin] Error fetching posts:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPosts();
  }, [apiBase, adminSecret]);

  const handlePageChange = (page: number) => {
    setLoading(true);
    fetchPosts(page);
  };

  const icon = (
    <svg
      viewBox="0 0 20 20"
      fill="currentColor"
      className="w-8 h-8 text-blue-400"
    >
      <path
        fillRule="evenodd"
        d="M2 5a2 2 0 012-2h8a2 2 0 012 2v10a2 2 0 002 2H4a2 2 0 01-2-2V5zm3 1h6v4H5V6zm6 6H5v2h6v-2z"
        clipRule="evenodd"
      />
      <path d="M15 7h1a2 2 0 012 2v5.5a1.5 1.5 0 01-3 0V7z" />
    </svg>
  );

  return (
    <div className="p-8 text-white">
      <ModulePageHeader
        icon={icon}
        title="Blog"
        description="Manage blog posts and articles"
      >
        <a
          href="/admin/blog-editor/new"
          className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition"
        >
          <svg
            viewBox="0 0 20 20"
            fill="currentColor"
            className="w-4 h-4"
          >
            <path
              fillRule="evenodd"
              d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
              clipRule="evenodd"
            />
          </svg>
          New Post
        </a>
      </ModulePageHeader>

      {loading ? (
        <ModulePageSkeleton rows={4} />
      ) : posts.length === 0 ? (
        <ModulePageEmpty
          icon={icon}
          message="No blog posts yet."
          hint="Create your first post to get started."
        />
      ) : (
        <div className="space-y-6">
          {/* Posts table */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-gray-400 text-xs uppercase tracking-wider">
                  <th className="text-left p-4">Title</th>
                  <th className="text-left p-4 w-20">Image</th>
                  <th className="text-left p-4 w-28">Status</th>
                  <th className="text-left p-4 w-32">Created</th>
                  <th className="text-left p-4 w-28">Author</th>
                  <th className="text-left p-4 w-32">Category</th>
                  <th className="text-left p-4 w-24">Actions</th>
                </tr>
              </thead>
              <tbody>
                {posts.map((post) => (
                  <tr
                    key={post.id}
                    className="border-b border-gray-800/50 hover:bg-gray-800/30"
                  >
                    <td className="p-4 text-gray-200 font-medium">
                      {post.title}
                    </td>
                    <td className="p-4">
                      {post.coverImage ? (
                        <img
                          src={post.coverImage}
                          alt={post.title}
                          className="w-14 h-10 object-cover rounded"
                        />
                      ) : (
                        <div className="w-14 h-10 bg-gray-800 rounded flex items-center justify-center text-gray-600 text-xs">
                          No img
                        </div>
                      )}
                    </td>
                    <td className="p-4">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                          post.published
                            ? "bg-emerald-500/20 text-emerald-400"
                            : "bg-amber-500/20 text-amber-400"
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            post.published
                              ? "bg-emerald-400"
                              : "bg-amber-400"
                          }`}
                        />
                        {post.published ? "Published" : "Draft"}
                      </span>
                    </td>
                    <td className="p-4 text-gray-400 text-xs">
                      {new Date(post.createdAt).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="p-4 text-gray-400 text-xs">
                      {post.author?.firstName || "Unknown"}
                    </td>
                    <td className="p-4 text-gray-400 text-xs">
                      {post.category?.name || "Uncategorised"}
                    </td>
                    <td className="p-4">
                      <a
                        href={`/admin/blog-editor/${post.id}`}
                        className="inline-flex items-center gap-1 text-blue-400 hover:text-blue-300 text-xs font-medium transition"
                      >
                        Edit
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className="flex items-center justify-center gap-2">
              {Array.from({ length: pagination.pages }, (_, i) => (
                <button
                  key={i}
                  onClick={() => handlePageChange(i + 1)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                    pagination.currentPage === i + 1
                      ? "bg-blue-600 text-white"
                      : "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white"
                  }`}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          )}

          {/* Summary */}
          <p className="text-center text-gray-500 text-xs">
            Showing {posts.length} of {pagination.total} posts
          </p>
        </div>
      )}
    </div>
  );
}
