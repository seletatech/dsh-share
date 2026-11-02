import { normalizeShareLocale, type ShareLocale } from './i18n.ts'

/** Host plugins own file URLs and authorization; they ask this sheet to send one file. */
export const FILE_SHARE_EVENT = 'dsh-share:file'
export const FILE_SHARE_LIMIT = 100 * 1024 * 1024

export interface FileShareRequest {
  /** Authorized same-origin URL of the original bytes. */
  href: string
  name?: string
  /** Sign-in link for colleagues who already have access; never a public URL. */
  link?: string
  /** The control that asked; desktop menus anchor to it and focus returns to it. */
  anchor?: HTMLElement
}

const TYPES: Record<string, string> = {
  pdf: 'application/pdf', doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp',
  svg: 'image/svg+xml', md: 'text/markdown', txt: 'text/plain', csv: 'text/csv',
  json: 'application/json', html: 'text/html', htm: 'text/html', zip: 'application/zip',
  mp4: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm', mp3: 'audio/mpeg', m4a: 'audio/mp4',
}

const extension = (name = ''): string => name.split('.').at(-1)!.toLowerCase()
/** Browsers can place only PNG (from these images) and plain text on the clipboard. */
export const copiesAsImage = (name?: string): boolean => ['png', 'jpg', 'jpeg', 'webp'].includes(extension(name))
export const copiesAsText = (name?: string): boolean => ['txt', 'md', 'csv', 'json'].includes(extension(name))

const STRINGS = {
  zh: {
    title: '发送文件', close: '关闭', preparing: '正在准备文件…', share: '分享…', copyImage: '复制图片', copyText: '复制文字',
    copyLink: '复制链接', download: '下载', retry: '重试',
    denied: '登录已失效或没有文件权限，请刷新后重试', failed: '文件准备失败，请重试', timeout: '文件准备超时，请重试。',
    tooLarge: '文件超过 100 MB，请下载后发送', encoding: '文字编码暂不支持复制，请下载原文件。',
    invalid: '文件地址不可用', imageLarge: '图片过大，请下载后发送', copyFailed: '未能复制，请下载后发送。',
    nativeFailed: '未能打开系统分享，请下载后发送。',
    inApp: '在微信或企业微信内无法下载文件，请复制链接，或在浏览器中打开后下载。',
    unsupported: '此浏览器不能直接分享这类文件，请下载后在微信或企业微信中发送。',
    imageCopied: '图片已复制，可粘贴到微信或企业微信', textCopied: '文字已复制，可粘贴到微信或企业微信',
    linkCopied: '链接已复制，有权限的同事登录后可打开',
    linkFailed: '未能自动复制，请手动复制链接：',
  },
  en: {
    title: 'Send file', close: 'Close', preparing: 'Preparing file…', share: 'Share…', copyImage: 'Copy image', copyText: 'Copy text',
    copyLink: 'Copy link', download: 'Download', retry: 'Retry',
    denied: 'Your session expired or you lack access to this file. Refresh and try again.', failed: 'Could not prepare the file. Try again.', timeout: 'Preparing the file timed out. Try again.',
    tooLarge: 'This file is over 100 MB. Download it to send.', encoding: 'This text encoding cannot be copied. Download the original file.',
    invalid: 'File address unavailable', imageLarge: 'This image is too large. Download it to send.', copyFailed: 'Could not copy. Download the file to send it.',
    nativeFailed: 'Could not open system sharing. Download the file to send it.',
    inApp: 'Files cannot be downloaded inside WeChat or WeCom. Copy the link, or open this page in a browser to download.',
    unsupported: 'This browser cannot share this kind of file directly. Download it, then send it in WeChat or WeCom.',
    imageCopied: 'Image copied. Paste it into WeChat or WeCom.', textCopied: 'Text copied. Paste it into WeChat or WeCom.',
    linkCopied: 'Link copied. Colleagues with access can open it after signing in.',
    linkFailed: 'Could not copy automatically. Copy the link:',
  },
} as const

