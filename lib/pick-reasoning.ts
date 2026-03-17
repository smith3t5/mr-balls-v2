/**
 * lib/pick-reasoning.ts
 *
 * Uses the Anthropic API to generate a single, defensible sentence of
 * reasoning for each parlay leg. Claude reads the KenPom projection,
 * book line, and situational factors and writes clear English that
 * explains WHY this pick makes sense — not template strings.
 *
 * Called once per parlay generation, batching all legs in one API call.
 */

export interface LegContext {
  pick:              string;   // e.g. "McNeese +11.5"
  eventName:        string;   // e.g. "McNeese @ Vanderbilt Commodores"
  odds:             number;
  market:           string;   // 'spreads' | 'h2h' | 'totals'
  factors:          { type: string; description: string; impact: number }[];
  edgeScore:        number;
  confidenceScore:  number;
  trueProb?:        number;
  impliedProb?:     number;
}

export interface ReasonedLeg {
  headline:   string;  // One sharp sentence — the core thesis
  supporting: string;  // One supporting data point
  risk:       string;  // One honest risk flag
}

/**
 * Generate reasoning for a batch of parlay legs using Claude.
 * Returns one ReasonedLeg per input leg, in the same order.
 */
export async function reasonLegs(legs: LegContext[]): Promise<ReasonedLeg[]> {
  if (legs.length === 0) return [];

  const prompt = buildPrompt(legs);

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model:      'claude-sonnet-4-20250514',
        max_tokens: 1000,
        system: `You are a sharp NCAA Tournament betting analyst. Write clear, honest, data-backed reasoning for each pick.

CRITICAL RULES:
- Always write from the perspective of the pick being made. If taking an underdog, explain the underdog's value — never explain why the favorite is good.
- Never use the phrase "line movement or injury news could shift value before tip" — this is banned. It is too generic and useless.
- Never repeat the same risk across multiple legs. Every risk must be specific to THAT game and THAT matchup.
- The biggest hidden risk in tournament betting: KenPom efficiency data does NOT update for injuries. If a key player is out, the model's projected edge may be entirely illusory. Always consider whether this pick is reliant on a player who could be injured or limited.
- Other good specific risks: schedule/fatigue, first-round nerves for young teams, coaching matchup disadvantage, a specific opponent tendency (e.g. "Duke's AdjDE struggles vs athletic guards"), seeding pressure, or specific style-of-play mismatch that hurts the pick.
- Be specific: use team names, numbers, percentages, KenPom ranks where relevant.

Respond ONLY with valid JSON — no markdown, no explanation outside the JSON.`,
        messages: [{
          role:    'user',
          content: prompt,
        }],
      }),
    });

    if (!response.ok) {
      console.error('[pick-reasoning] API error:', response.status);
      return legs.map(fallbackReasoning);
    }

    const data = await response.json() as any;
    const text = data.content?.[0]?.text ?? '';

    // Parse the JSON response
    const parsed = JSON.parse(text.replace(/```json|```/g, '').trim()) as ReasonedLeg[];

    if (!Array.isArray(parsed) || parsed.length !== legs.length) {
      return legs.map(fallbackReasoning);
    }

    return parsed;

  } catch (err) {
    console.error('[pick-reasoning] Failed:', err);
    return legs.map(fallbackReasoning);
  }
}

function buildPrompt(legs: LegContext[]): string {
  const legDescriptions = legs.map((leg, i) => {
    const kenpomFactors = leg.factors.filter(f => f.description.toLowerCase().includes('kenpom'));
    const sitFactors    = leg.factors.filter(f => f.description.toLowerCase().includes('pace') ||
                          f.description.toLowerCase().includes('fatigue') ||
                          f.description.toLowerCase().includes('rivalry') ||
                          f.description.toLowerCase().includes('trap'));
    const allFactors    = leg.factors.filter(f => !f.description.includes('partial data'));

    return `Leg ${i + 1}:
  Pick: ${leg.pick}
  Game: ${leg.eventName}
  Odds: ${leg.odds > 0 ? '+' : ''}${leg.odds}
  Bet type: ${leg.market === 'h2h' ? 'moneyline' : leg.market === 'spreads' ? 'spread' : 'total'}
  Edge score: ${leg.edgeScore.toFixed(2)} (higher = stronger)
  Model win probability: ${leg.trueProb ? (leg.trueProb * 100).toFixed(1) + '%' : 'N/A'}
  Market win probability: ${leg.impliedProb ? (leg.impliedProb * 100).toFixed(1) + '%' : 'N/A'}
  Key data signals:
${allFactors.map(f => `    - [${f.type.toUpperCase()}] ${f.description}`).join('\n')}`;
  }).join('\n\n');

  return `Generate sharp, honest betting reasoning for these ${legs.length} parlay leg(s).

${legDescriptions}

For each leg, write exactly 3 fields:
1. "headline": One sentence (max 20 words) stating the core thesis for WHY this pick has value. Be specific. Reference the actual teams and data.
2. "supporting": One sentence of the strongest supporting data point.
3. "risk": One honest sentence about the biggest risk or caveat for this pick.

Rules:
- Never say "partial data" or reference data quality issues
- Never contradict the pick direction — if we're taking the underdog, explain underdog value only
- If KenPom model probability > market probability, that's the thesis — say it clearly
- If situational factors are the thesis (pace mismatch, proximity, fatigue), lead with that
- Be specific: use team names, numbers, percentages, KenPom efficiency ranks
- BANNED PHRASE: "line movement or injury news could shift value before tip" — never use this
- Each risk MUST be unique and specific to that exact matchup — no generic disclaimers
- At least one leg's risk should reference the injury caveat (KenPom doesn't update for injuries)
- Other good risks: first-round nerves, coaching disadvantage, style mismatch, opponent-specific tendency

Respond with a JSON array of ${legs.length} objects, each with "headline", "supporting", and "risk" fields.
Example format:
[{"headline": "...", "supporting": "...", "risk": "..."}, ...]`;
}

function fallbackReasoning(leg: LegContext): ReasonedLeg {
  // Fallback if Claude is unavailable — better than template strings
  const positiveFactors = leg.factors.filter(f => f.type === 'positive');
  const bestFactor      = positiveFactors.sort((a, b) => b.impact - a.impact)[0];

  return {
    headline:   bestFactor?.description ?? `Model scores this as a ${leg.edgeScore > 0 ? 'positive' : 'neutral'} edge play`,
    supporting: `Model probability ${leg.trueProb ? (leg.trueProb * 100).toFixed(0) + '%' : 'N/A'} vs market ${leg.impliedProb ? (leg.impliedProb * 100).toFixed(0) + '%' : 'N/A'}`,
    risk:       'Line movement or injury news could shift value before tip',
  };
}
