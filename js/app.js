/**
 * Main Application Controller
 * Integrates all modules and handles UI interactions
 */

const TravelApp = (function() {
  // Application state
  const state = {
    departure: null,
    destination: null,
    departureDate: null,
    duration: 3,
    preferences: [],
    routes: [],
    selectedRoute: null,
    places: [],
    costs: null
  };

  // DOM elements
  const elements = {
    form: null,
    departureInput: null,
    destinationInput: null,
    departureDateInput: null,
    durationInput: null,
    preferenceInputs: null,
    departureList: null,
    destinationList: null,
    loadingOverlay: null,
    routesContainer: null,
    costContainer: null,
    placesContainer: null,
    shareContainer: null,
    historyList: null,
    navToggle: null,
    navMenu: null
  };

  /**
   * Initialize application
   */
  function init() {
    console.log('Initializing Travel App...');

    // Get DOM elements
    getDOMElements();

    // Setup event listeners
    setupEventListeners();

    // Load from URL parameters
    loadFromURL();

    // Load history
    loadHistory();

    // Set default date
    setDefaultDate();

    console.log('Travel App initialized');
  }

  /**
   * Get DOM elements
   */
  function getDOMElements() {
    elements.form = document.getElementById('travelForm');
    elements.departureInput = document.getElementById('departure');
    elements.destinationInput = document.getElementById('destination');
    elements.departureDateInput = document.getElementById('departureDate');
    elements.durationInput = document.getElementById('duration');
    elements.preferenceInputs = document.querySelectorAll('input[name="preference"]');
    elements.departureList = document.getElementById('departureList');
    elements.destinationList = document.getElementById('destinationList');
    elements.loadingOverlay = document.getElementById('loadingOverlay');
    elements.routesContainer = document.getElementById('routesContainer');
    elements.costContainer = document.getElementById('costContainer');
    elements.placesContainer = document.getElementById('placesContainer');
    elements.shareContainer = document.getElementById('shareContainer');
    elements.historyList = document.getElementById('historyList');
    elements.navToggle = document.querySelector('.nav-toggle');
    elements.navMenu = document.querySelector('.nav-menu');
  }

  /**
   * Setup event listeners
   */
  function setupEventListeners() {
    // Form submit
    if (elements.form) {
      elements.form.addEventListener('submit', handleFormSubmit);
    }

    // Clear button
    const clearBtn = document.getElementById('clearBtn');
    if (clearBtn) {
      clearBtn.addEventListener('click', handleClear);
    }

    // Address search with debounce
    if (elements.departureInput) {
      elements.departureInput.addEventListener('input',
        TransportModule.debounce((e) => handleAddressSearch(e, 'departure'), 300)
      );
    }

    if (elements.destinationInput) {
      elements.destinationInput.addEventListener('input',
        TransportModule.debounce((e) => handleAddressSearch(e, 'destination'), 300)
      );
    }

    // Mobile navigation
    if (elements.navToggle) {
      elements.navToggle.addEventListener('click', toggleMobileNav);
    }

    // Share buttons
    const shareGoogleMapsBtn = document.getElementById('shareGoogleMapsBtn');
    if (shareGoogleMapsBtn) {
      shareGoogleMapsBtn.addEventListener('click', shareGoogleMaps);
    }

    const copyLinkBtn = document.getElementById('copyLinkBtn');
    if (copyLinkBtn) {
      copyLinkBtn.addEventListener('click', copyShareLink);
    }

    // Mobile action button
    const mobileActionBtn = document.getElementById('mobileActionBtn');
    if (mobileActionBtn) {
      mobileActionBtn.addEventListener('click', () => {
        elements.form.scrollIntoView({ behavior: 'smooth' });
      });
    }

    // Close autocomplete when clicking outside
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.autocomplete-wrapper')) {
        closeAllAutocompleteLists();
      }
    });
  }

  /**
   * Set default date to tomorrow
   */
  function setDefaultDate() {
    if (!elements.departureDateInput) return;

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0);

    const formatted = tomorrow.toISOString().slice(0, 16);
    elements.departureDateInput.value = formatted;
    elements.departureDateInput.min = new Date().toISOString().slice(0, 16);
  }

  /**
   * Handle form submit
   */
  async function handleFormSubmit(e) {
    e.preventDefault();

    console.log('=== Starting trip planning ===');

    // Validate form (now async)
    console.log('Step 1: Validating form...');
    const isValid = await validateForm();
    if (!isValid) {
      console.log('Form validation failed');
      return;
    }
    console.log('✓ Form validated');

    // Show loading
    showLoading(true);

    try {
      // Get form data
      console.log('Step 2: Getting form data...');
      await getFormData();
      console.log('✓ Form data retrieved:', {
        departure: state.departure?.name,
        destination: state.destination?.name,
        duration: state.duration,
        preferences: state.preferences
      });

      // Calculate routes
      console.log('Step 3: Calculating routes...');
      try {
        await calculateRoutes();
        console.log('✓ Routes calculated:', state.routes.length, 'routes found');
      } catch (routeError) {
        console.error('Route calculation failed:', routeError);
        throw new Error('경로 계산 실패: ' + routeError.message);
      }

      // Search for places
      console.log('Step 4: Searching for places...');
      try {
        await searchPlaces();
        console.log('✓ Places found:', state.places.length);
      } catch (placesError) {
        console.warn('Places search failed, continuing without places:', placesError);
        state.places = []; // Continue without places
      }

      // Calculate costs
      console.log('Step 5: Calculating costs...');
      try {
        calculateCosts();
        console.log('✓ Costs calculated');
      } catch (costError) {
        console.error('Cost calculation failed:', costError);
        // Continue even if cost calculation fails
      }

      // Render results
      console.log('Step 6: Rendering results...');
      renderResults();
      console.log('✓ Results rendered');

      // Save to history
      saveToHistory();

      // Update URL
      updateURL();

      // Scroll to results
      scrollToResults();

      // Hide loading
      showLoading(false);

      console.log('=== Trip planning completed successfully ===');

    } catch (error) {
      console.error('❌ Error processing trip:', error);
      console.error('Error stack:', error.stack);
      showLoading(false);

      // Show more specific error message
      let errorMessage = '경로를 찾는 중 오류가 발생했습니다.';

      if (error.message.includes('경로 계산 실패')) {
        errorMessage = '경로를 계산할 수 없습니다. 출발지와 도착지가 너무 멀거나 연결이 불가능합니다.';
      } else if (error.message.includes('No routes')) {
        errorMessage = '두 지점 사이의 경로를 찾을 수 없습니다. 다른 출발지나 도착지를 입력해주세요.';
      } else if (error.message.includes('Network') || error.message.includes('fetch')) {
        errorMessage = '네트워크 오류가 발생했습니다. 인터넷 연결을 확인해주세요.';
      }

      alert(errorMessage + '\n\n개발자 콘솔(F12)에서 자세한 오류를 확인할 수 있습니다.');
    }
  }

  /**
   * Validate form and auto-search if needed
   */
  async function validateForm() {
    console.log('Validating form...');

    // Check departure
    if (!state.departure) {
      const departureValue = elements.departureInput.value.trim();

      if (!departureValue) {
        alert('출발지를 입력해주세요.');
        elements.departureInput.focus();
        return false;
      }

      console.log('Searching for departure:', departureValue);

      // Auto-search for departure
      try {
        const results = await TransportModule.searchAddress(departureValue);
        console.log('Departure search results:', results.length);

        if (results.length > 0) {
          state.departure = {
            lat: results[0].lat,
            lng: results[0].lng,
            name: results[0].name
          };
          elements.departureInput.value = results[0].name;
          console.log('✅ Departure set:', state.departure.name);
        } else {
          // Show helpful message
          const popularCities = '서울, 부산, 인천, 대구, 대전, 광주, 제주';
          alert(`출발지를 찾을 수 없습니다.\n\n인기 도시: ${popularCities}\n\n위 도시 이름 중 하나를 정확히 입력해주세요.`);
          elements.departureInput.focus();
          return false;
        }
      } catch (error) {
        console.error('Departure search error:', error);
        alert('출발지 검색 중 오류가 발생했습니다.');
        return false;
      }
    }

    // Check destination
    if (!state.destination) {
      const destinationValue = elements.destinationInput.value.trim();

      if (!destinationValue) {
        alert('도착지를 입력해주세요.');
        elements.destinationInput.focus();
        return false;
      }

      console.log('Searching for destination:', destinationValue);

      // Auto-search for destination
      try {
        const results = await TransportModule.searchAddress(destinationValue);
        console.log('Destination search results:', results.length);

        if (results.length > 0) {
          state.destination = {
            lat: results[0].lat,
            lng: results[0].lng,
            name: results[0].name
          };
          elements.destinationInput.value = results[0].name;
          console.log('✅ Destination set:', state.destination.name);
        } else {
          // Show helpful message
          const popularCities = '서울, 부산, 인천, 대구, 대전, 광주, 제주, 도쿄, 오사카, 파리, 런던, 뉴욕';
          alert(`도착지를 찾을 수 없습니다.\n\n인기 도시: ${popularCities}\n\n위 도시 이름 중 하나를 정확히 입력해주세요.`);
          elements.destinationInput.focus();
          return false;
        }
      } catch (error) {
        console.error('Destination search error:', error);
        alert('도착지 검색 중 오류가 발생했습니다.');
        return false;
      }
    }

    console.log('✅ Form validation passed');
    return true;
  }

  /**
   * Get form data
   */
  async function getFormData() {
    state.departureDate = elements.departureDateInput.value;
    state.duration = parseInt(elements.durationInput.value) || 3;

    // Get selected preferences
    state.preferences = Array.from(elements.preferenceInputs)
      .filter(input => input.checked)
      .map(input => input.value);

    // If no preferences selected, use all
    if (state.preferences.length === 0) {
      state.preferences = ['nature', 'culture', 'food', 'shopping', 'history', 'adventure'];
    }
  }

  /**
   * Calculate routes
   */
  async function calculateRoutes() {
    const start = [state.departure.lng, state.departure.lat];
    const end = [state.destination.lng, state.destination.lat];

    state.routes = await TransportModule.getMultipleRoutes(start, end);

    if (state.routes.length === 0) {
      throw new Error('No routes found');
    }

    // Check if using fallback routes
    const hasFallback = state.routes.some(route => route.isFallback);
    if (hasFallback) {
      console.log('⚠️ Using estimated routes based on straight-line distance');
      // Show info message to user (optional, non-intrusive)
      showInfoMessage('정확한 경로 계산이 불가능하여 예상 경로를 표시합니다.');
    }

    // Set first route as selected
    state.selectedRoute = state.routes[0];

    // Add markers to map
    MapModule.clearAll();
    MapModule.addDepartureMarker(
      state.departure.lat,
      state.departure.lng,
      state.departure.name
    );
    MapModule.addDestinationMarker(
      state.destination.lat,
      state.destination.lng,
      state.destination.name
    );

    // Draw routes on map
    MapModule.drawMultipleRoutes(state.routes);
  }

  /**
   * Show info message to user
   */
  function showInfoMessage(message) {
    // Create and show a temporary info message
    const infoDiv = document.createElement('div');
    infoDiv.style.cssText = `
      position: fixed;
      top: 80px;
      left: 50%;
      transform: translateX(-50%);
      background: #f59e0b;
      color: white;
      padding: 12px 24px;
      border-radius: 8px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
      z-index: 10000;
      font-weight: 500;
      max-width: 90%;
      text-align: center;
    `;
    infoDiv.innerHTML = `<i class="fas fa-info-circle"></i> ${message}`;
    document.body.appendChild(infoDiv);

    // Remove after 5 seconds
    setTimeout(() => {
      infoDiv.style.opacity = '0';
      infoDiv.style.transition = 'opacity 0.5s';
      setTimeout(() => infoDiv.remove(), 500);
    }, 5000);
  }

  /**
   * Search for places
   */
  async function searchPlaces() {
    try {
      const midLat = (state.departure.lat + state.destination.lat) / 2;
      const midLng = (state.departure.lng + state.destination.lng) / 2;

      console.log('Searching POIs near:', { midLat, midLng, preferences: state.preferences });

      state.places = await RecommendModule.searchPOIs(
        midLat,
        midLng,
        state.preferences,
        10000 // 10km radius
      );

      console.log('POIs found:', state.places.length);

      // Add place markers to map
      if (state.places && state.places.length > 0) {
        state.places.forEach(place => {
          try {
            MapModule.addPlaceMarker(
              place.lat,
              place.lng,
              place.name,
              place.description,
              () => handlePlaceClick(place)
            );
          } catch (markerError) {
            console.warn('Failed to add marker for place:', place.name, markerError);
          }
        });
      }
    } catch (error) {
      console.error('Error searching places:', error);
      state.places = [];
      // Don't throw - continue without places
    }
  }

  /**
   * Calculate costs
   */
  function calculateCosts() {
    try {
      console.log('Calculating costs for selected route...');
      state.costs = CostModule.calculateTripCost({
        route: state.selectedRoute,
        duration: state.duration,
        accommodationLevel: 'standard',
        foodLevel: 'standard',
        places: state.places || []
      });

      console.log('Calculating costs for all routes...');
      // Calculate costs for all routes
      state.routes = state.routes.map(route => {
        try {
          const costData = CostModule.calculateTripCost({
            route,
            duration: state.duration,
            accommodationLevel: 'standard',
            foodLevel: 'standard',
            places: []
          });

          return {
            ...route,
            cost: costData.total,
            durationMinutes: route.durationMinutes || 60
          };
        } catch (routeCostError) {
          console.error('Error calculating cost for route:', route.name, routeCostError);
          return {
            ...route,
            cost: 0,
            durationMinutes: route.durationMinutes || 60
          };
        }
      });

      console.log('Costs calculated successfully');
    } catch (error) {
      console.error('Error in calculateCosts:', error);
      // Set default costs
      state.costs = {
        transport: 0,
        accommodation: 0,
        food: 0,
        activities: 0,
        total: 0,
        breakdown: {
          transportPercent: 0,
          accommodationPercent: 0,
          foodPercent: 0,
          activitiesPercent: 0
        }
      };
    }
  }

  /**
   * Render results
   */
  function renderResults() {
    // Show containers
    elements.routesContainer.style.display = 'block';
    elements.costContainer.style.display = 'block';
    elements.placesContainer.style.display = 'block';
    elements.shareContainer.style.display = 'block';

    // Render routes
    CostModule.renderRouteCostComparison(state.routes);
    setupRouteClickHandlers();

    // Render costs
    CostModule.renderCostSummary(state.costs);
    CostModule.renderCostChart(state.costs);

    // Render places
    renderPlaces();
  }

  /**
   * Render places
   */
  function renderPlaces() {
    const container = document.getElementById('placesGrid');
    if (!container) return;

    if (state.places.length === 0) {
      container.innerHTML = '<p class="empty-message">추천 장소를 찾지 못했습니다.</p>';
      return;
    }

    const placesHTML = state.places.map(place => {
      const categoryInfo = RecommendModule.getCategoryInfo(place.category);
      const duration = RecommendModule.getEstimatedDuration(place.category);
      const cost = RecommendModule.getEstimatedCost(place.category);

      return `
        <div class="place-card" data-place-id="${place.id}">
          <div class="place-image">
            <i class="fas ${place.icon}"></i>
            <span class="place-type">${categoryInfo.name}</span>
          </div>
          <div class="place-content">
            <h3 class="place-name">${place.name}</h3>
            <p class="place-description">${place.description}</p>
            <div class="place-meta">
              <span><i class="fas fa-clock"></i> ${duration}분</span>
              <span><i class="fas fa-won-sign"></i> ${CostModule.formatCurrency(cost)}</span>
            </div>
          </div>
        </div>
      `;
    }).join('');

    container.innerHTML = placesHTML;

    // Add click handlers
    container.querySelectorAll('.place-card').forEach((card, index) => {
      card.addEventListener('click', () => {
        const place = state.places[index];
        MapModule.setView(place.lat, place.lng, 15);
        card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });
    });
  }

  /**
   * Setup route click handlers
   */
  function setupRouteClickHandlers() {
    const routeCards = document.querySelectorAll('.route-card');
    routeCards.forEach((card, index) => {
      card.addEventListener('click', () => {
        // Remove active class from all
        routeCards.forEach(c => c.classList.remove('active'));

        // Add active class to clicked
        card.classList.add('active');

        // Update selected route
        state.selectedRoute = state.routes[index];

        // Highlight route on map
        MapModule.highlightRoute(index);

        // Recalculate costs
        state.costs = CostModule.calculateTripCost({
          route: state.selectedRoute,
          duration: state.duration,
          accommodationLevel: 'standard',
          foodLevel: 'standard',
          places: state.places
        });

        // Update cost display
        CostModule.renderCostSummary(state.costs);
        CostModule.renderCostChart(state.costs);
      });
    });

    // Set first route as active
    if (routeCards.length > 0) {
      routeCards[0].classList.add('active');
    }
  }

  /**
   * Handle address search
   */
  async function handleAddressSearch(e, type) {
    const query = e.target.value.trim();
    const listElement = type === 'departure' ? elements.departureList : elements.destinationList;

    if (query.length < 3) {
      listElement.classList.remove('active');
      return;
    }

    const results = await TransportModule.searchAddress(query);

    if (results.length === 0) {
      listElement.classList.remove('active');
      return;
    }

    renderAutocompleteList(results, listElement, type);
  }

  /**
   * Render autocomplete list
   */
  function renderAutocompleteList(results, listElement, type) {
    const html = results.map(result => `
      <li class="autocomplete-item" data-lat="${result.lat}" data-lng="${result.lng}" data-name="${escapeHtml(result.name)}">
        ${result.name}
      </li>
    `).join('');

    listElement.innerHTML = html;
    listElement.classList.add('active');

    // Add click handlers
    listElement.querySelectorAll('.autocomplete-item').forEach(item => {
      item.addEventListener('click', () => {
        const lat = parseFloat(item.dataset.lat);
        const lng = parseFloat(item.dataset.lng);
        const name = item.dataset.name;

        if (type === 'departure') {
          state.departure = { lat, lng, name };
          elements.departureInput.value = name;
        } else {
          state.destination = { lat, lng, name };
          elements.destinationInput.value = name;
        }

        listElement.classList.remove('active');
      });
    });
  }

  /**
   * Close all autocomplete lists
   */
  function closeAllAutocompleteLists() {
    elements.departureList.classList.remove('active');
    elements.destinationList.classList.remove('active');
  }

  /**
   * Handle place click
   */
  function handlePlaceClick(place) {
    console.log('Place clicked:', place);
  }

  /**
   * Handle clear
   */
  function handleClear() {
    // Reset form
    elements.form.reset();
    setDefaultDate();

    // Reset state
    state.departure = null;
    state.destination = null;
    state.routes = [];
    state.selectedRoute = null;
    state.places = [];
    state.costs = null;

    // Clear map
    MapModule.clearAll();

    // Hide results
    elements.routesContainer.style.display = 'none';
    elements.costContainer.style.display = 'none';
    elements.placesContainer.style.display = 'none';
    elements.shareContainer.style.display = 'none';

    // Destroy chart
    CostModule.destroyChart();
  }

  /**
   * Show/hide loading overlay
   */
  function showLoading(show) {
    if (elements.loadingOverlay) {
      if (show) {
        elements.loadingOverlay.classList.add('active');
      } else {
        elements.loadingOverlay.classList.remove('active');
      }
    }
  }

  /**
   * Toggle mobile navigation
   */
  function toggleMobileNav() {
    if (elements.navMenu) {
      elements.navMenu.classList.toggle('active');
    }
  }

  /**
   * Share Google Maps
   */
  function shareGoogleMaps() {
    if (!state.departure || !state.destination) return;

    const origin = `${state.departure.lat},${state.departure.lng}`;
    const destination = `${state.destination.lat},${state.destination.lng}`;

    let url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}`;

    // Add waypoints (places)
    if (state.places.length > 0) {
      const waypoints = state.places
        .slice(0, 9) // Google Maps allows max 9 waypoints
        .map(p => `${p.lat},${p.lng}`)
        .join('|');
      url += `&waypoints=${waypoints}`;
    }

    window.open(url, '_blank');
  }

  /**
   * Copy share link
   */
  function copyShareLink() {
    const url = window.location.href;

    if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(() => {
        alert('링크가 클립보드에 복사되었습니다!');
      }).catch(() => {
        fallbackCopyToClipboard(url);
      });
    } else {
      fallbackCopyToClipboard(url);
    }
  }

  /**
   * Fallback copy to clipboard
   */
  function fallbackCopyToClipboard(text) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.top = '-9999px';
    document.body.appendChild(textArea);
    textArea.select();

    try {
      document.execCommand('copy');
      alert('링크가 복사되었습니다!');
    } catch (err) {
      alert('링크 복사에 실패했습니다. 수동으로 복사해주세요: ' + text);
    }

    document.body.removeChild(textArea);
  }

  /**
   * Update URL with parameters
   */
  function updateURL() {
    if (!state.departure || !state.destination) return;

    const params = new URLSearchParams({
      from: `${state.departure.lat},${state.departure.lng}`,
      to: `${state.destination.lat},${state.destination.lng}`,
      date: state.departureDate,
      duration: state.duration,
      pref: state.preferences.join(',')
    });

    const newURL = `${window.location.pathname}?${params.toString()}`;
    window.history.pushState({}, '', newURL);
  }

  /**
   * Load from URL parameters
   */
  function loadFromURL() {
    const params = new URLSearchParams(window.location.search);

    if (params.has('from') && params.has('to')) {
      // TODO: Implement loading from URL
      console.log('Loading from URL parameters...');
    }
  }

  /**
   * Save to history
   */
  function saveToHistory() {
    if (!state.departure || !state.destination) return;

    const item = {
      id: Date.now(),
      departure: state.departure,
      destination: state.destination,
      date: state.departureDate,
      duration: state.duration,
      preferences: state.preferences,
      timestamp: new Date().toISOString()
    };

    let history = getHistory();
    history.unshift(item);
    history = history.slice(0, 5); // Keep only last 5

    localStorage.setItem('travelHistory', JSON.stringify(history));
    loadHistory();
  }

  /**
   * Get history from localStorage
   */
  function getHistory() {
    try {
      const history = localStorage.getItem('travelHistory');
      return history ? JSON.parse(history) : [];
    } catch (error) {
      console.error('Error loading history:', error);
      return [];
    }
  }

  /**
   * Load and render history
   */
  function loadHistory() {
    if (!elements.historyList) return;

    const history = getHistory();

    if (history.length === 0) {
      elements.historyList.innerHTML = '<p class="empty-message">최근 검색 기록이 없습니다.</p>';
      return;
    }

    const html = history.map(item => `
      <div class="history-item" data-id="${item.id}">
        <div class="history-info">
          <h4>${item.departure.name} → ${item.destination.name}</h4>
          <p>${new Date(item.timestamp).toLocaleDateString('ko-KR')} · ${item.duration}일</p>
        </div>
        <button class="history-delete" data-id="${item.id}">
          <i class="fas fa-trash"></i>
        </button>
      </div>
    `).join('');

    elements.historyList.innerHTML = html;

    // Add event listeners
    elements.historyList.querySelectorAll('.history-item').forEach(item => {
      item.addEventListener('click', (e) => {
        if (!e.target.closest('.history-delete')) {
          loadHistoryItem(parseInt(item.dataset.id));
        }
      });
    });

    elements.historyList.querySelectorAll('.history-delete').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteHistoryItem(parseInt(btn.dataset.id));
      });
    });
  }

  /**
   * Load history item
   */
  function loadHistoryItem(id) {
    const history = getHistory();
    const item = history.find(h => h.id === id);

    if (!item) return;

    state.departure = item.departure;
    state.destination = item.destination;
    state.departureDate = item.date;
    state.duration = item.duration;
    state.preferences = item.preferences;

    // Fill form
    elements.departureInput.value = item.departure.name;
    elements.destinationInput.value = item.destination.name;
    elements.departureDateInput.value = item.date;
    elements.durationInput.value = item.duration;

    // Check preferences
    elements.preferenceInputs.forEach(input => {
      input.checked = item.preferences.includes(input.value);
    });

    // Scroll to form
    elements.form.scrollIntoView({ behavior: 'smooth' });
  }

  /**
   * Delete history item
   */
  function deleteHistoryItem(id) {
    let history = getHistory();
    history = history.filter(h => h.id !== id);
    localStorage.setItem('travelHistory', JSON.stringify(history));
    loadHistory();
  }

  /**
   * Scroll to results
   */
  function scrollToResults() {
    const resultsSection = document.getElementById('results');
    if (resultsSection) {
      setTimeout(() => {
        resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 300);
    }
  }

  /**
   * Escape HTML
   */
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Public API
  return {
    state,
    handleClear,
    showLoading
  };
})();
