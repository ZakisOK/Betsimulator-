import React, { useState, useRef, useEffect } from 'react'
import { Send, Bot, User, Loader2, Trash2, Settings, CheckCircle, Zap } from 'lucide-react'
import { useStore } from '../../store/useStore'
import type { AgentMessage } from '../../types'

const QUICK_PROMPTS = [
  'What is the EV of this strategy?',
  'How risky is my progression system?',
  'Identify my weakest rules',
  'Calculate Kelly optimal sizing',
  'What is my per-shoe bust probability?',
]

function renderContent(text: string): React.ReactNode[] {
  const SECTION_COLORS: Record<string, string> = {
    'FINDING:':       'rgba(96,165,250,1)',
    'MATH:':          'rgba(167,139,250,1)',
    'IMPACT:':        'rgba(251,191,36,1)',
    'RECOMMENDATION:':'rgba(52,211,153,1)',
    'CONFIDENCE:':    'rgba(255,255,255,0.7)',
    'HONESTY SCORE:': 'rgba(251,146,60,1)',
  }

  return text.split('\n').map((line, i) => {
    // Bold section headers like **FINDING:**
    if (line.startsWith('**') && line.endsWith('**')) {
      const inner = line.slice(2,-2)
      const matchKey = Object.keys(SECTION_COLORS).find(k => inner.startsWith(k))
      if (matchKey) return (
        <div key={i} className="font-mono text-[10px] font-bold mt-3 mb-1" style={{ color: SECTION_COLORS[matchKey] }}>
          {inner}
        </div>
      )
    }
    if (line.startsWith('*[') && line.endsWith(']*')) return (
      <div key={i} className="text-[9px] italic mb-1" style={{ color:'rgba(255,255,255,0.3)' }}>{line.slice(1,-1)}</div>
    )
    if (line.startsWith('---')) return <div key={i} style={{ borderBottom:'1px solid rgba(255,255,255,0.08)', margin:'8px 0' }}/>
    if (line.startsWith('• ') || line.startsWith('- ') || line.startsWith('⚠ ')) {
      const isWarn = line.startsWith('⚠')
      return (
        <div key={i} className="flex gap-1.5 my-0.5">
          <span className="text-xs shrink-0" style={{ color: isWarn ? 'rgba(251,191,36,0.8)' : 'rgba(255,255,255,0.25)' }}>
            {isWarn ? '⚠' : '•'}
          </span>
          <span className="text-[10px] leading-relaxed" style={{ color:'rgba(255,255,255,0.7)' }}>{line.slice(2)}</span>
        </div>
      )
    }
    if (line.trim() === '') return <div key={i} className="h-1"/>
    return <p key={i} className="text-[10px] leading-relaxed" style={{ color:'rgba(255,255,255,0.65)' }}>{line}</p>
  })
}

