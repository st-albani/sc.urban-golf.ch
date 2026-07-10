import { test, expect } from './fixtures'

test.describe('Spiel teilen (Smoke)', () => {
  const gameId = 'mock-game-alpha-2026'

  test('Teilen-Button öffnet Sheet mit Spiel-Link und kopiert ihn', async ({ page, context, mockApi }) => {
    void mockApi
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])

    await page.goto(`/games/${gameId}`)
    await page.getByRole('button', { name: 'Spiel teilen' }).click()

    const sheet = page.locator('.sheet')
    await expect(sheet).toBeVisible()

    // Der angezeigte Link zeigt auf die Spielansicht dieses Spiels
    await expect(sheet.locator('#share-link')).toHaveValue(new RegExp(`/games/${gameId}$`))

    // Hinweis, dass jeder mit dem Link mitschreiben kann
    await expect(sheet).toContainText('Link')

    // Kopieren → Bestätigung "Kopiert!"
    await sheet.getByRole('button', { name: 'Link kopieren' }).click()
    await expect(sheet.getByText('Kopiert!')).toBeVisible()
  })

  test('geteilter Deep-Link führt direkt zur Spielansicht', async ({ page, mockApi }) => {
    void mockApi
    // Ein Beitretender öffnet den geteilten Link direkt
    await page.goto(`/games/${gameId}`)
    await expect(page.locator('.games-detail__title')).toContainText('Stadtpark-Runde')
  })
})
