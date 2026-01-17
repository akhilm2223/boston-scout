export interface ItineraryEvent {
	id: string;
	name: string;
	location: [number, number];
	time: string;
	duration: string;
	vibe: string;
	sentiment: "positive" | "neutral" | "warning";
	category: "transit" | "food" | "attraction" | "university" | "event";
	eventData?: BostonEvent;
}

export interface SearchResult {
    classification: {
        categories: string[];
        dateHint: string | null;
        keywords: string[];
    };
    dateRange: { start: string; end: string } | null;
    count: number;
    events: BostonEvent[];
}

export interface Restaurant {
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
}

export interface PlacesPanelProps {
	onAddToItinerary: (event: ItineraryEvent) => void;
	onLocationClick: (location: [number, number], name: string) => void;
}

export interface SearchResult {
	classification: {
		categories: string[];
		dateHint: string | null;
		keywords: string[];
	};
	dateRange: { start: string; end: string } | null;
	count: number;
	events: BostonEvent[];
}   

export interface BostonEvent {
  _id: string;
  id: string;
  title: string;
  description: string;
  start_time: string;
  end_time: string;
  venue: {
    name: string;
    lat: number;
    lng: number;
  };
  categories?: string[];
  price?: string;
  source?: string;
  source_url?: string;
}