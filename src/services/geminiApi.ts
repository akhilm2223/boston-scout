// Gemini API Service for Place Insights
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const GEMINI_API_URL =
	"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

interface PlaceInsight {
	whyVisit: string;
	bestTime: string;
}

// Cache to avoid repeated API calls
const insightCache = new Map<string, PlaceInsight>();

// Smart fallbacks based on place type
function getSmartFallback(categories: string, rating: number): PlaceInsight {
	const lowerCat = categories.toLowerCase();

	// Determine best time based on category
	let bestTime = "Lunch or dinner";
	if (
		lowerCat.includes("breakfast") ||
		lowerCat.includes("brunch") ||
		lowerCat.includes("cafe") ||
		lowerCat.includes("coffee")
	) {
		bestTime = "Weekend brunch";
	} else if (lowerCat.includes("bar") || lowerCat.includes("pub")) {
		bestTime = "Evening drinks";
	} else if (lowerCat.includes("pizza") || lowerCat.includes("fast food")) {
		bestTime = "Late night";
	} else if (
		lowerCat.includes("fine dining") ||
		lowerCat.includes("steakhouse")
	) {
		bestTime = "Dinner reservation";
	}

	// Determine why visit based on category and rating
	let whyVisit = "Popular local spot";

	if (rating >= 4.5) {
		if (lowerCat.includes("italian"))
			whyVisit = "Authentic Italian cuisine loved by locals";
		else if (lowerCat.includes("seafood"))
			whyVisit = "Fresh seafood and harbor views";
		else if (lowerCat.includes("american"))
			whyVisit = "Classic American comfort food done right";
		else if (lowerCat.includes("mexican"))
			whyVisit = "Bold flavors and generous portions";
		else if (
			lowerCat.includes("asian") ||
			lowerCat.includes("chinese") ||
			lowerCat.includes("japanese")
		)
			whyVisit = "Authentic Asian flavors and fresh ingredients";
		else if (lowerCat.includes("pizza"))
			whyVisit = "Best pizza in the neighborhood";
		else if (lowerCat.includes("cafe") || lowerCat.includes("coffee"))
			whyVisit = "Perfect coffee and cozy atmosphere";
		else if (lowerCat.includes("bar"))
			whyVisit = "Great drinks and lively atmosphere";
		else if (lowerCat.includes("bakery"))
			whyVisit = "Fresh baked goods daily";
		else whyVisit = "Highly rated local favorite";
	} else if (rating >= 4.0) {
		if (lowerCat.includes("italian")) whyVisit = "Solid Italian classics";
		else if (lowerCat.includes("seafood"))
			whyVisit = "Fresh catch of the day";
		else if (lowerCat.includes("american"))
			whyVisit = "Reliable American fare";
		else if (lowerCat.includes("mexican"))
			whyVisit = "Tasty Mexican favorites";
		else if (lowerCat.includes("pizza"))
			whyVisit = "Good pizza at fair prices";
		else if (lowerCat.includes("cafe")) whyVisit = "Nice spot for coffee";
		else if (lowerCat.includes("bar")) whyVisit = "Casual drinks and bites";
		else whyVisit = "Well-reviewed neighborhood spot";
	} else {
		whyVisit = "Convenient location";
	}

	return { whyVisit, bestTime };
}