export type FileShareStrings = (typeof STRINGS)[ShareLocale]

export function fileShareStrings(locale: ShareLocale): FileShareStrings {
  return STRINGS[locale]
}

export function shareFileName(disposition: string | null, fallback = 'file'): string {
  const value = /filename\*=UTF-8''([^;]+)/i.exec(disposition ?? '')
  let name = fallback
  if (value) {
    try { name = decodeURIComponent(value[1]!) } catch { /* keep the fallback name */ }
  }
  return name.split(/[\\/]/).at(-1)!.replace(/[\x00-\x1f\x7f]/g, '') || fallback
}

/** Reads unchanged authorized bytes; only same-origin paths may be requested. */
export async function readShareFile(
  href: string, name: string | undefined, signal: AbortSignal, strings: FileShareStrings, origin = location.origin,
): Promise<File> {
  const url = new URL(href, origin)
  if (url.origin !== origin) throw new Error(strings.invalid)
  const response = await fetch(url.pathname + url.search, { credentials: 'same-origin', signal, redirect: 'error' })
  if (!response.ok) throw new Error(response.status === 401 || response.status === 403 ? strings.denied : strings.failed)
  if (Number(response.headers.get('content-length')) > FILE_SHARE_LIMIT) throw new Error(strings.tooLarge)
  const reader = response.body?.getReader()
  if (!reader) throw new Error(strings.failed)
  const chunks: BlobPart[] = []
  let bytes = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      bytes += value.length
      if (bytes > FILE_SHARE_LIMIT) throw new Error(strings.tooLarge)
      chunks.push(value)
    }
  } finally {
    await reader.cancel()
  }
  const finalName = shareFileName(response.headers.get('content-disposition'), name)
  return new File(chunks, finalName, { type: TYPES[extension(finalName)] ?? 'application/octet-stream' })
}

/** Markdown becomes chat-readable text; values and private-link labels stay, link targets do not. */
export function chatText(text: string): string {
  return text
    .replace(/\[\[(?:cite|evidence)[^\]]*\]\]/g, '')
    .replace(/!\[([^\]]*)\]\([^\n]*?\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^\n]*?\)/g, '$1')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/\*\*([^\n]*?)\*\*/g, '$1')
    .replace(/^[\t ]*\|?[\t :|-]+\|[\t :|-]*$/gm, '')
    .replace(/^[\t ]*\|(.+)\|[\t ]*$/gm, (_line, row: string) => row.split('|').map(cell => cell.trim()).join('；'))
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export async function copyableFileText(file: File, strings: FileShareStrings): Promise<string> {
  if (file.size > 2 * 1024 * 1024 || !/^(?:text\/(?:plain|markdown|csv)|application\/json)$/.test(file.type)) return ''
  let text: string
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer())
  } catch {
    throw new Error(strings.encoding)
  }
  return file.type === 'text/markdown' ? chatText(text) : text
}

export function canShareFile(file: File): boolean {
  try {
    return Boolean('share' in navigator && navigator.canShare?.({ files: [file] }))
  } catch {
    return false
  }
}

async function pngBlob(file: File, strings: FileShareStrings): Promise<Blob> {
  const image = await createImageBitmap(file)
  try {
    if (image.width * image.height > 32 * 1024 * 1024) throw new Error(strings.imageLarge)
    const canvas = document.createElement('canvas')
    canvas.width = image.width
    canvas.height = image.height
    canvas.getContext('2d')!.drawImage(image, 0, 0)
    return await new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error(strings.copyFailed)), 'image/png'))
  } finally {
    image.close()
  }
}

const GLYPHS: Record<string, string> = {
  share: 'M12 15V3m-4 4 4-4 4 4M5 11v9h14v-9',
  copy: 'M8 8h12v13H8z M4 16H2V2h12v2',
  link: 'M10 14a4 4 0 0 0 6 .4l3-3a4 4 0 0 0-5.7-5.7l-1.7 1.7M14 10a4 4 0 0 0-6-.4l-3 3a4 4 0 0 0 5.7 5.7l1.7-1.7',
  download: 'M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4',
}

