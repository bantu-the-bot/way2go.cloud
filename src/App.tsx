import { useState, useEffect, useRef, useCallback } from 'react'
import mermaid from 'mermaid'

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
    setInput(example.inputText)
    setChart(example.chartState)
  }

  const handleGenerate = async () => {
    if (!input.trim()) return
    setIsLoading(true)
    
    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: input }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Server responded with ${response.status}`);
      }

      const data = await response.json()
      if (data.chart) {
        setChart(data.chart)
      }
    } catch (error: any) {
      console.error('Generation error:', error)
      alert(`Architecture Synthesis Failed: ${error.message}`);
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
    <div className="flex h-screen bg-[#0f172a] text-slate-200">
      {/* Sidebar */}
      <aside className="w-64 border-r border-slate-800 flex flex-col hidden md:flex">
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
          <div className="text-xs text-slate-500 px-2">v2.4.0 Enterprise Edition</div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b border-slate-800 flex items-center justify-between px-8 bg-[#0f172a]/80 backdrop-blur-md sticky top-0 z-10">
          <h2 className="text-sm font-medium text-slate-400">Architect Workspace / <span className="text-white">New Diagram</span></h2>
          <div className="flex items-center gap-3">
            <button className="px-3 py-1.5 text-xs font-medium bg-slate-800 rounded-md hover:bg-slate-700 transition-colors">Documentation</button>
            <button className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-md hover:bg-blue-500 transition-colors">Sign In</button>
          </div>
        </header>

        <div className="flex-1 flex flex-col lg:flex-row p-6 gap-6 overflow-hidden">
          {/* Editor Area */}
          <section className="flex-1 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500">Design Specification</h3>
            </div>
            <div className="flex-1 glass rounded-xl overflow-hidden flex flex-col shadow-2xl">
              <textarea
                className="flex-1 w-full bg-transparent p-6 text-slate-200 placeholder-slate-500 font-mono text-sm focus:outline-none resize-none"
                placeholder="Describe your infrastructure... (e.g., 'A three-tier AWS architecture with ALB, EC2 Auto Scaling, and RDS Cluster')"
                value={input}
                onChange={(e) => setInput(e.target.value)}
              />
              <div className="p-4 border-t border-white/5 bg-white/5 flex justify-end">
                <button
                  onClick={handleGenerate}
                  disabled={isLoading || !input.trim()}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold rounded-lg transition-all shadow-lg flex items-center gap-2"
                >
                  {isLoading ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : null}
                  {isLoading ? 'Synthesizing...' : 'Generate Architecture'}
                </button>
              </div>
            </div>
          </section>

          {/* Preview Area */}
          <section className="flex-[1.5] flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500">Architecture Preview</h3>
              <div className="flex gap-2">
                <button 
                  onClick={copyToClipboard}
                  className="p-1.5 hover:bg-slate-800 rounded transition-colors text-slate-400 hover:text-white" 
                  title="Copy Mermaid Code"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"></path></svg>
                </button>
                <button 
                  onClick={exportSVG}
                  className="p-1.5 hover:bg-slate-800 rounded transition-colors text-slate-400 hover:text-white" 
                  title="Export SVG"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                </button>
              </div>
            </div>
            <div className="flex-1 bg-[#f8fafc] rounded-xl border border-slate-200 overflow-auto flex items-center justify-center p-8 shadow-inner flex-center">
              <Mermaid chart={chart} />
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}

export default App
