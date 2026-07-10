import { test, expect } from './fixtures'

test.describe('App-Version (Smoke)', () => {
  test('zeigt die aktuelle Version 3.x im Settings-Sheet', async ({ page, mockApi }) => {
    void mockApi
    await page.goto('/')
    await page.getByRole('button', { name: /Profil öffnen|Open profile/i }).click()
    await expect(page.locator('.sheet')).toBeVisible()

    // Der Version-Footer muss eine semver-ähnliche Version zeigen (3.x.x)
    const meta = page.locator('.settings__meta')
    await expect(meta).toBeVisible()
    await expect(meta).toContainText(/3\.\d+\.\d+/)
  })
})
