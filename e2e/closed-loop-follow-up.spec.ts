import { expect, test } from '@playwright/test'

test('surfaces an urgent melanoma gap and closes its follow-up task', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('heading', { name: 'DermPathOS' })).toBeVisible()
  await page.getByRole('button', { name: 'View Demo Cases' }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
  await expect(page.getByRole('heading', { name: 'Action Dashboard' })).toBeVisible()

  await expect(page.getByText('Biopsy cases').locator('..').getByText('4')).toBeVisible()
  const sarahRow = page.getByRole('row').filter({ hasText: 'Sarah Miller' })
  await expect(sarahRow).toContainText('Melanoma in situ')
  await expect(sarahRow).toContainText('No')
  await expect(sarahRow).toContainText('Urgent')
  await expect(sarahRow).toContainText('Open')

  await sarahRow.click()
  await expect(page).toHaveURL(/\/cases\/case-sarah-miller$/)
  await expect(page.getByRole('heading', { name: 'Sarah Miller' })).toBeVisible()
  await expect(page.getByText('Melanoma in situ, margins involved.')).toBeVisible()
  await expect(page.getByText('Recommended operational action')).toBeVisible()

  const graph = page.locator('#graph')
  await expect(page.getByRole('heading', { name: 'BiopsyGraph reasoning path' })).toBeVisible()
  await expect(graph).toContainText('Melanoma in Situ')
  await expect(graph).toContainText('Patient Not Notified')
  await expect(graph).toContainText('No Treatment Scheduled')
  await expect(graph).toContainText('Urgent Physician Review Task')

  const complete = page.getByRole('button', { name: 'Mark Complete' })
  await expect(complete).toBeEnabled()
  await complete.click()
  await expect(page.getByRole('button', { name: 'Completed' })).toBeDisabled()

  await page.getByRole('link', { name: 'Dashboard' }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
  await expect(page.getByRole('row').filter({ hasText: 'Sarah Miller' })).toContainText('Complete')
})
