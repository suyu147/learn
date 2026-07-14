'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { useI18n } from '@/lib/hooks/use-i18n'
import { Puzzle, Wrench, Code, BookOpen, Calculator, Globe, Image, FileText } from 'lucide-react'

interface SkillPack {
  id: string
  name: string
  description: string
  icon: React.ElementType
  tools: string[]
  enabled: boolean
  category: string
}

const DEFAULT_SKILL_PACKS: SkillPack[] = [
  {
    id: 'code_interpreter',
    name: 'Code Interpreter',
    description: 'Execute Python, JavaScript, and TypeScript code in a sandboxed environment',
    icon: Code,
    tools: ['python_exec', 'js_exec', 'ts_exec', 'shell_exec'],
    enabled: true,
    category: 'Development',
  },
  {
    id: 'web_scraper',
    name: 'Web Scraper',
    description: 'Extract content from web pages, parse HTML, and follow links',
    icon: Globe,
    tools: ['fetch_url', 'parse_html', 'extract_tables', 'follow_links'],
    enabled: true,
    category: 'Data',
  },
  {
    id: 'math_solver',
    name: 'Math Solver',
    description: 'Advanced mathematical computation, symbolic algebra, and equation solving',
    icon: Calculator,
    tools: ['symbolic_math', 'numeric_solve', 'plot_graph', 'matrix_ops'],
    enabled: true,
    category: 'Analysis',
  },
  {
    id: 'document_reader',
    name: 'Document Reader',
    description: 'Parse and extract text from PDF, DOCX, PPTX, and other document formats',
    icon: FileText,
    tools: ['parse_pdf', 'parse_docx', 'parse_pptx', 'parse_csv'],
    enabled: true,
    category: 'Data',
  },
  {
    id: 'image_analyzer',
    name: 'Image Analyzer',
    description: 'Analyze images with OCR, object detection, and visual description',
    icon: Image,
    tools: ['ocr_extract', 'describe_image', 'detect_objects', 'compare_images'],
    enabled: false,
    category: 'Media',
  },
  {
    id: 'knowledge_builder',
    name: 'Knowledge Builder',
    description: 'Build and maintain a personal knowledge graph from conversations',
    icon: BookOpen,
    tools: ['extract_entities', 'build_graph', 'query_graph', 'merge_knowledge'],
    enabled: false,
    category: 'Knowledge',
  },
  {
    id: 'api_connector',
    name: 'API Connector',
    description: 'Make HTTP requests to external APIs with authentication support',
    icon: Wrench,
    tools: ['http_get', 'http_post', 'auth_header', 'parse_json'],
    enabled: false,
    category: 'Development',
  },
]

export default function SkillsSettingsPage() {
  const { t } = useI18n()
  const [skillPacks, setSkillPacks] = useState<SkillPack[]>(DEFAULT_SKILL_PACKS)
  const [filterCategory, setFilterCategory] = useState('all')

  const toggleSkill = (id: string) => {
    setSkillPacks((packs) =>
      packs.map((p) => (p.id === id ? { ...p, enabled: !p.enabled } : p))
    )
  }

  const categories = ['all', ...new Set(skillPacks.map((p) => p.category))]
  const filteredPacks =
    filterCategory === 'all'
      ? skillPacks
      : skillPacks.filter((p) => p.category === filterCategory)

  const enabledCount = skillPacks.filter((p) => p.enabled).length

  return (
    <div className="p-6 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-[var(--foreground)] mb-1">
          <Puzzle className="inline h-5 w-5 mr-2 -mt-0.5" />
          Skill Pack Management
        </h1>
        <p className="text-[13px] text-[var(--muted-foreground)]">
          Enable or disable skill packs to customize the agent&apos;s capabilities. ({enabledCount}/{skillPacks.length} active)
        </p>
      </div>

      {/* Category Filter */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setFilterCategory(cat)}
            className={cn(
              'px-3 py-1.5 rounded-full text-[12px] font-medium transition-colors',
              filterCategory === cat
                ? 'bg-[var(--primary)] text-[var(--primary-foreground)]'
                : 'bg-[var(--muted)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] border border-[var(--border)]'
            )}
          >
            {cat === 'all' ? 'All' : cat}
          </button>
        ))}
      </div>

      {/* Skill Pack List */}
      <div className="space-y-3">
        {filteredPacks.map((pack) => {
          const Icon = pack.icon
          return (
            <div
              key={pack.id}
              className={cn(
                'rounded-lg border p-4 transition-colors',
                pack.enabled
                  ? 'border-[var(--primary)]/30 bg-[var(--card)]'
                  : 'border-[var(--border)] bg-[var(--card)]'
              )}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3 flex-1">
                  <div
                    className={cn(
                      'mt-0.5 p-2 rounded-lg',
                      pack.enabled ? 'bg-[var(--primary)]/10' : 'bg-[var(--muted)]'
                    )}
                  >
                    <Icon
                      className={cn(
                        'h-4 w-4',
                        pack.enabled ? 'text-[var(--primary)]' : 'text-[var(--muted-foreground)]'
                      )}
                    />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-[13px] font-medium text-[var(--foreground)]">{pack.name}</p>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--muted)] text-[var(--muted-foreground)]">
                        {pack.category}
                      </span>
                    </div>
                    <p className="text-[12px] text-[var(--muted-foreground)] mt-0.5">{pack.description}</p>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {pack.tools.map((tool) => (
                        <span
                          key={tool}
                          className="text-[11px] px-2 py-0.5 rounded-md bg-[var(--muted)] text-[var(--muted-foreground)] font-mono"
                        >
                          {tool}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => toggleSkill(pack.id)}
                  className={cn(
                    'relative h-6 w-11 rounded-full transition-colors ml-3 flex-shrink-0',
                    pack.enabled ? 'bg-[var(--primary)]' : 'bg-[var(--muted)]'
                  )}
                >
                  <span
                    className={cn(
                      'absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform',
                      pack.enabled && 'translate-x-5'
                    )}
                  />
                </button>
              </div>
            </div>
          )
        })}
      </div>

      <div className="flex gap-3 mt-6">
        <button
          onClick={() => setSkillPacks((packs) => packs.map((p) => ({ ...p, enabled: true })))}
          className="px-4 py-2 rounded-lg text-[13px] font-medium bg-[var(--muted)] text-[var(--foreground)] border border-[var(--border)] hover:bg-[var(--accent)] transition-colors"
        >
          Enable All
        </button>
        <button
          onClick={() => setSkillPacks((packs) => packs.map((p) => ({ ...p, enabled: false })))}
          className="px-4 py-2 rounded-lg text-[13px] font-medium bg-[var(--muted)] text-[var(--foreground)] border border-[var(--border)] hover:bg-[var(--accent)] transition-colors"
        >
          Disable All
        </button>
      </div>

      <div className="flex gap-3 mt-3">
        <button className="px-4 py-2 rounded-lg text-[13px] font-medium bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90 transition-opacity">
          {t('settingsNav.applyChanges')}
        </button>
      </div>

      <div className="mt-4 p-4 rounded-lg bg-[var(--card)] border border-[var(--border)]">
        <p className="text-[12px] text-[var(--muted-foreground)]">
          Skill packs group related tools into reusable capability bundles. Disabled packs will not be available during conversations. Changes take effect on the next new conversation.
        </p>
      </div>
    </div>
  )
}
