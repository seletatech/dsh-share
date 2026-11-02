// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { chatText, copyableFileText, desktopActions, fileShareEnvironment, fileShareStrings, readShareFile, shareFileName } from '../src/client/file-share.ts'

const zh = fileShareStrings('zh')
const signal = new AbortController().signal

describe('文件发送', () => {
  it('保留原始字节和文件名，且只请求同源路径', async () => {
    const bytes = new Uint8Array([0, 128, 255])
    const fetcher = vi.fn(async () => new Response(bytes, { headers: { 'content-disposition': "attachment; filename*=UTF-8''%E8%B5%84%E6%96%99.pdf" } }))
    vi.stubGlobal('fetch', fetcher)
    const file = await readShareFile('https://a.test/x?id=1', 'f', signal, zh, 'https://a.test')
    expect(file.name).toBe('资料.pdf')
    expect(file.type).toBe('application/pdf')
    expect(fetcher).toHaveBeenCalledWith('/x?id=1', expect.objectContaining({ credentials: 'same-origin', redirect: 'error' }))
    await expect(readShareFile('https://evil.test/x', 'f', signal, zh, 'https://a.test')).rejects.toThrow(zh.invalid)
  })
  it('拒绝无权限响应和超大文件', async () => {
    vi.stubGlobal('fetch', async () => new Response('secret', { status: 403 }))
    await expect(readShareFile('/x', 'f', signal, zh, 'https://a.test')).rejects.toThrow(zh.denied)
    vi.stubGlobal('fetch', async () => new Response('x', { headers: { 'content-length': String(101 * 1024 * 1024) } }))
    await expect(readShareFile('/x', 'f', signal, zh, 'https://a.test')).rejects.toThrow(zh.tooLarge)
  })
  it('文件名去路径和控制字符', () => {
    expect(shareFileName("attachment; filename*=UTF-8''a%2Fb%0A.txt", 'f')).toBe('b.txt')
  })
  it('Markdown 转文字保留数值、不泄露链接目标；其他文本原样', async () => {
    const result = chatText('# 周报\n\n| 项目 | 数量 |\n|---|---|\n| A | 12 |\n\n[来源](/workspace/private.xlsx)')
    expect(result).toContain('A；12')
    expect(result).toContain('来源')
    expect(result).not.toContain('/workspace/')
    const literal = '{"a":"**保留**"}\n'
    expect(await copyableFileText(new File([literal], 'a.json', { type: 'application/json' }), zh)).toBe(literal)
    expect(await copyableFileText(new File(['x'], 'a.pdf', { type: 'application/pdf' }), zh)).toBe('')
  })
  it('电脑菜单只列浏览器真正能做的事', () => {
    expect(desktopActions({ name: '图.png' })).toEqual(['copyImage', 'download'])
    expect(desktopActions({ name: '表.csv', link: 'https://a.test/#file=1' })).toEqual(['copyText', 'copyLink', 'download'])
    expect(desktopActions({ name: '报告.xlsx' })).toEqual(['download'])
    expect(desktopActions({ name: '报告.pdf', link: 'x' })).toEqual(['copyLink', 'download'])
  })
  it('识别手机和微信、企业微信内置浏览器', () => {
    const env = (userAgent: string, extra = {}) => fileShareEnvironment({ userAgent, platform: '', maxTouchPoints: 0, ...extra } as Navigator)
    expect(env('Mozilla/5.0 (iPhone) MicroMessenger/8.0')).toEqual({ mobile: true, inApp: true })
    expect(env('Mozilla/5.0 (Windows) wxwork/4.1')).toEqual({ mobile: false, inApp: true })
    expect(env('Mozilla/5.0 (Macintosh)', { platform: 'MacIntel', maxTouchPoints: 5 })).toEqual({ mobile: true, inApp: false })
    expect(env('Mozilla/5.0 (Macintosh)', { platform: 'MacIntel' })).toEqual({ mobile: false, inApp: false })
  })
})
