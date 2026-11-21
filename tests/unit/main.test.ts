import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
// explicit extension: "../main" would resolve to the built main.js bundle
import FullScreenPlugin from '../../main.ts';

describe('Obsidian toggle fullscreen plugin unit suite', () => {
  let panelEl: HTMLElement;
  let plugin: FullScreenPlugin;

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

    document.body.innerHTML = '';
    panelEl = document.createElement('div');
    document.body.appendChild(panelEl);

    const app = { workspace: { getMostRecentLeaf: () => ({ view: { containerEl: panelEl } }) } };
    plugin = new FullScreenPlugin(app as any, {} as any);
  });

  // disconnect the observer so it doesn't leak into the next test
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
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(modal.parentNode).toBe(panelEl);
  });

  it('cannot move appended nodes after exiting fullscreen', async () => {
    await plugin.fullscreenMode();
    await plugin.fullscreenMode();

    const modal = document.createElement('div');
    document.body.appendChild(modal);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(modal.parentNode).toBe(document.body);
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
    const app = { workspace: { getMostRecentLeaf: () => null } };
    plugin = new FullScreenPlugin(app as any, {} as any);

    await plugin.fullscreenMode();

    expect(requestFullscreen).not.toHaveBeenCalled();
    expect(plugin.observer).toBeNull();
    expect(document.body.classList.contains('fullscreen')).toBe(false);
  });

  it('can fall gracefully and clean up when fullscreen is refused', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const removeListener = vi.spyOn(panelEl, 'removeEventListener');
    panelEl.requestFullscreen = async () => {
      throw new Error('denied');
    };

    await plugin.fullscreenMode();

    expect(plugin.observer).toBeNull();
    expect(removeListener).toHaveBeenCalledWith('fullscreenchange', expect.any(Function));
    expect(document.body.classList.contains('fullscreen')).toBe(false);
    expect(consoleError).toHaveBeenCalled();
  });
});
