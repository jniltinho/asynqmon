// Theme tests (from ad-manager): structure and role types of the theme files, color lint of the components, square
// corners, registry ↔ CSS, dark themes complete, the flat look and the WCAG contrast matrix (themes/matrix.json).
import { join } from 'node:path'
import { describe, expect, test } from 'vite-plus/test'
import { SRC, contract, contrastOf, darkRequired, files, lint, read, themeFile, typeErrors } from './themelib.mjs'
import { themes as registry } from '../../src/themes/registry.js'

const style = read(join(SRC, 'style.css'))
const { values, dark } = contract(style)
const known = new Set(values.keys())
const themeFiles = files(join(SRC, 'themes')).filter((f) => f.endsWith('.css'))
const blocks = new Map(themeFiles.flatMap((f) => [...themeFile(read(f), known).blocks]))
// asynqmon's own adjustments (the theme files are ad-manager's, kept identical): merged over each theme's block
const OVERRIDES = join(SRC, 'asynqmon-overrides.css')
const overrides = themeFile(read(OVERRIDES), known)
for (const [id, roles] of overrides.blocks) blocks.set(id, new Map([...(blocks.get(id) || []), ...roles]))
const scheme = (id) => registry.find((t) => t.id === id).scheme
// what the browser applies: the contract, the dark task states (dark themes), then the theme's own roles
const merged = (id) => new Map([...values, ...(scheme(id) === 'dark' ? dark : []), ...(blocks.get(id) || [])])

describe('theme files', () => {
  test('only role declarations under :root[data-theme]', () => {
    for (const f of [...themeFiles, OVERRIDES]) expect(themeFile(read(f), known).errors, f).toEqual([])
  })
  test('every role of every theme has the right type', () => {
    expect(typeErrors(values), 'contract').toEqual([])
    for (const { id } of registry) expect(typeErrors(merged(id)), id).toEqual([])
  })
})

describe('registry', () => {
  test('default first, every theme but the default has a CSS block, every block is registered and imported', () => {
    expect(registry[0]).toEqual({ id: 'default', label: 'Default', scheme: 'light' })
    const ids = registry.map((t) => t.id)
    for (const t of ids.slice(1)) expect(blocks.has(t), `no CSS for theme ${t}`).toBe(true)
    for (const b of blocks.keys()) expect(ids, `theme ${b} not in the registry`).toContain(b)
    for (const f of themeFiles) expect(style).toContain(`@import './themes/${f.split('/').pop()}'`)
    expect(style).toContain(`@import './asynqmon-overrides.css'`)
    for (const id of overrides.blocks.keys()) expect(ids, `override of an unknown theme ${id}`).toContain(id)
  })
  test('dark themes redefine every color, background and shadow (no light default leaks)', () => {
    const required = darkRequired(known).filter((r) => !dark.has(r))
    for (const t of registry.filter((x) => x.scheme === 'dark'))
      expect(
        required.filter((r) => !blocks.get(t.id)?.has(r)),
        t.id,
      ).toEqual([])
  })
  test('the dark task states cover every state role', () => {
    const states = [...known].filter((r) => r.startsWith('--color-state-'))
    expect(states.length).toBe(7)
    expect([...dark.keys()].sort()).toEqual(states.sort())
  })
})

describe('color lint', () => {
  test('components and style.css use roles only', () => {
    // the overrides file is a theme file (checked by themeFile and typeErrors above), not a component
    const found = files()
      .filter((f) => f !== OVERRIDES)
      .flatMap((f) => lint(f))
    expect(found.map((f) => `${f.file}:${f.line} ${f.reason}: ${f.value}`)).toEqual([])
  })
})

describe('flat look', () => {
  test('turns off every gradient over any theme', () => {
    const rule = contract().root.nodes.find((n) => n.selector === ":root[data-flat='true'][data-theme]")
    const set = new Map(rule.nodes.filter((d) => d.type === 'decl').map((d) => [d.prop, d.value]))
    const keep = ['--bg-select-arrow', '--bg-action-hover', '--bg-page']
    for (const r of known) if (r.startsWith('--bg-') && !keep.includes(r)) expect(set.get(r), r).toBe('none')
  })
})

describe('square corners', () => {
  test('the global rule stays in style.css', () => {
    expect(style).toMatch(/\*,\s*\*::before,\s*\*::after\s*\{\s*border-radius:\s*0 !important;\s*\}/)
  })
})

describe('contrast', () => {
  const base = JSON.parse(read(join(SRC, 'themes/matrix.json')))
  const own = JSON.parse(read(join(SRC, 'themes/asynq-recipes.json')))
  const matrix = { ...base, recipes: [...base.recipes, ...own.recipes] }
  for (const { id } of registry) {
    test(`theme ${id}: every recipe passes (AA; AAA for the themes in matrix.aaa)`, () => {
      const aaa = (matrix.aaa || []).includes(id)
      const min = (r) => (r.size === 'normal' ? (aaa ? 7 : 4.5) : r.size === 'large' ? (aaa ? 4.5 : 3) : 3)
      const zero = (k) => ['0', '0px'].includes((merged(id).get(k) || '').trim())
      const segmented = zero('--subtabs-gap') && zero('--subtab-inset-top')
      const failing = matrix.recipes
        .filter((r) => aaa || !r.aaaOnly)
        .filter((r) => segmented || !r.segmentedOnly)
        .map((r) => [r.id, contrastOf(merged(id), r.fg, r.bg), min(r)])
        .filter(([, got, want]) => got < want)
        .map(([r, got, want]) => `${r} ${got.toFixed(2)} < ${want}`)
      expect(failing).toEqual([...(matrix.pending[id] || [])])
    })
  }
  test('every recipe uses known roles', () => {
    for (const r of matrix.recipes) for (const n of [r.fg, ...r.bg]) expect(known.has(`--color-${n}`), `${r.id}: ${n}`).toBe(true)
  })
})
