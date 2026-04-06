import { useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useStore } from '../store/useStore'

export function useAuth() {
  const { setUser, setSession, setAuthLoading } = useStore()

  useEffect(() => {
    // Initial session check
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session)
      if (session) {
        try {
          await loadProfile(session.user.id)
          await updateLastSignIn(session.user.id)
          migrateLocalStorage()
        } catch {
          // Fallback: set user from session so we never get stuck on loading
          setUser({
            id: session.user.id,
            email: session.user.email ?? '',
            display_name: session.user.user_metadata?.full_name ?? null,
            avatar_url: session.user.user_metadata?.avatar_url ?? null,
            subscription_tier: 'free',
            subscription_status: 'none',
            subscription_ends_at: null,
            ai_queries_today: 0,
            lemon_subscription_id: null,
          })
        }
      }
      setAuthLoading(false)
    }).catch(() => setAuthLoading(false))

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      setSession(session)

      if (event === 'SIGNED_IN' && session) {
        try {
          await loadProfile(session.user.id)
          await updateLastSignIn(session.user.id)
          migrateLocalStorage()
        } catch {
          setUser({
            id: session.user.id,
            email: session.user.email ?? '',
            display_name: session.user.user_metadata?.full_name ?? null,
            avatar_url: session.user.user_metadata?.avatar_url ?? null,
            subscription_tier: 'free',
            subscription_status: 'none',
            subscription_ends_at: null,
            ai_queries_today: 0,
            lemon_subscription_id: null,
          })
        }
        setAuthLoading(false)
      }

      if (event === 'SIGNED_OUT') {
        setUser(null)
        setSession(null)
        setAuthLoading(false)
      }

      if (event === 'TOKEN_REFRESHED' && session) {
        await loadProfile(session.user.id)
      }
    })

    return () => subscription.unsubscribe()
  }, [setUser, setSession, setAuthLoading])

  async function loadProfile(userId: string) {
    const { data: { session } } = await supabase.auth.getSession()

    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (profile) {
      // Client-side AI query reset if date has changed
      const today = new Date().toISOString().split('T')[0]
      if (profile.ai_queries_reset_at < today) {
        await supabase
          .from('profiles')
          .update({ ai_queries_today: 0, ai_queries_reset_at: today })
          .eq('id', userId)
        profile.ai_queries_today = 0
        profile.ai_queries_reset_at = today
      }

      setUser({
        id: profile.id,
        email: profile.email,
        display_name: profile.display_name,
        avatar_url: profile.avatar_url,
        subscription_tier: profile.subscription_tier,
        subscription_status: profile.subscription_status,
        subscription_ends_at: profile.subscription_ends_at,
        ai_queries_today: profile.ai_queries_today,
        lemon_subscription_id: profile.lemon_subscription_id,
      })
    } else if (session?.user) {
      // Profile query failed (RLS or timing) — fall back to session data
      setUser({
        id: session.user.id,
        email: session.user.email ?? '',
        display_name: session.user.user_metadata?.full_name ?? null,
        avatar_url: session.user.user_metadata?.avatar_url ?? null,
        subscription_tier: 'free',
        subscription_status: 'none',
        subscription_ends_at: null,
        ai_queries_today: 0,
        lemon_subscription_id: null,
      })
    }
  }

  async function updateLastSignIn(userId: string) {
    await supabase
      .from('profiles')
      .update({ last_sign_in: new Date().toISOString() })
      .eq('id', userId)
  }

  function migrateLocalStorage() {
    // Check for legacy localStorage data from before auth was added
    const legacy = localStorage.getItem('baccarat-dashboard')
    if (!legacy) return

    try {
      const parsed = JSON.parse(legacy) as { state?: { savedStrategies?: unknown[] } }
      const strategies = parsed?.state?.savedStrategies ?? []
      if (strategies.length > 0) {
        // Show migration prompt — handled in App.tsx via store flag
        useStore.setState({ pendingMigration: strategies as import('../types').Strategy[] })
      }
    } catch {
      // Invalid JSON — clear it
      localStorage.removeItem('baccarat-dashboard')
    }
  }
}
