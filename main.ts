import { Plugin } from "obsidian";

export default class FullScreenPlugin extends Plugin {
  observer: MutationObserver | null = null;

  async onload() {
    this.addCommand({
      id: "toggle-fullscreen",
      name: "Toggle fullscreen",
      callback: () => this.fullscreenMode()
    });
  }

  onunload() {
    this.observer?.disconnect();
    this.observer = null;
    document.body.classList.remove("fullscreen");
  }

  async fullscreenMode(): Promise<void> {
    // exit on same shortcut hit
    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }

    const leaf = this.app.workspace.getMostRecentLeaf();
    if (!leaf) return;

    const el = leaf.view.containerEl;

    // move nodes appended to body (modals, menus, prompts) into the fullscreen element
    const observer = new MutationObserver((mutationRecords) => {
      mutationRecords.forEach((mutationRecord) => {
        mutationRecord.addedNodes.forEach((node) => {
          if (node.parentNode === document.body) el.appendChild(node);
        });
      });
      el.querySelector<HTMLInputElement>(".prompt-input")?.focus();
    });

    const onFullscreenChange = (event: Event) => {
      if (event.target !== el) return;

      if (document.fullscreenElement === el) {
        document.body.classList.add("fullscreen");
        return;
      }

      observer.disconnect();
      el.removeEventListener("fullscreenchange", onFullscreenChange);
      document.body.classList.remove("fullscreen");
      this.observer = null;
    };

    el.addEventListener("fullscreenchange", onFullscreenChange);
    observer.observe(document.body, { childList: true });
    this.observer = observer;

    try {
      await el.requestFullscreen();
    } catch (error) {
      observer.disconnect();
      el.removeEventListener("fullscreenchange", onFullscreenChange);
      this.observer = null;
      console.error("Fullscreen focus mode: could not enter fullscreen", error);
    }
  }
}
