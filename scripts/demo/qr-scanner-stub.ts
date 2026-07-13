/**
 * demo 版 qr-scanner 替身：artifact 的沙箱 iframe 拿不到相機，
 * start() 直接失敗，讓 QrScan 元件顯示友善訊息（改用手動名單報到）。
 */
export default class QrScannerStub {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(..._args: unknown[]) {}

  async start(): Promise<void> {
    throw new Error("示範網頁無法使用相機");
  }

  stop() {}

  destroy() {}
}
