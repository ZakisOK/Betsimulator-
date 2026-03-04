import React, { useState } from 'react'
import { Plus, Play, Save, Upload, Download, FolderOpen, X, Loader2, ChevronDown, ChevronRight, Sliders } from 'lucide-react'
import { useStore } from '../../store/useStore'
import { RuleCard } from './RuleCard'
import { SimConfig } from './SimulationConfig'
import type { Rule } from '../../types'

const DEFAULT_NEW_RULE: Omit<Rule, 'id' | 'priority'> = {
  enabled: true, label: 'New Rule',
  trigger: { type: 'hand_count', hand_min: 1 },
  action: { type: 'place_bet', side: 'Banker', unit_size: 1 },
  modifiers: { shoe_reset: 'reset' },
}

export const StrategyBuilder: React.FC = () => {
  const {
    currentStrategy, simConfig, isRunning, progress, savedStrategies,
    updateStrategyMeta, addRule, updateRule, removeRule, moveRule, duplicateRule,
    updateSimConfig, runBacktest, cancelBacktest, saveStrategy, loadStrategy,
    deleteStrategy, importStrategy,
  } = useStore()

  const [showSimConfig, setShowSimConfig] = useState(false)
  const [showLibrary, setShowLibrary]     = useState(false)
  const [editingName, setEditingName]     = useState(false)

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(currentStrategy, null, 2)], { type: 'application/json' })
    const url  = URL.createObjectURL(blob)
    Object.assign(document.createElement('a'), { href: url, download: `${currentStrategy.name.replace(/\s+/g,'_')}.json` }).click()
    URL.revokeObjectURL(url)
  }

  const handleImport = () => {
    const inp = document.createElement('input')
    inp.type = 'file'; inp.accept = '.json'
    inp.onchange = e => {
      const f = (e.target as HTMLInputElement).files?.[0]; if (!f) return
      const r = new FileReader(); r.onload = ev => importStrategy(ev.target?.result as string); r.readAsText(f)
    }
    inp.click()
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Header */}
      <div className="px-4 pt-4 pb-3 shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex items-center gap-2 mb-3">
          {editingName ? (
            <input autoFocus value={currentStrategy.name}
              onChange={e => updateStrategyMeta({ name: e.target.value })}
              onBlur={() => setEditingName(false)}
              onKeyDown={e => e.key === 'Enter' && setEditingName(false)}
              className="flex-1 bg-transparent border-b text-sm font-bold text-white focus:outline-none"
              style={{ borderColor: 'rgba(99,102,241,0.6)' }}
            />
          ) : (
            <button onClick={() => setEditingName(true)}
              className="flex-1 text-left text-sm font-bold text-white/90 hover:text-white truncate transition-colors">
              {currentStrategy.name}
            </button>
          )}
          <div className="flex gap-0.5 shrink-0">
            {[
              { icon: <Upload size={12}/>,    title: 'Import JSON',    fn: handleImport },
              { icon: <Download size={12}/>,  title: 'Export JSON',    fn: handleExport },
              { icon: <Save size={12}/>,      title: 'Save to Library',fn: saveStrategy },
              { icon: <FolderOpen size={12}/>,title: 'Library',        fn: () => setShowLibrary(!showLibrary) },
            ].map(({ icon, title, fn }) => (
              <button key={title} title={title} onClick={fn}
                className="p-1.5 rounded-lg transition-all hover:bg-white/10 text-white/35 hover:text-white/70">
                {icon}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: 'Base Unit ($)', key: 'base_unit', val: currentStrategy.base_unit },
            { label: 'Bankroll ($)',  key: 'bankroll',  val: currentStrategy.bankroll  },
          ].map(({ label, key, val }) => (
            <div key={key}>
              <label className="section-label mb-1 block">{label}</label>
              <input type="number" min={1} value={val}
                onChange={e => updateStrategyMeta({ [key]: +e.target.value } as any)}
                className="input-glass w-full px-2.5 py-1.5 text-xs font-mono"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Library */}
      {showLibrary && (
        <div className="px-4 py-3 max-h-36 overflow-y-auto shrink-0"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.2)' }}>
          <div className="flex items-center justify-between mb-2">
            <span className="section-label">Library ({savedStrategies.length})</span>
            <button onClick={() => setShowLibrary(false)} className="text-white/30 hover:text-white/70"><X size={11}/></button>
          </div>
          {savedStrategies.length === 0
            ? <p className="text-[10px] text-white/25 italic">No saved strategies yet.</p>
            : savedStrategies.map(st => (
              <div key={st.id} className="flex items-center py-1 hover:bg-white/5 rounded px-1">
                <button onClick={() => { loadStrategy(st); setShowLibrary(false) }}
                  className="flex-1 text-left text-xs text-white/60 hover:text-white/90 truncate transition-colors">{st.name}</button>
                <button onClick={() => deleteStrategy(st.id)} className="text-white/20 hover:text-red-400 ml-2 transition-colors"><X size={10}/></button>
              </div>
            ))
          }
        </div>
      )}

      {/* Rules */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <span className="section-label">Rules ({currentStrategy.rules.length})</span>
          <button onClick={() => addRule(DEFAULT_NEW_RULE)}
            className="flex items-center gap-1 text-[10px] font-medium text-blue-400/90 hover:text-blue-300 transition-colors">
            <Plus size={11}/>Add Rule
          </button>
        </div>

        {currentStrategy.rules.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-4xl mb-3 opacity-20">🎴</div>
            <p className="text-xs text-white/25">No rules yet. Click Add Rule to start.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {currentStrategy.rules.map((rule, i) => (
              <RuleCard key={rule.id} rule={rule} index={i}
                total={currentStrategy.rules.length}
                onUpdate={updateRule} onRemove={removeRule}
                onMove={moveRule} onDuplicate={duplicateRule}
              />
            ))}
          </div>
        )}
      </div>

      {/* Sim Config collapsible */}
      <div className="shrink-0" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <button onClick={() => setShowSimConfig(!showSimConfig)}
          className="w-full flex items-center justify-between px-4 py-2.5 transition-colors hover:bg-white/5 text-white/40 hover:text-white/60">
          <span className="flex items-center gap-1.5 section-label"><Sliders size={11}/>Simulation Config</span>
          {showSimConfig ? <ChevronDown size={11}/> : <ChevronRight size={11}/>}
        </button>
        {showSimConfig && (
          <div className="px-4 pb-3 max-h-72 overflow-y-auto"><SimConfig config={simConfig} onChange={updateSimConfig}/></div>
        )}
      </div>

      {/* Run button */}
      <div className="px-4 py-3 shrink-0" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        {isRunning ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[10px]">
              <span className="flex items-center gap-1.5 text-blue-400"><Loader2 size={10} className="animate-spin"/>Simulating...</span>
              <span className="font-mono text-white/60">{progress}%</span>
            </div>
            <div className="w-full h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
              <div className="h-full rounded-full transition-all duration-300"
                style={{ width: `${progress}%`, background: 'linear-gradient(90deg,#3b82f6,#8b5cf6)' }}/>
            </div>
            <button onClick={cancelBacktest} className="w-full py-1.5 text-xs text-red-400/70 hover:text-red-400 transition-colors">Cancel</button>
          </div>
        ) : (
          <button onClick={runBacktest} disabled={currentStrategy.rules.length === 0} className="btn-primary w-full flex items-center justify-center gap-2 py-2.5 text-sm">
            <Play size={13} fill="currentColor"/>
            Run Backtest
            <span className="text-xs opacity-60 font-normal">
              {simConfig.num_shoes >= 1000 ? `${(simConfig.num_shoes/1000).toFixed(0)}K` : simConfig.num_shoes} shoes
            </span>
          </button>
        )}
      </div>
    </div>
  )
}
