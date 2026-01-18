import { memo } from 'react';
import type { HeroOption } from '../types/vector';
import './HeroOptions.css';

export interface HeroOptionsProps {
  options: HeroOption[];
  onOptionClick: (option: HeroOption) => void;
  isLoading?: boolean;
  cityPulse?: 'slow' | 'moderate' | 'active' | 'busy';
}

/**
 * Hero Options Component - 4 Quick Suggestions
 *
 * Layout:
 * ┌─────────────────────────────────────────────┐
 * │  [🍝 Italian]  [🎭 Shows]  [🍺 Bars]  [🌳 Parks] │
 * └─────────────────────────────────────────────┘
 *
 * Fixed above search bar, updates with "city pulse"
 */
function HeroOptions({
  options,
  onOptionClick,
  isLoading = false,
  cityPulse = 'moderate'
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
    <div className={`hero-options pulse-${cityPulse}`}>
      {options.slice(0, 4).map((option) => (
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

      {/* City Pulse Indicator */}
      <div className={`pulse-indicator ${cityPulse}`}>
        <span className="pulse-dot" />
        <span className="pulse-text">{cityPulse}</span>
      </div>
    </div>
  );
}

export default memo(HeroOptions);
