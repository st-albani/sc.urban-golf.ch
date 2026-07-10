import { test, expect } from './fixtures'

test.describe('Spielersuche (Smoke)', () => {
  test('Autocomplete verknüpft einen registrierten Spieler beim Tippen', async ({ page, mockApi }) => {
    void mockApi
    await page.goto('/games/new')

    // In eine Freitext-Spielerzeile einen Namen tippen → Vorschlag erscheint
    await page.locator('.new-game__player-input').first().fill('Rita')
    await page.locator('.new-game__suggest-item').first().click()

    // Die Zeile ist jetzt eine registrierte, read-only Identität
    const registered = page.locator('.new-game__self--registered')
    await expect(registered).toBeVisible()
    await expect(registered.locator('.new-game__self-name')).toHaveText('Registrierte Rita')
    await expect(registered.locator('input')).toHaveCount(0)
  })

  test('gleichnamige registrierte Spieler zeigen eine Kennung zur Unterscheidung', async ({ page, mockApi }) => {
    void mockApi
    await page.goto('/games/new')
    await page.locator('.new-game__player-input').first().fill('Rita')

    // Beide gleichnamigen Treffer bekommen eine kurze Kennung.
    const codes = page.locator('.new-game__suggest-code')
    await expect(codes).toHaveCount(2)
    await expect(codes.first()).toHaveText('#A1B2')
  })
})
