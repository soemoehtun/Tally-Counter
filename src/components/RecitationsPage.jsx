import { useEffect, useRef, useState } from 'react'
import { ArrowDownAZ, ArrowLeft, Check, ChevronDown, Clock3, FileText, LayoutGrid, List, ListFilter, MessageSquareText, MoreHorizontal, Pencil, Plus, Search, Send, Share2, SlidersHorizontal, Trash2, X } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { translate } from '../utils/language'

function getNoteDate(note) {
  const timestamp = Date.parse(note.updatedAt || note.createdAt || '')
  return Number.isNaN(timestamp) ? null : new Date(timestamp)
}

function formatCreatedDate(timestamp, language) {
  if (!timestamp) return '—'
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString(language === 'my' ? 'my-MM' : 'en-US', {
    month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  })
}

export default function RecitationsPage({ userId, language = 'en' }) {
  const storageKey = `adhithan-recitations:${userId}`
  const syncedKey = `adhithan-recitations-synced:${userId}`
  const [recitations, setRecitations] = useState([])
  const [storageError, setStorageError] = useState('')
  const [selectedNoteId, setSelectedNoteId] = useState(null)
  const [title, setTitle] = useState('')
  const [text, setText] = useState('')
  const [draftCreatedAt, setDraftCreatedAt] = useState('')
  const [category, setCategory] = useState('')
  const [comments, setComments] = useState([])
  const [commentDraft, setCommentDraft] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [search, setSearch] = useState('')
  const [editorMenuOpen, setEditorMenuOpen] = useState(false)
  const [showDesktopSearch, setShowDesktopSearch] = useState(false)
  const [showRecentOnly, setShowRecentOnly] = useState(false)
  const [sortMode, setSortMode] = useState('newest')
  const [displayMode, setDisplayMode] = useState('list')
  const [compactRows, setCompactRows] = useState(false)
  const [showCommentCounts, setShowCommentCounts] = useState(true)
  const [filterMenuOpen, setFilterMenuOpen] = useState(false)
  const [sortMenuOpen, setSortMenuOpen] = useState(false)
  const [viewMenuOpen, setViewMenuOpen] = useState(false)
  const [propertyMenuOpen, setPropertyMenuOpen] = useState(false)
  const [newMenuOpen, setNewMenuOpen] = useState(false)
  const titleInputRef = useRef(null)

  useEffect(() => {
    let active = true
    const load = async () => {
      let cached = []
      try {
        const parsed = JSON.parse(localStorage.getItem(storageKey) || '[]')
        cached = Array.isArray(parsed) ? parsed : []
      } catch {
        cached = []
      }

      const { data, error } = await supabase.from('recitation_notes').select('*').eq('user_id', userId).order('updated_at', { ascending: false })
      if (!active) return
      if (error) {
        setRecitations(cached)
        setStorageError(`${translate('Could not load notes from Supabase.', language)} ${error.message}`)
        return
      }

      const remoteNotes = (data || []).map(note => ({
        id: note.id,
        title: note.title,
        text: note.body,
        category: note.category || '',
        comments: Array.isArray(note.comments) ? note.comments : [],
        createdAt: note.created_at,
        updatedAt: note.updated_at,
      }))
      const remoteIds = new Set(remoteNotes.map(note => note.id))
      const legacyNotes = localStorage.getItem(syncedKey) === 'true' ? [] : cached.filter(note => !remoteIds.has(note.id))
      let migratedNotes = []
      let migrationFailed = false

      if (legacyNotes.length) {
        const { error: migrationError } = await supabase.from('recitation_notes').upsert(legacyNotes.map(note => ({
          id: note.id,
          user_id: userId,
          title: note.title,
          body: note.text,
          category: note.category || null,
          comments: Array.isArray(note.comments) ? note.comments : [],
          created_at: note.createdAt || new Date().toISOString(),
          updated_at: note.updatedAt || note.createdAt || new Date().toISOString(),
        })), { onConflict: 'id' })
        if (migrationError) {
          migrationFailed = true
          setStorageError(`${translate('Could not move existing notes to Supabase.', language)} ${migrationError.message}`)
        }
        migratedNotes = legacyNotes
      }

      const notesById = new Map([...remoteNotes, ...migratedNotes].map(note => [note.id, note]))
      const allNotes = [...notesById.values()].sort((a, b) => Date.parse(b.updatedAt || b.createdAt) - Date.parse(a.updatedAt || a.createdAt))
      setRecitations(allNotes)
      try {
        localStorage.setItem(storageKey, JSON.stringify(allNotes))
        if (!migrationFailed) localStorage.setItem(syncedKey, 'true')
      } catch {
        // Supabase remains the source of truth if local caching is unavailable.
      }
      if (!migrationFailed) setStorageError('')
    }
    load()
    return () => { active = false }
  }, [storageKey, syncedKey, userId, language])

  const save = async next => {
    setRecitations(next)
    try { localStorage.setItem(storageKey, JSON.stringify(next)) } catch { /* cache is optional */ }

    const rows = next.map(note => ({
      id: note.id,
      user_id: userId,
      title: note.title,
      body: note.text,
      category: note.category || null,
      comments: Array.isArray(note.comments) ? note.comments : [],
      created_at: note.createdAt || new Date().toISOString(),
      updated_at: note.updatedAt || note.createdAt || new Date().toISOString(),
    }))
    if (rows.length) {
      const { error } = await supabase.from('recitation_notes').upsert(rows, { onConflict: 'id' })
      if (error) {
        setStorageError(`${translate('Could not save notes to Supabase.', language)} ${error.message}`)
        return
      }
    }
    const remainingIds = new Set(next.map(note => note.id))
    const removedIds = recitations.filter(note => !remainingIds.has(note.id)).map(note => note.id)
    if (removedIds.length) {
      const { error } = await supabase.from('recitation_notes').delete().eq('user_id', userId).in('id', removedIds)
      if (error) {
        setStorageError(`${translate('Could not delete notes from Supabase.', language)} ${error.message}`)
        return
      }
    }
    try { localStorage.setItem(syncedKey, 'true') } catch { /* cache is optional */ }
    setStorageError('')
  }

  const startNewNote = () => {
    setSelectedNoteId(null)
    setEditingId(null)
    setTitle('')
    setText('')
    setDraftCreatedAt(new Date().toISOString())
    setCategory('')
    setComments([])
    setCommentDraft('')
    setPropertyMenuOpen(false)
    setSearch('')
    setEditorMenuOpen(false)
    setFilterMenuOpen(false)
    setSortMenuOpen(false)
    setViewMenuOpen(false)
    setNewMenuOpen(false)
    setShowAddForm(true)
    window.setTimeout(() => titleInputRef.current?.focus(), 0)
  }

  const addRecitation = event => {
    event.preventDefault()
    const noteTitle = title.trim()
    const noteText = text.trim()
    if (!noteTitle || !noteText) return

    const id = crypto.randomUUID()
    const timestamp = draftCreatedAt || new Date().toISOString()
    save([{ id, title: noteTitle, text: noteText, createdAt: timestamp, updatedAt: timestamp, category, comments }, ...recitations])
    setShowAddForm(false)
    setSelectedNoteId(id)
    setTitle('')
    setText('')
    setDraftCreatedAt('')
    setCategory('')
    setComments([])
    setPropertyMenuOpen(false)
    setNewMenuOpen(false)
  }

  const startEditing = note => {
    setSelectedNoteId(note.id)
    setEditingId(note.id)
    setTitle(note.title)
    setText(note.text)
    setDraftCreatedAt(note.createdAt || '')
    setCategory(note.category || '')
    setComments(Array.isArray(note.comments) ? note.comments : [])
    setCommentDraft('')
    setPropertyMenuOpen(false)
    setEditorMenuOpen(false)
    window.setTimeout(() => titleInputRef.current?.focus(), 0)
  }

  const closeEditor = () => {
    setShowAddForm(false)
    setEditingId(null)
    setTitle('')
    setText('')
    setDraftCreatedAt('')
    setCategory('')
    setComments([])
    setPropertyMenuOpen(false)
    setCommentDraft('')
    setEditorMenuOpen(false)
  }

  const discardDraft = () => {
    if (window.confirm(translate('Discard this draft?', language))) closeEditor()
    setEditorMenuOpen(false)
  }

  const saveEdit = event => {
    event.preventDefault()
    const noteTitle = title.trim()
    const noteText = text.trim()
    if (!noteTitle || !noteText) return

    save(recitations.map(note => note.id === editingId
      ? { ...note, title: noteTitle, text: noteText, category, comments, updatedAt: new Date().toISOString() }
      : note))
    setEditingId(null)
    setTitle('')
    setText('')
    setDraftCreatedAt('')
    setCategory('')
    setComments([])
    setPropertyMenuOpen(false)
  }

  const deleteNote = note => {
    if (!window.confirm(`${translate('Delete', language)} "${note.title}"?`)) return
    save(recitations.filter(item => item.id !== note.id))
    setSelectedNoteId(null)
    setEditingId(null)
    setShowAddForm(false)
    setTitle('')
    setText('')
    setDraftCreatedAt('')
    setCategory('')
    setComments([])
  }

  const selectedNote = recitations.find(note => note.id === selectedNoteId)
  const editorNote = editingId ? recitations.find(note => note.id === editingId) : null
  const editorCreatedAt = editorNote?.createdAt || draftCreatedAt
  const isEditing = showAddForm || Boolean(editingId)
  const currentComments = isEditing ? comments : (selectedNote?.comments || [])
  const currentCategory = isEditing ? category : (selectedNote?.category || '')

  const addComment = () => {
    const commentText = commentDraft.trim()
    if (!commentText) return
    const nextComments = [...currentComments, { id: crypto.randomUUID(), text: commentText, createdAt: new Date().toISOString() }]
    setComments(nextComments)
    setCommentDraft('')
    if (selectedNote && !isEditing) {
      save(recitations.map(note => note.id === selectedNote.id ? { ...note, comments: nextComments } : note))
    }
  }

  const updateCategory = value => {
    setCategory(value)
    if (selectedNote && !isEditing) {
      save(recitations.map(note => note.id === selectedNote.id ? { ...note, category: value } : note))
    }
  }

  const shareNote = async () => {
    const noteContent = [title.trim(), text.trim()].filter(Boolean).join('\n\n')
    if (!noteContent) return
    try {
      if (navigator.share) {
        await navigator.share({ title: title.trim() || translate('Daily Recitations', language), text: noteContent })
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(noteContent)
      }
    } catch {
      // Sharing can be dismissed by the user.
    }
  }

  const runEditorMenuAction = () => {
    if (editingId) {
      const note = recitations.find(item => item.id === editingId)
      if (note) deleteNote(note)
    } else if (window.confirm(translate('Discard this draft?', language))) {
      closeEditor()
    }
    setEditorMenuOpen(false)
  }

  const filteredNotes = recitations
    .filter(note => `${note.title} ${note.text}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()))
    .filter(note => {
      if (!showRecentOnly) return true
      const date = getNoteDate(note)
      const cutoff = new Date()
      cutoff.setDate(cutoff.getDate() - 30)
      return date && date >= cutoff
    })
    .sort((first, second) => {
      if (sortMode === 'az') return first.title.localeCompare(second.title)
      if (sortMode === 'za') return second.title.localeCompare(first.title)
      const dateDifference = (getNoteDate(second)?.getTime() || 0) - (getNoteDate(first)?.getTime() || 0)
      return sortMode === 'oldest' ? -dateDifference : dateDifference
    })
  return (
    <div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-3 py-1 text-zinc-900 dark:text-zinc-100">
      {storageError && <p role="alert" className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">{storageError}</p>}
      {isEditing ? (
        <section className="w-full">
          <header className="mb-4 flex items-center justify-between gap-3">
            <button type="button" onClick={closeEditor} aria-label={translate('Back', language)} title={translate('Back', language)} className="-ml-1 inline-flex h-9 shrink-0 items-center gap-1.5 rounded border border-transparent pl-0 pr-2 text-sm text-zinc-600 transition hover:border-zinc-200 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:border-zinc-700 dark:hover:bg-white/10 dark:hover:text-white"><ArrowLeft size={18} /><span className="relative top-px">{translate('Back', language)}</span></button>
            <div className="relative ml-auto flex items-center gap-1">
              <button type="button" onClick={shareNote} disabled={!title.trim() && !text.trim()} aria-label={translate('Share note', language)} title={translate('Share note', language)} className="grid h-9 w-9 place-items-center rounded text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-40 dark:hover:bg-white/10 dark:hover:text-white"><Share2 size={17} /></button>
              <button type="button" onClick={() => setEditorMenuOpen(open => !open)} aria-label={translate('More options', language)} title={translate('More options', language)} aria-expanded={editorMenuOpen} className="grid h-9 w-9 place-items-center rounded text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-white/10 dark:hover:text-white"><MoreHorizontal size={19} /></button>
              {editorMenuOpen && <div className="absolute right-10 top-10 z-30 min-w-40 overflow-hidden rounded border border-zinc-200 bg-white p-1 text-sm shadow-lg dark:border-zinc-700 dark:bg-[#222224]">{editingId ? <button type="button" onClick={runEditorMenuAction} className="w-full rounded px-3 py-2 text-left text-rose-600 hover:bg-zinc-100 dark:text-rose-400 dark:hover:bg-zinc-800">{translate('Delete note', language)}</button> : <button type="button" onClick={discardDraft} className="w-full rounded px-3 py-2 text-left text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800">{translate('Discard draft', language)}</button>}</div>}
              <button type="submit" form="recitation-note-form" disabled={!title.trim() || !text.trim()} aria-label={translate('Done', language)} title={translate('Done', language)} className="ml-1 inline-flex h-9 items-center gap-1.5 rounded bg-[#55785c] px-3 text-sm font-medium text-white transition hover:bg-[#486b50] disabled:opacity-40"><Check size={16} /><span className="hidden sm:inline">{translate('Done', language)}</span></button>
            </div>
          </header>
          <form id="recitation-note-form" onSubmit={editingId ? saveEdit : addRecitation}>
            <input ref={titleInputRef} autoFocus aria-label={translate('Note title', language)} className="mb-5 w-full border-0 bg-transparent p-0 text-[2rem] font-bold leading-tight tracking-tight text-zinc-900 outline-none placeholder:text-zinc-400 focus:ring-0 dark:text-zinc-100 dark:placeholder:text-zinc-600 sm:text-4xl" placeholder={translate(editingId ? 'Title' : 'New page', language)} value={title} onChange={event => setTitle(event.target.value)} maxLength={100} required />
            <DesktopPageMeta createdAt={editorCreatedAt} category={currentCategory} comments={currentComments} commentDraft={commentDraft} onCommentDraftChange={setCommentDraft} onAddComment={addComment} propertyMenuOpen={propertyMenuOpen} onTogglePropertyMenu={() => setPropertyMenuOpen(open => !open)} onCategoryChange={value => { updateCategory(value); setPropertyMenuOpen(false) }} language={language} />
            {!text.trim() && <p className="mt-6 text-sm text-zinc-500 dark:text-zinc-400">{translate("Press 'enter' to continue with an empty page, or create a template", language)}</p>}
            <textarea aria-label={translate('Note text', language)} className="mt-3 min-h-[35vh] w-full resize-y border-0 bg-transparent p-0 text-base leading-7 text-zinc-800 outline-none placeholder:text-transparent focus:ring-0 dark:text-zinc-200 md:min-h-[44vh]" placeholder={translate('Write your note…', language)} value={text} onChange={event => setText(event.target.value)} maxLength={12000} required />
          </form>
        </section>
      ) : selectedNote ? (
        <section className="w-full">
          <header className="mb-5 flex items-center justify-between gap-3">
            <button type="button" onClick={() => { setSelectedNoteId(null); setCommentDraft('') }} aria-label={translate('Back', language)} title={translate('Back', language)} className="-ml-1 inline-flex h-9 shrink-0 items-center gap-1.5 rounded border border-transparent pl-0 pr-2 text-sm text-zinc-600 transition hover:border-zinc-200 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:border-zinc-700 dark:hover:bg-white/10 dark:hover:text-white"><ArrowLeft size={18} /><span className="relative top-px">{translate('Back', language)}</span></button>
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => startEditing(selectedNote)} aria-label={`${translate('Edit', language)} ${selectedNote.title}`} title={translate('Edit', language)} className="grid h-9 w-9 place-items-center rounded text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-white/10 dark:hover:text-white"><Pencil size={16} /></button>
              <button type="button" onClick={() => deleteNote(selectedNote)} aria-label={`${translate('Delete', language)} ${selectedNote.title}`} title={translate('Delete', language)} className="grid h-9 w-9 place-items-center rounded text-zinc-500 transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-white/10 dark:hover:text-rose-400"><Trash2 size={16} /></button>
            </div>
          </header>
          <article>
            <h1 className="mb-5 break-words text-[2rem] font-bold leading-tight tracking-tight text-zinc-900 dark:text-zinc-100 sm:text-4xl">{selectedNote.title}</h1>
            <DesktopPageMeta createdAt={selectedNote.createdAt} category={currentCategory} comments={currentComments} commentDraft={commentDraft} onCommentDraftChange={setCommentDraft} onAddComment={addComment} propertyMenuOpen={propertyMenuOpen} onTogglePropertyMenu={() => setPropertyMenuOpen(open => !open)} onCategoryChange={value => { updateCategory(value); setPropertyMenuOpen(false) }} language={language} />
            <p className="mt-6 min-h-[35vh] whitespace-pre-wrap text-base leading-7 text-zinc-800 dark:text-zinc-200">{selectedNote.text}</p>
          </article>
        </section>
      ) : (
        <section className="w-full">
          <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b border-zinc-300 pb-3 dark:border-zinc-700 sm:flex-nowrap">
            <div className="min-w-0">
              <h1 className="truncate text-lg font-semibold text-zinc-900 dark:text-zinc-100">{translate('Daily Recitations', language)}</h1>
              <p className="mt-1.5 hidden text-sm text-zinc-500 dark:text-zinc-400 sm:block">{translate('Your saved prayers and recitations', language)}</p>
            </div>
            <div className="flex min-w-0 items-center gap-1 sm:ml-auto">
              <div className="relative">
                <button type="button" onClick={() => { setFilterMenuOpen(value => !value); setSortMenuOpen(false); setViewMenuOpen(false) }} aria-label={translate('Filter recent notes', language)} aria-expanded={filterMenuOpen} aria-pressed={showRecentOnly} title={translate('Filter recent notes', language)} className={`grid h-8 w-8 shrink-0 place-items-center rounded transition ${filterMenuOpen || showRecentOnly ? 'bg-zinc-200 text-zinc-900 dark:bg-zinc-700 dark:text-white' : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-white/10'}`}><ListFilter size={15} /></button>
                {filterMenuOpen && <div role="menu" className="absolute left-0 top-9 z-40 w-48 rounded border border-zinc-200 bg-white p-1.5 shadow-lg dark:border-zinc-700 dark:bg-[#222224]">
                  <p className="px-2 py-1.5 text-xs font-medium text-zinc-500 dark:text-zinc-400">{translate('Filter notes', language)}</p>
                  {[{ label: 'All notes', value: false }, { label: 'Last 30 days', value: true }].map(option => <button key={option.label} type="button" role="menuitemradio" aria-checked={showRecentOnly === option.value} onClick={() => { setShowRecentOnly(option.value); setFilterMenuOpen(false) }} className="flex w-full items-center justify-between rounded px-2 py-2 text-left text-sm text-zinc-800 hover:bg-zinc-100 dark:text-zinc-100 dark:hover:bg-zinc-800"><span>{translate(option.label, language)}</span>{showRecentOnly === option.value && <Check size={14} className="text-emerald-600 dark:text-emerald-400" />}</button>)}
                </div>}
              </div>
              <div className="relative">
                <button type="button" onClick={() => { setSortMenuOpen(value => !value); setFilterMenuOpen(false); setViewMenuOpen(false) }} aria-label={translate('Sort notes', language)} aria-expanded={sortMenuOpen} aria-pressed={sortMode !== 'newest'} title={translate('Sort notes', language)} className={`grid h-8 w-8 shrink-0 place-items-center rounded transition ${sortMenuOpen || sortMode !== 'newest' ? 'bg-zinc-200 text-zinc-900 dark:bg-zinc-700 dark:text-white' : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-white/10'}`}><ArrowDownAZ size={15} /></button>
                {sortMenuOpen && <div role="menu" className="absolute left-0 top-9 z-40 w-48 rounded border border-zinc-200 bg-white p-1.5 shadow-lg dark:border-zinc-700 dark:bg-[#222224]">
                  <p className="px-2 py-1.5 text-xs font-medium text-zinc-500 dark:text-zinc-400">{translate('Sort notes', language)}</p>
                  {[{ label: 'Newest first', value: 'newest' }, { label: 'Oldest first', value: 'oldest' }, { label: 'A–Z', value: 'az' }, { label: 'Z–A', value: 'za' }].map(option => <button key={option.value} type="button" role="menuitemradio" aria-checked={sortMode === option.value} onClick={() => { setSortMode(option.value); setSortMenuOpen(false) }} className="flex w-full items-center justify-between rounded px-2 py-2 text-left text-sm text-zinc-800 hover:bg-zinc-100 dark:text-zinc-100 dark:hover:bg-zinc-800"><span>{translate(option.label, language)}</span>{sortMode === option.value && <Check size={14} className="text-emerald-600 dark:text-emerald-400" />}</button>)}
                </div>}
              </div>
              <button type="button" onClick={() => { if (showDesktopSearch) setSearch(''); setShowDesktopSearch(!showDesktopSearch) }} aria-label={translate('Search', language)} aria-expanded={showDesktopSearch} aria-pressed={showDesktopSearch} title={translate('Search', language)} className={`grid h-8 w-8 shrink-0 place-items-center rounded transition ${showDesktopSearch ? 'bg-zinc-200 text-zinc-900 dark:bg-zinc-700 dark:text-white' : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-white/10'}`}><Search size={15} /></button>
              <div className="relative">
                <button type="button" onClick={() => { setViewMenuOpen(value => !value); setFilterMenuOpen(false); setSortMenuOpen(false) }} aria-label={translate('View options', language)} aria-expanded={viewMenuOpen} aria-pressed={displayMode === 'cards' || compactRows || !showCommentCounts} title={translate('View options', language)} className={`grid h-8 w-8 shrink-0 place-items-center rounded transition ${viewMenuOpen || displayMode === 'cards' || compactRows || !showCommentCounts ? 'bg-zinc-200 text-zinc-900 dark:bg-zinc-700 dark:text-white' : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-white/10'}`}><SlidersHorizontal size={15} /></button>
                {viewMenuOpen && <div role="menu" className="absolute left-0 right-auto top-9 z-40 w-52 rounded border border-zinc-200 bg-white p-1.5 shadow-lg dark:border-zinc-700 dark:bg-[#222224] sm:left-auto sm:right-0">
                  <p className="px-2 py-1.5 text-xs font-medium text-zinc-500 dark:text-zinc-400">{translate('View options', language)}</p>
                  <p className="px-2 pb-1 pt-2 text-[11px] font-medium uppercase tracking-wide text-zinc-400">{translate('Layout', language)}</p>
                  <div className="flex flex-col gap-0.5 px-1 pb-2">
                    <button type="button" role="menuitemradio" aria-checked={displayMode === 'list'} onClick={() => { setDisplayMode('list'); setViewMenuOpen(false) }} className={`flex w-full items-center gap-2 rounded px-2.5 py-2 text-left text-sm transition ${displayMode === 'list' ? 'bg-zinc-100 text-zinc-900 dark:bg-zinc-700 dark:text-white' : 'text-zinc-600 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800'}`}><List size={16} /><span>{translate('List', language)}</span>{displayMode === 'list' && <Check size={14} className="ml-auto text-emerald-600 dark:text-emerald-400" />}</button>
                    <button type="button" role="menuitemradio" aria-checked={displayMode === 'cards'} onClick={() => { setDisplayMode('cards'); setViewMenuOpen(false) }} className={`flex w-full items-center gap-2 rounded px-2.5 py-2 text-left text-sm transition ${displayMode === 'cards' ? 'bg-zinc-100 text-zinc-900 dark:bg-zinc-700 dark:text-white' : 'text-zinc-600 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800'}`}><LayoutGrid size={16} /><span>{translate('Cards', language)}</span>{displayMode === 'cards' && <Check size={14} className="ml-auto text-emerald-600 dark:text-emerald-400" />}</button>
                  </div>
                  {displayMode === 'list' && <button type="button" role="menuitemcheckbox" aria-checked={compactRows} onClick={() => setCompactRows(value => !value)} className="flex w-full items-center justify-between rounded px-2 py-2 text-left text-sm text-zinc-800 hover:bg-zinc-100 dark:text-zinc-100 dark:hover:bg-zinc-800"><span>{translate('Compact rows', language)}</span>{compactRows && <Check size={14} className="text-emerald-600 dark:text-emerald-400" />}</button>}
                  <button type="button" role="menuitemcheckbox" aria-checked={showCommentCounts} onClick={() => setShowCommentCounts(value => !value)} className="flex w-full items-center justify-between rounded px-2 py-2 text-left text-sm text-zinc-800 hover:bg-zinc-100 dark:text-zinc-100 dark:hover:bg-zinc-800"><span>{translate('Show comment counts', language)}</span>{showCommentCounts && <Check size={14} className="text-emerald-600 dark:text-emerald-400" />}</button>
                </div>}
              </div>
              <div className="relative ml-1 flex h-8 shrink-0">
                <button type="button" onClick={startNewNote} className="inline-flex h-full items-center justify-center gap-1.5 rounded-l bg-[#55785c] px-2.5 text-sm font-medium leading-none text-white transition hover:bg-[#486b50]"><Plus size={15} className="shrink-0" /><span className="relative top-px inline-flex h-full items-center leading-none">{translate('New', language)}</span></button>
                <button type="button" onClick={() => setNewMenuOpen(open => !open)} aria-label={translate('New page options', language)} aria-expanded={newMenuOpen} className="grid h-full w-7 shrink-0 place-items-center rounded-r border-l border-white/20 bg-[#55785c] text-white transition hover:bg-[#486b50]"><ChevronDown size={14} /></button>
                {newMenuOpen && <div className="absolute right-0 top-9 z-30 w-44 rounded border border-zinc-200 bg-white p-1 shadow-lg dark:border-zinc-700 dark:bg-[#222224]"><button type="button" onClick={startNewNote} className="w-full rounded px-3 py-2 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800">{translate('New page', language)}</button></div>}
              </div>
            </div>
          </header>
          {showDesktopSearch && <label className="mt-3 flex h-9 w-full max-w-sm items-center gap-2 rounded border border-zinc-200 px-2 dark:border-zinc-700"><Search size={14} className="shrink-0 text-zinc-500" /><input autoFocus aria-label={translate('Search', language)} value={search} onChange={event => setSearch(event.target.value)} placeholder={translate('Search', language)} className="w-full min-w-0 border-0 bg-transparent p-0 text-sm outline-none focus:ring-0" />{search && <button type="button" onClick={() => setSearch('')} aria-label={translate('Clear search', language)}><X size={14} /></button>}</label>}
          <div className="mt-2 w-full">
            {filteredNotes.length === 0 && (search.trim() || showRecentOnly) ? (
              <p className="px-2.5 py-4 text-sm text-zinc-500">{translate('No matching notes', language)}</p>
            ) : displayMode === 'cards' ? (
              <div className="grid grid-cols-1 gap-3 px-1 py-2 sm:grid-cols-2 xl:grid-cols-3">
                {filteredNotes.map(note => (
                  <button key={note.id} type="button" onClick={() => { setSelectedNoteId(note.id); setCommentDraft(''); setFilterMenuOpen(false); setSortMenuOpen(false); setViewMenuOpen(false) }} className="flex min-h-44 flex-col rounded-md border border-zinc-300 bg-[#fafaf9] p-4 text-left shadow-sm transition hover:border-zinc-400 hover:bg-[#f4f4f2] dark:border-zinc-600 dark:bg-[#222222] dark:shadow-black/20 dark:hover:border-zinc-500 dark:hover:bg-[#292929]">
                    <span className="flex min-w-0 items-center gap-2 text-sm font-medium text-zinc-800 dark:text-zinc-100"><FileText size={16} className="shrink-0 text-zinc-500" /><span className="truncate">{note.title}</span></span>
                    <p className="mt-3 line-clamp-5 whitespace-pre-wrap text-sm leading-5 text-zinc-600 dark:text-zinc-300">{note.text}</p>
                    {(note.category || (showCommentCounts && (note.comments?.length || 0) > 0)) && <span className="mt-auto flex items-center justify-between gap-3 pt-4 text-xs text-zinc-500 dark:text-zinc-400">{note.category ? <span className="truncate">{translate(note.category, language)}</span> : <span />}{showCommentCounts && (note.comments?.length || 0) > 0 && <span className="flex shrink-0 items-center gap-1"><MessageSquareText size={13} />{note.comments.length}</span>}</span>}
                  </button>
                ))}
                <button type="button" onClick={startNewNote} className="flex min-h-44 items-center justify-center gap-2 rounded-md border border-dashed border-zinc-400 bg-white/50 text-sm text-zinc-500 transition hover:border-zinc-500 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-[#1d1d1d] dark:hover:border-zinc-500 dark:hover:bg-[#222222]"><Plus size={16} />{translate('New page', language)}</button>
              </div>
            ) : (
              <>
                {filteredNotes.map(note => (
                  <button key={note.id} type="button" onClick={() => { setSelectedNoteId(note.id); setCommentDraft(''); setFilterMenuOpen(false); setSortMenuOpen(false); setViewMenuOpen(false) }} className={`group flex w-full items-center gap-3 rounded border-b border-zinc-100 px-2.5 text-left text-sm text-zinc-800 transition hover:bg-zinc-100 dark:border-zinc-800/70 dark:text-zinc-200 dark:hover:bg-white/5 ${compactRows ? 'py-1.5' : 'py-2.5'}`}>
                    <FileText size={16} className="shrink-0 text-zinc-500" />
                    <span className="min-w-0 flex-1 truncate font-medium">{note.title}</span>
                    {showCommentCounts && (note.comments?.length || 0) > 0 && <span className="flex items-center gap-1 text-xs text-zinc-500"><MessageSquareText size={13} />{note.comments.length}</span>}
                  </button>
                ))}
                <button type="button" onClick={startNewNote} className="flex w-full items-center gap-3 rounded px-2.5 py-2.5 text-sm text-zinc-500 transition hover:bg-zinc-100 dark:hover:bg-white/5"><Plus size={16} />{translate('New page', language)}</button>
              </>
            )}
          </div>
        </section>
      )}
    </div>
  )
}

