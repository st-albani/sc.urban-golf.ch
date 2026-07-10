import { test, expect } from './fixtures'

test.describe('Spielersuche (Smoke)', () => {
  test('fügt einen registrierten Spieler zum neuen Spiel hinzu (auch ohne Login)', async ({ page, mockApi }) => {
    void mockApi
    await page.goto('/games/new')

    // Suche öffnen und nach einem registrierten Spieler suchen
    await page.getByRole('button', { name: /Registrierten Spieler suchen|Find registered player/ }).click()
    await page.locator('.new-game__search-input').fill('Rita')

    // Ergebnis auswählen → registrierte, read-only Zeile
    await page.locator('.new-game__result').first().click()

    const registered = page.locator('.new-game__self--registered')
    await expect(registered).toBeVisible()
    await expect(registered.locator('.new-game__self-name')).toHaveText('Registrierte Rita')
    // Kein Freitext-Input für die registrierte Zeile
    await expect(registered.locator('input')).toHaveCount(0)
  })
})
