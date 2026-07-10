import { describe, it, expect } from 'vitest'
import de from '@/locales/de.json'
import en from '@/locales/en.json'
import fr from '@/locales/fr.json'
import nl from '@/locales/nl.json'

type Json = Record<string, unknown>

/** Flacht ein Locale-Objekt zu einer Map von Dot-Pfad-Key → String-Wert ab. */
function flattenEntries(obj: Json, prefix = '', out: Map<string, string> = new Map()): Map<string, string> {
  for (const [k, v] of Object.entries(obj)) {
    const nk = prefix ? `${prefix}.${k}` : k
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      flattenEntries(v as Json, nk, out)
    } else {
      out.set(nk, String(v))
    }
  }
  return out
}

/** Menge der benannten Interpolations-Platzhalter, z. B. "{n}", "{done}". */
function placeholders(s: string): string[] {
  return [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort()
}

/** Anzahl der Pluralzweige (vue-i18n trennt Pluralformen mit "|"). */
function pluralBranches(s: string): number {
  return s.split('|').length
}

const MASTER = 'de'
const masterEntries = flattenEntries(de as Json)
const locales: Record<string, Json> = { en, fr, nl }

describe('Locale-Platzhalter-/Plural-Konsistenz', () => {
  for (const [lang, dict] of Object.entries(locales)) {
    it(`${lang}.json nutzt dieselben Platzhalter und Pluralstruktur wie ${MASTER}.json`, () => {
      const entries = flattenEntries(dict)
      const mismatches: string[] = []
      for (const [key, masterVal] of masterEntries) {
        const other = entries.get(key)
        if (other === undefined) continue // Key-Parität deckt fehlende Keys ab
        const a = placeholders(masterVal)
        const b = placeholders(other)
        if (a.join(',') !== b.join(',')) {
          mismatches.push(`${key}: ${MASTER}{${a.join(',')}} ≠ ${lang}{${b.join(',')}}`)
        }
        if (pluralBranches(masterVal) !== pluralBranches(other)) {
          mismatches.push(`${key}: Pluralzweige ${MASTER}=${pluralBranches(masterVal)} ${lang}=${pluralBranches(other)}`)
        }
      }
      expect(mismatches, `${lang}.json — Platzhalter/Plural weichen von ${MASTER}.json ab`).toEqual([])
    })
  }

  // Selbst-Verifikation der Prüf-Helfer.
  it('placeholders extrahiert benannte Tokens sortiert und dedupliziert', () => {
    expect(placeholders('Zum nächsten Loch ({n})')).toEqual(['n'])
    expect(placeholders('{done} von {total}')).toEqual(['done', 'total'])
    expect(placeholders('kein Text')).toEqual([])
  })

  it('erkennt abweichende Platzhalter zwischen zwei Werten', () => {
    expect(placeholders('{done}/{total} erfasst').join(',')).not.toBe(
      placeholders('{done} recorded').join(','),
    )
  })

  it('pluralBranches zählt vue-i18n-Pluralzweige', () => {
    expect(pluralBranches('ein Apfel | {n} Äpfel')).toBe(2)
    expect(pluralBranches('nur ein Zweig')).toBe(1)
  })
})
