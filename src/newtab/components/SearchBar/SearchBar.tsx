import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStorage } from '../../hooks/useStorage';
import { KEYS } from '../../../shared/storage';
import { DEFAULT_AI_TOOLS } from '../../../shared/defaults';
import type { AITool, AppSettings } from '../../../shared/types';
import { DEFAULT_SETTINGS } from '../../../shared/defaults';
import styles from './SearchBar.module.css';

interface SearchEngine {
  id: string;
  name: string;
  urlTemplate: string;
  icon: string;
  prefix: string;
}

const SEARCH_ENGINES: SearchEngine[] = [
  {
    id: "google", name: "Google", prefix: "g:",
    urlTemplate: "https://google.com/search?q=",
    icon: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8a4 4 0 1 1-3.9 3H12"/></svg>`
  },
  {
    id: "duckduckgo", name: "DuckDuckGo", prefix: "d:",
    urlTemplate: "https://duckduckgo.com/?q=",
    icon: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v2m0 8v2m-6-6h2m8 0h2"/></svg>`
  },
  {
    id: "youtube", name: "YouTube", prefix: "yt:",
    urlTemplate: "https://youtube.com/results?search_query=",
    icon: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><rect width="20" height="15" x="2" y="4.5" rx="3"/><path d="m10 9 5 3-5 3V9z"/></svg>`
  },
  {
    id: "wikipedia", name: "Wikipedia", prefix: "w:",
    urlTemplate: "https://en.wikipedia.org/w/index.php?search=",
    icon: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 22h4l6-12 6 12h4L12 2z"/></svg>`
  },
  {
    id: "github", name: "GitHub", prefix: "gh:",
    urlTemplate: "https://github.com/search?q=",
    icon: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/></svg>`
  },
  {
    id: "stackoverflow", name: "Stack Overflow", prefix: "so:",
    urlTemplate: "https://stackoverflow.com/search?q=",
    icon: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 20h16M6 16h12M8 12h8M10 8h4"/></svg>`
  }
];

