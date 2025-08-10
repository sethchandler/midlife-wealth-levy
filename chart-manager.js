/**
 * Chart Manager for Economic Model Visualization
 * Handles Chart.js instances and updates
 */

class ChartManager {
  constructor() {
    this.charts = {};
    this.scalingModes = {
      consumption: 'auto',
      wealth: 'auto', 
      tau: 'auto'
    };
    this.baselines = {};
    this.currentRanges = {};
  }

  /**
   * Initialize all charts at once - simple and reliable
   */
  initializeCharts() {
    try {
      // Consumption chart
      this.charts.consumption = new Chart(document.getElementById('consChart').getContext('2d'), {
        type: 'line',
        data: {
          labels: [],
          datasets: [{
            label: 'c(t)',
            data: [],
            borderWidth: 2,
            pointRadius: 0,
            tension: 0.1,
            borderColor: '#22c55e'
          }]
        },
        options: {
          responsive: true,
          aspectRatio: 2.5,
          scales: {
            x: { 
              title: { display: true, text: 't (years)' },
              type: 'linear',
              ticks: {
                stepSize: 5,
                callback: function(value) {
                  return Number.isInteger(value) && value % 5 === 0 ? value.toString() : '';
                }
              }
            },
            y: { title: { display: true, text: 'c(t)' } }
          },
          plugins: {
            legend: { display: false }
          }
        }
      });

      // Wealth chart
      this.charts.wealth = new Chart(document.getElementById('wealthChart').getContext('2d'), {
        type: 'line',
        data: {
          labels: [],
          datasets: [{
            label: 'W(t)',
            data: [],
            borderWidth: 2,
            pointRadius: 0,
            tension: 0.1,
            borderColor: '#3b82f6'
          }]
        },
        options: {
          responsive: true,
          aspectRatio: 2.5,
          scales: {
            x: { 
              title: { display: true, text: 't (years)' },
              type: 'linear',
              ticks: {
                stepSize: 5,
                callback: function(value) {
                  return Number.isInteger(value) && value % 5 === 0 ? value.toString() : '';
                }
              }
            },
            y: { title: { display: true, text: 'W(t)' } }
          },
          plugins: {
            legend: { display: false }
          }
        }
      });

      // Tau chart
      this.charts.tau = new Chart(document.getElementById('tauChart').getContext('2d'), {
        type: 'line',
        data: {
          labels: [],
          datasets: [
            {
              label: 'W(T1-)',
              data: [],
              borderWidth: 2,
              pointRadius: 0,
              borderColor: '#ef4444'
            },
            {
              label: 'W(T1+)',
              data: [],
              borderWidth: 2,
              pointRadius: 0,
              borderColor: '#f59e0b'
            },
            {
              label: 'W(T)',
              data: [],
              borderWidth: 2,
              pointRadius: 0,
              borderColor: '#8b5cf6'
            }
          ]
        },
        options: {
          responsive: true,
          aspectRatio: 2.5,
          scales: {
            x: { 
              title: { display: true, text: 'τ (levy rate)' },
              ticks: {
                stepSize: 0.1,
                callback: function(value) {
                  return (value * 10) % 1 === 0 ? value.toFixed(1) : '';
                }
              }
            },
            y: { title: { display: true, text: 'Wealth' } }
          }
        }
      });

      console.log('All charts initialized successfully');
    } catch (error) {
      console.error('Failed to initialize charts:', error);
      throw new Error('Chart initialization failed. Please check Chart.js is loaded.');
    }
  }

  /**
   * Set scaling mode for a specific chart
   */
  setScalingMode(chartType, mode) {
    this.scalingModes[chartType] = mode;
    if (mode === 'baseline') {
      this.setBaseline(chartType);
    }
  }

  /**
   * Set current data range as baseline for a chart
   */
  setBaseline(chartType) {
    if (this.currentRanges[chartType]) {
      this.baselines[chartType] = { ...this.currentRanges[chartType] };
    }
  }

  /**
   * Calculate data range from array
   */
  calculateRange(data) {
    if (!data || data.length === 0) return { min: 0, max: 1 };
    
    const validData = data.filter(val => isFinite(val));
    if (validData.length === 0) return { min: 0, max: 1 };
    
    const min = Math.min(...validData);
    const max = Math.max(...validData);
    
    // Add 5% padding
    const padding = (max - min) * 0.05;
    return {
      min: min - padding,
      max: max + padding
    };
  }

