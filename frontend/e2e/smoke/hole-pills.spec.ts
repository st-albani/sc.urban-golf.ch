import { test, expect } from './fixtures'

test.describe('Loch-Pill-Vollständigkeit (Smoke)', () => {
  const gameId = 'mock-game-alpha-2026' // 4 Spieler, Löcher 1–3 vollständig erfasst

  test('Loch-Chips der Detailansicht markieren vollständige Löcher', async ({ page, mockApi }) => {
    void mockApi
    await page.goto(`/games/${gameId}`)
    // Löcher 1–3 sind für alle 4 Spieler erfasst → drei vollständige Chips mit Häkchen
    const complete = page.locator('.games-detail__hole-chip.is-complete')
    await expect(complete).toHaveCount(3)
    await expect(page.locator('.games-detail__hole-chip.is-complete .games-detail__hole-check').first()).toBeVisible()
  })

  test('Pill wechselt von teilweise auf vollständig, sobald alle Spieler erfasst sind', async ({ page, mockApi }) => {
    void mockApi
    // Loch 4 ist noch nie erfasst worden
    await page.goto(`/games/${gameId}/4`)

    // Erster Score → Loch-Pill 4 erscheint und ist "teilweise"
    const players = ['Anna Meier', 'Boris Wild', 'Christian Schmid', 'David Huber']
    await page.locator('.player-tile', { hasText: players[0] })
      .getByRole('button', { name: 'Mehr Schläge' }).click()

    // Pill per href ansteuern und die Add-Pill ausschließen — robust gegenüber
    // Icon/Textinhalt und dem "+1"-Chip.
    const pill4 = page.locator(
      `a.hole-progress__chip:not(.hole-progress__chip--add)[href$="/${gameId}/4"]`
    )
    await expect(pill4).toHaveClass(/is-partial/)
    await expect(pill4).not.toHaveClass(/is-complete/)

    // Restliche Spieler ausfüllen → Pill wird vollständig
    for (const name of players.slice(1)) {
      await page.locator('.player-tile', { hasText: name })
        .getByRole('button', { name: 'Mehr Schläge' }).click()
    }

    await expect(pill4).toHaveClass(/is-complete/)
    await expect(pill4.locator('.hole-progress__check')).toBeVisible()
  })
})
