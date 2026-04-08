import { test, expect } from '@playwright/test';

/**
 * Voice-output feature (issue #17): tutor messages should render a
 * "Read aloud" button that drives window.speechSynthesis.
 *
 * These tests stub speechSynthesis before navigation so they can run
 * deterministically in headless Chromium, which otherwise may not expose
 * a working TTS engine.
 */

const installSpeechSynthStub = async (page) => {
  await page.addInitScript(() => {
    const calls: Array<{ type: string; text?: string }> = [];
    const synth = {
      speak: (u: any) => {
        calls.push({ type: 'speak', text: u?.text });
        // Immediately fire onend so UI state resets
        if (typeof u?.onend === 'function') {
          setTimeout(() => u.onend(), 0);
        }
      },
      cancel: () => {
        calls.push({ type: 'cancel' });
      },
      pause: () => {},
      resume: () => {},
      getVoices: () => [],
      speaking: false,
      paused: false,
      pending: false,
    };
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      writable: true,
      value: synth,
    });
    // Lightweight SpeechSynthesisUtterance shim
    // @ts-expect-error - test shim
    window.SpeechSynthesisUtterance = function (text: string) {
      this.text = text;
      this.rate = 1;
      this.pitch = 1;
      this.onend = null;
      this.onerror = null;
    };
    // Expose call log for assertions
    // @ts-expect-error - test shim
    window.__ttsCalls = calls;
  });
};

test.describe('Voice output on tutor messages', () => {
  test('speaker button renders on the guest welcome message', async ({ page }) => {
    await installSpeechSynthStub(page);
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Enter guest mode
    const guestBtn = page.getByRole('button', { name: /just chat/i });
    await guestBtn.click();

    // Welcome tutor message renders, speaker button should appear next to it
    const speakerBtn = page.getByRole('button', { name: /read tutor message aloud/i });
    await expect(speakerBtn.first()).toBeVisible();
  });

  test('clicking the speaker button invokes speechSynthesis.speak', async ({ page }) => {
    await installSpeechSynthStub(page);
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    await page.getByRole('button', { name: /just chat/i }).click();

    const speakerBtn = page.getByRole('button', { name: /read tutor message aloud/i }).first();
    await expect(speakerBtn).toBeVisible();
    await speakerBtn.click();

    // Verify a speak call was dispatched with non-empty text
    const calls = await page.evaluate(() => (window as any).__ttsCalls);
    const speakCalls = calls.filter((c: any) => c.type === 'speak');
    expect(speakCalls.length).toBeGreaterThan(0);
    expect(speakCalls[0].text).toBeTruthy();
    expect(speakCalls[0].text.length).toBeGreaterThan(0);
  });

  test('speaker button is hidden when speechSynthesis is unavailable', async ({ page }) => {
    // Do NOT install the stub — instead, blank it out before the app loads
    await page.addInitScript(() => {
      Object.defineProperty(window, 'speechSynthesis', {
        configurable: true,
        writable: true,
        value: undefined,
      });
    });
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    await page.getByRole('button', { name: /just chat/i }).click();

    // Welcome message should render, but the speaker button should not
    const speakerBtn = page.getByRole('button', { name: /read tutor message aloud/i });
    await expect(speakerBtn).toHaveCount(0);
  });
});
