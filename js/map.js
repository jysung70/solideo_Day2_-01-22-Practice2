/**
 * Map Module - Leaflet.js Integration
 * Handles map initialization, markers, routes, and interactions
 */

const MapModule = (function() {
  let map = null;
  let markers = {
    departure: null,
    destination: null,
    places: []
  };
  let routeLayers = [];
  let currentRoute = null;

  // Custom marker icons
  const icons = {
    departure: L.icon({
      iconUrl: 'data:image/svg+xml;base64,' + btoa(`
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="36" height="36">
          <path fill="#2563eb" d="M12 0C7.31 0 3.5 3.81 3.5 8.5c0 6.14 7.5 13.97 8.15 14.56a.75.75 0 001.2 0C13.5 22.47 21 14.64 21 8.5 21 3.81 17.19 0 12 0zm0 12a3.5 3.5 0 110-7 3.5 3.5 0 010 7z"/>
        </svg>
      `),
      iconSize: [36, 36],
      iconAnchor: [18, 36],
      popupAnchor: [0, -36]
    }),
    destination: L.icon({
      iconUrl: 'data:image/svg+xml;base64,' + btoa(`
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="36" height="36">
          <path fill="#ef4444" d="M12 0C7.31 0 3.5 3.81 3.5 8.5c0 6.14 7.5 13.97 8.15 14.56a.75.75 0 001.2 0C13.5 22.47 21 14.64 21 8.5 21 3.81 17.19 0 12 0zm0 12a3.5 3.5 0 110-7 3.5 3.5 0 010 7z"/>
        </svg>
      `),
      iconSize: [36, 36],
      iconAnchor: [18, 36],
      popupAnchor: [0, -36]
    }),
    place: L.icon({
      iconUrl: 'data:image/svg+xml;base64,' + btoa(`
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="32" height="32">
          <path fill="#f59e0b" d="M12 0C7.31 0 3.5 3.81 3.5 8.5c0 6.14 7.5 13.97 8.15 14.56a.75.75 0 001.2 0C13.5 22.47 21 14.64 21 8.5 21 3.81 17.19 0 12 0zm0 12a3.5 3.5 0 110-7 3.5 3.5 0 010 7z"/>
        </svg>
      `),
      iconSize: [32, 32],
      iconAnchor: [16, 32],
      popupAnchor: [0, -32]
    })
  };

  /**
   * Initialize the map
   */
  function initMap() {
    if (map) return;

    // Create map centered on Seoul
    map = L.map('map').setView([37.5665, 126.9780], 13);

    // Add OpenStreetMap tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
      minZoom: 3
    }).addTo(map);

    // Add current location button handler
    setupCurrentLocationButton();

    console.log('Map initialized');
  }

  /**
   * Setup current location button
   */
  function setupCurrentLocationButton() {
    const btn = document.getElementById('currentLocationBtn');
    if (!btn) return;

    btn.addEventListener('click', () => {
      if (navigator.geolocation) {
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

        navigator.geolocation.getCurrentPosition(
          (position) => {
            const { latitude, longitude } = position.coords;
            map.setView([latitude, longitude], 15);

            // Add temporary marker
            const marker = L.marker([latitude, longitude], { icon: icons.place })
              .addTo(map)
              .bindPopup('현재 위치')
              .openPopup();

            setTimeout(() => map.removeLayer(marker), 3000);
            btn.innerHTML = '<i class="fas fa-location-crosshairs"></i>';
          },
          (error) => {
            console.error('Geolocation error:', error);
            alert('현재 위치를 가져올 수 없습니다.');
            btn.innerHTML = '<i class="fas fa-location-crosshairs"></i>';
          }
        );
      } else {
        alert('이 브라우저는 위치 정보를 지원하지 않습니다.');
      }
    });
  }

  /**
   * Add departure marker
   */
  function addDepartureMarker(lat, lng, name) {
    if (markers.departure) {
      map.removeLayer(markers.departure);
    }

    markers.departure = L.marker([lat, lng], { icon: icons.departure })
      .addTo(map)
      .bindPopup(`<b>출발지</b><br>${name}`);

    return markers.departure;
  }

  /**
   * Add destination marker
   */
  function addDestinationMarker(lat, lng, name) {
    if (markers.destination) {
      map.removeLayer(markers.destination);
    }

    markers.destination = L.marker([lat, lng], { icon: icons.destination })
      .addTo(map)
      .bindPopup(`<b>도착지</b><br>${name}`);

    return markers.destination;
  }

  /**
   * Add place marker
   */
  function addPlaceMarker(lat, lng, name, description, onClick) {
    const marker = L.marker([lat, lng], { icon: icons.place })
      .addTo(map)
      .bindPopup(`
        <div style="min-width: 200px;">
          <h4 style="margin: 0 0 0.5rem 0; color: #1f2937;">${name}</h4>
          <p style="margin: 0; color: #6b7280; font-size: 0.875rem;">${description}</p>
        </div>
      `);

    if (onClick) {
      marker.on('click', onClick);
    }

    markers.places.push(marker);
    return marker;
  }

  /**
   * Clear all place markers
   */
  function clearPlaceMarkers() {
    markers.places.forEach(marker => map.removeLayer(marker));
    markers.places = [];
  }

  /**
   * Clear all markers
   */
  function clearAllMarkers() {
    if (markers.departure) map.removeLayer(markers.departure);
    if (markers.destination) map.removeLayer(markers.destination);
    clearPlaceMarkers();

    markers.departure = null;
    markers.destination = null;
  }

  /**
   * Draw route on map
   */
  function drawRoute(coordinates, options = {}) {
    const {
      color = '#2563eb',
      weight = 5,
      opacity = 0.7,
      popup = null
    } = options;

    // Convert coordinates to Leaflet format [lat, lng]
    const latLngs = coordinates.map(coord => [coord[1], coord[0]]);

    const polyline = L.polyline(latLngs, {
      color,
      weight,
      opacity,
      smoothFactor: 1
    }).addTo(map);

    if (popup) {
      polyline.bindPopup(popup);
    }

    routeLayers.push(polyline);
    return polyline;
  }

  /**
   * Clear all routes
   */
  function clearRoutes() {
    routeLayers.forEach(layer => map.removeLayer(layer));
    routeLayers = [];
  }

  /**
   * Fit map to bounds
   */
  function fitBounds(coordinates) {
    if (!coordinates || coordinates.length === 0) return;

    // Convert to Leaflet format and create bounds
    const latLngs = coordinates.map(coord => [coord[1], coord[0]]);
    const bounds = L.latLngBounds(latLngs);

    map.fitBounds(bounds, {
      padding: [50, 50],
      maxZoom: 15
    });
  }

  /**
   * Fit map to show departure and destination
   */
  function fitToMarkers() {
    const bounds = L.latLngBounds([]);

    if (markers.departure) {
      bounds.extend(markers.departure.getLatLng());
    }
    if (markers.destination) {
      bounds.extend(markers.destination.getLatLng());
    }

    if (bounds.isValid()) {
      map.fitBounds(bounds, {
        padding: [100, 100],
        maxZoom: 13
      });
    }
  }

  /**
   * Highlight a specific route
   */
  function highlightRoute(routeIndex) {
    routeLayers.forEach((layer, index) => {
      if (index === routeIndex) {
        layer.setStyle({
          color: '#10b981',
          weight: 6,
          opacity: 0.9
        });
        layer.bringToFront();
      } else {
        layer.setStyle({
          color: '#9ca3af',
          weight: 4,
          opacity: 0.5
        });
      }
    });
  }

  /**
   * Reset all route styles
   */
  function resetRouteStyles() {
    routeLayers.forEach(layer => {
      layer.setStyle({
        color: '#2563eb',
        weight: 5,
        opacity: 0.7
      });
    });
  }

  /**
   * Set map view
   */
  function setView(lat, lng, zoom = 13) {
    if (map) {
      map.setView([lat, lng], zoom);
    }
  }

  /**
   * Clear everything
   */
  function clearAll() {
    clearAllMarkers();
    clearRoutes();
    currentRoute = null;
  }

  /**
   * Get map instance
   */
  function getMap() {
    return map;
  }

  /**
   * Draw multiple routes with different colors
   */
  function drawMultipleRoutes(routes) {
    clearRoutes();

    const colors = ['#2563eb', '#7c3aed', '#10b981'];

    routes.forEach((route, index) => {
      if (route.coordinates && route.coordinates.length > 0) {
        drawRoute(route.coordinates, {
          color: colors[index % colors.length],
          weight: 5,
          opacity: 0.7,
          popup: `<b>${route.type || '경로'}</b><br>
                  거리: ${route.distance}km<br>
                  시간: ${route.duration}`
        });
      }
    });

    // Fit bounds to show all routes
    if (routes.length > 0 && routes[0].coordinates) {
      const allCoords = routes.reduce((acc, route) => {
        return acc.concat(route.coordinates);
      }, []);
      fitBounds(allCoords);
    }
  }

  /**
   * Get center of map
   */
  function getCenter() {
    return map ? map.getCenter() : null;
  }

  /**
   * Get current zoom level
   */
  function getZoom() {
    return map ? map.getZoom() : null;
  }

  // Public API
  return {
    init: initMap,
    addDepartureMarker,
    addDestinationMarker,
    addPlaceMarker,
    clearPlaceMarkers,
    clearAllMarkers,
    drawRoute,
    clearRoutes,
    fitBounds,
    fitToMarkers,
    highlightRoute,
    resetRouteStyles,
    setView,
    clearAll,
    getMap,
    drawMultipleRoutes,
    getCenter,
    getZoom
  };
})();

// Initialize map when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    MapModule.init();
  });
} else {
  MapModule.init();
}