export default function SearchBar() {
  const [tools] = useStorage<AITool[]>(KEYS.AI_TOOLS, DEFAULT_AI_TOOLS);
  const [settings, setSettings] = useStorage<AppSettings>(KEYS.SETTINGS, DEFAULT_SETTINGS);

  const [query, setQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [showingEngineMenu, setShowingEngineMenu] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const activeEngineId = settings.searchEngine || "google";
  const activeEngine = SEARCH_ENGINES.find(e => e.id === activeEngineId) || SEARCH_ENGINES[0];

  // Click outside to dismiss dropdowns
  useEffect(() => {
    const clickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsFocused(false);
        setShowingEngineMenu(false);
      }
    };
    document.addEventListener('mousedown', clickOutside);
    return () => document.removeEventListener('mousedown', clickOutside);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);

    // Detect search engine prefix command (e.g. typing "gh:")
    for (const eng of SEARCH_ENGINES) {
      if (val.toLowerCase().startsWith(eng.prefix)) {
        setSettings({ ...settings, searchEngine: eng.id as any });
        setQuery(val.slice(eng.prefix.length).trimStart());
        break;
      }
    }
  };

  const handleSetEngine = (engineId: string) => {
    setSettings({ ...settings, searchEngine: engineId as any });
    setShowingEngineMenu(false);
    inputRef.current?.focus();
  };

  const executeAction = (searchQuery = query) => {
    const trimmed = searchQuery.trim();
    if (!trimmed) return;

    // 1. Direct AI tools launch check
    const matchedTool = tools.find(
      t => t.name.toLowerCase() === trimmed.toLowerCase() || t.id === trimmed.toLowerCase()
    );

    if (matchedTool) {
      if (typeof chrome !== 'undefined' && chrome.tabs?.create) {
        chrome.tabs.create({ url: matchedTool.url });
      } else {
        window.open(matchedTool.url, '_blank');
      }
      setQuery('');
      setIsFocused(false);
      return;
    }

    // 2. Search query URL submission
    const destUrl = activeEngine.urlTemplate + encodeURIComponent(trimmed);
    if (typeof chrome !== 'undefined' && chrome.tabs?.create) {
      chrome.tabs.create({ url: destUrl });
    } else {
      window.open(destUrl, '_blank');
    }
    setQuery('');
    setIsFocused(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      executeAction();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setQuery('');
      setIsFocused(false);
      setShowingEngineMenu(false);
      inputRef.current?.blur();
    } else if (e.key === 'Tab') {
      // Tab cycles through engines
      e.preventDefault();
      const currentIdx = SEARCH_ENGINES.findIndex(e => e.id === activeEngine.id);
      const nextIdx = (currentIdx + 1) % SEARCH_ENGINES.length;
      setSettings({ ...settings, searchEngine: SEARCH_ENGINES[nextIdx].id as any });
    }
  };

  const hasQuery = query.trim().length > 0;
  const matchedTool = hasQuery
    ? tools.find(t => t.name.toLowerCase() === query.trim().toLowerCase() || t.id === query.trim().toLowerCase())
    : null;

  return (
    <div className={styles.container} ref={containerRef}>
      <div className={`${styles.searchForm} ${isFocused ? styles.focused : ''}`}>
        
        {/* Engine selector badge */}
        <div
          className={styles.engineBadge}
          onClick={(e) => {
            e.stopPropagation();
            setShowingEngineMenu(!showingEngineMenu);
          }}
          title="Click to change search engine"
        >
          <span
            className={styles.engineIcon}
            dangerouslySetInnerHTML={{ __html: activeEngine.icon }}
          />
          <span className={styles.engineText}>{activeEngine.name}</span>
        </div>

        {/* Search Icon */}
        <span className={styles.searchIcon}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/>
            <path d="m21 21-4.3-4.3"/>
          </svg>
        </span>

        {/* Input area */}
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onFocus={() => {
            setIsFocused(true);
            setShowingEngineMenu(false);
          }}
          onKeyDown={handleKeyDown}
          placeholder={`Search ${activeEngine.name}...`}
          className={styles.input}
          autoComplete="off"
          spellCheck="false"
        />

        {/* Shortcut Hint */}
        <span className={styles.searchHint}>↵</span>
      </div>

      {/* Engine Dropdown Menu */}
      <AnimatePresence>
        {showingEngineMenu && (
          <motion.div
            className={styles.engineSelector}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.15 }}
          >
            {SEARCH_ENGINES.map((engine) => (
              <div
                key={engine.id}
                className={`${styles.engineItem} ${engine.id === activeEngine.id ? styles.engineActive : ''}`}
                onClick={() => handleSetEngine(engine.id)}
              >
                <span
                  className={styles.itemIcon}
                  dangerouslySetInnerHTML={{ __html: engine.icon }}
                />
                <span className={styles.itemName}>{engine.name}</span>
                <span className={styles.itemPrefix}>{engine.prefix}</span>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Search Suggestion/Launch Dropdown */}
      <AnimatePresence>
        {isFocused && hasQuery && !showingEngineMenu && (
          <motion.div
            className={styles.dropdown}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.12 }}
          >
            {matchedTool ? (
              <div
                className={`${styles.dropdownItem} ${styles.dropdownActive}`}
                onClick={() => executeAction()}
              >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                  <polyline points="15 3 21 3 21 9"/>
                  <line x1="10" x2="21" y1="14" y2="3"/>
                </svg>
                <span>Launch {matchedTool.name}</span>
                <span className={styles.itemShortcut}>Enter</span>
              </div>
            ) : (
              <div
                className={`${styles.dropdownItem} ${styles.dropdownActive}`}
                onClick={() => executeAction()}
              >
                <span
                  className={styles.itemIcon}
                  dangerouslySetInnerHTML={{ __html: activeEngine.icon }}
                />
                <span>Search "{query.trim()}" on {activeEngine.name}</span>
                <span className={styles.itemShortcut}>↵</span>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
