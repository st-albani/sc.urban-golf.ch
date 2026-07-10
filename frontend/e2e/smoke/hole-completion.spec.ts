import { test, expect } from './fixtures'

test.describe('Fehlende-Spieler-Markierung (Smoke)', () => {
  const gameId = 'mock-game-alpha-2026' // 4 Spieler, Löcher 1–3 vollständig erfasst

  test('keine Kachel ist als fehlend markiert, wenn alle einen Score haben', async ({ page, mockApi }) => {
    void mockApi
    await page.goto(`/games/${gameId}/1`)
    await expect(page.locator('.player-tile').first()).toBeVisible()
    await expect(page.locator('.player-tile--missing')).toHaveCount(0)
  })

  test('markiert fehlende Spieler auf einem leeren Loch und hebt die Markierung beim Eintragen auf', async ({ page, mockApi }) => {
    void mockApi
    // Loch 4 wurde noch nie erfasst → alle 4 Spieler fehlen
    await page.goto(`/games/${gameId}/4`)
    await expect(page.locator('.player-tile--missing')).toHaveCount(4)

    // Score für Anna eintragen → ihre Kachel ist nicht mehr fehlend
    const annaTile = page.locator('.player-tile', { hasText: 'Anna Meier' })
    await annaTile.getByRole('button', { name: 'Mehr Schläge' }).click()
    await expect(annaTile).not.toHaveClass(/player-tile--missing/)
    await expect(page.locator('.player-tile--missing')).toHaveCount(3)
  })
})