function glyph(document: Document, kind: string): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  for (const [key, value] of Object.entries({ width: '16', height: '16', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.7', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' })) svg.setAttribute(key, value)
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
  path.setAttribute('d', GLYPHS[kind]!)
  svg.append(path)
  return svg
}

const STYLE = `
[data-dsh-file-share-menu] { background: var(--dsw-alias-bg-base, #fff); border: 1px solid var(--dsw-alias-border-l2, rgba(127,127,127,.22)); border-radius: 12px; box-shadow: 0 8px 24px rgba(15,17,21,.12); box-sizing: border-box; color: var(--dsw-alias-label-primary, #0f1115); display: grid; font-size: 14px; inset: auto; margin: 0; min-width: 160px; padding: 4px; position: fixed; z-index: 9999; }
[data-dsh-file-share-menu] button, [data-dsh-file-share] button { appearance: none; background: transparent; border: 0; color: inherit; cursor: pointer; font: inherit; }
[data-dsh-file-share-menu] button:disabled, [data-dsh-file-share] button:disabled { cursor: default; opacity: .5; }
[data-dsh-file-share-menu] button:focus-visible, [data-dsh-file-share] button:focus-visible { outline: 2px solid var(--dsw-focus-ring-color, #4d6bfe); outline-offset: 2px; }
[data-dsh-file-share-item] { align-items: center; border-radius: 8px; display: flex; gap: 8px; min-height: 36px; padding: 0 10px; text-align: start; white-space: nowrap; }
[data-dsh-file-share-item] svg { color: var(--dsw-alias-label-secondary, #61666b); flex: none; }
[data-dsh-file-share-item]:hover:not(:disabled) { background: var(--dsw-alias-interactive-bg-hover, rgba(127,127,127,.12)); }
[data-dsh-file-share] { background: var(--dsw-alias-bg-base, #fff); border: 0; border-radius: 20px 20px 0 0; box-sizing: border-box; color: var(--dsw-alias-label-primary, #0f1115); font-size: 15px; line-height: 1.6; margin: auto 0 0; max-height: calc(100dvh - 24px); max-width: none; overflow: auto; padding: 20px 20px max(20px, env(safe-area-inset-bottom)); width: 100%; }
[data-dsh-file-share]::backdrop { background: var(--dsw-alias-bg-mask-1, rgba(0,0,0,.48)); }
[data-dsh-file-share] * { box-sizing: border-box; }
[data-dsh-file-share-head] { align-items: center; display: flex; gap: 12px; justify-content: space-between; margin-bottom: 4px; }
[data-dsh-file-share-name] { font-weight: 500; min-width: 0; overflow-wrap: anywhere; }
[data-dsh-file-share-close] { border-radius: 8px; flex: none; font-size: 22px !important; height: 32px; line-height: 1; width: 32px; }
[data-dsh-file-share-meta], [data-dsh-file-share-note] { color: var(--dsw-alias-label-tertiary, #81858c); font-size: 13px; margin: 0 0 16px; }
[data-dsh-file-share-note] { margin: 12px 0 0; }
[data-dsh-file-share-actions] { display: grid; gap: 8px; }
[data-dsh-file-share-action] { align-items: center; border: 1px solid var(--dsw-alias-border-l2, rgba(127,127,127,.22)) !important; border-radius: 12px; display: flex; gap: 10px; height: 48px; justify-content: center; }
[data-dsh-file-share-action="primary"] { background: var(--dsw-alias-button-primary-fill, #0f1115) !important; border-color: transparent !important; color: var(--dsw-alias-label-primary-inverted, #fff) !important; }
[data-dsh-file-share-error] { color: var(--dsw-alias-state-error-primary, #ec1313); font-size: 13px; margin: 0 0 12px; overflow-wrap: anywhere; }
[data-dsh-file-share-toast] { background: var(--dsw-alias-bg-base, #fff); border: 1px solid var(--dsw-alias-border-l2, rgba(127,127,127,.22)); border-radius: 12px; bottom: max(24px, env(safe-area-inset-bottom)); box-shadow: 0 6px 28px rgba(15,17,21,.14); box-sizing: border-box; color: var(--dsw-alias-label-primary, #0f1115); font-size: 14px; left: 16px; margin: 0 auto; max-width: min(440px, calc(100vw - 32px)); overflow-wrap: anywhere; padding: 10px 16px; position: fixed; right: 16px; width: fit-content; z-index: 10000; }
[data-dsh-file-share-selectable] { background: transparent; border: 1px solid var(--dsw-alias-border-l2, rgba(127,127,127,.22)); border-radius: 8px; color: inherit; display: block; font: inherit; font-size: 13px; margin-top: 8px; padding: 6px 8px; width: min(380px, calc(100vw - 64px)); }
[data-dsh-file-share-toast][data-error] { color: var(--dsw-alias-state-error-primary, #ec1313); }
`

