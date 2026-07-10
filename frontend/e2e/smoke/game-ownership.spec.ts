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
  test('eingeloggt ist man automatisch als Spieler 1 („Du") dabei', async ({ page, mockApi }) => {
    void mockApi
    await signIn(page)

    // Ohne einen Anzeigenamen zu setzen: die „Du"-Zeile ist automatisch da,
    // mit dem Default-Namen aus der E-Mail (lokaler Teil).
    await page.goto('/games/new')
    const selfRow = page.locator('.new-game__player--self')
    await expect(selfRow).toBeVisible()
    await expect(selfRow.locator('.new-game__self-badge')).toHaveText('Du')
    await expect(selfRow.locator('.new-game__self-name')).toHaveText('spieler')
  })

  test('eingeloggt erstelltes Spiel erscheint in „Meine Spiele"', async ({ page, mockApi }) => {
    void mockApi
    await signIn(page)

    // Neues Spiel eingeloggt erstellen — die „Du"-Zeile genügt als Spieler 1.
    await page.goto('/games/new')
    await page.locator('input#game-name').fill('Ownership-Testrunde')
    await expect(page.locator('.new-game__player--self')).toBeVisible()
    await page.getByRole('button', { name: 'Spiel starten' }).click()
    await page.waitForURL(/\/games\/[^/]+\/1$/)

    // In „Meine Spiele" muss die selbst erstellte Runde auftauchen (created_by)
    await page.goto('/games')
    await page.getByRole('tab', { name: 'Meine' }).click()
    await expect(page.getByText('Ownership-Testrunde')).toBeVisible()
  })

  test('der Anzeigename aus dem Profil erscheint in der „Du"-Zeile', async ({ page, mockApi }) => {
    void mockApi
    await signIn(page)

    await page.getByRole('button', { name: /Profil öffnen|Open profile/i }).click()
    await page.getByRole('button', { name: /Anzeigename/ }).click()
    await page.locator('#settings-name').fill('Selbsttester')
    await page.getByRole('button', { name: 'Absenden' }).click()
    await expect(page.locator('.toast__message')).toBeVisible()
    await page.keyboard.press('Escape')

    await page.goto('/games/new')
    const selfRow = page.locator('.new-game__player--self')
    await expect(selfRow).toBeVisible()
    await expect(selfRow.locator('.new-game__self-name')).toHaveText('Selbsttester')
  })

  test('anonym gibt es keine „Du"-Zeile', async ({ page, mockApi }) => {
    void mockApi
    await page.goto('/games/new')
    await expect(page.locator('.new-game__player--self')).toHaveCount(0)
  })
})
