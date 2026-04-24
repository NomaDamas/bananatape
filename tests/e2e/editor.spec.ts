import { test, expect } from '@playwright/test';

const FAKE_IMAGE_DATA_URL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAYAAABw4pVUAAAAnElEQVR42u3RAQ0AAAgDIN8/9GK3hEfgmigAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAALgZq2QBBZ7wzJAAAAAASUVORK5CYII=';

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
    const selectBtn = page.locator('button[title="Select"]');

    await penBtn.click();
    await expect(penBtn).toHaveClass(/bg-/);

    await boxBtn.click();
    await expect(boxBtn).toHaveClass(/bg-/);

    await selectBtn.click();
    await expect(selectBtn).toHaveClass(/bg-/);

    await page.keyboard.press('1');
    await expect(panBtn).toHaveClass(/bg-/);

    await page.keyboard.press('2');
    await expect(penBtn).toHaveClass(/bg-/);

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
