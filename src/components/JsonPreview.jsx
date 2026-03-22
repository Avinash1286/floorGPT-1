import { useMemo, useState } from 'react'
import { Check, ChevronDown, ChevronUp, Copy, FileJson } from 'lucide-react'

function normalizeJsonText(rawJson, parsedJson) {
  if (rawJson?.trim()) {
    try {
      const parsed = JSON.parse(rawJson)
      return JSON.stringify(parsed, null, 2)
    } catch {
      return rawJson
    }
  }

  return JSON.stringify(parsedJson, null, 2)
}

function JsonPreview({ rawJson, parsedJson, isLoading }) {
  const [copied, setCopied] = useState(false)
  const [isExpanded, setIsExpanded] = useState(true)

  const displayedJson = useMemo(
    () => normalizeJsonText(rawJson, parsedJson),
    [rawJson, parsedJson],
  )

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(displayedJson)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      setCopied(false)
    }
  }

  return (
    <section className="panel overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 bg-slate-950/55 px-5 py-4">
        <div>
          <h2 className="panel-title flex items-center gap-2">
            <FileJson size={16} />
            Scene graph JSON
          </h2>
          <p className="panel-subtitle mt-1">
            Raw response shown here for parser validation and debugging.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setIsExpanded((current) => !current)}
          >
            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            {isExpanded ? 'Collapse' : 'Expand'}
          </button>
          <button type="button" className="btn-secondary" onClick={handleCopy} disabled={isLoading}>
            {copied ? <Check size={16} /> : <Copy size={16} />}
            {copied ? 'Copied' : 'Copy JSON'}
          </button>
        </div>
      </div>

      {isExpanded ? (
        <pre className="scrollbar-thin max-h-[360px] overflow-auto bg-[#020617] px-5 py-4 text-xs text-slate-200 sm:text-sm">
          {displayedJson}
        </pre>
      ) : null}
    </section>
  )
}

export default JsonPreview
