import React from 'react'
import type { SimulationConfig } from '../../types'

interface Props { config: SimulationConfig; onChange: (u: Partial<SimulationConfig>) => void }

const SliderField: React.FC<{
  label: string; value: number; min: number; max: number; step?: number
  fmt?: (v: number) => string; onChange: (v: number) => void
}> = ({ label, value, min, max, step=1, fmt, onChange }) => (
  <div className="mb-3">
    <div className="flex justify-between items-center mb-1">
      <span className="section-label">{label}</span>
      <span className="text-[10px] font-mono text-white/70">{fmt ? fmt(value) : value}</span>
    </div>
    <input type="range" min={min} max={max} step={step} value={value}
      onChange={e => onChange(+e.target.value)}
      className="w-full h-1 rounded-full appearance-none cursor-pointer"
      style={{
        background: `linear-gradient(to right, rgba(59,130,246,0.8) 0%, rgba(99,102,241,0.8) ${((value-min)/(max-min))*100}%, rgba(255,255,255,0.1) ${((value-min)/(max-min))*100}%, rgba(255,255,255,0.1) 100%)`
      }}
    />
    <div className="flex justify-between text-[9px] text-white/20 mt-0.5 font-mono">
      <span>{fmt ? fmt(min) : min}</span><span>{fmt ? fmt(max) : max}</span>
    </div>
  </div>
)

export const SimConfig: React.FC<Props> = ({ config, onChange }) => {
  const fmtK   = (v: number) => v >= 1000 ? `${(v/1000).toFixed(0)}K` : String(v)
  const fmtPct = (v: number) => `${(v*100).toFixed(1)}%`
  const fmtDol = (v: number) => `$${v.toLocaleString()}`

  return (
    <div className="pt-1 space-y-0.5">
      {/* Shoe count presets */}
      <div className="mb-3">
        <div className="flex justify-between items-center mb-1">
          <span className="section-label">Shoes to Simulate</span>
          <span className="text-[10px] font-mono text-white/70">{fmtK(config.num_shoes)}</span>
        </div>
        <div className="flex gap-1 mb-1">
          {[100, 1000, 10000, 100000].map(v => (
            <button key={v} onClick={() => onChange({ num_shoes: v })}
              className="text-[9px] px-1.5 py-0.5 rounded font-mono transition-all"
              style={config.num_shoes === v
                ? { background:'linear-gradient(135deg,rgba(59,130,246,0.6),rgba(99,102,241,0.6))', color:'white', border:'1px solid rgba(99,102,241,0.4)' }
                : { background:'rgba(255,255,255,0.05)', color:'rgba(255,255,255,0.4)', border:'1px solid rgba(255,255,255,0.08)' }}>
              {fmtK(v)}
            </button>
          ))}
        </div>
      </div>

      <SliderField label="Hands / Shoe"      value={config.hands_per_shoe}   min={40}  max={85}   onChange={v => onChange({ hands_per_shoe: v })}/>
      <SliderField label="Commission Rate"   value={config.commission_rate}  min={0}   max={0.1} step={0.005} fmt={fmtPct} onChange={v => onChange({ commission_rate: v })}/>
      <SliderField label="Starting Bankroll" value={config.starting_bankroll}min={500} max={50000} step={500} fmt={fmtDol} onChange={v => onChange({ starting_bankroll: v })}/>
      <SliderField label="Cut Card Position" value={config.cut_card_position}min={10}  max={20}   onChange={v => onChange({ cut_card_position: v })}/>

      <div className="grid grid-cols-2 gap-2 pt-1">
        {[
          { label: 'Decks', value: config.deck_count, options: [{ v: 6, l: '6 Deck' }, { v: 8, l: '8 Deck' }], onChange: (v: string) => onChange({ deck_count: +v as 6|8 }) },
          { label: 'Tie Handling', value: config.tie_handling, options: [{ v:'push', l:'Push' }, { v:'lose', l:'Lose' }], onChange: (v: string) => onChange({ tie_handling: v as 'push'|'lose' }) },
        ].map(f => (
          <div key={f.label}>
            <div className="section-label mb-1">{f.label}</div>
            <select value={f.value} onChange={e => f.onChange(e.target.value)}
              className="input-glass w-full px-2 py-1.5 text-xs">
              {f.options.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
            </select>
          </div>
        ))}
      </div>

      <div className="pt-1">
        <div className="section-label mb-1">Random Seed (blank = random)</div>
        <input type="number" placeholder="Auto" value={config.random_seed??''}
          onChange={e => onChange({ random_seed: e.target.value ? +e.target.value : undefined })}
          className="input-glass w-full px-2.5 py-1.5 text-xs font-mono"
        />
      </div>
    </div>
  )
}
