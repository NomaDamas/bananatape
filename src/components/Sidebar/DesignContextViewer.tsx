"use client";

import { Fragment, type ReactNode, useMemo } from 'react';
import { cn } from '@/lib/utils';

interface DesignContextViewerProps {
  markdown: string;
  className?: string;
}

type Block =
  | { kind: 'heading'; level: 1 | 2 | 3 | 4; text: string }
  | { kind: 'paragraph'; text: string }
  | { kind: 'ul'; items: string[] }
  | { kind: 'ol'; items: string[] }
  | { kind: 'blockquote'; lines: string[] }
  | { kind: 'code'; language: string; text: string }
  | { kind: 'hr' };

const HEADING_RE = /^(#{1,4})\s+(.+?)\s*#*\s*$/;
const UL_RE = /^[-*+]\s+(.+)$/;
const OL_RE = /^\d+\.\s+(.+)$/;
const BLOCKQUOTE_RE = /^>\s?(.*)$/;
const HR_RE = /^\s*(-{3,}|\*{3,}|_{3,})\s*$/;
const FENCE_RE = /^```\s*([A-Za-z0-9_+-]*)\s*$/;

function parseMarkdown(source: string): Block[] {
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() === '') {
      i += 1;
      continue;
    }

    const fenceOpen = line.match(FENCE_RE);
    if (fenceOpen) {
      const language = (fenceOpen[1] ?? '').toLowerCase();
      const buffer: string[] = [];
      i += 1;
      while (i < lines.length && !FENCE_RE.test(lines[i])) {
        buffer.push(lines[i]);
        i += 1;
      }
      if (i < lines.length) i += 1;
      blocks.push({ kind: 'code', language, text: buffer.join('\n') });
      continue;
    }

    if (HR_RE.test(line)) {
      blocks.push({ kind: 'hr' });
      i += 1;
      continue;
    }

    const heading = line.match(HEADING_RE);
    if (heading) {
      const level = Math.min(heading[1].length, 4) as 1 | 2 | 3 | 4;
      blocks.push({ kind: 'heading', level, text: heading[2] });
      i += 1;
      continue;
    }

    if (UL_RE.test(line)) {
      const items: string[] = [];
      while (i < lines.length) {
        const m = lines[i].match(UL_RE);
        if (!m) break;
        items.push(m[1]);
        i += 1;
      }
      blocks.push({ kind: 'ul', items });
      continue;
    }

    if (OL_RE.test(line)) {
      const items: string[] = [];
      while (i < lines.length) {
        const m = lines[i].match(OL_RE);
        if (!m) break;
        items.push(m[1]);
        i += 1;
      }
      blocks.push({ kind: 'ol', items });
      continue;
    }

    if (BLOCKQUOTE_RE.test(line)) {
      const lineBuffer: string[] = [];
      while (i < lines.length) {
        const m = lines[i].match(BLOCKQUOTE_RE);
        if (!m) break;
        lineBuffer.push(m[1]);
        i += 1;
      }
      blocks.push({ kind: 'blockquote', lines: lineBuffer });
      continue;
    }

    const paragraphBuffer: string[] = [line];
    i += 1;
    while (i < lines.length) {
      const next = lines[i];
      if (
        next.trim() === '' ||
        HEADING_RE.test(next) ||
        UL_RE.test(next) ||
        OL_RE.test(next) ||
        BLOCKQUOTE_RE.test(next) ||
        HR_RE.test(next) ||
        FENCE_RE.test(next)
      ) {
        break;
      }
      paragraphBuffer.push(next);
      i += 1;
    }
    blocks.push({ kind: 'paragraph', text: paragraphBuffer.join(' ') });
  }

  return blocks;
}

// Tokenizer for inline markdown. Renders to a React fragment of escaped text +
// styled spans. Never returns raw HTML, so XSS via injected tags is impossible:
// every text segment ends up as a React string child, which React escapes.
function renderInline(text: string, keyPrefix: string): ReactNode {
  const nodes: ReactNode[] = [];
  let buffer = '';
  let i = 0;
  let nodeKey = 0;

  const flushText = () => {
    if (buffer.length === 0) return;
    nodes.push(<Fragment key={`${keyPrefix}-t${nodeKey++}`}>{buffer}</Fragment>);
    buffer = '';
  };

  while (i < text.length) {
    const rest = text.slice(i);

    if (rest.startsWith('`')) {
      const end = rest.indexOf('`', 1);
      if (end > 0) {
        flushText();
        nodes.push(
          <code key={`${keyPrefix}-c${nodeKey++}`} className="rounded bg-[#1e1e1e] px-1 py-0.5 text-[10.5px] text-[#86efac]">
            {rest.slice(1, end)}
          </code>,
        );
        i += end + 1;
        continue;
      }
    }

    if (rest.startsWith('**') || rest.startsWith('__')) {
      const marker = rest.slice(0, 2);
      const end = rest.indexOf(marker, 2);
      if (end > 2) {
        flushText();
        nodes.push(
          <strong key={`${keyPrefix}-b${nodeKey++}`} className="font-semibold text-[#f3f3f3]">
            {renderInline(rest.slice(2, end), `${keyPrefix}-b${nodeKey}`)}
          </strong>,
        );
        i += end + 2;
        continue;
      }
    }

    if ((rest.startsWith('*') && !rest.startsWith('**')) || (rest.startsWith('_') && !rest.startsWith('__'))) {
      const marker = rest[0];
      const end = rest.indexOf(marker, 1);
      if (end > 1) {
        flushText();
        nodes.push(
          <em key={`${keyPrefix}-i${nodeKey++}`} className="italic text-[#dcdcdc]">
            {renderInline(rest.slice(1, end), `${keyPrefix}-i${nodeKey}`)}
          </em>,
        );
        i += end + 1;
        continue;
      }
    }

    // Links: [text](url) — rendered as plain text "text (url)" because the
    // viewer never produces clickable hrefs (no DOM attribute injection risk).
    if (rest.startsWith('[')) {
      const closeBracket = rest.indexOf(']');
      if (closeBracket > 0 && rest[closeBracket + 1] === '(') {
        const closeParen = rest.indexOf(')', closeBracket + 2);
        if (closeParen > 0) {
          const linkText = rest.slice(1, closeBracket);
          const url = rest.slice(closeBracket + 2, closeParen).trim();
          flushText();
          nodes.push(
            <Fragment key={`${keyPrefix}-l${nodeKey++}`}>
              {linkText}
              {url ? <span className="text-[#7a7a7a]"> ({url})</span> : null}
            </Fragment>,
          );
          i += closeParen + 1;
          continue;
        }
      }
    }

    buffer += text[i];
    i += 1;
  }

  flushText();
  return nodes.length > 0 ? <>{nodes}</> : null;
}

