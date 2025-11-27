// --- DOM Elements ---
const DOM = {
    searchInput: document.querySelector('.search-input'),
    searchBtn: document.querySelector('.search-btn'),
    resultsContainer: document.getElementById('results'),
    resultsSection: document.getElementById('resultsSection'),
    recommendedList: document.getElementById('recommendedList'),
    recommendedSection: document.getElementById('recommendedSection'),
    historyList: document.getElementById('historyList'),
    historySection: document.getElementById('historySection'),
    loading: document.querySelector('.loading'),
    noResults: document.querySelector('.no-results'),
    
    // Player
    audio: document.getElementById('audioPlayer'),
    playerMini: document.getElementById('playerMini'),
    playerFull: document.getElementById('playerFull'),
    
    // Controls Full
    playBtnLarge: document.getElementById('playBtnLarge'),
    prevBtnLarge: document.getElementById('prevBtnLarge'),
    nextBtnLarge: document.getElementById('nextBtnLarge'),
    progressBar: document.getElementById('progressBarLarge'),
    progressFill: document.getElementById('progressLarge'),
    currTime: document.getElementById('currentTimeLarge'),
    durTime: document.getElementById('totalTimeLarge'),
    
    // Controls Mini
    miniPlayBtn: document.getElementById('miniPlayBtn'),
    
    // Meta
    thumbnails: document.querySelectorAll('.song-thumbnail-img'),
    titles: document.querySelectorAll('.song-title-text'),
    artists: document.querySelectorAll('.song-artist-text'),
    
    // Others
    volumeSlider: document.getElementById('volumeSlider'),
    welcomePanel: document.getElementById('welcomePanel')
};

// --- State Management ---
let state = {
    playlist: [],
    currentIndex: 0,
    isPlaying: false,
    isLoading: false,
    history: JSON.parse(localStorage.getItem(API_CONFIG.DEFAULTS.STORAGE_KEYS.HISTORY) || '[]'),
    favorites: JSON.parse(localStorage.getItem(API_CONFIG.DEFAULTS.STORAGE_KEYS.FAVORITES) || '[]')
};

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    initApp();
    setupEventListeners();
    
    // Load volume
    const savedVol = localStorage.getItem(API_CONFIG.DEFAULTS.STORAGE_KEYS.VOLUME);
    if(savedVol) {
        DOM.audio.volume = parseFloat(savedVol);
        DOM.volumeSlider.value = parseFloat(savedVol) * 100;
    }
});

function initApp() {
    // Show Welcome then Load Recommendations
    if(!sessionStorage.getItem('welcomeShown')) {
        setTimeout(() => DOM.welcomePanel.classList.add('show'), 500);
    } else {
        DOM.welcomePanel.style.display = 'none';
        loadRecommendations();
    }
    
    updateHistoryUI();
    
    document.getElementById('welcomeCloseBtn').addEventListener('click', () => {
        DOM.welcomePanel.classList.remove('show');
        setTimeout(() => DOM.welcomePanel.style.display = 'none', 500);
        sessionStorage.setItem('welcomeShown', 'true');
        loadRecommendations();
    });
}

// --- API Functions ---

async function loadRecommendations() {
    setLoading(true, "Memuat rekomendasi...");
    try {
        const data = await fetchSearch(API_CONFIG.DEFAULTS.DEFAULT_SEARCH);
        if(data && data.length > 0) {
            renderSongs(data, DOM.recommendedList);
            DOM.recommendedSection.style.display = 'block';
        }
    } catch (e) {
        console.error(e);
        UTILS.showToast("Gagal memuat rekomendasi", "error");
    } finally {
        setLoading(false);
    }
}

async function performSearch(query) {
    if(!query) return;
    setLoading(true, `Mencari "${query}"...`);
    
    // Hide recommendations/history to focus on results
    DOM.recommendedSection.style.display = 'none';
    DOM.historySection.style.display = 'none';
    DOM.resultsContainer.innerHTML = '';
    DOM.noResults.style.display = 'none';

    try {
        const results = await fetchSearch(query);
        
        if(results && results.length > 0) {
            DOM.resultsSection.classList.add('active');
            renderSongs(results, DOM.resultsContainer);
            state.playlist = results; // Set playlist context to search results
        } else {
            DOM.noResults.style.display = 'block';
        }
    } catch (error) {
        UTILS.showToast("Terjadi kesalahan koneksi", "error");
        DOM.noResults.style.display = 'block';
    } finally {
        setLoading(false);
    }
}

