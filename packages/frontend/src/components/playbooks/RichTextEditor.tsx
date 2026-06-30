import { useCallback, useEffect, useRef, useState } from 'react';
import { Box, Button, CircularProgress, IconButton, Tooltip, Typography } from '@mui/material';
import FormatBoldIcon from '@mui/icons-material/FormatBold';
import FormatItalicIcon from '@mui/icons-material/FormatItalic';
import ImageIcon from '@mui/icons-material/Image';
import LinkIcon from '@mui/icons-material/Link';
import { useTranslation } from 'react-i18next';
import { uploadPlaybookImageWithFallback } from '../../utils/playbookImageUpload';

const IMG_MD_RE = /!\[([^\]]*)\]\(([^)]+)\)/g;
const LINK_MD_RE = /\[([^\]]*)\]\(([^)]+)\)/g;

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function isHttpUrl(str: string): boolean {
  try {
    const href = normalizeUrl(str);
    const parsed = new URL(href);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function normalizeUrl(str: string): string {
  const trimmed = str.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

/** Use attribute only — anchor.href is resolved by the browser and breaks validation. */
function getRawAnchorHref(anchor: HTMLAnchorElement): string {
  return (anchor.getAttribute('href') || '').trim();
}

function isIntentionalHttpLink(anchor: HTMLAnchorElement): boolean {
  const raw = getRawAnchorHref(anchor);
  return raw !== '' && isHttpUrl(raw);
}

/** Flatten [label](url) to label — preserves ![alt](url) image syntax. */
function stripMarkdownLinks(md: string): string {
  return md.replace(/(?<!!)\[([^\]]*)]\([^)]+\)/g, '$1');
}

function unwrapAnchor(anchor: HTMLAnchorElement) {
  const parent = anchor.parentNode;
  if (!parent) return;
  while (anchor.firstChild) {
    parent.insertBefore(anchor.firstChild, anchor);
  }
  parent.removeChild(anchor);
}

function unwrapInvalidAnchors(root: HTMLElement) {
  root.querySelectorAll('a').forEach((anchor) => {
    if (!isIntentionalHttpLink(anchor)) {
      unwrapAnchor(anchor);
    }
  });
}

function unwrapAllAnchors(root: HTMLElement) {
  root.querySelectorAll('a').forEach((anchor) => unwrapAnchor(anchor));
}

/** Remove inline colors/underlines from chat/AI clipboard HTML in plain-text comment mode. */
function stripSpuriousInlineStyles(root: HTMLElement) {
  root.querySelectorAll('[style]').forEach((node) => {
    const el = node as HTMLElement;
    el.style.removeProperty('color');
    el.style.removeProperty('text-decoration');
    el.style.removeProperty('text-decoration-line');
    el.style.removeProperty('-webkit-text-fill-color');
    if (!el.getAttribute('style')?.trim()) {
      el.removeAttribute('style');
    }
  });

  root.querySelectorAll('font').forEach((font) => {
    const parent = font.parentNode;
    if (!parent) return;
    while (font.firstChild) {
      parent.insertBefore(font.firstChild, font);
    }
    parent.removeChild(font);
  });
}

function sanitizePlainCommentEditor(root: HTMLElement) {
  unwrapAllAnchors(root);
  stripSpuriousInlineStyles(root);
}

function renderInlineMarkdown(text: string): string {
  if (!text) return '';

  const parts: string[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  const re = new RegExp(LINK_MD_RE.source, 'g');

  while ((match = re.exec(text)) !== null) {
    if (match.index > last) {
      parts.push(escapeHtml(text.slice(last, match.index)).replace(/\n/g, '<br>'));
    }
    const label = match[1] || match[2];
    const href = match[2];
    if (isHttpUrl(href)) {
      parts.push(
        `<a href="${escapeAttr(normalizeUrl(href))}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>`,
      );
    } else {
      parts.push(escapeHtml(match[0]));
    }
    last = re.lastIndex;
  }

  if (last < text.length) {
    parts.push(escapeHtml(text.slice(last)).replace(/\n/g, '<br>'));
  }

  return parts.join('');
}

function markdownToHtml(md: string): string {
  if (!md.trim()) return '';

  const parts: string[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  const re = new RegExp(IMG_MD_RE.source, 'g');

  while ((match = re.exec(md)) !== null) {
    if (match.index > last) {
      parts.push(renderInlineMarkdown(md.slice(last, match.index)));
    }
    const alt = escapeHtml(match[1] || 'image');
    const src = escapeAttr(match[2]);
    parts.push(`<img src="${src}" alt="${alt}" />`);
    last = re.lastIndex;
  }

  if (last < md.length) {
    parts.push(renderInlineMarkdown(md.slice(last)));
  }

  return parts.join('');
}

function serializeNode(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent || '';
  }
  if (node.nodeType !== Node.ELEMENT_NODE) {
    return '';
  }

  const el = node as HTMLElement;
  const tag = el.tagName;

  if (tag === 'IMG') {
    const img = el as HTMLImageElement;
    return `\n\n![${img.alt || 'image'}](${img.src})\n\n`;
  }
  if (tag === 'A') {
    const a = el as HTMLAnchorElement;
    const label = (a.textContent || '').trim();
    const rawHref = getRawAnchorHref(a);
    if (rawHref && isHttpUrl(rawHref)) {
      return `[${label || rawHref}](${normalizeUrl(rawHref)})`;
    }
    return label;
  }
  if (tag === 'BR') return '\n';
  if (tag === 'STRONG' || tag === 'B') return `**${el.textContent || ''}**`;
  if (tag === 'EM' || tag === 'I') return `*${el.textContent || ''}*`;
  if (tag === 'DIV' || tag === 'P') {
    const inner = Array.from(el.childNodes).map(serializeNode).join('');
    return inner ? `${inner}\n` : '\n';
  }

  return Array.from(el.childNodes).map(serializeNode).join('');
}

function htmlToMarkdown(html: string): string {
  const container = document.createElement('div');
  container.innerHTML = html;
  const text = serializeNode(container).replace(/\n{3,}/g, '\n\n').trim();
  return text;
}

function isEditorEmpty(el: HTMLElement): boolean {
  const text = (el.textContent || '').trim();
  const hasImage = el.querySelector('img');
  const hasLink = Array.from(el.querySelectorAll('a')).some((a) => isIntentionalHttpLink(a));
  return !text && !hasImage && !hasLink;
}

function getSelectionRange(editor: HTMLElement): Range {
  const sel = window.getSelection();
  if (sel && sel.rangeCount > 0 && editor.contains(sel.anchorNode)) {
    return sel.getRangeAt(0);
  }
  const range = document.createRange();
  range.selectNodeContents(editor);
  range.collapse(false);
  return range;
}

function restoreSelection(range: Range) {
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
}

function insertPlainTextAtSelection(editor: HTMLElement, text: string) {
  editor.focus();
  const range = getSelectionRange(editor);
  range.deleteContents();

  const lines = text.replace(/\r\n/g, '\n').split('\n');
  lines.forEach((line, index) => {
    if (line) {
      range.insertNode(document.createTextNode(line));
      range.collapse(false);
    }
    if (index < lines.length - 1) {
      const br = document.createElement('br');
      range.insertNode(br);
      range.collapse(false);
    }
  });

  restoreSelection(range);
}

interface Props {
  value: string;
  onChange: (markdown: string) => void;
  placeholder?: string;
  minHeight?: number;
  editorId?: string;
  showHint?: boolean;
  /** Paste non-URL text as plain text (avoids spurious link styling from chat/AI clipboard HTML). */
  preferPlainTextPaste?: boolean;
}

export default function RichTextEditor({
  value,
  onChange,
  placeholder,
  minHeight = 280,
  editorId,
  showHint = true,
  preferPlainTextPaste = false,
}: Props) {
  const { t } = useTranslation();
  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const lastEmitted = useRef(value);

  const emitChange = useCallback(() => {
    const el = editorRef.current;
    if (!el) return;
    if (preferPlainTextPaste) {
      sanitizePlainCommentEditor(el);
    } else {
      unwrapInvalidAnchors(el);
    }
    const empty = isEditorEmpty(el);
    el.dataset.empty = empty ? 'true' : 'false';
    let md = empty ? '' : htmlToMarkdown(el.innerHTML);
    if (preferPlainTextPaste && md) {
      md = stripMarkdownLinks(md);
    }
    lastEmitted.current = md;
    onChange(md);
  }, [onChange, preferPlainTextPaste]);

  const insertImageAtSelection = useCallback((url: string, alt: string) => {
    const el = editorRef.current;
    if (!el) return;

    el.focus();
    const range = getSelectionRange(el);
    range.deleteContents();

    const img = document.createElement('img');
    img.src = url;
    img.alt = alt;
    img.draggable = false;

    const spacer = document.createTextNode('\n');
    range.insertNode(spacer);
    range.insertNode(img);

    range.setStartAfter(spacer);
    range.collapse(true);
    restoreSelection(range);
    emitChange();
  }, [emitChange]);

  const insertLinkAtSelection = useCallback((href: string, label: string) => {
    const el = editorRef.current;
    if (!el) return;

    const normalized = normalizeUrl(href);
    if (!isHttpUrl(normalized)) return;

    el.focus();
    const range = getSelectionRange(el);
    range.deleteContents();

    const anchor = document.createElement('a');
    anchor.href = normalized;
    anchor.textContent = label || normalized;
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';

    range.insertNode(anchor);
    range.setStartAfter(anchor);
    range.collapse(true);
    restoreSelection(range);
    emitChange();
  }, [emitChange]);

  const handleImageFile = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) return;
    if (file.size > 5 * 1024 * 1024) {
      alert(t('playbooks.imageSizeError', 'Image size should be under 5MB'));
      return;
    }

    setUploading(true);
    try {
      const url = await uploadPlaybookImageWithFallback(file);
      insertImageAtSelection(url, file.name);
    } finally {
      setUploading(false);
    }
  }, [insertImageAtSelection, t]);

  const handleInsertLink = useCallback(() => {
    const el = editorRef.current;
    if (!el) return;

    const selected = window.getSelection()?.toString().trim() || '';
    const urlInput = window.prompt(
      t('playbooks.linkUrlPrompt', 'Enter URL (https://...)'),
      selected && isHttpUrl(selected) ? normalizeUrl(selected) : 'https://',
    );
    if (!urlInput?.trim()) return;

    const normalized = normalizeUrl(urlInput.trim());
    if (!isHttpUrl(normalized)) {
      alert(t('playbooks.linkUrlInvalid', 'Please enter a valid http or https URL'));
      return;
    }

    const labelInput = window.prompt(
      t('playbooks.linkTextPrompt', 'Link text (optional)'),
      selected && !isHttpUrl(selected) ? selected : normalized,
    );
    insertLinkAtSelection(normalized, labelInput?.trim() || normalized);
  }, [insertLinkAtSelection, t]);

  useEffect(() => {
    const el = editorRef.current;
    if (!el || value === lastEmitted.current) return;
    lastEmitted.current = value;
    const displayValue = preferPlainTextPaste ? stripMarkdownLinks(value) : value;
    el.innerHTML = markdownToHtml(displayValue) || '';
    if (preferPlainTextPaste) {
      sanitizePlainCommentEditor(el);
    }
    el.dataset.empty = isEditorEmpty(el) ? 'true' : 'false';
  }, [value, preferPlainTextPaste]);

  const runCommand = (command: string) => {
    editorRef.current?.focus();
    document.execCommand(command, false);
    emitChange();
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    const items = e.clipboardData?.items;
    if (items) {
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) void handleImageFile(file);
          return;
        }
      }
    }

    const plain = e.clipboardData?.getData('text/plain') ?? '';
    const trimmedPlain = plain.trim();

    if (trimmedPlain && isHttpUrl(trimmedPlain) && !preferPlainTextPaste) {
      e.preventDefault();
      insertLinkAtSelection(trimmedPlain, trimmedPlain);
      return;
    }

    if (preferPlainTextPaste) {
      e.preventDefault();
      const el = editorRef.current;
      if (!el) return;

      let text = e.clipboardData?.getData('text/plain') ?? '';
      if (!text.trim()) {
        const html = e.clipboardData?.getData('text/html') ?? '';
        if (html) {
          const container = document.createElement('div');
          container.innerHTML = html;
          sanitizePlainCommentEditor(container);
          text = container.textContent ?? '';
        }
      }

      if (text) {
        insertPlainTextAtSelection(el, text);
      }
      emitChange();
      return;
    }

    // Allow default paste (keeps links from rich HTML); normalize on next tick
    requestAnimationFrame(() => emitChange());
  };

  return (
    <Box>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.5,
          mb: 1,
          p: 0.5,
          border: '1px solid rgba(255,255,255,0.12)',
          borderBottom: 'none',
          borderTopLeftRadius: 8,
          borderTopRightRadius: 8,
          bgcolor: 'rgba(255,255,255,0.03)',
          flexWrap: 'wrap',
        }}
      >
        <Tooltip title={t('playbooks.bold', 'Bold')}>
          <IconButton size="small" onMouseDown={(ev) => ev.preventDefault()} onClick={() => runCommand('bold')}>
            <FormatBoldIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title={t('playbooks.italic', 'Italic')}>
          <IconButton size="small" onMouseDown={(ev) => ev.preventDefault()} onClick={() => runCommand('italic')}>
            <FormatItalicIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        {!preferPlainTextPaste && (
          <Tooltip title={t('playbooks.insertLink', 'Insert Link')}>
            <IconButton size="small" onMouseDown={(ev) => ev.preventDefault()} onClick={handleInsertLink}>
              <LinkIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleImageFile(file);
            e.target.value = '';
          }}
        />
        <Button
          size="small"
          startIcon={uploading ? <CircularProgress size={14} /> : <ImageIcon />}
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          sx={{ textTransform: 'none', ml: 0.5 }}
        >
          {uploading ? t('common.loading') : t('playbooks.insertImage', 'Insert Image')}
        </Button>
      </Box>

      <Box
        ref={editorRef}
        id={editorId}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline
        data-placeholder={placeholder}
        data-empty="true"
        onInput={emitChange}
        onBlur={emitChange}
        onPaste={handlePaste}
        onDrop={(ev) => {
          const file = ev.dataTransfer.files?.[0];
          if (file?.type.startsWith('image/')) {
            ev.preventDefault();
            void handleImageFile(file);
          }
        }}
        onDragOver={(ev) => {
          if (Array.from(ev.dataTransfer.types).includes('Files')) {
            ev.preventDefault();
          }
        }}
        sx={{
          minHeight,
          p: 2,
          border: '1px solid rgba(255,255,255,0.12)',
          borderBottomLeftRadius: 8,
          borderBottomRightRadius: 8,
          bgcolor: 'rgba(255,255,255,0.02)',
          fontSize: 14,
          lineHeight: 1.75,
          color: '#e2e8f0',
          outline: 'none',
          overflowY: 'auto',
          wordBreak: 'break-word',
          '&[data-empty="true"]:before': {
            content: 'attr(data-placeholder)',
            color: '#64748b',
            pointerEvents: 'none',
          },
          '& img': {
            display: 'block',
            maxWidth: '100%',
            maxHeight: 420,
            objectFit: 'contain',
            borderRadius: 1,
            my: 1,
          },
          ...(preferPlainTextPaste
            ? {
                '& a': {
                  color: 'inherit',
                  textDecoration: 'none',
                  cursor: 'text',
                  pointerEvents: 'none',
                },
              }
            : {
                '& a[href^="http"]': {
                  color: '#00d4aa',
                  textDecoration: 'underline',
                  cursor: 'pointer',
                },
              }),
        }}
      />

      {showHint && (
        <Typography variant="caption" sx={{ color: '#64748b', mt: 0.75, display: 'block' }}>
          {t('playbooks.contentRichHint', 'Type here. Paste images or URLs inline. Use the link button to add hyperlinks.')}
        </Typography>
      )}
    </Box>
  );
}
