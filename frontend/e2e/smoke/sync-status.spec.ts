import { test, expect } from './fixtures'

test.describe('Sync-Status-Indikator (Smoke)', () => {
  const gameId = 'mock-game-alpha-2026'

  test('bleibt versteckt solange online und nichts ausstehend ist', async ({ page, mockApi }) => {
    void mockApi
    await page.goto(`/games/${gameId}/1`)
    await expect(page.locator('.player-tile').first()).toBeVisible()
    await expect(page.locator('.sync-status')).toBeHidden()
  })

  test('zeigt Offline-Status, zählt ausstehende Änderungen und verschwindet nach Reconnect', async ({ page, context, mockApi }) => {
    void mockApi
    await page.goto(`/games/${gameId}/1`)
    await expect(page.locator('.player-tile').first()).toBeVisible()

    const indicator = page.locator('.sync-status')

    // Offline gehen → Indikator erscheint
    await context.setOffline(true)
    await expect(indicator).toBeVisible()
    await expect(indicator).toContainText('Offline')

    // Score offline eintragen → wandert in die Queue → Zähler steigt
    const anna = page.locator('.player-tile', { hasText: 'Anna Meier' })
    await anna.getByRole('button', { name: 'Mehr Schläge' }).click()
    await expect(indicator).toContainText('1')

    // Wieder online → Queue wird geflusht → Indikator verschwindet
    await context.setOffline(false)
    await expect(indicator).toBeHidden()
  })
})
