import assert from 'node:assert/strict';
import { chromium, expect } from '@playwright/test';

const base = 'http://localhost:5180';
const browser = await chromium.launch({ headless: true });
try {
    for (const width of [390, 1440]) {
        const page = await browser.newPage({ viewport: { width, height: 900 } });
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        page.on('response', response => {
            const url = new URL(response.url());
            if (url.origin === base && response.status() >= 400) errors.push(response.status() + ' ' + url.pathname);
        });
        await page.goto(base + '/');
        await page.getByRole('link', { name: /intră în cont/i }).first().click();
        const submit = page.getByRole('button', { name: 'Intră în cont', exact: true });
        await expect(submit).toBeVisible();
        await expect(page.locator('input[type="password"]')).toBeVisible();
        await page.reload();
        await expect(submit).toBeVisible();
        assert.deepEqual(errors, [], 'Login must load without module or runtime errors');
        console.log('Dev login ' + width + 'px PASS: landing navigation, form and direct reload, no runtime/module errors.');
        await page.close();
    }
} finally {
    await browser.close();
}
