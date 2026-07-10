import { test, expect } from './fixtures'

async function signIn(page: import('@playwright/test').Page) {
  await page.goto('/')
  await page.getByRole('button', { name: /Einstellungen|Settings/i }).click()
  await page.getByRole('button', { name: 'Anmelden', exact: true }).click()
  const sheet = page.locator('.sheet').last()
  await sheet.locator('#auth-email').fill('spieler@example.com')
  await sheet.getByRole('button', { name: 'Code anfordern' }).click()
  await sheet.locator('#auth-code').fill('123456')
  await sheet.getByRole('button', { name: 'Anmelden', exact: true }).click()
  await expect(page.locator('.sheet')).toHaveCount(0)
}

test.describe('Identität ↔ Spieler & Meine Spiele (Smoke)', () => {
  test('Anzeigename setzen ordnet Runden zu', async ({ page, mockApi }) => {
    void mockApi
    await signIn(page)
    await page.getByRole('button', { name: /Einstellungen|Settings/i }).click()
    await page.locator('#settings-name').fill('Anna Meier')
    await page.getByRole('button', { name: 'Absenden' }).click()
    // Toast bestätigt die Zuordnung
    await expect(page.getByText(/zugeordnet/)).toBeVisible()
  })

  test('„Meine Spiele"-Filter zeigt die eigenen Runden', async ({ page, mockApi }) => {
    void mockApi
    await signIn(page)
    await page.goto('/games')
    // Filter (Segmented Control, role=tab) erscheint nur eingeloggt
    await page.getByRole('tab', { name: 'Meine' }).click()
    await expect(page.getByText('Stadtpark-Runde')).toBeVisible()
    // Nur die eigene Runde (my-games), nicht die zweite Runde aus /summary
    await expect(page.getByText('Frühlings-Training')).toHaveCount(0)
  })

  test('Statistik-Seite zeigt Kennzahlen und Trend', async ({ page, mockApi }) => {
    void mockApi
    await signIn(page)
    await page.goto('/account')
    await expect(page.getByText('Runden', { exact: true })).toBeVisible()
    await expect(page.getByText('Sieg-Quote')).toBeVisible()
    await expect(page.locator('.trend__line')).toBeVisible()
  })
})