export async function getPlaceInsight(
	name: string,
	categories: string,
	rating: number,
	city: string,
): Promise<PlaceInsight> {
	// Check cache first
	const cacheKey = `${name}-${city}`;
	if (insightCache.has(cacheKey)) {
		return insightCache.get(cacheKey)!;
	}

	// Smart fallback based on place type
	const fallback = getSmartFallback(categories, rating);

	if (!GEMINI_API_KEY) {
		console.warn("Gemini API key not set, using smart fallback");
		return fallback;
	}

	try {
		const prompt = `You are a local Boston food expert. For "${name}" (${categories}) in ${city} with ${rating} stars:

Write EXACTLY in this format:
WHY: [One compelling sentence about what makes it special, max 12 words]
BEST TIME: [Specific time like "Weekday lunch" or "Weekend brunch", max 5 words]

Be specific and authentic. Focus on what locals love.`;

		const response = await fetch(
			`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`,
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					contents: [
						{
							parts: [
								{
									text: prompt,
								},
							],
						},
					],
					generationConfig: {
						temperature: 0.8,
						maxOutputTokens: 80,
					},
				}),
			},
		);

		if (!response.ok) {
			console.error(
				"Gemini API error:",
				response.status,
				await response.text(),
			);
			return fallback;
		}

		const data = await response.json();
		const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

		console.log("Gemini response for", name, ":", text);

		// Parse response
		const whyMatch = text.match(/WHY:\s*(.+?)(?:\n|BEST TIME|$)/i);
		const bestTimeMatch = text.match(/BEST TIME:\s*(.+?)(?:\n|$)/i);

		const insight: PlaceInsight = {
			whyVisit: whyMatch?.[1]?.trim() || fallback.whyVisit,
			bestTime: bestTimeMatch?.[1]?.trim() || fallback.bestTime,
		};

		// Cache the result
		insightCache.set(cacheKey, insight);

		return insight;
	} catch (error) {
		console.error("Failed to get place insight:", error);
		return fallback;
	}
}

// Generate insight on-demand (for popup)
export async function generatePlaceInsightHTML(
	name: string,
	categories: string,
	rating: number,
	city: string,
): Promise<string> {
	const insight = await getPlaceInsight(name, categories, rating, city);

	return `
    <div style="margin: 12px 0; padding: 12px; background: #fafafa; border-radius: 6px; border-left: 3px solid #000;">
      <div style="font-size: 11px; font-weight: 700; color: #000; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">
        Why Visit
      </div>
      <div style="font-size: 13px; color: #1a1a1a; line-height: 1.5; font-weight: 500; margin-bottom: 8px;">
        ${insight.whyVisit}
      </div>
      <div style="display: flex; align-items: center; gap: 6px;">
        <span style="font-size: 11px; font-weight: 700; color: #000; text-transform: uppercase; letter-spacing: 0.5px;">
          Best Time:
        </span>
        <span style="font-size: 12px; color: #1a1a1a; font-weight: 600;">
          ${insight.bestTime}
        </span>
      </div>
    </div>
  `;
}

// Optimization for Itinerary
import { ItineraryEvent } from "../types/types";

