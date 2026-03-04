import React from 'react'
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'
import type { BacktestResults } from '../../types'

interface Props {
  results: BacktestResults
  previous?: BacktestResults | null
}

/** Normalize a metric to 0-100 score (higher = better) */
function normalize(
  value: number,
  min: number,
  max: number,
  invert = false
): number {
  const clipped = Math.max(min, Math.min(max, value))
  const normalized = ((clipped - min) / (max - min)) * 100
  return invert ? 100 - normalized : normalized
}

export const RiskMetrics: React.FC<Props> = ({ results, previous }) => {
  const m = results.metrics
  const p = previous?.metrics

  // Build radar data — each dimension scored 0-100
  const radarData = [
    {
      metric: 'Win Rate',
      current: normalize(m.win_rate * 100, 30, 55),
      previous: p ? normalize(p.win_rate * 100, 30, 55) : undefined,
    },
    {
      metric: 'Profit\nFactor',
      current: normalize(Math.min(m.profit_factor, 3), 0, 3),
      previous: p ? normalize(Math.min(p.profit_factor, 3), 0, 3) : undefined,
    },
    {
      metric: 'Sharpe',
      current: normalize(m.sharpe_ratio, -2, 3),
      previous: p ? normalize(p.sharpe_ratio, -2, 3) : undefined,
    },
    {
      metric: 'Low RoR',
      current: normalize(m.risk_of_ruin * 100, 0, 20, true),
      previous: p ? normalize(p.risk_of_ruin * 100, 0, 20, true) : undefined,
    },
    {
      metric: 'Low DD',
      current: normalize(
        (m.max_drawdown / results.config.starting_bankroll) * 100,
        0,
        80,
        true
      ),
      previous: p
        ? normalize(
            (p.max_drawdown / results.config.starting_bankroll) * 100,
            0,
            80,
            true
          )
        : undefined,
    },
    {
      metric: 'ROI',
      current: normalize((m.roi + 0.05) * 1000, 0, 100),
      previous: p ? normalize((p.roi + 0.05) * 1000, 0, 100) : undefined,
    },
  ]

  const hasPrevious = p !== undefined

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-mono text-slate-400 uppercase tracking-wide">
          Strategy Risk Profile
        </span>
        {hasPrevious && (
          <div className="flex items-center gap-3 text-[10px]">
            <span className="flex items-center gap-1">
              <span className="w-2 h-0.5 bg-blue-400 inline-block" />
              Current
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-0.5 bg-slate-500 inline-block" />
              Previous
            </span>
          </div>
        )}
      </div>

      <ResponsiveContainer width="100%" height={200}>
        <RadarChart data={radarData}>
          <PolarGrid stroke="#1e293b" />
          <PolarAngleAxis
            dataKey="metric"
            tick={{ fontSize: 9, fill: '#64748b' }}
          />
          <Tooltip
            formatter={(v: number) => [`${v.toFixed(1)}/100`, '']}
            contentStyle={{
              background: '#0f172a',
              border: '1px solid #334155',
              borderRadius: 8,
              fontSize: 11,
            }}
          />
          {hasPrevious && (
            <Radar
              name="Previous"
              dataKey="previous"
              stroke="#475569"
              fill="#475569"
              fillOpacity={0.1}
              strokeWidth={1}
              strokeDasharray="3 3"
            />
          )}
          <Radar
            name="Current"
            dataKey="current"
            stroke="#3b82f6"
            fill="#3b82f6"
            fillOpacity={0.15}
            strokeWidth={2}
          />
        </RadarChart>
      </ResponsiveContainer>

      {/* Overall score */}
      <div className="mt-2 text-center">
        {(() => {
          const score = Math.round(
            radarData.reduce((s, d) => s + d.current, 0) / radarData.length
          )
          const color =
            score >= 60 ? 'text-green-400' : score >= 40 ? 'text-yellow-400' : 'text-red-400'
          return (
            <>
              <div className={`text-2xl font-mono font-bold ${color}`}>{score}</div>
              <div className="text-[10px] text-slate-500">Overall Score / 100</div>
            </>
          )
        })()}
      </div>
    </div>
  )
}
