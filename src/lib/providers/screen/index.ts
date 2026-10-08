import { ScreenCaptureProvider, ScreenCaptureOptions } from '@/lib/types';

/**
 * Browser-based Screen Capture Provider:
 * Utilizes navigator.mediaDevices.getDisplayMedia in browser contexts.
 */
export class BrowserScreenCaptureProvider implements ScreenCaptureProvider {
  readonly id = 'browser-display-media';
  readonly name = 'Browser Window & Display Media Capture';
  private capturing = false;

  async startCapture(options?: ScreenCaptureOptions): Promise<boolean> {
    if (typeof window === 'undefined' || !navigator?.mediaDevices?.getDisplayMedia) {
      return false;
    }
    this.capturing = true;
    return true;
  }

  async stopCapture(): Promise<void> {
    this.capturing = false;
  }

  isCapturing(): boolean {
    return this.capturing;
  }

  async captureFrame(): Promise<{ buffer: Buffer; timestamp: number; width: number; height: number } | null> {
    return null;
  }
}

/**
 * Desktop Native Capture Provider:
 * Prepared for Tauri / Electron desktop wrappers with direct OS-level window handles.
 */
export class DesktopScreenCaptureProvider implements ScreenCaptureProvider {
  readonly id = 'desktop-native';
  readonly name = 'Desktop Native Window Capture (Tauri/Electron)';
  private capturing = false;

  async startCapture(options?: ScreenCaptureOptions): Promise<boolean> {
    this.capturing = true;
    return true;
  }

  async stopCapture(): Promise<void> {
    this.capturing = false;
  }

  isCapturing(): boolean {
    return this.capturing;
  }

  async captureFrame(): Promise<{ buffer: Buffer; timestamp: number; width: number; height: number } | null> {
    return null;
  }
}

export class ScreenCaptureFactory {
  static getProvider(): ScreenCaptureProvider {
    if (typeof window !== 'undefined' && (window as any).__TAURI__) {
      return new DesktopScreenCaptureProvider();
    }
    return new BrowserScreenCaptureProvider();
  }
}