// Wrapper to handle Search API
async function fetchSearch(query) {
    const url = `${API_CONFIG.URLS.SEARCH}?query=${encodeURIComponent(query)}`;
    const res = await fetch(url);
    const json = await res.json();
    
    // Normalize data structure
    if(json.data) return json.data;
    if(json.results) return json.results;
    if(json.result) return json.result; // Handle various API response shapes
    return [];
}

// --- Player Logic ---

async function playTrack(songData, indexInPlaylist) {
    if(state.isLoading) return;
    
    state.currentIndex = indexInPlaylist;
    updatePlayerMeta(songData);
    DOM.playerMini.classList.remove('hidden');
    
    // Optimistic UI update
    setLoading(true, "Menyiapkan lagu...");
    
    try {
        // Try Primary API (v5)
        let audioUrl = await getAudioUrl(API_CONFIG.URLS.DOWNLOAD_PRIMARY, songData.url || songData.videoUrl);
        
        // Fallback to Backup API (v4) if v5 fails
        if(!audioUrl) {
            console.warn("Primary API failed, trying backup...");
            audioUrl = await getAudioUrl(API_CONFIG.URLS.DOWNLOAD_BACKUP, songData.url || songData.videoUrl);
        }

        if(!audioUrl) throw new Error("Audio source not found");

        DOM.audio.src = audioUrl;
        await DOM.audio.play();
        
        state.isPlaying = true;
        updatePlayBtnUI();
        addToHistory(songData);
        UTILS.showToast(`Memutar: ${songData.title}`, 'success');

    } catch (error) {
        console.error("Playback Error:", error);
        UTILS.showToast("Gagal memutar lagu. Coba judul lain.", "error");
        state.isPlaying = false;
        updatePlayBtnUI();
    } finally {
        setLoading(false);
    }
}

async function getAudioUrl(baseUrl, videoUrl) {
    try {
        if(!videoUrl.includes('youtube.com') && !videoUrl.includes('youtu.be')) {
             videoUrl = `https://www.youtube.com/watch?v=${videoUrl}`; // Handle if only ID provided
        }

        const res = await fetch(`${baseUrl}?url=${encodeURIComponent(videoUrl)}`);
        const json = await res.json();
        
        if(!json.success && !json.status) return null;

        const data = json.result || json.data;
        if(!data) return null;

        // Logic extraction based on prompt's JSON structure
        if(data.medias && Array.isArray(data.medias)) {
            // Priority 1: Format 'audio' or 'mp3'
            let media = data.medias.find(m => m.type === 'audio' || m.extension === 'mp3');
            
            // Priority 2: Video with audio (is_audio: true)
            if(!media) {
                media = data.medias.find(m => m.is_audio === true);
            }

            // Priority 3: First available media
            if(!media) media = data.medias[0];

            return media ? media.url : null;
        } 
        
        // Handle older API structure just in case
        return data.download_url || data.url || null;

    } catch (e) {
        console.error(`Error fetching from ${baseUrl}:`, e);
        return null;
    }
}

// --- UI Rendering ---

function renderSongs(songs, container) {
    container.innerHTML = '';
    songs.forEach((song, index) => {
        // Normalize Song Object
        const title = song.title || "Unknown Title";
        const artist = song.author?.name || song.channel?.name || song.channel || "Unknown Artist";
        const thumb = song.thumbnail || song.image || "./css/image.png";
        const duration = song.timestamp || song.duration || "";
        const id = song.videoId || song.id;
        const url = song.url || `https://youtu.be/${id}`;

        const card = document.createElement('div');
        card.className = 'song-card';
        card.innerHTML = `
            <div class="card-image-wrapper">
                <img src="${thumb}" alt="${title}" loading="lazy">
                <div class="card-overlay">
                    <button class="btn-play-overlay"><i class="fas fa-play"></i></button>
                </div>
            </div>
            <div class="card-info">
                <h4>${title}</h4>
                <p>${artist}</p>
                <span>${duration}</span>
            </div>
        `;

        // Pass normalized data to click handler
        const songData = { title, artist, thumbnail: thumb, url, id };
        
        card.addEventListener('click', () => {
            // Update playlist context if clicking from search/recommendation
            if(container === DOM.resultsContainer || container === DOM.recommendedList) {
                state.playlist = songs;
            }
            playTrack(songData, index);
        });

        container.appendChild(card);
    });
}

