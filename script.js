// ===================================================================
// ÉTAPE 1: CONFIGURATION DE FIREBASE
// ===================================================================

// REMPLACE CECI PAR TES NOUVELLES CLÉS (après les avoir régénérées!)
const firebaseConfig = {
    apiKey: "TES_NOUVELLES_INFOS_ICI",
    authDomain: "TES_NOUVELLES_INFOS_ICI",
    projectId: "TES_NOUVELLES_INFOS_ICI",
    storageBucket: "TES_NOUVELLES_INFOS_ICI",
    messagingSenderId: "TES_NOUVELLES_INFOS_ICI",
    appId: "TES_NOUVELLES_INFOS_ICI"
};

// Initialise Firebase (Version 8)
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const lieuxCollection = db.collection('lieux'); 

// ===================================================================
// ÉTAPE 2: VARIABLES GLOBALES ET INITIALISATION
// ===================================================================

// Références aux éléments du DOM
const form = document.getElementById('pinForm');
const formContainer = document.getElementById('form-container');
const cancelButton = document.getElementById('cancelButton');
const showAllButton = document.getElementById('show-all');

// Initialise la carte (fond de carte clair)
const map = L.map('map').setView([48.8566, 2.3522], 5); // Centre sur Paris
L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', { 
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, &copy; <a href="https://carto.com/">CARTO</a>',
}).addTo(map);

// Couleurs
const colorMap = {
    restaurant: '#780096',
    bar: '#2300eb',
    'tourist-site': '#db0202',
    other: '#e9c600',
    '18': '#e70074'
};

// Variables d'état
let allPins = []; // Un cache local pour tous les pins de la BDD
let currentLatLon = null;
let tempMarker = null;

// ===================================================================
// ÉTAPE 3: LOGIQUE D'AFFICHAGE DES PINS
// ===================================================================

// Affiche une liste de pins sur la carte
function displayPins(pinsToDisplay) {
    // Vider la carte avant de redessiner
    map.eachLayer(function (layer) {
        if (layer instanceof L.CircleMarker) {
            map.removeLayer(layer);
        }
    });

    pinsToDisplay.forEach(pin => {
        const color = colorMap[pin.type] || colorMap['other'];
        
        const marker = L.circleMarker([pin.lat, pin.lon], {
            radius: 10,
            fillColor: color,
            color: color,
            weight: 1,
            opacity: 1,
            fillOpacity: 0.9
        }).addTo(map);

        // Pop-up
        marker.bindPopup(`
            <b>${pin.name}</b><br>
            Date: ${pin.date}<br>
            Type: ${pin.type}<br>
            Description: ${pin.description}<br>
        `);
    });
}

// Charger les pins initiaux depuis Firebase
async function loadPinsFromFirebase() {
    try {
        const snapshot = await lieuxCollection.get();
        
        allPins = []; // Réinitialise le cache local
        snapshot.forEach(doc => {
            const data = doc.data();
            data.id = doc.id; 
            allPins.push(data);
        });

        // Trier par date
        allPins.sort((a, b) => new Date(a.date) - new Date(b.date));
        
        // Afficher tous les pins chargés
        displayPins(allPins);
        console.log("Pins chargés depuis Firebase !", allPins.length);
        
    } catch (error) {
        console.error("Erreur lors du chargement des pins: ", error);
    }
}

// ===================================================================
// ÉTAPE 4: GESTION DU FORMULAIRE ET DES CLICS
// ===================================================================

// Au clic sur la carte
map.on('click', function (e) {
    // N'ouvre pas le formulaire si on clique sur un marqueur
    if (e.originalEvent.target.classList.contains('leaflet-interactive')) {
        return;
    }

    currentLatLon = e.latlng;

    // Supprime l'ancien marqueur temporaire
    if (tempMarker) {
        map.removeLayer(tempMarker);
    }

    // Crée un marqueur temporaire
    tempMarker = L.circleMarker(currentLatLon, {
        radius: 8,
        fillColor: '#FF6347', // Couleur "temporaire"
        color: '#FF6347',
        weight: 1,
        opacity: 1,
        fillOpacity: 0.7
    }).addTo(map);

    // Affiche le formulaire
    formContainer.classList.remove('hidden');
    
    // Réinitialise les champs
    form.reset();
});

// Soumission du formulaire (logique Firebase)
form.addEventListener('submit', async (e) => {
    e.preventDefault(); 

    if (!currentLatLon) {
        alert('Erreur : emplacement non défini.');
        return;
    }

    // Crée l'objet "pin"
    const newPin = {
        name: document.getElementById('name').value,
        type: document.getElementById('type').value,
        description: document.getElementById('description').value,
        date: document.getElementById('date').value,
        lat: currentLatLon.lat,
        lon: currentLatLon.lng 
    };

    try {
        // === ENVOI À FIREBASE ===
        const docRef = await lieuxCollection.add(newPin);
        console.log("Pin enregistré dans Firebase avec l'ID: ", docRef.id);

        allPins.push(newPin);
        displayPins(allPins);
        cacherFormulaire();

    } catch (error) {
        console.error("Erreur lors de l'ajout à Firebase: ", error);
        alert("Une erreur est survenue lors de l'enregistrement.");
    }
});

// Clic sur le bouton "Annuler"
cancelButton.addEventListener('click', () => {
    cacherFormulaire();
});

function cacherFormulaire() {
    formContainer.classList.add('hidden');
    currentLatLon = null;
    if (tempMarker) {
        map.removeLayer(tempMarker);
        tempMarker = null;
    }
}

// ===================================================================
// ÉTAPE 5: GESTION DES FILTRES ET DU VOLET
// ===================================================================

// --- GESTION DU VOLET DE LÉGENDE ---
const legendContainer = document.getElementById('legend-container');
const legendHandle = document.getElementById('legend-handle');

// Ferme le volet par défaut au chargement
legendContainer.classList.add('closed');

// Ajoute l'événement de clic sur la poignée
legendHandle.addEventListener('click', () => {
    legendContainer.classList.toggle('closed');
});
// --- FIN DU BLOC VOLET ---


// Fonctions de filtre
function filterPinsByType(type) {
    const filteredPins = allPins.filter(pin => pin.type === type);
    displayPins(filteredPins);
}

function showAllPins() {
    displayPins(allPins);
}

// Écoute les clics sur les catégories (dans le bon conteneur)
document.querySelectorAll('#legend-content div[data-type]').forEach(element => {
    element.addEventListener('click', () => {
        const type = element.getAttribute('data-type');
        filterPinsByType(type);
    });
});

// Écoute le clic sur "Tout"
showAllButton.addEventListener('click', () => {
    showAllPins();
});


// ===================================================================
// ÉTAPE 6: DÉMARRAGE
// ===================================================================

// Charge les pins depuis Firebase au lancement
loadPinsFromFirebase();