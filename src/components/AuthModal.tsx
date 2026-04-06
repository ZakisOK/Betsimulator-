import React, { useState } from 'react'
import { X, Loader2 } from 'lucide-react'
import { supabase } from '../lib/supabase'

interface Props {
  mode: 'sign_in' | 'sign_up'
  onClose: () => void
}

export const AuthModal: React.FC<Props> = ({ mode: initialMode, onClose }) => {
  const [mode, setMode] = useState(initialMode)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const callbackUrl = `${window.location.origin}/auth/callback`

  async function handleOAuth(provider: 'apple' | 'google' | 'facebook') {
    setLoading(provider)
    setError(null)
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: callbackUrl },
    })
    if (error) { setError(error.message); setLoading(null) }
  }

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault()
    setLoading('email')
    setError(null)

    if (mode === 'sign_up') {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: callbackUrl },
      })
      if (error) {
        setError(error.message)
      } else {
        setSuccess('Check your email for a confirmation link.')
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        setError(error.message)
      } else {
        onClose()
      }
    }
    setLoading(null)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="glass-elevated rounded-2xl p-6 w-full max-w-sm relative"
        style={{ border: '1px solid rgba(255,255,255,0.1)' }}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-white/30 hover:text-white/70 transition-colors"
        >
          <X size={16} />
        </button>

        <div className="flex items-center gap-2 mb-6">
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

        <h2 className="text-lg font-bold mb-1">
          {mode === 'sign_up' ? 'Create your account' : 'Welcome back'}
        </h2>
        <p className="text-xs text-white/40 mb-6">
          {mode === 'sign_up'
            ? 'Free forever. No credit card required.'
            : 'Sign in to your account.'}
        </p>

        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.08)' }} />
          <span className="text-xs text-white/25">or</span>
          <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.08)' }} />
        </div>

        {/* Email/password */}
        {success ? (
          <div className="text-sm text-emerald-400 text-center py-4">{success}</div>
        ) : (
          <form onSubmit={handleEmail} className="space-y-3">
            <input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="input-glass w-full px-3.5 py-2.5 rounded-lg text-sm"
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              className="input-glass w-full px-3.5 py-2.5 rounded-lg text-sm"
            />
            {error && <p className="text-xs text-red-400">{error}</p>}
            <button
              type="submit"
              disabled={!!loading}
              className="btn-primary w-full py-2.5 rounded-lg text-sm font-medium flex items-center justify-center gap-2"
            >
              {loading === 'email' && <Loader2 size={14} className="animate-spin" />}
              {mode === 'sign_up' ? 'Create account' : 'Sign in'}
            </button>
          </form>
        )}

        <p className="text-xs text-center text-white/30 mt-4">
          {mode === 'sign_up' ? 'Already have an account? ' : "Don't have an account? "}
          <button
            onClick={() => { setMode(mode === 'sign_up' ? 'sign_in' : 'sign_up'); setError(null); setSuccess(null) }}
            className="text-blue-400 hover:text-blue-300 transition-colors"
          >
            {mode === 'sign_up' ? 'Sign in' : 'Create one'}
          </button>
        </p>
      </div>
    </div>
  )
}
