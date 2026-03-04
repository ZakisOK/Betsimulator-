import React, { useState } from 'react'
import { ChevronUp, ChevronDown, Edit3, Copy, Trash2, Eye, EyeOff } from 'lucide-react'
import type { Rule } from '../../types'
import { RuleEditor } from './RuleEditor'

function describeTrigger(t: Rule['trigger']): string {
  switch (t.type) {
    case 'streak':          return `After ${t.min_length ?? '?'} ${t.direction?.replace('_',' ') ?? ''} — ${t.side ?? 'Any'}`
    case 'pattern':         return `Pattern: ${t.pattern ?? '?'} in last ${t.lookback ?? '?'} hands`
    case 'financial_state': return `${t.condition?.replace(/_/g,' ') ?? '?'} ${t.threshold ?? ''}`
    case 'hand_count':      return `Hands ${t.hand_min ?? 0}${t.hand_max ? `–${t.hand_max}` : '+'}`
    case 'composite':       return `Composite (${t.operator ?? 'AND'})`
    default:                return t.type
  }
}

function describeAction(a: Rule['action']): string {
  switch (a.type) {
    case 'place_bet':         return `Bet ${a.side} × ${a.unit_size ?? 1}`
    case 'adjust_unit':       return `${a.method ?? 'adjust'} progression`
    case 'skip_hand':         return `Skip ${a.skip_count ?? 1} hand(s)`
    case 'reset_progression': return `Reset progression`
    case 'lock_side':         return `Lock ${a.side} × ${a.lock_duration ?? 1}`
    case 'stop_loss':         return `Stop loss $${a.threshold ?? 0}`
    case 'take_profit':       return `Take profit $${a.threshold ?? 0}`
    default:                  return a.type
  }
}

const TRIGGER_COLOR: Record<string, string> = {
  streak:          'rgba(99,102,241,0.7)',
  pattern:         'rgba(168,85,247,0.7)',
  financial_state: 'rgba(245,158,11,0.7)',
  hand_count:      'rgba(59,130,246,0.7)',
  composite:       'rgba(20,184,166,0.7)',
}

const ACTION_COLOR: Record<string, string> = {
  place_bet:         'rgba(34,197,94,0.85)',
  adjust_unit:       'rgba(96,165,250,0.85)',
  stop_loss:         'rgba(239,68,68,0.85)',
  take_profit:       'rgba(251,191,36,0.85)',
  skip_hand:         'rgba(148,163,184,0.7)',
  reset_progression: 'rgba(148,163,184,0.7)',
  lock_side:         'rgba(168,85,247,0.7)',
}

interface Props {
  rule: Rule; index: number; total: number
  onUpdate: (id: string, u: Partial<Rule>) => void
  onRemove: (id: string) => void
  onMove:   (id: string, d: 'up'|'down') => void
  onDuplicate: (id: string) => void
}

export const RuleCard: React.FC<Props> = ({ rule, index, total, onUpdate, onRemove, onMove, onDuplicate }) => {
  const [editing, setEditing] = useState(false)

  return (
    <>
      <div className={`rule-card group relative px-3 py-2.5 ${!rule.enabled ? 'opacity-40' : ''}`}>
        {/* Priority dot */}
        <div className="absolute -left-1.5 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full flex items-center justify-center"
          style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}>
          <span className="text-[7px] font-mono text-white/40">{index+1}</span>
        </div>

        <div className="ml-2">
          {/* Top row */}
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold text-white/85 truncate mr-2">{rule.label}</span>
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
              {[
                { icon: rule.enabled ? <Eye size={11}/> : <EyeOff size={11}/>, fn: () => onUpdate(rule.id,{ enabled:!rule.enabled }), col:'text-white/40 hover:text-white/80' },
                { icon: <ChevronUp size={11}/>,  fn: () => onMove(rule.id,'up'),     col: index===0      ? 'opacity-20 cursor-not-allowed' : 'text-white/40 hover:text-white/80' },
                { icon: <ChevronDown size={11}/>,fn: () => onMove(rule.id,'down'),   col: index===total-1? 'opacity-20 cursor-not-allowed' : 'text-white/40 hover:text-white/80' },
                { icon: <Edit3 size={11}/>,      fn: () => setEditing(true),          col:'text-white/40 hover:text-blue-400' },
                { icon: <Copy size={11}/>,       fn: () => onDuplicate(rule.id),     col:'text-white/40 hover:text-emerald-400' },
                { icon: <Trash2 size={11}/>,     fn: () => onRemove(rule.id),        col:'text-white/40 hover:text-red-400' },
              ].map(({ icon, fn, col }, i) => (
                <button key={i} onClick={fn} className={`p-1 rounded transition-colors ${col}`}>{icon}</button>
              ))}
            </div>
          </div>

          {/* Trigger / Action badges */}
          <div className="flex flex-col gap-1">
            <div className="flex items-start gap-1.5">
              <span className="text-[9px] font-mono font-bold px-1 py-0.5 rounded shrink-0"
                style={{ background: TRIGGER_COLOR[rule.trigger.type] ?? 'rgba(255,255,255,0.1)', color:'rgba(255,255,255,0.9)' }}>
                WHEN
              </span>
              <span className="text-[10px] text-white/60 leading-tight pt-0.5">{describeTrigger(rule.trigger)}</span>
            </div>
            <div className="flex items-start gap-1.5">
              <span className="text-[9px] font-mono font-bold px-1 py-0.5 rounded shrink-0"
                style={{ background: ACTION_COLOR[rule.action.type] ?? 'rgba(255,255,255,0.1)', color:'rgba(255,255,255,0.9)' }}>
                THEN
              </span>
              <span className="text-[10px] text-white/80 font-medium leading-tight pt-0.5">{describeAction(rule.action)}</span>
            </div>
          </div>

          {/* Modifier pills */}
          {(rule.modifiers.max_bet || rule.modifiers.bankroll_guard || rule.modifiers.shoe_reset === 'reset') && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {rule.modifiers.max_bet && (
                <span className="glass-tag">max ${rule.modifiers.max_bet}</span>
              )}
              {rule.modifiers.bankroll_guard && (
                <span className="glass-tag">guard {(rule.modifiers.bankroll_guard*100).toFixed(0)}%</span>
              )}
              {rule.modifiers.shoe_reset === 'reset' && (
                <span className="glass-tag">shoe↺</span>
              )}
            </div>
          )}
        </div>
      </div>

      {editing && <RuleEditor rule={rule} onSave={u => onUpdate(rule.id, u)} onClose={() => setEditing(false)}/>}
    </>
  )
}
