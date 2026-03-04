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

function uid() {
  return Math.random().toString(36).slice(2, 10)
}

const WORD_NUMS: Record<string, number> = {
  one:1, two:2, three:3, four:4, five:5,
  six:6, seven:7, eight:8, nine:9, ten:10,
  eleven:11, twelve:12, a:1, an:1,
}

/** Parse a number that may be digits or a word ("3" or "three"). */
function parseNum(s: string): number | undefined {
  const trimmed = s.trim().toLowerCase()
  if (WORD_NUMS[trimmed] !== undefined) return WORD_NUMS[trimmed]
  const n = parseFloat(trimmed)
  return isNaN(n) ? undefined : n
}

/**
 * Match a number token in text — digits or English word.
 * Returns a regex source string.
 */
const NUM_RE = '(\\d+(?:\\.\\d+)?|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|a(?:n)?)'

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
  if (u.includes('oscar') || u.includes('grind'))      return 'oscars_grind'
  if (u.includes('1-3-2-6') || u.includes('1326'))     return '1326'
  return 'flat'
}

function makeRule(partial: { label: string; trigger: Trigger; action: Action; modifiers?: Modifiers }): Rule {
  return {
    id: uid(),
    priority: 0,
    enabled: true,
    modifiers: { shoe_reset: 'reset' },
    ...partial,
  }
}

// ────────────────────────────────────────────────────────────
// Pattern registry — each returns 0, 1 or multiple Rules
// ────────────────────────────────────────────────────────────

type PatternFn = (text: string) => Rule[] | null

