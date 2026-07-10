import { test, expect } from './fixtures'

test.describe('Score-Entry Hole-View (Smoke)', () => {
  const gameId = 'mock-game-alpha-2026'

  test('Plus/Minus Buttons ändern den Score und rufen API', async ({ page, mockApi }) => {
    const scorePosts: unknown[] = []
    page.on('request', (req) => {
      if (req.method() === 'POST' && /\/api\/scores(\?|$)/.test(req.url())) {
        scorePosts.push(JSON.parse(req.postData() || '{}'))
      }
    })

    await page.goto(`/games/${gameId}/1`)
    await expect(page.locator('.player-tile').first()).toBeVisible()

    // Ausgangswert für Anna Meier auf Loch 1 = 3
    const annaTile = page.locator('.player-tile', { hasText: 'Anna Meier' })
    await expect(annaTile.locator('.stroke-value')).toHaveText('3')

    // + Button
    await annaTile.getByRole('button', { name: 'Mehr Schläge' }).click()
    await expect(annaTile.locator('.stroke-value')).toHaveText('4')

    // Warten bis der POST abgesetzt wurde
    await page.waitForTimeout(250)
    expect(scorePosts.length).toBeGreaterThan(0)
    const last = scorePosts.at(-1) as { strokes: number; hole: number }
    expect(last.strokes).toBe(4)
    expect(last.hole).toBe(1)

    // - Button
    await annaTile.getByRole('button', { name: 'Weniger Schläge' }).click()
    await expect(annaTile.locator('.stroke-value')).toHaveText('3')

    void mockApi
  })

  test('Keypad via Tap auf Score ändert den Wert', async ({ page, mockApi }) => {
    void mockApi
    await page.goto(`/games/${gameId}/1`)
    const boris = page.locator('.player-tile', { hasText: 'Boris Wild' })
    await boris.locator('.stroke-value').click()

    // Keypad öffnet sich als Sheet
    await expect(page.locator('.sheet')).toBeVisible()
    await page.locator('.keypad__btn', { hasText: '7' }).first().click()

    await expect(page.locator('.sheet')).not.toBeVisible()
    await expect(boris.locator('.stroke-value')).toHaveText('7')
  })

  test('Hole-Pill Navigation wechselt das Loch', async ({ page, mockApi }) => {
    void mockApi
    await page.goto(`/games/${gameId}/1`)
    // Pill per href ansteuern — robust gegenüber Icon/Textinhalt der Pill.
    await page.locator(`a.hole-progress__chip[href$="/${gameId}/2"]`).click()
    await expect(page).toHaveURL(new RegExp(`/games/${gameId}/2$`))
    await expect(page.locator('.hole-header__number')).toHaveText('2')
  })
})
