/**
 * Cost Module - Budget Calculation and Visualization
 * Uses Chart.js for data visualization
 */

const CostModule = (function() {
  let chartInstance = null;

  // Cost constants (in KRW)
  const COSTS = {
    // Per km costs
    transport: {
      'driving-car': 150,        // Fuel cost per km
      'foot-walking': 0,
      'cycling-regular': 0,
      'public-transport': 100    // Average per km
    },
    // Per day costs
    accommodation: {
      budget: 50000,
      standard: 100000,
      luxury: 300000
    },
    food: {
      budget: 30000,
      standard: 60000,
      luxury: 150000
    },
    // Activity costs by category
    activities: {
      nature: 5000,
      culture: 10000,
      food: 15000,
      shopping: 50000,
      history: 8000,
      adventure: 30000
    }
  };

  /**
   * Calculate total trip cost
   * @param {Object} params - Cost calculation parameters
   * @returns {Object} - Cost breakdown
   */
  function calculateTripCost(params) {
    const {
      route,
      duration = 3,
      accommodationLevel = 'standard',
      foodLevel = 'standard',
      places = []
    } = params;

    // Transport cost
    const transportCost = calculateTransportCost(route);

    // Accommodation cost (nights = duration - 1)
    const nights = Math.max(0, duration - 1);
    const accommodationCost = COSTS.accommodation[accommodationLevel] * nights;

    // Food cost (per day)
    const foodCost = COSTS.food[foodLevel] * duration;

    // Activities cost
    const activitiesCost = calculateActivitiesCost(places);

    // Total
    const total = transportCost + accommodationCost + foodCost + activitiesCost;

    return {
      transport: transportCost,
      accommodation: accommodationCost,
      food: foodCost,
      activities: activitiesCost,
      total: total,
      breakdown: {
        transportPercent: (transportCost / total * 100).toFixed(1),
        accommodationPercent: (accommodationCost / total * 100).toFixed(1),
        foodPercent: (foodCost / total * 100).toFixed(1),
        activitiesPercent: (activitiesCost / total * 100).toFixed(1)
      }
    };
  }

  /**
   * Calculate transport cost
   * @param {Object} route - Route object
   * @returns {number} - Transport cost
   */
  function calculateTransportCost(route) {
    if (!route) return 0;

    const distance = parseFloat(route.distance) || 0;
    const profile = route.profile || 'driving-car';
    const costPerKm = COSTS.transport[profile] || COSTS.transport['public-transport'];

    return Math.round(distance * costPerKm);
  }

  /**
   * Calculate activities cost
   * @param {Array} places - Array of places
   * @returns {number} - Activities cost
   */
  function calculateActivitiesCost(places) {
    if (!places || places.length === 0) return 0;

    return places.reduce((total, place) => {
      const category = place.category || 'culture';
      const cost = COSTS.activities[category] || 10000;
      return total + cost;
    }, 0);
  }

  /**
   * Compare costs of multiple routes
   * @param {Array} routes - Array of routes
   * @param {number} duration - Trip duration
   * @returns {Array} - Cost comparison
   */
  function compareRouteCosts(routes, duration = 3) {
    return routes.map(route => {
      const cost = calculateTripCost({
        route,
        duration,
        accommodationLevel: 'standard',
        foodLevel: 'standard',
        places: []
      });

      return {
        name: route.name || 'Route',
        distance: route.distance,
        duration: route.duration,
        cost: cost.total,
        breakdown: cost
      };
    });
  }

  /**
   * Render cost chart
   * @param {Object} costData - Cost data
   */
  function renderCostChart(costData) {
    const canvas = document.getElementById('costChart');
    if (!canvas) {
      console.warn('Chart canvas not found');
      return;
    }

    // Check if Chart.js is loaded
    if (typeof Chart === 'undefined') {
      console.error('❌ Chart.js is not loaded. Please check CDN link.');
      console.log('Showing text summary instead of chart');

      // Show text summary instead
      const chartWrapper = canvas.parentElement;
      if (chartWrapper) {
        chartWrapper.innerHTML = `
          <div style="padding: 2rem; text-align: center;">
            <p style="color: #6b7280; margin-bottom: 1rem;">차트 라이브러리를 로드할 수 없습니다.</p>
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem; max-width: 400px; margin: 0 auto;">
              <div><strong>교통비:</strong> ${formatCurrency(costData.transport)}</div>
              <div><strong>숙박비:</strong> ${formatCurrency(costData.accommodation)}</div>
              <div><strong>식비:</strong> ${formatCurrency(costData.food)}</div>
              <div><strong>활동비:</strong> ${formatCurrency(costData.activities)}</div>
            </div>
          </div>
        `;
      }
      return;
    }

    const ctx = canvas.getContext('2d');

    // Destroy existing chart
    if (chartInstance) {
      try {
        chartInstance.destroy();
      } catch (e) {
        console.warn('Error destroying previous chart:', e);
      }
    }

    // Prepare data
    const labels = ['교통비', '숙박비', '식비', '활동비'];
    const data = [
      costData.transport,
      costData.accommodation,
      costData.food,
      costData.activities
    ];

    const colors = [
      'rgba(37, 99, 235, 0.8)',   // primary
      'rgba(124, 58, 237, 0.8)',  // secondary
      'rgba(245, 158, 11, 0.8)',  // warning
      'rgba(16, 185, 129, 0.8)'   // success
    ];

    // Create chart
    try {
      chartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: labels,
          datasets: [{
            data: data,
            backgroundColor: colors,
            borderWidth: 2,
            borderColor: '#ffffff'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          plugins: {
            legend: {
              position: 'bottom',
              labels: {
                padding: 15,
                font: {
                  size: 13
                }
              }
            },
            tooltip: {
              callbacks: {
                label: function(context) {
                  const label = context.label || '';
                  const value = context.parsed || 0;
                  return `${label}: ${formatCurrency(value)} (${costData.breakdown[getCostKey(label)]}%)`;
                }
              }
            }
          }
        }
      });
      console.log('✅ Chart created successfully');
    } catch (error) {
      console.error('❌ Error creating chart:', error);
      console.log('Showing text summary instead');

      // Show text summary instead
      const chartWrapper = canvas.parentElement;
      if (chartWrapper) {
        chartWrapper.innerHTML = `
          <div style="padding: 2rem; text-align: center;">
            <p style="color: #ef4444; margin-bottom: 1rem;">차트 생성 중 오류가 발생했습니다.</p>
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem; max-width: 400px; margin: 0 auto;">
              <div><strong>교통비:</strong> ${formatCurrency(costData.transport)}</div>
              <div><strong>숙박비:</strong> ${formatCurrency(costData.accommodation)}</div>
              <div><strong>식비:</strong> ${formatCurrency(costData.food)}</div>
              <div><strong>활동비:</strong> ${formatCurrency(costData.activities)}</div>
            </div>
          </div>
        `;
      }
    }
  }

  /**
   * Get cost key from label
   */
  function getCostKey(label) {
    const map = {
      '교통비': 'transportPercent',
      '숙박비': 'accommodationPercent',
      '식비': 'foodPercent',
      '활동비': 'activitiesPercent'
    };
    return map[label] || 'transportPercent';
  }

  /**
   * Render cost summary
   * @param {Object} costData - Cost data
   */
  function renderCostSummary(costData) {
    const container = document.getElementById('costSummary');
    if (!container) return;

    container.innerHTML = `
      <div class="cost-item">
        <span class="cost-label">
          <i class="fas fa-car"></i>
          교통비
        </span>
        <span class="cost-value">${formatCurrency(costData.transport)}</span>
      </div>
      <div class="cost-item">
        <span class="cost-label">
          <i class="fas fa-hotel"></i>
          숙박비
        </span>
        <span class="cost-value">${formatCurrency(costData.accommodation)}</span>
      </div>
      <div class="cost-item">
        <span class="cost-label">
          <i class="fas fa-utensils"></i>
          식비
        </span>
        <span class="cost-value">${formatCurrency(costData.food)}</span>
      </div>
      <div class="cost-item">
        <span class="cost-label">
          <i class="fas fa-ticket"></i>
          활동비
        </span>
        <span class="cost-value">${formatCurrency(costData.activities)}</span>
      </div>
      <div class="cost-item">
        <span class="cost-label">
          <i class="fas fa-calculator"></i>
          총 예상 비용
        </span>
        <span class="cost-value" style="color: #2563eb; font-size: 1.5rem;">
          ${formatCurrency(costData.total)}
        </span>
      </div>
    `;
  }

  /**
   * Render route cost comparison
   * @param {Array} routes - Array of routes with costs
   */
  function renderRouteCostComparison(routes) {
    const container = document.getElementById('routesGrid');
    if (!container) return;

    const routesHTML = routes.map((route, index) => {
      const badge = getBadgeForRoute(route, routes);
      const costPerKm = (route.cost / parseFloat(route.distance)).toFixed(0);

      return `
        <div class="route-card" data-route-index="${index}">
          <div class="route-header">
            <div class="route-title">
              <i class="fas ${route.icon || 'fa-route'}"></i>
              ${route.name}
            </div>
            ${badge ? `<span class="route-badge ${badge.class}">${badge.text}</span>` : ''}
          </div>
          <div class="route-info">
            <div class="info-item">
              <div>
                <div class="info-label">거리</div>
                <div class="info-value">${route.distance}km</div>
              </div>
            </div>
            <div class="info-item">
              <div>
                <div class="info-label">시간</div>
                <div class="info-value">${route.duration}</div>
              </div>
            </div>
            <div class="info-item">
              <div>
                <div class="info-label">예상 비용</div>
                <div class="info-value">${formatCurrency(route.cost)}</div>
              </div>
            </div>
            <div class="info-item">
              <div>
                <div class="info-label">km당 비용</div>
                <div class="info-value">${formatCurrency(costPerKm)}</div>
              </div>
            </div>
          </div>
        </div>
      `;
    }).join('');

    container.innerHTML = routesHTML;
  }

  /**
   * Get badge for route
   */
  function getBadgeForRoute(route, allRoutes) {
    // Find fastest and cheapest
    const fastest = allRoutes.reduce((min, r) =>
      r.durationMinutes < min.durationMinutes ? r : min
    );
    const cheapest = allRoutes.reduce((min, r) =>
      r.cost < min.cost ? r : min
    );

    if (route === fastest) {
      return { text: '최단 시간', class: 'fastest' };
    } else if (route === cheapest) {
      return { text: '최저 비용', class: 'cheapest' };
    } else {
      return { text: '균형', class: 'balanced' };
    }
  }

  /**
   * Format currency
   * @param {number} amount - Amount in KRW
   * @returns {string} - Formatted string
   */
  function formatCurrency(amount) {
    if (!amount && amount !== 0) return '₩0';
    return '₩' + Math.round(amount).toLocaleString('ko-KR');
  }

  /**
   * Get budget recommendation
   * @param {number} duration - Trip duration
   * @param {Array} places - Places to visit
   * @returns {Object} - Budget recommendations
   */
  function getBudgetRecommendation(duration, places = []) {
    const budgetLevels = ['budget', 'standard', 'luxury'];

    return budgetLevels.map(level => {
      const accommodationCost = COSTS.accommodation[level] * (duration - 1);
      const foodCost = COSTS.food[level] * duration;
      const activitiesCost = calculateActivitiesCost(places);

      return {
        level,
        name: getLevelName(level),
        dailyCost: Math.round((accommodationCost + foodCost) / duration),
        totalCost: accommodationCost + foodCost + activitiesCost,
        description: getLevelDescription(level)
      };
    });
  }

  /**
   * Get level name
   */
  function getLevelName(level) {
    const names = {
      budget: '절약형',
      standard: '표준형',
      luxury: '럭셔리'
    };
    return names[level] || level;
  }

  /**
   * Get level description
   */
  function getLevelDescription(level) {
    const descriptions = {
      budget: '게스트하우스, 저렴한 식사',
      standard: '일반 호텔, 현지 레스토랑',
      luxury: '고급 호텔, 고급 레스토랑'
    };
    return descriptions[level] || '';
  }

  /**
   * Calculate daily budget
   * @param {number} totalCost - Total trip cost
   * @param {number} duration - Trip duration
   * @returns {number} - Daily budget
   */
  function calculateDailyBudget(totalCost, duration) {
    return Math.round(totalCost / duration);
  }

  /**
   * Get cost savings tips
   * @param {Object} costData - Cost data
   * @returns {Array} - Tips
   */
  function getCostSavingsTips(costData) {
    const tips = [];

    if (costData.transport > costData.total * 0.4) {
      tips.push({
        icon: 'fa-bus',
        tip: '대중교통 이용 시 교통비를 50% 이상 절약할 수 있습니다.'
      });
    }

    if (costData.accommodation > costData.total * 0.3) {
      tips.push({
        icon: 'fa-hotel',
        tip: '게스트하우스나 에어비앤비를 이용하면 숙박비를 절약할 수 있습니다.'
      });
    }

    if (costData.food > costData.total * 0.25) {
      tips.push({
        icon: 'fa-utensils',
        tip: '현지 식당이나 마트를 이용하면 식비를 줄일 수 있습니다.'
      });
    }

    return tips;
  }

  /**
   * Destroy chart instance
   */
  function destroyChart() {
    if (chartInstance) {
      chartInstance.destroy();
      chartInstance = null;
    }
  }

  // Public API
  return {
    calculateTripCost,
    calculateTransportCost,
    compareRouteCosts,
    renderCostChart,
    renderCostSummary,
    renderRouteCostComparison,
    formatCurrency,
    getBudgetRecommendation,
    calculateDailyBudget,
    getCostSavingsTips,
    destroyChart
  };
})();
