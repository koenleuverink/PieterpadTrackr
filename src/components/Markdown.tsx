import { useMemo } from 'react'
import { marked } from 'marked'
import DOMPurify from 'dompurify'

marked.setOptions({ breaks: true, gfm: true })

export function Markdown({ text, className = '' }: { text: string; className?: string }) {
  const html = useMemo(() => DOMPurify.sanitize(marked.parse(text ?? '', { async: false }) as string), [text])
  return <div className={`prose-diary ${className}`} dangerouslySetInnerHTML={{ __html: html }} />
}
