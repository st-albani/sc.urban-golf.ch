import { test, expect } from './fixtures'

test.describe('Live-Aktualisierung (Smoke)', () => {
  const gameId = 'mock-game-alpha-2026'

  test('Score-Änderung eines anderen Geräts erscheint automatisch', async ({ page, mockApi }) => {
    await page.goto(`/games/${gameId}/1`)
    const david = page.locator('.player-tile', { hasText: 'David Huber' })
    await expect(david.locator('.stroke-value')).toHaveText('2')

    // Ein anderes Gerät ändert Davids Loch 1 (Mutation am Mock-State)
    const entry = mockApi.scores.find((s) => s.player_id === 'pl-david-huber-04' && s.hole === 1)!
    entry.strokes = 12

    // Nächster Poll übernimmt den neuen Wert (Intervall 4 s)
    await expect(david.locator('.stroke-value')).toHaveText('12', { timeout: 8000 })
  })

  test('Zuschauer-Modus blendet alle Schreib-Einstiege aus', async ({ page, mockApi }) => {
    void mockApi
    await page.goto(`/games/${gameId}?spectator`)
    await expect(page.locator('.games-detail__title')).toContainText('Stadtpark-Runde')
    // Kein Teilen/Bearbeiten und keine Loch-Chips (die in die editierbare Hole-View führen)
    await expect(page.locator('.games-detail__title-actions')).toHaveCount(0)
    await expect(page.locator('.games-detail__holes')).toHaveCount(0)
  })
})
