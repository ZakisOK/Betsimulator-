import React, { useEffect, useState } from 'react'
import { Routes, Route, Link } from 'react-router-dom'
import { Bot, TrendingUp, Layers, Info, LogOut, Crown, Settings } from 'lucide-react'
import { useStore } from './store/useStore'
import { useAuth } from './hooks/useAuth'
import { StrategyBuilder } from './components/StrategyBuilder'
import { ResultsPanel } from './components/Results'
import { MathAgent } from './components/MathAgent'
import { ToastContainer } from './components/Toast'
import { LandingPage } from './components/LandingPage'
import { ComingSoon } from './components/ComingSoon'
import { UpgradeModal } from './components/UpgradeModal'
import { AuthCallback } from './pages/AuthCallback'
import { Terms } from './pages/Terms'
import { Privacy } from './pages/Privacy'
import { Disclaimer } from './pages/Disclaimer'
import { Cookies } from './pages/Cookies'
import { ResponsibleGambling } from './pages/ResponsibleGambling'
import { supabase } from './lib/supabase'

type Panel = 'builder' | 'results' | 'agent'

const EV_PILLS = [
  { label: 'Banker EV', value: '−1.06%', color: 'text-blue-400' },
  { label: 'Player EV', value: '−1.24%', color: 'text-red-400' },
  { label: 'Tie EV', value: '−14.36%', color: 'text-emerald-400' },
]

const NAV: { id: Panel; label: string; icon: React.ReactNode }[] = [
  { id: 'builder', label: 'Strategy', icon: <Layers size={16} /> },
  { id: 'results', label: 'Results', icon: <TrendingUp size={16} /> },
  { id: 'agent', label: 'AI Analysis', icon: <Bot size={16} /> },
]

const TIER_BADGE: Record<string, { label: string; color: string }> = {
  free: { label: 'Free', color: 'rgba(255,255,255,0.3)' },
  pro: { label: 'Pro', color: 'rgba(59,130,246,0.7)' },
  lab: { label: 'Lab', color: 'rgba(167,139,250,0.7)' },
}

