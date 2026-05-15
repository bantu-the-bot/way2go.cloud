import { useState, useEffect, useRef } from 'react'
import mermaid from 'mermaid'

mermaid.initialize({
  startOnLoad: true,
  theme: 'default',
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

  return <div ref={ref} className="flex justify-center" />
}

function App() {
  const [input, setInput] = useState('')
  const [chart, setChart] = useState('graph TD\n    A[User] --> B[Way2Go]\n    B --> C[Mermaid.js]\n    C --> D[SVG Diagram]')
  const [isLoading, setIsLoading] = useState(false)

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
        throw new Error('Failed to generate diagram')
      }

      const data = await response.json()
      if (data.chart) {
        setChart(data.chart)
      }
    } catch (error) {
      console.error('Generation error:', error)
      alert('Error generating diagram. Please check your Cloudflare configuration.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center p-4 md:p-8">
      <header className="w-full max-w-6xl flex justify-between items-center mb-8">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-[var(--accent)] rounded-lg flex items-center justify-center text-white font-bold">W</div>
          <h1 className="text-2xl font-bold m-0 tracking-tight">way2go.cloud</h1>
        </div>
        <div className="text-sm font-medium text-[var(--text)]">
          Zero-cost Cloud Architect
        </div>
      </header>

      <main className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-8 flex-1">
        <section className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <h2 className="text-lg font-semibold">Describe your infrastructure</h2>
            <p className="text-sm text-[var(--text)]">Enter plain English, get instant diagrams.</p>
          </div>
          
          <textarea
            className="flex-1 min-h-[300px] p-4 rounded-xl border border-[var(--border)] bg-[var(--bg)] text-[var(--text-h)] focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent outline-none resize-none shadow-sm"
            placeholder="e.g. A serverless web app with a React frontend on Pages, an API worker, and a D1 database."
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />

          <button
            onClick={handleGenerate}
            disabled={isLoading || !input.trim()}
            className="h-12 bg-[var(--accent)] hover:opacity-90 disabled:opacity-50 text-white font-semibold rounded-xl transition-all shadow-md flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Architecting...
              </>
            ) : (
              'Generate Diagram'
            )}
          </button>
        </section>

        <section className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <h2 className="text-lg font-semibold">Visual Output</h2>
            <p className="text-sm text-[var(--text)]">Mermaid.js rendered SVG.</p>
          </div>

          <div className="flex-1 min-h-[300px] p-8 rounded-xl border border-[var(--border)] bg-white dark:bg-zinc-900 shadow-sm flex items-center justify-center overflow-auto">
            <Mermaid chart={chart} />
          </div>
        </section>
      </main>

      <footer className="w-full max-w-6xl mt-8 pt-4 border-t border-[var(--border)] flex justify-between text-xs text-[var(--text)]">
        <div>&copy; 2026 way2go.cloud</div>
        <div className="flex gap-4">
          <a href="#" className="hover:text-[var(--accent)]">Documentation</a>
          <a href="#" className="hover:text-[var(--accent)]">GitHub</a>
        </div>
      </footer>
    </div>
  )
}

export default App
