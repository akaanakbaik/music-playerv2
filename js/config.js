const API_CONFIG = {
    // API Endpoints
    URLS: {
        SEARCH: 'https://api.siputzx.my.id/api/s/youtube',
        DOWNLOAD_PRIMARY: 'https://api.nekolabs.web.id/downloader/youtube/v5',
        DOWNLOAD_BACKUP: 'https://api.nekolabs.web.id/downloader/youtube/v4'
    },
    // Konfigurasi Aplikasi
    DEFAULTS: {
        DEFAULT_SEARCH: 'top hits indonesia 2025',
        MAX_HISTORY: 20,
        MAX_QUEUE: 10,
        STORAGE_KEYS: {
            HISTORY: 'music_player_history',
            FAVORITES: 'music_player_favorites',
            VOLUME: 'music_player_volume',
            SETTINGS: 'music_player_settings'
        }
    }
};

const UTILS = {
    // Format durasi detik ke MM:SS
    formatTime: (seconds) => {
        if (!seconds || isNaN(seconds)) return '0:00';
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
    },

    // Format angka view (e.g. 1.2M)
    formatViews: (num) => {
        if (!num) return '0';
        num = parseInt(num.toString().replace(/\D/g, ''));
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
        return num.toString();
    },

    // Notifikasi Toast
    showToast: (message, type = 'info') => {
        const container = document.getElementById('notificationContainer');
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-triangle' : 'fa-info-circle'}"></i>
            <span>${message}</span>
        `;
        
        container.appendChild(toast);
        
        // Animasi in
        requestAnimationFrame(() => toast.classList.add('show'));
        
        // Hapus setelah 3 detik
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    },

    // Debounce untuk search input
    debounce: (func, wait) => {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }
};

