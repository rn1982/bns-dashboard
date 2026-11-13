import { NextResponse } from 'next/server';
import { readRow, readIndicator } from '../../lib/db';
import { STANCE_LABELS } from '../../lib/indicators';
import { toDateString, ageInDays } from '../../lib/freshness';

export const dynamic = 'force-dynamic';

// Stance (from app/lib/stance.js) → score. Keep in sync with STANCES in app/lib/indicators.js.
const STANCE_SCORE = {
  hike_aggressive: 2,
  hike_moderate: 1,
  hold_hawkish_bias: 1,
  hold_neutral: 0,
  hold_dovish_bias: -1,
  cut_moderate: -1,
  cut_aggressive: -2,
};

function bank(row, key, stanceCol, name) {
  const { value, meta } = readIndicator(row, key);
  const stance = row[stanceCol] || null;
  if (value === null) return { error: `No ${name} rate stored yet`, meta };
  if (!(stance in STANCE_SCORE)) {
    // Used to default to "hold_neutral" silently. A missing stance is missing data.
    return { error: `No ${name} stance stored yet`, rate: value, value, meta };
  }
  return {
    rate: value,
    value,
    stance: STANCE_LABELS[stance],
    rawStance: stance,
    score: STANCE_SCORE[stance],
    meta,
    nextPublication: 'After each policy meeting',
  };
}

export async function GET() {
  try {
    const row = await readRow();
    const date = toDateString(row.next_meeting_date);
    const age = ageInDays(date);
    return NextResponse.json({
      ecb: bank(row, 'ecb_rate', 'ecb_stance', 'ECB'),
      fed: bank(row, 'fed_rate', 'fed_stance', 'Fed'),
      // Manual only. Flagged when the date has passed (age > 0) so it gets updated.
      nextMeeting: {
        date,
        status: !date ? 'missing' : age > 0 ? 'stale' : 'manual',
        reason: !date ? 'Not set: add it in Manual Data Update' : age > 0 ? 'This date has passed' : '',
      },
    });
  } catch (error) {
    console.error('International rates API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
