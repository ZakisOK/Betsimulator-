/**
 * Natural Language Rule Parser
 *
 * Converts plain-English rule descriptions into Rule objects.
 * Local regex engine handles common patterns; falls back to Claude API
 * for complex inputs.
 */

import axios from 'axios'
import type { Rule, Trigger, Action, Modifiers, BetSide, ProgressionMethod } from '../types'

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────

function id() {
  return Math.random().toString(36).slice(2, 10)
}

function parseSide(s: string): BetSide | 'Any' {
  const u = s.toLowerCase()
  if (u.includes('banker') || u === 'b') return 'Banker'
  if (u.includes('player') || u === 'p') return 'Player'
  if (u.includes('tie')   || u === 't') return 'Tie'
  return 'Any'
}

function parseProgression(s: string): ProgressionMethod {
  const u = s.toLowerCase()
  if (u.includes('martingale') || u.includes('double')) return 'martingale'
  if (u.includes('fibonacci') || u.includes('fib'))    return 'fibonacci'
  if (u.includes("d'alembert") || u.includes('dalembert') || u.includes('alembert')) return 'dalembert'
  if (u.includes('labouchere') || u.includes('labo'))  return 'labouchere'
  if (u.includes("oscar") || u.includes('grind'))      return 'oscars_grind'
  if (u.includes('1-3-2-6') || u.includes('1326'))     return '1326'
  if (u.includes('flat'))                              return 'flat'
  return 'flat'
}

function parseNumber(s: string): number | undefined {
  const m = s.match(/[\d.]+/)
  return m ? parseFloat(m[0]) : undefined
}

// ────────────────────────────────────────────────────────────
// Pattern registry
// ────────────────────────────────────────────────────────────

interface ParsedRule {
  label: string
  trigger: Trigger
  action: Action
  modifiers: Modifiers
}

type PatternFn = (text: string) => ParsedRule | null

