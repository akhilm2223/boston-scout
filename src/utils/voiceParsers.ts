// Parse natural language dates into Date objects
export function parseNaturalDate(input: string): Date | null {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const lowerInput = input.toLowerCase().trim();
    console.log('[DateParser] Parsing input:', input, 'lowercase:', lowerInput);

    // Handle "today"
    if (lowerInput.includes('today')) {
        console.log('[DateParser] Matched: today');
        return today;
    }

    // Handle "tomorrow"
    if (lowerInput.includes('tomorrow')) {
        console.log('[DateParser] Matched: tomorrow');
        return tomorrow;
    }

    // Handle "next [day]"
    const nextDayMatch = lowerInput.match(/next (monday|tuesday|wednesday|thursday|friday|saturday|sunday)/);
    if (nextDayMatch) {
        const targetDay = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
            .indexOf(nextDayMatch[1]);
        const result = new Date(today);
        const currentDay = today.getDay();
        const daysUntilTarget = (targetDay - currentDay + 7) % 7 || 7;
        result.setDate(result.getDate() + daysUntilTarget);
        console.log('[DateParser] Matched: next', nextDayMatch[1]);
        return result;
    }

    // Handle month names with day - IMPROVED to handle short names and ordinals
    const monthNames = ['january', 'february', 'march', 'april', 'may', 'june',
        'july', 'august', 'september', 'october', 'november', 'december'];
    const monthShort = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

    // Try full month names first
    for (let i = 0; i < monthNames.length; i++) {
        if (lowerInput.includes(monthNames[i])) {
            // Extract day number - handle ordinals like  "20th", "1st", "2nd"
            const dayMatch = lowerInput.match(/(\d+)(?:st|nd|rd|th)?/);
            if (dayMatch) {
                const day = parseInt(dayMatch[1]);
                const year = today.getFullYear();
                const result = new Date(year, i, day);

                // If the date has passed this year, use next year
                if (result < today) {
                    result.setFullYear(year + 1);
                }

                console.log('[DateParser] Matched full month:', monthNames[i], 'day:', day, 'result:', formatDate(result));
                return result;
            }
        }
    }

    // Try short month names (Jan, Feb, etc.)
    for (let i = 0; i < monthShort.length; i++) {
        if (lowerInput.includes(monthShort[i])) {
            // Extract day number - handle ordinals
            const dayMatch = lowerInput.match(/(\d+)(?:st|nd|rd|th)?/);
            if (dayMatch) {
                const day = parseInt(dayMatch[1]);
                const year = today.getFullYear();
                const result = new Date(year, i, day);

                // If the date has passed this year, use next year
                if (result < today) {
                    result.setFullYear(year + 1);
                }

                console.log('[DateParser] Matched short month:', monthShort[i], 'day:', day, 'result:', formatDate(result));
                return result;
            }
        }
    }

    // Spelled-out number words for days
    const numberWords: { [key: string]: number } = {
        'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
        'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10,
        'eleven': 11, 'twelve': 12, 'thirteen': 13, 'fourteen': 14,
        'fifteen': 15, 'sixteen': 16, 'seventeen': 17, 'eighteen': 18,
        'nineteen': 19, 'twenty': 20, 'thirty': 30
    };

    // Handle relative days with digits: "in 3 days", "3 days from now"
    const inDaysMatch = lowerInput.match(/(?:in\s+)?(\d+)\s+days?(?:\s+from\s+now)?/);
    if (inDaysMatch) {
        const days = parseInt(inDaysMatch[1]);
        const result = new Date(today);
        result.setDate(result.getDate() + days);
        console.log('[DateParser] Matched: in', days, 'days');
        return result;
    }

    // Handle relative days with spelled-out numbers: "in six days", "in three days"
    const spelledDaysMatch = lowerInput.match(/(?:in\s+)?(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty)\s+days?/);
    if (spelledDaysMatch) {
        const days = numberWords[spelledDaysMatch[1]];
        if (days) {
            const result = new Date(today);
            result.setDate(result.getDate() + days);
            console.log('[DateParser] Matched: in', spelledDaysMatch[1], '(' + days + ') days');
            return result;
        }
    }

    // Handle "this weekend" (Saturday)
    if (lowerInput.includes('weekend') || lowerInput.includes('saturday')) {
        const result = new Date(today);
        const daysUntilSaturday = (6 - today.getDay() + 7) % 7 || 7;
        result.setDate(result.getDate() + daysUntilSaturday);
        console.log('[DateParser] Matched: weekend/Saturday');
        return result;
    }

    // Try standard date parsing as fallback
    const standardDate = new Date(input);
    if (!isNaN(standardDate.getTime())) {
        console.log('[DateParser] Matched via standard Date parsing');
        return standardDate;
    }

    console.log('[DateParser] NO MATCH FOUND - returning null');
    return null;
}

// Format date for display
export function formatDate(date: Date): string {
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const year = date.getFullYear();
    return `${month}/${day}/${year}`;
}

// Parse spoken numbers and convert to numeric values
export function parseSpokenNumber(input: string): number | null {
    const lowerInput = input.toLowerCase().trim();

    // Handle written numbers
    const numberWords: { [key: string]: number } = {
        'zero': 0, 'one': 1, 'two': 2, 'three': 3, 'four': 4,
        'five': 5, 'six': 6, 'seven': 7, 'eight': 8, 'nine': 9,
        'ten': 10, 'eleven': 11, 'twelve': 12, 'thirteen': 13,
        'fourteen': 14, 'fifteen': 15, 'sixteen': 16, 'seventeen': 17,
        'eighteen': 18, 'nineteen': 19, 'twenty': 20, 'thirty': 30,
        'forty': 40, 'fifty': 50, 'sixty': 60, 'seventy': 70,
        'eighty': 80, 'ninety': 90, 'hundred': 100
    };

    // Check for exact word matches
    if (numberWords[lowerInput]) {
        return numberWords[lowerInput];
    }

    // Handle fractions: "half", "quarter"
    if (lowerInput.includes('half')) {
        return 0.5;
    }
    if (lowerInput.includes('quarter')) {
        return 0.25;
    }

    // Extract numeric values
    const numMatch = lowerInput.match(/(\d+(?:\.\d+)?)/);
    if (numMatch) {
        return parseFloat(numMatch[1]);
    }

    // Handle compound numbers like "twenty three"
    const words = lowerInput.split(/\s+/);
    let total = 0;
    for (const word of words) {
        if (numberWords[word]) {
            total += numberWords[word];
        }
    }

    return total > 0 ? total : null;
}