export function DesignContextViewer({ markdown, className }: DesignContextViewerProps) {
  const blocks = useMemo(() => parseMarkdown(markdown), [markdown]);

  return (
    <div
      data-testid="design-context-viewer"
      role="region"
      aria-label="Design context"
      className={cn('select-text space-y-2 text-xs leading-5 text-[#cfcfcf]', className)}
    >
      {blocks.map((block, index) => {
        const key = `block-${index}`;
        switch (block.kind) {
          case 'heading': {
            const sizeClass = block.level === 1
              ? 'text-sm font-semibold tracking-tight text-[#f3f3f3]'
              : block.level === 2
              ? 'text-[13px] font-semibold tracking-tight text-[#ededed]'
              : block.level === 3
              ? 'text-xs font-semibold uppercase tracking-wider text-[#cfcfcf]'
              : 'text-[11px] font-semibold uppercase tracking-wider text-[#a8a8a8]';
            const Tag = (`h${block.level}` as 'h1' | 'h2' | 'h3' | 'h4');
            return (
              <Tag key={key} className={cn('mt-3 first:mt-0', sizeClass)}>
                {renderInline(block.text, key)}
              </Tag>
            );
          }
          case 'paragraph':
            return (
              <p key={key} className="text-[#cfcfcf]">
                {renderInline(block.text, key)}
              </p>
            );
          case 'ul':
            return (
              <ul key={key} className="ml-4 list-disc space-y-1 text-[#cfcfcf] marker:text-[#666]">
                {block.items.map((item, itemIndex) => (
                  <li key={`${key}-i${itemIndex}`}>{renderInline(item, `${key}-i${itemIndex}`)}</li>
                ))}
              </ul>
            );
          case 'ol':
            return (
              <ol key={key} className="ml-4 list-decimal space-y-1 text-[#cfcfcf] marker:text-[#666]">
                {block.items.map((item, itemIndex) => (
                  <li key={`${key}-i${itemIndex}`}>{renderInline(item, `${key}-i${itemIndex}`)}</li>
                ))}
              </ol>
            );
          case 'blockquote':
            return (
              <blockquote key={key} className="border-l-2 border-white/10 pl-2 text-[#9e9e9e]">
                {block.lines.map((line, lineIndex) => (
                  <p key={`${key}-l${lineIndex}`}>{renderInline(line, `${key}-l${lineIndex}`)}</p>
                ))}
              </blockquote>
            );
          case 'code':
            return (
              <pre
                key={key}
                className="overflow-x-auto rounded-md border border-white/10 bg-[#171717] p-2 text-[10.5px] leading-4 text-[#86efac]"
                data-language={block.language || undefined}
              >
                <code>{block.text}</code>
              </pre>
            );
          case 'hr':
            return <hr key={key} className="my-3 border-white/10" />;
          default:
            return null;
        }
      })}
    </div>
  );
}
