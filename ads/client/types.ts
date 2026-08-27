export type Product = {
  id: number | string;
  name: string;
  description: string;
  price_display: string;
  price_pence?: number;
  image_url: string;
  product_url: string;
  limited_edition?: boolean;
  is_preorder?: boolean;
  category?: string | null;
  shop_name?: string;
};

export type ShopConfig = {
  url: string;
  name: string;
  origin: string;
  max_products?: number;
};
