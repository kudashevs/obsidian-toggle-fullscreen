import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import FullScreenPlugin from '../../src/main.ts';

// let MutationObserver callbacks and promise chains run
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('Obsidian toggle fullscreen plugin unit suite', () => {
  let panelEl: HTMLElement;
  let plugin: FullScreenPlugin;
  let keyboard: { lock: ReturnType<typeof vi.fn>; unlock: ReturnType<typeof vi.fn> };

  const setKeyboard = (value: unknown) => {
    Object.defineProperty(window.navigator, 'keyboard', { configurable: true, value });
  };

  beforeEach(() => {
    // Obsidian provides activeDocument as a global; in tests it is the jsdom document
    (globalThis as any).activeDocument = document;

    // jsdom has no Fullscreen API, so emulate it
    let fullscreenElement: Element | null = null;
    Object.defineProperty(document, 'fullscreenElement', {
      configurable: true,
      get: () => fullscreenElement,
    });

    Element.prototype.requestFullscreen = async function () {
      fullscreenElement = this;
      this.dispatchEvent(new Event('fullscreenchange'));
    };

    document.exitFullscreen = async () => {
      const previous = fullscreenElement;
      fullscreenElement = null;
      previous?.dispatchEvent(new Event('fullscreenchange'));
    };

    // jsdom has no Keyboard Lock API, so emulate it
    keyboard = { lock: vi.fn(async () => {}), unlock: vi.fn() };
    setKeyboard(keyboard);

    document.body.innerHTML = '';
    panelEl = document.createElement('div');
    document.body.appendChild(panelEl);

    const app = {
      workspace: {
        getActiveViewOfType: () => null,
        getMostRecentLeaf: () => ({view: {containerEl: panelEl}})
      }
    };
    plugin = new FullScreenPlugin(app as any, {} as any);
  });

  // exit fullscreen so the session doesn't leak into the next test
  afterEach(() => {
    plugin.onunload();
    vi.restoreAllMocks();
  });

  it('cat enter fullscreen with adding the body class', async () => {
    await plugin.fullscreenMode();

    expect(document.fullscreenElement).toBe(panelEl);
    expect(document.body.classList.contains('fullscreen')).toBe(true);
  });

  it('can exit fullscreen with removing the body class', async () => {
    await plugin.fullscreenMode();
    await plugin.fullscreenMode();

    expect(document.fullscreenElement).toBeNull();
    expect(document.body.classList.contains('fullscreen')).toBe(false);
  });

  it('can move appended nodes to the fullscreen element', async () => {
    await plugin.fullscreenMode();

    const modal = document.createElement('div');
    document.body.appendChild(modal);
    await flush();

    expect(modal.parentNode).toBe(panelEl);
  });

  it('cannot move appended nodes after exiting fullscreen', async () => {
    await plugin.fullscreenMode();
    await plugin.fullscreenMode();

    const modal = document.createElement('div');
    document.body.appendChild(modal);
    await flush();

    expect(modal.parentNode).toBe(document.body);
  });

  it('can return moved nodes to the body after exiting fullscreen', async () => {
    await plugin.fullscreenMode();

    const notices = document.createElement('div');
    document.body.appendChild(notices);
    await flush();

    await plugin.fullscreenMode();

    expect(notices.parentNode).toBe(document.body);
  });

  it('cannot return moved nodes that were removed meanwhile', async () => {
    await plugin.fullscreenMode();

    const modal = document.createElement('div');
    document.body.appendChild(modal);
    await flush();
    modal.remove();

    await plugin.fullscreenMode();

    expect(modal.parentNode).toBeNull();
  });

  it('can remove the fullscreenchange listener on every exit', async () => {
    const addListener = vi.spyOn(panelEl, 'addEventListener');
    const removeListener = vi.spyOn(panelEl, 'removeEventListener');

    for (let i = 0; i < 2; i++) {
      await plugin.fullscreenMode();
      await plugin.fullscreenMode();
    }

    expect(addListener).toHaveBeenCalledTimes(2);
    expect(removeListener).toHaveBeenCalledTimes(2);
    expect(removeListener).toHaveBeenCalledWith('fullscreenchange', expect.any(Function));
  });

  it('can do nothing when there is no leaf', async () => {
    const requestFullscreen = vi.spyOn(Element.prototype, 'requestFullscreen');
    const app = {workspace: {getActiveViewOfType: () => null, getMostRecentLeaf: () => null}};
    plugin = new FullScreenPlugin(app as any, {} as any);

    await plugin.fullscreenMode();

    expect(requestFullscreen).not.toHaveBeenCalled();
    expect(keyboard.lock).not.toHaveBeenCalled();
    expect(document.body.classList.contains('fullscreen')).toBe(false);
  });

  it('can fall gracefully and clean up when fullscreen is refused', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const disconnect = vi.spyOn(MutationObserver.prototype, 'disconnect');
    const removeListener = vi.spyOn(panelEl, 'removeEventListener');
    panelEl.requestFullscreen = async () => {
      throw new Error('denied');
    };

    await plugin.fullscreenMode();

    const modal = document.createElement('div');
    document.body.appendChild(modal);
    await flush();

    expect(modal.parentNode).toBe(document.body);
    expect(removeListener).toHaveBeenCalledWith('fullscreenchange', expect.any(Function));
    expect(document.body.classList.contains('fullscreen')).toBe(false);
    expect(keyboard.unlock).toHaveBeenCalledTimes(1);
    expect(disconnect).toHaveBeenCalledTimes(1);
    expect(consoleError).toHaveBeenCalled();
  });

  it('can lock the Escape key on call', async () => {
    await plugin.fullscreenMode();

    expect(keyboard.lock).toHaveBeenCalledWith(['Escape']);
    expect(keyboard.unlock).not.toHaveBeenCalled();
  });

  it('can unlock the Escape key on exit', async () => {
    await plugin.fullscreenMode();
    await plugin.fullscreenMode();
    await flush();

    expect(keyboard.unlock).toHaveBeenCalledTimes(1);
  });

  it('can unlock only after a slow lock settles', async () => {
    let resolveLock = () => {};
    keyboard.lock.mockImplementation(() => new Promise<void>((resolve) => (resolveLock = resolve)));

    await plugin.fullscreenMode();
    await plugin.fullscreenMode();
    await flush();

    expect(keyboard.unlock).not.toHaveBeenCalled();

    resolveLock();
    await flush();

    expect(keyboard.unlock).toHaveBeenCalledTimes(1);
  });

  it('can stay in fullscreen when the lock is rejected', async () => {
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    keyboard.lock.mockRejectedValue(new Error('not allowed'));

    await plugin.fullscreenMode();
    await flush();

    expect(document.fullscreenElement).toBe(panelEl);
    expect(consoleWarn).toHaveBeenCalled();
  });

  it('can work without the Keyboard Lock API', async () => {
    setKeyboard(undefined);

    await plugin.fullscreenMode();
    expect(document.fullscreenElement).toBe(panelEl);

    await plugin.fullscreenMode();
    await flush();
    expect(document.fullscreenElement).toBeNull();
  });

  it('can clean up everything on unload while in fullscreen', async () => {
    const disconnect = vi.spyOn(MutationObserver.prototype, 'disconnect');

    await plugin.fullscreenMode();

    const modal = document.createElement('div');
    document.body.appendChild(modal);
    await flush();

    plugin.onunload();
    await flush();

    expect(document.fullscreenElement).toBeNull();
    expect(document.body.classList.contains('fullscreen')).toBe(false);
    expect(modal.parentNode).toBe(document.body);
    expect(keyboard.unlock).toHaveBeenCalledTimes(1);
    expect(disconnect).toHaveBeenCalledTimes(1);
  });

  it('can clean up on second shortcut (e.g. exit) without waiting for fullscreenchange', async () => {
    await plugin.fullscreenMode();

    const modal = document.createElement('div');
    document.body.appendChild(modal);
    await flush();

    // the browser never reports the exit
    vi.spyOn(document, 'exitFullscreen').mockResolvedValue(undefined);
    const removeListener = vi.spyOn(panelEl, 'removeEventListener');

    await plugin.fullscreenMode();
    await flush();

    expect(keyboard.unlock).toHaveBeenCalledTimes(1);
    expect(modal.parentNode).toBe(document.body);
    expect(document.body.classList.contains('fullscreen')).toBe(false);
    expect(removeListener).toHaveBeenCalledWith('fullscreenchange', expect.any(Function));
  });

  it('can exit fullscreen that was not started by the plugin', async () => {
    // e.g. a video or another plugin
    const video = document.createElement('video');
    document.body.appendChild(video);
    await video.requestFullscreen();

    await plugin.fullscreenMode();

    expect(document.fullscreenElement).toBeNull();
    expect(document.body.classList.contains('fullscreen')).toBe(false);
    expect(keyboard.lock).not.toHaveBeenCalled();
  });

  it('can clean up when the browser exits fullscreen (Esc hold, F11)', async () => {
    await plugin.fullscreenMode();

    await document.exitFullscreen(); // without plugin
    await flush();

    const modal = document.createElement('div');
    document.body.appendChild(modal);
    await flush();

    expect(modal.parentNode).toBe(document.body);
    expect(document.body.classList.contains('fullscreen')).toBe(false);
    expect(keyboard.unlock).toHaveBeenCalledTimes(1);
  });
});
