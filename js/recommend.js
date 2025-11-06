/**
 * Recommendation Module - POI Search and Filtering
 * Uses Overpass API for OpenStreetMap data
 */

const RecommendModule = (function() {
  const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
  const DEFAULT_RADIUS = 5000; // 5km
  const MAX_RESULTS = 15;

  // Preference to OSM tag mappings
  const PREFERENCE_TAGS = {
    nature: [
      'tourism=viewpoint',
      'natural=beach',
      'natural=peak',
      'leisure=park',
      'leisure=nature_reserve',
      'natural=waterfall'
    ],
    culture: [
      'tourism=museum',
      'tourism=gallery',
      'tourism=artwork',
      'amenity=theatre',
      'amenity=arts_centre',
      'historic=monument'
    ],
    food: [
      'amenity=restaurant',
      'amenity=cafe',
      'amenity=fast_food',
      'amenity=food_court',
      'shop=bakery'
    ],
    shopping: [
      'shop=mall',
      'shop=department_store',
      'shop=supermarket',
      'amenity=marketplace',
      'shop=clothes'
    ],
    history: [
      'historic=castle',
      'historic=archaeological_site',
      'historic=ruins',
      'historic=memorial',
      'tourism=attraction',
      'historic=building'
    ],
    adventure: [
      'sport=climbing',
      'sport=skiing',
      'leisure=sports_centre',
      'leisure=adventure_park',
      'tourism=zoo',
      'tourism=theme_park'
    ]
  };

  // Icon mappings for preferences
  const PREFERENCE_ICONS = {
    nature: 'fa-tree',
    culture: 'fa-landmark',
    food: 'fa-utensils',
    shopping: 'fa-shopping-bag',
    history: 'fa-monument',
    adventure: 'fa-mountain'
  };

  /**
   * Search for POIs near a location
   * @param {number} lat - Latitude
   * @param {number} lng - Longitude
   * @param {Array} preferences - Array of preference strings
   * @param {number} radius - Search radius in meters
   * @returns {Promise<Array>} - Array of POIs
   */
  async function searchPOIs(lat, lng, preferences = [], radius = DEFAULT_RADIUS) {
    if (!preferences || preferences.length === 0) {
      preferences = Object.keys(PREFERENCE_TAGS);
    }

    try {
      // Build Overpass query
      const query = buildOverpassQuery(lat, lng, preferences, radius);

      const response = await fetch(OVERPASS_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: `data=${encodeURIComponent(query)}`
      });

      if (!response.ok) {
        throw new Error(`Overpass API error: ${response.status}`);
      }

      const data = await response.json();

      // Process and filter results
      const pois = processOverpassResults(data, preferences);

      // Sort by distance and limit results
      const sortedPOIs = pois
        .map(poi => ({
          ...poi,
          distance: calculateDistance(lat, lng, poi.lat, poi.lng)
        }))
        .sort((a, b) => a.distance - b.distance)
        .slice(0, MAX_RESULTS);

      return sortedPOIs;
    } catch (error) {
      console.error('POI search error:', error);
      return [];
    }
  }

  /**
   * Build Overpass QL query
   * @param {number} lat - Latitude
   * @param {number} lng - Longitude
   * @param {Array} preferences - User preferences
   * @param {number} radius - Search radius
   * @returns {string} - Overpass query
   */
  function buildOverpassQuery(lat, lng, preferences, radius) {
    const tags = preferences.flatMap(pref => PREFERENCE_TAGS[pref] || []);

    if (tags.length === 0) {
      return '';
    }

    // Build query for each tag
    const nodeQueries = tags.map(tag => {
      const [key, value] = tag.split('=');
      return `node["${key}"="${value}"](around:${radius},${lat},${lng});`;
    }).join('\n');

    const wayQueries = tags.map(tag => {
      const [key, value] = tag.split('=');
      return `way["${key}"="${value}"](around:${radius},${lat},${lng});`;
    }).join('\n');

    return `
      [out:json][timeout:25];
      (
        ${nodeQueries}
        ${wayQueries}
      );
      out body;
      >;
      out skel qt;
    `;
  }

  /**
   * Process Overpass API results
   * @param {Object} data - Overpass response
   * @param {Array} preferences - User preferences
   * @returns {Array} - Processed POIs
   */
  function processOverpassResults(data, preferences) {
    if (!data.elements || data.elements.length === 0) {
      return [];
    }

    const pois = [];
    const seen = new Set();

    for (const element of data.elements) {
      if (!element.tags) continue;

      // Get coordinates
      let lat, lng;
      if (element.type === 'node') {
        lat = element.lat;
        lng = element.lon;
      } else if (element.type === 'way' && element.center) {
        lat = element.center.lat;
        lng = element.center.lon;
      } else {
        continue;
      }

      // Get name
      const name = element.tags.name || element.tags['name:en'] || 'Unnamed';

      // Skip duplicates
      const key = `${name}_${lat}_${lng}`;
      if (seen.has(key)) continue;
      seen.add(key);

      // Determine category
      const category = determineCategory(element.tags, preferences);
      if (!category) continue;

      // Get description
      const description = getDescription(element.tags);

      pois.push({
        id: element.id,
        name,
        lat,
        lng,
        category,
        description,
        tags: element.tags,
        icon: PREFERENCE_ICONS[category] || 'fa-location-dot',
        type: element.type
      });
    }

    return pois;
  }

  /**
   * Determine POI category based on tags
   * @param {Object} tags - OSM tags
   * @param {Array} preferences - User preferences
   * @returns {string|null} - Category
   */
  function determineCategory(tags, preferences) {
    for (const preference of preferences) {
      const prefTags = PREFERENCE_TAGS[preference];
      if (!prefTags) continue;

      for (const tagString of prefTags) {
        const [key, value] = tagString.split('=');
        if (tags[key] === value) {
          return preference;
        }
      }
    }
    return null;
  }

  /**
   * Get description from tags
   * @param {Object} tags - OSM tags
   * @returns {string} - Description
   */
  function getDescription(tags) {
    // Try various description fields
    const descFields = [
      'description',
      'tourism',
      'amenity',
      'historic',
      'natural',
      'shop',
      'leisure',
      'sport'
    ];

    for (const field of descFields) {
      if (tags[field] && tags[field] !== 'yes') {
        return formatTagValue(tags[field]);
      }
    }

    return '추천 여행지';
  }

  /**
   * Format tag value for display
   * @param {string} value - Tag value
   * @returns {string} - Formatted value
   */
  function formatTagValue(value) {
    return value
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /**
   * Calculate distance between two points
   * @param {number} lat1 - Latitude 1
   * @param {number} lng1 - Longitude 1
   * @param {number} lat2 - Latitude 2
   * @param {number} lng2 - Longitude 2
   * @returns {number} - Distance in km
   */
  function calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371;
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
   * Get POIs along a route
   * @param {Array} coordinates - Route coordinates [[lng, lat], ...]
   * @param {Array} preferences - User preferences
   * @param {number} radius - Search radius in meters
   * @returns {Promise<Array>} - Array of POIs
   */
  async function getPOIsAlongRoute(coordinates, preferences, radius = 2000) {
    if (!coordinates || coordinates.length === 0) return [];

    // Sample points along the route (every ~10km)
    const sampleInterval = Math.max(1, Math.floor(coordinates.length / 10));
    const sampledPoints = coordinates.filter((_, index) => index % sampleInterval === 0);

    // Search POIs near each sampled point
    const poiPromises = sampledPoints.map(([lng, lat]) =>
      searchPOIs(lat, lng, preferences, radius)
    );

    const poiResults = await Promise.all(poiPromises);

    // Flatten and deduplicate
    const allPOIs = poiResults.flat();
    const uniquePOIs = deduplicatePOIs(allPOIs);

    return uniquePOIs.slice(0, MAX_RESULTS);
  }

  /**
   * Deduplicate POIs
   * @param {Array} pois - Array of POIs
   * @returns {Array} - Deduplicated POIs
   */
  function deduplicatePOIs(pois) {
    const seen = new Map();

    for (const poi of pois) {
      const key = `${poi.name}_${poi.lat.toFixed(4)}_${poi.lng.toFixed(4)}`;
      if (!seen.has(key)) {
        seen.set(key, poi);
      }
    }

    return Array.from(seen.values());
  }

  /**
   * Get estimated visit duration for a POI
   * @param {string} category - POI category
   * @returns {number} - Duration in minutes
   */
  function getEstimatedDuration(category) {
    const durations = {
      nature: 60,      // 1 hour
      culture: 90,     // 1.5 hours
      food: 60,        // 1 hour
      shopping: 120,   // 2 hours
      history: 75,     // 1.25 hours
      adventure: 180   // 3 hours
    };

    return durations[category] || 60;
  }

  /**
   * Get estimated cost for a POI
   * @param {string} category - POI category
   * @returns {number} - Cost in KRW
   */
  function getEstimatedCost(category) {
    const costs = {
      nature: 0,        // Usually free
      culture: 10000,   // Museum entrance
      food: 15000,      // Meal cost
      shopping: 50000,  // Shopping budget
      history: 8000,    // Site entrance
      adventure: 30000  // Activity cost
    };

    return costs[category] || 10000;
  }

  /**
   * Filter POIs by categories
   * @param {Array} pois - Array of POIs
   * @param {Array} categories - Categories to filter
   * @returns {Array} - Filtered POIs
   */
  function filterByCategories(pois, categories) {
    if (!categories || categories.length === 0) return pois;
    return pois.filter(poi => categories.includes(poi.category));
  }

  /**
   * Sort POIs by criteria
   * @param {Array} pois - Array of POIs
   * @param {string} criteria - Sort criteria (distance, name, category)
   * @returns {Array} - Sorted POIs
   */
  function sortPOIs(pois, criteria = 'distance') {
    const sorted = [...pois];

    switch (criteria) {
      case 'distance':
        return sorted.sort((a, b) => (a.distance || 0) - (b.distance || 0));

      case 'name':
        return sorted.sort((a, b) => a.name.localeCompare(b.name));

      case 'category':
        return sorted.sort((a, b) => a.category.localeCompare(b.category));

      default:
        return sorted;
    }
  }

  /**
   * Get category display info
   * @param {string} category - Category name
   * @returns {Object} - Display info
   */
  function getCategoryInfo(category) {
    const info = {
      nature: { name: '자연', color: '#10b981', icon: 'fa-tree' },
      culture: { name: '문화', color: '#7c3aed', icon: 'fa-landmark' },
      food: { name: '음식', color: '#f59e0b', icon: 'fa-utensils' },
      shopping: { name: '쇼핑', color: '#ec4899', icon: 'fa-shopping-bag' },
      history: { name: '역사', color: '#8b5cf6', icon: 'fa-monument' },
      adventure: { name: '모험', color: '#ef4444', icon: 'fa-mountain' }
    };

    return info[category] || { name: category, color: '#6b7280', icon: 'fa-location-dot' };
  }

  // Public API
  return {
    searchPOIs,
    getPOIsAlongRoute,
    getEstimatedDuration,
    getEstimatedCost,
    filterByCategories,
    sortPOIs,
    getCategoryInfo,
    PREFERENCE_ICONS
  };
})();
