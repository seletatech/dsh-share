import { type ShareLocale } from './i18n.ts';
/** Host plugins own file URLs and authorization; they ask this sheet to send one file. */
export declare const FILE_SHARE_EVENT = "dsh-share:file";
export declare const FILE_SHARE_LIMIT: number;
export interface FileShareRequest {
    /** Authorized same-origin URL of the original bytes. */
    href: string;
    name?: string;
    /** Sign-in link for colleagues who already have access; never a public URL. */
    link?: string;
    /** The control that asked; desktop menus anchor to it and focus returns to it. */
    anchor?: HTMLElement;
}
/** Browsers can place only PNG (from these images) and plain text on the clipboard. */
export declare const copiesAsImage: (name?: string) => boolean;
export declare const copiesAsText: (name?: string) => boolean;
declare const STRINGS: {
    readonly zh: {
        readonly title: "发送文件";
        readonly close: "关闭";
        readonly preparing: "正在准备文件…";
        readonly share: "分享…";
        readonly copyImage: "复制图片";
        readonly copyText: "复制文字";
        readonly copyLink: "复制链接";
        readonly download: "下载";
        readonly retry: "重试";
        readonly desktopSend: "下载后，在下载文件夹中复制文件，再粘贴到微信或企业微信聊天。";
        readonly denied: "登录已失效或没有文件权限，请刷新后重试";
        readonly failed: "文件准备失败，请重试";
        readonly timeout: "文件准备超时，请重试。";
        readonly tooLarge: "文件超过 100 MB，请下载后发送";
        readonly encoding: "文字编码暂不支持复制，请下载原文件。";
        readonly invalid: "文件地址不可用";
        readonly imageLarge: "图片过大，请下载后发送";
        readonly copyFailed: "未能复制，请下载后发送。";
        readonly nativeFailed: "未能打开系统分享，请下载后发送。";
        readonly inApp: "在微信或企业微信内无法下载文件，请复制链接，或在浏览器中打开后下载。";
        readonly unsupported: "此浏览器不能直接分享这类文件，请下载后在微信或企业微信中发送。";
        readonly imageCopied: "图片已复制，可粘贴到微信或企业微信";
        readonly textCopied: "文字已复制，可粘贴到微信或企业微信";
        readonly linkCopied: "链接已复制，有权限的同事登录后可打开";
        readonly linkFailed: "未能自动复制，请手动复制链接：";
    };
    readonly en: {
        readonly title: "Send file";
        readonly close: "Close";
        readonly preparing: "Preparing file…";
        readonly share: "Share…";
        readonly copyImage: "Copy image";
        readonly copyText: "Copy text";
        readonly copyLink: "Copy link";
        readonly download: "Download";
        readonly retry: "Retry";
        readonly desktopSend: "After downloading, copy the file in your Downloads folder and paste it into WeChat or WeCom.";
        readonly denied: "Your session expired or you lack access to this file. Refresh and try again.";
        readonly failed: "Could not prepare the file. Try again.";
        readonly timeout: "Preparing the file timed out. Try again.";
        readonly tooLarge: "This file is over 100 MB. Download it to send.";
        readonly encoding: "This text encoding cannot be copied. Download the original file.";
        readonly invalid: "File address unavailable";
        readonly imageLarge: "This image is too large. Download it to send.";
        readonly copyFailed: "Could not copy. Download the file to send it.";
        readonly nativeFailed: "Could not open system sharing. Download the file to send it.";
        readonly inApp: "Files cannot be downloaded inside WeChat or WeCom. Copy the link, or open this page in a browser to download.";
        readonly unsupported: "This browser cannot share this kind of file directly. Download it, then send it in WeChat or WeCom.";
        readonly imageCopied: "Image copied. Paste it into WeChat or WeCom.";
        readonly textCopied: "Text copied. Paste it into WeChat or WeCom.";
        readonly linkCopied: "Link copied. Colleagues with access can open it after signing in.";
        readonly linkFailed: "Could not copy automatically. Copy the link:";
    };
};
export type FileShareStrings = (typeof STRINGS)[ShareLocale];
export declare function fileShareStrings(locale: ShareLocale): FileShareStrings;
export declare function shareFileName(disposition: string | null, fallback?: string): string;
/** Reads unchanged authorized bytes; only same-origin paths may be requested. */
export declare function readShareFile(href: string, name: string | undefined, signal: AbortSignal, strings: FileShareStrings, origin?: string): Promise<File>;
/** Markdown becomes chat-readable text; values and private-link labels stay, link targets do not. */
export declare function chatText(text: string): string;
export declare function copyableFileText(file: File, strings: FileShareStrings): Promise<string>;
export declare function canShareFile(file: File): boolean;
export interface FileShareEnvironment {
    mobile: boolean;
    /** WeChat and WeCom in-app browsers block downloads and expose no system share sheet. */
    inApp: boolean;
}
export declare function fileShareEnvironment(nav?: Navigator): FileShareEnvironment;
/** Desktop menu entries: only what a browser can actually do with this file. */
export declare function desktopActions(request: Pick<FileShareRequest, 'name' | 'link'>): Array<'copyImage' | 'copyText' | 'copyLink' | 'download'>;
/** Installs the file-send menu (desktop) and sheet (mobile) behind FILE_SHARE_EVENT. */
export declare function installFileShare(target: Document, getLocale: () => string): () => void;
export {};
//# sourceMappingURL=file-share.d.ts.map