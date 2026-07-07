'use client'

import { useState } from 'react'

export default function EmbeddingPage() {
  const [provider, setProvider] = useState('openai')

  return (
    <div className="p-6 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-[var(--foreground)] mb-1">嵌入模型设置</h1>
        <p className="text-[13px] text-[var(--muted-foreground)]">
          配置文本嵌入模型，用于知识库的语义索引和 RAG 检索
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <label className="text-[13px] font-medium text-[var(--foreground)]">嵌入模型提供商</label>
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
            className="w-full bg-[var(--card)] border border-[var(--border)] rounded-lg px-3 py-2 text-[13.5px] text-[var(--foreground)] outline-none focus:border-[var(--primary)]"
          >
            <option value="openai">OpenAI (text-embedding-3-small)</option>
            <option value="openai-large">OpenAI (text-embedding-3-large)</option>
            <option value="bge">BGE (BAAI/bge-large-zh)</option>
            <option value="jina">Jina Embeddings</option>
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-[13px] font-medium text-[var(--foreground)]">API Key</label>
          <input
            type="password"
            placeholder="输入嵌入模型 API Key"
            className="w-full bg-[var(--card)] border border-[var(--border)] rounded-lg px-3 py-2 text-[13.5px] text-[var(--foreground)] outline-none focus:border-[var(--primary)]"
          />
        </div>

        <div className="space-y-2">
          <label className="text-[13px] font-medium text-[var(--foreground)]">向量维度</label>
          <input
            type="text"
            defaultValue="1536"
            className="w-full bg-[var(--card)] border border-[var(--border)] rounded-lg px-3 py-2 text-[13.5px] text-[var(--foreground)] outline-none focus:border-[var(--primary)]"
          />
        </div>

        <div className="space-y-2">
          <label className="text-[13px] font-medium text-[var(--foreground)]">分块大小 (Chunk Size)</label>
          <input
            type="text"
            defaultValue="512"
            className="w-full bg-[var(--card)] border border-[var(--border)] rounded-lg px-3 py-2 text-[13.5px] text-[var(--foreground)] outline-none focus:border-[var(--primary)]"
          />
        </div>

        <div className="space-y-2">
          <label className="text-[13px] font-medium text-[var(--foreground)]">重叠大小 (Overlap)</label>
          <input
            type="text"
            defaultValue="64"
            className="w-full bg-[var(--card)] border border-[var(--border)] rounded-lg px-3 py-2 text-[13.5px] text-[var(--foreground)] outline-none focus:border-[var(--primary)]"
          />
        </div>
      </div>

      <div className="flex gap-3 mt-6">
        <button className="px-4 py-2 rounded-lg text-[13px] font-medium bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90 transition-opacity">
          应用更改
        </button>
        <button className="px-4 py-2 rounded-lg text-[13px] font-medium bg-[var(--muted)] text-[var(--foreground)] border border-[var(--border)] hover:bg-[var(--accent)] transition-colors">
          测试连接
        </button>
      </div>
    </div>
  )
}
