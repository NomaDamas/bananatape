import { test, expect } from '@playwright/test';

const FAKE_IMAGE_DATA_URL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAYAAABw4pVUAAAAnElEQVR42u3RAQ0AAAgDIN8/9GK3hEfgmigAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAALgZq2QBBZ7wzJAAAAAASUVORK5CYII=';
const RED_IMAGE_DATA_URL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAYAAACp8Z5+AAAAEklEQVR4nGP4z8DwHxkzkC4AADxAH+HggXe0AAAAAElFTkSuQmCC';
const BLUE_IMAGE_DATA_URL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAYAAACp8Z5+AAAAEUlEQVR4nGNgYPj/HxWTLAAAHGAf4baQ7OcAAAAASUVORK5CYII=';

function dataUrlToBase64Payload(dataUrl: string): string {
  return Buffer.from(dataUrl.split(',')[1], 'base64').toString('base64');
}

function extractMultipartFileParts(body: Buffer, fieldName: string): Buffer[] {
  const marker = Buffer.from(`name="${fieldName}"; filename=`, 'utf8');
  const parts: Buffer[] = [];
  let searchFrom = 0;

  while (searchFrom < body.length) {
    const markerIndex = body.indexOf(marker, searchFrom);
    if (markerIndex === -1) break;

    const headerEnd = body.indexOf(Buffer.from('\r\n\r\n'), markerIndex);
    if (headerEnd === -1) {
      throw new Error(`Multipart field ${fieldName} header terminator not found`);
    }

    const partStart = headerEnd + 4;
    const partEnd = body.indexOf(Buffer.from('\r\n--'), partStart);
    if (partEnd === -1) {
      throw new Error(`Multipart field ${fieldName} boundary not found`);
    }

    parts.push(body.subarray(partStart, partEnd));
    searchFrom = partEnd + 1;
  }

  if (parts.length === 0) {
    throw new Error(`Multipart field ${fieldName} not found`);
  }

  return parts;
}

function extractMultipartFilePart(body: Buffer, fieldName: string): Buffer {
  return extractMultipartFileParts(body, fieldName)[0];
}


function extractMultipartTextPart(body: Buffer, fieldName: string): string {
  const marker = Buffer.from(`name="${fieldName}"`, 'utf8');
  const markerIndex = body.indexOf(marker);
  if (markerIndex === -1) {
    throw new Error(`Multipart text field ${fieldName} not found`);
  }

  const headerEnd = body.indexOf(Buffer.from('\r\n\r\n'), markerIndex);
  if (headerEnd === -1) {
    throw new Error(`Multipart text field ${fieldName} header terminator not found`);
  }

  const partStart = headerEnd + 4;
  const partEnd = body.indexOf(Buffer.from('\r\n--'), partStart);
  if (partEnd === -1) {
    throw new Error(`Multipart text field ${fieldName} boundary not found`);
  }

  return body.subarray(partStart, partEnd).toString('utf8');
}

function getPromptInput(page: import('@playwright/test').Page) {
  return page
    .locator([
      'textarea[placeholder*="generate" i]',
      'textarea[placeholder*="describe" i]',
      'textarea[placeholder*="optional" i]',
      'input[placeholder*="generate" i]',
      'input[placeholder*="describe" i]',
      'input[placeholder*="optional" i]',
    ].join(', '))
    .first();
}

function getGenerateButton(page: import('@playwright/test').Page) {
  return page.getByRole('button', { name: /generate|new image/i }).first();
}

function getEditButton(page: import('@playwright/test').Page) {
  return page.getByRole('button', { name: /apply edit|edit/i }).first();
}

async function chooseProvider(page: import('@playwright/test').Page, providerLabel: string) {
  await page.locator('[data-testid="bottom-provider-select"]').click();
  await page.locator('[data-slot="select-item"]').filter({ hasText: providerLabel }).click();
}