export async function optimizeItinerary(
	itinerary: ItineraryEvent[],
	tripDates?: any,
	selectedHotel?: any,
): Promise<string> {
	if (!GEMINI_API_KEY) {
		return JSON.stringify({
			error: "Gemini API key is missing. Please check your .env file.",
		});
	}

	// Calculate trip duration
	let numDays = 1;
	if (tripDates?.startDate && tripDates?.endDate) {
		const start = new Date(tripDates.startDate);
		const end = new Date(tripDates.endDate);
		const diffTime = Math.abs(end.getTime() - start.getTime());
		numDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
	}

	const isMultiDay = numDays > 1;

	const items = itinerary.map((item) => ({
		name: item.name,
		location: item.location,
		duration: item.duration,
		category: item.category,
		fixedTime: item.time,
	}));

	const hotelInfo = selectedHotel
		? `
    Hotel: ${selectedHotel.name}
    Location: ${selectedHotel.location.lat}, ${selectedHotel.location.lng}
    Address: ${selectedHotel.address || "N/A"}
  `
		: "No hotel selected";

	const prompt = `
    You are a public-transit itinerary optimization engine.

    Trip Duration: ${numDays} day${numDays > 1 ? "s" : ""}
    Trip Dates: ${tripDates ? `${tripDates.startDate} to ${tripDates.endDate}` : "Not specified"}

    Given a list of locations with latitude, longitude, and time constraints:
    - Events have fixed start times
    - Restaurants have time windows
    - Landmarks are flexible

    ${selectedHotel ? hotelInfo : ""}

    Here are the locations to visit:
    ${JSON.stringify(items, null, 2)}

    ${
		isMultiDay
			? `CREATE A ${numDays}-DAY ITINERARY:

    CRITICAL HOTEL RULES (MUST FOLLOW):
    - EVERY day MUST start at the hotel
    - EVERY day MUST end at the hotel
    - First activity of each day: "Leave hotel" or "Check out from hotel"
    - Last activity of each day: "Return to hotel" or "Check in at hotel"
    - Example Day 1: Hotel → Transit → Activity → ... → Dinner → Transit → Hotel
    - Example Day 2: Hotel → Transit → Activity → ... → Dinner → Transit → Hotel
    
    - Organize activities across ${numDays} days
    - Balance activities evenly across days
    - Only include activites once in the entire itinerary
    - At least one activity per day if possible
    - Include realistic travel times from/to hotel`
			: "CREATE A SINGLE-DAY ITINERARY:"
	}

    Your task:
    1. Determine the optimal visit order to minimize total travel time.
    2. STRICTLY use public transportation (MBTA bus, subway, commuter rail) for distances over 0.5 miles.
    3. MEAL TIME RULES:
       - Lunch: 11:30 AM - 2:00 PM
       - Dinner: 6:00 PM - 9:00 PM
    4. LOGICAL FLOW:
       ${
			isMultiDay
				? `
       - DAY START: Hotel → Travel to first location
       - DAY FLOW: Morning → Lunch → Afternoon → Dinner → Evening
       - DAY END: Travel back to hotel → Arrive at hotel
       `
				: `
       - START from ${selectedHotel ? "hotel" : startLocation ? "start location" : "central location"}
       - Order: Travel → Morning → Lunch → Afternoon → Dinner → Evening
       `
		}
    5. Respect all time constraints.

    ${
		isMultiDay
			? `Return JSON with "days" array. Each day has:
    - "day": number
    - "date": string
    - "schedule": array of steps`
			: 'Return JSON with "schedule" array of steps.'
	}

    Each step:
    - "time": string (arrival time or boarding time for transit)
    - "description": string
    - "type": "transit" | "activity" | "meal" | "hotel"
    - "transport_mode": "walking" | "bus" | "train" | "subway" | null
    - "route_info": string | null (e.g., "Red Line", "Bus 57")
    - "boarding_time": string | null (REQUIRED for bus/train/subway - exact time to board, e.g., "09:15")
    - "duration": string | null
    - "details": string

    IMPORTANT TRANSIT RULES:
    - For bus/train/subway steps, ALWAYS include "boarding_time" with the exact time to catch the transit
    - Example: {"time": "09:15", "description": "Board Red Line to Downtown", "type": "transit", "transport_mode": "subway", "route_info": "Red Line", "boarding_time": "09:15", "duration": "12 mins"}
    - For walking, boarding_time should be null

    Return STRICT JSON ONLY.
  `;

	try {
		console.log("Optimizing Itinerary");
		const response = await fetch(
			`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`,
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					contents: [
						{
							parts: [
								{
									text: prompt,
								},
							],
						},
					],
					generationConfig: {
						temperature: 0.2, // Lower temperature for more deterministic/structured output
						response_mime_type: "application/json",
					},
				}),
			},
		);

		if (!response.ok) {
			console.error(
				"Gemini API error:",
				response.status,
				await response.text(),
			);
			return JSON.stringify({
				error: "Failed to generate itinerary. Please try again later.",
			});
		}

		const data = await response.json();
		return (
			data.candidates?.[0]?.content?.parts?.[0]?.text ||
			JSON.stringify({ error: "No response generated." })
		);
	} catch (error) {
		console.error("Error organizing itinerary:", error);
		return JSON.stringify({
			error: "Failed to generate itinerary. Please check your connection.",
		});
	}
}
