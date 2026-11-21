import { Plugin } from 'obsidian';

export default class FullScreenPlugin extends Plugin {
  observer: MutationObserver | null = null;

  onload() {
    this.addCommand({
      id: 'toggle',
      name: 'Toggle fullscreen',
      callback: () => this.fullscreenMode(),
    });
  }

  onunload() {
    this.observer?.disconnect();
    this.observer = null;
    activeDocument.body.classList.remove('fullscreen');
  }

  async fullscreenMode(): Promise<void> {
    // exit on same shortcut hit
    if (activeDocument.fullscreenElement) {
      await activeDocument.exitFullscreen();
      return;
    }

    const leaf = this.app.workspace.getMostRecentLeaf();
    if (!leaf) return;

    const el = leaf.view.containerEl;
    // the leaf may live in a popout window, so use its own document
    const doc = el.ownerDocument;

    // move nodes appended to body (modals, menus, prompts) into the fullscreen element
    const observer = new MutationObserver((mutationRecords) => {
      mutationRecords.forEach((mutationRecord) => {
        mutationRecord.addedNodes.forEach((node) => {
          if (node.parentNode === doc.body) el.appendChild(node);
        });
      });
      el.querySelector<HTMLInputElement>('.prompt-input')?.focus();
    });

    const cleanup = () => {
      observer.disconnect();
      this.observer = null;
      el.removeEventListener('fullscreenchange', onFullscreenChange);
      doc.body.classList.remove('fullscreen');
    };

    const onFullscreenChange = (event: Event) => {
      if (event.target !== el) return;

      if (doc.fullscreenElement === el) {
        doc.body.classList.add('fullscreen');
        return;
      }

      cleanup();
    };

    el.addEventListener('fullscreenchange', onFullscreenChange);
    observer.observe(doc.body, { childList: true });
    this.observer = observer;

    try {
      await el.requestFullscreen();
    } catch (error) {
      cleanup();
      console.error('Fullscreen focus mode: could not enter fullscreen', error);
    }
  }
}
