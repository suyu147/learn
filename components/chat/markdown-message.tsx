'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { CodeBlock } from '@/components/ai-elements/code-block';
import { type BundledLanguage } from 'shiki';
import { type ComponentPropsWithoutRef } from 'react';

const SUPPORTED_LANGUAGES: Set<string> = new Set([
  'abap', 'actionscript-3', 'ada', 'angular-html', 'angular-ts',
  'apache', 'apex', 'apl', 'applescript', 'ara',
  'asciidoc', 'asm', 'astro', 'awk', 'ballerina',
  'bat', 'beancount', 'berry', 'bibtex', 'bicep',
  'blade', 'c', 'cadence', 'clarity', 'clojure',
  'cmake', 'cobol', 'codeowners', 'coffeescript', 'common-lisp',
  'coq', 'cpp', 'crystal', 'csharp', 'css',
  'csv', 'cue', 'cypher', 'd', 'dart',
  'dax', 'diff', 'docker', 'dream-maker', 'elixir',
  'elm', 'erb', 'erlang', 'fennel', 'fish',
  'fluent', 'fortran-fixed', 'fortran-free', 'fsharp', 'gdresource',
  'gdscript', 'gdshader', 'gherkin', 'git-commit', 'git-rebase',
  'gleam', 'glimmer-js', 'glimmer-ts', 'glsl', 'gnuplot',
  'go', 'graphql', 'groovy', 'hack', 'haml',
  'handlebars', 'haskell', 'hcl', 'hlsl', 'hoon',
  'html', 'http', 'imba', 'ini', 'java',
  'javascript', 'jinja', 'jison', 'json', 'json5',
  'jsonc', 'jsonl', 'jssm', 'jsx', 'julia',
  'kotlin', 'kusto', 'latex', 'less', 'liquid',
  'lisp', 'logo', 'lua', 'luau', 'make',
  'markdown', 'marko', 'matlab', 'mdc', 'mermaid',
  'mipsasm', 'mojo', 'move', 'narrat', 'nextflow',
  'nginx', 'nim', 'nix', 'nushell', 'objective-c',
  'objective-cpp', 'ocaml', 'pascal', 'perl', 'php',
  'plsql', 'postcss', 'powerquery', 'powershell', 'prisma',
  'prolog', 'proto', 'pug', 'puppet', 'purescript',
  'python', 'r', 'racket', 'raku', 'razor',
  'reg', 'rel', 'riscv', 'rst', 'ruby',
  'rust', 'sas', 'sass', 'scala', 'scheme',
  'scss', 'shaderlab', 'shellscript', 'shellsession', 'smalltalk',
  'solidity', 'soy', 'sparql', 'splunk', 'sql',
  'ssh-config', 'stata', 'stylus', 'svelte', 'swift',
  'system-verilog', 'talonscript', 'tasl', 'terraform', 'tex',
  'toml', 'tsx', 'turtle', 'twig', 'typescript',
  'typst', 'v', 'vala', 'vb', 'verilog',
  'vhdl', 'viml', 'vue', 'vue-html', 'vyper',
  'wasm', 'wenyan', 'wgsl', 'wolfram', 'xml',
  'xsl', 'yaml', 'zenscript', 'zig',
]);

function resolveLanguage(lang: string | undefined): BundledLanguage {
  if (!lang) return 'text' as BundledLanguage;
  const lower = lang.toLowerCase();
  if (SUPPORTED_LANGUAGES.has(lower)) return lower as BundledLanguage;

  const aliases: Record<string, string> = {
    js: 'javascript',
    ts: 'typescript',
    py: 'python',
    rb: 'ruby',
    sh: 'shellscript',
    bash: 'shellscript',
    zsh: 'shellscript',
    yml: 'yaml',
    md: 'markdown',
    csharp: 'csharp',
    cs: 'csharp',
    cpp: 'cpp',
    cc: 'cpp',
    cxx: 'cpp',
    hs: 'haskell',
    kt: 'kotlin',
    rs: 'rust',
    go: 'go',
    golang: 'go',
    dockerfile: 'docker',
    makefile: 'make',
  };

  const resolved = aliases[lower];
  if (resolved && SUPPORTED_LANGUAGES.has(resolved)) return resolved as BundledLanguage;
  return 'text' as BundledLanguage;
}

function CodeComponent({ className, children, ...props }: ComponentPropsWithoutRef<'code'>) {
  const match = /language-(\w+)/.exec(className || '');
  const code = String(children).replace(/\n$/, '');

  if (match) {
    return (
      <div className="my-3 min-w-0 max-w-full overflow-x-auto">
        <CodeBlock className="min-w-0 max-w-full" code={code} language={resolveLanguage(match[1])} />
      </div>
    );
  }

  return (
    <code className="rounded bg-muted/60 px-1 py-0.5 text-[0.9em]" {...props}>
      {children}
    </code>
  );
}

export function MarkdownMessage({ content }: { content: string }) {
  return (
    <div className="min-w-0 prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap break-words prose-p:leading-7 prose-li:leading-7 prose-pre:p-0">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          pre: ({ children }) => <>{children}</>,
          code: CodeComponent,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
