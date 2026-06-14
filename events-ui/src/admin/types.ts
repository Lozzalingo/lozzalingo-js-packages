export type AdminPackage = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  duration: string | null;
  minPlayers: number | null;
  maxPlayers: number | null;
  pricePerPerson: number | null;
  flatPrice: number | null;
  minReserve: number | null;
  additionalPlayerPrice: number | null;
  includes: string | null;
  bookingType: "PRIVATE" | "PUBLIC";
  isActive: boolean;
  displayOrder: number;
  _count?: { bookings: number };
};

export type AdminProductImage = {
  id: number;
  url: string;
  alt: string | null;
  sortOrder: number;
};

export type AdminProductSection = {
  id: number;
  title: string;
  type: string;
  content: string | null;
  listItems: string | null;
  isCollapsible: boolean;
  displayOrder: number;
};

export type AdminProduct = {
  id: string;
  slug: string;
  name: string;
  description: string;
  shortDesc: string | null;
  coverImage: string | null;
  category: string;
  themes: string | null;
  maxGroupSize: number | null;
  venue: string | null;
  duration: string | null;
  ticketLimit: number | null;
  isActive: boolean;
  displayOrder: number;
  packages: AdminPackage[];
  images: AdminProductImage[];
  sections: AdminProductSection[];
  _count?: { bookings: number; packages: number };
};

export type ProductFormData = {
  name: string;
  slug: string;
  description: string;
  shortDesc: string;
  coverImage: string;
  category: string;
  themes: string;
  maxGroupSize: string;
  venue: string;
  duration: string;
  ticketLimit: string;
  displayOrder: number;
  isActive: boolean;
};

export type PackageFormData = {
  name: string;
  slug: string;
  description: string;
  duration: string;
  minPlayers: string;
  maxPlayers: string;
  pricePerPerson: string;
  flatPrice: string;
  minReserve: string;
  additionalPlayerPrice: string;
  whatsIncluded: string;
  bookingType: "PRIVATE" | "PUBLIC";
  isActive: boolean;
  displayOrder: number;
};
