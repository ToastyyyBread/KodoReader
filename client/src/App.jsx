import React, { useState, useEffect, useRef } from 'react';
import './index.css';
import Sidebar from './components/Sidebar';
import Library from './components/Library';
import MangaDetail from './components/MangaDetail';
import Reader from './components/Reader';
import SettingsPage from './components/SettingsPage';
import AddSeriesModal from './components/AddSeriesModal';
import BookmarksPage from './components/BookmarksPage';
import Upscaler from './components/Upscaler';
import ImageCompressor from './components/ImageCompressor';
import UpscaleProgress from './components/UpscaleProgress';
import SeriesRenamer from './components/SeriesRenamer';
import TitleBar from './components/TitleBar';
import { apiUrl } from './runtime';

function App() {
  const [view, setView] = useState(() => {
    try { return sessionStorage.getItem('kodo-view') || 'library'; } catch { return 'library'; }
  });
  const [selectedManga, setSelectedManga] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('kodo-manga')) || null; } catch { return null; }
  });
  const [selectedChapter, setSelectedChapter] = useState(() => {
    try { return sessionStorage.getItem('kodo-chapter') || null; } catch { return null; }
  });
  const [selectedVersion, setSelectedVersion] = useState(() => {
    try { return sessionStorage.getItem('kodo-version') || 'default'; } catch { return 'default'; }
  });
  const [chapters, setChapters] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('kodo-chapters')) || []; } catch { return []; }
  });
  const [theme, setTheme] = useState(() => localStorage.getItem('kodo-theme') || 'dark');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsSection, setSettingsSection] = useState('general');
  const [libraryOpen, setLibraryOpen] = useState(true);
  const [refreshKey, setRefreshKey] = useState(() => (localStorage.getItem('kodo-auto-refresh') !== 'false' ? 1 : 0));
  const [initialPage, setInitialPage] = useState(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem('kodo-sidebar-collapsed') === 'true');
  const [activeCategory, setActiveCategory] = useState(null);



  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('kodo-theme', theme);
  }, [theme]);

  // Sync legacy localized bookmarks to backend json
  useEffect(() => {
    try {
      const localBookmarks = JSON.parse(localStorage.getItem('kodo-bookmarks'));
      if (Array.isArray(localBookmarks) && localBookmarks.length > 0) {
        fetch(apiUrl('/api/bookmarks/sync'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bookmarks: localBookmarks })
        })
          .then(r => r.json())
          .then(data => {
            if (data.success) {
              localStorage.removeItem('kodo-bookmarks');
            }
          })
          .catch(() => { });
      } else {
        // Run sync anyway to trigger orphaned cleanup on server start
        fetch(apiUrl('/api/bookmarks/sync'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bookmarks: [] })
        }).catch(() => { });
      }
    } catch {
      fetch(apiUrl('/api/bookmarks/sync'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookmarks: [] })
      }).catch(() => { });
    }
  }, []);

  // Auto-clear cache on exit
  useEffect(() => {
    const handleUnload = () => {
      if (localStorage.getItem('kodo-auto-clear-exit') === 'true') {
        navigator.sendBeacon(apiUrl('/api/cache/clear-kodo'));
      }
    };
    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, []);

  // Sync state to sessionStorage
  useEffect(() => {
    sessionStorage.setItem('kodo-view', view);
    sessionStorage.setItem('kodo-manga', JSON.stringify(selectedManga));
    sessionStorage.setItem('kodo-chapter', selectedChapter || '');
    sessionStorage.setItem('kodo-version', selectedVersion || 'default');
    sessionStorage.setItem('kodo-chapters', JSON.stringify(chapters));
  }, [view, selectedManga, selectedChapter, selectedVersion, chapters]);

  const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark');

  const handleSelectManga = (manga) => {
    setSelectedManga(manga);
    setView('detail');
  };

  const handleSelectChapter = (chapter, chapterList, versionId = 'default') => {
    setSelectedChapter(chapter);
    if (chapterList) setChapters(chapterList);
    setSelectedVersion(versionId);
    setInitialPage(null);
    setView('reader');
  };

  // Navigate to a bookmark
  const handleBookmarkNavigate = (bookmark) => {
    setSelectedManga({ id: bookmark.mangaId, title: bookmark.mangaTitle });
    setSelectedChapter(bookmark.chapterId);
    // If the bookmark has an exact scroll ratio, pass it as an object so the Reader
    // can restore to the precise scroll position matching the screenshot.
    // Otherwise fall back to the legacy page-index approach.
    if (bookmark.scrollRatio != null) {
      setInitialPage({ page: bookmark.page, scrollRatio: bookmark.scrollRatio });
    } else {
      setInitialPage(bookmark.page);
    }
    fetch(`/api/manga/${encodeURIComponent(bookmark.mangaId)}`)
      .then(r => r.json())
      .then(data => {
        setChapters(data.chapters || []);
        setView('reader');
      })
      .catch(() => {
        setChapters([]);
        setView('reader');
      });
  };

  const handleReaderBack = (nextChapterId) => {
    if (nextChapterId) {
      setSelectedChapter(nextChapterId);
    } else {
      setView('detail');
    }
  };

  const [gridTransitioning, setGridTransitioning] = useState(false);

  const handleAddSeries = (newManga) => {
    if (newManga && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('kodo-library-series-added', { detail: newManga }));
      window.dispatchEvent(new Event('kodo-library-hard-refresh'));
    }
    setRefreshKey(k => k + 1);
  };


  // If in reader, render full-screen overlay (no sidebar)
  if (view === 'reader' && selectedManga && selectedChapter) {
    return (
      <div className="app-shell" data-theme={theme}>
        <div className="app-body" style={{ position: 'relative' }}>
          <Reader
            key={selectedChapter + (initialPage ?? '')}
            mangaId={selectedManga.id}
            chapterId={selectedChapter}
            versionId={selectedVersion}
            mangaTitle={selectedManga.title}
            chapters={chapters}
            onBack={handleReaderBack}
            initialPage={initialPage}
            theme={theme}
            onToggleTheme={toggleTheme}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <TitleBar />
      <div className={`app-body${gridTransitioning ? ' grid-transitioning' : ''}`}>
        <Sidebar
          view={view}
          activeCategory={activeCategory}
          onNavigate={(v) => { setView(v); setActiveCategory(null); }}
          onSelectCategory={(c) => { setActiveCategory(c); setView('library'); }}
          onAddSeries={() => setShowAddModal(true)}
          onOpenSettings={(section = 'general') => { setSettingsSection(section); setShowSettings(true); }}
          libraryOpen={libraryOpen}
          onToggleLibrary={() => setLibraryOpen(o => !o)}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => {
            // Force re-trigger: remove class first, then add it next frame
            setGridTransitioning(false);
            requestAnimationFrame(() => {
              setGridTransitioning(true);
              const nv = !sidebarCollapsed;
              setSidebarCollapsed(nv);
              localStorage.setItem('kodo-sidebar-collapsed', nv);
              setTimeout(() => setGridTransitioning(false), 450);
            });
          }}
        />

        <div className="main-content">
          {view === 'library' && (
            <Library
              key={`${refreshKey}-${activeCategory || 'all'}`}
              onSelectManga={handleSelectManga}
              refresh={refreshKey}
              activeCategory={activeCategory}
            />
          )}
          {view === 'detail' && selectedManga && (
            <MangaDetail
              manga={selectedManga}
              onSelectChapter={(ch, chList, vId) => handleSelectChapter(ch, chList, vId)}
              onBack={() => setView('library')}
            />
          )}
          {view === 'bookmarks' && (
            <BookmarksPage onNavigateToBookmark={handleBookmarkNavigate} />
          )}
          {view === 'upscaler' && (
            <Upscaler />
          )}
          {view === 'compressor' && (
            <ImageCompressor />
          )}
          {view === 'renamer' && (
            <SeriesRenamer />
          )}
        </div>
      </div>

      {showAddModal && (
        <AddSeriesModal
          onClose={() => setShowAddModal(false)}
          onAdd={handleAddSeries}
          activeCategory={activeCategory}
        />
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 9000,
            background: 'rgba(0,0,0,0.65)',
            backdropFilter: 'blur(6px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowSettings(false); }}
        >
          <div
            style={{
              width: '620px', maxWidth: '94vw',
              height: '600px', maxHeight: '85vh',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 16,
              overflow: 'hidden',
              display: 'flex', flexDirection: 'column',
              animation: 'modalPopIn 0.22s cubic-bezier(0.4, 0, 0.2, 1)',
              boxShadow: '0 24px 80px rgba(0,0,0,0.45)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 24px', borderBottom: '1px solid var(--border)', background: 'var(--surface)', zIndex: 2 }}>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Settings</h2>
              <button
                onClick={() => setShowSettings(false)}
                style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', display: 'flex', padding: 4, borderRadius: 6 }}
              >
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <SettingsPage theme={theme} onToggleTheme={toggleTheme} activeSectionProp={settingsSection} modal />
          </div>
        </div>
      )}
      <UpscaleProgress onNavigate={(v) => setView(v)} currentView={view} />
    </div>
  );
}

export default App;
