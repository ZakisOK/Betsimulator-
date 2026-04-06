import React, { useState } from 'react'
import { TrendingUp, Bot, Layers, Shield, Zap, BarChart3, Lock } from 'lucide-react'
import { AuthModal } from './AuthModal'

const FEATURES = [
  { name: 'Strategies', free: '3 max', pro: '25 max', lab: 'Unlimited' },
  { name: 'Shoes per backtest', free: '500', pro: '50,000', lab: '1,000,000' },
  { name: 'AI analysis queries/day', free: '5', pro: '50', lab: 'Unlimited' },
  { name: 'Risk metrics (Sharpe, VaR, Kelly)', free: false, pro: true, lab: true },
  { name: 'Strategy versioning', free: false, pro: true, lab: true },
  { name: 'Chart export', free: false, pro: true, lab: true },
  { name: 'CSV shoe import', free: false, pro: true, lab: true },
  { name: 'Deep Analysis PDF Report ($4.99)', free: true, pro: true, lab: true },
  { name: 'Auto-optimizer', free: false, pro: false, lab: true },
  { name: 'Pattern discovery engine', free: false, pro: false, lab: true },
  { name: 'Post-backtest pattern reviewer', free: false, pro: false, lab: true },
]

const HIGHLIGHTS = [
  { icon: <Layers size={20} />, title: 'Build any strategy', body: 'Rule-based engine with 20+ trigger types and progression methods including Martingale, Fibonacci, Labouchere, and Oscar\'s Grind.' },
  { icon: <TrendingUp size={20} />, title: 'Run millions of shoes', body: 'Simulate up to 1,000,000 shoes with Lab tier. Full 8-deck baccarat with configurable commission, cut card, and shuffle.' },
  { icon: <Bot size={20} />, title: 'AI tells you the truth', body: 'Every analysis includes an Honesty Score. No betting system eliminates the house edge — the AI won\'t pretend otherwise.' },
  { icon: <BarChart3 size={20} />, title: 'Full risk metrics', body: 'Sharpe ratio, Sortino, Value at Risk, Kelly Criterion, Risk of Ruin, max drawdown, and 25+ more performance metrics.' },
  { icon: <Zap size={20} />, title: 'Real-time in the browser', body: 'No server-side simulation. All computation runs locally in your browser. Your strategy data stays private.' },
  { icon: <Shield size={20} />, title: 'Honest about the math', body: 'Banker EV = −1.06%. Player EV = −1.24%. Tie EV = −14.36%. Simulations confirm theory. We show you the real numbers.' },
]

const TIER_CHECK = ({ val }: { val: boolean | string }) => {
  if (val === false) return <Lock size={14} className="text-white/20 mx-auto" />
  if (val === true) return <span className="text-emerald-400 font-bold">✓</span>
  return <span className="text-white/70 text-sm">{val}</span>
}

