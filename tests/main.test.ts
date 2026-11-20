import {describe, it, expect, beforeEach, afterEach} from 'vitest';
// explicit extension: "../main" would resolve to the built main.js bundle
import FullScreenPlugin from '../main.ts';

describe('Obsidian toggle fullscreen test suite', () => {
  let panelEl: HTMLElement;
  let plugin: FullScreenPlugin;

  beforeEach(() => {
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

    const app = {workspace: {getMostRecentLeaf: () => ({view: {containerEl: panelEl}})}};
    plugin = new FullScreenPlugin(app as any, {} as any);
  });

  // disconnect the observer so it doesn't leak into the next test
  afterEach(() => plugin.onunload());

  it('enters fullscreen and adds the body class', async () => {
    await plugin.fullscreenMode();

    expect(document.fullscreenElement).toBe(panelEl);
    expect(document.body.classList.contains('fullscreen')).toBe(true);
  });

  it('exits fullscreen and removes the body class', async () => {
    await plugin.fullscreenMode();
    await plugin.fullscreenMode();

    expect(document.fullscreenElement).toBeNull();
    expect(document.body.classList.contains('fullscreen')).toBe(false);
  });

  it('moves nodes appended to body into the fullscreen element', async () => {
    await plugin.fullscreenMode();

    const modal = document.createElement('div');
    document.body.appendChild(modal);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(modal.parentNode).toBe(panelEl);
  });
});