  /**
   * Determine if chart should rescale based on mode and thresholds
   */
  shouldRescale(chartType, newRange) {
    const mode = this.scalingModes[chartType];
    const currentRange = this.currentRanges[chartType];
    
    if (mode === 'auto') return true;
    if (mode === 'baseline') return false;
    if (!currentRange) return true;
    
    // Sticky modes - check if change exceeds threshold
    const threshold = mode === 'sticky25' ? 0.25 : 0.50;
    const currentSpan = currentRange.max - currentRange.min;
    const newSpan = newRange.max - newRange.min;
    
    const minChange = Math.abs(newRange.min - currentRange.min) / currentSpan;
    const maxChange = Math.abs(newRange.max - currentRange.max) / currentSpan;
    
    return minChange > threshold || maxChange > threshold;
  }

  /**
   * Get appropriate y-axis range for chart based on scaling mode
   */
  getYAxisRange(chartType, data) {
    const newRange = this.calculateRange(data);
    const mode = this.scalingModes[chartType];
    
    if (mode === 'baseline' && this.baselines[chartType]) {
      return this.baselines[chartType];
    }
    
    if (this.shouldRescale(chartType, newRange)) {
      this.currentRanges[chartType] = newRange;
      return newRange;
    }
    
    return this.currentRanges[chartType] || newRange;
  }


  /**
   * Update consumption chart with trajectory data
   */
  updateConsumptionChart(times, consumptionData) {
    if (!this.charts.consumption) {
      throw new Error('Consumption chart not initialized');
    }

    // Apply scaling mode
    const yRange = this.getYAxisRange('consumption', consumptionData);
    this.charts.consumption.options.scales.y.min = yRange.min;
    this.charts.consumption.options.scales.y.max = yRange.max;

    this.charts.consumption.data.labels = times;
    this.charts.consumption.data.datasets[0].data = consumptionData;
    this.charts.consumption.update('none'); // No animation for better performance

    // Update value display
    this.updateValueDisplay('cons', yRange);
  }

  /**
   * Update wealth chart with trajectory data
   */
  updateWealthChart(times, wealthData) {
    if (!this.charts.wealth) {
      console.error('Wealth chart not initialized');
      return;
    }

    // Apply scaling mode
    const yRange = this.getYAxisRange('wealth', wealthData);
    this.charts.wealth.options.scales.y.min = yRange.min;
    this.charts.wealth.options.scales.y.max = yRange.max;

    this.charts.wealth.data.labels = times;
    this.charts.wealth.data.datasets[0].data = wealthData;
    this.charts.wealth.update('none'); // No animation for better performance

    // Update value display
    this.updateValueDisplay('wealth', yRange);
  }

  /**
   * Update tau comparative statics chart
   */
  updateTauChart(tauData) {
    if (!this.charts.tau) {
      console.error('Tau chart not initialized');
      return;
    }

    const { taus, W1m, W1p, WT } = tauData;
    
    // Combine all tau data for range calculation
    const allTauValues = [...W1m, ...W1p, ...WT];
    const yRange = this.getYAxisRange('tau', allTauValues);
    this.charts.tau.options.scales.y.min = yRange.min;
    this.charts.tau.options.scales.y.max = yRange.max;

    this.charts.tau.data.labels = taus;
    this.charts.tau.data.datasets[0].data = W1m;
    this.charts.tau.data.datasets[1].data = W1p;
    this.charts.tau.data.datasets[2].data = WT;
    this.charts.tau.update('none'); // No animation for better performance

    // Update value display
    this.updateValueDisplay('tau', yRange);
  }

  /**
   * Update value display for a chart
   */
  updateValueDisplay(chartPrefix, range) {
    const element = document.getElementById(`${chartPrefix}-range`);
    if (element) {
      const formatNum = (n) => {
        if (Math.abs(n) < 0.01) return n.toFixed(4);
        if (Math.abs(n) < 1) return n.toFixed(3);
        return n.toFixed(2);
      };
      element.textContent = `[${formatNum(range.min)}, ${formatNum(range.max)}]`;
    }
  }

  /**
   * Reset chart to auto scaling mode
   */
  resetToAuto(chartType) {
    this.scalingModes[chartType] = 'auto';
    delete this.currentRanges[chartType];
    delete this.baselines[chartType];
    
    // Update the dropdown
    const select = document.getElementById(`${chartType === 'consumption' ? 'cons' : chartType}-y-mode`);
    if (select) {
      select.value = 'auto';
    }
  }

  /**
   * Destroy all charts and free memory
   */
  destroy() {
    Object.values(this.charts).forEach(chart => {
      if (chart && typeof chart.destroy === 'function') {
        chart.destroy();
      }
    });
    this.charts = {};
  }
}