const patterns: PatternFn[] = [

  // ── Stop loss ──────────────────────────────────────────────
  (t) => {
    const m = t.match(new RegExp(
      `stop\\s*(?:loss|when\\s+(?:loss|down|losing)(?:\\s+(?:exceeds?|more\\s+than|over))?)[\\s$]*${NUM_RE}`, 'i'))
    if (!m) return null
    const amt = parseNum(m[1])!
    return [makeRule({
      label: `Stop Loss at $${amt}`,
      trigger: { type: 'financial_state', condition: 'session_loss', threshold: -amt },
      action:  { type: 'stop_loss', threshold: -amt },
      modifiers: { shoe_reset: 'carry' },
    })]
  },

  // ── Take profit ────────────────────────────────────────────
  (t) => {
    const m = t.match(new RegExp(`take\\s*profit(?:\\s+(?:at|when(?:\\s+up)?))? [\\s$]*${NUM_RE}`, 'i'))
              ?? t.match(new RegExp(`(?:quit|stop)\\s+when\\s+(?:up|profit|winning)\\s*(?:over|exceeds?|more\\s+than)?\\s*\\$?${NUM_RE}`, 'i'))
    if (!m) return null
    const amt = parseNum(m[1])!
    return [makeRule({
      label: `Take Profit at $${amt}`,
      trigger: { type: 'financial_state', condition: 'session_profit', threshold: amt },
      action:  { type: 'take_profit', threshold: amt },
      modifiers: { shoe_reset: 'carry' },
    })]
  },

  // ── Compound: increase/raise bet N units after N SIDE wins, then reset ──
  // "after 3 bankers increase bet 3 units then back to base"
  // "after 3 banker wins raise the bet 2 units then reset after a win"
  (t) => {
    const m = t.match(new RegExp(
      `after\\s+${NUM_RE}\\s+(bankers?|players?|ties?|\\w+)\\s+(?:consecutive\\s+)?(?:wins?|in\\s+a\\s+row)?\\s*[,]?\\s*` +
      `(?:increase|raise|add|bump|boost)\\s+(?:the\\s+)?(?:bet|wager|stake|unit)s?\\s+(?:by\\s+)?${NUM_RE}\\s*(?:units?)?` +
      `(?:[,\\s]+then\\s+(?:back\\s+to\\s+(?:base|flat|normal|start)|reset).*)?`, 'i'))
    if (!m) return null

    const streakCount = parseNum(m[1])
    const side = parseSide(m[2])
    const addUnits = parseNum(m[3])
    if (!streakCount || !addUnits) return null

    const streakSide = side === 'Any' ? 'Banker' : side as BetSide
    const hasResetClause = /then\s+(?:back|reset)/i.test(t)

    const rules: Rule[] = [
      makeRule({
        label: `Bet +${addUnits}u on ${streakSide} after ${streakCount} wins`,
        trigger: { type: 'streak', side: streakSide, direction: 'consecutive_wins', min_length: streakCount },
        action:  { type: 'place_bet', side: streakSide, unit_size: addUnits },
      }),
    ]

    if (hasResetClause) {
      // Determine reset condition — look for "after a win/loss" in the tail
      const tail = t.slice(t.toLowerCase().indexOf('then'))
      const resetOnLoss = /loss|losing|lose/i.test(tail)
      rules.push(makeRule({
        label: `Reset to base after ${resetOnLoss ? 'loss' : 'win'}`,
        trigger: {
          type: 'streak',
          side: streakSide,
          direction: resetOnLoss ? 'consecutive_losses' : 'consecutive_wins',
          min_length: 1,
        },
        action: { type: 'reset_progression', reset_to: 1 },
        modifiers: { shoe_reset: 'carry' },
      }))
    }

    return rules
  },

  // ── Increase/raise bet after N losses/wins (without side, simpler) ──
  // "increase bet 2 units after 3 losses then reset"
  (t) => {
    const m = t.match(new RegExp(
      `(?:increase|raise|add|bump)\\s+(?:the\\s+)?(?:bet|wager|stake|unit)s?\\s+(?:by\\s+)?${NUM_RE}\\s*(?:units?)?\\s*` +
      `(?:after|when|on)\\s+${NUM_RE}\\s+(?:consecutive\\s+)?(loss(?:es)?|wins?)`, 'i'))
    if (!m) return null

    const addUnits = parseNum(m[1])
    const count    = parseNum(m[2])
    const isLoss   = /loss/i.test(m[3])
    if (!addUnits || !count) return null

    const hasReset = /then\s+(?:back|reset)/i.test(t)
    const rules: Rule[] = [
      makeRule({
        label: `Add ${addUnits}u after ${count} ${isLoss ? 'loss' : 'win'}${count > 1 ? 'es' : 's'}`,
        trigger: { type: 'streak', side: 'Any', direction: isLoss ? 'consecutive_losses' : 'consecutive_wins', min_length: count },
        action:  { type: 'adjust_unit', method: 'add', value: addUnits },
      }),
    ]
    if (hasReset) {
      rules.push(makeRule({
        label: `Reset to base after ${isLoss ? 'win' : 'loss'}`,
        trigger: { type: 'streak', side: 'Any', direction: isLoss ? 'consecutive_wins' : 'consecutive_losses', min_length: 1 },
        action:  { type: 'reset_progression', reset_to: 1 },
        modifiers: { shoe_reset: 'carry' },
      }))
    }
    return rules
  },

  // ── Skip N hands after tie / when ... ─────────────────────
  (t) => {
    const m = t.match(new RegExp(`skip\\s+${NUM_RE}\\s+hands?\\s+(?:after|when|on|if)\\s+(.+)`, 'i'))
              ?? t.match(new RegExp(`(?:after|when|on)\\s+(?:a\\s+)?tie[,\\s]+skip\\s+${NUM_RE}`, 'i'))
    if (!m) return null
    if (m.length >= 3 && parseNum(m[1]) !== undefined) {
      const count = parseNum(m[1])!
      const context = m[2]
      const isAfterTie = /tie/i.test(context)
      return [makeRule({
        label: `Skip ${count} hand${count > 1 ? 's' : ''} after ${isAfterTie ? 'Tie' : context.trim()}`,
        trigger: isAfterTie
          ? { type: 'streak', side: 'Tie', direction: 'consecutive_wins', min_length: 1 }
          : { type: 'hand_count', hand_min: 1 },
        action: { type: 'skip_hand', skip_count: count },
      })]
    }
    const count = parseNum(m[1])!
    return [makeRule({
      label: `Skip ${count} hand${count > 1 ? 's' : ''} after Tie`,
      trigger: { type: 'streak', side: 'Tie', direction: 'consecutive_wins', min_length: 1 },
      action: { type: 'skip_hand', skip_count: count },
    })]
  },

  // ── Bet on SIDE when bankroll below/above $N ───────────────
  (t) => {
    const m = t.match(new RegExp(
      `(?:bet|wager|place|play)\\s+(?:on\\s+)?(\\w+)\\s+when\\s+(?:bankroll|balance)\\s+(below|above|under|over)\\s*\\$?${NUM_RE}`, 'i'))
    if (!m) return null
    const side = parseSide(m[1])
    const isBelow = /below|under/i.test(m[2])
    const amt = parseNum(m[3])!
    return [makeRule({
      label: `Bet ${side} when bankroll ${isBelow ? 'below' : 'above'} $${amt}`,
      trigger: { type: 'financial_state', condition: isBelow ? 'bankroll_below' : 'bankroll_above', threshold: amt },
      action:  { type: 'place_bet', side: side === 'Any' ? 'Banker' : side as BetSide },
    })]
  },

  // ── Use PROGRESSION after N consecutive losses/wins ────────
  (t) => {
    const m = t.match(new RegExp(
      `use\\s+(.+?)\\s+(?:progression\\s+)?(?:after|when|on)\\s+${NUM_RE}\\s+consecutive\\s+(loss(?:es)?|wins?)`, 'i'))
              ?? t.match(new RegExp(
      `(martingale|fibonacci|dalembert|d'alembert|labouchere|oscar'?s?\\s*grind|1[- ]?3[- ]?2[- ]?6)` +
      `\\s+(?:after|when|on)\\s+${NUM_RE}?\\s*(loss(?:es)?|wins?)`, 'i'))
    if (!m) return null
    const prog = parseProgression(m[1])
    const count = parseNum(m[2]) ?? 1
    const isLoss = /loss/i.test(m[3] ?? m[2] ?? 'loss')
    return [makeRule({
      label: `${prog} after ${count} ${isLoss ? 'loss' : 'win'}${count > 1 ? 'es' : 's'}`,
      trigger: { type: 'streak', side: 'Any', direction: isLoss ? 'consecutive_losses' : 'consecutive_wins', min_length: count },
      action:  { type: 'adjust_unit', method: prog, value: 2 },
    })]
  },

  // ── Double / triple / Nx bet after N losses/wins ───────────
  (t) => {
    const m = t.match(/(?:(double|triple|2x|3x|(\d+(?:\.\d+)?)x?)\s+(?:the\s+)?(?:bet|wager|stake))\s+(?:after|when|on)\s+(?:every\s+)?(\d+)\s*(loss(?:es)?|wins?)/i)
    if (!m) return null
    const mult = m[2] ? parseFloat(m[2]) : m[1]?.toLowerCase() === 'triple' ? 3 : 2
    const count = parseNum(m[3])!
    const isLoss = /loss/i.test(m[4])
    return [makeRule({
      label: `${mult}× bet after ${count} ${isLoss ? 'loss' : 'win'}${count > 1 ? 'es' : 's'}`,
      trigger: { type: 'streak', side: 'Any', direction: isLoss ? 'consecutive_losses' : 'consecutive_wins', min_length: count },
      action:  { type: 'adjust_unit', method: 'multiply', value: mult },
    })]
  },

  // ── Bet N units on SIDE after N consecutive SIDE wins/losses ─
  (t) => {
    const m = t.match(new RegExp(
      `bet\\s+${NUM_RE}\\s*(?:units?)?\\s+on\\s+(\\w+)\\s+(?:after|when|following)\\s+${NUM_RE}\\s+(?:consecutive\\s+)?(\\w+)\\s+(wins?|loss(?:es)?)`, 'i'))
    if (!m) return null
    const units = parseNum(m[1])
    const betSide = parseSide(m[2])
    const count = parseNum(m[3])
    const streakSide = parseSide(m[4])
    const isLoss = /loss/i.test(m[5])
    if (!units || !count) return null
    return [makeRule({
      label: `Bet ${units}u on ${betSide} after ${count} ${streakSide} ${isLoss ? 'losses' : 'wins'}`,
      trigger: { type: 'streak', side: streakSide, direction: isLoss ? 'consecutive_losses' : 'consecutive_wins', min_length: count },
      action:  { type: 'place_bet', side: betSide === 'Any' ? 'Banker' : betSide as BetSide, unit_size: units },
    })]
  },

  // ── Bet on SIDE after N SIDE wins/losses (simpler) ─────────
  (t) => {
    const m = t.match(new RegExp(
      `(?:bet|wager|play)\\s+(?:on\\s+)?(\\w+)\\s+after\\s+${NUM_RE}\\s+(?:consecutive\\s+)?(\\w+)\\s+(wins?|loss(?:es)?)`, 'i'))
    if (!m) return null
    const betSide = parseSide(m[1])
    if (betSide === 'Any') return null
    const count = parseNum(m[2])
    const streakSide = parseSide(m[3])
    const isLoss = /loss/i.test(m[4])
    if (!count) return null
    return [makeRule({
      label: `Bet ${betSide} after ${count} ${streakSide} ${isLoss ? 'losses' : 'wins'}`,
      trigger: { type: 'streak', side: streakSide, direction: isLoss ? 'consecutive_losses' : 'consecutive_wins', min_length: count },
      action:  { type: 'place_bet', side: betSide as BetSide, unit_size: 1 },
    })]
  },

  // ── Reset progression after a win/loss ─────────────────────
  (t) => {
    const m = t.match(/reset\s+(?:the\s+)?(?:progression|bet|units?)\s+(?:after|when|on)\s+(?:a\s+)?(win|loss)/i)
    if (!m) return null
    const isWin = /win/i.test(m[1])
    return [makeRule({
      label: `Reset progression after ${isWin ? 'win' : 'loss'}`,
      trigger: { type: 'streak', side: 'Any', direction: isWin ? 'consecutive_wins' : 'consecutive_losses', min_length: 1 },
      action:  { type: 'reset_progression', reset_to: 1 },
      modifiers: { shoe_reset: 'carry' },
    })]
  },

  // ── Always / flat bet on SIDE ───────────────────────────────
  (t) => {
    const m = t.match(/(?:always|flat(?:\s+bet)?|just|only)\s+(?:bet\s+)?(?:on\s+)?(\w+)/i)
    if (!m) return null
    const side = parseSide(m[1])
    if (side === 'Any') return null
    return [makeRule({
      label: `Always bet ${side} (flat)`,
      trigger: { type: 'hand_count', hand_min: 1 },
      action:  { type: 'place_bet', side: side as BetSide, unit_size: 1 },
      modifiers: { shoe_reset: 'carry' },
    })]
  },
]

