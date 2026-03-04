import React, { useState } from 'react'
import type { Rule, Trigger, Action, Modifiers, BetSide, ProgressionMethod } from '../../types'

interface Props { rule: Rule; onSave: (u: Partial<Rule>) => void; onClose: () => void }

const Inp: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = (p) => (
  <input {...p} className={`input-glass w-full px-2.5 py-1.5 text-xs ${p.className??''}`}/>
)
const Sel: React.FC<React.SelectHTMLAttributes<HTMLSelectElement>> = ({ children, ...p }) => (
  <select {...p} className={`input-glass w-full px-2.5 py-1.5 text-xs ${p.className??''}`}>{children}</select>
)
const F: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="mb-3">
    <div className="section-label mb-1.5">{label}</div>
    {children}
  </div>
)

const SECTION = (color: string, label: string) => (
  <div className="text-[10px] font-mono font-bold mb-3 pb-1.5"
    style={{ borderBottom: `1px solid ${color}30`, color }}>{label}</div>
)

export const RuleEditor: React.FC<Props> = ({ rule, onSave, onClose }) => {
  const [label,     setLabel]     = useState(rule.label)
  const [trigger,   setTrigger]   = useState<Trigger>({ ...rule.trigger })
  const [action,    setAction]    = useState<Action>({ ...rule.action })
  const [modifiers, setModifiers] = useState<Modifiers>({ ...rule.modifiers })

  const uT = (u: Partial<Trigger>) => setTrigger(t => ({ ...t, ...u }))
  const uA = (u: Partial<Action>)  => setAction(a  => ({ ...a, ...u }))
  const uM = (u: Partial<Modifiers>) => setModifiers(m => ({ ...m, ...u }))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter:'blur(8px)' }}>
      <div className="glass-elevated w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom:'1px solid rgba(255,255,255,0.08)' }}>
          <h3 className="font-bold text-white/90">Edit Rule</h3>
          <button onClick={onClose} className="text-white/40 hover:text-white/90 text-xl leading-none transition-colors">×</button>
        </div>

        <div className="p-5 space-y-4">
          <F label="Rule Label">
            <Inp value={label} onChange={e => setLabel(e.target.value)} placeholder="Descriptive name…"/>
          </F>

          {/* Trigger */}
          <div className="p-3 rounded-xl" style={{ background:'rgba(99,102,241,0.08)', border:'1px solid rgba(99,102,241,0.15)' }}>
            {SECTION('rgba(99,102,241,0.9)', 'WHEN — Trigger')}
            <F label="Trigger Type">
              <Sel value={trigger.type} onChange={e => uT({ type: e.target.value as Trigger['type'] })}>
                <option value="streak">Streak Detection</option>
                <option value="pattern">Pattern Match</option>
                <option value="financial_state">Financial State</option>
                <option value="hand_count">Hand Count</option>
                <option value="composite">Composite (AND/OR)</option>
              </Sel>
            </F>
            {trigger.type === 'streak' && <>
              <F label="Side"><Sel value={trigger.side??'Banker'} onChange={e => uT({ side: e.target.value as BetSide })}>
                <option value="Banker">Banker</option><option value="Player">Player</option>
                <option value="Tie">Tie</option><option value="Any">Any</option>
              </Sel></F>
              <F label="Direction"><Sel value={trigger.direction??'consecutive_wins'} onChange={e => uT({ direction: e.target.value as Trigger['direction'] })}>
                <option value="consecutive_wins">Consecutive Wins</option>
                <option value="consecutive_losses">Consecutive Losses</option>
                <option value="alternating">Alternating</option>
              </Sel></F>
              <F label="Min Length"><Inp type="number" min={1} max={20} value={trigger.min_length??2} onChange={e => uT({ min_length: +e.target.value })}/></F>
            </>}
            {trigger.type === 'pattern' && <>
              <F label="Pattern (e.g. B-P-B-P)"><Inp value={trigger.pattern??''} onChange={e => uT({ pattern: e.target.value })} placeholder="B-P-B-P"/></F>
              <F label="Lookback Window"><Inp type="number" min={2} max={50} value={trigger.lookback??8} onChange={e => uT({ lookback: +e.target.value })}/></F>
            </>}
            {trigger.type === 'financial_state' && <>
              <F label="Condition"><Sel value={trigger.condition??'session_loss'} onChange={e => uT({ condition: e.target.value as Trigger['condition'] })}>
                <option value="session_loss">Session Loss ≤</option>
                <option value="session_profit">Session Profit ≥</option>
                <option value="bankroll_below">Bankroll Below</option>
                <option value="bankroll_above">Bankroll Above</option>
              </Sel></F>
              <F label="Threshold ($)"><Inp type="number" value={trigger.threshold??-500} onChange={e => uT({ threshold: +e.target.value })}/></F>
            </>}
            {trigger.type === 'hand_count' && <>
              <div className="grid grid-cols-2 gap-2">
                <F label="Hand Min"><Inp type="number" min={0} value={trigger.hand_min??1} onChange={e => uT({ hand_min: +e.target.value })}/></F>
                <F label="Hand Max"><Inp type="number" min={0} value={trigger.hand_max??''} placeholder="∞" onChange={e => uT({ hand_max: e.target.value ? +e.target.value : undefined })}/></F>
              </div>
            </>}
          </div>

          {/* Action */}
          <div className="p-3 rounded-xl" style={{ background:'rgba(34,197,94,0.06)', border:'1px solid rgba(34,197,94,0.15)' }}>
            {SECTION('rgba(34,197,94,0.9)', 'THEN — Action')}
            <F label="Action Type">
              <Sel value={action.type} onChange={e => uA({ type: e.target.value as Action['type'] })}>
                <option value="place_bet">Place Bet</option>
                <option value="adjust_unit">Adjust Unit Size</option>
                <option value="skip_hand">Skip Hand(s)</option>
                <option value="reset_progression">Reset Progression</option>
                <option value="lock_side">Lock Betting Side</option>
                <option value="stop_loss">Stop Loss</option>
                <option value="take_profit">Take Profit</option>
              </Sel>
            </F>
            {action.type === 'place_bet' && <>
              <div className="grid grid-cols-2 gap-2">
                <F label="Bet Side"><Sel value={action.side??'Banker'} onChange={e => uA({ side: e.target.value as BetSide })}>
                  <option value="Banker">Banker</option><option value="Player">Player</option><option value="Tie">Tie</option>
                </Sel></F>
                <F label="Unit ×"><Inp type="number" min={0.1} step={0.1} value={action.unit_size??1} onChange={e => uA({ unit_size: +e.target.value })}/></F>
              </div>
            </>}
            {action.type === 'adjust_unit' && <>
              <F label="Progression">
                <Sel value={action.method??'martingale'} onChange={e => uA({ method: e.target.value as ProgressionMethod })}>
                  <option value="flat">Flat</option>
                  <option value="martingale">Martingale (2×)</option>
                  <option value="fibonacci">Fibonacci</option>
                  <option value="dalembert">D'Alembert</option>
                  <option value="labouchere">Labouchere</option>
                  <option value="oscars_grind">Oscar's Grind</option>
                  <option value="1326">1-3-2-6</option>
                </Sel>
              </F>
              <F label="Multiplier / Value"><Inp type="number" min={0.1} step={0.1} value={action.value??2} onChange={e => uA({ value: +e.target.value })}/></F>
            </>}
            {action.type === 'skip_hand' && <F label="Skip Count"><Inp type="number" min={1} max={10} value={action.skip_count??1} onChange={e => uA({ skip_count: +e.target.value })}/></F>}
            {(action.type === 'stop_loss' || action.type === 'take_profit') && (
              <F label="Threshold ($)"><Inp type="number" value={action.threshold??(action.type==='stop_loss'?-500:500)} onChange={e => uA({ threshold: +e.target.value })}/></F>
            )}
          </div>

          {/* Modifiers */}
          <div className="p-3 rounded-xl" style={{ background:'rgba(245,158,11,0.06)', border:'1px solid rgba(245,158,11,0.15)' }}>
            {SECTION('rgba(245,158,11,0.9)', 'WITH — Modifiers')}
            <div className="grid grid-cols-2 gap-3">
              <F label="Max Bet ($)"><Inp type="number" min={0} value={modifiers.max_bet??''} placeholder="None" onChange={e => uM({ max_bet: e.target.value ? +e.target.value : undefined })}/></F>
              <F label="Bankroll Guard (%)"><Inp type="number" min={0} max={100} step={1} value={modifiers.bankroll_guard ? modifiers.bankroll_guard*100 : ''} placeholder="None" onChange={e => uM({ bankroll_guard: e.target.value ? +e.target.value/100 : undefined })}/></F>
              <F label="Commission Override (%)"><Inp type="number" min={0} max={10} step={0.5} value={modifiers.commission_override != null ? modifiers.commission_override*100 : ''} placeholder="Global" onChange={e => uM({ commission_override: e.target.value ? +e.target.value/100 : undefined })}/></F>
              <F label="Shoe Reset">
                <Sel value={modifiers.shoe_reset??'carry'} onChange={e => uM({ shoe_reset: e.target.value as 'carry'|'reset' })}>
                  <option value="carry">Carry Across</option>
                  <option value="reset">Reset Each Shoe</option>
                </Sel>
              </F>
            </div>
          </div>
        </div>

        <div className="flex gap-3 px-5 py-4" style={{ borderTop:'1px solid rgba(255,255,255,0.08)' }}>
          <button onClick={onClose} className="btn-glass flex-1 px-4 py-2 text-sm">Cancel</button>
          <button onClick={() => { onSave({ label, trigger, action, modifiers }); onClose() }}
            className="btn-primary flex-1 px-4 py-2 text-sm">Save Rule</button>
        </div>
      </div>
    </div>
  )
}
