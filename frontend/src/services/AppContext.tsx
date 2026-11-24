import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api, type Bookmark, type Settings } from './api'

export const DEFAULT_SETTINGS: Settings = {
  exam_dates: { 'az-104': null },
  sprint_start: null,
  weekday_hours: 1.75,
  weekend_hours: 2,
  mode: 'sprint',
  depth: 'engineer',
  theme: 'system',
  reduced_motion: false,
}

interface AppState {
  online: boolean | null
  settings: Settings
  saveSettings: (s: Settings) => Promise<void>
  bookmarks: Bookmark[]
  toggleBookmark: (b: Omit<Bookmark, 'id' | 'created_at'>) => Promise<void>
  isBookmarked: (kind: string, ref: string) => boolean
  /** Bumped whenever progress changes so pages refetch. */
  progressVersion: number
  progressChanged: () => void
  error: string | null
  setError: (e: string | null) => void
}

const Ctx = createContext<AppState | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [online, setOnline] = useState<boolean | null>(null)
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([])
  const [progressVersion, setPV] = useState(0)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.health()
      .then(async () => {
        setOnline(true)
        const [s, b] = await Promise.all([api.settings(), api.bookmarks()])
        setSettings({ ...DEFAULT_SETTINGS, ...s })
        setBookmarks(b)
      })
      .catch(() => setOnline(false))
  }, [])

  useEffect(() => {
    const dark = settings.theme === 'dark' || (settings.theme === 'system' && window.matchMedia?.('(prefers-color-scheme: dark)').matches)
    document.documentElement.classList.toggle('dark', !!dark)
  }, [settings.theme])

  const saveSettings = useCallback(async (s: Settings) => {
    setSettings(s)
    try {
      await api.saveSettings(s)
    } catch (e) {
      setError((e as Error).message)
    }
  }, [])

  const isBookmarked = useCallback((kind: string, ref: string) => bookmarks.some((b) => b.kind === kind && b.ref === ref), [bookmarks])

  const toggleBookmark = useCallback(async (b: Omit<Bookmark, 'id' | 'created_at'>) => {
    try {
      if (bookmarks.some((x) => x.kind === b.kind && x.ref === b.ref)) {
        await api.removeBookmark(b.kind, b.ref)
        setBookmarks((bs) => bs.filter((x) => !(x.kind === b.kind && x.ref === b.ref)))
      } else {
        const saved = await api.addBookmark(b)
        setBookmarks((bs) => [saved, ...bs])
      }
    } catch (e) {
      setError((e as Error).message)
    }
  }, [bookmarks])

  const value = useMemo<AppState>(() => ({
    online, settings, saveSettings, bookmarks, toggleBookmark, isBookmarked, progressVersion,
    progressChanged: () => setPV((v) => v + 1), error, setError,
  }), [online, settings, saveSettings, bookmarks, toggleBookmark, isBookmarked, progressVersion, error])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useApp(): AppState {
  const v = useContext(Ctx)
  if (!v) throw new Error('useApp outside AppProvider')
  return v
}