function DesktopPageMeta({ createdAt, category, comments, commentDraft, onCommentDraftChange, onAddComment, propertyMenuOpen, onTogglePropertyMenu, onCategoryChange, language }) {
  return (
    <>
      <div className="grid w-full grid-cols-[7.5rem_minmax(0,1fr)] items-center gap-y-3 text-sm sm:grid-cols-[10rem_minmax(0,1fr)]">
        <span className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400"><Clock3 size={15} />{translate('Created', language)}</span>
        <span className="text-zinc-800 dark:text-zinc-200">{formatCreatedDate(createdAt, language)}</span>
        {category && <><span className="text-zinc-500 dark:text-zinc-400">{translate('Type', language)}</span><span className="text-zinc-800 dark:text-zinc-200">{translate(category, language)}</span></>}
      </div>
      <div className="relative mt-3">
        <button type="button" onClick={onTogglePropertyMenu} aria-expanded={propertyMenuOpen} className="inline-flex items-center gap-2 rounded px-1.5 py-1 text-sm text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800">
          {!category && <Plus size={14} />}{category ? translate('Edit property', language) : translate('Add a property', language)}
        </button>
        {propertyMenuOpen && (
          <div className="absolute left-0 top-full z-30 mt-1 w-full max-w-xs rounded-md border border-zinc-200 bg-white p-3 shadow-lg dark:border-zinc-700 dark:bg-[#222224]">
            <div className="mb-2 flex items-center justify-between gap-3">
              <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{translate('Type', language)}</span>
              <button type="button" onClick={onTogglePropertyMenu} aria-label={translate('Cancel', language)} className="grid h-6 w-6 place-items-center rounded text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-700 dark:hover:text-zinc-100"><X size={14} /></button>
            </div>
            <div className="relative">
              <select autoFocus value={category} onChange={event => onCategoryChange(event.target.value)} className="h-9 w-full appearance-none rounded border border-zinc-200 bg-white py-1.5 pl-2.5 pr-9 text-sm text-zinc-800 outline-none transition focus:border-zinc-400 focus:ring-2 focus:ring-zinc-200/70 dark:border-zinc-700 dark:bg-[#1b1b1b] dark:text-zinc-100 dark:focus:border-zinc-500 dark:focus:ring-zinc-700/70">
                <option value="">{translate('Choose a type', language)}</option>
                {['Daily practice', 'Prayer', 'Paritta', 'Sutta', 'Other'].map(value => <option key={value} value={value}>{translate(value, language)}</option>)}
              </select>
              <ChevronDown size={15} aria-hidden="true" className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 dark:text-zinc-400" />
            </div>
          </div>
        )}
      </div>
      <section className="mt-6 w-full">
        <h2 className="mb-3 text-xs font-medium text-zinc-500 dark:text-zinc-400">{translate('Comments', language)}</h2>
        <div className="space-y-2">
          {comments.map(comment => (
            <div key={comment.id} className="flex items-start gap-2.5 py-1">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-zinc-200 text-[10px] text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">S</span>
              <p className="pt-0.5 text-sm text-zinc-800 dark:text-zinc-200">{comment.text}</p>
            </div>
          ))}
          <div className="flex items-center gap-2">
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-zinc-200 text-[10px] text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">S</span>
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <input value={commentDraft} onChange={event => onCommentDraftChange(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); onAddComment() } }} placeholder={translate('Add a comment…', language)} className="min-w-0 flex-1 border-0 bg-transparent p-0 text-sm text-zinc-800 outline-none placeholder:text-zinc-500 focus:ring-0 dark:text-zinc-200" />
              {commentDraft.trim() && <button type="button" onClick={onAddComment} aria-label={translate('Add comment', language)} className="rounded p-1 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"><Send size={14} /></button>}
            </div>
          </div>
        </div>
      </section>
      <hr className="my-5 w-full border-zinc-200 dark:border-zinc-800" />
    </>
  )
}