test.describe('BananaTape Editor', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('/api/generate', async (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          imageDataUrl: FAKE_IMAGE_DATA_URL,
          prompt: 'test prompt',
          provider: 'openai',
        }),
      });
    });

    await page.route('/api/edit', async (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          imageDataUrl: FAKE_IMAGE_DATA_URL,
          prompt: 'test edit',
          provider: 'openai',
        }),
      });
    });

    await page.goto('/');
  });

  test('renders standalone shell landmarks and preserved controls', async ({ page }) => {
    await expect(page.getByText('BananaTape')).toBeVisible();
    await expect(page.getByRole('button', { name: /export/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /context/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /styles/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /history/i })).toBeVisible();
    await expect(page.locator('[data-testid="canvas-container"]')).toBeVisible();
    await expect(page.getByText(/No image loaded|Start by describing/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /share/i })).toHaveCount(0);

    await expect(page.locator('button[title="Pan (1)"]')).toBeVisible();
    await expect(page.locator('button[title="Pen (2)"]')).toBeVisible();
    await expect(page.locator('button[title="Box (3)"]')).toBeVisible();
    await expect(page.locator('button[title="Arrow (4)"]')).toBeVisible();
    await expect(page.locator('button[title="Sticky memo (5)"]')).toBeVisible();

    await expect(getPromptInput(page)).toBeVisible();
    await expect(page.locator('[data-testid="bottom-provider-select"]')).toContainText(/codex|OpenAI/);
    await expect(page.locator('button[title="Attach reference image"], button[aria-label*="reference" i]').first()).toBeVisible();
    await expect(page.locator('button[title="Zoom in"]').first()).toBeVisible();
    await expect(page.locator('button[title="Zoom out"]').first()).toBeVisible();
  });

  test('shows active CLI project name in the top bar', async ({ page }) => {
    await page.route('/api/projects/current', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          persistence: 'project',
          projectId: 'summer-campaign',
          projectName: 'Summer Campaign',
          launchId: 'test-launch',
        }),
      });
    });
    await page.route('/api/projects/history', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ schemaVersion: 1, revision: 0, entries: [] }),
      });
    });

    await page.reload();

    await expect(page.locator('[data-testid="standalone-top-bar"]')).toContainText('Summer Campaign');
    await expect(page.locator('[data-testid="standalone-top-bar"]')).not.toContainText('Untitled design');
  });

  test('hydrates project-level system prompt and reference images', async ({ page }) => {
    await page.route('/api/projects/settings', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            systemPrompt: 'Always keep the banana tape gritty.',
            referenceImages: [{
              id: 'ref-test',
              assetId: 'ref_20260427T000000Z_testref1',
              assetPath: 'references/ref_20260427T000000Z_testref1.png',
              assetUrl: '/api/projects/assets/ref_20260427T000000Z_testref1',
              name: 'mood.png',
              mimeType: 'image/png',
              createdAt: new Date().toISOString(),
            }],
          }),
        });
        return;
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
    });
    await page.route('/api/projects/assets/ref_20260427T000000Z_testref1', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'image/png',
        body: Buffer.from(RED_IMAGE_DATA_URL.split(',')[1], 'base64'),
      });
    });

    await page.reload();

    await expect(page.getByPlaceholder('Instructions that are included with every generation/edit prompt.')).toHaveValue('Always keep the banana tape gritty.');
    await expect(page.locator('[data-testid="composer-reference-list"]')).toBeVisible();
  });

  test('history panel scrolls when it has many persisted entries', async ({ page }) => {
    const entries = Array.from({ length: 24 }, (_, index) => ({
      id: `hist_${index}`,
      type: index % 2 === 0 ? 'generate' : 'edit',
      provider: 'openai',
      prompt: `Persisted version ${index + 1}`,
      assetId: `img_20260427T0000${String(index).padStart(2, '0')}Z_test${index}`,
      assetPath: `assets/img_${index}.png`,
      assetUrl: `/api/projects/assets/img_20260427T0000${String(index).padStart(2, '0')}Z_test${index}`,
      parentId: null,
      createdAt: new Date().toISOString(),
      timestamp: Date.now() - index,
    }));

    await page.route('/api/projects/current', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ persistence: 'project', projectId: 'scroll-test', projectName: 'Scroll Test' }),
      });
    });
    await page.route('/api/projects/history', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ schemaVersion: 1, revision: entries.length, entries }),
      });
    });

    await page.reload();
    await expect(page.locator('[data-testid="history-timeline-row"]')).toHaveCount(entries.length);

    const viewport = page.locator('[data-testid="history-timeline"] [data-slot="scroll-area-viewport"]');
    await viewport.hover();
    const before = await viewport.evaluate((element) => element.scrollTop);
    await page.mouse.wheel(0, 800);
    await expect.poll(() => viewport.evaluate((element) => element.scrollTop)).toBeGreaterThan(before);
  });

  test('keeps canvas and composer usable across narrow and wide viewports', async ({ page }) => {
    const viewports = [
      { width: 1365, height: 768 }, // 16:9 laptop
      { width: 960, height: 640 }, // 3:2 compact desktop
      { width: 800, height: 800 }, // square window
      { width: 790, height: 900 }, // half-screen split view
      { width: 640, height: 960 }, // 2:3 portrait tablet
      { width: 390, height: 844 }, // 9:16 phone
      { width: 360, height: 640 }, // very narrow phone
    ];

    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await page.goto('/');

      const layout = await page.evaluate(() => {
        const selectors = {
          canvas: '[data-testid="canvas-container"]',
          composer: '[data-testid="standalone-bottom-composer"]',
          prompt: '[data-testid="bottom-prompt-input"]',
          primaryAction: '[data-testid="bottom-primary-action"]',
        };

        const rects = Object.fromEntries(Object.entries(selectors).map(([key, selector]) => {
          const rect = document.querySelector(selector)?.getBoundingClientRect();
          return [key, rect ? {
            left: rect.left,
            right: rect.right,
            top: rect.top,
            bottom: rect.bottom,
            width: rect.width,
            height: rect.height,
          } : null];
        }));

        return {
          viewport: { width: window.innerWidth, height: window.innerHeight },
          documentWidth: document.documentElement.scrollWidth,
          bodyWidth: document.body.scrollWidth,
          rects,
        };
      });

      expect(layout.documentWidth, `${viewport.width}×${viewport.height} should not create document-level horizontal scroll`).toBeLessThanOrEqual(viewport.width);
      expect(layout.bodyWidth, `${viewport.width}×${viewport.height} should not create body-level horizontal scroll`).toBeLessThanOrEqual(viewport.width);

      for (const [name, rect] of Object.entries(layout.rects)) {
        expect(rect, `${name} should exist at ${viewport.width}×${viewport.height}`).not.toBeNull();
        expect(rect!.width, `${name} should retain usable width at ${viewport.width}×${viewport.height}`).toBeGreaterThan(24);
        expect(rect!.height, `${name} should retain usable height at ${viewport.width}×${viewport.height}`).toBeGreaterThan(24);
        expect(rect!.left, `${name} should not overflow left at ${viewport.width}×${viewport.height}`).toBeGreaterThanOrEqual(0);
        expect(rect!.right, `${name} should not overflow right at ${viewport.width}×${viewport.height}`).toBeLessThanOrEqual(layout.viewport.width);
        expect(rect!.top, `${name} should not overflow top at ${viewport.width}×${viewport.height}`).toBeGreaterThanOrEqual(0);
        expect(rect!.bottom, `${name} should not overflow bottom at ${viewport.width}×${viewport.height}`).toBeLessThanOrEqual(layout.viewport.height);
      }
    }
  });

  test('provider choices expose only implemented providers', async ({ page }) => {
    await page.locator('[data-testid="bottom-provider-select"]').click();

    const options = await page.locator('[data-slot="select-item"], [role="option"]').allTextContents();
    expect(options.map((option) => option.trim()).filter(Boolean).sort()).toEqual([
      'OpenAI',
      'codex',
    ].sort());
  });

  test('export modal is honest about current-image PNG download support', async ({ page }) => {
    const exportButton = page.getByRole('button', { name: /export/i });
    await expect(exportButton).toBeDisabled();

    const promptInput = getPromptInput(page);
    await promptInput.fill('export modal test');
    await getGenerateButton(page).click();
    await expect(page.getByAltText('Canvas base')).toHaveAttribute('src', FAKE_IMAGE_DATA_URL);

    await expect(exportButton).toBeEnabled();
    await exportButton.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('PNG · current image')).toBeVisible();
    await expect(dialog.getByRole('button', { name: /Download PNG/i })).toBeEnabled();

    const unsupportedEnabledActions = dialog.getByRole('button', { name: /JPG|JPEG|WebP|SVG|copy link|share/i });
    for (let i = 0; i < await unsupportedEnabledActions.count(); i += 1) {
      await expect(unsupportedEnabledActions.nth(i)).toBeDisabled();
    }
  });

  test('pan is the default active tool', async ({ page }) => {
    const panBtn = page.locator('button[title="Pan (1)"]');
    await expect(panBtn).toHaveClass(/bg-/);
  });

  test('prompt input accepts typing and backspace', async ({ page }) => {
    const promptInput = getPromptInput(page);
    await expect(promptInput).toBeVisible();

    await promptInput.click();
    await promptInput.fill('hello world');
    await expect(promptInput).toHaveValue('hello world');

    await promptInput.press('Backspace');
    await expect(promptInput).toHaveValue('hello worl');

    await promptInput.press('Backspace');
    await expect(promptInput).toHaveValue('hello wor');
  });

  test('switches tools via palette and keyboard', async ({ page }) => {
    const panBtn = page.locator('button[title="Pan (1)"]');
    const penBtn = page.locator('button[title="Pen (2)"]');
    const boxBtn = page.locator('button[title="Box (3)"]');
    const arrowBtn = page.locator('button[title="Arrow (4)"]');
    const memoBtn = page.locator('button[title="Sticky memo (5)"]');
    await penBtn.click();
    await expect(penBtn).toHaveClass(/bg-/);

    await boxBtn.click();
    await expect(boxBtn).toHaveClass(/bg-/);

    await arrowBtn.click();
    await expect(arrowBtn).toHaveClass(/bg-/);

    await memoBtn.click();
    await expect(memoBtn).toHaveClass(/bg-/);


    await page.keyboard.press('1');
    await expect(panBtn).toHaveClass(/bg-/);

    await page.keyboard.press('2');
    await expect(penBtn).toHaveClass(/bg-/);

    await page.keyboard.press('4');
    await expect(arrowBtn).toHaveClass(/bg-/);

    await page.keyboard.press('5');
    await expect(memoBtn).toHaveClass(/bg-/);

    await page.keyboard.press('Escape');
    await expect(panBtn).toHaveClass(/bg-/);
  });

  test('attaches reference images to generate prompt payload', async ({ page }) => {
    await page.unroute('/api/generate');

    let uploadedReferences: Buffer[] = [];
    let uploadedPrompt = '';

    await page.route('/api/generate', async (route) => {
      const body = route.request().postDataBuffer();
      if (!body) throw new Error('Expected multipart generate body');
      uploadedReferences = extractMultipartFileParts(body, 'referenceImages');
      uploadedPrompt = extractMultipartTextPart(body, 'prompt');

      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          imageDataUrl: FAKE_IMAGE_DATA_URL,
          prompt: uploadedPrompt,
          provider: 'openai',
        }),
      });
    });

    await page
      .getByPlaceholder('Instructions that are included with every generation/edit prompt.')
      .fill('Use a consistent banana brand style');

    await page.locator('[data-testid="bottom-reference-image-input"]').setInputFiles({
      name: 'style-reference.png',
      mimeType: 'image/png',
      buffer: Buffer.from(RED_IMAGE_DATA_URL.split(',')[1], 'base64'),
    });
    await expect(page.locator('[data-testid="composer-reference-list"]')).toBeVisible();

    const promptInput = getPromptInput(page);
    await promptInput.fill('generate with this style reference');
    await getGenerateButton(page).click();

    await expect.poll(() => uploadedReferences.length).toBe(1);
    expect(uploadedPrompt).toMatch(/System prompt:\s+Use a consistent banana brand style/);
    expect(uploadedPrompt).toMatch(/User prompt:\s+generate with this style reference/);
    expect(uploadedReferences[0].toString('base64')).toBe(dataUrlToBase64Payload(RED_IMAGE_DATA_URL));
    await expect(promptInput).toHaveValue('');
    await expect(page.locator('[data-testid="composer-reference-list"]')).toBeVisible();
    await expect(page.getByPlaceholder('Instructions that are included with every generation/edit prompt.')).toHaveValue('Use a consistent banana brand style');
  });



  test('converts unsupported reference images to PNG when the browser can decode them', async ({ page }) => {
    await page.unroute('/api/generate');

    let uploadedReferences: Buffer[] = [];

    await page.route('/api/generate', async (route) => {
      const body = route.request().postDataBuffer();
      if (!body) throw new Error('Expected multipart generate body');
      uploadedReferences = extractMultipartFileParts(body, 'referenceImages');

      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          imageDataUrl: FAKE_IMAGE_DATA_URL,
          prompt: 'converted reference',
          provider: 'god-tibo',
        }),
      });
    });

    await page.evaluate(() => {
      window.createImageBitmap = async () => ({
        width: 2,
        height: 2,
        close: () => {},
      }) as ImageBitmap;
      (HTMLCanvasElement.prototype as unknown as { getContext: () => CanvasRenderingContext2D }).getContext = () => ({ drawImage: () => {} }) as unknown as CanvasRenderingContext2D;
      HTMLCanvasElement.prototype.toBlob = function toBlob(callback: BlobCallback, type?: string | null) {
        callback(new Blob(['converted-png'], { type: type ?? 'image/png' }));
      };
    });

    await page.locator('[data-testid="bottom-reference-image-input"]').setInputFiles({
      name: 'style-reference.avif',
      mimeType: 'image/avif',
      buffer: Buffer.from('fake-avif'),
    });

    await expect(page.locator('[data-testid="composer-reference-list"]')).toBeVisible();
    await expect(page.locator('text=Converted image to PNG for upload.')).toBeVisible();

    const promptInput = getPromptInput(page);
    await promptInput.fill('converted reference');
    await getGenerateButton(page).click();

    await expect.poll(() => uploadedReferences.length).toBe(1);
    expect(uploadedReferences[0].toString()).toBe('converted-png');
  });

  test('shows supported-format guidance when unsupported images cannot be converted', async ({ page }) => {
    await page.evaluate(() => {
      window.createImageBitmap = async () => {
        throw new Error('unsupported image');
      };
    });

    await page.locator('[data-testid="bottom-reference-image-input"]').setInputFiles({
      name: 'style-reference.heic',
      mimeType: 'image/heic',
      buffer: Buffer.from('fake-heic'),
    });

    await expect(page.locator('text=Some images could not be converted. Please use JPEG, PNG, WebP, or GIF.')).toBeVisible();
    await expect(page.locator('[data-testid="composer-reference-list"]')).toBeHidden();
  });

  test('adds pasted clipboard images as prompt references', async ({ page }) => {
    await page.unroute('/api/generate');

    let uploadedReferences: Buffer[] = [];

    await page.route('/api/generate', async (route) => {
      const body = route.request().postDataBuffer();
      if (!body) throw new Error('Expected multipart generate body');
      uploadedReferences = extractMultipartFileParts(body, 'referenceImages');

      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          imageDataUrl: FAKE_IMAGE_DATA_URL,
          prompt: 'pasted reference',
          provider: 'openai',
        }),
      });
    });

    await expect(page.locator('button[title="Attach reference image"]')).toBeVisible();

    await page.evaluate((dataUrl) => {
      const base64 = dataUrl.split(',')[1];
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }

      const file = new File([bytes], 'pasted-reference.png', { type: 'image/png' });
      const pasteEvent = new Event('paste', { bubbles: true, cancelable: true });
      Object.defineProperty(pasteEvent, 'clipboardData', {
        value: {
          items: [{ kind: 'file', type: 'image/png', getAsFile: () => file }],
          files: [file],
        },
      });
      document.dispatchEvent(pasteEvent);
    }, RED_IMAGE_DATA_URL);

    await expect(page.locator('[data-testid="composer-reference-list"]')).toBeVisible();
    await expect(page.locator('text=Pasted image added as a reference')).toBeVisible();

    const promptInput = getPromptInput(page);
    await promptInput.fill('generate from pasted reference');
    await getGenerateButton(page).click();

    await expect.poll(() => uploadedReferences.length).toBe(1);
    expect(uploadedReferences[0].toString('base64')).toBe(dataUrlToBase64Payload(RED_IMAGE_DATA_URL));
    await expect(promptInput).toHaveValue('');
    await expect(page.locator('[data-testid="composer-reference-list"]')).toBeVisible();
  });

  test('zoom buttons change viewport zoom', async ({ page }) => {
    const promptInput = getPromptInput(page);
    await promptInput.fill('zoom test');
    await getGenerateButton(page).click();
    await expect(page.locator('text=zoom test').first()).toBeVisible();

    const wrapper = page.locator('[data-testid="transform-wrapper"]');
    await expect(wrapper).toHaveAttribute('data-zoom', '1');

    await page.locator('[data-testid="standalone-bottom-composer"] button[title="Zoom in"]').last().click();
    const zoomAfterIn = await wrapper.getAttribute('data-zoom');
    expect(parseFloat(zoomAfterIn!)).toBeGreaterThan(1);

    await page.locator('[data-testid="standalone-bottom-composer"] button[title="Zoom out"]').last().click();
    await expect(wrapper).toHaveAttribute('data-zoom', '1');
  });

  test('mouse wheel zooms canvas', async ({ page }) => {
    const promptInput = getPromptInput(page);
    await promptInput.fill('wheel zoom test');
    await getGenerateButton(page).click();
    await expect(page.locator('text=wheel zoom test').first()).toBeVisible();

    const wrapper = page.locator('[data-testid="transform-wrapper"]');
    await expect(wrapper).toHaveAttribute('data-zoom', '1');

    const canvas = page.locator('[data-testid="canvas-container"]');
    await canvas.evaluate((el) => {
      el.dispatchEvent(new WheelEvent('wheel', { deltaY: -100, bubbles: true }));
    });

    const zoomAfterWheel = await wrapper.getAttribute('data-zoom');
    expect(parseFloat(zoomAfterWheel!)).toBeGreaterThan(1);
  });

  test('pan tool drags viewport', async ({ page }) => {
    const promptInput = getPromptInput(page);
    await promptInput.fill('pan test');
    await getGenerateButton(page).click();
    await expect(page.locator('text=pan test').first()).toBeVisible();

    const wrapper = page.locator('[data-testid="transform-wrapper"]');
    await expect(wrapper).toHaveAttribute('data-pan-x', '0');
    await expect(wrapper).toHaveAttribute('data-pan-y', '0');

    const canvas = page.locator('[data-testid="canvas-container"]');
    await canvas.evaluate((el) => {
      const rect = el.getBoundingClientRect();
      const x = rect.left + 100;
      const y = rect.top + 100;
      el.dispatchEvent(new PointerEvent('pointerdown', { clientX: x, clientY: y, bubbles: true, pointerType: 'mouse', button: 0, buttons: 1, isPrimary: true, pointerId: 1 }));
    });
    await canvas.evaluate((el) => {
      const rect = el.getBoundingClientRect();
      const x = rect.left + 100;
      const y = rect.top + 100;
      el.dispatchEvent(new PointerEvent('pointermove', { clientX: x + 100, clientY: y + 50, bubbles: true, pointerType: 'mouse', button: 0, buttons: 1, isPrimary: true, pointerId: 1 }));
    });
    await canvas.evaluate((el) => {
      const rect = el.getBoundingClientRect();
      const x = rect.left + 100;
      const y = rect.top + 100;
      el.dispatchEvent(new PointerEvent('pointerup', { clientX: x + 100, clientY: y + 50, bubbles: true, pointerType: 'mouse', button: 0, buttons: 0, isPrimary: true, pointerId: 1 }));
    });

    const panX = await wrapper.getAttribute('data-pan-x');
    const panY = await wrapper.getAttribute('data-pan-y');
    expect(parseFloat(panX!)).toBeGreaterThan(50);
    expect(parseFloat(panY!)).toBeGreaterThan(20);
  });

  test('spacebar temporarily enables panning', async ({ page }) => {
    const promptInput = getPromptInput(page);
    await promptInput.fill('space pan test');
    await getGenerateButton(page).click();
    await expect(page.locator('text=space pan test').first()).toBeVisible();

    const wrapper = page.locator('[data-testid="transform-wrapper"]');
    await expect(wrapper).toHaveAttribute('data-pan-x', '0');

    await page.keyboard.down('Space');

    const canvas = page.locator('[data-testid="canvas-container"]');
    await canvas.evaluate((el) => {
      const rect = el.getBoundingClientRect();
      const x = rect.left + 100;
      const y = rect.top + 100;
      el.dispatchEvent(new PointerEvent('pointerdown', { clientX: x, clientY: y, bubbles: true, pointerType: 'mouse', button: 0, buttons: 1, isPrimary: true, pointerId: 1 }));
    });
    await canvas.evaluate((el) => {
      const rect = el.getBoundingClientRect();
      const x = rect.left + 100;
      const y = rect.top + 100;
      el.dispatchEvent(new PointerEvent('pointermove', { clientX: x + 100, clientY: y + 50, bubbles: true, pointerType: 'mouse', button: 0, buttons: 1, isPrimary: true, pointerId: 1 }));
    });
    await canvas.evaluate((el) => {
      const rect = el.getBoundingClientRect();
      const x = rect.left + 100;
      const y = rect.top + 100;
      el.dispatchEvent(new PointerEvent('pointerup', { clientX: x + 100, clientY: y + 50, bubbles: true, pointerType: 'mouse', button: 0, buttons: 0, isPrimary: true, pointerId: 1 }));
    });

    await page.keyboard.up('Space');

    const panX = await wrapper.getAttribute('data-pan-x');
    expect(parseFloat(panX!)).toBeGreaterThan(50);
  });

  test('draws pen stroke on canvas after generating image', async ({ page }) => {
    const promptInput = getPromptInput(page);
    await promptInput.fill('canvas test');
    await getGenerateButton(page).click();
    await expect(page.locator('text=canvas test').first()).toBeVisible();

    const penBtn = page.locator('button[title="Pen (2)"]');
    await penBtn.click();

    const canvas = page.locator('canvas').first();
    await canvas.waitFor();

    const box = await canvas.boundingBox();
    if (!box) throw new Error('Canvas not found');

    await page.mouse.move(box.x + 50, box.y + 50);
    await page.mouse.down();
    await page.mouse.move(box.x + 150, box.y + 150, { steps: 10 });
    await page.mouse.up();
  });

  test('draws bounding box on canvas after generating image', async ({ page }) => {
    const promptInput = getPromptInput(page);
    await promptInput.fill('box test');
    await getGenerateButton(page).click();
    await expect(page.locator('text=box test').first()).toBeVisible();

    const boxBtn = page.locator('button[title="Box (3)"]');
    await boxBtn.click();

    const canvas = page.locator('canvas').first();
    await canvas.waitFor();

    const bounds = await canvas.boundingBox();
    if (!bounds) throw new Error('Canvas not found');

    await page.mouse.move(bounds.x + 50, bounds.y + 50);
    await page.mouse.down();
    await page.mouse.move(bounds.x + 200, bounds.y + 200, { steps: 10 });
    await page.mouse.up();
  });

  test('submits an annotated edit without an extra prompt', async ({ page }) => {
    await page.unroute('/api/edit');
    let uploadedPrompt = '';

    await page.route('/api/edit', async (route) => {
      const body = route.request().postDataBuffer();
      if (!body) throw new Error('Expected multipart edit body');
      uploadedPrompt = extractMultipartTextPart(body, 'prompt');

      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          imageDataUrl: BLUE_IMAGE_DATA_URL,
          prompt: 'annotation-only edit',
          provider: 'god-tibo',
        }),
      });
    });

    await chooseProvider(page, 'codex');

    const promptInput = getPromptInput(page);
    await promptInput.fill('annotation-only source');
    await getGenerateButton(page).click();
    await expect(page.getByAltText('Canvas base')).toHaveAttribute('src', FAKE_IMAGE_DATA_URL);
    await expect(promptInput).toHaveValue('');
    await page.waitForFunction(() => {
      const img = document.querySelector('img[alt="Canvas base"]') as HTMLImageElement | null;
      return img?.complete && img.naturalWidth > 0;
    });

    await page.locator('button[title="Box (3)"]').click();
    const canvas = page.locator('canvas').first();
    const bounds = await canvas.boundingBox();
    if (!bounds) throw new Error('Canvas not found');

    await page.mouse.move(bounds.x + 40, bounds.y + 40);
    await page.mouse.down();
    await page.mouse.move(bounds.x + 180, bounds.y + 180, { steps: 10 });
    await page.mouse.up();

    const editButton = getEditButton(page);
    await expect(editButton).toBeEnabled();
    await editButton.click();

    await expect.poll(() => uploadedPrompt).toContain('Apply the changes indicated by the annotations on the image.');
  });

  test('adds sticky memo and arrow to annotated edit upload', async ({ page }) => {
    await page.unroute('/api/edit');

    let uploadedImages: Buffer[] = [];
    let uploadedPrompt = '';

    await page.route('/api/edit', async (route) => {
      const body = route.request().postDataBuffer();
      if (!body) throw new Error('Expected multipart edit body');
      uploadedImages = extractMultipartFileParts(body, 'images');
      uploadedPrompt = extractMultipartTextPart(body, 'prompt');

      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          imageDataUrl: FAKE_IMAGE_DATA_URL,
          prompt: 'annotated edit',
          provider: 'god-tibo',
        }),
      });
    });

    await chooseProvider(page, 'codex');
    await page
      .getByPlaceholder('Instructions that are included with every generation/edit prompt.')
      .fill('Keep edits photorealistic');

    const promptInput = getPromptInput(page);
    await promptInput.fill('memo arrow source');
    await getGenerateButton(page).click();

    const baseImage = page.getByAltText('Canvas base');
    await expect(baseImage).toHaveAttribute('src', FAKE_IMAGE_DATA_URL);
    await page.waitForFunction(() => {
      const img = document.querySelector('img[alt="Canvas base"]') as HTMLImageElement | null;
      return img?.complete && img.naturalWidth > 0;
    });

    const canvas = page.locator('canvas').first();
    const bounds = await canvas.boundingBox();
    if (!bounds) throw new Error('Canvas not found');

    await page.locator('button[title="Sticky memo (5)"]').click();
    await page.mouse.click(bounds.x + 30, bounds.y + 30);

    const memo = page.locator('[data-testid="sticky-memo"]').first();
    const memoTextarea = memo.locator('textarea').first();
    await expect(memoTextarea).toBeVisible();
    await expect(memoTextarea).toHaveAttribute('spellcheck', 'false');
    await expect(memoTextarea).toHaveAttribute('data-gramm', 'false');
    await expect(memoTextarea).toHaveCSS('font-size', '16px');
    await expect(memoTextarea).toHaveCSS('line-height', '24px');
    const initialMemoBox = await memo.boundingBox();
    if (!initialMemoBox) throw new Error('Sticky memo not found');

    await memoTextarea.fill('Make this entire area brighter and add a clear blue call-to-action button here');

    await expect.poll(async () => (await memo.boundingBox())?.width ?? 0).toBeGreaterThan(initialMemoBox.width);
    await expect.poll(async () => (await memo.boundingBox())?.height ?? 0).toBeGreaterThan(initialMemoBox.height);

    await page.locator('button[title="Arrow (4)"]').click();
    await page.mouse.move(bounds.x + 40, bounds.y + 90);
    await page.mouse.down();
    await page.mouse.move(bounds.x + 180, bounds.y + 130, { steps: 8 });
    await page.mouse.up();

    await page.locator('[data-testid="bottom-reference-image-input"]').setInputFiles({
      name: 'edit-reference.png',
      mimeType: 'image/png',
      buffer: Buffer.from(BLUE_IMAGE_DATA_URL.split(',')[1], 'base64'),
    });
    await expect(page.locator('[data-testid="composer-reference-list"]')).toBeVisible();

    await promptInput.fill('apply annotated memo and arrow');
    await getEditButton(page).click();

    await expect.poll(() => uploadedImages.length).toBe(3);
    expect(uploadedPrompt).toMatch(/System prompt:\s+Keep edits photorealistic/);
    expect(uploadedPrompt).toMatch(/User prompt:\s+apply annotated memo and arrow/);
    expect(uploadedImages[0].toString('base64')).toBe(dataUrlToBase64Payload(FAKE_IMAGE_DATA_URL));
    expect(uploadedImages[1].toString('base64')).not.toBe(dataUrlToBase64Payload(FAKE_IMAGE_DATA_URL));
    expect(uploadedImages[2].toString('base64')).toBe(dataUrlToBase64Payload(BLUE_IMAGE_DATA_URL));
    await expect(promptInput).toHaveValue('');
    await expect(page.locator('[data-testid="composer-reference-list"]')).toBeVisible();
  });

  test('draws pen stroke after zooming', async ({ page }) => {
    const promptInput = getPromptInput(page);
    await promptInput.fill('zoomed draw test');
    await getGenerateButton(page).click();
    await expect(page.locator('text=zoomed draw test').first()).toBeVisible();

    const canvas = page.locator('[data-testid="canvas-container"]');
    const box = await canvas.boundingBox();
    if (!box) throw new Error('Canvas not found');

    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.wheel(0, -200);

    const penBtn = page.locator('button[title="Pen (2)"]');
    await penBtn.click();

    const drawingCanvas = page.locator('canvas').first();
    await drawingCanvas.waitFor();

    const cBox = await drawingCanvas.boundingBox();
    if (!cBox) throw new Error('Drawing canvas not found');

    await page.mouse.move(cBox.x + 20, cBox.y + 20);
    await page.mouse.down();
    await page.mouse.move(cBox.x + 80, cBox.y + 80, { steps: 5 });
    await page.mouse.up();
  });

  test('clear annotations button state changes correctly', async ({ page }) => {
    const clearBtn = page.locator('[data-testid="standalone-left-panel"] button[title="Clear annotations"]');
    await expect(clearBtn).toBeDisabled();

    const promptInput = getPromptInput(page);
    await promptInput.fill('clear test');
    await getGenerateButton(page).click();
    await expect(page.locator('text=clear test').first()).toBeVisible();

    await expect(clearBtn).toBeDisabled();
  });

  test('history item click loads image', async ({ page }) => {
    const promptInput = getPromptInput(page);
    await promptInput.fill('history test');

    const generateBtn = getGenerateButton(page);
    await generateBtn.click();
    await expect(page.locator('text=history test').first()).toBeVisible();

    const historyItem = page.locator('text=history test').first();
    await historyItem.click();
  });

  test('uses the latest edited image as the next edit original reference', async ({ page }) => {
    await page.unroute('/api/generate');
    await page.unroute('/api/edit');

    const originalUploads: string[] = [];

    await page.route('/api/generate', async (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          imageDataUrl: RED_IMAGE_DATA_URL,
          prompt: 'initial red',
          provider: 'god-tibo',
        }),
      });
    });

    await page.route('/api/edit', async (route) => {
      const body = route.request().postDataBuffer();
      if (!body) throw new Error('Expected multipart edit body');
      originalUploads.push(extractMultipartFilePart(body, 'images').toString('base64'));

      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          imageDataUrl: BLUE_IMAGE_DATA_URL,
          prompt: 'edited blue',
          provider: 'god-tibo',
        }),
      });
    });

    await chooseProvider(page, 'codex');

    const promptInput = getPromptInput(page);
    await promptInput.fill('initial red');
    await getGenerateButton(page).click();

    const baseImage = page.getByAltText('Canvas base');
    await expect(baseImage).toHaveAttribute('src', RED_IMAGE_DATA_URL);

    await promptInput.fill('first edit');
    await getEditButton(page).click();
    await expect(baseImage).toHaveAttribute('src', BLUE_IMAGE_DATA_URL);
    await page.waitForFunction(() => {
      const img = document.querySelector('img[alt="Canvas base"]') as HTMLImageElement | null;
      return img?.complete && img.naturalWidth === 4;
    });

    await promptInput.fill('second edit');
    await getEditButton(page).click();
    await expect.poll(() => originalUploads.length).toBe(2);

    expect(originalUploads[0]).toBe(dataUrlToBase64Payload(RED_IMAGE_DATA_URL));
    expect(originalUploads[1]).toBe(dataUrlToBase64Payload(BLUE_IMAGE_DATA_URL));
  });

  test('API error shows toast notification', async ({ page }) => {
    await page.route('/api/generate', async (route) => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Mock API error' }),
      });
    });

    const promptInput = getPromptInput(page);
    await promptInput.fill('trigger error');

    const generateBtn = getGenerateButton(page);
    await generateBtn.click();

    await expect(page.locator('text=Mock API error')).toBeVisible();
  });
});
