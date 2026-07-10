import { test, expect } from './fixtures'

test.describe('Spiel beitreten (Smoke)', () => {
  const gameId = 'mock-game-alpha-2026'

  test('manueller Fallback: Link einfügen führt ins Spiel', async ({ page, mockApi }) => {
    void mockApi
    await page.goto('/games')
    await page.getByRole('button', { name: 'Spiel beitreten' }).click()

    const sheet = page.locator('.sheet')
    await expect(sheet).toBeVisible()

    await sheet.locator('#join-manual').fill(`https://sc.urban-golf.ch/games/${gameId}`)
    await sheet.getByRole('button', { name: 'Beitreten' }).click()

    await expect(page).toHaveURL(new RegExp(`/games/${gameId}$`))
    await expect(page.locator('.games-detail__title')).toContainText('Stadtpark-Runde')
  })

  test('ungültige Eingabe zeigt einen Fehlerhinweis', async ({ page, mockApi }) => {
    void mockApi
    await page.goto('/games')
    await page.getByRole('button', { name: 'Spiel beitreten' }).click()

    const sheet = page.locator('.sheet')
    await sheet.locator('#join-manual').fill('nope')
    await sheet.getByRole('button', { name: 'Beitreten' }).click()

    await expect(sheet.getByText('Kein gültiger Spiel-Link.')).toBeVisible()
    await expect(page).toHaveURL(/\/games$/)
  })
})
