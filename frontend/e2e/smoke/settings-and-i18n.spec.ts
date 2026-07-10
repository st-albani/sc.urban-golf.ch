import { test, expect } from './fixtures'

test.describe('Settings & i18n (Smoke)', () => {
  test('öffnet das Settings-Sheet und wechselt Theme', async ({ page, mockApi }) => {
    void mockApi
    await page.goto('/')

    // Settings-Cog im TopBar
    // Settings-Cog hat ein lokalisiertes aria-label (de = "Einstellungen")
await page.getByRole('button', { name: /Profil öffnen|Open profile/i }).click()
    await expect(page.locator('.sheet')).toBeVisible()

    // In das Design-Sub-Panel navigieren
    await page.getByRole('button', { name: /Design/ }).click()

    // Theme auf Dark stellen
    await page.getByRole('button', { name: 'Dunkel', exact: true }).click()
    await expect(page.locator('html')).toHaveClass(/dark/)

    // Zurück zu Hell
    await page.getByRole('button', { name: 'Hell', exact: true }).click()
    await expect(page.locator('html')).not.toHaveClass(/dark/)
  })

  test('Sprache wechseln auf Englisch ändert sichtbaren Text', async ({ page, mockApi }) => {
    void mockApi
    await page.goto('/')
    // Settings-Cog hat ein lokalisiertes aria-label (de = "Einstellungen")
await page.getByRole('button', { name: /Profil öffnen|Open profile/i }).click()
    await page.getByRole('button', { name: /Sprache/ }).click()
    await page.getByRole('button', { name: /English/ }).click()

    // Sheet schließen
    await page.locator('.sheet__backdrop').click({ force: true }).catch(() => { /* ignore */ })

    // Primäre CTA im Hero sollte nun auf Englisch sein, unabhängig vom Viewport
    await expect(page.getByRole('link', { name: /New Game/ })).toBeVisible()
  })
})