// ────────────────────────────────────────────────────────────
// AI fallback
// ────────────────────────────────────────────────────────────

const AI_PARSE_PROMPT = `You are a Baccarat strategy rule parser. Convert the user's plain-English description into a JSON array of rule objects. Return ONE rule object normally, but return TWO if the description contains a compound instruction like "then back to base" or "then reset".

Each rule object must match this schema exactly:
{
  "label": string,
  "trigger": {
    "type": "streak" | "pattern" | "financial_state" | "hand_count",
    "side"?: "Banker" | "Player" | "Tie" | "Any",
    "direction"?: "consecutive_wins" | "consecutive_losses" | "alternating",
    "min_length"?: number,
    "pattern"?: string,
    "lookback"?: number,
    "condition"?: "session_loss" | "session_profit" | "bankroll_below" | "bankroll_above",
    "threshold"?: number,
    "hand_min"?: number,
    "hand_max"?: number
  },
  "action": {
    "type": "place_bet" | "adjust_unit" | "skip_hand" | "reset_progression" | "stop_loss" | "take_profit",
    "side"?: "Banker" | "Player" | "Tie",
    "unit_size"?: number,
    "method"?: "flat" | "martingale" | "fibonacci" | "dalembert" | "labouchere" | "oscars_grind" | "1326" | "add" | "multiply",
    "value"?: number,
    "skip_count"?: number,
    "reset_to"?: number,
    "threshold"?: number
  },
  "modifiers": {
    "max_bet"?: number,
    "shoe_reset"?: "carry" | "reset"
  }
}

Reply with ONLY a valid JSON array, e.g. [{...}] or [{...},{...}]. No markdown, no explanation.`

