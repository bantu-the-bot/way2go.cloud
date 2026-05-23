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
  if (!code) return '';
  return code
    .split('\n')
    .map(line => line.trimEnd().replace(/;$/, '')) // Remove trailing semicolons
    .join('\n')
    .replace(/-->\s*\|([^|]+)\|\s*>/g, '-->|$1|') // Fix malformed edge labels -->|label|>
    .replace(/--\s*"([^"]+)"\s*-->/g, '-->|$1|'); // Normalize legacy edge labels -- "label" -->
};

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

  // Redraw on resize to fix spacing collisions
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
          const sanitizedChart = sanitizeMermaid(chart);
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

  return <div ref={ref} className="flex justify-center w-full h-full" />
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
    // URL-safe Base64
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
    // Restore Base64
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

const INITIAL_CHART = 'graph TD\n    A[Cloud Front] --> B[Edge Worker]\n    B --> C[Vector Database]\n    B --> D[Static Assets]';

// Try to hydrate initial state from URL
const getInitialState = () => {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const stateStr = params.get('state');
  if (stateStr) {
    return decompressState(stateStr);
  }
  return null;
};

const urlState = getInitialState();

function App() {
  const [input, setInput] = useState(urlState?.input || '')
  const [chart, setChart] = useState(urlState?.chart || INITIAL_CHART)
  const [renderedChart, setRenderedChart] = useState(chart)
  const [isLoading, setIsLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'ai' | 'editor'>('ai')
  const [mode, setMode] = useState<'default' | 'architecture'>(urlState?.mode || 'default')
  const [showShareTooltip, setShowShareTooltip] = useState(false)
  const [renderError, setRenderError] = useState<string | null>(null)
  const [canvasZoom, setCanvasZoom] = useState(1)
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>(() => {
    if (urlState?.messages) return urlState.messages;
    return [{ role: 'assistant', content: 'Welcome! Describe the architecture you want to build, or choose an example to get started.' }];
  })
  
  const scrollRef = useRef<HTMLDivElement>(null)
  const generationRequestRef = useRef(0)

  // Debounce manual or AI edits to the rendered chart
  useEffect(() => {
    const timer = setTimeout(() => {
      setRenderedChart(chart)
    }, 300) // 300ms as requested
    return () => clearTimeout(timer)
  }, [chart])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const [examples] = useState([
    {
      id: 1,
      title: 'E-Commerce Order Journey',
      category: 'Process Flow',
      inputText: 'A customer places an order online. The payment is approved. The warehouse packs the items. The courier picks up the package. The package is delivered to the customer\'s doorstep.',
      chartState: 'graph LR\n    A["Order Placed"] --> B["Payment Approved"]\n    B --> C["Warehouse Packing"]\n    C --> D["Courier Pickup"]\n    D --> E["Delivered"]'
    },
    {
      id: 2,
      title: 'Morning Routine Logic',
      category: 'Decision Tree',
      inputText: 'Wake up at 6 AM. Check energy levels. If feeling tired, drink a glass of water and stretch for 5 minutes. If feeling alert, go straight to making coffee. Afterward, brush teeth, eat breakfast, and start the workday.',
      chartState: 'graph TD\n    A["Wake up at 6 AM"] --> B{"Feeling Tired?"}\n    B -->|Yes| C["Water & Stretch"]\n    B -->|No| D["Make Coffee"]\n    C --> E["Brush Teeth"]\n    D --> E\n    E --> F["Eat Breakfast"]\n    F --> G["Start Workday"]'
    },
    {
      id: 3,
      title: 'Product Launch Strategy',
      category: 'Mind Map',
      inputText: 'Our Core Marketing Strategy splits into three main channels: Social Media, Content Marketing, and Paid Ads. Under Social Media, we will target TikTok and Instagram. Content Marketing will consist of weekly Blogs and Newsletters. Paid Ads will run on Google and Meta.',
      chartState: 'graph TD\n    Core["Product Launch"] --> SM["Social Media"]\n    Core --> CM["Content Marketing"]\n    Core --> PA["Paid Ads"]\n    SM --> TikTok["TikTok"]\n    SM --> IG["Instagram"]\n    CM --> Blogs["Blogs"]\n    CM --> NL["Newsletters"]\n    PA --> Google["Google"]\n    PA --> Meta["Meta"]'
    }
  ])

  const shareBlueprint = useCallback(() => {
    const appState: AppState = {
      input,
      chart,
      messages,
      mode
    };
    const stateStr = compressState(appState);
    const url = `${window.location.origin}${window.location.pathname}?state=${stateStr}`;
    
    // Update URL without refreshing to reflect the shared state
    window.history.replaceState({}, '', url);
    
    navigator.clipboard.writeText(url);
    setShowShareTooltip(true);
    setTimeout(() => setShowShareTooltip(false), 2000);
  }, [input, chart, messages, mode]);

  const loadExample = (example: typeof examples[0]) => {
    setInput('')
    setChart(example.chartState)
    setMessages([
      { role: 'assistant', content: `Loaded example: **${example.title}**` },
      { role: 'user', content: example.inputText }
    ])
    setActiveTab('ai')
  }

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
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Server responded with ${response.status}`);
      }

      const data = await response.json()
      if (requestId !== generationRequestRef.current) return

      if (data.chart) {
        // Robust Frontend Sanitization
        let cleanChart = data.chart;
        cleanChart = cleanChart.replace(/```mermaid\n?/g, '');
        cleanChart = cleanChart.replace(/```\n?/g, '');
        cleanChart = cleanChart.trim();

        setChart(sanitizeMermaid(cleanChart))
        setMessages([...newMessages, { role: 'assistant', content: mode === 'architecture' ? 'Architecture simplified and updated.' : 'Diagram updated successfully.' }])
      }
    } catch (error) {
      if (requestId !== generationRequestRef.current) return

      const message = error instanceof Error ? error.message : 'An unknown error occurred';
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
    setActiveTab('ai')
    setShowShareTooltip(false)

    if (typeof window !== 'undefined' && window.location.search) {
      window.history.replaceState({}, '', `${window.location.origin}${window.location.pathname}`)
    }
  }, [])

  const copyToClipboard = useCallback(() => {
    navigator.clipboard.writeText(chart)
    alert('Mermaid code copied to clipboard')
  }, [chart])

  const exportSVG = useCallback(() => {
    // Explicitly drill down to target the raw <svg> child element
    const svgElement = document.querySelector('.mermaid-container svg') as SVGElement;
    if (svgElement) {
      try {
        // Clone the SVG to avoid modifying the UI
        const clonedSvg = svgElement.cloneNode(true) as SVGElement;
        
        // Find Mermaid styles in the head and inject them into the cloned SVG
        // Mermaid typically adds styles with IDs starting with "mermaid-"
        const styleTags = document.querySelectorAll('style[id^="mermaid-"]');
        let combinedStyles = '';
        styleTags.forEach(tag => {
          combinedStyles += tag.innerHTML;
        });

        // Add additional contrast safeguards for the standalone file
        combinedStyles += `
          svg { background-color: white; }
          text, .node label, .edgeLabel, .cluster-label { fill: #0f172a !important; color: #0f172a !important; }
          foreignObject { overflow: visible !important; }
        `;

        const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
        style.innerHTML = combinedStyles;
        clonedSvg.insertBefore(style, clonedSvg.firstChild);

        // Use standard browser serialization pipeline
        const serializer = new XMLSerializer();
        const svgString = serializer.serializeToString(clonedSvg);
        const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'architecture.svg';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } catch (err) {
        console.error('Export error:', err);
        alert('Failed to export SVG.');
      }
    } else {
      alert('Diagram SVG not found.');
    }
  }, [])

  return (
    <div className="relative min-h-screen-dvh overflow-hidden bg-[#0B0F19] text-slate-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.07)_1px,transparent_0)] bg-[length:24px_24px]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(56,189,248,0.12),transparent_34%),linear-gradient(180deg,rgba(2,6,23,0.2),rgba(2,6,23,0.82))]" />

      <main className="mermaid-container absolute inset-0 overflow-auto">
        <div className="flex min-h-full min-w-full items-center justify-center px-8 pb-48 pt-28">
          <div
            style={{ transform: `scale(${canvasZoom})`, transformOrigin: 'center center' }}
            className="min-h-[56vh] min-w-[720px] rounded-2xl border border-white/10 bg-white p-8 shadow-2xl shadow-black/40 transition-transform duration-200"
          >
            <Mermaid chart={renderedChart} onError={setRenderError} />
          </div>
        </div>
      </main>

      <header className="pointer-events-none fixed left-6 right-6 top-6 z-30 flex items-start justify-between gap-4">
        <div className="pointer-events-auto flex max-w-[420px] flex-col gap-3">
          <div className="flex items-center gap-3 rounded-2xl border border-slate-800/80 bg-slate-950/65 px-4 py-3 shadow-2xl shadow-black/30 backdrop-blur-md">
            <BrandMark />
            <div className="min-w-0">
              <div className="text-sm font-semibold tracking-tight text-white">Way2Go Architecture Studio</div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-200/60">Cloud Modeler</div>
            </div>
          </div>

          <div className="hidden max-h-[42vh] w-[360px] overflow-y-auto rounded-2xl border border-slate-800/80 bg-slate-950/55 p-2 shadow-2xl shadow-black/20 backdrop-blur-md lg:block">
            <div className="px-2 pb-2 pt-1 text-[10px] font-bold uppercase tracking-[0.24em] text-slate-500">Examples</div>
            <div className="space-y-1">
              {examples.map((item) => (
                <button
                  key={item.id}
                  onClick={() => loadExample(item)}
                  className="w-full rounded-xl px-3 py-2 text-left transition-colors hover:bg-white/10"
                >
                  <div className="text-sm font-medium text-slate-200">{item.title}</div>
                  <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-cyan-200/50">{item.category}</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="pointer-events-auto flex flex-col items-end gap-3">
          <div className="flex items-center gap-2 rounded-2xl border border-slate-800/80 bg-slate-950/65 p-2 shadow-2xl shadow-black/30 backdrop-blur-md">
            <ThemeToggle />
            <button
              onClick={() => setMode(mode === 'default' ? 'architecture' : 'default')}
              className={`rounded-xl border px-3 py-2 text-xs font-semibold transition-colors ${
                mode === 'architecture'
                  ? 'border-cyan-400/40 bg-cyan-400/15 text-cyan-100'
                  : 'border-slate-700/70 bg-slate-900/60 text-slate-300 hover:bg-slate-800'
              }`}
              title="Toggle architecture mode"
            >
              Mode
            </button>
            <button
              onClick={shareBlueprint}
              className="rounded-xl border border-slate-700/70 bg-slate-900/60 p-2 text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
              title="Share blueprint"
              aria-label="Share blueprint"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
            </button>
            <button
              onClick={copyToClipboard}
              className="rounded-xl border border-slate-700/70 bg-slate-900/60 p-2 text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
              title="Copy Mermaid code"
              aria-label="Copy Mermaid code"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>
            </button>
            <button
              onClick={exportSVG}
              className="rounded-xl border border-slate-700/70 bg-slate-900/60 p-2 text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
              title="Export SVG"
              aria-label="Export SVG"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            </button>
            <button
              onClick={resetWorkspace}
              className="rounded-xl border border-slate-700/70 bg-slate-900/60 p-2 text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
              title="Clear canvas"
              aria-label="Clear canvas"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            </button>
          </div>
          <div className="flex items-center gap-1 rounded-2xl border border-slate-800/80 bg-slate-950/65 p-1.5 shadow-2xl shadow-black/30 backdrop-blur-md">
            <button
              onClick={() => setCanvasZoom((value) => Math.max(0.6, Number((value - 0.1).toFixed(2))))}
              className="rounded-xl border border-slate-700/70 bg-slate-900/60 px-3 py-2 text-sm font-semibold text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
              title="Zoom out"
              aria-label="Zoom out"
            >
              -
            </button>
            <button
              onClick={() => setCanvasZoom(1)}
              className="min-w-14 rounded-xl px-3 py-2 text-xs font-semibold tabular-nums text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
              title="Reset zoom"
            >
              {Math.round(canvasZoom * 100)}%
            </button>
            <button
              onClick={() => setCanvasZoom((value) => Math.min(1.8, Number((value + 0.1).toFixed(2))))}
              className="rounded-xl border border-slate-700/70 bg-slate-900/60 px-3 py-2 text-sm font-semibold text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
              title="Zoom in"
              aria-label="Zoom in"
            >
              +
            </button>
          </div>
          {showShareTooltip && (
            <div className="rounded-lg border border-cyan-400/20 bg-cyan-400/15 px-3 py-1.5 text-xs font-semibold text-cyan-100 shadow-lg backdrop-blur-md">
              Link copied
            </div>
          )}
        </div>
      </header>

      {renderError && (
        <div className="fixed left-1/2 top-6 z-50 flex w-[min(720px,calc(100vw-2rem))] -translate-x-1/2 items-center gap-3 rounded-2xl border border-red-400/30 bg-red-950/70 p-4 text-red-100 shadow-2xl shadow-red-950/30 backdrop-blur-md">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-500/15 text-red-300">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-red-300">Syntax Error Detected</div>
            <div className="truncate text-sm text-red-100/80">{renderError}</div>
          </div>
          <button
            onClick={() => setRenderError(null)}
            className="rounded-lg p-2 text-red-200 transition-colors hover:bg-white/10"
            aria-label="Dismiss syntax error"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      )}

      <aside
        className={`fixed right-0 top-0 z-40 h-full w-[400px] max-w-[calc(100vw-2rem)] border-l border-slate-800/80 bg-slate-950/90 shadow-2xl shadow-black/50 backdrop-blur-xl transition-transform duration-300 ${
          activeTab === 'editor' ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-slate-800/80 px-5 py-4">
            <div>
              <div className="text-sm font-semibold text-white">Live Mermaid</div>
              <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">Code Drawer</div>
            </div>
            <button
              onClick={() => setActiveTab('ai')}
              className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
              aria-label="Close code drawer"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          <textarea
            className="min-h-0 flex-1 resize-none border-0 bg-[#070A12] p-5 font-mono text-sm leading-relaxed text-cyan-100 outline-none ring-1 ring-inset ring-slate-800/80 selection:bg-cyan-400/20 placeholder:text-slate-600"
            spellCheck="false"
            value={chart}
            onChange={(e) => setChart(e.target.value)}
            placeholder="Enter Mermaid code manually..."
          />
          <div className="flex items-center justify-between border-t border-slate-800/80 px-5 py-3 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
            <span>Manual Studio Mode</span>
            {renderError && <span className="text-red-300">Syntax Error</span>}
          </div>
        </div>
      </aside>

      <button
        onClick={() => setActiveTab(activeTab === 'editor' ? 'ai' : 'editor')}
        className={`fixed top-1/2 z-50 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-l-xl border border-slate-800/80 bg-slate-950/75 text-slate-200 shadow-2xl shadow-black/40 backdrop-blur-md transition-all duration-300 hover:bg-slate-800 ${
          activeTab === 'editor' ? 'right-[400px]' : 'right-0'
        }`}
        aria-label="Toggle code drawer"
        title="Toggle code drawer"
      >
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 9l-3 3 3 3m8-6l3 3-3 3M13 5l-2 14" /></svg>
      </button>

      <section className="fixed bottom-8 left-1/2 z-30 w-[60vw] min-w-[500px] max-w-[800px] -translate-x-1/2 rounded-2xl border border-slate-800/80 bg-slate-900/65 p-3 shadow-2xl shadow-black/50 backdrop-blur-md max-sm:bottom-4 max-sm:w-[calc(100vw-1.5rem)] max-sm:min-w-0">
        {messages.length > 0 && (
          <div
            ref={scrollRef}
            className="mb-3 max-h-32 space-y-2 overflow-y-auto rounded-xl border border-slate-800/70 bg-slate-950/40 p-3"
          >
            {messages.slice(-4).map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-cyan-500/20 text-cyan-50 ring-1 ring-cyan-300/20'
                    : 'bg-white/10 text-slate-200 ring-1 ring-white/10'
                }`}>
                  {msg.content}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex items-center gap-2 px-2 py-1 text-xs text-slate-400">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-cyan-300 [animation-delay:-0.3s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-cyan-300 [animation-delay:-0.15s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-cyan-300" />
              </div>
            )}
          </div>
        )}
        <div className="relative rounded-xl bg-gradient-to-r from-cyan-400/35 via-blue-500/25 to-fuchsia-500/35 p-[1px]">
          <div className="relative rounded-xl bg-slate-950/80">
            <textarea
              className="block min-h-[76px] w-full resize-none rounded-xl border-0 bg-transparent px-4 py-4 pr-16 text-sm leading-relaxed text-slate-100 outline-none placeholder:text-slate-500 focus:ring-0"
              placeholder="Describe the architecture change..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleGenerate()
                }
              }}
            />
            <button
              onClick={handleGenerate}
              disabled={isLoading || !input.trim()}
              className="absolute bottom-3 right-3 flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-400 text-slate-950 shadow-lg shadow-cyan-500/30 transition-all hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Generate architecture"
              title="Generate architecture"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M5 12h14m-6-6l6 6-6 6" />
              </svg>
            </button>
          </div>
        </div>
      </section>

      <div className="pointer-events-none fixed bottom-3 right-4 z-20 font-mono text-[10px] text-slate-500/70">
        {getVersionString()} Enterprise Edition
      </div>
    </div>
  )
}

export default App
