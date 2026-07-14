'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { useI18n } from '@/lib/hooks/use-i18n'
import { Database, SlidersHorizontal, Layers, Gauge } from 'lucide-react'

interface ToggleFieldProps {
  label: string
  description: string
  checked: boolean
  onChange: (checked: boolean) => void
}

function ToggleField({ label, description, checked, onChange }: ToggleFieldProps) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-[var(--border)] p-4 bg-[var(--card)]">
      <div className="space-y-0.5">
        <p className="text-[13px] font-medium text-[var(--foreground)]">{label}</p>
        <p className="text-[12px] text-[var(--muted-foreground)]">{description}</p>
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={cn(
          'relative h-6 w-11 rounded-full transition-colors',
          checked ? 'bg-[var(--primary)]' : 'bg-[var(--muted)]'
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform',
            checked && 'translate-x-5'
          )}
        />
      </button>
    </div>
  )
}

export default function KnowledgeSettingsPage() {
  const { t } = useI18n()
  const [chunkSize, setChunkSize] = useState(512)
  const [chunkOverlap, setChunkOverlap] = useState(64)
  const [embeddingModel, setEmbeddingModel] = useState('text-embedding-3-small')
  const [ragTopK, setRagTopK] = useState(5)
  const [minScore, setMinScore] = useState(0.7)
  const [rerank, setRerank] = useState(true)
  const [hybridSearch, setHybridSearch] = useState(false)
  const [maxContextLength, setMaxContextLength] = useState(8192)
  const [autoIndex, setAutoIndex] = useState(true)
  const [deduplicate, setDeduplicate] = useState(true)

  return (
    <div className="p-6 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-[var(--foreground)] mb-1">
          <Database className="inline h-5 w-5 mr-2 -mt-0.5" />
          Knowledge Base Settings
        </h1>
        <p className="text-[13px] text-[var(--muted-foreground)]">
          Configure chunking, embedding, and retrieval parameters for the RAG knowledge pipeline.
        </p>
      </div>

      <div className="space-y-4">
        {/* Chunking Configuration */}
        <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4 space-y-4">
          <h3 className="text-[13px] font-semibold text-[var(--foreground)] flex items-center gap-1.5">
            <Layers className="h-3.5 w-3.5" />
            Chunking Configuration
          </h3>

          <div className="space-y-2">
            <label className="text-[13px] font-medium text-[var(--foreground)]">
              Default Chunk Size: {chunkSize} tokens
            </label>
            <input
              type="range"
              min={128}
              max={2048}
              step={64}
              value={chunkSize}
              onChange={(e) => setChunkSize(Number(e.target.value))}
              className="w-full accent-[var(--primary)]"
            />
            <div className="flex justify-between text-[11px] text-[var(--muted-foreground)]">
              <span>128</span>
              <span>512</span>
              <span>1024</span>
              <span>2048</span>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[13px] font-medium text-[var(--foreground)]">
              Chunk Overlap: {chunkOverlap} tokens
            </label>
            <input
              type="range"
              min={0}
              max={256}
              step={16}
              value={chunkOverlap}
              onChange={(e) => setChunkOverlap(Number(e.target.value))}
              className="w-full accent-[var(--primary)]"
            />
            <div className="flex justify-between text-[11px] text-[var(--muted-foreground)]">
              <span>0</span>
              <span>64</span>
              <span>128</span>
              <span>256</span>
            </div>
          </div>
        </div>

        {/* Embedding Model */}
        <div className="space-y-2">
          <label className="text-[13px] font-medium text-[var(--foreground)]">Embedding Model</label>
          <select
            value={embeddingModel}
            onChange={(e) => setEmbeddingModel(e.target.value)}
            className="w-full bg-[var(--card)] border border-[var(--border)] rounded-lg px-3 py-2 text-[13.5px] text-[var(--foreground)] outline-none focus:border-[var(--primary)]"
          >
            <option value="text-embedding-3-small">text-embedding-3-small (OpenAI, 1536d)</option>
            <option value="text-embedding-3-large">text-embedding-3-large (OpenAI, 3072d)</option>
            <option value="bge-large-zh-v1.5">bge-large-zh-v1.5 (BAAI, 1024d)</option>
            <option value="bge-m3">bge-m3 (BAAI, multilingual, 1024d)</option>
            <option value="nomic-embed-text">nomic-embed-text (Nomic, 768d)</option>
          </select>
        </div>

        {/* Retrieval Configuration */}
        <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4 space-y-4">
          <h3 className="text-[13px] font-semibold text-[var(--foreground)] flex items-center gap-1.5">
            <Gauge className="h-3.5 w-3.5" />
            Retrieval Configuration
          </h3>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[13px] font-medium text-[var(--foreground)]">
                Top K Results: {ragTopK}
              </label>
              <input
                type="range"
                min={1}
                max={20}
                value={ragTopK}
                onChange={(e) => setRagTopK(Number(e.target.value))}
                className="w-full accent-[var(--primary)]"
              />
              <div className="flex justify-between text-[11px] text-[var(--muted-foreground)]">
                <span>1</span>
                <span>10</span>
                <span>20</span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[13px] font-medium text-[var(--foreground)]">
                Min Similarity Score: {minScore.toFixed(2)}
              </label>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={minScore}
                onChange={(e) => setMinScore(Number(e.target.value))}
                className="w-full accent-[var(--primary)]"
              />
              <div className="flex justify-between text-[11px] text-[var(--muted-foreground)]">
                <span>0.0</span>
                <span>0.5</span>
                <span>1.0</span>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[13px] font-medium text-[var(--foreground)]">
              Max Context Length: {maxContextLength} tokens
            </label>
            <input
              type="number"
              value={maxContextLength}
              onChange={(e) => setMaxContextLength(Number(e.target.value))}
              min={1024}
              max={32768}
              step={1024}
              className="w-full bg-[var(--card)] border border-[var(--border)] rounded-lg px-3 py-2 text-[13.5px] text-[var(--foreground)] outline-none focus:border-[var(--primary)]"
            />
            <p className="text-[11px] text-[var(--muted-foreground)]">
              Maximum number of tokens from retrieved chunks injected into the prompt context.
            </p>
          </div>
        </div>

        {/* Toggle Options */}
        <div className="space-y-3 pt-2">
          <ToggleField
            checked={rerank}
            onChange={setRerank}
            label="Rerank Results"
            description="Apply a cross-encoder reranker to reorder retrieved chunks by relevance"
          />
          <ToggleField
            checked={hybridSearch}
            onChange={setHybridSearch}
            label="Hybrid Search"
            description="Combine vector similarity with BM25 keyword matching for better recall"
          />
          <ToggleField
            checked={autoIndex}
            onChange={setAutoIndex}
            label="Auto-Index New Documents"
            description="Automatically chunk and embed documents when uploaded to the knowledge base"
          />
          <ToggleField
            checked={deduplicate}
            onChange={setDeduplicate}
            label="Deduplicate Chunks"
            description="Remove near-duplicate chunks across documents to reduce redundancy"
          />
        </div>
      </div>

      <div className="flex gap-3 mt-6">
        <button className="px-4 py-2 rounded-lg text-[13px] font-medium bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90 transition-opacity">
          {t('settingsNav.applyChanges')}
        </button>
        <button
          onClick={() => {
            setChunkSize(512)
            setChunkOverlap(64)
            setEmbeddingModel('text-embedding-3-small')
            setRagTopK(5)
            setMinScore(0.7)
            setRerank(true)
            setHybridSearch(false)
            setMaxContextLength(8192)
            setAutoIndex(true)
            setDeduplicate(true)
          }}
          className="px-4 py-2 rounded-lg text-[13px] font-medium bg-[var(--muted)] text-[var(--foreground)] border border-[var(--border)] hover:bg-[var(--accent)] transition-colors"
        >
          Reset to Defaults
        </button>
      </div>
    </div>
  )
}
