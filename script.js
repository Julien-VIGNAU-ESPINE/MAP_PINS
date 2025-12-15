/**
 * MAP PINS 2.0 - Core Logic
 * Structure:
 * - DataManager: Firebase & Data State
 * - MapManager: Leaflet Map & Markers
 * - UIManager: Modal, Buttons, Filters
 * - App: Coordinator
 */

// ==========================================
// CONFIGURATION
// ==========================================
// Copie de ton objet config (sécurisé)
const firebaseConfig = {
    apiKey: "AIzaSyAwTF5Gg7CtH-gC5wbuAwHYieA5s0o-lzA",
    authDomain: "mappins-e290e.firebaseapp.com",
    projectId: "mappins-e290e",
    storageBucket: "mappins-e290e.firebasestorage.app",
    messagingSenderId: "233894828655",
    appId: "1:233894828655:web:a2319daa2343d178e9cb9a",
    measurementId: "G-W8LGBXGSR6"
};

const COLORS = {
    restaurant: '#6366f1', // Indigo
    bar: '#ec4899', // Pink
    'tourist-site': '#10b981', // Emerald
    '18': '#ef4444', // Red
    other: '#f59e0b' // Amber
};

// ==========================================
// 1. DATA MANAGER
// ==========================================
class DataManager {
    constructor() {
        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
        }
        this.db = firebase.firestore();
        this.collection = this.db.collection('lieux');
        this.pins = [];
    }

    async loadPins() {
        console.log("Loading pins from Firebase...");
        try {
            const snapshot = await this.collection.get();
            console.log("Snapshot received, size:", snapshot.size);
            this.pins = [];
            snapshot.forEach(doc => {
                this.pins.push({ id: doc.id, ...doc.data() });
            });
            this.pins.sort((a, b) => new Date(b.date) - new Date(a.date)); // Plus récent d'abord
            console.log("Pins loaded:", this.pins);
            return this.pins;
        } catch (error) {
            console.error("Error loading pins:", error);
            return [];
        }
    }

    async addPin(pinData) {
        try {
            const docRef = await this.collection.add(pinData);
            const newPin = { id: docRef.id, ...pinData };
            this.pins.push(newPin);
            return newPin;
        } catch (error) {
            console.error("Error adding pin:", error);
            throw error;
        }
    }

    getFilteredPins(type) {
        if (type === 'all') return this.pins;
        return this.pins.filter(pin => pin.type === type);
    }
}

// ==========================================
// 2. MAP MANAGER
// ==========================================
class MapManager {
    constructor(mapId, onMapClick) {
        this.map = L.map(mapId).setView([48.8566, 2.3522], 13);
        this.markersLayer = L.layerGroup().addTo(this.map);
        this.tempLayer = L.layerGroup().addTo(this.map);
        this.onMapClick = onMapClick;

        this.initMap();
    }

    initMap() {
        // Fond de carte Liquid (CartoDB Voyager - Clair et Doux)
        L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; CARTO',
            subdomains: 'abcd',
            maxZoom: 20
        }).addTo(this.map);

        this.map.on('click', (e) => {
            this.onMapClick(e.latlng);
        });
    }

    displayPins(pins) {
        this.markersLayer.clearLayers();

        pins.forEach(pin => {
            const color = COLORS[pin.type] || COLORS.other;

            // Marker personnalisé
            const markerHtml = `
                <div style="
                    background-color: ${color};
                    width: 20px;
                    height: 20px;
                    border-radius: 50%;
                    border: 3px solid white;
                    box-shadow: 0 4px 6px rgba(0,0,0,0.3);
                "></div>
            `;

            const icon = L.divIcon({
                className: 'custom-pin',
                html: markerHtml,
                iconSize: [24, 24],
                iconAnchor: [12, 12]
            });

            const marker = L.marker([pin.lat, pin.lon], { icon }).addTo(this.markersLayer);

            marker.bindPopup(`
                <div style="font-family: 'Inter', sans-serif;">
                    <strong style="color: ${color}; font-size: 1.1em;">${pin.name}</strong><br>
                    <span style="color: #64748b; font-size: 0.9em;">${pin.type} · ${pin.date}</span>
                    <p style="margin: 8px 0 0; color: #334155;">${pin.description}</p>
                </div>
            `);
        });
    }

    setTempMarker(latlng) {
        this.tempLayer.clearLayers();
        L.circleMarker(latlng, {
            radius: 8,
            fillColor: '#ef4444',
            color: '#fff',
            weight: 2,
            opacity: 1,
            fillOpacity: 0.8
        }).addTo(this.tempLayer);

        // Animation de zoom sur le point
        this.map.flyTo(latlng, this.map.getZoom());
    }

    clearTempMarker() {
        this.tempLayer.clearLayers();
    }
}