async function parseWithAI(text: string): Promise<Rule[] | null> {
  try {
    const resp = await axios.post('/api/agent', {
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: AI_PARSE_PROMPT,
      messages: [{ role: 'user', content: text }],
    }, { timeout: 12_000 })

    const raw = resp.data?.content?.[0]?.text ?? ''
    const json = raw.replace(/```(?:json)?/g, '').replace(/```/g, '').trim()
    const arr: Rule[] = (JSON.parse(json) as any[]).map(r => ({
      id: uid(),
      priority: 0,
      enabled: true,
      modifiers: { shoe_reset: 'reset' },
      ...r,
    }))
    return arr.length ? arr : null
  } catch {
    return null
  }
}

// ────────────────────────────────────────────────────────────
// Main export
// ────────────────────────────────────────────────────────────

export interface NLParseResult {
  rules: Rule[]
  method: 'regex' | 'ai' | 'failed'
  confidence: 'high' | 'low' | 'none'
}

export async function parseNLRule(text: string): Promise<NLParseResult> {
  const trimmed = text.trim()
  if (!trimmed) return { rules: [], method: 'failed', confidence: 'none' }

  // 1. Local patterns
  for (const fn of patterns) {
    const result = fn(trimmed)
    if (result && result.length > 0) {
      return { rules: result, method: 'regex', confidence: 'high' }
    }
  }

  // 2. AI fallback
  const aiRules = await parseWithAI(trimmed)
  if (aiRules) {
    return { rules: aiRules, method: 'ai', confidence: 'low' }
  }

  return { rules: [], method: 'failed', confidence: 'none' }
}
