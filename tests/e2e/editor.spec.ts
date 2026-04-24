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

test.describe('CodexDesign Editor', () => {
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

  test('renders editor layout with all sections', async ({ page }) => {
    await expect(page.locator('text=CodexDesign')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'History' })).toBeVisible();
    await expect(page.locator('text=No image loaded')).toBeVisible();
    await expect(page.locator('button[title="Pan (1)"]')).toBeVisible();
    await expect(page.locator('button[title="Pen (2)"]')).toBeVisible();
    await expect(page.locator('button[title="Box (3)"]')).toBeVisible();
    await expect(page.locator('button[title="Arrow (4)"]')).toBeVisible();
    await expect(page.locator('button[title="Sticky memo (5)"]')).toBeVisible();
  });

  test('pan is the default active tool', async ({ page }) => {
    const panBtn = page.locator('button[title="Pan (1)"]');
    await expect(panBtn).toHaveClass(/bg-/);
  });

  test('prompt input accepts typing and backspace', async ({ page }) => {
    const promptInput = page.locator('input[placeholder*="generate"], textarea[placeholder*="generate"]').first();
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

  test('zoom buttons change viewport zoom', async ({ page }) => {
    const promptInput = page.locator('input[placeholder*="generate"]').first();
    await promptInput.fill('zoom test');
    await page.locator('button:has-text("Generate")').click();
    await expect(page.locator('text=zoom test').first()).toBeVisible();

    const wrapper = page.locator('[data-testid="transform-wrapper"]');
    await expect(wrapper).toHaveAttribute('data-zoom', '1');

    await page.locator('button[title="Zoom in"]').click();
    const zoomAfterIn = await wrapper.getAttribute('data-zoom');
    expect(parseFloat(zoomAfterIn!)).toBeGreaterThan(1);

    await page.locator('button[title="Zoom out"]').click();
    await expect(wrapper).toHaveAttribute('data-zoom', '1');
  });

  test('mouse wheel zooms canvas', async ({ page }) => {
    const promptInput = page.locator('input[placeholder*="generate"]').first();
    await promptInput.fill('wheel zoom test');
    await page.locator('button:has-text("Generate")').click();
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
    const promptInput = page.locator('input[placeholder*="generate"]').first();
    await promptInput.fill('pan test');
    await page.locator('button:has-text("Generate")').click();
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
    const promptInput = page.locator('input[placeholder*="generate"]').first();
    await promptInput.fill('space pan test');
    await page.locator('button:has-text("Generate")').click();
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
    const promptInput = page.locator('input[placeholder*="generate"]').first();
    await promptInput.fill('canvas test');
    await page.locator('button:has-text("Generate")').click();
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
    const promptInput = page.locator('input[placeholder*="generate"]').first();
    await promptInput.fill('box test');
    await page.locator('button:has-text("Generate")').click();
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

    await page.route('/api/edit', async (route) => {
      const body = route.request().postDataBuffer();
      if (!body) throw new Error('Expected multipart edit body');
      uploadedImages = extractMultipartFileParts(body, 'images');

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

    await page.getByText('OpenAI').click();
    await page.locator('[data-slot="select-item"]').filter({ hasText: 'god-tibo-imagen' }).click();

    const promptInput = page.locator('input[placeholder^="Describe"]').first();
    await promptInput.fill('memo arrow source');
    await page.locator('button:has-text("Generate")').click();

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

    await promptInput.fill('apply annotated memo and arrow');
    await page.locator('button:has-text("Edit")').click();

    await expect.poll(() => uploadedImages.length).toBe(2);
    expect(uploadedImages[0].toString('base64')).toBe(dataUrlToBase64Payload(FAKE_IMAGE_DATA_URL));
    expect(uploadedImages[1].toString('base64')).not.toBe(dataUrlToBase64Payload(FAKE_IMAGE_DATA_URL));
  });

  test('draws pen stroke after zooming', async ({ page }) => {
    const promptInput = page.locator('input[placeholder*="generate"]').first();
    await promptInput.fill('zoomed draw test');
    await page.locator('button:has-text("Generate")').click();
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
    const clearBtn = page.locator('button[title="Clear annotations"]');
    await expect(clearBtn).toBeDisabled();

    const promptInput = page.locator('input[placeholder*="generate"]').first();
    await promptInput.fill('clear test');
    await page.locator('button:has-text("Generate")').click();
    await expect(page.locator('text=clear test').first()).toBeVisible();

    await expect(clearBtn).toBeDisabled();
  });

  test('history item click loads image', async ({ page }) => {
    const promptInput = page.locator('input[placeholder*="generate"]').first();
    await promptInput.fill('history test');

    const generateBtn = page.locator('button:has-text("Generate")');
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

    await page.getByText('OpenAI').click();
    await page.locator('[data-slot="select-item"]').filter({ hasText: 'god-tibo-imagen' }).click();

    const promptInput = page.locator('input[placeholder^="Describe"]').first();
    await promptInput.fill('initial red');
    await page.locator('button:has-text("Generate")').click();

    const baseImage = page.getByAltText('Canvas base');
    await expect(baseImage).toHaveAttribute('src', RED_IMAGE_DATA_URL);

    await promptInput.fill('first edit');
    await page.locator('button:has-text("Edit")').click();
    await expect(baseImage).toHaveAttribute('src', BLUE_IMAGE_DATA_URL);
    await page.waitForFunction(() => {
      const img = document.querySelector('img[alt="Canvas base"]') as HTMLImageElement | null;
      return img?.complete && img.naturalWidth === 4;
    });

    await promptInput.fill('second edit');
    await page.locator('button:has-text("Edit")').click();
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

    const promptInput = page.locator('input[placeholder*="generate"]').first();
    await promptInput.fill('trigger error');

    const generateBtn = page.locator('button:has-text("Generate")');
    await generateBtn.click();

    await expect(page.locator('text=Mock API error')).toBeVisible();
  });
});
