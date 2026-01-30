/**
 * Voice command types that the system can respond to
 */
export interface VoiceCommand {
    type: 'scroll' | 'navigate' | 'toggle_layer' | 'search_query' | 'add_to_itinerary' | 'map_control' | 'compound' | 'gemini_question' | 'exit';
    action?: string;
    layer?: 'events' | 'places' | 'landmarks' | 'hidden';
    query?: string;
    placeName?: string;
    location?: string;
    subCommands?: VoiceCommand[];
}

/**
 * Parse voice input to determine user intent
 */
export function parseVoiceCommand(input: string): VoiceCommand {
    const lower = input.toLowerCase().trim();

    console.log('[VoiceCommand] Parsing:', input);

    // Exit/Close commands
    if (lower.includes('exit') || lower.includes('close') || lower.includes('stop listening') ||
        lower.includes('goodbye') || lower.includes('bye') || lower === 'stop' || lower === 'stop stop') {
        return { type: 'exit' };
    }

    // Scroll commands
    if (lower.includes('scroll down') || lower.includes('next') || lower.includes('more')) {
        return { type: 'scroll', action: 'down' };
    }
    if (lower.includes('scroll up') || lower.includes('back') || lower.includes('previous')) {
        return { type: 'scroll', action: 'up' };
    }

    // Map control commands - CHECK BEFORE navigation (so "zoom in chinatown" isn't caught by "the map")
    // "zoom in", "zoom into chinatown", "show me chinatown on the map"
    const zoomLocationMatch = lower.match(/(?:zoom|fly|go)\s*(?:in|into|to|inside)\s*(?:the\s+)?([a-z\s]+?)(?:\s+(?:on|in)\s+(?:the\s+)?map)?$/i);
    if (zoomLocationMatch && zoomLocationMatch[1]) {
        const location = zoomLocationMatch[1].trim();
        // Don't match generic words
        if (location && location.length > 2 && !['map', 'maps', 'the'].includes(location)) {
            console.log('[VoiceCommand] Zoom to location:', location);
            return { type: 'map_control', action: 'fly_to', location };
        }
    }

    // "show me X on the map" - fly to location
    const showOnMapMatch = lower.match(/show\s+(?:me\s+)?(.+?)\s+(?:on|in)\s+(?:the\s+)?map/i);
    if (showOnMapMatch && showOnMapMatch[1]) {
        const location = showOnMapMatch[1].trim();
        if (location && location.length > 2) {
            console.log('[VoiceCommand] Show on map:', location);
            return { type: 'map_control', action: 'fly_to', location };
        }
    }

    // Simple zoom commands
    if (/^(?:can you )?zoom\s*in\s*$/i.test(lower) || lower === 'closer') {
        return { type: 'map_control', action: 'zoom_in' };
    }
    if (/^(?:can you )?zoom\s*out\s*$/i.test(lower) || lower === 'farther' || lower === 'further') {
        return { type: 'map_control', action: 'zoom_out' };
    }

    // Navigation commands - "go to map" (but not if it has a location)
    if ((lower === 'go to map' || lower === 'show map' || lower === 'view map' || lower === 'open map') &&
        !lower.includes('manhattan') && !lower.includes('brooklyn') && !lower.includes('queens')) {
        return { type: 'navigate', action: 'map' };
    }
    if (lower.includes('go to itinerary') || lower.includes('show itinerary') || lower.includes('my plan') || lower.includes('my trip')) {
        return { type: 'navigate', action: 'itinerary' };
    }
    if (lower.includes('go to discover') || lower.includes('show discover') || lower.includes('search panel') || lower.includes('discovery')) {
        return { type: 'navigate', action: 'discovery' };
    }

    // "Add X to itinerary" commands - extract the place name
    // Patterns: "add the Pine Bar", "add Pine Bar to my itinerary", "can you add Pine Bar"
    // Also: "select Pine Bar and add it" - extract "Pine Bar"

    // Pattern: "add/select X and add it" or "add X to itinerary"
    const selectAndAddMatch = lower.match(/(?:select|add)\s+(?:the\s+)?([A-Za-z\s']+?)(?:\s+and\s+add|\s+to\s+(?:my\s+)?(?:itinerary|trip|plan))/i);
    if (selectAndAddMatch && selectAndAddMatch[1]) {
        const placeName = selectAndAddMatch[1].trim();
        if (placeName.length > 2 && placeName !== 'it') {
            console.log('[VoiceCommand] Add to itinerary (select pattern):', placeName);
            return { type: 'add_to_itinerary', placeName, query: placeName };
        }
    }

    // Simple add pattern: "add Pine Bar", "add the Tip Tap Room"
    const simpleAddMatch = lower.match(/^(?:can you )?add\s+(?:the\s+)?([A-Za-z\s']+?)$/i);
    if (simpleAddMatch && simpleAddMatch[1]) {
        const placeName = simpleAddMatch[1].trim();
        if (placeName.length > 2 && !['it', 'this', 'that', 'them'].includes(placeName.toLowerCase())) {
            console.log('[VoiceCommand] Add to itinerary (simple):', placeName);
            return { type: 'add_to_itinerary', placeName, query: placeName };
        }
    }

    // Specific search queries with place names (check BEFORE generic cuisine keywords)
    // Pattern: "find me cozy bars", "show me the best bars" - extract full query
    const specificSearchPatterns = [
        /(?:find me|show me|search for|looking for|i want|get me) (?:the )?(?:best |good |great |top |some )?(.+)/i,
    ];

    for (const pattern of specificSearchPatterns) {
        const match = lower.match(pattern);
        if (match && match[1]) {
            const query = match[1].trim()
                .replace(/\s*in (?:boston|nyc|new york)\s*/gi, '')
                .replace(/\s*please\s*/gi, '')
                .replace(/\s*nearby\s*/gi, '')
                .trim();
            if (query.length > 2) {
                console.log('[VoiceCommand] Specific search query:', query);
                return { type: 'search_query', query };
            }
        }
    }

    // Generic cuisine keywords - only match if the word stands alone or is at the end
    // This prevents "Pine Bar" from matching just "bar"
    const cuisineKeywords = [
        { pattern: /\b(indian)\s*(food|restaurant|cuisine)?s?\b/i, query: 'indian food' },
        { pattern: /\b(mexican)\s*(food|restaurant|cuisine)?s?\b/i, query: 'mexican food' },
        { pattern: /\b(chinese)\s*(food|restaurant|cuisine)?s?\b/i, query: 'chinese food' },
        { pattern: /\b(japanese)\s*(food|restaurant|cuisine)?s?\b/i, query: 'japanese food' },
        { pattern: /\b(thai)\s*(food|restaurant|cuisine)?s?\b/i, query: 'thai food' },
        { pattern: /\b(vietnamese)\s*(food|restaurant|cuisine)?s?\b/i, query: 'vietnamese food' },
        { pattern: /\b(korean)\s*(food|restaurant|cuisine)?s?\b/i, query: 'korean food' },
        { pattern: /\b(italian)\s*(food|restaurant|cuisine)?s?\b/i, query: 'italian food' },
        { pattern: /\bpizza\b/i, query: 'pizza' },
        { pattern: /\bsushi\b/i, query: 'sushi' },
        { pattern: /\bramen\b/i, query: 'ramen' },
        { pattern: /\btacos?\b/i, query: 'tacos' },
        { pattern: /\bburgers?\b/i, query: 'burgers' },
        { pattern: /\bseafood\b/i, query: 'seafood' },
        { pattern: /\bsteak(?:house)?\b/i, query: 'steakhouse' },
        { pattern: /\b(vegetarian|vegan)\b/i, query: 'vegetarian food' },
        { pattern: /\bbrunch\b/i, query: 'brunch' },
        { pattern: /\bbreakfast\b/i, query: 'breakfast' },
        { pattern: /\bdessert\b/i, query: 'dessert' },
        { pattern: /\bice cream\b/i, query: 'ice cream' },
        { pattern: /\bcoffee\b/i, query: 'coffee' },
        { pattern: /\bcafe\b/i, query: 'cafe' },
        { pattern: /\bcocktails?\b/i, query: 'cocktails' },
        { pattern: /\bbrewer(y|ies)\b/i, query: 'brewery' },
        { pattern: /\bwine\s*bar\b/i, query: 'wine bar' },
        // "bars" or "bar" only when it's the main subject, not part of a name
        { pattern: /^(?:find|show|cozy|best|good|great|some)?\s*bars?\s*$/i, query: 'bar' },
        { pattern: /\bcozy\s+bars?\b/i, query: 'cozy bar' },
        { pattern: /\bbest\s+bars?\b/i, query: 'best bar' },
    ];

    // Check for cuisine patterns
    for (const { pattern, query } of cuisineKeywords) {
        if (pattern.test(lower)) {
            console.log('[VoiceCommand] Matched cuisine pattern:', query);
            return { type: 'search_query', query };
        }
    }

    // Layer toggle commands - activities/events
    if (lower.includes('activities') || lower.includes('activity') || lower.includes('show events') ||
        lower.includes('events') || lower.includes('concerts') || lower.includes('shows') || lower.includes('what\'s happening')) {
        return { type: 'toggle_layer', layer: 'events' };
    }

    // Places/restaurants (only if no cuisine keyword matched above)
    if (lower.includes('show places') || lower.includes('show restaurants') || lower === 'restaurants') {
        return { type: 'toggle_layer', layer: 'places' };
    }

    // Landmarks
    if (lower.includes('show landmarks') || lower.includes('landmarks') || lower.includes('show tourist') ||
        lower.includes('sightseeing') || lower.includes('attractions') || lower.includes('monuments')) {
        return { type: 'toggle_layer', layer: 'landmarks' };
    }

    // Hidden gems
    if (lower.includes('hidden spot') || lower.includes('hidden gem') || lower.includes('hidden') ||
        lower.includes('secret') || lower.includes('local favorite') || lower.includes('off the beaten')) {
        return { type: 'toggle_layer', layer: 'hidden' };
    }

    // Compound commands: "show me bars and add to itinerary", "find pizza and add the first one"
    if (lower.includes(' and ')) {
        const parts = lower.split(' and ');
        const subCommands: VoiceCommand[] = [];

        for (const part of parts) {
            const trimmed = part.trim();
            if (trimmed.length > 2) {
                // Parse each part as a separate command
                const subCommand = parseVoiceCommand(trimmed);
                if (subCommand.type !== 'gemini_question') {
                    subCommands.push(subCommand);
                }
            }
        }

        if (subCommands.length > 1) {
            console.log('[VoiceCommand] Compound command with', subCommands.length, 'parts');
            return { type: 'compound', subCommands };
        } else if (subCommands.length === 1) {
            return subCommands[0];
        }
    }

    // General pattern: "where can I get X" or "show me X" or "find X" or "I want X"
    const searchPatterns = [
        /(?:where can i (?:get|find)|show me|find|looking for|i want|i need|get me) (.+)/i,
        /(?:best|good|great|top) (.+)/i,
        /(.+) (?:near|in|around) (?:here|me|boston|nyc|new york)/i,
        /(?:search for|search) (.+)/i
    ];

    for (const pattern of searchPatterns) {
        const match = lower.match(pattern);
        if (match && match[1]) {
            const query = match[1].trim()
                .replace(/\s*in (?:boston|nyc|new york)\s*/gi, '')
                .replace(/\s*please\s*/gi, '')
                .replace(/\s*nearby\s*/gi, '')
                .trim();
            if (query.length > 2) {
                return { type: 'search_query', query };
            }
        }
    }

    // If it contains food-related words, treat as search
    if (lower.includes('food') || lower.includes('eat') || lower.includes('hungry') || lower.includes('restaurant')) {
        return { type: 'search_query', query: lower.replace(/show me|find me|i want|get me/gi, '').trim() };
    }

    // Default: treat as Gemini question
    return { type: 'gemini_question' };
}
