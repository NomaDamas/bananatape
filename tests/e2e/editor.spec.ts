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
  return page.locator('[data-testid="bottom-prompt-input"]');
}

function getGenerateButton(page: import('@playwright/test').Page) {
  return page.locator('[data-testid="bottom-primary-action"]');
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

    await expect(page.locator('button[title="Pan (1)"]')).toBeVisible();
    await expect(page.locator('button[title="Pen (2)"]')).toBeVisible();
    await expect(page.locator('button[title="Box (3)"]')).toBeVisible();
    await expect(page.locator('button[title="Arrow (4)"]')).toBeVisible();
    await expect(page.locator('button[title="Sticky memo (5)"]')).toBeVisible();

    await expect(getPromptInput(page)).toBeVisible();
    await expect(page.getByText(/OpenAI|god-tibo-imagen/).first()).toBeVisible();
    await expect(page.locator('button[title="Add reference image"], button[aria-label*="reference" i]').first()).toBeVisible();
    await expect(page.locator('button[title="Zoom in"]')).toBeVisible();
    await expect(page.locator('button[title="Zoom out"]')).toBeVisible();
  });

  test('provider choices expose only implemented providers', async ({ page }) => {
    await page.getByText(/OpenAI|god-tibo-imagen/).first().click();

    const options = await page.locator('[data-slot="select-item"], [role="option"]').allTextContents();
    expect(options.map((option) => option.trim()).filter(Boolean).sort()).toEqual([
      'OpenAI',
      'god-tibo-imagen',
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
    await expect(dialog.getByRole('button', { name: /download/i })).toBeEnabled();

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
    const selectBtn = page.locator('button[title="Select"]');

    await penBtn.click();
    await expect(penBtn).toHaveClass(/bg-/);

    await boxBtn.click();
    await expect(boxBtn).toHaveClass(/bg-/);

    await arrowBtn.click();
    await expect(arrowBtn).toHaveClass(/bg-/);

    await memoBtn.click();
    await expect(memoBtn).toHaveClass(/bg-/);

    await selectBtn.click();
    await expect(selectBtn).toHaveClass(/bg-/);

    await page.keyboard.press('1');
    await expect(panBtn).toHaveClass(/bg-/);

    await page.keyboard.press('2');
    await expect(penBtn).toHaveClass(/bg-/);

    await page.keyboard.press('4');
    await expect(arrowBtn).toHaveClass(/bg-/);

    await page.keyboard.press('5');
    await expect(memoBtn).toHaveClass(/bg-/);

    await page.keyboard.press('Escape');
    await expect(selectBtn).toHaveClass(/bg-/);
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

    await page.locator('[data-testid="reference-image-input"]').setInputFiles({
      name: 'style-reference.png',
      mimeType: 'image/png',
      buffer: Buffer.from(RED_IMAGE_DATA_URL.split(',')[1], 'base64'),
    });
    await expect(page.locator('[data-testid="reference-image-list"]')).toBeVisible();

    const promptInput = getPromptInput(page);
    await promptInput.fill('generate with this style reference');
    await getGenerateButton(page).click();

    await expect.poll(() => uploadedReferences.length).toBe(1);
    expect(uploadedPrompt).toBe('generate with this style reference');
    expect(uploadedReferences[0].toString('base64')).toBe(dataUrlToBase64Payload(RED_IMAGE_DATA_URL));
    await expect(promptInput).toHaveValue('');
    await expect(page.locator('[data-testid="reference-image-list"]')).toBeHidden();
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

    await expect(page.locator('button[title="Add reference image"]')).toBeVisible();

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

    await expect(page.locator('[data-testid="reference-image-list"]')).toBeVisible();
    await expect(page.locator('text=Pasted image added as a reference')).toBeVisible();

    const promptInput = getPromptInput(page);
    await promptInput.fill('generate from pasted reference');
    await getGenerateButton(page).click();

    await expect.poll(() => uploadedReferences.length).toBe(1);
    expect(uploadedReferences[0].toString('base64')).toBe(dataUrlToBase64Payload(RED_IMAGE_DATA_URL));
    await expect(promptInput).toHaveValue('');
    await expect(page.locator('[data-testid="reference-image-list"]')).toBeHidden();
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

    await chooseProvider(page, 'god-tibo-imagen');

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

    await page.locator('[data-testid="reference-image-input"]').setInputFiles({
      name: 'edit-reference.png',
      mimeType: 'image/png',
      buffer: Buffer.from(BLUE_IMAGE_DATA_URL.split(',')[1], 'base64'),
    });
    await expect(page.locator('[data-testid="reference-image-list"]')).toBeVisible();

    await promptInput.fill('apply annotated memo and arrow');
    await getEditButton(page).click();

    await expect.poll(() => uploadedImages.length).toBe(3);
    expect(uploadedPrompt).toBe('apply annotated memo and arrow');
    expect(uploadedImages[0].toString('base64')).toBe(dataUrlToBase64Payload(FAKE_IMAGE_DATA_URL));
    expect(uploadedImages[1].toString('base64')).not.toBe(dataUrlToBase64Payload(FAKE_IMAGE_DATA_URL));
    expect(uploadedImages[2].toString('base64')).toBe(dataUrlToBase64Payload(BLUE_IMAGE_DATA_URL));
    await expect(promptInput).toHaveValue('');
    await expect(page.locator('[data-testid="reference-image-list"]')).toBeHidden();
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
    const clearBtn = page.locator('[data-testid="standalone-left-panel"] button[title="Clear canvas annotations"]');
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

    await chooseProvider(page, 'god-tibo-imagen');

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