const patterns: PatternFn[] = [

  // "stop loss at / when loss exceeds $N"
  (t) => {
    const m = t.match(/stop\s*(?:loss|when\s+(?:loss|down|losing)(?:\s+(?:exceeds?|more\s+than|over))?)[\s$]*([\d,]+)/i)
    if (!m) return null
    const amt = parseFloat(m[1].replace(/,/g, ''))
    return {
      label: `Stop Loss at $${amt}`,
      trigger: { type: 'financial_state', condition: 'session_loss', threshold: -amt },
      action:  { type: 'stop_loss', threshold: -amt },
      modifiers: { shoe_reset: 'carry' },
    }
  },

  // "take profit at / when up $N"
  (t) => {
    const m = t.match(/take\s*profit(?:\s+(?:at|when(?:\s+up)?))?[\s$]*([\d,]+)/i)
              ?? t.match(/(?:quit|stop)\s+when\s+(?:up|profit|winning)\s*(?:over|exceeds?|more\s+than)?\s*\$?([\d,]+)/i)
    if (!m) return null
    const amt = parseFloat(m[1].replace(/,/g, ''))
    return {
      label: `Take Profit at $${amt}`,
      trigger: { type: 'financial_state', condition: 'session_profit', threshold: amt },
      action:  { type: 'take_profit', threshold: amt },
      modifiers: { shoe_reset: 'carry' },
    }
  },

  // "skip N hands after tie / when ..."
  (t) => {
    const m = t.match(/skip\s+(\d+)\s+hands?\s+(?:after|when|on|if)\s+(.+)/i)
              ?? t.match(/(?:after|when|on)\s+(?:a\s+)?tie[,\s]+skip\s+(\d+)/i)
    if (!m) return null
    // First form: skip N hands after X
    if (m.length >= 3 && !isNaN(+m[1])) {
      const count = +m[1]
      const context = m[2]
      const isAfterTie = /tie/i.test(context)
      const trig: Trigger = isAfterTie
        ? { type: 'streak', side: 'Tie', direction: 'consecutive_wins', min_length: 1 }
        : { type: 'hand_count', hand_min: 1 }
      return {
        label: `Skip ${count} hand${count > 1 ? 's' : ''} after ${isAfterTie ? 'Tie' : context.trim()}`,
        trigger: trig,
        action:  { type: 'skip_hand', skip_count: count },
        modifiers: { shoe_reset: 'reset' },
      }
    }
    // Second form: after tie skip N
    const count = +m[1]
    return {
      label: `Skip ${count} hand${count > 1 ? 's' : ''} after Tie`,
      trigger: { type: 'streak', side: 'Tie', direction: 'consecutive_wins', min_length: 1 },
      action:  { type: 'skip_hand', skip_count: count },
      modifiers: { shoe_reset: 'reset' },
    }
  },

  // "bet / wager on SIDE when bankroll below/above $N"
  (t) => {
    const m = t.match(/(?:bet|wager|place|play)\s+(?:on\s+)?(\w+)\s+when\s+(?:bankroll|balance)\s+(below|above|under|over)\s*\$?([\d,]+)/i)
    if (!m) return null
    const side = parseSide(m[1])
    const isBelow = /below|under/i.test(m[2])
    const amt = parseFloat(m[3].replace(/,/g, ''))
    return {
      label: `Bet ${side} when bankroll ${isBelow ? 'below' : 'above'} $${amt}`,
      trigger: { type: 'financial_state', condition: isBelow ? 'bankroll_below' : 'bankroll_above', threshold: amt },
      action:  { type: 'place_bet', side: side === 'Any' ? 'Banker' : side as BetSide },
      modifiers: { shoe_reset: 'carry' },
    }
  },

  // "use PROGRESSION after / when N consecutive losses/wins"
  (t) => {
    const m = t.match(/use\s+(.+?)\s+(?:progression\s+)?(?:after|when|on)\s+(\d+)\s+consecutive\s+(loss(?:es)?|wins?)/i)
              ?? t.match(/(martingale|fibonacci|dalembert|d'alembert|labouchere|oscar'?s?\s*grind|1[- ]?3[- ]?2[- ]?6)\s+(?:after|when|on)\s+(\d+)?\s*(loss(?:es)?|wins?)/i)
    if (!m) return null
    const prog = parseProgression(m[1])
    const count = m[2] ? +m[2] : 1
    const isLoss = /loss/i.test(m[3] ?? m[2] ?? 'loss')
    return {
      label: `${prog.charAt(0).toUpperCase() + prog.slice(1)} after ${count} ${isLoss ? 'loss' : 'win'}${count > 1 ? 'es' : 's'}`,
      trigger: { type: 'streak', side: 'Any', direction: isLoss ? 'consecutive_losses' : 'consecutive_wins', min_length: count },
      action:  { type: 'adjust_unit', method: prog, value: 2 },
      modifiers: { shoe_reset: 'reset' },
    }
  },

  // "double / triple bet after N losses"
  (t) => {
    const mDouble = t.match(/(?:(double|triple|2x|3x|(\d+(?:\.\d+)?)x?)\s+(?:the\s+)?(?:bet|wager|stake))\s+(?:after|when|on)\s+(?:every\s+)?(\d+)\s*(loss(?:es)?|wins?)/i)
    if (!mDouble) return null
    const mult = mDouble[2] ? parseFloat(mDouble[2]) : mDouble[1]?.toLowerCase() === 'triple' ? 3 : 2
    const count = +mDouble[3]
    const isLoss = /loss/i.test(mDouble[4])
    return {
      label: `${mult}× bet after ${count} ${isLoss ? 'loss' : 'win'}${count > 1 ? 'es' : 's'}`,
      trigger: { type: 'streak', side: 'Any', direction: isLoss ? 'consecutive_losses' : 'consecutive_wins', min_length: count },
      action:  { type: 'adjust_unit', method: 'multiply', value: mult },
      modifiers: { shoe_reset: 'reset' },
    }
  },

  // "bet N units on SIDE after N consecutive SIDE wins/losses"
  (t) => {
    const m = t.match(/bet\s+(\d+(?:\.\d+)?)\s*(?:units?)?\s+on\s+(\w+)\s+(?:after|when|following)\s+(\d+)\s+consecutive\s+(\w+)\s+(wins?|loss(?:es)?)/i)
    if (!m) return null
    const units = parseFloat(m[1])
    const betSide = parseSide(m[2])
    const count = +m[3]
    const streakSide = parseSide(m[4])
    const isLoss = /loss/i.test(m[5])
    return {
      label: `Bet ${units}u on ${betSide} after ${count} ${streakSide} ${isLoss ? 'losses' : 'wins'}`,
      trigger: { type: 'streak', side: streakSide, direction: isLoss ? 'consecutive_losses' : 'consecutive_wins', min_length: count },
      action:  { type: 'place_bet', side: betSide === 'Any' ? 'Banker' : betSide as BetSide, unit_size: units },
      modifiers: { shoe_reset: 'reset' },
    }
  },

  // "bet on SIDE after N banker/player wins/losses" (simpler form)
  (t) => {
    const m = t.match(/(?:bet|wager|play)\s+(?:on\s+)?(\w+)\s+after\s+(\d+)\s+(?:consecutive\s+)?(\w+)\s+(wins?|loss(?:es)?)/i)
    if (!m) return null
    const betSide = parseSide(m[1])
    if (betSide === 'Any') return null // too ambiguous
    const count = +m[2]
    const streakSide = parseSide(m[3])
    const isLoss = /loss/i.test(m[4])
    return {
      label: `Bet ${betSide} after ${count} ${streakSide} ${isLoss ? 'losses' : 'wins'}`,
      trigger: { type: 'streak', side: streakSide, direction: isLoss ? 'consecutive_losses' : 'consecutive_wins', min_length: count },
      action:  { type: 'place_bet', side: betSide as BetSide, unit_size: 1 },
      modifiers: { shoe_reset: 'reset' },
    }
  },

  // "reset progression after a win / when winning"
  (t) => {
    const m = t.match(/reset\s+(?:the\s+)?(?:progression|bet|units?)\s+(?:after|when|on)\s+(?:a\s+)?(win|loss)/i)
    if (!m) return null
    const isWin = /win/i.test(m[1])
    return {
      label: `Reset progression after ${isWin ? 'win' : 'loss'}`,
      trigger: { type: 'streak', side: 'Any', direction: isWin ? 'consecutive_wins' : 'consecutive_losses', min_length: 1 },
      action:  { type: 'reset_progression', reset_to: 1 },
      modifiers: { shoe_reset: 'carry' },
    }
  },

  // "always bet on SIDE" / "flat bet on SIDE"
  (t) => {
    const m = t.match(/(?:always|flat(?:\s+bet)?|just|only)\s+(?:bet\s+)?(?:on\s+)?(\w+)/i)
    if (!m) return null
    const side = parseSide(m[1])
    if (side === 'Any') return null
    return {
      label: `Always bet ${side} (flat)`,
      trigger: { type: 'hand_count', hand_min: 1 },
      action:  { type: 'place_bet', side: side as BetSide, unit_size: 1 },
      modifiers: { shoe_reset: 'carry' },
    }
  },
]

