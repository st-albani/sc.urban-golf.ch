import { describe, it, expect } from 'vitest'
import de from '@/locales/de.json'
import en from '@/locales/en.json'
import fr from '@/locales/fr.json'
import nl from '@/locales/nl.json'

type Json = Record<string, unknown>

/** Flacht ein verschachteltes Locale-Objekt zu Dot-Pfad-Keys ab. */
function flattenKeys(obj: Json, prefix = ''): string[] {
  const keys: string[] = []
  for (const [k, v] of Object.entries(obj)) {
    const nk = prefix ? `${prefix}.${k}` : k
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      keys.push(...flattenKeys(v as Json, nk))
    } else {
      keys.push(nk)
    }
  }
  return keys
}

/** Keys, die in base aber nicht in other (missing) bzw. umgekehrt (extra) sind. */
function diffKeys(baseKeys: string[], otherKeys: string[]) {
  const base = new Set(baseKeys)
  const other = new Set(otherKeys)
  return {
    missing: baseKeys.filter((k) => !other.has(k)).sort(),
    extra: otherKeys.filter((k) => !base.has(k)).sort(),
  }
}

// de.json ist die Master-Locale; alle anderen müssen exakt dieselben Keys haben.
const MASTER = 'de'
const masterKeys = flattenKeys(de as Json)
const locales: Record<string, Json> = { en, fr, nl }

describe('Locale-Parität', () => {
  for (const [lang, dict] of Object.entries(locales)) {
    it(`${lang}.json hat exakt dieselben Keys wie ${MASTER}.json`, () => {
      const { missing, extra } = diffKeys(masterKeys, flattenKeys(dict))
      expect(missing, `${lang}.json — in ${MASTER}.json vorhanden, hier FEHLEND`).toEqual([])
      expect(extra, `${lang}.json — hier ÜBERZÄHLIG, nicht in ${MASTER}.json`).toEqual([])
    })
  }

  // Selbst-Verifikation: der Vergleich erkennt fehlende UND überzählige Keys.
  it('diffKeys erkennt fehlende und überzählige Keys', () => {
    const base = flattenKeys({ a: '1', b: { c: '2', d: '3' } })
    const other = flattenKeys({ a: '1', b: { c: '2' }, e: '4' })
    const { missing, extra } = diffKeys(base, other)
    expect(missing).toEqual(['b.d']) // in base, other fehlt
    expect(extra).toEqual(['e']) // other hat zusätzlich
  })

  it('flattenKeys behandelt verschachtelte Objekte als Dot-Pfade', () => {
    expect(flattenKeys({ a: '1', b: { c: '2' } })).toEqual(['a', 'b.c'])
  })
})
