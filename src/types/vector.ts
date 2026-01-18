// Vector Search Types for Vascular Discovery Engine

// Search type filter
export type SearchType = 'transit' | 'restaurants' | 'events' | 'landmarks' | 'hidden' | 'all';

export interface VectorSearchResult {
  _id: string;
  businessname: string;
  address: string;
  city: string;
  latitude: number;
  longitude: number;
  rating?: number;
  user_rating_count?: number;
  categories?: string | string[];
  price_level?: number;
  phone?: string;
  website?: string;
  google_maps_url?: string;
  photo_name?: string;
  dine_in?: boolean;
  takeout?: boolean;
  delivery?: boolean;
  reservable?: boolean;
  serves_breakfast?: boolean;
  serves_lunch?: boolean;
  serves_dinner?: boolean;
  serves_brunch?: boolean;
  outdoor_seating?: boolean;
  good_for_groups?: boolean;
  // Vector search specific fields
  embedding?: number[];
  score?: number;
  // Reddit integration fields
  reddit_mentions?: RedditMention[];
  isHiddenGem?: boolean;
  trendingScore?: number;
  // Type discriminator for unified results
  type?: 'place' | 'event';
}

export interface EventSearchResult {
  _id: string;
  title: string;
  description?: string;
  start_time: string;
  end_time?: string;
  venue: {
    name: string;
    address?: string;
    lat: number;
    lng: number;
  };
  category?: string;
  url?: string;
  image_url?: string;
  price?: string;
  // Vector search specific fields
  embedding?: number[];
  score?: number;
  // Type discriminator
  type: 'event';
}

// Reddit/Hidden post result
export interface RedditSearchResult {
  _id: string;
  id: string;
  title: string;
  text?: string;
  context?: string;
  subreddit: string;
  url: string;
  ups: number;
  num_comments: number;
  categories?: string[];
  locations?: string[];
  isHiddenGem?: boolean;
  relevanceScore?: number;
  created_at?: string;
  // Type discriminator
  type: 'reddit';
}

// Unified search result that can be place, event, or reddit post
export type UnifiedSearchResult = (VectorSearchResult & { type: 'place' }) | EventSearchResult | RedditSearchResult;

export interface RedditMention {
  postId: string;
  subreddit: string;
  title: string;
  sentiment: number; // 0-10 scale
  score: number; // Reddit upvotes
  date: string;
  permalink: string;
}

export interface VibeSearchRequest {
  query: string;
  limit?: number;
  filters?: {
    categories?: string[];
    minRating?: number;
    maxPriceLevel?: number;
  };
}

export interface VibeSearchResponse {
  results: VectorSearchResult[];
  query: string;
  count: number;
  took_ms: number;
}

export interface EventVibeSearchResponse {
  results: EventSearchResult[];
  query: string;
  count: number;
  took_ms: number;
}

export interface HeroOption {
  id: string;
  emoji: string;
  label: string;
  query: string;
  count?: number;
}

export interface HeroOptionsResponse {
  options: HeroOption[];
  transitSpeed: number;
  cityPulse: 'slow' | 'moderate' | 'active' | 'busy';
}

export interface InfiniteScrollRequest {
  cursor?: string;
  limit?: number;
  query?: string;
}

export interface InfiniteScrollResponse {
  items: VectorSearchResult[];
  nextCursor: string | null;
  hasMore: boolean;
  total: number;
}

export interface CityPulseData {
  transitSpeed: number; // 0-100 scale
  activeAreas: string[];
  trending: string[];
  timestamp: string;
}

// Place with embedded Reddit sentiment badge info
export interface PlaceWithSentiment extends VectorSearchResult {
  sentimentBadge?: {
    type: 'trending' | 'hidden_gem' | 'local_favorite' | null;
    label: string;
    emoji: string;
    glowing: boolean;
  };
}

// Helper function to determine sentiment badge
export function getSentimentBadge(place: VectorSearchResult): PlaceWithSentiment['sentimentBadge'] | null {
  if (!place.reddit_mentions || place.reddit_mentions.length === 0) {
    return null;
  }

  const avgSentiment = place.reddit_mentions.reduce((sum, m) => sum + m.sentiment, 0) / place.reddit_mentions.length;
  const totalScore = place.reddit_mentions.reduce((sum, m) => sum + m.score, 0);

  // Hidden gem: high sentiment but lower visibility
  if (place.isHiddenGem || (avgSentiment >= 8 && totalScore < 100)) {
    return {
      type: 'hidden_gem',
      label: 'Hidden Gem',
      emoji: '💎',
      glowing: true,
    };
  }

  // Trending: high recent engagement
  if (place.trendingScore && place.trendingScore >= 8) {
    return {
      type: 'trending',
      label: 'Trending on Reddit',
      emoji: '🔥',
      glowing: true,
    };
  }

  // Local favorite: consistently positive mentions
  if (avgSentiment >= 7 && place.reddit_mentions.length >= 3) {
    return {
      type: 'local_favorite',
      label: 'Local Favorite',
      emoji: '⭐',
      glowing: false,
    };
  }

  return null;
}

// Format price level to dollar signs
export function formatPriceLevel(level?: number): string {
  if (!level) return '';
  return '$'.repeat(Math.min(level, 4));
}

// Format categories for display
export function formatCategories(categories?: string | string[]): string {
  if (!categories) return '';
  if (typeof categories === 'string') return categories;
  return categories.slice(0, 2).join(' • ');
}
