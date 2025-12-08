export const FRED_SERIES = {
    ECB_RATE: 'ECBDFR', // ECB Deposit Facility Rate
    FED_RATE: 'DFEDTARU', // Fed Funds Target Range - Upper Limit
    SWISS_GDP: 'CLVNASAC01CHQ189S', // Switzerland Real GDP
    SNB_RATE: 'INTDSRCHM193N', // SNB Policy Rate
};

/**
 * Fetch a single series observation from FRED
 */
export async function fetchFredSeries(seriesId, apiKey) {
    if (!apiKey) throw new Error("FRED_API_KEY is missing");

    try {
        const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${apiKey}&file_type=json&sort_order=desc&limit=1`;
        const response = await fetch(url, { next: { revalidate: 3600 } }); // Cache for 1 hour

        if (!response.ok) {
            throw new Error(`FRED API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();

        if (!data.observations || data.observations.length === 0) {
            throw new Error(`No FRED data for ${seriesId}`);
        }

        const value = parseFloat(data.observations[0].value);

        // Some series return "." for missing values
        if (isNaN(value)) {
            throw new Error(`Invalid FRED value for ${seriesId}: ${data.observations[0].value}`);
        }

        return {
            value,
            date: data.observations[0].date,
            source: `FRED (${seriesId})`
        };
    } catch (error) {
        console.warn(`FRED fetch failed for ${seriesId}:`, error.message);
        throw error;
    }
}

/**
 * Determine Central Bank Stance based on rate changes
 */
export async function determineCentralBankStance(seriesId, apiKey) {
    if (!apiKey) return "hold_neutral";

    try {
        // Get last 6-12 months of data to see trends
        const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${apiKey}&file_type=json&sort_order=desc&limit=12`;
        const response = await fetch(url, { next: { revalidate: 3600 } });

        if (!response.ok) return "hold_neutral";

        const data = await response.json();

        if (!data.observations || data.observations.length < 2) {
            return "hold_neutral";
        }

        const rates = data.observations
            .map(obs => parseFloat(obs.value))
            .filter(rate => !isNaN(rate));

        if (rates.length < 2) return "hold_neutral";

        const current = rates[0];
        const threeMonthsAgo = rates[Math.min(3, rates.length - 1)];
        const change = current - threeMonthsAgo;

        if (change > 0.50) return "hike_aggressive";
        if (change > 0.10) return "hike_moderate";
        if (change > 0.00) return "hold_hawkish_bias"; // Slight bias or hold
        if (change < -0.50) return "cut_aggressive";
        if (change < -0.10) return "cut_moderate";
        if (change < -0.00) return "hold_dovish_bias";

        return "hold_neutral";
    } catch (error) {
        console.error(`Stance determination error for ${seriesId}:`, error);
        return "hold_neutral";
    }
}
