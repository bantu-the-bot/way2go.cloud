import { useState, useEffect, useRef, useCallback } from 'react'
import mermaid from 'mermaid'
import { getVersionString } from './versionConfig'

mermaid.initialize({
  startOnLoad: true,
  theme: 'neutral',
  securityLevel: 'loose',
  fontFamily: 'var(--sans)',
})

const Mermaid = ({ chart }: { chart: string }) => {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (ref.current && chart) {
      ref.current.removeAttribute('data-processed')
      const renderDiagram = async () => {
        try {
          const { svg } = await mermaid.render(
            'mermaid-svg-' + Math.random().toString(36).substring(2, 11),
            chart
          )
          if (ref.current) {
            ref.current.innerHTML = svg
          }
        } catch (error) {
          console.error('Mermaid render error:', error)
        }
      }
      renderDiagram()
    }
  }, [chart])

  return <div ref={ref} className="flex justify-center w-full h-full" />
}

function App() {
  const [input, setInput] = useState('')
  const [chart, setChart] = useState('graph TD\n    A[Cloud Front] --> B[Edge Worker]\n    B --> C[Vector Database]\n    B --> D[Static Assets]')
  const [isLoading, setIsLoading] = useState(false)
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([
    { role: 'assistant', content: 'Welcome! Describe the architecture you want to build, or choose an example to get started.' }
  ])
  const scrollRef = useRef<HTMLDivElement>(null)

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

  const loadExample = (example: typeof examples[0]) => {
    setInput('')
    setChart(example.chartState)
    setMessages([
      { role: 'assistant', content: `Loaded example: **${example.title}**` },
      { role: 'user', content: example.inputText }
    ])
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
          instruction 
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Server responded with ${response.status}`);
      }

      const data = await response.json()
      if (data.chart) {
        setChart(data.chart)
        setMessages([...newMessages, { role: 'assistant', content: 'Diagram updated successfully.' }])
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'An unknown error occurred';
      console.error('Generation error:', error)
      setMessages([...newMessages, { role: 'assistant', content: `Error: ${message}` }])
    } finally {
      setIsLoading(false)
    }
  }

  const copyToClipboard = useCallback(() => {
    navigator.clipboard.writeText(chart)
    alert('Mermaid code copied to clipboard')
  }, [chart])

  const exportSVG = useCallback(() => {
    const svgContent = document.querySelector('.flex-center svg')?.outerHTML
    if (svgContent) {
      const blob = new Blob([svgContent], { type: 'image/svg+xml' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'architecture.svg'
      link.click()
      URL.revokeObjectURL(url)
    }
  }, [])

  return (
    <div className="flex flex-col md:flex-row min-h-screen-dvh bg-[#0f172a] text-slate-200 overflow-x-hidden">
      {/* Sidebar - Desktop Only */}
      <aside className="hidden md:flex w-64 border-r border-slate-800 flex-col flex-shrink-0">
        <div className="p-6 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center font-bold text-white">W</div>
            <span className="font-bold text-lg tracking-tight">way2go.cloud</span>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4 px-2">Examples</h3>
          <nav className="space-y-1">
            {examples.map((item) => (
              <button
                key={item.id}
                onClick={() => loadExample(item)}
                className="w-full text-left px-3 py-3 rounded-md text-sm hover:bg-slate-800 transition-colors group"
              >
                <div className="font-medium text-slate-200 mb-1 leading-snug">{item.title}</div>
                <span className="inline-block px-1.5 py-0.5 rounded bg-slate-800 text-[10px] font-bold text-slate-500 uppercase tracking-tight group-hover:bg-slate-700 group-hover:text-slate-400">
                  {item.category}
                </span>
              </button>
            ))}
          </nav>
        </div>
        <div className="p-4 border-t border-slate-800">
          <div className="text-xs text-slate-500 px-2 font-mono">{getVersionString()} Enterprise Edition</div>
        </div>
      </aside>

      {/* Main Content Container */}
      <main className="flex-1 flex flex-col min-w-0 h-full overflow-y-auto md:overflow-hidden">
        <header className="min-h-[4rem] border-b border-slate-800 flex flex-wrap items-center justify-between px-4 md:px-8 bg-[#0f172a]/80 backdrop-blur-md sticky top-0 z-20 py-2 md:py-0 gap-4">
          <div className="flex items-center gap-3">
            {/* Mobile Logo */}
            <div className="md:hidden w-8 h-8 bg-blue-600 rounded flex items-center justify-center font-bold text-white text-xs">W</div>
            <h2 className="text-sm font-medium text-slate-400 whitespace-nowrap">
              <span className="hidden sm:inline text-slate-500">Architect Workspace / </span>
              <span className="text-white">New Diagram</span>
            </h2>
          </div>
          <div className="flex items-center gap-2 md:gap-3">
            <button className="px-2 md:px-3 py-1.5 text-[10px] md:text-xs font-medium bg-slate-800 rounded-md hover:bg-slate-700 transition-colors">Docs</button>
            <button className="px-3 md:px-4 py-1.5 text-[10px] md:text-xs font-bold bg-blue-600 text-white rounded-md hover:bg-blue-500 transition-colors shadow-lg">Sign In</button>
          </div>
        </header>

        <div className="flex-1 flex flex-col lg:flex-row p-4 md:p-6 gap-6 overflow-y-auto lg:overflow-hidden">
          {/* Editor Area */}
          <section className="flex-1 flex flex-col gap-3 md:gap-4 flex-shrink-0 lg:flex-shrink">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-[10px] md:text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Design Specification</h3>
            </div>
            <div className="flex-1 lg:h-full glass rounded-xl overflow-hidden flex flex-col shadow-2xl min-h-[400px]">
              {/* Message History */}
              <div 
                ref={scrollRef}
                className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 scroll-smooth"
              >
                {messages.map((msg, idx) => (
                  <div 
                    key={idx} 
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                      msg.role === 'user' 
                        ? 'bg-blue-600 text-white rounded-tr-none' 
                        : 'bg-slate-800 text-slate-200 rounded-tl-none border border-slate-700'
                    }`}>
                      {msg.content}
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-slate-800 text-slate-400 rounded-2xl rounded-tl-none px-4 py-2.5 text-sm border border-slate-700 flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
                      <div className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
                      <div className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce" />
                    </div>
                  </div>
                )}
              </div>

              {/* Input Area */}
              <div className="p-3 md:p-4 border-t border-white/5 bg-white/5 space-y-3">
                <div className="relative">
                  <textarea
                    className="w-full bg-slate-900/50 border border-slate-700 rounded-lg p-3 pr-12 text-slate-200 placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500/50 resize-none min-h-[80px]"
                    placeholder="Describe changes... (e.g., 'Add a Redis cache', 'Switch to 3 subnets')"
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
                    className="absolute bottom-3 right-3 p-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-md transition-all active:scale-95"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
                <p className="text-[10px] text-slate-500 px-1 text-center">
                  Press Enter to send, Shift + Enter for new line.
                </p>
              </div>
            </div>
          </section>

          {/* Preview Area */}
          <section className="flex-[1.5] flex flex-col gap-3 md:gap-4 min-h-[400px] lg:h-full">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-[10px] md:text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Architecture Preview</h3>
              <div className="flex gap-1 md:gap-2">
                <button 
                  onClick={copyToClipboard}
                  className="p-2 hover:bg-slate-800 rounded-md transition-colors text-slate-400 hover:text-white bg-slate-900/50 border border-slate-800" 
                  title="Copy Mermaid Code"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"></path></svg>
                </button>
                <button 
                  onClick={exportSVG}
                  className="p-2 hover:bg-slate-800 rounded-md transition-colors text-slate-400 hover:text-white bg-slate-900/50 border border-slate-800" 
                  title="Export SVG"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                </button>
              </div>
            </div>
            <div className="flex-1 bg-[#f8fafc] rounded-xl border border-slate-300 overflow-auto flex items-start justify-center p-4 md:p-8 shadow-inner mermaid-container">
              <Mermaid chart={chart} />
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}

export default App
