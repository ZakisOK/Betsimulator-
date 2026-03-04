import React, { useEffect } from 'react'
import { Bot, TrendingUp, Layers, Github, Info, Sparkles } from 'lucide-react'
import { useStore } from './store/useStore'
import { StrategyBuilder } from './components/StrategyBuilder'
import { ResultsPanel } from './components/Results'
import { MathAgent } from './components/MathAgent'

type Panel = 'builder' | 'results' | 'agent'

const EV_PILLS = [
  { label: 'Banker EV', value: '−1.06%', color: 'text-blue-400' },
  { label: 'Player EV', value: '−1.24%', color: 'text-red-400' },
  { label: 'Tie EV',    value: '−14.36%', color: 'text-emerald-400' },
]

const NAV: { id: Panel; label: string; icon: React.ReactNode }[] = [
  { id: 'builder', label: 'Strategy',    icon: <Layers size={13} /> },
  { id: 'results', label: 'Results',     icon: <TrendingUp size={13} /> },
  { id: 'agent',   label: 'Math Agent',  icon: <Bot size={13} /> },
]

export const App: React.FC = () => {
  const { activePanel, setActivePanel, backtestResults, agentMessages } = useStore()

  useEffect(() => {
    document.documentElement.classList.add('dark')
  }, [])

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return
      if (e.key === '1') { e.preventDefault(); setActivePanel('builder') }
      if (e.key === '2') { e.preventDefault(); setActivePanel('results') }
      if (e.key === '3') { e.preventDefault(); setActivePanel('agent') }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [setActivePanel])

  const agentBadge = agentMessages.filter(m => m.role === 'assistant').length

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-mesh text-white">

      {/* ── Global Header ──────────────────────────────────────── */}
      <header
        className="flex items-center justify-between px-5 py-2.5 shrink-0 z-20"
        style={{
          background: 'rgba(2,8,23,0.7)',
          backdropFilter: 'blur(24px)',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
        }}
      >
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center text-base"
            style={{
              background: 'linear-gradient(135deg,rgba(59,130,246,0.4),rgba(99,102,241,0.4))',
              border: '1px solid rgba(99,102,241,0.4)',
              boxShadow: '0 0 16px rgba(59,130,246,0.3)',
            }}
          >
            🎴
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-bold tracking-tight bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent">
                BaccaratSim
              </span>
              <span
                className="text-[9px] font-mono px-1.5 py-0.5 rounded-full"
                style={{ background:'rgba(99,102,241,0.2)', border:'1px solid rgba(99,102,241,0.3)', color:'rgba(167,139,250,0.9)' }}
              >
                v1.0
              </span>
            </div>
            <div className="text-[10px] text-white/30 font-mono">Strategy · Backtest · AI Analysis</div>
          </div>

          {/* Desktop nav */}
          <nav className="hidden lg:flex items-center gap-1 ml-6">
            {NAV.map(({ id, label, icon }) => {
              const active = activePanel === id
              const hasDot = (id === 'results' && backtestResults) || (id === 'agent' && agentBadge > 0)
              return (
                <button
                  key={id}
                  onClick={() => setActivePanel(id)}
                  className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200"
                  style={active ? {
                    background: 'rgba(255,255,255,0.1)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    color: 'white',
                    backdropFilter: 'blur(8px)',
                  } : {
                    color: 'rgba(255,255,255,0.45)',
                    border: '1px solid transparent',
                  }}
                >
                  {icon}{label}
                  {hasDot && !active && (
                    <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                  )}
                </button>
              )
            })}
          </nav>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-4">
          {/* EV pills (desktop only) */}
          <div className="hidden xl:flex items-center gap-3">
            {EV_PILLS.map(p => (
              <div key={p.label} className="flex items-center gap-1.5 text-[10px] font-mono">
                <span className="text-white/30">{p.label}</span>
                <span
                  className={`px-1.5 py-0.5 rounded ${p.color}`}
                  style={{ background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)' }}
                >
                  {p.value}
                </span>
              </div>
            ))}
            <div className="h-4 w-px bg-white/10" />
          </div>

          <a href="https://github.com" target="_blank" rel="noopener noreferrer"
            className="p-1.5 text-white/30 hover:text-white/70 transition-colors">
            <Github size={15} />
          </a>
          <button
            className="p-1.5 text-white/30 hover:text-white/70 transition-colors"
            onClick={() => alert('Baccarat Strategy Dashboard v1.0\n\nMathematical research tool only.\nNo betting system eliminates the house edge.')}
          >
            <Info size={15} />
          </button>
        </div>
      </header>

      {/* ── Three-Panel Desktop Layout ──────────────────────────── */}
      <div className="flex-1 overflow-hidden flex">

        {/* Mobile — single panel */}
        <div className="lg:hidden flex-1 overflow-hidden">
          {activePanel === 'builder' && <div className="h-full overflow-hidden"><StrategyBuilder /></div>}
          {activePanel === 'results' && <div className="h-full overflow-hidden"><ResultsPanel /></div>}
          {activePanel === 'agent'   && <div className="h-full overflow-hidden"><MathAgent /></div>}
        </div>

        {/* Desktop — three panels */}
        <div className="hidden lg:flex flex-1 overflow-hidden">

          {/* Left 30% — Strategy Builder */}
          <div
            className="w-[30%] min-w-[280px] max-w-[400px] flex flex-col overflow-hidden"
            style={{ borderRight: '1px solid rgba(255,255,255,0.06)', background:'rgba(2,8,23,0.5)', backdropFilter:'blur(20px)' }}
          >
            <StrategyBuilder />
          </div>

          {/* Center 45% — Results */}
          <div
            className="flex-1 flex flex-col overflow-hidden"
            style={{ borderRight: '1px solid rgba(255,255,255,0.06)', background:'rgba(2,8,23,0.3)' }}
          >
            <ResultsPanel />
          </div>

          {/* Right 25% — Math Agent */}
          <div
            className="w-[25%] min-w-[280px] max-w-[360px] flex flex-col overflow-hidden"
            style={{ background:'rgba(2,8,23,0.5)', backdropFilter:'blur(20px)' }}
          >
            <MathAgent />
          </div>
        </div>
      </div>

      {/* ── Mobile Bottom Nav ───────────────────────────────────── */}
      <nav
        className="lg:hidden flex shrink-0"
        style={{ borderTop:'1px solid rgba(255,255,255,0.07)', background:'rgba(2,8,23,0.8)', backdropFilter:'blur(24px)' }}
      >
        {NAV.map(({ id, label, icon }) => {
          const active = activePanel === id
          return (
            <button key={id} onClick={() => setActivePanel(id)}
              className="flex-1 flex flex-col items-center gap-1 py-3 text-[10px] font-medium transition-colors"
              style={{ color: active ? 'rgba(96,165,250,1)' : 'rgba(255,255,255,0.35)' }}
            >
              {icon}{label}
            </button>
          )
        })}
      </nav>

      {/* ── Footer disclaimer ───────────────────────────────────── */}
      <div
        className="hidden lg:flex items-center justify-center py-1 shrink-0 text-[9px] font-mono"
        style={{ borderTop:'1px solid rgba(255,255,255,0.04)', color:'rgba(255,255,255,0.15)' }}
      >
        Mathematical research tool only · No betting system eliminates the house edge · Banker −1.06% · Player −1.24% · Tie −14.36%
      </div>
    </div>
  )
}
