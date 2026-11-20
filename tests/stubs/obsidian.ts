export class Plugin {
  app: App;
  manifest: any;

  constructor(app: App, manifest: any) {
    this.app = app;
    this.manifest = manifest;
  }

  addCommand(command: any) {
    return command;
  }

  registerDomEvent(el: HTMLElement, type: string, callback: any) {
    el.addEventListener(type, callback);
  }
}

export class App {
  workspace = new Workspace();
}

export class Workspace {
  private mostRecentLeaf: WorkspaceLeaf | null = null;

  setMostRecentLeaf(leaf: WorkspaceLeaf | null) {
    this.mostRecentLeaf = leaf;
  }

  getMostRecentLeaf(): WorkspaceLeaf | null {
    return this.mostRecentLeaf;
  }
}

export class WorkspaceLeaf {
  view: { containerEl: HTMLElement };

  constructor(containerEl = document.createElement("div")) {
    this.view = { containerEl };
  }
}