function updatePlayerMeta(song) {
    // Update Text
    DOM.titles.forEach(el => {
        el.textContent = song.title;
        // Add scrolling effect if long
        if(song.title.length > 25) el.closest('.scrolling-wrapper')?.classList.add('scroll');
        else el.closest('.scrolling-wrapper')?.classList.remove('scroll');
    });
    DOM.artists.forEach(el => el.textContent = song.artist);
    
    // Update Images
    DOM.thumbnails.forEach(img => img.src = song.thumbnail);
}

function updatePlayBtnUI() {
    const icon = state.isPlaying ? 'fa-pause' : 'fa-play';
    DOM.playBtnLarge.innerHTML = `<i class="fas ${icon}"></i>`;
    DOM.miniPlayBtn.innerHTML = `<i class="fas ${icon}"></i>`;
}

function setLoading(bool, msg = "") {
    state.isLoading = bool;
    DOM.loading.style.display = bool ? 'flex' : 'none';
    if(msg) DOM.loading.querySelector('p').textContent = msg;
}

// --- History & Storage ---

function addToHistory(song) {
    // Remove duplicates
    state.history = state.history.filter(s => s.id !== song.id);
    state.history.unshift(song);
    // Limit
    if(state.history.length > API_CONFIG.DEFAULTS.MAX_HISTORY) state.history.pop();
    
    localStorage.setItem(API_CONFIG.DEFAULTS.STORAGE_KEYS.HISTORY, JSON.stringify(state.history));
    updateHistoryUI();
}

function updateHistoryUI() {
    if(state.history.length === 0) {
        DOM.historySection.style.display = 'none';
        return;
    }
    DOM.historySection.style.display = 'block';
    DOM.historyList.innerHTML = '';
    
    state.history.slice(0, 5).forEach((song, index) => {
        const item = document.createElement('div');
        item.className = 'history-item';
        item.innerHTML = `
            <img src="${song.thumbnail}" alt="cover">
            <div class="meta">
                <h5>${song.title}</h5>
                <p>${song.artist}</p>
            </div>
            <button class="btn-play-small"><i class="fas fa-play"></i></button>
        `;
        item.addEventListener('click', () => playTrack(song, index));
        DOM.historyList.appendChild(item);
    });
}

// --- Event Listeners ---

function setupEventListeners() {
    // Search
    DOM.searchBtn.addEventListener('click', () => performSearch(DOM.searchInput.value));
    DOM.searchInput.addEventListener('keyup', (e) => {
        if(e.key === 'Enter') performSearch(DOM.searchInput.value);
    });

    // Audio Events
    DOM.audio.addEventListener('timeupdate', () => {
        const pct = (DOM.audio.currentTime / DOM.audio.duration) * 100;
        DOM.progressFill.style.width = `${pct}%`;
        DOM.currTime.textContent = UTILS.formatTime(DOM.audio.currentTime);
        DOM.durTime.textContent = UTILS.formatTime(DOM.audio.duration);
    });
    
    DOM.audio.addEventListener('ended', () => {
        state.isPlaying = false;
        updatePlayBtnUI();
        // Auto next logic here if needed
    });

    // Controls
    const togglePlay = () => {
        if(state.isPlaying) DOM.audio.pause();
        else DOM.audio.play();
        state.isPlaying = !state.isPlaying;
        updatePlayBtnUI();
    };

    DOM.playBtnLarge.addEventListener('click', togglePlay);
    DOM.miniPlayBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        togglePlay();
    });

    // Minimize/Maximize
    DOM.playerMini.addEventListener('click', () => {
        DOM.playerFull.classList.add('active');
    });
    document.getElementById('minimizeBtn').addEventListener('click', () => {
        DOM.playerFull.classList.remove('active');
    });

    // Seek
    DOM.progressBar.addEventListener('click', (e) => {
        const width = DOM.progressBar.clientWidth;
        const clickX = e.offsetX;
        const duration = DOM.audio.duration;
        DOM.audio.currentTime = (clickX / width) * duration;
    });

    // Volume
    DOM.volumeSlider.addEventListener('input', (e) => {
        DOM.audio.volume = e.target.value / 100;
        localStorage.setItem(API_CONFIG.DEFAULTS.STORAGE_KEYS.VOLUME, DOM.audio.volume);
    });
    
    // Download
    document.getElementById('downloadBtnLarge').addEventListener('click', () => {
       if(DOM.audio.src) window.open(DOM.audio.src, '_blank'); 
    });
}

