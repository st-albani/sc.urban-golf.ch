import { test, expect } from './fixtures'

test.describe('Loch-Vollständigkeit (Smoke)', () => {
  const gameId = 'mock-game-alpha-2026' // 4 Spieler, Löcher 1–3 vollständig erfasst

  test('zeigt "4/4 erfasst" wenn alle Spieler einen Score haben', async ({ page, mockApi }) => {
    void mockApi
    await page.goto(`/games/${gameId}/1`)
    const completion = page.locator('.hole-completion')
    await expect(completion).toContainText('4/4')
    await expect(completion).toHaveClass(/is-complete/)
    // Keine Spieler-Kachel ist als fehlend markiert
    await expect(page.locator('.player-tile--missing')).toHaveCount(0)
  })

  test('markiert fehlende Spieler auf einem leeren Loch und zählt beim Eintragen hoch', async ({ page, mockApi }) => {
    void mockApi
    // Loch 4 wurde noch nie erfasst → alle 4 Spieler fehlen
    await page.goto(`/games/${gameId}/4`)
    const completion = page.locator('.hole-completion')
    await expect(completion).toContainText('0/4')
    await expect(completion).not.toHaveClass(/is-complete/)
    await expect(page.locator('.player-tile--missing')).toHaveCount(4)

    // Score für Anna eintragen → Zähler 1/4, Annas Kachel nicht mehr fehlend
    const annaTile = page.locator('.player-tile', { hasText: 'Anna Meier' })
    await annaTile.getByRole('button', { name: 'Mehr Schläge' }).click()
    await expect(completion).toContainText('1/4')
    await expect(annaTile).not.toHaveClass(/player-tile--missing/)
    await expect(page.locator('.player-tile--missing')).toHaveCount(3)
  })
})
