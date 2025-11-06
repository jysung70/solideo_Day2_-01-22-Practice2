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

  // Popular cities database (fallback when API fails)
  const POPULAR_CITIES = {
    // South Korea
    '서울': { name: '서울특별시, 대한민국', lat: 37.5665, lng: 126.9780 },
    '서울시': { name: '서울특별시, 대한민국', lat: 37.5665, lng: 126.9780 },
    '부산': { name: '부산광역시, 대한민국', lat: 35.1796, lng: 129.0756 },
    '인천': { name: '인천광역시, 대한민국', lat: 37.4563, lng: 126.7052 },
    '대구': { name: '대구광역시, 대한민국', lat: 35.8714, lng: 128.6014 },
    '대전': { name: '대전광역시, 대한민국', lat: 36.3504, lng: 127.3845 },
    '광주': { name: '광주광역시, 대한민국', lat: 35.1595, lng: 126.8526 },
    '울산': { name: '울산광역시, 대한민국', lat: 35.5384, lng: 129.3114 },
    '제주': { name: '제주특별자치도, 대한민국', lat: 33.4996, lng: 126.5312 },
    '수원': { name: '수원시, 경기도, 대한민국', lat: 37.2636, lng: 127.0286 },
    '창원': { name: '창원시, 경상남도, 대한민국', lat: 35.2280, lng: 128.6811 },
    '고양': { name: '고양시, 경기도, 대한민국', lat: 37.6584, lng: 126.8320 },
    '용인': { name: '용인시, 경기도, 대한민국', lat: 37.2411, lng: 127.1776 },
    '성남': { name: '성남시, 경기도, 대한민국', lat: 37.4201, lng: 127.1262 },
    '청주': { name: '청주시, 충청북도, 대한민국', lat: 36.6424, lng: 127.4890 },
    '전주': { name: '전주시, 전라북도, 대한민국', lat: 35.8242, lng: 127.1480 },
    '천안': { name: '천안시, 충청남도, 대한민국', lat: 36.8151, lng: 127.1139 },
    '안산': { name: '안산시, 경기도, 대한민국', lat: 37.3219, lng: 126.8309 },
    '안양': { name: '안양시, 경기도, 대한민국', lat: 37.3943, lng: 126.9568 },
    '포항': { name: '포항시, 경상북도, 대한민국', lat: 36.0190, lng: 129.3435 },
    '강릉': { name: '강릉시, 강원도, 대한민국', lat: 37.7519, lng: 128.8761 },
    '경주': { name: '경주시, 경상북도, 대한민국', lat: 35.8562, lng: 129.2247 },
    '여수': { name: '여수시, 전라남도, 대한민국', lat: 34.7604, lng: 127.6622 },
    '속초': { name: '속초시, 강원도, 대한민국', lat: 38.2070, lng: 128.5918 },

    // International
    '도쿄': { name: '도쿄, 일본', lat: 35.6762, lng: 139.6503 },
    '오사카': { name: '오사카, 일본', lat: 34.6937, lng: 135.5023 },
    '교토': { name: '교토, 일본', lat: 35.0116, lng: 135.7681 },
    '후쿠오카': { name: '후쿠오카, 일본', lat: 33.5904, lng: 130.4017 },
    '베이징': { name: '베이징, 중국', lat: 39.9042, lng: 116.4074 },
    '상하이': { name: '상하이, 중국', lat: 31.2304, lng: 121.4737 },
    '홍콩': { name: '홍콩', lat: 22.3193, lng: 114.1694 },
    '타이베이': { name: '타이베이, 대만', lat: 25.0330, lng: 121.5654 },
    '방콕': { name: '방콕, 태국', lat: 13.7563, lng: 100.5018 },
    '싱가포르': { name: '싱가포르', lat: 1.3521, lng: 103.8198 },
    '파리': { name: '파리, 프랑스', lat: 48.8566, lng: 2.3522 },
    '런던': { name: '런던, 영국', lat: 51.5074, lng: -0.1278 },
    '뉴욕': { name: '뉴욕, 미국', lat: 40.7128, lng: -74.0060 },
    '로스앤젤레스': { name: '로스앤젤레스, 미국', lat: 34.0522, lng: -118.2437 },
    '시드니': { name: '시드니, 호주', lat: -33.8688, lng: 151.2093 }
  };

  /**
   * Search from popular cities database
   * @param {string} query - Search query
   * @returns {Array} - Array of matching cities
   */
  function searchPopularCities(query) {
    if (!query) return [];

    const normalizedQuery = query.toLowerCase().trim();
    const results = [];

    // Exact match first
    for (const [key, city] of Object.entries(POPULAR_CITIES)) {
      if (key.toLowerCase() === normalizedQuery) {
        results.push({
          name: city.name,
          lat: city.lat,
          lng: city.lng,
          type: 'city',
          source: 'popular'
        });
      }
    }

    // Partial match
    if (results.length === 0) {
      for (const [key, city] of Object.entries(POPULAR_CITIES)) {
        if (key.toLowerCase().includes(normalizedQuery) ||
            city.name.toLowerCase().includes(normalizedQuery)) {
          results.push({
            name: city.name,
            lat: city.lat,
            lng: city.lng,
            type: 'city',
            source: 'popular'
          });
        }
      }
    }

    return results.slice(0, 5); // Limit to 5 results
  }

  /**
   * Search address using Nominatim API with fallback to popular cities
   * @param {string} query - Search query
   * @returns {Promise<Array>} - Array of results
   */
  async function searchAddress(query) {
    if (!query || query.length < 2) return [];

    console.log('🔍 Address search for:', query);

    // First, search in popular cities (instant, no API call)
    const popularResults = searchPopularCities(query);

    if (popularResults.length > 0) {
      console.log('✅ Found in popular cities:', popularResults.length);
      return popularResults;
    }

    // If not found in popular cities, try API (but might fail due to CORS)
    console.log('⚠️ Not in popular cities, trying API...');

    try {
      // Rate limiting for Nominatim
      const now = Date.now();
      const timeSinceLastRequest = now - lastNominatimRequest;
      if (timeSinceLastRequest < NOMINATIM_DELAY) {
        await new Promise(resolve => setTimeout(resolve, NOMINATIM_DELAY - timeSinceLastRequest));
      }
      lastNominatimRequest = Date.now();

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
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();

      const apiResults = data.map(item => ({
        name: item.display_name,
        lat: parseFloat(item.lat),
        lng: parseFloat(item.lon),
        type: item.type,
        address: item.address,
        source: 'api'
      }));

      console.log('✅ API search successful:', apiResults.length);
      return apiResults;

    } catch (error) {
      console.warn('❌ API search failed:', error.message);
      console.log('💡 Returning empty - user can type city name directly');

      // Return empty array - user can type city name and submit directly
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
    const url = `${ORS_BASE_URL}/v2/directions/${profile}`;

    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

    try {
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
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
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
      clearTimeout(timeoutId);

      if (error.name === 'AbortError') {
        throw new Error('API timeout');
      } else if (error.message.includes('Failed to fetch')) {
        throw new Error('Network error or CORS blocked');
      }

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
    console.log('🚀 getMultipleRoutes called');
    console.log('Start coordinates:', start);
    console.log('End coordinates:', end);

    try {
      // Validate input
      if (!start || !end || start.length !== 2 || end.length !== 2) {
        console.error('❌ Invalid coordinates:', { start, end });
        throw new Error('Invalid coordinates provided');
      }

      // Calculate routes for different modes
      const profiles = [
        { profile: 'driving-car', name: '자동차', icon: 'fa-car', speed: 60 },
        { profile: 'foot-walking', name: '도보', icon: 'fa-person-walking', speed: 5 },
        { profile: 'cycling-regular', name: '자전거', icon: 'fa-bicycle', speed: 15 }
      ];

      console.log('📍 Calculating routes for', profiles.length, 'transport modes...');

      const routePromises = profiles.map(async ({ profile, name, icon, speed }) => {
        console.log(`\n🔄 [${name}] Starting route calculation...`);

        try {
          console.log(`  → Trying API for ${name}...`);
          const route = await getRoute(start, end, profile);
          console.log(`  ✅ ${name} route obtained from API`);
          return {
            ...route,
            name,
            icon,
            type: getRouteType(route)
          };
        } catch (error) {
          console.warn(`  ⚠️  API failed for ${name}:`, error.message);
          console.log(`  🔧 Creating fallback route for ${name}...`);

          // Fallback: Create estimated route based on straight-line distance
          try {
            const fallbackRoute = createFallbackRoute(start, end, name, icon, profile, speed);
            console.log(`  ✅ Fallback route created for ${name}`);
            return fallbackRoute;
          } catch (fallbackError) {
            console.error(`  ❌ Fallback creation failed for ${name}:`, fallbackError);
            console.error('  Fallback error details:', fallbackError.stack);
            return null;
          }
        }
      });

      console.log('\n⏳ Waiting for all routes to complete...');
      const routes = await Promise.all(routePromises);

      console.log('\n📊 Route results:');
      routes.forEach((route, idx) => {
        if (route) {
          console.log(`  ✓ ${route.name}: ${route.distance}km, ${route.duration}${route.isFallback ? ' (fallback)' : ''}`);
        } else {
          console.log(`  ✗ Route ${idx}: null`);
        }
      });

      const validRoutes = routes.filter(route => route !== null);

      console.log(`\n✅ Final: ${validRoutes.length} out of ${profiles.length} routes ready`);

      // If no valid routes, throw error
      if (validRoutes.length === 0) {
        console.error('❌ No valid routes could be created!');
        throw new Error('No routes could be calculated');
      }

      return validRoutes;
    } catch (error) {
      console.error('❌ Multiple routes error:', error);
      console.error('Error stack:', error.stack);
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
    console.log(`    🔧 createFallbackRoute for ${name}`);
    console.log(`       Start: [${start[0]}, ${start[1]}]`);
    console.log(`       End: [${end[0]}, ${end[1]}]`);
    console.log(`       Speed: ${speed} km/h`);

    try {
      // Validate inputs
      if (!start || !end) {
        throw new Error('Start or end is null/undefined');
      }

      if (!Array.isArray(start) || !Array.isArray(end)) {
        throw new Error('Coordinates must be arrays');
      }

      if (start.length !== 2 || end.length !== 2) {
        throw new Error(`Invalid array length: start=${start.length}, end=${end.length}`);
      }

      if (!speed || speed <= 0) {
        throw new Error(`Invalid speed: ${speed}`);
      }

      // Extract coordinates
      const startLng = parseFloat(start[0]);
      const startLat = parseFloat(start[1]);
      const endLng = parseFloat(end[0]);
      const endLat = parseFloat(end[1]);

      console.log(`       Parsed coordinates: (${startLat}, ${startLng}) -> (${endLat}, ${endLng})`);

      if (isNaN(startLng) || isNaN(startLat) || isNaN(endLng) || isNaN(endLat)) {
        throw new Error('Coordinates contain NaN values');
      }

      // Calculate straight-line distance using Haversine formula
      console.log(`       Calculating distance...`);
      const distance = calculateDistance(startLat, startLng, endLat, endLng);
      console.log(`       Straight-line distance: ${distance.toFixed(2)} km`);

      if (isNaN(distance) || distance <= 0) {
        throw new Error(`Invalid distance calculated: ${distance}`);
      }

      // Estimate actual travel distance (multiply by 1.3 for roads)
      const travelDistance = distance * 1.3;
      console.log(`       Estimated travel distance: ${travelDistance.toFixed(2)} km`);

      // Calculate duration based on speed
      const durationMinutes = Math.round((travelDistance / speed) * 60);
      console.log(`       Duration: ${durationMinutes} minutes`);

      if (isNaN(durationMinutes) || durationMinutes <= 0) {
        throw new Error(`Invalid duration calculated: ${durationMinutes}`);
      }

      // Create simple straight-line coordinates
      const coordinates = [start, end];

      const fallbackRoute = {
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

      console.log(`    ✅ Fallback route created successfully`);
      console.log(`       ${name}: ${fallbackRoute.distance}km, ${fallbackRoute.duration}`);

      return fallbackRoute;
    } catch (error) {
      console.error(`    ❌ Error in createFallbackRoute:`, error.message);
      console.error(`    Stack:`, error.stack);
      throw new Error(`Failed to create fallback route for ${name}: ${error.message}`);
    }
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
