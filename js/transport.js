/**
 * Transport Module - Route Calculation and Address Search
 * Uses OpenRouteService API and Nominatim API
 */

const TransportModule = (function() {
  // API Configuration
  // Note: For production, get your own API key from https://openrouteservice.org/dev/#/signup
  const ORS_API_KEY = '5b3ce3597851110001cf6248c54b066cf58b4e9eb89ba8ce2fad7cfa';
  const ORS_BASE_URL = 'https://api.openrouteservice.org';
  const NOMINATIM_URL = 'https://nominatim.openstreetmap.org';

  // Rate limiting
  let lastNominatimRequest = 0;
  const NOMINATIM_DELAY = 1000; // 1 second between requests

  /**
   * Search address using Nominatim API
   * @param {string} query - Search query
   * @returns {Promise<Array>} - Array of results
   */
  async function searchAddress(query) {
    if (!query || query.length < 3) return [];

    // Rate limiting for Nominatim
    const now = Date.now();
    const timeSinceLastRequest = now - lastNominatimRequest;
    if (timeSinceLastRequest < NOMINATIM_DELAY) {
      await new Promise(resolve => setTimeout(resolve, NOMINATIM_DELAY - timeSinceLastRequest));
    }
    lastNominatimRequest = Date.now();

    try {
      const url = `${NOMINATIM_URL}/search?` + new URLSearchParams({
        q: query,
        format: 'json',
        limit: '5',
        addressdetails: '1'
      });

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'TravelPlannerApp/1.0'
        }
      });

      if (!response.ok) {
        throw new Error(`Nominatim API error: ${response.status}`);
      }

      const data = await response.json();

      return data.map(item => ({
        name: item.display_name,
        lat: parseFloat(item.lat),
        lng: parseFloat(item.lon),
        type: item.type,
        address: item.address
      }));
    } catch (error) {
      console.error('Address search error:', error);
      return [];
    }
  }

  /**
   * Get route between two points using OpenRouteService
   * @param {Array} start - [lng, lat]
   * @param {Array} end - [lng, lat]
   * @param {string} profile - Route profile (driving-car, foot-walking, cycling-regular)
   * @returns {Promise<Object>} - Route data
   */
  async function getRoute(start, end, profile = 'driving-car') {
    try {
      const url = `${ORS_BASE_URL}/v2/directions/${profile}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': ORS_API_KEY,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          coordinates: [start, end],
          instructions: true,
          elevation: false
        })
      });

      if (!response.ok) {
        throw new Error(`OpenRouteService API error: ${response.status}`);
      }

      const data = await response.json();

      if (!data.routes || data.routes.length === 0) {
        throw new Error('No route found');
      }

      const route = data.routes[0];
      const summary = route.summary;

      return {
        coordinates: route.geometry.coordinates,
        distance: (summary.distance / 1000).toFixed(2), // km
        duration: formatDuration(summary.duration), // formatted time
        durationMinutes: Math.round(summary.duration / 60),
        instructions: route.segments[0].steps.map(step => ({
          instruction: step.instruction,
          distance: (step.distance / 1000).toFixed(2),
          duration: Math.round(step.duration / 60)
        })),
        profile: profile
      };
    } catch (error) {
      console.error('Route calculation error:', error);
      throw error;
    }
  }

  /**
   * Get multiple routes with different profiles
   * @param {Array} start - [lng, lat]
   * @param {Array} end - [lng, lat]
   * @returns {Promise<Array>} - Array of routes
   */
  async function getMultipleRoutes(start, end) {
    try {
      // Calculate routes for different modes
      const profiles = [
        { profile: 'driving-car', name: '자동차', icon: 'fa-car', speed: 60 },
        { profile: 'foot-walking', name: '도보', icon: 'fa-person-walking', speed: 5 },
        { profile: 'cycling-regular', name: '자전거', icon: 'fa-bicycle', speed: 15 }
      ];

      const routePromises = profiles.map(async ({ profile, name, icon, speed }) => {
        try {
          const route = await getRoute(start, end, profile);
          return {
            ...route,
            name,
            icon,
            type: getRouteType(route)
          };
        } catch (error) {
          console.error(`Error getting ${name} route:`, error);
          // Fallback: Create estimated route based on straight-line distance
          const fallbackRoute = createFallbackRoute(start, end, name, icon, profile, speed);
          console.log(`Using fallback route for ${name}`);
          return fallbackRoute;
        }
      });

      const routes = await Promise.all(routePromises);
      const validRoutes = routes.filter(route => route !== null);

      // If no valid routes, throw error
      if (validRoutes.length === 0) {
        throw new Error('No routes could be calculated');
      }

      return validRoutes;
    } catch (error) {
      console.error('Multiple routes error:', error);
      throw error;
    }
  }

  /**
   * Create fallback route based on straight-line distance
   * @param {Array} start - [lng, lat]
   * @param {Array} end - [lng, lat]
   * @param {string} name - Route name
   * @param {string} icon - Icon class
   * @param {string} profile - Profile type
   * @param {number} speed - Average speed in km/h
   * @returns {Object} - Fallback route
   */
  function createFallbackRoute(start, end, name, icon, profile, speed) {
    // Calculate straight-line distance
    const distance = calculateDistance(end[1], end[0], start[1], start[0]);

    // Estimate actual travel distance (multiply by 1.3 for roads)
    const travelDistance = distance * 1.3;

    // Calculate duration based on speed
    const durationMinutes = Math.round((travelDistance / speed) * 60);

    // Create simple straight-line coordinates
    const coordinates = [start, end];

    return {
      coordinates: coordinates,
      distance: travelDistance.toFixed(2),
      duration: formatDuration(durationMinutes * 60),
      durationMinutes: durationMinutes,
      instructions: [{
        instruction: `${name}(으)로 이동`,
        distance: travelDistance.toFixed(2),
        duration: durationMinutes
      }],
      profile: profile,
      name: name,
      icon: icon,
      type: getRouteType({ distance: travelDistance.toFixed(2), durationMinutes }),
      isFallback: true
    };
  }

  /**
   * Determine route type (fastest, cheapest, balanced)
   * @param {Object} route - Route object
   * @returns {string} - Route type
   */
  function getRouteType(route) {
    const distance = parseFloat(route.distance);
    const duration = route.durationMinutes;

    // Simple heuristic
    if (duration < 60) return 'fastest';
    if (distance < 10) return 'cheapest';
    return 'balanced';
  }

  /**
   * Calculate estimated cost for a route
   * @param {Object} route - Route object
   * @returns {Object} - Cost breakdown
   */
  function calculateRouteCost(route) {
    const distance = parseFloat(route.distance);
    let transportCost = 0;

    // Cost estimation based on profile
    switch (route.profile) {
      case 'driving-car':
        // Fuel cost: ~150 KRW per km
        transportCost = Math.round(distance * 150);
        break;
      case 'foot-walking':
        transportCost = 0;
        break;
      case 'cycling-regular':
        transportCost = 0;
        break;
      default:
        // Public transport estimation: ~1000 KRW per 10km
        transportCost = Math.round((distance / 10) * 1000);
    }

    return {
      transport: transportCost,
      distance: distance
    };
  }

  /**
   * Format duration from seconds to human readable
   * @param {number} seconds - Duration in seconds
   * @returns {string} - Formatted duration
   */
  function formatDuration(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (hours > 0) {
      return `${hours}시간 ${minutes}분`;
    }
    return `${minutes}분`;
  }

  /**
   * Reverse geocode coordinates to address
   * @param {number} lat - Latitude
   * @param {number} lng - Longitude
   * @returns {Promise<string>} - Address
   */
  async function reverseGeocode(lat, lng) {
    try {
      // Rate limiting
      const now = Date.now();
      const timeSinceLastRequest = now - lastNominatimRequest;
      if (timeSinceLastRequest < NOMINATIM_DELAY) {
        await new Promise(resolve => setTimeout(resolve, NOMINATIM_DELAY - timeSinceLastRequest));
      }
      lastNominatimRequest = Date.now();

      const url = `${NOMINATIM_URL}/reverse?` + new URLSearchParams({
        lat: lat.toString(),
        lon: lng.toString(),
        format: 'json'
      });

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'TravelPlannerApp/1.0'
        }
      });

      if (!response.ok) {
        throw new Error('Reverse geocoding failed');
      }

      const data = await response.json();
      return data.display_name || `${lat}, ${lng}`;
    } catch (error) {
      console.error('Reverse geocoding error:', error);
      return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    }
  }

  /**
   * Calculate distance between two points (Haversine formula)
   * @param {number} lat1 - Latitude 1
   * @param {number} lng1 - Longitude 1
   * @param {number} lat2 - Latitude 2
   * @param {number} lng2 - Longitude 2
   * @returns {number} - Distance in kilometers
   */
  function calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371; // Earth's radius in km
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);

    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Convert degrees to radians
   */
  function toRad(degrees) {
    return degrees * (Math.PI / 180);
  }

  /**
   * Get optimal route based on criteria
   * @param {Array} routes - Array of routes
   * @param {string} criteria - 'fastest', 'cheapest', 'balanced'
   * @returns {Object} - Best route
   */
  function getOptimalRoute(routes, criteria = 'balanced') {
    if (!routes || routes.length === 0) return null;

    switch (criteria) {
      case 'fastest':
        return routes.reduce((best, current) =>
          current.durationMinutes < best.durationMinutes ? current : best
        );

      case 'cheapest':
        return routes.reduce((best, current) => {
          const bestCost = calculateRouteCost(best).transport;
          const currentCost = calculateRouteCost(current).transport;
          return currentCost < bestCost ? current : best;
        });

      case 'balanced':
      default:
        // Score based on normalized time and cost
        return routes.reduce((best, current) => {
          const bestScore = best.durationMinutes / 60 + calculateRouteCost(best).transport / 10000;
          const currentScore = current.durationMinutes / 60 + calculateRouteCost(current).transport / 10000;
          return currentScore < bestScore ? current : best;
        });
    }
  }

  /**
   * Debounce function for search input
   * @param {Function} func - Function to debounce
   * @param {number} wait - Wait time in ms
   * @returns {Function} - Debounced function
   */
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

  // Public API
  return {
    searchAddress,
    getRoute,
    getMultipleRoutes,
    calculateRouteCost,
    reverseGeocode,
    calculateDistance,
    getOptimalRoute,
    formatDuration,
    debounce
  };
})();
