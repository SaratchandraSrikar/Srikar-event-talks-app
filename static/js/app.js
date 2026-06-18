/**
 * BigQuery Release Pulse - Frontend Application Script
 */

document.addEventListener('DOMContentLoaded', () => {
    // Application State
    let releaseNotes = [];
    let filteredNotes = [];
    let selectedUpdate = null;
    let checkedUpdateIds = new Set();
    let currentCategory = 'all';
    let searchQuery = '';
    let lastToastMessage = '';
    let lastToastTime = 0;

    // DOM Elements
    const feedList = document.getElementById('feed-list');
    const refreshBtn = document.getElementById('refresh-btn');
    const exportBtn = document.getElementById('export-btn');
    const searchInput = document.getElementById('search-input');
    const categoryFilters = document.getElementById('category-filters-container');
    const lastFetchedText = document.getElementById('last-fetched-text');
    const themeToggle = document.getElementById('theme-toggle');
    const emptyState = document.getElementById('empty-state');
    const resetSearchBtn = document.getElementById('reset-search-btn');
    
    const activeFilterBanner = document.getElementById('active-filter-banner');
    const activeFilterText = document.getElementById('active-filter-text');
    const clearFiltersBtn = document.getElementById('clear-filters-btn');
    
    // Composer Elements
    const composerEmptyState = document.getElementById('composer-empty-state');
    const composerActiveState = document.getElementById('composer-active-state');
    const deselectUpdateBtn = document.getElementById('deselect-update-btn');
    const refDate = document.getElementById('ref-date');
    const refCategory = document.getElementById('ref-category');
    const refSnippet = document.getElementById('ref-snippet');
    const tweetTextarea = document.getElementById('tweet-textarea');
    const charCounter = document.getElementById('char-counter');
    const ringFill = document.getElementById('ring-fill');
    const tweetPreviewText = document.getElementById('tweet-preview-text');
    const tweetCardDesc = document.getElementById('tweet-card-desc');
    const tweetSubmitBtn = document.getElementById('tweet-submit-btn');
    const hashtagButtons = document.querySelectorAll('.tag-helper-btn');
    const toastContainer = document.getElementById('toast-container');
    
    // UX additions elements
    const searchSuggestions = document.getElementById('search-suggestions');
    const resetDraftBtn = document.getElementById('reset-draft-btn');
    const autoTruncateBtn = document.getElementById('auto-truncate-btn');
    const backToTopBtn = document.getElementById('back-to-top-btn');
    const timelineContainer = document.querySelector('.timeline-container');

    // ==========================================
    // INITIALIZATION & THEME MGMT
    // ==========================================
    
    // Theme setup
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    
    themeToggle.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        showToast(`Switched to ${newTheme} mode`, 'success');
    });

    // Fetch initial data
    fetchReleaseNotes();

    // Event Listeners
    refreshBtn.addEventListener('click', () => fetchReleaseNotes(true));
    exportBtn.addEventListener('click', exportToCSV);
    searchInput.addEventListener('input', debounce(handleSearch, 200));
    resetSearchBtn.addEventListener('click', clearFilters);
    clearFiltersBtn.addEventListener('click', clearFilters);
    deselectUpdateBtn.addEventListener('click', clearSelection);
    
    // Scroll and suggestion listeners
    if (timelineContainer) {
        timelineContainer.addEventListener('scroll', handleScrollTimeline);
    }
    if (backToTopBtn) {
        backToTopBtn.addEventListener('click', scrollToTop);
    }
    if (searchSuggestions) {
        searchSuggestions.addEventListener('click', handleSuggestionClick);
    }

    // ==========================================
    // TOAST NOTIFICATIONS
    // ==========================================
    function showToast(message, type = 'info') {
        const now = Date.now();
        // Ignore duplicate toast notifications within 2 seconds
        if (message === lastToastMessage && (now - lastToastTime) < 2000) {
            return;
        }
        lastToastMessage = message;
        lastToastTime = now;

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        
        // Success checkmark or generic info/error icon
        let icon = '';
        if (type === 'success') {
            icon = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
        } else if (type === 'error') {
            icon = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`;
        } else {
            icon = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`;
        }

        toast.innerHTML = `${icon}<span>${message}</span>`;
        toastContainer.appendChild(toast);

        // Remove toast after 3.5s
        setTimeout(() => {
            toast.classList.add('removing');
            toast.addEventListener('transitionend', () => {
                toast.remove();
            });
        }, 3500);
    }

    // ==========================================
    // DATA FETCHING
    // ==========================================
    async function fetchReleaseNotes(forceRefresh = false) {
        setLoadingState(true);
        const endpoint = forceRefresh ? '/api/release-notes/force-refresh' : '/api/release-notes';
        
        try {
            const response = await fetch(endpoint);
            if (!response.ok) throw new Error(`Server returned code ${response.status}`);
            
            const result = await response.json();
            
            if (result.status === 'success' || result.status === 'warning') {
                releaseNotes = result.data || [];
                updateLastFetchedTime(result.last_fetched);
                
                if (result.status === 'warning') {
                    showToast(result.message, 'warning');
                } else {
                    showToast(forceRefresh ? 'Feed refreshed successfully!' : 'Feed loaded successfully', 'success');
                }
                
                // Show suggestions box if loaded
                if (releaseNotes.length > 0 && searchSuggestions) {
                    searchSuggestions.style.display = 'flex';
                }
                
                applyFilters();
            } else {
                throw new Error(result.message || 'Unknown error');
            }
        } catch (error) {
            console.error('Error fetching release notes:', error);
            showToast(`Error fetching feed: ${error.message}`, 'error');
            setEmptyState();
        } finally {
            setLoadingState(false);
        }
    }

    function setLoadingState(isLoading) {
        const refreshIcon = refreshBtn.querySelector('.refresh-icon');
        if (isLoading) {
            refreshBtn.disabled = true;
            refreshIcon.classList.add('spinning');
            
            // Show skeleton loaders
            feedList.innerHTML = `
                <div class="skeleton-card"><div class="skeleton-header"><div class="skeleton-title"></div><div class="skeleton-badge"></div></div><div class="skeleton-body"><div class="skeleton-line"></div><div class="skeleton-line width-80"></div><div class="skeleton-line width-60"></div></div></div>
                <div class="skeleton-card"><div class="skeleton-header"><div class="skeleton-title"></div><div class="skeleton-badge"></div></div><div class="skeleton-body"><div class="skeleton-line"></div><div class="skeleton-line width-80"></div></div></div>
                <div class="skeleton-card"><div class="skeleton-header"><div class="skeleton-title"></div><div class="skeleton-badge"></div></div><div class="skeleton-body"><div class="skeleton-line"></div><div class="skeleton-line"></div><div class="skeleton-line width-60"></div></div></div>
            `;
            emptyState.style.display = 'none';
        } else {
            refreshBtn.disabled = false;
            refreshIcon.classList.remove('spinning');
        }
    }

    function updateLastFetchedTime(timestamp) {
        if (!timestamp) return;
        const date = new Date(timestamp * 1000);
        
        // Format relative or pretty time
        const pad = (n) => n.toString().padStart(2, '0');
        const formattedTime = `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
        lastFetchedText.textContent = `Updated: ${formattedTime}`;
    }

    // ==========================================
    // FILTERING LOGIC
    // ==========================================
    
    // Category pills click handlers
    categoryFilters.addEventListener('click', (e) => {
        const pill = e.target.closest('.filter-pill');
        if (!pill) return;

        // Toggle active status
        document.querySelectorAll('.filter-pill').forEach(btn => btn.classList.remove('active'));
        pill.classList.add('active');

        currentCategory = pill.getAttribute('data-category');
        applyFilters();
    });

    function handleSearch() {
        searchQuery = searchInput.value.trim().toLowerCase();
        applyFilters();
    }

    function applyFilters() {
        filteredNotes = releaseNotes.filter(note => {
            // Category filter
            const noteCategory = note.category.toLowerCase();
            const matchesCategory = currentCategory === 'all' || noteCategory === currentCategory;
            
            // Search filter
            const matchesSearch = !searchQuery || 
                note.date.toLowerCase().includes(searchQuery) ||
                note.category.toLowerCase().includes(searchQuery) ||
                note.content_text.toLowerCase().includes(searchQuery);
                
            return matchesCategory && matchesSearch;
        });

        renderFeed();
        updateFilterBanner();
    }

    function updateFilterBanner() {
        if (currentCategory !== 'all' || searchQuery !== '') {
            activeFilterBanner.style.display = 'flex';
            const catLabel = currentCategory === 'all' ? 'All Categories' : currentCategory.toUpperCase();
            const searchLabel = searchQuery ? ` matching "${searchQuery}"` : '';
            activeFilterText.textContent = `Filtered: ${filteredNotes.length} of ${releaseNotes.length} updates (${catLabel}${searchLabel})`;
        } else {
            activeFilterBanner.style.display = 'none';
        }
    }

    function clearFilters() {
        searchInput.value = '';
        searchQuery = '';
        currentCategory = 'all';
        
        document.querySelectorAll('.filter-pill').forEach(btn => {
            btn.classList.remove('active');
            if (btn.getAttribute('data-category') === 'all') {
                btn.classList.add('active');
            }
        });
        
        applyFilters();
        showToast('Filters cleared', 'info');
    }

    function setEmptyState() {
        feedList.innerHTML = '';
        emptyState.style.display = 'flex';
    }

    // ==========================================
    // RENDER FEED CARDS
    // ==========================================
    function renderFeed() {
        if (filteredNotes.length === 0) {
            setEmptyState();
            return;
        }

        emptyState.style.display = 'none';
        feedList.innerHTML = '';

        // Identify the newest date in the releaseNotes array to mark it as 'New'
        const newestDate = releaseNotes.length > 0 ? releaseNotes[0].date : '';

        filteredNotes.forEach(note => {
            const isSelected = selectedUpdate && selectedUpdate.id === note.id;
            const isChecked = checkedUpdateIds.has(note.id);
            const isNew = note.date === newestDate;
            const categoryClass = `cat-${note.category.toLowerCase()}`;
            
            const card = document.createElement('article');
            card.className = `release-card ${categoryClass} ${isSelected || isChecked ? 'selected' : ''}`;
            card.dataset.id = note.id;

            // Highlight search query matches within text content
            let bodyHtml = note.content_html;
            if (searchQuery) {
                const regex = new RegExp(`(${escapeRegExp(searchQuery)})`, 'gi');
                // Regex replaces matches only inside text nodes (avoids rewriting HTML tags)
                bodyHtml = bodyHtml.replace(/(<[^>]+>)|([^<]+)/g, (match, tag, text) => {
                    if (tag) return tag;
                    return text.replace(regex, '<mark class="search-highlight">$1</mark>');
                });
            }

            const newBadgeHtml = isNew ? `<span class="badge-tag general" style="color:var(--accent-primary); background-color:var(--accent-bg); margin-left:0.5rem; text-transform:none;">New</span>` : '';

            card.innerHTML = `
                <div class="card-header">
                    <div class="card-meta">
                        <div class="card-select-wrapper" title="Select for Export/Tweet">
                            <input type="checkbox" class="card-checkbox" ${isChecked ? 'checked' : ''} aria-label="Select update">
                        </div>
                        <span class="card-date">${note.date}</span>
                        ${newBadgeHtml}
                    </div>
                    <span class="badge-tag ${note.category.toLowerCase()}">${note.category}</span>
                </div>
                <div class="card-body">
                    ${bodyHtml}
                </div>
                <div class="card-footer">
                    <div class="dropdown copy-dropdown">
                        <button class="card-action-btn copy-card-btn" title="Copy text to clipboard">
                            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                            </svg>
                            <span>Copy ▾</span>
                        </button>
                        <div class="dropdown-menu">
                            <button class="dropdown-item copy-format-btn" data-format="text">Plain Text</button>
                            <button class="dropdown-item copy-format-btn" data-format="markdown">Markdown</button>
                            <button class="dropdown-item copy-format-btn" data-format="html">HTML</button>
                        </div>
                    </div>
                    <button class="card-action-btn tweet-card-btn" title="Tweet this specific update instantly">
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"></path>
                        </svg>
                        <span>Tweet</span>
                    </button>
                </div>
            `;

            // Card Events
            const checkbox = card.querySelector('.card-checkbox');
            
            checkbox.addEventListener('click', (e) => {
                e.stopPropagation();
                if (checkbox.checked) {
                    checkedUpdateIds.add(note.id);
                } else {
                    checkedUpdateIds.delete(note.id);
                }
                renderFeed();
                updateExportButtonLabel();
            });

            card.querySelectorAll('.copy-format-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const format = btn.getAttribute('data-format');
                    let textToCopy = '';
                    if (format === 'text') {
                        textToCopy = note.content_text;
                    } else if (format === 'markdown') {
                        textToCopy = toMarkdown(note.content_html, note.date, note.category);
                    } else if (format === 'html') {
                        textToCopy = note.content_html;
                    }
                    copyTextToClipboard(textToCopy);
                });
            });

            card.querySelector('.tweet-card-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                triggerInstantTweet(note);
            });

            card.addEventListener('click', (e) => {
                if (e.target.tagName === 'A' || e.target.closest('a') || e.target.closest('.dropdown')) return;
                toggleSelectUpdate(note);
            });

            feedList.appendChild(card);
        });
    }

    // Copy to Clipboard helper
    function copyTextToClipboard(text) {
        navigator.clipboard.writeText(text).then(() => {
            showToast('Text copied to clipboard!', 'success');
        }).catch(err => {
            console.error('Failed to copy text: ', err);
            showToast('Failed to copy text', 'error');
        });
    }

    // ==========================================
    // TWEET COMPOSER LOGIC
    // ==========================================
    function toggleSelectUpdate(note) {
        if (selectedUpdate && selectedUpdate.id === note.id) {
            clearSelection();
        } else {
            selectedUpdate = note;
            renderFeed();
            openComposer(note);
        }
    }

    function clearSelection() {
        selectedUpdate = null;
        renderFeed();
        
        composerActiveState.style.display = 'none';
        composerEmptyState.style.display = 'flex';
        tweetTextarea.value = '';
    }

    function openComposer(note) {
        composerEmptyState.style.display = 'none';
        composerActiveState.style.display = 'flex';

        // Load reference metadata
        refDate.textContent = note.date;
        refCategory.textContent = note.category;
        refCategory.className = `badge-tag ${note.category.toLowerCase()}`;
        
        refSnippet.textContent = note.content_text;
        
        const draftText = defaultTweetTemplate(note);
        tweetTextarea.value = draftText;
        
        updateTweetEditorStats();
        
        tweetTextarea.removeEventListener('input', updateTweetEditorStats);
        tweetTextarea.addEventListener('input', updateTweetEditorStats);
        
        // Bind composer actions
        resetDraftBtn.onclick = () => {
            tweetTextarea.value = defaultTweetTemplate(note);
            updateTweetEditorStats();
            showToast('Draft text reset to template', 'info');
        };

        autoTruncateBtn.onclick = () => {
            const prefix = `📢 BigQuery ${note.category} (${note.date}):\n`;
            const suffix = `\n\n#BigQuery #GoogleCloud`;
            const maxBodyLen = 280 - prefix.length - suffix.length - 4; // Ellipsis space
            
            let body = note.content_text;
            if (body.length > maxBodyLen) {
                body = body.substring(0, maxBodyLen) + '...';
            }
            tweetTextarea.value = `${prefix}${body}${suffix}`;
            updateTweetEditorStats();
            showToast('Draft truncated successfully', 'success');
        };

        hashtagButtons.forEach(btn => {
            btn.onclick = (e) => {
                e.preventDefault();
                const tag = btn.getAttribute('data-tag');
                appendHashtag(tag);
            };
        });

        tweetSubmitBtn.onclick = (e) => {
            e.preventDefault();
            sendTweet(tweetTextarea.value);
        };
        
        tweetCardDesc.textContent = `${note.date} • ${note.category} Release`;
        
        if (window.innerWidth <= 992) {
            composerActiveState.scrollIntoView({ behavior: 'smooth' });
        }
    }

    function defaultTweetTemplate(note) {
        // Build an elegant default tweet
        const prefix = `📢 BigQuery ${note.category} (${note.date}):\n`;
        const suffix = `\n\n#BigQuery #GoogleCloud`;
        const reservedLen = prefix.length + suffix.length;
        const maxBodyLen = 280 - reservedLen;
        
        let body = note.content_text;
        if (body.length > maxBodyLen) {
            body = body.substring(0, maxBodyLen - 4) + '...';
        }
        
        return `${prefix}${body}${suffix}`;
    }

    function appendHashtag(tag) {
        const text = tweetTextarea.value;
        
        // Check if hashtag already exists
        if (text.includes(tag)) {
            showToast(`Hashtag ${tag} is already in the draft`, 'info');
            return;
        }

        // Check if appending violates 280 character limit
        if (text.length + tag.length + 1 > 280) {
            showToast('Adding this tag will exceed character limit', 'error');
            return;
        }

        // Append nicely with appropriate space
        if (text.endsWith('\n') || text.endsWith(' ')) {
            tweetTextarea.value = text + tag;
        } else {
            tweetTextarea.value = text + ' ' + tag;
        }
        
        updateTweetEditorStats();
    }

    function updateTweetEditorStats() {
        const text = tweetTextarea.value;
        const length = text.length;
        const remaining = 280 - length;
        
        charCounter.textContent = remaining;
        
        const percent = Math.min((length / 280) * 100, 100);
        ringFill.setAttribute('stroke-dasharray', `${percent}, 100`);

        if (remaining < 0) {
            charCounter.classList.add('danger');
            ringFill.classList.add('danger');
            ringFill.classList.remove('warn');
            tweetSubmitBtn.disabled = true;
            if (autoTruncateBtn) autoTruncateBtn.style.display = 'inline-block';
        } else if (remaining <= 20) {
            charCounter.classList.add('danger');
            charCounter.classList.remove('warn');
            ringFill.classList.add('warn');
            ringFill.classList.remove('danger');
            tweetSubmitBtn.disabled = false;
            if (autoTruncateBtn) autoTruncateBtn.style.display = 'none';
        } else {
            charCounter.classList.remove('danger', 'warn');
            ringFill.classList.remove('danger', 'warn');
            tweetSubmitBtn.disabled = false;
            if (autoTruncateBtn) autoTruncateBtn.style.display = 'none';
        }

        tweetPreviewText.textContent = text || 'Draft text preview will show up here...';
    }

    function triggerInstantTweet(note) {
        const text = defaultTweetTemplate(note);
        sendTweet(text);
    }

    function sendTweet(text) {
        if (!text.trim()) {
            showToast('Tweet content cannot be empty', 'error');
            return;
        }
        
        if (text.length > 280) {
            showToast('Tweet content exceeds 280 characters limit', 'error');
            return;
        }

        const encodedText = encodeURIComponent(text);
        const twitterIntentUrl = `https://twitter.com/intent/tweet?text=${encodedText}`;
        
        // Open Twitter in a new tab
        window.open(twitterIntentUrl, '_blank');
        showToast('Redirecting to X / Twitter intent composer...', 'success');
    }

    // ==========================================
    // UTILITY FUNCTIONS
    // ==========================================
    
    function exportToCSV() {
        const notesToExport = checkedUpdateIds.size > 0 
            ? releaseNotes.filter(n => checkedUpdateIds.has(n.id))
            : filteredNotes;

        if (notesToExport.length === 0) {
            showToast('No data available to export', 'error');
            return;
        }

        let csvContent = "Date,Category,Content\n";

        notesToExport.forEach(note => {
            const dateEscaped = `"${note.date.replace(/"/g, '""')}"`;
            const categoryEscaped = `"${note.category.replace(/"/g, '""')}"`;
            const textEscaped = `"${note.content_text.replace(/"/g, '""')}"`;
            csvContent += `${dateEscaped},${categoryEscaped},${textEscaped}\n`;
        });

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        
        let filename = checkedUpdateIds.size > 0 
            ? "bigquery_selected_updates" 
            : "bigquery_release_notes";
            
        if (checkedUpdateIds.size === 0) {
            if (currentCategory !== 'all') filename += `_${currentCategory}`;
            if (searchQuery) filename += `_search`;
        }
        filename += ".csv";
        
        link.setAttribute("href", url);
        link.setAttribute("download", filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        showToast(`Exported ${notesToExport.length} notes to CSV`, 'success');
        
        // Clear selections after export if they chose specific ones
        if (checkedUpdateIds.size > 0) {
            checkedUpdateIds.clear();
            renderFeed();
            updateExportButtonLabel();
        }
    }

    function updateExportButtonLabel() {
        const count = checkedUpdateIds.size;
        const exportBtnSpan = exportBtn.querySelector('span');
        if (count > 0) {
            exportBtnSpan.textContent = `Export Selected (${count})`;
            exportBtn.style.borderColor = 'var(--accent-primary)';
            exportBtn.style.color = 'var(--accent-primary)';
        } else {
            exportBtnSpan.textContent = 'Export CSV';
            exportBtn.style.borderColor = 'var(--border-color)';
            exportBtn.style.color = 'var(--text-secondary)';
        }
    }

    // Scroll handler for back to top button
    function handleScrollTimeline() {
        if (timelineContainer.scrollTop > 300) {
            backToTopBtn.classList.add('visible');
        } else {
            backToTopBtn.classList.remove('visible');
        }
    }

    function scrollToTop() {
        timelineContainer.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // Keyword suggestion handler
    function handleSuggestionClick(e) {
        const pill = e.target.closest('.suggestion-pill');
        if (!pill) return;
        
        const term = pill.getAttribute('data-term');
        searchInput.value = term;
        handleSearch();
        showToast(`Filtered by "${term}"`, 'info');
    }

    // Escape regex characters
    function escapeRegExp(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    // HTML to Markdown simple converter
    function toMarkdown(html, date, category) {
        let md = `### BigQuery ${category} - ${date}\n\n`;
        let temp = html;
        temp = temp.replace(/<a\s+(?:[^>]*?\s+)?href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)');
        temp = temp.replace(/<\/?code>/gi, '`');
        temp = temp.replace(/<\/?p>/gi, '\n\n');
        temp = temp.replace(/<[^>]+>/g, '');
        temp = temp.replace(/\n\s*\n+/g, '\n\n');
        return md + temp.trim();
    }

    // Debounce function for input searching
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
});
