import { test, expect } from './fixtures'

async function signIn(page: import('@playwright/test').Page) {
  await page.goto('/')
  await page.getByRole('button', { name: /Profil öffnen|Open profile/i }).click()
  await page.getByRole('button', { name: 'Anmelden', exact: true }).click()
  const sheet = page.locator('.sheet').last()
  await sheet.locator('#auth-email').fill('spieler@example.com')
  await sheet.getByRole('button', { name: 'Code anfordern' }).click()
  await sheet.locator('#auth-code').fill('123456')
  await sheet.getByRole('button', { name: 'Anmelden', exact: true }).click()
  await expect(page.locator('.sheet')).toHaveCount(0)
}

test.describe('Spiel-Ownership (Smoke)', () => {
  test('eingeloggt erstelltes Spiel erscheint in „Meine Spiele"', async ({ page, mockApi }) => {
    void mockApi
    await signIn(page)

    // Neues Spiel eingeloggt erstellen
    await page.goto('/games/new')
    await page.locator('input#game-name').fill('Ownership-Testrunde')
    await page.locator('.new-game__player-input').first().fill('Testspieler Eins')
    await page.getByRole('button', { name: 'Spiel starten' }).click()
    await page.waitForURL(/\/games\/[^/]+\/1$/)

    // In „Meine Spiele" muss die selbst erstellte Runde auftauchen (created_by)
    await page.goto('/games')
    await page.getByRole('tab', { name: 'Meine' }).click()
    await expect(page.getByText('Ownership-Testrunde')).toBeVisible()
  })
})
