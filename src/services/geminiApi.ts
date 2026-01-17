// Gemini API Service for Restaurant Insights
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent';

interface RestaurantInsight {
  whyVisit: string;
  bestTime: string;
}

// Cache to avoid repeated API calls
const insightCache = new Map<string, RestaurantInsight>();

// Smart fallbacks based on restaurant type
function getSmartFallback(categories: string, rating: number): RestaurantInsight {
  const lowerCat = categories.toLowerCase();
  
  // Determine best time based on category
  let bestTime = 'Lunch or dinner';
  if (lowerCat.includes('breakfast') || lowerCat.includes('brunch') || lowerCat.includes('cafe') || lowerCat.includes('coffee')) {
    bestTime = 'Weekend brunch';
  } else if (lowerCat.includes('bar') || lowerCat.includes('pub')) {
    bestTime = 'Evening drinks';
  } else if (lowerCat.includes('pizza') || lowerCat.includes('fast food')) {
    bestTime = 'Late night';
  } else if (lowerCat.includes('fine dining') || lowerCat.includes('steakhouse')) {
    bestTime = 'Dinner reservation';
  }

  // Determine why visit based on category and rating
  let whyVisit = 'Popular local spot';
  
  if (rating >= 4.5) {
    if (lowerCat.includes('italian')) whyVisit = 'Authentic Italian cuisine loved by locals';
    else if (lowerCat.includes('seafood')) whyVisit = 'Fresh seafood and harbor views';
    else if (lowerCat.includes('american')) whyVisit = 'Classic American comfort food done right';
    else if (lowerCat.includes('mexican')) whyVisit = 'Bold flavors and generous portions';
    else if (lowerCat.includes('asian') || lowerCat.includes('chinese') || lowerCat.includes('japanese')) whyVisit = 'Authentic Asian flavors and fresh ingredients';
    else if (lowerCat.includes('pizza')) whyVisit = 'Best pizza in the neighborhood';
    else if (lowerCat.includes('cafe') || lowerCat.includes('coffee')) whyVisit = 'Perfect coffee and cozy atmosphere';
    else if (lowerCat.includes('bar')) whyVisit = 'Great drinks and lively atmosphere';
    else if (lowerCat.includes('bakery')) whyVisit = 'Fresh baked goods daily';
    else whyVisit = 'Highly rated local favorite';
  } else if (rating >= 4.0) {
    if (lowerCat.includes('italian')) whyVisit = 'Solid Italian classics';
    else if (lowerCat.includes('seafood')) whyVisit = 'Fresh catch of the day';
    else if (lowerCat.includes('american')) whyVisit = 'Reliable American fare';
    else if (lowerCat.includes('mexican')) whyVisit = 'Tasty Mexican favorites';
    else if (lowerCat.includes('pizza')) whyVisit = 'Good pizza at fair prices';
    else if (lowerCat.includes('cafe')) whyVisit = 'Nice spot for coffee';
    else if (lowerCat.includes('bar')) whyVisit = 'Casual drinks and bites';
    else whyVisit = 'Well-reviewed neighborhood spot';
  } else {
    whyVisit = 'Convenient location';
  }

  return { whyVisit, bestTime };
}

export async function getRestaurantInsight(
  name: string,
  categories: string,
  rating: number,
  city: string
): Promise<RestaurantInsight> {
  // Check cache first
  const cacheKey = `${name}-${city}`;
  if (insightCache.has(cacheKey)) {
    return insightCache.get(cacheKey)!;
  }

  // Smart fallback based on restaurant type
  const fallback = getSmartFallback(categories, rating);

  if (!GEMINI_API_KEY) {
    console.warn('Gemini API key not set, using smart fallback');
    return fallback;
  }

  try {
    const prompt = `You are a local Boston food expert. For "${name}" (${categories}) in ${city} with ${rating} stars:

Write EXACTLY in this format:
WHY: [One compelling sentence about what makes it special, max 12 words]
BEST TIME: [Specific time like "Weekday lunch" or "Weekend brunch", max 5 words]

Be specific and authentic. Focus on what locals love.`;

    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: prompt
          }]
        }],
        generationConfig: {
          temperature: 0.8,
          maxOutputTokens: 80,
        }
      })
    });

    if (!response.ok) {
      console.error('Gemini API error:', response.status, await response.text());
      return fallback;
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    console.log('Gemini response for', name, ':', text);

    // Parse response
    const whyMatch = text.match(/WHY:\s*(.+?)(?:\n|BEST TIME|$)/i);
    const bestTimeMatch = text.match(/BEST TIME:\s*(.+?)(?:\n|$)/i);

    const insight: RestaurantInsight = {
      whyVisit: whyMatch?.[1]?.trim() || fallback.whyVisit,
      bestTime: bestTimeMatch?.[1]?.trim() || fallback.bestTime
    };

    // Cache the result
    insightCache.set(cacheKey, insight);

    return insight;
  } catch (error) {
    console.error('Failed to get restaurant insight:', error);
    return fallback;
  }
}

// Generate insight on-demand (for popup)
export async function generateRestaurantInsightHTML(
  name: string,
  categories: string,
  rating: number,
  city: string
): Promise<string> {
  const insight = await getRestaurantInsight(name, categories, rating, city);
  
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