const Bubble: React.FC<{ msg: AgentMessage }> = ({ msg }) => {
  const isUser = msg.role === 'user'
  return (
    <div className={`flex gap-2 ${isUser ? 'flex-row-reverse' : ''} animate-slide-in`}>
      <div className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center"
        style={isUser
          ? { background:'linear-gradient(135deg,rgba(59,130,246,0.5),rgba(99,102,241,0.5))', border:'1px solid rgba(99,102,241,0.4)' }
          : { background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)' }}>
        {isUser ? <User size={11}/> : <Bot size={11} style={{ color:'rgba(96,165,250,0.9)' }}/>}
      </div>

      <div className="flex-1 rounded-2xl px-3 py-2.5 max-w-[92%]"
        style={isUser
          ? { background:'rgba(59,130,246,0.15)', border:'1px solid rgba(59,130,246,0.2)' }
          : { background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)' }}>
        {isUser
          ? <p className="text-xs" style={{ color:'rgba(255,255,255,0.85)' }}>{msg.content}</p>
          : <div className="space-y-0.5">{renderContent(msg.content)}</div>
        }

        {/* Score badges */}
        {!isUser && (msg.metadata?.honesty_score !== undefined || msg.metadata?.confidence !== undefined) && (
          <div className="flex gap-2 mt-2 pt-2" style={{ borderTop:'1px solid rgba(255,255,255,0.06)' }}>
            {msg.metadata?.honesty_score !== undefined && (
              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded"
                style={{
                  background: msg.metadata.honesty_score > 60 ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.15)',
                  color:      msg.metadata.honesty_score > 60 ? 'rgba(248,113,113,0.9)' : 'rgba(74,222,128,0.9)',
                  border:     `1px solid ${msg.metadata.honesty_score > 60 ? 'rgba(239,68,68,0.2)' : 'rgba(34,197,94,0.2)'}`,
                }}>
                Honesty {msg.metadata.honesty_score}/100
              </span>
            )}
            {msg.metadata?.confidence !== undefined && (
              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded"
                style={{ background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)', color:'rgba(255,255,255,0.4)' }}>
                Confidence {msg.metadata.confidence}/100
              </span>
            )}
          </div>
        )}
        <div className="text-[8px] mt-1" style={{ color:'rgba(255,255,255,0.2)' }}>
          {new Date(msg.timestamp).toLocaleTimeString()}
        </div>
      </div>
    </div>
  )
}

export const MathAgent: React.FC = () => {
  const { agentMessages, isAgentThinking, backtestResults, sendMessage, clearAgentMessages } = useStore()
  const [input, setInput]             = useState('')
  const [showConfig, setShowConfig]   = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef       = useRef<HTMLTextAreaElement>(null)

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior:'smooth' }) }, [agentMessages, isAgentThinking])

  const handleSend = async () => {
    const msg = input.trim(); if (!msg) return
    setInput('')
    await sendMessage(msg)
    inputRef.current?.focus()
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 shrink-0" style={{ borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-xl flex items-center justify-center"
              style={{ background:'rgba(99,102,241,0.2)', border:'1px solid rgba(99,102,241,0.3)', boxShadow:'0 0 12px rgba(99,102,241,0.2)' }}>
              <Bot size={13} style={{ color:'rgba(167,139,250,0.9)' }}/>
            </div>
            <div>
              <div className="text-xs font-bold text-white/90">Math Agent</div>
              <div className="text-[9px]" style={{ color:'rgba(255,255,255,0.3)' }}>Baccarat Mathematics Expert</div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {backtestResults
              ? <span className="text-[9px] text-emerald-400 flex items-center gap-0.5 font-mono"><CheckCircle size={8}/>loaded</span>
              : <span className="text-[9px]" style={{ color:'rgba(255,255,255,0.2)' }}>no data</span>
            }
            <button onClick={() => setShowConfig(!showConfig)}
              className="p-1.5 rounded-lg hover:bg-white/10 transition-all" style={{ color:'rgba(255,255,255,0.3)' }}>
              <Settings size={12}/>
            </button>
            <button onClick={clearAgentMessages} disabled={agentMessages.length===0}
              className="p-1.5 rounded-lg hover:bg-white/10 transition-all disabled:opacity-20" style={{ color:'rgba(255,255,255,0.3)' }}>
              <Trash2 size={12}/>
            </button>
          </div>
        </div>

        {showConfig && (
          <div className="mt-3 p-3 rounded-xl" style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)' }}>
            <p className="section-label mb-2">Agent Configuration</p>
            <p className="text-[9px] mb-2" style={{ color:'rgba(255,255,255,0.3)' }}>
              Works offline with built-in math engine. Run <code className="font-mono">node server.js</code> + set
              <code className="font-mono"> ANTHROPIC_API_KEY</code> in .env for Claude AI.
            </p>
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {agentMessages.length === 0 ? (
          <div className="text-center pt-6 pb-4">
            <div className="text-4xl mb-3 opacity-20">🧮</div>
            <p className="text-xs font-semibold mb-1" style={{ color:'rgba(255,255,255,0.5)' }}>Baccarat Mathematics Expert</p>
            <p className="text-[10px] mb-5" style={{ color:'rgba(255,255,255,0.25)' }}>
              EV calculations · Risk analysis · Progression math · Strategy optimization
            </p>
            <div className="space-y-1.5">
              {QUICK_PROMPTS.map(p => (
                <button key={p} onClick={() => sendMessage(p)}
                  className="w-full text-left px-3 py-2 rounded-xl text-[10px] transition-all"
                  style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.07)', color:'rgba(255,255,255,0.45)' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}>
                  <Zap size={8} className="inline mr-1.5 opacity-50"/>
                  {p}
                </button>
              ))}
            </div>
          </div>
        ) : (
          agentMessages.map(msg => <Bubble key={msg.id} msg={msg}/>)
        )}

        {isAgentThinking && (
          <div className="flex gap-2 animate-slide-in">
            <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
              style={{ background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)' }}>
              <Bot size={11} style={{ color:'rgba(96,165,250,0.9)' }}/>
            </div>
            <div className="px-3 py-2.5 rounded-2xl" style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)' }}>
              <div className="flex items-center gap-2 text-xs" style={{ color:'rgba(255,255,255,0.4)' }}>
                <Loader2 size={10} className="animate-spin"/>Calculating…
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef}/>
      </div>

      {/* Quick chips (when there are messages) */}
      {agentMessages.length > 0 && (
        <div className="px-4 pb-1 shrink-0">
          <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-hide">
            {QUICK_PROMPTS.slice(0,3).map(p => (
              <button key={p} onClick={() => sendMessage(p)} disabled={isAgentThinking}
                className="shrink-0 text-[9px] px-2 py-1 rounded-full transition-all whitespace-nowrap disabled:opacity-30"
                style={{ background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)', color:'rgba(255,255,255,0.4)' }}>
                {p.length > 38 ? p.slice(0,38)+'…' : p}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="px-4 pb-4 pt-2 shrink-0" style={{ borderTop:'1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex gap-2 items-end">
          <textarea ref={inputRef} value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key==='Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
            placeholder="Ask the math agent… (Enter to send)"
            rows={2} disabled={isAgentThinking}
            className="flex-1 px-3 py-2 text-xs resize-none rounded-xl transition-all disabled:opacity-50"
            style={{
              background:'rgba(255,255,255,0.05)',
              border:'1px solid rgba(255,255,255,0.1)',
              color:'rgba(255,255,255,0.9)',
              outline:'none',
            }}
            onFocus={e => (e.currentTarget.style.borderColor = 'rgba(99,102,241,0.5)')}
            onBlur={e  => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)')}
          />
          <button onClick={handleSend} disabled={!input.trim() || isAgentThinking}
            className="p-2.5 rounded-xl transition-all disabled:opacity-30 shrink-0"
            style={{ background:'linear-gradient(135deg,rgba(59,130,246,0.8),rgba(99,102,241,0.8))', border:'1px solid rgba(99,102,241,0.4)' }}>
            {isAgentThinking ? <Loader2 size={14} className="animate-spin"/> : <Send size={14}/>}
          </button>
        </div>
        <p className="text-[8px] text-center mt-1.5" style={{ color:'rgba(255,255,255,0.15)' }}>
          Mathematical analysis only · House edge cannot be eliminated
        </p>
      </div>
    </div>
  )
}
