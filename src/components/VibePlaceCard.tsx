import { memo } from 'react';
import type { VectorSearchResult } from '../types/vector';
import { getSentimentBadge, formatPriceLevel, formatCategories } from '../types/vector';
import './VibePlaceCard.css';

export interface VibePlaceCardProps {
  place: VectorSearchResult;
  isAdded: boolean;
  onAdd: (place: VectorSearchResult) => void;
  onSkip: (place: VectorSearchResult) => void;
  onClick: (place: VectorSearchResult) => void;
  style?: React.CSSProperties;
}

/**
 * Horizontal action card for place discovery
 *
 * Layout:
 * ┌─────────────────────────────────────────────┐
 * │ ┌────────┐  Title                    [Add] │
 * │ │ Image  │  ⭐ 4.5 • $$ • Italian          │
 * │ │ (40%)  │  "Cozy vibes, great pasta"      │
 * │ └────────┘  🔥 Trending on Reddit          │
 * └─────────────────────────────────────────────┘
 */
function VibePlaceCard({
  place,
  isAdded,
  onAdd,
  onSkip,
  onClick,
  style
}: VibePlaceCardProps) {
  const sentimentBadge = getSentimentBadge(place);
  const priceLevel = formatPriceLevel(place.price_level);
  const categories = formatCategories(place.categories);

  // Generate a placeholder image URL based on place name
  const imageUrl = place.photo_name
    ? `https://places.googleapis.com/v1/${place.photo_name}/media?maxWidthPx=400&key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}`
    : `https://source.unsplash.com/400x300/?restaurant,food,${encodeURIComponent(categories || 'dining')}`;

  const handleAddClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isAdded) {
      onAdd(place);
    }
  };

  // Skip handler available if needed for future use
  void onSkip;

  return (
    <div
      className={`vibe-place-card ${isAdded ? 'added' : ''}`}
      style={{
        ...style,
        '--card-image': `url(${imageUrl})`
      } as React.CSSProperties}
      onClick={() => onClick(place)}
    >
      {/* Image Section (40% width) */}
      <div className="card-image-section">
        <div className="card-image" />
      </div>

      {/* Content Section (60% width) */}
      <div className="card-content-section">
        {/* Title */}
        <h3 className="card-title">{place.businessname}</h3>

        {/* Meta Row: Rating, Price, Category */}
        <div className="card-meta">
          {place.rating && (
            <span className="meta-rating">
              <span className="star">★</span>
              {place.rating.toFixed(1)}
            </span>
          )}
          {priceLevel && <span className="meta-price">{priceLevel}</span>}
          {categories && <span className="meta-category">{categories}</span>}
        </div>

        {/* Address/Vibe */}
        <p className="card-address">{place.address}, {place.city}</p>

        {/* Sentiment Badge */}
        {sentimentBadge && (
          <div className={`sentiment-badge ${sentimentBadge.type} ${sentimentBadge.glowing ? 'glowing' : ''}`}>
            <span className="badge-emoji">{sentimentBadge.emoji}</span>
            <span className="badge-label">{sentimentBadge.label}</span>
          </div>
        )}
      </div>

      {/* Action Button */}
      <div className="card-actions">
        <button
          className={`action-btn add ${isAdded ? 'added' : ''}`}
          onClick={handleAddClick}
          disabled={isAdded}
        >
          {isAdded ? 'Added' : 'Add'}
        </button>
      </div>

      {/* Added Badge */}
      {isAdded && (
        <div className="added-badge">
          <span>✓</span>
        </div>
      )}
    </div>
  );
}

// Memoize for virtual list performance
export default memo(VibePlaceCard);