// ────────────────────────────────────────────────────────────
// AI fallback
// ────────────────────────────────────────────────────────────

const AI_PARSE_PROMPT = `You are a Baccarat strategy rule parser. Convert the user's plain-English rule description into a JSON object matching this TypeScript schema exactly:

{
  label: string,           // short descriptive label
  trigger: {
    type: "streak" | "pattern" | "financial_state" | "hand_count" | "composite",
    // streak fields:
    side?: "Banker" | "Player" | "Tie" | "Any",
    direction?: "consecutive_wins" | "consecutive_losses" | "alternating",
    min_length?: number,
    // pattern fields:
    pattern?: string,      // e.g. "B-P-B-P"
    lookback?: number,
    // financial_state fields:
    condition?: "session_loss" | "session_profit" | "bankroll_below" | "bankroll_above",
    threshold?: number,
    // hand_count fields:
    hand_min?: number,
    hand_max?: number,
  },
  action: {
    type: "place_bet" | "adjust_unit" | "skip_hand" | "reset_progression" | "stop_loss" | "take_profit",
    side?: "Banker" | "Player" | "Tie",
    unit_size?: number,
    method?: "flat" | "martingale" | "fibonacci" | "dalembert" | "labouchere" | "oscars_grind" | "1326",
    value?: number,
    skip_count?: number,
    reset_to?: number,
    threshold?: number,
  },
  modifiers: {
    max_bet?: number,
    shoe_reset?: "carry" | "reset",
  }
}

Reply with ONLY valid JSON. No markdown, no explanation.`

async function parseWithAI(text: string): Promise<ParsedRule | null> {
  try {
    const resp = await axios.post('/api/agent', {
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      system: AI_PARSE_PROMPT,
      messages: [{ role: 'user', content: text }],
    }, { timeout: 10_000 })

    const raw = resp.data?.content?.[0]?.text ?? ''
    // Strip any accidental markdown fences
    const json = raw.replace(/```(?:json)?/g, '').replace(/```/g, '').trim()
    return JSON.parse(json) as ParsedRule
  } catch {
    return null
  }
}

// ────────────────────────────────────────────────────────────
// Main export
// ────────────────────────────────────────────────────────────

export interface NLParseResult {
  rule: Rule | null
  method: 'regex' | 'ai' | 'failed'
  confidence: 'high' | 'low' | 'none'
}

export async function parseNLRule(text: string): Promise<NLParseResult> {
  const trimmed = text.trim()
  if (!trimmed) return { rule: null, method: 'failed', confidence: 'none' }

  // 1. Try local patterns first
  for (const fn of patterns) {
    const parsed = fn(trimmed)
    if (parsed) {
      return {
        rule: {
          id: id(),
          priority: 0,
          enabled: true,
          ...parsed,
        },
        method: 'regex',
        confidence: 'high',
      }
    }
  }

  // 2. AI fallback
  const aiParsed = await parseWithAI(trimmed)
  if (aiParsed) {
    return {
      rule: {
        id: id(),
        priority: 0,
        enabled: true,
        ...aiParsed,
        modifiers: aiParsed.modifiers ?? { shoe_reset: 'reset' },
      },
      method: 'ai',
      confidence: 'low',
    }
  }

  return { rule: null, method: 'failed', confidence: 'none' }
}
