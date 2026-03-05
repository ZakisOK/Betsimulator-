import React from 'react'
import type { BacktestResults } from '../../types'

interface Props { results: BacktestResults; previous?: BacktestResults | null }

interface TileProps { label: string; value: string; sub?: string; color: string; delta?: number }

const Tile: React.FC<TileProps> = ({ label, value, sub, color, delta }) => (
  <div className="glass-metric p-2.5">
    <div className="section-label mb-1.5">{label}</div>
    <div className={`text-sm font-mono font-bold ${color}`}>{value}</div>
    {sub && <div className="text-[9px] text-white/30 mt-0.5">{sub}</div>}
    {delta !== undefined && (
      <div className={`text-[9px] font-mono mt-0.5 ${delta >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
        {delta >= 0 ? '▲' : '▼'} {Math.abs(delta).toFixed(2)}
      </div>
    )}
  </div>
)

const G = (v: number, goodAbove?: number, goodBelow?: number) =>
  goodAbove !== undefined ? (v >= goodAbove ? 'text-emerald-400' : 'text-red-400') :
  goodBelow !== undefined ? (v <= goodBelow ? 'text-emerald-400' : 'text-red-400') :
  v >= 0 ? 'text-emerald-400' : 'text-red-400'

const SEC = (label: string) => (
  <p className="section-label mb-2 mt-1">{label}</p>
)

export const MetricsPanel: React.FC<Props> = ({ results, previous }) => {
  const m = results.metrics, p = previous?.metrics
  const d = (a: number, b: number|undefined) => b !== undefined ? a - b : undefined

  return (
    <div className="space-y-3">
      {SEC('Core Financial')}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
        <Tile label="Net P&L"      value={`${m.net_pnl>=0?'+':''}$${Math.abs(m.net_pnl).toFixed(0)}`}          color={G(m.net_pnl)}     sub={`${results.config.num_shoes.toLocaleString()} shoes`} delta={d(m.net_pnl, p?.net_pnl)}/>
        <Tile label="ROI"          value={`${(m.roi*100).toFixed(3)}%`}                                          color={G(m.roi)}          sub="of wagered"              delta={p ? (m.roi-p.roi)*100 : undefined}/>
        <Tile label="Win Rate"     value={`${(m.win_rate*100).toFixed(2)}%`}                                     color={G(m.win_rate,0.45)} sub={`${m.total_wins.toLocaleString()} wins`}/>
        <Tile label="EV / Hand"    value={`${m.ev_per_hand>=0?'+':''}$${m.ev_per_hand.toFixed(4)}`}             color={G(m.ev_per_hand)}  sub="per hand dealt"/>
        <Tile label="Profit Factor"value={isFinite(m.profit_factor) ? m.profit_factor.toFixed(3) : '∞'}         color={G(m.profit_factor,1)} sub="wins ÷ losses"/>
        <Tile label="Avg Bet"      value={`$${m.avg_bet_size.toFixed(2)}`}                                       color="text-white/80"     sub="per hand"/>
      </div>

      {SEC('Risk')}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
        <Tile label="Max Drawdown" value={`$${m.max_drawdown.toFixed(0)}`}
          color={m.max_drawdown > results.config.starting_bankroll*0.3 ? 'text-red-400' : 'text-amber-400'}
          sub={`${((m.max_drawdown/results.config.starting_bankroll)*100).toFixed(1)}%`}/>
        <Tile label="DD Duration"  value={`${m.max_drawdown_duration}`}          color="text-white/80" sub="shoes"/>
        <Tile label="Risk of Ruin" value={`${(m.risk_of_ruin*100).toFixed(3)}%`}
          color={m.risk_of_ruin>0.05?'text-red-400':m.risk_of_ruin>0.01?'text-amber-400':'text-emerald-400'}
          sub="bankroll→0"/>
        <Tile label="Sharpe"   value={m.sharpe_ratio.toFixed(3)}
          color={m.sharpe_ratio>1?'text-emerald-400':m.sharpe_ratio>0?'text-amber-400':'text-red-400'}
          sub="risk-adj return"/>
        <Tile label="Sortino"  value={m.sortino_ratio.toFixed(3)}
          color={m.sortino_ratio>1?'text-emerald-400':m.sortino_ratio>0?'text-amber-400':'text-red-400'}
          sub="downside risk"/>
        <Tile label="Kelly %"  value={`${(m.kelly_fraction*100).toFixed(2)}%`} color="text-blue-400" sub="optimal fraction"/>
      </div>

      {SEC('Streaks & Distribution')}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
        <Tile label="Max Win Streak"  value={`${m.winning_streak_max}`}                  color="text-emerald-400" sub="consecutive"/>
        <Tile label="Max Loss Streak" value={`${m.losing_streak_max}`}                   color="text-red-400"     sub="consecutive"/>
        <Tile label="Skipped Hands"   value={m.skipped_hands.toLocaleString()}            color="text-white/50"    sub="no bet"/>
        <Tile label="Banker Bets"     value={m.banker_bet_count.toLocaleString()}         color="text-blue-400"
          sub={`${m.total_hands>0?((m.banker_bet_count/m.total_hands)*100).toFixed(1):0}%`}/>
        <Tile label="Player Bets"     value={m.player_bet_count.toLocaleString()}         color="text-red-400"
          sub={`${m.total_hands>0?((m.player_bet_count/m.total_hands)*100).toFixed(1):0}%`}/>
        <Tile label="Wagered"         value={`$${(m.total_wagered/1000).toFixed(0)}K`}   color="text-white/80"    sub="gross"/>
      </div>

      {/* Outcome distribution bar */}
      <div className="glass-metric p-3">
        <p className="section-label mb-2">Outcome Distribution (all hands)</p>
        <div className="space-y-2">
          {[
            { label:'Banker', pct: m.total_hands>0 ? (m.banker_win_count/m.total_hands)*100 : 0, color:'#3b82f6', expected:45.86 },
            { label:'Player', pct: m.total_hands>0 ? (m.player_win_count/m.total_hands)*100 : 0, color:'#ef4444', expected:44.62 },
            { label:'Tie',    pct: m.total_hands>0 ? (m.tie_count/m.total_hands)*100 : 0,         color:'#22c55e', expected:9.52  },
          ].map(s => (
            <div key={s.label}>
              <div className="flex justify-between text-[10px] mb-1">
                <span className="font-mono" style={{ color: s.color }}>{s.label}</span>
                <div className="flex gap-2 font-mono">
                  <span className="text-white/70">{s.pct.toFixed(2)}%</span>
                  <span style={{ color: Math.abs(s.pct-s.expected) < 0.5 ? 'rgba(34,197,94,0.7)' : 'rgba(245,158,11,0.7)' }}>
                    ({s.pct > s.expected ? '+' : ''}{(s.pct-s.expected).toFixed(2)}%)
                  </span>
                </div>
              </div>
              <div className="w-full h-1.5 rounded-full" style={{ background:'rgba(255,255,255,0.08)' }}>
                <div className="h-full rounded-full" style={{ width:`${Math.min(100,s.pct/50*100)}%`, background:s.color, opacity:0.7 }}/>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
