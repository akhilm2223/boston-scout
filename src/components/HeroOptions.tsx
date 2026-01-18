import { memo } from 'react';
import type { HeroOption } from '../types/vector';
import './HeroOptions.css';

export interface HeroOptionsProps {
  options: HeroOption[];
  onOptionClick: (option: HeroOption) => void;
  onEventsClick?: () => void;
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
      {options.slice(0, 3).map((option) => (
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
    </div>
  );
}

export default memo(HeroOptions);
