import { test, expect } from './fixtures'

test.describe('Login / optionale Identität (Smoke)', () => {
  test('E-Mail-OTP-Login über die Einstellungen', async ({ page, mockApi }) => {
    void mockApi
    await page.goto('/')

    // Einstellungen öffnen und Login starten
    await page.getByRole('button', { name: /Profil öffnen|Open profile/i }).click()
    await page.getByRole('button', { name: 'Anmelden', exact: true }).click()

    // Auth-Sheet (liegt über dem Settings-Sheet)
    const sheet = page.locator('.sheet').last()
    await sheet.locator('#auth-email').fill('spieler@example.com')
    await sheet.getByRole('button', { name: 'Code anfordern' }).click()

    await sheet.locator('#auth-code').fill('123456')
    await sheet.getByRole('button', { name: 'Anmelden', exact: true }).click()

    // Login schließt das Sheet — Einstellungen erneut öffnen und Konto prüfen
    await expect(page.locator('.sheet')).toHaveCount(0)
    await page.getByRole('button', { name: /Profil öffnen|Open profile/i }).click()
    await expect(page.getByText('spieler@example.com')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Abmelden' })).toBeVisible()
  })

  test('falscher Code zeigt einen Fehler, kein Login', async ({ page, mockApi }) => {
    void mockApi
    await page.goto('/')
    await page.getByRole('button', { name: /Profil öffnen|Open profile/i }).click()
    await page.getByRole('button', { name: 'Anmelden', exact: true }).click()

    const sheet = page.locator('.sheet').last()
    await sheet.locator('#auth-email').fill('spieler@example.com')
    await sheet.getByRole('button', { name: 'Code anfordern' }).click()
    await sheet.locator('#auth-code').fill('000000')
    await sheet.getByRole('button', { name: 'Anmelden', exact: true }).click()

    await expect(sheet.getByRole('alert')).toBeVisible()
  })

  test('anonymes Spielen bleibt ohne Login möglich', async ({ page, mockApi }) => {
    void mockApi
    await page.goto('/games/new')
    await expect(page.locator('.new-game')).toBeVisible()
  })
})
