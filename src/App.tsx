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

const Mermaid = ({ chart, onError }: { chart: string; onError?: (error: string | null) => void }) => {
  const ref = useRef<HTMLDivElement>(null)
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
    if (ref.current && chart) {
      const renderDiagram = async () => {
        try {
          ref.current?.removeAttribute('data-processed')
          const { svg } = await mermaid.render(
            'mermaid-svg-' + Math.random().toString(36).substring(2, 11),
            chart
          )
          if (ref.current) {
            ref.current.innerHTML = svg
            onError?.(null)
          }
        } catch (err) {
          console.error('Mermaid render error:', err)
          onError?.('Invalid Mermaid Syntax: Please check your code structure.')
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
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>(() => {
    if (urlState?.messages) return urlState.messages;
    return [{ role: 'assistant', content: 'Welcome! Describe the architecture you want to build, or choose an example to get started.' }];
  })
  
  // Resizable layout state
  const [leftWidth, setLeftWidth] = useState(40) // percentage
  const [isDragging, setIsDragging] = useState(false)

  const scrollRef = useRef<HTMLDivElement>(null)

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return
    const newWidth = (e.clientX / window.innerWidth) * 100
    if (newWidth > 20 && newWidth < 80) {
      setLeftWidth(newWidth)
    }
  }, [isDragging])

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
    } else {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, handleMouseMove, handleMouseUp])

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
      chartState: 'graph TD\n    A["Wake up at 6 AM"] --> B{"Feeling Tired?"}\n    B -- "Yes" --> C["Water & Stretch"]\n    B -- "No" --> D["Make Coffee"]\n    C --> E["Brush Teeth"]\n    D --> E\n    E --> F["Eat Breakfast"]\n    F --> G["Start Workday"]'
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
          mode
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Server responded with ${response.status}`);
      }

      const data = await response.json()
      if (data.chart) {
        // Robust Frontend Sanitization
        let cleanChart = data.chart;
        cleanChart = cleanChart.replace(/```mermaid\n?/g, '');
        cleanChart = cleanChart.replace(/```\n?/g, '');
        cleanChart = cleanChart.trim();

        setChart(cleanChart)
        setMessages([...newMessages, { role: 'assistant', content: mode === 'architecture' ? 'Architecture simplified and updated.' : 'Diagram updated successfully.' }])
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'An unknown error occurred';
      console.error('Generation error:', error)
      setMessages([...newMessages, { role: 'assistant', content: `Error: ${message}` }])
    } finally {
      setIsLoading(false)
    }
  }

  const resetWorkspace = useCallback(() => {
    if (confirm('Are you sure you want to clear the current diagram and history?')) {
      setChart('')
      setRenderedChart('')
      setMessages([
        { role: 'assistant', content: 'Workspace cleared. Describe your new architecture to begin.' }
      ])
      setInput('')
      setActiveTab('ai')
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
    <div className="flex flex-col md:flex-row min-h-screen-dvh bg-[#0f172a] text-slate-200 overflow-x-hidden">
      {/* Sidebar - Desktop Only */}
      <aside className="hidden md:flex w-64 border-r border-slate-200 dark:border-slate-800 flex-col flex-shrink-0 bg-white dark:bg-[#0f172a] transition-colors duration-200">
        <div className="p-6 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center font-bold text-white">W</div>
            <span className="font-bold text-lg tracking-tight">way2go.cloud</span>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <h3 className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-4 px-2">Examples</h3>
          <nav className="space-y-1">
            {examples.map((item) => (
              <button
                key={item.id}
                onClick={() => loadExample(item)}
                className="w-full text-left px-3 py-3 rounded-md text-sm hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors group"
              >
                <div className="font-medium text-slate-700 dark:text-slate-200 mb-1 leading-snug">{item.title}</div>
                <span className="inline-block px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-[10px] font-bold text-slate-500 uppercase tracking-tight group-hover:bg-slate-300 dark:group-hover:bg-slate-700">
                  {item.category}
                </span>
              </button>
            ))}
          </nav>
        </div>
        <div className="p-4 border-t border-slate-200 dark:border-slate-800">
          <div className="text-xs text-slate-400 dark:text-slate-500 px-2 font-mono">{getVersionString()} Enterprise Edition</div>
        </div>
      </aside>

      {/* Main Content Container */}
      <main className="flex-1 flex flex-col min-w-0 h-full overflow-y-auto md:overflow-hidden bg-slate-50 dark:bg-[#0f172a] transition-colors duration-200">
        <header className="min-h-[4rem] border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between px-4 md:px-8 bg-white/80 dark:bg-[#0f172a]/80 backdrop-blur-md sticky top-0 z-20 py-2 md:py-0 gap-4 transition-colors duration-200">
          <div className="flex items-center gap-3">
            {/* Mobile Logo */}
            <div className="md:hidden w-8 h-8 bg-blue-600 rounded flex items-center justify-center font-bold text-white text-xs">W</div>
            <h2 className="text-sm font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap">
              <span className="hidden sm:inline">Architect Workspace / </span>
              <button 
                onClick={resetWorkspace}
                className="text-slate-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer"
              >
                New Diagram
              </button>
            </h2>
          </div>
          <div className="flex items-center gap-2 md:gap-3">
            <ThemeToggle />
            <div className="w-[1px] h-6 bg-slate-200 dark:bg-slate-800 mx-1 md:mx-2" />
            <button className="px-2 md:px-3 py-1.5 text-[10px] md:text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">Docs</button>
            <button className="px-3 md:px-4 py-1.5 text-[10px] md:text-xs font-bold bg-blue-600 text-white rounded-md hover:bg-blue-500 transition-colors shadow-lg">Sign In</button>
          </div>
        </header>

        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
          {/* Control Panel (Tabbed Sidebar) */}
          <section 
            style={{ width: `calc(${leftWidth}% - 4px)` }}
            className="flex flex-col gap-3 md:gap-4 flex-shrink-0 p-4 md:p-6 transition-none"
          >
            <div className="flex items-center justify-between px-1">
              <div className="flex bg-slate-200/50 dark:bg-slate-800/50 p-1 rounded-lg border border-slate-300/50 dark:border-slate-700/50 transition-colors duration-200">
                <button
                  onClick={() => setActiveTab('ai')}
                  className={`px-4 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all ${
                    activeTab === 'ai' 
                      ? 'bg-blue-600 text-white shadow-lg' 
                      : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                  }`}
                >
                  AI Architect
                </button>
                <button
                  onClick={() => setActiveTab('editor')}
                  className={`px-4 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all ${
                    activeTab === 'editor' 
                      ? 'bg-blue-600 text-white shadow-lg' 
                      : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                  }`}
                >
                  Live Code Editor
                </button>
              </div>
              <button 
                onClick={resetWorkspace}
                className="text-[10px] font-bold text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 uppercase tracking-wider flex items-center gap-1.5 transition-colors group"
              >
                <svg className="w-3 h-3 group-hover:rotate-[-45deg] transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                Reset
              </button>
            </div>
            
            <div className="flex-1 bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden flex flex-col shadow-xl dark:shadow-2xl min-h-0 transition-colors duration-200">
              {activeTab === 'ai' ? (
                <>
                  <div className="bg-slate-100 dark:bg-slate-800/30 border-b border-slate-200 dark:border-slate-700/30 px-4 py-2 flex items-center justify-between transition-colors duration-200">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Architect Assistant</span>
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-tighter">Architecture Mode</span>
                      <button 
                        onClick={() => setMode(mode === 'default' ? 'architecture' : 'default')}
                        className={`w-8 h-4 rounded-full relative transition-colors duration-200 ${mode === 'architecture' ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700'}`}
                      >
                        <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all duration-200 ${mode === 'architecture' ? 'left-4.5' : 'left-0.5'}`} />
                      </button>
                    </div>
                  </div>
                  {/* Message History */}
                  <div 
                    ref={scrollRef}
                    className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 scroll-smooth bg-slate-50 dark:bg-slate-900/20 transition-colors duration-200"
                  >
                    {messages.map((msg, idx) => (
                      <div 
                        key={idx} 
                        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                          msg.role === 'user' 
                            ? 'bg-blue-600 text-white rounded-tr-none shadow-md' 
                            : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-tl-none border border-slate-200 dark:border-slate-700 shadow-sm transition-colors duration-200'
                        }`}>
                          {msg.content}
                        </div>
                      </div>
                    ))}
                    {isLoading && (
                      <div className="flex justify-start">
                        <div className="bg-white dark:bg-slate-800 text-slate-400 rounded-2xl rounded-tl-none px-4 py-2.5 text-sm border border-slate-200 dark:border-slate-700 flex items-center gap-2 transition-colors duration-200">
                          <div className="w-1.5 h-1.5 bg-slate-300 dark:bg-slate-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
                          <div className="w-1.5 h-1.5 bg-slate-300 dark:bg-slate-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
                          <div className="w-1.5 h-1.5 bg-slate-300 dark:bg-slate-500 rounded-full animate-bounce" />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Input Area */}
                  <div className="p-3 md:p-4 border-t border-slate-200 dark:border-white/5 bg-white dark:bg-white/5 space-y-3 transition-colors duration-200">
                    <div className="relative">
                      <textarea
                        className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-lg p-3 pr-12 text-slate-900 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500/50 resize-none min-h-[80px] transition-colors duration-200"
                        placeholder="Refine your design... (e.g., 'Add a Redis cache layer')"
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
                        className="absolute bottom-3 right-3 p-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-md transition-all active:scale-95 shadow-lg"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex flex-col bg-white dark:bg-slate-950/30 transition-colors duration-200">
                  <textarea
                    className="flex-1 w-full bg-transparent p-4 md:p-6 text-blue-600 dark:text-blue-400/90 font-mono text-sm focus:outline-none resize-none selection:bg-blue-500/20 transition-colors duration-200"
                    spellCheck="false"
                    value={chart}
                    onChange={(e) => setChart(e.target.value)}
                    placeholder="Enter Mermaid code manually..."
                  />
                  <div className="p-3 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-200 dark:border-slate-800/50 flex justify-between items-center px-4 transition-colors duration-200">
                    <span className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Manual Studio Mode</span>
                    {renderError && (
                      <span className="text-[10px] text-red-500 dark:text-red-400 font-bold animate-pulse">Syntax Error Detected</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Draggable Divider */}
          <div 
            onMouseDown={handleMouseDown}
            className={`hidden lg:flex w-2 hover:w-2 items-center justify-center cursor-col-resize group transition-all relative z-40 ${isDragging ? 'bg-blue-600/50 w-2' : 'hover:bg-blue-500/10 dark:hover:bg-blue-500/20'}`}
          >
            <div className={`w-0.5 h-8 rounded-full transition-all ${isDragging ? 'bg-white h-12' : 'bg-slate-300 dark:bg-slate-700 group-hover:bg-blue-600 dark:group-hover:bg-blue-400'}`} />
          </div>

          {/* Preview Area */}
          <section 
            style={{ width: `calc(${100 - leftWidth}% - 4px)` }}
            className="flex flex-col gap-3 md:gap-4 flex-grow p-4 md:p-6 min-h-0"
          >
            <div className="flex items-center justify-between px-1">
              <h3 className="text-[10px] md:text-xs font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">Architecture Preview</h3>
              <div className="flex gap-1 md:gap-2 relative z-30">
                <div className="relative">
                  <button 
                    onClick={shareBlueprint}
                    className="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-200 text-[10px] font-bold uppercase tracking-wider rounded-md border border-slate-200 dark:border-slate-700 transition-all active:scale-95"
                    title="Share Diagram Link"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                    Share Blueprint
                  </button>
                  {showShareTooltip && (
                    <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-[10px] font-bold px-2 py-1 rounded shadow-lg animate-in fade-in zoom-in duration-200 whitespace-nowrap z-[100]">
                      Link Copied!
                    </div>
                  )}
                </div>
                <div className="w-[1px] h-4 bg-slate-200 dark:bg-slate-800 self-center mx-1" />
                <button 
                  onClick={copyToClipboard}
                  className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800" 
                  title="Copy Mermaid Code"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"></path></svg>
                </button>
                <button 
                  onClick={exportSVG}
                  className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800" 
                  title="Export SVG"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                </button>
              </div>
            </div>

            <div className="flex-1 flex flex-col rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0f172a] shadow-inner relative overflow-visible transition-colors duration-200">
              {renderError && (
                <div className="absolute top-0 left-0 right-0 z-20 bg-red-50/90 dark:bg-red-950/80 backdrop-blur-md border-b border-red-200 dark:border-red-500/30 p-3 flex items-center gap-3 animate-in slide-in-from-top-4 duration-300">
                  <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-500/20 flex items-center justify-center shrink-0">
                    <svg className="w-4 h-4 text-red-600 dark:text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] font-bold text-red-600 dark:text-red-400 uppercase tracking-widest mb-0.5">Syntax Error Detected</div>
                    <div className="text-xs text-red-700 dark:text-red-200/70 font-medium truncate">{renderError}</div>
                  </div>
                  <button 
                    onClick={() => setRenderError(null)}
                    className="p-1.5 hover:bg-black/5 dark:hover:bg-white/5 rounded transition-colors text-red-600 dark:text-red-400"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              )}
              
              <div className="flex-1 bg-white dark:bg-white overflow-auto flex items-start justify-center p-4 md:p-8 mermaid-container relative">
                <Mermaid chart={renderedChart} onError={setRenderError} />
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}

export default App