export const LandingPage: React.FC = () => {
  const [showAuth, setShowAuth] = useState(false)
  const [authMode, setAuthMode] = useState<'sign_in' | 'sign_up'>('sign_up')

  const openSignUp = () => { setAuthMode('sign_up'); setShowAuth(true) }
  const openSignIn = () => { setAuthMode('sign_in'); setShowAuth(true) }

  return (
    <div className="min-h-screen bg-mesh text-white">

      {/* Header */}
      <header
        className="sticky top-0 z-20 flex items-center justify-between px-6 py-3"
        style={{
          background: 'rgba(2,8,23,0.8)',
          backdropFilter: 'blur(24px)',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
        }}
      >
        <div className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center text-sm"
            style={{ background: 'linear-gradient(135deg,rgba(59,130,246,0.4),rgba(99,102,241,0.4))', border: '1px solid rgba(99,102,241,0.4)' }}
          >
            🎴
          </div>
          <span className="text-sm font-bold bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent">
            BetBacktest
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={openSignIn}
            className="text-sm text-white/50 hover:text-white/80 transition-colors px-3 py-1.5"
          >
            Sign in
          </button>
          <button
            onClick={openSignUp}
            className="btn-primary text-sm px-4 py-1.5 rounded-lg"
          >
            Get started free
          </button>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-4xl mx-auto text-center px-6 pt-20 pb-16">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono text-blue-400 mb-6"
          style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)' }}>
          Banker −1.06% · Player −1.24% · Tie −14.36%
        </div>
        <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-4">
          Backtest Betting Strategies<br />
          <span className="bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent">
            with AI
          </span>
        </h1>
        <p className="text-lg text-white/50 max-w-2xl mx-auto mb-8">
          Build a strategy. Run it against 1,000,000 simulated shoes. Let AI tell you what's wrong.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={openSignUp}
            className="btn-primary px-8 py-3 rounded-xl text-base font-semibold"
          >
            Start backtesting free
          </button>
          <button
            onClick={openSignIn}
            className="btn-glass px-8 py-3 rounded-xl text-base"
          >
            Sign in
          </button>
        </div>
        <p className="text-xs text-white/25 mt-4">No credit card required · Free tier always available</p>
      </section>

      {/* Feature highlights */}
      <section className="max-w-5xl mx-auto px-6 pb-20">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {HIGHLIGHTS.map((h) => (
            <div key={h.title} className="glass-panel p-5 rounded-xl">
              <div className="text-blue-400 mb-3">{h.icon}</div>
              <h3 className="text-sm font-semibold text-white mb-1.5">{h.title}</h3>
              <p className="text-xs text-white/40 leading-relaxed">{h.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section className="max-w-5xl mx-auto px-6 pb-20">
        <h2 className="text-2xl font-bold text-center mb-2">Simple pricing</h2>
        <p className="text-center text-white/40 text-sm mb-10">Pro and Lab include a 7-day free trial.</p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Free */}
          <div className="glass-panel rounded-xl p-6 flex flex-col">
            <div className="text-xs font-mono text-white/40 uppercase tracking-widest mb-2">Free</div>
            <div className="text-3xl font-bold mb-1">$0</div>
            <div className="text-xs text-white/30 mb-6">Forever</div>
            <ul className="text-sm text-white/50 space-y-2 flex-1">
              <li>3 strategies</li>
              <li>500 shoes per backtest</li>
              <li>5 AI queries / day</li>
              <li>Basic metrics</li>
              <li>No risk metrics</li>
            </ul>
            <button onClick={openSignUp} className="btn-glass mt-6 py-2.5 rounded-lg text-sm w-full">
              Get started
            </button>
          </div>

          {/* Pro */}
          <div
            className="rounded-xl p-6 flex flex-col relative"
            style={{ background: 'linear-gradient(135deg,rgba(59,130,246,0.15),rgba(99,102,241,0.15))', border: '1px solid rgba(99,102,241,0.3)' }}
          >
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-xs font-semibold text-white"
              style={{ background: 'linear-gradient(90deg,#3b82f6,#6366f1)' }}>
              Most popular
            </div>
            <div className="text-xs font-mono text-blue-400 uppercase tracking-widest mb-2">Pro</div>
            <div className="text-3xl font-bold mb-1">$19<span className="text-base font-normal text-white/40">/mo</span></div>
            <div className="text-xs text-white/30 mb-1">or $190/yr (save $38)</div>
            <div className="text-xs text-emerald-400 mb-6">7-day free trial</div>
            <ul className="text-sm text-white/60 space-y-2 flex-1">
              <li>25 strategies</li>
              <li>50,000 shoes per backtest</li>
              <li>50 AI queries / day</li>
              <li>Full risk metrics</li>
              <li>Strategy versioning</li>
              <li>CSV shoe import</li>
              <li>Chart export</li>
            </ul>
            <button onClick={openSignUp} className="btn-primary mt-6 py-2.5 rounded-lg text-sm w-full">
              Start free trial
            </button>
          </div>

          {/* Lab */}
          <div className="glass-panel rounded-xl p-6 flex flex-col"
            style={{ border: '1px solid rgba(167,139,250,0.2)' }}>
            <div className="text-xs font-mono text-violet-400 uppercase tracking-widest mb-2">Lab</div>
            <div className="text-3xl font-bold mb-1">$49<span className="text-base font-normal text-white/40">/mo</span></div>
            <div className="text-xs text-white/30 mb-1">or $490/yr (save $98)</div>
            <div className="text-xs text-emerald-400 mb-6">7-day free trial</div>
            <ul className="text-sm text-white/60 space-y-2 flex-1">
              <li>Unlimited strategies</li>
              <li>1,000,000 shoes per backtest</li>
              <li>Unlimited AI queries</li>
              <li>Everything in Pro</li>
              <li>Auto-optimizer</li>
              <li>Pattern discovery engine</li>
              <li>Pattern reviewer</li>
            </ul>
            <button onClick={openSignUp} className="btn-glass mt-6 py-2.5 rounded-lg text-sm w-full"
              style={{ border: '1px solid rgba(167,139,250,0.3)', color: 'rgba(167,139,250,0.9)' }}>
              Start free trial
            </button>
          </div>
        </div>
      </section>

      {/* Feature comparison table */}
      <section className="max-w-4xl mx-auto px-6 pb-20">
        <h2 className="text-xl font-bold text-center mb-6">Full feature comparison</h2>
        <div className="glass-panel rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                <th className="text-left p-4 text-white/40 font-normal">Feature</th>
                <th className="p-4 text-white/40 font-normal">Free</th>
                <th className="p-4 text-blue-400 font-medium">Pro</th>
                <th className="p-4 text-violet-400 font-medium">Lab</th>
              </tr>
            </thead>
            <tbody>
              {FEATURES.map((f, i) => (
                <tr key={f.name} style={{ borderBottom: i < FEATURES.length - 1 ? '1px solid rgba(255,255,255,0.04)' : undefined }}>
                  <td className="p-4 text-white/60">{f.name}</td>
                  <td className="p-4 text-center"><TIER_CHECK val={f.free} /></td>
                  <td className="p-4 text-center"><TIER_CHECK val={f.pro} /></td>
                  <td className="p-4 text-center"><TIER_CHECK val={f.lab} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Footer */}
      <footer
        className="py-8 px-6 text-center text-xs text-white/20"
        style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}
      >
        <div className="flex flex-wrap justify-center gap-4 mb-4">
          <a href="/terms" className="hover:text-white/50 transition-colors">Terms</a>
          <a href="/privacy" className="hover:text-white/50 transition-colors">Privacy</a>
          <a href="/disclaimer" className="hover:text-white/50 transition-colors">Disclaimer</a>
          <a href="/cookies" className="hover:text-white/50 transition-colors">Cookies</a>
          <a href="/responsible-gambling" className="hover:text-white/50 transition-colors">Responsible Gambling</a>
        </div>
        <p>BetBacktest is a mathematical research tool. No betting system eliminates the house edge. 18+ only.</p>
        <p className="mt-1">Problem gambling helpline: 1-800-522-4700</p>
      </footer>

      {showAuth && <AuthModal mode={authMode} onClose={() => setShowAuth(false)} />}
    </div>
  )
}
