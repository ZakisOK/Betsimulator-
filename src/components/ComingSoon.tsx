import React, { useState } from 'react'

export const ComingSoon: React.FC = () => {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitted(true)
  }

  return (
    <div className="min-h-screen bg-mesh text-white flex flex-col items-center justify-center px-6 text-center">
      <div
        className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl mb-6"
        style={{ background: 'linear-gradient(135deg,rgba(59,130,246,0.4),rgba(99,102,241,0.4))', border: '1px solid rgba(99,102,241,0.4)' }}
      >
        🎴
      </div>

      <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-3">
        BetBacktest
      </h1>
      <p className="text-lg text-white/50 max-w-md mb-2">
        Backtest baccarat strategies with AI. Run millions of simulated shoes. Know the truth.
      </p>
      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono text-blue-400 mb-10"
        style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)' }}>
        Launching soon
      </div>

      {submitted ? (
        <p className="text-emerald-400 text-sm">You're on the list. We'll be in touch.</p>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2 w-full max-w-sm">
          <input
            type="email"
            required
            placeholder="Enter your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input-glass flex-1 px-4 py-2.5 rounded-lg text-sm"
          />
          <button
            type="submit"
            className="btn-primary px-5 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap"
          >
            Notify me
          </button>
        </form>
      )}

      <p className="text-xs text-white/20 mt-12">
        Banker EV −1.06% · Player EV −1.24% · Tie EV −14.36%
      </p>
    </div>
  )
}
