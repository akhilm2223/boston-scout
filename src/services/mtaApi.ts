
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export interface MTAEntity {
    id: string;
    isDeleted?: boolean;
    tripUpdate?: {
        trip: {
            tripId: string;
            routeId: string;
            startTime: string;
            startDate: string;
            scheduleRelationship?: string;
        };
        stopTimeUpdate: {
            stopSequence?: number;
            stopId: string;
            arrival?: { delay?: number; time: string | number; uncertainty?: number };
            departure?: { delay?: number; time: string | number; uncertainty?: number };
            scheduleRelationship?: string;
        }[];
    };
    vehicle?: {
        trip: {
            tripId: string;
            routeId: string;
            startTime: string;
            startDate: string;
            scheduleRelationship?: string;
        };
        position?: {
            latitude: number;
            longitude: number;
            bearing?: number;
            speed?: number;
        };
        currentStopSequence?: number;
        stopId?: string;
        currentStatus?: string;
        timestamp?: string | number;
        occupancyStatus?: string;
    };
    alert?: any;
}

export interface GtfsFeedMessage {
    header: {
        gtfsRealtimeVersion: string;
        incrementality: string;
        timestamp: string | number;
    };
    entity: MTAEntity[];
}

export async function fetchMTAFeed(line: string): Promise<GtfsFeedMessage | null> {
    try {
        const response = await fetch(`${API_BASE_URL}/api/mta/${line}`);
        if (!response.ok) {
            throw new Error(`Failed to fetch MTA feed for ${line}: ${response.statusText}`);
        }
        const data = await response.json();
        return data as GtfsFeedMessage;
    } catch (error) {
        console.error(`Error fetching MTA feed for ${line}:`, error);
        return null;
    }
}

/**
 * Fetch all configured MTA feeds
 */
export async function fetchAllMTAFeeds(): Promise<Record<string, GtfsFeedMessage>> {
    const feeds = ['ace', 'bdfm', 'g', 'jz', 'nqrw', '1234567'];
    const results: Record<string, GtfsFeedMessage> = {};

    await Promise.all(feeds.map(async (feed) => {
        const data = await fetchMTAFeed(feed);
        if (data) {
            results[feed] = data;
        }
    }));

    return results;
}
