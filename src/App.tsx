import { useState, useEffect, useRef, useCallback } from 'react'
import mermaid from 'mermaid'
import pako from 'pako'
import { getVersionString } from './versionConfig'
import { ThemeToggle } from './ThemeToggle'

mermaid.initialize({
  startOnLoad: true,
  theme: 'neutral',
  securityLevel: 'loose',
  fontFamily: 'var(--sans)',
})

const sanitizeMermaid = (code: string): string => {
  if (!code) return ''
  let cleaned = code
    .split('\n')
    .map(line => line.trimEnd().replace(/;$/, ''))
    .join('\n')
    .replace(/-->\s*\|([^|]+)\|\s*>/g, '-->|$1|')
    .replace(/--\s*"([^"]+)"\s*-->/g, '-->|$1|')

  // Auto-wrap unquoted node labels in double quotes to prevent syntax errors on spaces
  cleaned = cleaned.replace(/\b([A-Za-z0-9_]+)\[([^"\]]+)\]/g, '$1["$2"]')
  cleaned = cleaned.replace(/\b([A-Za-z0-9_]+)\(([^"\)]+)\)/g, '$1("$2")')
  cleaned = cleaned.replace(/\b([A-Za-z0-9_]+)\{([^"\}]+)\}/g, '$1{"$2"}')

  return cleaned
}

const BrandMark = ({ compact = false }: { compact?: boolean }) => (
  <div
    className={`relative flex shrink-0 items-center justify-center rounded-lg bg-slate-950 text-white shadow-lg shadow-blue-900/20 ring-1 ring-slate-700/60 dark:bg-slate-900 ${
      compact ? 'h-8 w-8' : 'h-10 w-10'
    }`}
    aria-hidden="true"
  >
    <svg className={compact ? 'h-6 w-6' : 'h-7 w-7'} viewBox="0 0 40 40" fill="none">
      <path
        d="M10 23.5C7.8 23.5 6 21.7 6 19.5C6 17.6 7.3 16 9.1 15.6C9.9 12.7 12.6 10.5 15.8 10.5C18 10.5 20.1 11.6 21.4 13.3C22.2 12.9 23.1 12.7 24.1 12.7C27.4 12.7 30 15.3 30 18.6C32.3 18.8 34 20.7 34 23C34 25.5 32 27.5 29.5 27.5H10Z"
        className="fill-slate-800 stroke-slate-300 dark:fill-slate-950 dark:stroke-slate-400"
        strokeWidth="1.8"
      />
      <path d="M14 25.5L20 31L26 25.5M20 18V30.5" className="stroke-blue-400" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="14" cy="25.5" r="2.2" className="fill-cyan-300" />
      <circle cx="20" cy="18" r="2.2" className="fill-blue-400" />
      <circle cx="26" cy="25.5" r="2.2" className="fill-indigo-300" />
    </svg>
  </div>
)

const Mermaid = ({ chart, onError }: { chart: string; onError?: (error: string | null) => void }) => {
  const ref = useRef<HTMLDivElement>(null)
  const renderCycle = useRef(0)
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })

  useEffect(() => {
    if (!ref.current) return
    const observer = new ResizeObserver((entries) => {
      if (entries[0]) {
        const { width, height } = entries[0].contentRect
        setDimensions({ width, height })
      }
    })
    observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const cycle = ++renderCycle.current
    if (ref.current && chart) {
      const renderDiagram = async () => {
        try {
          ref.current?.removeAttribute('data-processed')
          const sanitizedChart = sanitizeMermaid(chart)
          const { svg } = await mermaid.render(
            'mermaid-svg-' + Math.random().toString(36).substring(2, 11),
            sanitizedChart
          )
          if (ref.current && cycle === renderCycle.current) {
            ref.current.innerHTML = svg
            onError?.(null)
          }
        } catch (err) {
          if (cycle === renderCycle.current) {
            console.error('Mermaid render error:', err)
            onError?.('Invalid Mermaid Syntax: Please check your code structure.')
          }
        }
      }
      renderDiagram()
    } else if (ref.current && !chart) {
      ref.current.innerHTML = ''
      onError?.(null)
    }
  }, [chart, onError, dimensions])

  return <div ref={ref} className="flex h-full w-full justify-center" />
}

interface AppState {
  input: string
  chart: string
  messages: { role: 'user' | 'assistant'; content: string }[]
  mode: 'default' | 'architecture'
}

const compressState = (state: AppState) => {
  try {
    const json = JSON.stringify(state)
    const compressed = pako.deflate(json)
    return btoa(String.fromCharCode(...compressed))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')
  } catch {
    return ''
  }
}

const decompressState = (str: string): AppState | null => {
  try {
    const base64 = str.replace(/-/g, '+').replace(/_/g, '/')
    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i)
    }
    const inflated = pako.inflate(bytes, { to: 'string' })
    return JSON.parse(inflated)
  } catch {
    return null
  }
}

const INITIAL_CHART = 'graph TD\n    A[Cloud Front] --> B[Edge Worker]\n    B --> C[Vector Database]\n    B --> D[Static Assets]'

const getInitialState = () => {
  if (typeof window === 'undefined') return null
  const params = new URLSearchParams(window.location.search)
  const stateStr = params.get('state')
  if (stateStr) {
    return decompressState(stateStr)
  }
  return null
}

const urlState = getInitialState()

function App() {
  const [input, setInput] = useState(urlState?.input || '')
  const [chart, setChart] = useState(urlState?.chart || INITIAL_CHART)
  const [renderedChart, setRenderedChart] = useState(chart)
  const [isLoading, setIsLoading] = useState(false)
  const [mode, setMode] = useState<'default' | 'architecture'>(urlState?.mode || 'default')
  const [isDrawerOpen, setIsDrawerOpen] = useState(true)
  const [showShareTooltip, setShowShareTooltip] = useState(false)
  const [renderError, setRenderError] = useState<string | null>(null)
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>(() => {
    if (urlState?.messages) return urlState.messages
    return [{ role: 'assistant', content: 'Welcome! Describe the architecture you want to build, or choose an example to get started.' }]
  })

  const generationRequestRef = useRef(0)

  useEffect(() => {
    const timer = setTimeout(() => {
      setRenderedChart(chart)
    }, 300)
    return () => clearTimeout(timer)
  }, [chart])

  const shareBlueprint = useCallback(() => {
    const appState: AppState = {
      input,
      chart,
      messages,
      mode,
    }
    const stateStr = compressState(appState)
    const url = `${window.location.origin}${window.location.pathname}?state=${stateStr}`

    window.history.replaceState({}, '', url)
    navigator.clipboard.writeText(url)
    setShowShareTooltip(true)
    setTimeout(() => setShowShareTooltip(false), 2000)
  }, [input, chart, messages, mode])

  const handleGenerate = async () => {
    const instruction = input.trim()
    if (!instruction) return

    const requestId = ++generationRequestRef.current
    setIsLoading(true)
    const newMessages = [...messages, { role: 'user' as const, content: instruction }]
    setMessages(newMessages)
    setInput('')

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          current_code: chart,
          instruction,
          mode,
          messages: newMessages
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `Server responded with ${response.status}`)
      }

      const data = await response.json()
      if (requestId !== generationRequestRef.current) return

      if (data.chart) {
        const cleanChart = sanitizeMermaid(
          data.chart
            .replace(/```mermaid\n?/g, '')
            .replace(/```\n?/g, '')
            .trim()
        )

        setChart(cleanChart)
        setMessages([...newMessages, { role: 'assistant', content: mode === 'architecture' ? 'Architecture simplified and updated.' : 'Blueprint updated successfully.' }])
      }
    } catch (error) {
      if (requestId !== generationRequestRef.current) return

      const message = error instanceof Error ? error.message : 'An unknown error occurred'
      console.error('Generation error:', error)
      setMessages([...newMessages, { role: 'assistant', content: `Error: ${message}` }])
    } finally {
      if (requestId === generationRequestRef.current) {
        setIsLoading(false)
      }
    }
  }

  const resetWorkspace = useCallback(() => {
    generationRequestRef.current += 1
    setInput('')
    setChart('')
    setRenderedChart('')
    setMessages([])
    setIsLoading(false)
    setRenderError(null)
    setShowShareTooltip(false)

    if (typeof window !== 'undefined' && window.location.search) {
      window.history.replaceState({}, '', `${window.location.origin}${window.location.pathname}`)
    }
  }, [])

  const copyToClipboard = useCallback(() => {
    navigator.clipboard.writeText(chart)
  }, [chart])

  const exportSVG = useCallback(() => {
    const svgElement = document.querySelector('.mermaid-container svg') as SVGElement
    if (!svgElement) return

    try {
      const clonedSvg = svgElement.cloneNode(true) as SVGElement
      const styleTags = document.querySelectorAll('style[id^="mermaid-"]')
      let combinedStyles = ''
      styleTags.forEach(tag => {
        combinedStyles += tag.innerHTML
      })

      combinedStyles += `
        svg { background-color: white; }
        text, .node label, .edgeLabel, .cluster-label { fill: #0f172a !important; color: #0f172a !important; }
        foreignObject { overflow: visible !important; }
      `

      const style = document.createElementNS('http://www.w3.org/2000/svg', 'style')
      style.innerHTML = combinedStyles
      clonedSvg.insertBefore(style, clonedSvg.firstChild)

      const serializer = new XMLSerializer()
      const svgString = serializer.serializeToString(clonedSvg)
      const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'architecture.svg'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Export error:', err)
    }
  }, [])

  const diagramDirection = (() => {
    const match = chart.match(/^(?:flowchart|graph)\s+([A-Z]+)/m)
    return match?.[1] || 'TD'
  })()

  const buildLabel = getVersionString()
  const commandBarError = Boolean(renderError)
  const connectionState = isLoading ? 'SYNCING' : renderError ? 'FAULT' : 'CONNECTED'

  return (
    <div className="relative min-h-screen-dvh overflow-hidden bg-[#05070B] text-slate-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.08)_1px,transparent_0)] bg-[length:22px_22px]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.08)_1px,transparent_1px)] bg-[length:88px_88px]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_12%,rgba(34,211,238,0.10),transparent_22%),radial-gradient(circle_at_82%_24%,rgba(99,102,241,0.08),transparent_18%)]" />

      <main className={`absolute inset-0 mermaid-container overflow-auto transition-[padding] duration-300 ${isDrawerOpen ? 'pr-[420px]' : 'pr-4'}`}>
        <div className="flex min-h-full min-w-full items-center justify-center px-8 pt-24 pb-44">
          <Mermaid chart={renderedChart} onError={setRenderError} />
        </div>
      </main>

      <section className="pointer-events-none fixed left-4 top-4 z-30 w-[min(360px,calc(100vw-2rem))]">
        <div className="pointer-events-auto rounded-2xl border border-slate-800/80 bg-slate-950/72 px-4 py-3 shadow-2xl shadow-black/30 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <BrandMark compact />
            <div className="min-w-0">
              <div className="text-sm font-semibold tracking-tight text-white">WAY2GO.CLOUD</div>
              <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-cyan-200/55">Tactical Blueprint HUD</div>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-[78px_1fr] gap-x-3 gap-y-1 font-mono text-[10px] uppercase tracking-[0.22em]">
            <span className="text-slate-500">SYS.DIR:</span>
            <span className="text-slate-100">[{diagramDirection}]</span>
            <span className="text-slate-500">STATE:</span>
            <span className={isLoading ? 'text-cyan-200' : renderError ? 'text-amber-200' : 'text-emerald-200'}>[{connectionState}]</span>
            <span className="text-slate-500">BUILD:</span>
            <span className="text-slate-100">[{buildLabel}]</span>
          </div>
        </div>
      </section>

      <section className="pointer-events-none fixed right-4 top-4 z-30 w-[min(330px,calc(100vw-2rem))]">
        <div className="pointer-events-auto rounded-2xl border border-slate-800/80 bg-slate-950/72 px-3 py-3 shadow-2xl shadow-black/30 backdrop-blur-md">
          <div className="grid grid-cols-[72px_1fr] items-center gap-x-3 gap-y-2 font-mono text-[10px] uppercase tracking-[0.22em]">
            <span className="text-slate-500">MODE</span>
            <button
              onClick={() => setMode(mode === 'default' ? 'architecture' : 'default')}
              className={`justify-self-end rounded-md border px-2 py-1 text-[10px] font-bold tracking-[0.18em] transition-colors ${
                mode === 'architecture'
                  ? 'border-cyan-400/30 bg-cyan-400/15 text-cyan-100'
                  : 'border-slate-700/70 bg-slate-900/70 text-slate-300 hover:bg-slate-800'
              }`}
            >
              {mode === 'architecture' ? 'ARCH' : 'STD'}
            </button>
            <span className="text-slate-500">DRAWER</span>
            <button
              onClick={() => setIsDrawerOpen((value) => !value)}
              className="justify-self-end rounded-md border border-slate-700/70 bg-slate-900/70 px-2 py-1 text-[10px] font-bold tracking-[0.18em] text-slate-300 transition-colors hover:bg-slate-800"
            >
              {isDrawerOpen ? 'OPEN' : 'HIDDEN'}
            </button>
            <span className="text-slate-500">SHARE</span>
            <button
              onClick={shareBlueprint}
              className="justify-self-end rounded-md border border-slate-700/70 bg-slate-900/70 px-2 py-1 text-[10px] font-bold tracking-[0.18em] text-slate-300 transition-colors hover:bg-slate-800"
            >
              SEND
            </button>
            <span className="text-slate-500">CLEAR</span>
            <button
              onClick={resetWorkspace}
              className="justify-self-end rounded-md border border-slate-700/70 bg-slate-900/70 px-2 py-1 text-[10px] font-bold tracking-[0.18em] text-slate-300 transition-colors hover:bg-slate-800"
            >
              PURGE
            </button>
            <span className="text-slate-500">THEME</span>
            <div className="justify-self-end">
              <ThemeToggle />
            </div>
            <span className="text-slate-500">COPY</span>
            <button
              onClick={copyToClipboard}
              className="justify-self-end rounded-md border border-slate-700/70 bg-slate-900/70 px-2 py-1 text-[10px] font-bold tracking-[0.18em] text-slate-300 transition-colors hover:bg-slate-800"
            >
              PASTE
            </button>
            <span className="text-slate-500">EXPORT</span>
            <button
              onClick={exportSVG}
              className="justify-self-end rounded-md border border-slate-700/70 bg-slate-900/70 px-2 py-1 text-[10px] font-bold tracking-[0.18em] text-slate-300 transition-colors hover:bg-slate-800"
            >
              SVG
            </button>
          </div>
          {showShareTooltip && (
            <div className="mt-2 text-right font-mono text-[10px] uppercase tracking-[0.22em] text-cyan-200/70">
              LINK COPIED
            </div>
          )}
        </div>
      </section>

      <aside
        className={`fixed right-0 top-0 z-40 h-full w-[400px] max-w-[calc(100vw-1rem)] bg-[rgba(0,0,0,0.2)] shadow-2xl shadow-black/40 backdrop-blur-xl transition-transform duration-300 ${
          isDrawerOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between px-4 py-3">
            <div>
              <div className="text-sm font-semibold text-slate-100">RAW MERMAID</div>
              <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">Blueprint Overlay</div>
            </div>
            <button
              onClick={() => setIsDrawerOpen(false)}
              className="rounded-md border border-slate-800/70 bg-slate-950/60 p-2 text-slate-300 transition-colors hover:bg-slate-800"
              aria-label="Close code overlay"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          <textarea
            className="min-h-0 flex-1 resize-none border-0 bg-transparent p-4 font-mono text-[13px] leading-relaxed text-slate-300 outline-none placeholder:text-slate-600 selection:bg-cyan-400/20"
            spellCheck="false"
            value={chart}
            onChange={(e) => setChart(e.target.value)}
            placeholder="Enter Mermaid code manually..."
          />
          <div className="px-4 py-3 text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">
            {renderError ? 'SYNTAX FAULT' : 'MANUAL STUDIO MODE'}
          </div>
        </div>
      </aside>

      <button
        onClick={() => setIsDrawerOpen((value) => !value)}
        className={`fixed top-1/2 z-50 flex h-12 w-10 -translate-y-1/2 items-center justify-center rounded-l-xl border border-slate-800/80 bg-slate-950/75 text-slate-200 shadow-2xl shadow-black/40 backdrop-blur-md transition-all duration-300 hover:bg-slate-800 ${
          isDrawerOpen ? 'right-[400px]' : 'right-0'
        }`}
        aria-label="Toggle code overlay"
        title="Toggle code overlay"
      >
        <svg className={`h-5 w-5 transition-transform ${isDrawerOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 9l-3 3 3 3m8-6l3 3-3 3M13 5l-2 14" />
        </svg>
      </button>

      <form
        className={`pointer-events-auto fixed bottom-5 left-1/2 z-30 w-[min(1260px,calc(100vw-1rem))] -translate-x-1/2 rounded-2xl border bg-slate-950/75 p-3 shadow-2xl shadow-black/50 backdrop-blur-md ${
          commandBarError ? 'border-amber-600/80 shadow-[0_0_0_1px_rgba(217,119,6,0.35),0_24px_60px_rgba(0,0,0,0.45)]' : 'border-slate-800/80'
        }`}
        onSubmit={(e) => {
          e.preventDefault()
          handleGenerate()
        }}
      >
        <div className={`absolute inset-x-0 top-0 h-0.5 overflow-hidden rounded-t-2xl transition-opacity ${isLoading ? 'bg-gradient-to-r from-cyan-400 via-blue-500 to-fuchsia-500 opacity-100' : 'opacity-0'}`} />
        <div className="flex items-center gap-3">
          <div className="shrink-0 font-mono text-[10px] font-bold uppercase tracking-[0.28em] text-cyan-200/80">
            WAY2GO.CLOUD // CMD &gt;
          </div>
          <input
            className="min-w-0 flex-1 bg-transparent text-sm text-slate-100 placeholder:text-slate-500 outline-none"
            placeholder="Describe the architecture change..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-400 text-slate-950 shadow-lg shadow-cyan-500/30 transition-colors hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Generate architecture"
            title="Generate architecture"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M5 12h14m-6-6l6 6-6 6" />
            </svg>
          </button>
          <div className="min-w-0 max-w-[33%] truncate font-mono text-[10px] uppercase tracking-[0.2em] text-amber-200/80">
            {renderError ? renderError : isLoading ? 'SYNCING' : ''}
          </div>
        </div>
      </form>

      <div className="pointer-events-none fixed bottom-3 right-4 z-20 font-mono text-[10px] text-slate-500/60">
        {buildLabel} Enterprise Edition
      </div>
    </div>
  )
}

export default App
