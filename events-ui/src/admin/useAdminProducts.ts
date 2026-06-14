"use client";

import { useState, useEffect, useCallback } from "react";
import { useEventsConfig } from "../context/EventsProvider";
import type { AdminProduct } from "./types";

/**
 * Hook for managing products in the admin panel.
 * Provides CRUD operations for products, packages, sections, and images.
 */
export function useAdminProducts() {
  const { apiBase, adminSecret } = useEventsConfig();
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const headers = useCallback(() => {
    const h: Record<string, string> = { "Content-Type": "application/json" };
    if (adminSecret) h["x-admin-key"] = adminSecret;
    return h;
  }, [adminSecret]);

  const fetchProducts = useCallback(async () => {
    try {
      console.log("[EventsAdmin] Fetching products");
      // Try admin endpoint first (includes inactive), fall back to public
      let res = await fetch(`${apiBase}/api/admin/products`, { headers: headers() });
      if (!res.ok) {
        res = await fetch(`${apiBase}/api/products?active=false`);
      }
      if (res.ok) {
        const data = await res.json();
        console.log(`[EventsAdmin] Loaded ${data.length} products`);
        setProducts(data);
      }
    } catch (err) {
      console.error("[EventsAdmin] Error fetching products:", err);
      setError("Failed to load products");
    } finally {
      setLoading(false);
    }
  }, [apiBase, headers]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  /** Refresh a single product in the list */
  const refreshProduct = useCallback(async (productId: string) => {
    try {
      const res = await fetch(`${apiBase}/api/products/${productId}`);
      if (res.ok) {
        const updated = await res.json();
        setProducts((prev) => prev.map((p) => (p.id === productId ? { ...p, ...updated } : p)));
      }
    } catch (err) {
      console.error("[EventsAdmin] Error refreshing product:", err);
    }
  }, [apiBase]);

  /** Create a new product */
  const createProduct = useCallback(async (data: Record<string, unknown>): Promise<AdminProduct | null> => {
    try {
      const res = await fetch(`${apiBase}/api/admin/products`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify(data),
      });
      if (res.ok) {
        const product = await res.json();
        console.log(`[EventsAdmin] Created product: ${product.name}`);
        await fetchProducts();
        return product;
      }
      const err = await res.json();
      throw new Error(err.error || "Failed to create product");
    } catch (err) {
      console.error("[EventsAdmin] Error creating product:", err);
      return null;
    }
  }, [apiBase, headers, fetchProducts]);

  /** Update a product */
  const updateProduct = useCallback(async (productId: string, data: Record<string, unknown>): Promise<boolean> => {
    try {
      const res = await fetch(`${apiBase}/api/admin/products/${productId}`, {
        method: "PUT",
        headers: headers(),
        body: JSON.stringify(data),
      });
      if (res.ok) {
        console.log(`[EventsAdmin] Updated product: ${productId}`);
        await refreshProduct(productId);
        return true;
      }
      return false;
    } catch (err) {
      console.error("[EventsAdmin] Error updating product:", err);
      return false;
    }
  }, [apiBase, headers, refreshProduct]);

  /** Toggle product active status */
  const toggleActive = useCallback(async (productId: string): Promise<boolean> => {
    try {
      const res = await fetch(`${apiBase}/api/admin/products/${productId}/toggle`, {
        method: "PUT",
        headers: headers(),
      });
      if (res.ok) {
        await refreshProduct(productId);
        return true;
      }
      return false;
    } catch (err) {
      console.error("[EventsAdmin] Error toggling active:", err);
      return false;
    }
  }, [apiBase, headers, refreshProduct]);

  /** Delete a product */
  const deleteProduct = useCallback(async (productId: string): Promise<boolean> => {
    try {
      const res = await fetch(`${apiBase}/api/admin/products/${productId}`, {
        method: "DELETE",
        headers: headers(),
      });
      if (res.ok) {
        console.log(`[EventsAdmin] Deleted product: ${productId}`);
        setProducts((prev) => prev.filter((p) => p.id !== productId));
        return true;
      }
      return false;
    } catch (err) {
      console.error("[EventsAdmin] Error deleting product:", err);
      return false;
    }
  }, [apiBase, headers]);

  // --- Package operations ---

  const createPackage = useCallback(async (productId: string, data: Record<string, unknown>): Promise<boolean> => {
    try {
      const res = await fetch(`${apiBase}/api/admin/packages`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ ...data, productId }),
      });
      if (res.ok) {
        await refreshProduct(productId);
        return true;
      }
      return false;
    } catch (err) {
      console.error("[EventsAdmin] Error creating package:", err);
      return false;
    }
  }, [apiBase, headers, refreshProduct]);

  const updatePackage = useCallback(async (packageId: string, productId: string, data: Record<string, unknown>): Promise<boolean> => {
    try {
      const res = await fetch(`${apiBase}/api/admin/packages/${packageId}`, {
        method: "PUT",
        headers: headers(),
        body: JSON.stringify(data),
      });
      if (res.ok) {
        await refreshProduct(productId);
        return true;
      }
      return false;
    } catch (err) {
      console.error("[EventsAdmin] Error updating package:", err);
      return false;
    }
  }, [apiBase, headers, refreshProduct]);

  const deletePackage = useCallback(async (packageId: string, productId: string): Promise<boolean> => {
    try {
      const res = await fetch(`${apiBase}/api/admin/packages/${packageId}`, {
        method: "DELETE",
        headers: headers(),
      });
      if (res.ok) {
        await refreshProduct(productId);
        return true;
      }
      return false;
    } catch (err) {
      console.error("[EventsAdmin] Error deleting package:", err);
      return false;
    }
  }, [apiBase, headers, refreshProduct]);

  // --- Section operations ---

  const createSection = useCallback(async (productId: string, data: Record<string, unknown>): Promise<boolean> => {
    try {
      const res = await fetch(`${apiBase}/api/admin/products/${productId}/sections`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify(data),
      });
      if (res.ok) {
        await refreshProduct(productId);
        return true;
      }
      return false;
    } catch (err) {
      console.error("[EventsAdmin] Error creating section:", err);
      return false;
    }
  }, [apiBase, headers, refreshProduct]);

  const updateSection = useCallback(async (sectionId: number, productId: string, data: Record<string, unknown>): Promise<boolean> => {
    try {
      const res = await fetch(`${apiBase}/api/admin/sections/${sectionId}`, {
        method: "PUT",
        headers: headers(),
        body: JSON.stringify(data),
      });
      if (res.ok) {
        await refreshProduct(productId);
        return true;
      }
      return false;
    } catch (err) {
      console.error("[EventsAdmin] Error updating section:", err);
      return false;
    }
  }, [apiBase, headers, refreshProduct]);

  const deleteSection = useCallback(async (sectionId: number, productId: string): Promise<boolean> => {
    try {
      const res = await fetch(`${apiBase}/api/admin/sections/${sectionId}`, {
        method: "DELETE",
        headers: headers(),
      });
      if (res.ok) {
        await refreshProduct(productId);
        return true;
      }
      return false;
    } catch (err) {
      console.error("[EventsAdmin] Error deleting section:", err);
      return false;
    }
  }, [apiBase, headers, refreshProduct]);

  const reorderSections = useCallback(async (productId: string, sectionIds: number[]): Promise<boolean> => {
    try {
      const res = await fetch(`${apiBase}/api/admin/products/${productId}/sections/reorder`, {
        method: "PUT",
        headers: headers(),
        body: JSON.stringify({ sectionIds }),
      });
      if (res.ok) {
        await refreshProduct(productId);
        return true;
      }
      return false;
    } catch (err) {
      console.error("[EventsAdmin] Error reordering sections:", err);
      return false;
    }
  }, [apiBase, headers, refreshProduct]);

  // --- Image operations ---

  const addImage = useCallback(async (productId: string, url: string, alt?: string): Promise<boolean> => {
    try {
      const res = await fetch(`${apiBase}/api/admin/products/${productId}/images`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ url, alt }),
      });
      if (res.ok) {
        await refreshProduct(productId);
        return true;
      }
      return false;
    } catch (err) {
      console.error("[EventsAdmin] Error adding image:", err);
      return false;
    }
  }, [apiBase, headers, refreshProduct]);

  const deleteImage = useCallback(async (imageId: number, productId: string): Promise<boolean> => {
    try {
      const res = await fetch(`${apiBase}/api/admin/images/${imageId}`, {
        method: "DELETE",
        headers: headers(),
      });
      if (res.ok) {
        await refreshProduct(productId);
        return true;
      }
      return false;
    } catch (err) {
      console.error("[EventsAdmin] Error deleting image:", err);
      return false;
    }
  }, [apiBase, headers, refreshProduct]);

  const reorderImages = useCallback(async (productId: string, imageIds: number[]): Promise<boolean> => {
    try {
      const res = await fetch(`${apiBase}/api/admin/products/${productId}/images/reorder`, {
        method: "PUT",
        headers: headers(),
        body: JSON.stringify({ imageIds }),
      });
      if (res.ok) {
        await refreshProduct(productId);
        return true;
      }
      return false;
    } catch (err) {
      console.error("[EventsAdmin] Error reordering images:", err);
      return false;
    }
  }, [apiBase, headers, refreshProduct]);

  return {
    products,
    loading,
    error,
    fetchProducts,
    refreshProduct,
    createProduct,
    updateProduct,
    toggleActive,
    deleteProduct,
    createPackage,
    updatePackage,
    deletePackage,
    createSection,
    updateSection,
    deleteSection,
    reorderSections,
    addImage,
    deleteImage,
    reorderImages,
  };
}