// ==========================================
// 3. UI MANAGER
// ==========================================
class UIManager {
    constructor(callbacks) {
        this.callbacks = callbacks; // { onSubmit, onFilter }

        // Elements
        this.modal = document.getElementById('modal-backdrop');
        this.form = document.getElementById('pinForm');
        this.addBtn = document.getElementById('add-pin-btn');
        this.cancelBtn = document.getElementById('cancelButton');
        this.filters = document.querySelectorAll('.filter-chip');

        this.initListeners();
    }

    initListeners() {
        // FAB Button logic (Toggle mode ajout ?)
        // Pour l'instant, le FAB sert à focaliser sur l'ajout manuel ou géoloc
        this.addBtn.addEventListener('click', () => {
            alert('Cliquez sur la carte pour ajouter un lieu !');
        });

        // Fermeture modal
        this.cancelBtn.addEventListener('click', () => this.closeModal());

        // Soumission
        this.form.addEventListener('submit', (e) => {
            e.preventDefault();
            const data = {
                name: document.getElementById('name').value,
                type: document.getElementById('type').value,
                date: document.getElementById('date').value,
                description: document.getElementById('description').value
            };
            this.callbacks.onSubmit(data);
        });

        // Filtres
        this.filters.forEach(btn => {
            btn.addEventListener('click', () => {
                // Update active state
                this.filters.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                const type = btn.getAttribute('data-type');
                this.callbacks.onFilter(type);
            });
        });
    }

    openModal() {
        this.modal.classList.remove('hidden');
    }

    closeModal() {
        this.modal.classList.add('hidden');
        this.form.reset();
        this.callbacks.onCancel(); // Pour nettoyer la map
    }
}

// ==========================================
// 4. SIDEBAR MANAGER POWER UP 🚀
// ==========================================
class SidebarManager {
    constructor(callbacks) {
        this.callbacks = callbacks; // { onPinClick, onExport, onOpenDashboard, onFilterCategory }

        // Elements
        this.sidebar = document.getElementById('sidebar');
        this.menuBtn = document.getElementById('menu-btn');
        this.closeBtn = document.getElementById('close-sidebar-btn');
        this.listContainer = document.getElementById('pins-list');
        this.searchInput = document.getElementById('search-input');
        this.statsContainer = document.getElementById('mini-stats');

        // Buttons actions
        this.btnExport = document.getElementById('btn-export');
        this.btnDashboard = document.getElementById('btn-dashboard');

        // Filter Chips
        this.chipsContainer = document.getElementById('category-filters');

        this.pins = [];
        this.activeCategory = 'all'; // 'all' or category name
        this.initListeners();
    }

    initListeners() {
        this.menuBtn.addEventListener('click', () => this.toggle(true));
        this.closeBtn.addEventListener('click', () => this.toggle(false));

        this.searchInput.addEventListener('input', (e) => {
            this.filterPins(e.target.value);
        });

        this.btnExport.addEventListener('click', () => this.callbacks.onExport());
        this.btnDashboard.addEventListener('click', () => this.callbacks.onOpenDashboard());

        // Chip Clicks handled via delegation or re-render
    }

    toggle(open) {
        if (open) {
            this.sidebar.classList.remove('closed');
        } else {
            this.sidebar.classList.add('closed');
        }
    }

    update(pins) {
        this.pins = pins;
        this.renderChips();
        this.applyFilters();
        this.updateStats(pins);
    }

    renderChips() {
        if (!this.chipsContainer) return;

        // Get unique categories
        const categories = ['all', ...new Set(this.pins.map(p => p.type))];

        this.chipsContainer.innerHTML = '';
        categories.forEach(cat => {
            const btn = document.createElement('button');
            const label = cat === 'all' ? 'Tout' : (cat.charAt(0).toUpperCase() + cat.slice(1));
            btn.className = `filter-chip ${this.activeCategory === cat ? 'active' : ''}`;
            btn.innerText = label;

            btn.addEventListener('click', () => {
                this.activeCategory = cat;
                this.renderChips(); // Re-render to update active class
                this.applyFilters();
            });
            this.chipsContainer.appendChild(btn);
        });
    }

