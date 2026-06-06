'use client';

export type ProductCardProps = {
  id: number | string;
  name: string;
  description?: string;
  price: number; // pence
  imageUrls?: string[];
  stockQuantity?: number;
  isPreorder?: boolean;
  limitedEdition?: boolean;
  onAddToCart?: (id: number | string) => void;
  currencySymbol?: string;
};

export default function ProductCard({
  id,
  name,
  description,
  price,
  imageUrls = [],
  stockQuantity = 0,
  isPreorder = false,
  limitedEdition = false,
  onAddToCart,
  currencySymbol = '£',
}: ProductCardProps) {
  const priceDisplay = `${currencySymbol}${(price / 100).toFixed(2)}`;
  const mainImage = imageUrls[0];
  const inStock = stockQuantity > 0 || isPreorder;

  return (
    <div style={{
      border: '1px solid #e5e7eb',
      borderRadius: '8px',
      overflow: 'hidden',
      background: '#fff',
    }}>
      {mainImage && (
        <div style={{ position: 'relative', paddingTop: '100%', background: '#f9fafb' }}>
          <img
            src={mainImage}
            alt={name}
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
          />
          {limitedEdition && (
            <span style={{
              position: 'absolute', top: '8px', left: '8px',
              background: '#ef4444', color: '#fff', padding: '2px 8px',
              borderRadius: '4px', fontSize: '11px', fontWeight: '600',
            }}>
              Limited Edition
            </span>
          )}
          {isPreorder && (
            <span style={{
              position: 'absolute', top: '8px', right: '8px',
              background: '#f59e0b', color: '#fff', padding: '2px 8px',
              borderRadius: '4px', fontSize: '11px', fontWeight: '600',
            }}>
              Pre-order
            </span>
          )}
        </div>
      )}
      <div style={{ padding: '16px' }}>
        <h3 style={{ margin: '0 0 4px', fontSize: '16px', fontWeight: '600' }}>{name}</h3>
        {description && (
          <p style={{ margin: '0 0 12px', fontSize: '14px', color: '#6b7280', lineHeight: '1.4' }}>
            {description.length > 100 ? description.slice(0, 100) + '...' : description}
          </p>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '18px', fontWeight: '700' }}>{priceDisplay}</span>
          {onAddToCart && (
            <button
              onClick={() => onAddToCart(id)}
              disabled={!inStock}
              data-action="product_add_to_cart"
              style={{
                padding: '8px 16px',
                background: inStock ? '#000' : '#d1d5db',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                fontWeight: '500',
                cursor: inStock ? 'pointer' : 'not-allowed',
                fontSize: '13px',
              }}
            >
              {isPreorder ? 'Pre-order' : inStock ? 'Add to Cart' : 'Out of Stock'}
            </button>
          )}
        </div>
        {stockQuantity > 0 && stockQuantity <= 5 && (
          <p style={{ margin: '8px 0 0', fontSize: '12px', color: '#ef4444' }}>
            Only {stockQuantity} left!
          </p>
        )}
      </div>
    </div>
  );
}
