/**
 * BigQuery Release Pulse - Frontend Application Script
 */

document.addEventListener('DOMContentLoaded', () => {
    // Application State
    let releaseNotes = [];
    let filteredNotes = [];
    let selectedUpdate = null;
    let currentCategory = 'all';
    let searchQuery = '';

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

    // ==========================================
    // TOAST NOTIFICATIONS
    // ==========================================
    function showToast(message, type = 'info') {
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

        filteredNotes.forEach(note => {
            const isSelected = selectedUpdate && selectedUpdate.id === note.id;
            const categoryClass = `cat-${note.category.toLowerCase()}`;
            
            const card = document.createElement('article');
            card.className = `release-card ${categoryClass} ${isSelected ? 'selected' : ''}`;
            card.dataset.id = note.id;

            card.innerHTML = `
                <div class="card-header">
                    <div class="card-meta">
                        <div class="card-select-wrapper" title="Select to Tweet">
                            <input type="checkbox" class="card-checkbox" ${isSelected ? 'checked' : ''} aria-label="Select update for tweet">
                        </div>
                        <span class="card-date">${note.date}</span>
                    </div>
                    <span class="badge-tag ${note.category.toLowerCase()}">${note.category}</span>
                </div>
                <div class="card-body">
                    ${note.content_html}
                </div>
                <div class="card-footer">
                    <button class="card-action-btn copy-card-btn" title="Copy text to clipboard">
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                        </svg>
                        <span>Copy</span>
                    </button>
                    <button class="card-action-btn tweet-card-btn" title="Tweet this specific update instantly">
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"></path>
                        </svg>
                        <span>Tweet</span>
                    </button>
                </div>
            `;

            // Card Events
            // Clicking checkbox or body selects card
            const checkbox = card.querySelector('.card-checkbox');
            
            checkbox.addEventListener('click', (e) => {
                e.stopPropagation(); // Avoid double toggle from card body click
                toggleSelectUpdate(note);
            });

            card.querySelector('.copy-card-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                copyTextToClipboard(note.content_text);
            });

            card.querySelector('.tweet-card-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                triggerInstantTweet(note);
            });

            card.addEventListener('click', (e) => {
                // Ignore if clicking a hyperlink inside card body
                if (e.target.tagName === 'A' || e.target.closest('a')) return;
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
            // Already selected, so deselect it
            clearSelection();
        } else {
            // Select new one
            selectedUpdate = note;
            
            // Re-render feed to show active highlight border
            renderFeed();
            
            // Open composer state
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
        
        // Create a short snippet for the reference block
        refSnippet.textContent = note.content_text;
        
        // Generate prefilled tweet text
        const draftText = defaultTweetTemplate(note);
        tweetTextarea.value = draftText;
        
        // Render preview and check lengths
        updateTweetEditorStats();
        
        // Setup live listener for text modifications
        tweetTextarea.removeEventListener('input', updateTweetEditorStats);
        tweetTextarea.addEventListener('input', updateTweetEditorStats);
        
        // Bind hashtag helper pills
        hashtagButtons.forEach(btn => {
            btn.onclick = (e) => {
                e.preventDefault();
                const tag = btn.getAttribute('data-tag');
                appendHashtag(tag);
            };
        });

        // Bind composer Tweet submission
        tweetSubmitBtn.onclick = (e) => {
            e.preventDefault();
            sendTweet(tweetTextarea.value);
        };
        
        // Update embedded card visual preview details
        tweetCardDesc.textContent = `${note.date} • ${note.category} Release`;
        
        // Scroll composer into view on mobile
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
        
        // Update numerical counter
        charCounter.textContent = remaining;
        
        // Handle Twitter circle visual loader progress
        const percent = Math.min((length / 280) * 100, 100);
        ringFill.setAttribute('stroke-dasharray', `${percent}, 100`);

        // Style warnings based on character counts
        if (remaining < 0) {
            charCounter.classList.add('danger');
            ringFill.classList.add('danger');
            ringFill.classList.remove('warn');
            tweetSubmitBtn.disabled = true;
        } else if (remaining <= 20) {
            charCounter.classList.add('danger');
            charCounter.classList.remove('warn');
            ringFill.classList.add('warn');
            ringFill.classList.remove('danger');
            tweetSubmitBtn.disabled = false;
        } else {
            charCounter.classList.remove('danger', 'warn');
            ringFill.classList.remove('danger', 'warn');
            tweetSubmitBtn.disabled = false;
        }

        // Update tweet live preview widget
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
        if (filteredNotes.length === 0) {
            showToast('No data available to export', 'error');
            return;
        }

        let csvContent = "Date,Category,Content\n";

        filteredNotes.forEach(note => {
            const dateEscaped = `"${note.date.replace(/"/g, '""')}"`;
            const categoryEscaped = `"${note.category.replace(/"/g, '""')}"`;
            const textEscaped = `"${note.content_text.replace(/"/g, '""')}"`;
            csvContent += `${dateEscaped},${categoryEscaped},${textEscaped}\n`;
        });

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        
        let filename = "bigquery_release_notes";
        if (currentCategory !== 'all') {
            filename += `_${currentCategory}`;
        }
        if (searchQuery) {
            filename += `_search`;
        }
        filename += ".csv";
        
        link.setAttribute("href", url);
        link.setAttribute("download", filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        showToast(`Exported ${filteredNotes.length} notes to CSV`, 'success');
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