    applyFilters() {
        const query = this.searchInput.value.toLowerCase();
        let filtered = this.pins;

        // 1. Filter by Category
        if (this.activeCategory !== 'all') {
            filtered = filtered.filter(p => p.type === this.activeCategory);
        }

        // 2. Filter by Search
        if (query) {
            filtered = filtered.filter(pin =>
                pin.name.toLowerCase().includes(query) ||
                pin.description.toLowerCase().includes(query)
            );
        }

        this.renderList(filtered);
        this.callbacks.onFilterCategory(filtered);
    }

    filterPins(query) {
        this.applyFilters();
    }

    renderList(pinsToRender) {
        this.listContainer.innerHTML = '';

        if (pinsToRender.length === 0) {
            this.listContainer.innerHTML = '<div class="empty-state">Aucun lieu trouvé 🍃</div>';
            return;
        }

        const grouped = this.groupByDate(pinsToRender);

        Object.keys(grouped).forEach(key => {
            const header = document.createElement('div');
            header.className = 'list-group-header';
            header.innerText = key;
            this.listContainer.appendChild(header);

            grouped[key].forEach(pin => {
                const card = this.createPinCard(pin);
                this.listContainer.appendChild(card);
            });
        });
    }

    createPinCard(pin) {
        const card = document.createElement('div');
        card.className = 'pin-card';
        const color = COLORS[pin.type] || COLORS.other;

        card.innerHTML = `
            <div class="pin-card-header">
                <span class="pin-name">${pin.name}</span>
                <span class="pin-type-dot" style="background-color: ${color};"></span>
            </div>
            <div class="pin-meta">
                <span>${new Date(pin.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</span>
                <span>${pin.type}</span>
            </div>
        `;

        card.addEventListener('click', () => {
            this.callbacks.onPinClick(pin);
            if (window.innerWidth < 768) this.toggle(false);
        });
        return card;
    }

    groupByDate(pins) {
        const groups = {};
        pins.forEach(pin => {
            const date = new Date(pin.date);
            const key = date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
            const formattedKey = key.charAt(0).toUpperCase() + key.slice(1);
            if (!groups[formattedKey]) groups[formattedKey] = [];
            groups[formattedKey].push(pin);
        });
        return groups;
    }

    updateStats(pins) {
        const total = pins.length;
        if (total === 0) {
            this.statsContainer.innerHTML = `<span>0 lieux</span>`;
            return;
        }
        const counts = {};
        pins.forEach(p => counts[p.type] = (counts[p.type] || 0) + 1);
        const topType = Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b);

        this.statsContainer.innerHTML = `
            <span>✨ ${total} Lieux</span>
            <span style="margin-left: 8px; opacity: 0.7;">| ${topType}</span>
        `;
    }
}

// ==========================================
// 5. ANALYTICS MANAGER (CHART.JS)
// ==========================================
class AnalyticsManager {
    constructor() {
        this.overlay = document.getElementById('dashboard-overlay');
        this.closeBtn = document.getElementById('close-dashboard');

        this.ctxCategories = document.getElementById('chart-categories').getContext('2d');
        this.ctxTimeline = document.getElementById('chart-timeline').getContext('2d');
        this.ctxDays = document.getElementById('chart-days').getContext('2d');

        this.charts = {};

        // CHART JS LIGHT MODE DEFAULTS
        Chart.defaults.color = '#64748b'; // slate-500
        Chart.defaults.borderColor = '#e2e8f0'; // slate-200
        Chart.defaults.font.family = "'Inter', sans-serif";

        this.closeBtn.addEventListener('click', () => this.close());
    }

    open(pins) {
        this.overlay.classList.remove('hidden');
        this.renderCharts(pins);
    }

    close() {
        this.overlay.classList.add('hidden');
    }

    renderCharts(pins) {
        const categoryData = this.getCategoryData(pins);
        const timelineData = this.getTimelineData(pins);
        const daysData = this.getDaysData(pins);

        this.createOrUpdateChart('categories', this.ctxCategories, 'doughnut', categoryData, {
            plugins: { legend: { position: 'right' } }
        });

        this.createOrUpdateChart('timeline', this.ctxTimeline, 'bar', timelineData, {
            scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
        });

        this.createOrUpdateChart('days', this.ctxDays, 'polarArea', daysData, {
            scales: { r: { ticks: { display: false } } }
        });
    }

