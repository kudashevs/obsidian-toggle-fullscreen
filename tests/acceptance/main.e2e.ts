import {browser, expect} from '@wdio/globals';
import {Key} from 'webdriverio';

const TIMEOUT = 3000;

const isFullscreen = () => browser.execute(() => document.fullscreenElement !== null);

const toggleFullscreen = () => browser.keys([Key.Alt, 'f']);

describe('Obsidian toggle fullscreen plugin acceptance suite', () => {
  beforeEach(async () => {
    // start every test from a normal window with the note open
    await browser.execute(async () => {
      if (document.fullscreenElement) await document.exitFullscreen();
    });
    await browser.executeObsidian(async ({app}) => {
      await app.workspace.openLinkText('note', '', false);
    });
  });

  it('enters fullscreen mode', async () => {
    await toggleFullscreen();

    await browser.waitUntil(isFullscreen, {timeout: TIMEOUT, timeoutMsg: 'did not enter fullscreen'});
    expect(await browser.execute(() => document.body.classList.contains('fullscreen'))).toBe(true);
  });

  it('exits fullscreen mode', async () => {
    await toggleFullscreen();
    await browser.waitUntil(isFullscreen, {timeout: TIMEOUT, timeoutMsg: 'did not enter fullscreen'});

    await toggleFullscreen();

    await browser.waitUntil(async () => !(await isFullscreen()), {timeout: TIMEOUT, timeoutMsg: 'did not exit fullscreen'});
    expect(await browser.execute(() => document.body.classList.contains('fullscreen'))).toBe(false);
  });
});
