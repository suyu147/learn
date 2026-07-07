'use client'

import { Save, Sparkles, RefreshCw, FileText, Eye } from 'lucide-react'

export default function CoWriterPage() {
  const markdownContent = `# SVD 分解学习笔记

## 1. 基本概念

奇异值分解（Singular Value Decomposition，简称 SVD）是线性代数中一种重要的矩阵分解方法。

对于任意 $m \\times n$ 矩阵 $A$，存在分解：

$$A = U \\Sigma V^T$$

其中：
- $U$ 是 $m \\times m$ 正交矩阵（左奇异向量）
- $\\Sigma$ 是 $m \\times n$ 对角矩阵（奇异值）
- $V^T$ 是 $n \\times n$ 正交矩阵（右奇异向量）

## 2. 几何意义

SVD 可以理解为对空间的一组变换：
1. **旋转**：$V^T$ 对输入空间进行旋转
2. **缩放**：$\\Sigma$ 在各轴方向进行缩放
3. **再旋转**：$U$ 将结果旋转到输出空间

## 3. 应用场景

- 数据压缩与降维
- 推荐系统（协同过滤）
- 图像压缩
- 自然语言处理（LSA）`

  const renderMarkdown = (md: string) => {
    // Simple markdown to HTML conversion
    return md
      .replace(/^### (.*$)/gim, '<h3 class="text-base font-semibold mt-4 mb-2">$1</h3>')
      .replace(/^## (.*$)/gim, '<h2 class="text-lg font-semibold mt-5 mb-3">$1</h2>')
      .replace(/^# (.*$)/gim, '<h1 class="text-xl font-bold mt-6 mb-4">$1</h1>')
      .replace(/^\- (.*$)/gim, '<li class="ml-4">$1</li>')
      .replace(/^\d\. (.*$)/gim, '<li class="ml-4 list-decimal">$1</li>')
      .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
      .replace(/\$\$(.*?)\$\$/gim, '<div class="my-3 p-3 bg-[var(--muted)] rounded-lg font-mono text-sm text-center">$1</div>')
      .replace(/\$(.*?)\$/gim, '<code class="px-1.5 py-0.5 bg-[var(--muted)] rounded text-[var(--primary)] text-[13px]">$1</code>')
      .replace(/\n\n/gim, '</p><p class="mb-3 leading-relaxed">')
  }

  return (
    <div className="flex h-full bg-[var(--background)] flex-col">
      {/* Toolbar */}
      <div className="border-b border-[var(--border)] px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileText className="h-4 w-4 text-[var(--primary)]" />
          <h1 className="text-[14px] font-semibold text-[var(--foreground)]">SVD 学习笔记.md</h1>
          <span className="text-[11px] text-[var(--success)] flex items-center gap-1">
            <Save className="h-3 w-3" />
            已保存
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button className="px-3 py-1.5 rounded-lg text-[13px] font-medium bg-[var(--muted)] text-[var(--foreground)] border border-[var(--border)] hover:bg-[var(--accent)] transition-colors flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5" />
            续写
          </button>
          <button className="px-3 py-1.5 rounded-lg text-[13px] font-medium bg-[var(--muted)] text-[var(--foreground)] border border-[var(--border)] hover:bg-[var(--accent)] transition-colors flex items-center gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" />
            改写
          </button>
          <button className="px-3 py-1.5 rounded-lg text-[13px] font-medium bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90 transition-opacity flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5" />
            总结
          </button>
        </div>
      </div>

      {/* Split Editor */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Pane - Source */}
        <div className="flex-1 flex flex-col border-r border-[var(--border)]">
          <div className="px-4 py-2 border-b border-[var(--border)] bg-[var(--card)] flex items-center gap-2">
            <FileText className="h-3.5 w-3.5 text-[var(--muted-foreground)]" />
            <span className="text-[12px] font-medium text-[var(--muted-foreground)]">Markdown 源文件</span>
          </div>
          <div className="flex-1 overflow-y-auto p-6">
            <pre className="font-mono text-[13px] text-[var(--foreground)] leading-relaxed whitespace-pre-wrap">
              {markdownContent}
            </pre>
          </div>
        </div>

        {/* Right Pane - Preview */}
        <div className="flex-1 flex flex-col">
          <div className="px-4 py-2 border-b border-[var(--border)] bg-[var(--card)] flex items-center gap-2">
            <Eye className="h-3.5 w-3.5 text-[var(--muted-foreground)]" />
            <span className="text-[12px] font-medium text-[var(--muted-foreground)]">实时预览</span>
          </div>
          <div className="flex-1 overflow-y-auto p-6">
            <div
              className="prose prose-sm max-w-none text-[var(--foreground)]"
              dangerouslySetInnerHTML={{ __html: `<p class="mb-3 leading-relaxed">${renderMarkdown(markdownContent)}</p>` }}
            />
          </div>
        </div>
      </div>

      {/* Status Bar */}
      <div className="border-t border-[var(--border)] px-6 py-2 flex items-center justify-between bg-[var(--card)]">
        <div className="flex items-center gap-4 text-[11px] text-[var(--muted-foreground)]">
          <span>字数：487</span>
          <span>行数：32</span>
        </div>
        <div className="flex items-center gap-4 text-[11px] text-[var(--muted-foreground)]">
          <span>v3</span>
          <span>最近编辑 5 分钟前</span>
        </div>
      </div>
    </div>
  )
}