    createOrUpdateChart(key, ctx, type, data, options = {}) {
        if (this.charts[key]) {
            this.charts[key].destroy();
        }
        this.charts[key] = new Chart(ctx, {
            type: type,
            data: data,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                ...options
            }
        });
    }

    getCategoryData(pins) {
        const counts = {};
        pins.forEach(p => counts[p.type] = (counts[p.type] || 0) + 1);

        return {
            labels: Object.keys(counts),
            datasets: [{
                data: Object.values(counts),
                backgroundColor: Object.keys(counts).map(k => COLORS[k] || COLORS.other),
                borderWidth: 2,
                borderColor: '#ffffff'
            }]
        };
    }

    getTimelineData(pins) {
        const months = {};
        pins.forEach(p => {
            const d = new Date(p.date);
            const key = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`;
            months[key] = (months[key] || 0) + 1;
        });

        const sortedKeys = Object.keys(months).sort();

        return {
            labels: sortedKeys,
            datasets: [{
                label: 'Visites par Mois',
                data: sortedKeys.map(k => months[k]),
                backgroundColor: '#3b82f688', // Transparent blue
                borderColor: '#3b82f6',
                borderWidth: 1,
                borderRadius: 8
            }]
        };
    }

    getDaysData(pins) {
        const days = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
        const counts = new Array(7).fill(0);

        pins.forEach(p => {
            const dayIndex = new Date(p.date).getDay();
            counts[dayIndex]++;
        });

        return {
            labels: days,
            datasets: [{
                label: 'Jours préférés',
                data: counts,
                backgroundColor: [
                    'rgba(255, 99, 132, 0.5)',
                    'rgba(54, 162, 235, 0.5)',
                    'rgba(255, 206, 86, 0.5)',
                    'rgba(75, 192, 192, 0.5)',
                    'rgba(153, 102, 255, 0.5)',
                    'rgba(255, 159, 64, 0.5)',
                    'rgba(201, 203, 207, 0.5)'
                ],
                borderWidth: 1
            }]
        };
    }
}


// ==========================================
// 6. MAIN APP
// ==========================================
class App {
    constructor() {
        this.dataManager = new DataManager();
        this.mapManager = new MapManager('map', (latlng) => this.handleMapClick(latlng));

        this.uiManager = new UIManager({
            onSubmit: (data) => this.handleFormSubmit(data),
            onFilter: (type) => this.handleFilter(type), // Legacy modal filter
            onCancel: () => this.currentLatLng = null
        });

        this.analyticsManager = new AnalyticsManager();

        this.sidebarManager = new SidebarManager({
            onPinClick: (pin) => this.handleSidebarClick(pin),
            onExport: () => this.exportData(),
            onOpenDashboard: () => this.openDashboard(),
            onFilterCategory: (filteredPins) => this.handleCategoryFilter(filteredPins)
        });

        this.currentLatLng = null;

        this.init();
    }

    async init() {
        const pins = await this.dataManager.loadPins();
        this.mapManager.displayPins(pins);
        this.sidebarManager.update(pins); // Initialise la sidebar
        // No dashboard open by default
    }

    handleMapClick(latlng) {
        this.currentLatLng = latlng;
        this.mapManager.setTempMarker(latlng);
        this.uiManager.openModal();
    }

    handleSidebarClick(pin) {
        this.mapManager.map.flyTo([pin.lat, pin.lon], 16, {
            animate: true,
            duration: 1.5
        });
    }

    exportData() {
        const dataStr = JSON.stringify(this.dataManager.pins, null, 2);
        const blob = new Blob([dataStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `mappins_backup_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }

    openDashboard() {
        // Pass current pins to dashboard
        this.analyticsManager.open(this.dataManager.getFilteredPins('all'));
    }

    async handleFormSubmit(formData) {
        if (!this.currentLatLng) return;

        const newPin = {
            ...formData,
            lat: this.currentLatLng.lat,
            lon: this.currentLatLng.lng
        };

        await this.dataManager.addPin(newPin);

        // Refresh everything
        this.mapManager.clearTempMarker();
        this.uiManager.closeModal();

        const allPins = this.dataManager.getFilteredPins('all');
        this.mapManager.displayPins(allPins);
        this.sidebarManager.update(allPins);

        this.currentLatLng = null;
    }

    handleFilter(type) {
        const filtered = this.dataManager.getFilteredPins(type);
        this.mapManager.displayPins(filtered);
        this.sidebarManager.renderList(filtered);
    }

    handleCategoryFilter(filteredPins) {
        this.mapManager.displayPins(filteredPins);
    }
}

// Start App
document.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
});