export interface FileShareEnvironment {
  mobile: boolean
  /** WeChat and WeCom in-app browsers block downloads and expose no system share sheet. */
  inApp: boolean
}

export function fileShareEnvironment(nav: Navigator = navigator): FileShareEnvironment {
  const agent = nav.userAgent ?? ''
  const data = (nav as Navigator & { userAgentData?: { mobile?: boolean } }).userAgentData
  return {
    mobile: Boolean(data?.mobile || /Android|iPhone|iPad|iPod/.test(agent) || (nav.platform === 'MacIntel' && nav.maxTouchPoints > 1)),
    inApp: /MicroMessenger|wxwork/i.test(agent),
  }
}

/** Desktop menu entries: only what a browser can actually do with this file. */
export function desktopActions(request: Pick<FileShareRequest, 'name' | 'link'>): Array<'copyImage' | 'copyText' | 'copyLink' | 'download'> {
  return [
    ...copiesAsImage(request.name) ? ['copyImage' as const] : copiesAsText(request.name) ? ['copyText' as const] : [],
    ...request.link ? ['copyLink' as const] : [],
    'download' as const,
  ]
}

/** Show our own wording; browser clipboard errors are not user-facing text. */
function ownMessage(error: unknown, strings: FileShareStrings): string {
  const message = (error as Error)?.message
  return Object.values(strings).includes(message as never) ? message : strings.copyFailed
}

function startDownload(target: Document, href: string): void {
  const link = target.createElement('a')
  link.href = href
  link.download = ''
  target.body.append(link)
  link.click()
  link.remove()
}