function MigrationModal() {
  const { pendingMigration, clearPendingMigration, showToast } = useStore()
  const [importing, setImporting] = useState(false)

  if (!pendingMigration || pendingMigration.length === 0) return null

  async function handleImport() {
    setImporting(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      for (const strategy of pendingMigration ?? []) {
        await supabase.from('strategies').insert({
          user_id: session.user.id,
          name: strategy.name,
          version: strategy.version ?? '1.0',
          config_json: strategy,
        })
      }
      showToast(`${pendingMigration?.length ?? 0} strategies imported`, 'success')
    } catch {
      showToast('Import failed', 'error')
    }
    localStorage.removeItem('baccarat-dashboard')
    clearPendingMigration()
    setImporting(false)
  }

  function handleSkip() {
    localStorage.removeItem('baccarat-dashboard')
    clearPendingMigration()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}
    >
      <div className="glass-elevated rounded-2xl p-6 w-full max-w-sm" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
        <h2 className="text-base font-bold mb-2">Import previous strategies?</h2>
        <p className="text-sm text-white/50 mb-5">
          We found {pendingMigration.length} saved {pendingMigration.length === 1 ? 'strategy' : 'strategies'} from a previous session. Import them to your account?
        </p>
        <div className="flex gap-2">
          <button onClick={handleSkip} className="btn-glass flex-1 py-2.5 rounded-lg text-sm">
            Skip
          </button>
          <button
            onClick={handleImport}
            disabled={importing}
            className="btn-primary flex-1 py-2.5 rounded-lg text-sm"
          >
            {importing ? 'Importing…' : 'Import'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Dashboard() {
  const {
    activePanel, setActivePanel,
    backtestResults, agentMessages,
    user, showUpgradeModal, setShowUpgradeModal,
    refetchProfile,
  } = useStore()

  const agentBadge = agentMessages.filter((m) => m.role === 'assistant').length
  const tier = user?.subscription_tier ?? 'free'
  const badge = TIER_BADGE[tier]

  // LemonSqueezy init and checkout success listener
  useEffect(() => {
    window.createLemonSqueezy?.()

    function onMessage(e: MessageEvent) {
      if ((e.data as { event?: string })?.event === 'Checkout.Success') {
        refetchProfile()
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [refetchProfile])

  async function handleSignOut() {
    await supabase.auth.signOut()
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-mesh text-white">

      {/* Header */}
      <header
        className="flex items-center justify-between px-5 py-2.5 shrink-0 z-20"
        style={{
          background: 'rgba(2,8,23,0.7)',
          backdropFilter: 'blur(24px)',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
        }}
      >
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
                BetBacktest
              </span>
              <span
                className="text-[9px] font-mono px-1.5 py-0.5 rounded-full"
                style={{ background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.3)', color: badge.color }}
              >
                {badge.label}
              </span>
            </div>
            <div className="text-[10px] text-white/30 font-mono">Strategy · Backtest · AI Analysis</div>
          </div>

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

        <div className="flex items-center gap-3">
          <div className="hidden xl:flex items-center gap-3">
            {EV_PILLS.map((p) => (
              <div key={p.label} className="flex items-center gap-1.5 text-[10px] font-mono">
                <span className="text-white/30">{p.label}</span>
                <span
                  className={`px-1.5 py-0.5 rounded ${p.color}`}
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
                >
                  {p.value}
                </span>
              </div>
            ))}
            <div className="h-4 w-px bg-white/10" />
          </div>

          {tier === 'free' && (
            <button
              onClick={() => setShowUpgradeModal(true)}
              className="hidden sm:flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-all"
              style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', color: 'rgba(167,139,250,0.9)' }}
            >
              <Crown size={12} /> Upgrade
            </button>
          )}

          {user && (
            <div className="flex items-center gap-1">
              <div className="text-xs text-white/30 hidden md:block">{user.email}</div>
              <button
                onClick={handleSignOut}
                className="p-1.5 text-white/30 hover:text-white/70 transition-colors"
                title="Sign out"
              >
                <LogOut size={14} />
              </button>
            </div>
          )}

          <button
            className="p-1.5 text-white/30 hover:text-white/70 transition-colors"
            onClick={() => alert('BetBacktest\n\nMathematical research tool only.\nNo betting system eliminates the house edge.\nBanker −1.06% · Player −1.24% · Tie −14.36%')}
          >
            <Info size={15} />
          </button>
        </div>
      </header>

      {/* Three-panel layout */}
      <div className="flex-1 overflow-hidden flex">
        <div className="lg:hidden flex-1 overflow-hidden">
          {activePanel === 'builder' && <div className="h-full overflow-hidden"><StrategyBuilder /></div>}
          {activePanel === 'results' && <div className="h-full overflow-hidden"><ResultsPanel /></div>}
          {activePanel === 'agent' && <div className="h-full overflow-hidden"><MathAgent /></div>}
        </div>

        <div className="hidden lg:flex flex-1 overflow-hidden">
          <div
            className="w-[30%] min-w-[280px] max-w-[400px] flex flex-col overflow-hidden"
            style={{ borderRight: '1px solid rgba(255,255,255,0.06)', background: 'rgba(2,8,23,0.5)', backdropFilter: 'blur(20px)' }}
          >
            <StrategyBuilder />
          </div>
          <div
            className="flex-1 flex flex-col overflow-hidden"
            style={{ borderRight: '1px solid rgba(255,255,255,0.06)', background: 'rgba(2,8,23,0.3)' }}
          >
            <ResultsPanel />
          </div>
          <div
            className="w-[25%] min-w-[280px] max-w-[360px] flex flex-col overflow-hidden"
            style={{ background: 'rgba(2,8,23,0.5)', backdropFilter: 'blur(20px)' }}
          >
            <MathAgent />
          </div>
        </div>
      </div>

      {/* Mobile bottom nav */}
      <nav
        className="lg:hidden flex shrink-0"
        style={{ borderTop: '1px solid rgba(255,255,255,0.07)', background: 'rgba(2,8,23,0.8)', backdropFilter: 'blur(24px)' }}
      >
        {NAV.map(({ id, label, icon }) => {
          const active = activePanel === id
          return (
            <button key={id} onClick={() => setActivePanel(id)}
              className="flex-1 flex flex-col items-center gap-1 py-3 text-[11px] font-medium transition-colors relative"
              style={{ color: active ? 'rgba(96,165,250,1)' : 'rgba(255,255,255,0.35)' }}
            >
              {icon}{label}
              {active && <span className="absolute bottom-1.5 w-1 h-1 rounded-full bg-blue-400" />}
            </button>
          )
        })}
      </nav>

      <ToastContainer />

      <div
        className="hidden lg:flex items-center justify-between px-5 py-1 shrink-0 text-[9px] font-mono"
        style={{ borderTop: '1px solid rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.15)' }}
      >
        <span>Mathematical research tool only · No betting system eliminates the house edge · Banker −1.06% · Player −1.24% · Tie −14.36%</span>
        <div className="flex gap-3">
          <Link to="/terms" className="hover:text-white/40 transition-colors">Terms</Link>
          <Link to="/privacy" className="hover:text-white/40 transition-colors">Privacy</Link>
          <Link to="/disclaimer" className="hover:text-white/40 transition-colors">Disclaimer</Link>
          <Link to="/responsible-gambling" className="hover:text-white/40 transition-colors">Responsible Gambling</Link>
        </div>
      </div>

      {showUpgradeModal && <UpgradeModal onClose={() => setShowUpgradeModal(false)} />}
    </div>
  )
}

function AuthGate() {
  const { user, authLoading, pendingMigration } = useStore()
  useAuth()

  useEffect(() => {
    document.documentElement.classList.add('dark')
    const params = new URLSearchParams(window.location.search)
    if (params.get('unlock') === 'bb2026') {
      localStorage.setItem('bb_unlocked', 'true')
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [])

  const isUnlocked = localStorage.getItem('bb_unlocked') === 'true'
  if (!isUnlocked) return <ComingSoon />

  if (authLoading) {
    return (
      <div className="min-h-screen bg-mesh flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!user) return <LandingPage />

  return (
    <>
      {pendingMigration && <MigrationModal />}
      <Dashboard />
    </>
  )
}

export const App: React.FC = () => {
  return (
    <Routes>
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="/terms" element={<Terms />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/disclaimer" element={<Disclaimer />} />
      <Route path="/cookies" element={<Cookies />} />
      <Route path="/responsible-gambling" element={<ResponsibleGambling />} />
      <Route path="/*" element={<AuthGate />} />
    </Routes>
  )
}
