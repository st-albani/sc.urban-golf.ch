import { test, expect } from './fixtures'
import type { Page } from '@playwright/test'

// Chromiums virtueller Authenticator ersetzt Fingerabdruck/Geräte-PIN: die
// WebAuthn-Zeremonie läuft echt im Browser, nur das Backend ist gemockt.
async function addVirtualAuthenticator(page: Page) {
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('WebAuthn.enable')
  await cdp.send('WebAuthn.addVirtualAuthenticator', {
    options: {
      protocol: 'ctap2',
      transport: 'internal',
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  })
}

async function openLoginSheet(page: Page) {
  await page.getByRole('button', { name: /Profil öffnen|Open profile/i }).click()
  await page.getByRole('button', { name: 'Anmelden', exact: true }).click()
  return page.locator('.sheet').last()
}

test.describe('Passkey-Login (Smoke)', () => {
  test('Passkey einrichten und sich danach damit anmelden', async ({ page, mockApi }) => {
    void mockApi
    await addVirtualAuthenticator(page)
    await page.goto('/')

    // Erst per E-Mail-OTP einloggen …
    let sheet = await openLoginSheet(page)
    await sheet.locator('#auth-email').fill('spieler@example.com')
    await sheet.getByRole('button', { name: 'Code anfordern' }).click()
    await sheet.locator('#auth-code').fill('123456')
    await sheet.getByRole('button', { name: 'Anmelden', exact: true }).click()
    await expect(page.locator('.sheet')).toHaveCount(0)

    // … dann in den Einstellungen einen Passkey einrichten.
    await page.getByRole('button', { name: /Profil öffnen|Open profile/i }).click()
    await page.getByRole('button', { name: 'Passkey einrichten' }).click()
    await expect(page.getByText(/Passkey eingerichtet/)).toBeVisible()

    // Abmelden lässt die Einstellungen offen; „Anmelden" führt direkt ins Login-Sheet.
    await page.getByRole('button', { name: 'Abmelden' }).click()
    await page.getByRole('button', { name: 'Anmelden', exact: true }).click()

    // Anmeldung per Passkey — ohne E-Mail-Eingabe.
    sheet = page.locator('.sheet').last()
    await sheet.getByRole('button', { name: 'Mit Passkey anmelden' }).click()
    await expect(page.locator('.sheet')).toHaveCount(0)
    await page.getByRole('button', { name: /Profil öffnen|Open profile/i }).click()
    await expect(page.getByText('spieler@example.com')).toBeVisible()
  })

  test('ohne WebAuthn-Unterstützung bleibt E-Mail-OTP der Login-Weg', async ({ page, mockApi }) => {
    void mockApi
    await page.addInitScript(() => {
      Object.defineProperty(window, 'PublicKeyCredential', { value: undefined, configurable: true })
    })
    await page.goto('/')

    const sheet = await openLoginSheet(page)
    await expect(sheet.locator('#auth-email')).toBeVisible()
    await expect(sheet.getByRole('button', { name: 'Code anfordern' })).toBeVisible()
    await expect(sheet.getByRole('button', { name: 'Mit Passkey anmelden' })).toHaveCount(0)
  })
})
