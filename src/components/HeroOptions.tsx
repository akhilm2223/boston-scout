import { memo } from 'react';
import type { HeroOption } from '../types/vector';
import './HeroOptions.css';

export interface HeroOptionsProps {
  options: HeroOption[];
  onOptionClick: (option: HeroOption) => void;
  onEventsClick?: () => void;
  onLandmarksClick?: () => void;
  onHiddenClick?: () => void;
  onAllClick?: () => void;
  isLoading?: boolean;
}

/**
 * Hero Options Component - Quick Suggestions + Events Button
 *
 * Layout:
 * ┌─────────────────────────────────────────────────────────┐
 * │  [🍝 Italian]  [🎭 Shows]  [🍺 Bars]  [🎪 Events] │
 * └─────────────────────────────────────────────────────────┘
 */
function HeroOptions({
  options,
  onOptionClick,
  onEventsClick,
  onLandmarksClick,
  onHiddenClick,
  onAllClick,
  isLoading = false
}: HeroOptionsProps) {
  if (isLoading) {
    return (
      <div className="hero-options loading">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="hero-option-skeleton" />
        ))}
      </div>
    );
  }

  return (
    <div className="hero-options">
      {/* All Button - Search Everything */}
      {onAllClick && (
        <button
          className="hero-option all-btn"
          onClick={onAllClick}
          title="Search All Categories"
        >
          <span className="hero-emoji">🔍</span>
          <span className="hero-label">All</span>
        </button>
      )}

      {options.slice(0, 1).map((option) => (
        <button
          key={option.id}
          className="hero-option"
          onClick={() => onOptionClick(option)}
          title={`Search for ${option.label}`}
        >
          <span className="hero-emoji">{option.emoji}</span>
          <span className="hero-label">{option.label}</span>
        </button>
      ))}

      {/* Landmarks Button */}
      {onLandmarksClick && (
        <button
          className="hero-option landmarks-btn"
          onClick={onLandmarksClick}
          title="Browse Landmarks"
        >
          <span className="hero-emoji">🏛️</span>
          <span className="hero-label">Landmarks</span>
        </button>
      )}

      {/* Events Button */}
      {onEventsClick && (
        <button
          className="hero-option events-btn"
          onClick={onEventsClick}
          title="Browse Events"
        >
          <span className="hero-emoji">🎪</span>
          <span className="hero-label">Events</span>
        </button>
      )}

      {/* Hidden Gems Button */}
      {onHiddenClick && (
        <button
          className="hero-option hidden-btn"
          onClick={onHiddenClick}
          title="Hidden Gems from Reddit"
        >
          <span className="hero-emoji">💎</span>
          <span className="hero-label">Hidden</span>
        </button>
      )}
    </div>
  );
}

export default memo(HeroOptions);
