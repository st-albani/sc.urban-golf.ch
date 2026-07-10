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
})
