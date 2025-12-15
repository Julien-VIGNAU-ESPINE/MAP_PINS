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
        try {
            const snapshot = await this.collection.get();
            this.pins = [];
            snapshot.forEach(doc => {
                this.pins.push({ id: doc.id, ...doc.data() });
            });
            this.pins.sort((a, b) => new Date(b.date) - new Date(a.date)); // Plus récent d'abord
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
        // Fond de carte clair et moderne (CartoDB Voyager)
        L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>',
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
// 4. MAIN APP
// ==========================================
class App {
    constructor() {
        this.dataManager = new DataManager();
        this.mapManager = new MapManager('map', (latlng) => this.handleMapClick(latlng));
        this.uiManager = new UIManager({
            onSubmit: (data) => this.handleFormSubmit(data),
            onFilter: (type) => this.handleFilter(type),
            onCancel: () => this.currentLatLng = null
        });

        this.currentLatLng = null; // Position temporaire pour le nouveau pin

        this.init();
    }

    async init() {
        const pins = await this.dataManager.loadPins();
        this.mapManager.displayPins(pins);
    }

    handleMapClick(latlng) {
        this.currentLatLng = latlng;
        this.mapManager.setTempMarker(latlng);
        this.uiManager.openModal();
    }

    async handleFormSubmit(formData) {
        if (!this.currentLatLng) return;

        const newPin = {
            ...formData,
            lat: this.currentLatLng.lat,
            lon: this.currentLatLng.lng
        };

        await this.dataManager.addPin(newPin);

        // Refresh
        this.mapManager.clearTempMarker();
        this.uiManager.closeModal();

        // On force le filtre sur 'all' ou on recharge juste la vue actuelle
        // Pour faire simple, on recharge 'all' pour voir le nouveau pin
        const allPins = this.dataManager.getFilteredPins('all');
        this.mapManager.displayPins(allPins);

        // Reset state
        this.currentLatLng = null;
    }

    handleFilter(type) {
        const filtered = this.dataManager.getFilteredPins(type);
        this.mapManager.displayPins(filtered);
    }
}

// Start App
document.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
});