import { afterEach, describe, expect, it } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { DesignContextViewer } from '@/components/Sidebar/DesignContextViewer';

let mountedRoot: Root | null = null;
let mountedContainer: HTMLElement | null = null;

function render(markdown: string): HTMLElement {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(<DesignContextViewer markdown={markdown} />);
  });
  mountedRoot = root;
  mountedContainer = container;
  return container;
}

afterEach(() => {
  if (mountedRoot) {
    act(() => {
      mountedRoot!.unmount();
    });
  }
  if (mountedContainer && mountedContainer.parentNode) {
    mountedContainer.parentNode.removeChild(mountedContainer);
  }
  mountedRoot = null;
  mountedContainer = null;
});

describe('DesignContextViewer markdown rendering', () => {
  it('renders ATX headings as h1..h4', () => {
    const container = render('# H1\n## H2\n### H3\n#### H4');
    expect(container.querySelector('h1')?.textContent).toBe('H1');
    expect(container.querySelector('h2')?.textContent).toBe('H2');
    expect(container.querySelector('h3')?.textContent).toBe('H3');
    expect(container.querySelector('h4')?.textContent).toBe('H4');
  });

  it('renders unordered lists with one li per dash item', () => {
    const container = render('- alpha\n- beta\n- gamma');
    const items = container.querySelectorAll('ul > li');
    expect(items).toHaveLength(3);
    expect(items[0].textContent).toBe('alpha');
    expect(items[2].textContent).toBe('gamma');
  });

  it('renders ordered lists with one li per numbered item', () => {
    const container = render('1. first\n2. second');
    const ol = container.querySelector('ol');
    expect(ol).toBeTruthy();
    const items = ol!.querySelectorAll('li');
    expect(items).toHaveLength(2);
    expect(items[0].textContent).toBe('first');
  });

  it('renders bold and italic inline tokens', () => {
    const container = render('A **bold** and _italic_ word.');
    expect(container.querySelector('strong')?.textContent).toBe('bold');
    expect(container.querySelector('em')?.textContent).toBe('italic');
  });

  it('renders inline code spans', () => {
    const container = render('Use `pnpm install` to start.');
    const code = container.querySelector('code');
    expect(code).toBeTruthy();
    expect(code?.textContent).toBe('pnpm install');
  });

  it('renders fenced code blocks as pre/code', () => {
    const container = render('```ts\nconst x = 1;\n```');
    const pre = container.querySelector('pre');
    expect(pre).toBeTruthy();
    expect(pre?.getAttribute('data-language')).toBe('ts');
    expect(pre?.querySelector('code')?.textContent).toBe('const x = 1;');
  });

  it('renders blockquotes and horizontal rules', () => {
    const container = render('> note one\n> note two\n\n---');
    expect(container.querySelector('blockquote')).toBeTruthy();
    expect(container.querySelector('blockquote')?.textContent).toContain('note one');
    expect(container.querySelector('hr')).toBeTruthy();
  });

  it('renders markdown links as plain text plus URL hint, never as a real <a> href', () => {
    const container = render('See [the docs](https://example.com/) please.');
    expect(container.querySelector('a')).toBeNull();
    expect(container.textContent).toContain('the docs');
    expect(container.textContent).toContain('(https://example.com/)');
  });

  it('refuses to interpret raw HTML script tags injected through the markdown payload (XSS)', () => {
    const malicious = '# Heading\n\n<script>window.__pwned = true;</script>\n\nbody text';
    const container = render(malicious);
    expect(container.querySelector('script')).toBeNull();
    expect((window as unknown as { __pwned?: boolean }).__pwned).toBeUndefined();
    expect(container.textContent).toContain('<script>');
    expect(container.textContent).toContain('window.__pwned = true;');
  });

  it('does not render raw HTML img onerror payloads as DOM elements', () => {
    const malicious = '<img src=x onerror="window.__imgPwned = true">';
    const container = render(malicious);
    expect(container.querySelector('img')).toBeNull();
    expect((window as unknown as { __imgPwned?: boolean }).__imgPwned).toBeUndefined();
    expect(container.textContent).toContain('<img');
  });

  it('does not turn javascript: links into clickable anchors', () => {
    const container = render('[oops](javascript:alert(1))');
    expect(container.querySelector('a')).toBeNull();
    expect(container.textContent).toContain('oops');
    expect(container.textContent).toContain('javascript:alert(1)');
  });
});
