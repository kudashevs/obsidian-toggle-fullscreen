import { Plugin } from 'obsidian';

interface KeyboardLock {
  lock(keyCodes?: string[]): Promise<void>;
  unlock(): void;
}

export default class FullScreenPlugin extends Plugin {
  private activeCleanup: (() => void) | null = null;

  onload() {
    this.addCommand({
      id: 'toggle',
      name: 'toggle',
      callback: () => this.fullscreenMode(),
    });
  }

  onunload() {
    this.activeCleanup?.();
    this.activeCleanup = null;
  }

  async fullscreenMode(): Promise<void> {
    // exit on the same shortcut hit
    if (activeDocument.fullscreenElement) {
      if (this.activeCleanup) {
        this.activeCleanup();
        this.activeCleanup = null;
      } else {
        await activeDocument.exitFullscreen();
      }
      return;
    }

    const leaf = this.app.workspace.getMostRecentLeaf();
    if (!leaf) return;

    const el = leaf.view.containerEl;
    // the leaf may live in a popout window, so use its own document
    const doc = el.ownerDocument;
    const nav = doc.defaultView?.navigator;
    const keyboard = nav && 'keyboard' in nav ? (nav.keyboard as KeyboardLock | undefined) : undefined;
    const movedNodes = new Set<Node>();

    // a short Escape press now reaches the editor; holding it exits fullscreen
    const locked = keyboard?.lock(['Escape']).catch((error) => {
      console.warn('Fullscreen focus mode: Esc key lock failed', error);
    });

    // move nodes appended to body (modals, menus, prompts) into the fullscreen element
    const observer = new MutationObserver((mutationRecords) => {
      mutationRecords.forEach((mutationRecord) => {
        mutationRecord.addedNodes.forEach((node) => {
          if (node.parentNode !== doc.body) return;
          el.appendChild(node);
          movedNodes.add(node);
        });
      });
      el.querySelector<HTMLInputElement>('.prompt-input')?.focus();
    });

    const cleanup = () => {
      doc.body.classList.remove('fullscreen');
      observer.disconnect();
      movedNodes.forEach((node) => {
        if (node.parentNode === el) doc.body.appendChild(node);
      });
      movedNodes.clear();
      el.removeEventListener('fullscreenchange', onFullscreenChange);
      if (doc.fullscreenElement === el) void doc.exitFullscreen();
      void locked?.then(() => keyboard?.unlock());
    };

    const onFullscreenChange = (event: Event) => {
      if (event.target !== el) return;

      if (doc.fullscreenElement === el) {
        doc.body.classList.add('fullscreen');
        return;
      }

      cleanup();
    };

    this.activeCleanup = cleanup;
    el.addEventListener('fullscreenchange', onFullscreenChange);
    observer.observe(doc.body, { childList: true });

    try {
      await el.requestFullscreen();
    } catch (error) {
      cleanup();
      console.error('Fullscreen focus mode: could not enter fullscreen', error);
    }
  }
}