/** Installs the file-send menu (desktop) and sheet (mobile) behind FILE_SHARE_EVENT. */
export function installFileShare(target: Document, getLocale: () => string): () => void {
  const style = target.createElement('style')
  style.id = 'dsh-file-share-style'
  style.textContent = STYLE
  target.head.append(style)
  let current: (() => void) | undefined
  let toastTimer: ReturnType<typeof setTimeout> | undefined
  let toastNode: HTMLElement | undefined

  const toast = (message: string, error = false, selectable?: string): void => {
    toastNode?.remove()
    const node = target.createElement('div')
    node.dataset.dshFileShareToast = ''
    if (error) node.dataset.error = ''
    node.setAttribute('role', error ? 'alert' : 'status')
    node.textContent = message
    target.body.append(node)
    toastNode = node
    clearTimeout(toastTimer)
    if (selectable) {
      // Clipboard denied: keep the value on screen, selected, until dismissed.
      const field = target.createElement('input')
      field.readOnly = true
      field.value = selectable
      field.dataset.dshFileShareSelectable = ''
      field.addEventListener('blur', () => node.remove())
      node.append(field)
      field.focus()
      field.select()
      return
    }
    toastTimer = setTimeout(() => node.remove(), 6000)
  }

  const copyLink = async (link: string, strings: FileShareStrings): Promise<void> => {
    try {
      await navigator.clipboard.writeText(link)
      toast(strings.linkCopied)
    } catch {
      toast(strings.linkFailed, false, link)
    }
  }

  const item = (label: string, kind: string, run: () => void): HTMLButtonElement => {
    const button = target.createElement('button')
    button.type = 'button'
    button.append(glyph(target, kind), label)
    button.addEventListener('click', run)
    return button
  }

  const openMenu = (request: FileShareRequest, strings: FileShareStrings): void => {
    const menu = target.createElement('div')
    menu.dataset.dshFileShareMenu = ''
    menu.setAttribute('role', 'menu')
    menu.setAttribute('aria-label', strings.title)
    const close = (restore = true): void => {
      target.removeEventListener('pointerdown', outside, true)
      menu.remove()
      if (current === close) current = undefined
      if (restore) request.anchor?.focus()
    }
    const outside = (event: Event): void => {
      if (!menu.contains(event.target as Node) && !request.anchor?.contains(event.target as Node)) close(false)
    }
    const run = (action: () => Promise<void> | void) => () => { close(); void action() }
    const fetched = (): Promise<File> => readShareFile(request.href, request.name, new AbortController().signal, strings)
    const actions = {
      copyImage: item(strings.copyImage, 'copy', run(async () => {
        try {
          // The clipboard write starts inside the click; the bytes arrive through the promise.
          await navigator.clipboard.write([new ClipboardItem({ 'image/png': fetched().then(file => pngBlob(file, strings)) })])
          toast(strings.imageCopied)
        } catch (error) {
          toast(ownMessage(error, strings), true)
        }
      })),
      copyText: item(strings.copyText, 'copy', run(async () => {
        try {
          const text = fetched().then(file => copyableFileText(file, strings)).then(value => new Blob([value], { type: 'text/plain' }))
          await navigator.clipboard.write([new ClipboardItem({ 'text/plain': text })])
          toast(strings.textCopied)
        } catch (error) {
          toast(ownMessage(error, strings), true)
        }
      })),
      copyLink: item(strings.copyLink, 'link', run(() => copyLink(request.link!, strings))),
      download: item(strings.download, 'download', run(() => startDownload(target, request.href))),
    }
    for (const key of desktopActions(request)) {
      const button = actions[key]
      button.dataset.dshFileShareItem = key
      button.setAttribute('role', 'menuitem')
      menu.append(button)
    }
    menu.addEventListener('keydown', event => {
      const items = [...menu.querySelectorAll<HTMLButtonElement>('[role=menuitem]')]
      const index = items.indexOf(target.activeElement as HTMLButtonElement)
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close() }
      else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault()
        items[(index + (event.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length]?.focus()
      } else if (event.key === 'Tab') close(false)
    })
    menu.addEventListener('click', event => event.stopPropagation())
    target.body.append(menu)
    const anchor = request.anchor?.getBoundingClientRect()
    const view = target.defaultView!
    const width = menu.offsetWidth, height = menu.offsetHeight
    const left = anchor ? Math.min(Math.max(8, anchor.right - width), view.innerWidth - width - 8) : (view.innerWidth - width) / 2
    const below = anchor ? anchor.bottom + 4 : (view.innerHeight - height) / 2
    menu.style.left = `${left}px`
    menu.style.top = `${anchor && below + height > view.innerHeight - 8 ? Math.max(8, anchor.top - height - 4) : below}px`
    target.addEventListener('pointerdown', outside, true)
    menu.querySelector<HTMLButtonElement>('[role=menuitem]')?.focus()
    current = close
  }

  const openSheet = (request: FileShareRequest, strings: FileShareStrings, environment: FileShareEnvironment): void => {
    const abort = new AbortController()
    const dialog = target.createElement('dialog')
    dialog.dataset.dshFileShare = ''
    dialog.setAttribute('aria-label', strings.title)
    const close = (): void => {
      abort.abort()
      dialog.close()
      dialog.remove()
      if (current === close) current = undefined
      request.anchor?.focus()
    }
    const head = target.createElement('div')
    head.dataset.dshFileShareHead = ''
    const title = target.createElement('div')
    title.dataset.dshFileShareName = ''
    title.textContent = request.name ?? strings.title
    const closeButton = target.createElement('button')
    closeButton.type = 'button'
    closeButton.dataset.dshFileShareClose = ''
    closeButton.setAttribute('aria-label', strings.close)
    closeButton.textContent = '×'
    closeButton.addEventListener('click', close)
    head.append(title, closeButton)
    const meta = target.createElement('p')
    meta.dataset.dshFileShareMeta = ''
    meta.setAttribute('role', 'status')
    const actions = target.createElement('div')
    actions.dataset.dshFileShareActions = ''
    const note = target.createElement('p')
    note.dataset.dshFileShareNote = ''
    const action = (label: string, kind: string, run: () => void, primary = false): HTMLButtonElement => {
      const button = item(label, kind, run)
      button.dataset.dshFileShareAction = primary ? 'primary' : ''
      return button
    }
    dialog.append(head, meta, actions, note)
    dialog.addEventListener('cancel', event => { event.preventDefault(); close() })
    dialog.addEventListener('mousedown', event => { if (event.target === dialog) close() })
    dialog.addEventListener('click', event => event.stopPropagation())
    target.body.append(dialog)
    dialog.showModal()
    current = close

    const link = request.link ? action(strings.copyLink, 'link', () => { close(); void copyLink(request.link!, strings) }, environment.inApp) : undefined
    const download = action(strings.download, 'download', () => { close(); startDownload(target, request.href) })
    if (environment.inApp) {
      // No system sheet here and downloads are blocked: the link is the useful route.
      actions.append(...link ? [link] : [])
      note.textContent = strings.inApp
      return
    }
    const share = action(strings.share, 'share', async () => {
      if (!file) return
      try {
        await navigator.share({ files: [file] })
        close()
      } catch (error) {
        if ((error as Error).name !== 'AbortError') { meta.dataset.dshFileShareError = ''; meta.textContent = strings.nativeFailed }
      }
    }, true)
    share.disabled = true
    meta.textContent = strings.preparing
    actions.append(share, ...link ? [link] : [], download)
    let file: File | undefined
    const timeout = setTimeout(() => abort.abort(), 120000)
    void readShareFile(request.href, request.name, abort.signal, strings).then(value => {
      if (abort.signal.aborted) return
      file = value
      title.textContent = value.name
      meta.textContent = `${extension(value.name).toUpperCase()} · ${formatSize(value.size)}`
      if (canShareFile(value)) share.disabled = false
      else { share.remove(); download.dataset.dshFileShareAction = 'primary'; actions.prepend(download); note.textContent = strings.unsupported }
    }, error => {
      if (!dialog.isConnected) return
      share.remove()
      meta.dataset.dshFileShareError = ''
      meta.textContent = abort.signal.aborted ? strings.timeout : (error as Error).message || strings.failed
    }).finally(() => clearTimeout(timeout))
  }

  const onRequest = (event: Event): void => {
    const request = (event as CustomEvent<FileShareRequest>).detail
    if (typeof request?.href !== 'string') return
    current?.()
    const strings = fileShareStrings(normalizeShareLocale(getLocale()))
    const environment = fileShareEnvironment()
    if (environment.mobile || environment.inApp) openSheet(request, strings, environment)
    else openMenu(request, strings)
  }
  target.defaultView!.addEventListener(FILE_SHARE_EVENT, onRequest)
  return () => {
    target.defaultView!.removeEventListener(FILE_SHARE_EVENT, onRequest)
    current?.()
    clearTimeout(toastTimer)
    toastNode?.remove()
    style.remove()
  }
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
