/**
 * Chart Manager for Economic Model Visualization
 * Handles Chart.js instances and updates
 */

class ChartManager {
  constructor() {
    this.charts = {};
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
   * Update consumption chart with trajectory data
   */
  updateConsumptionChart(times, consumptionData) {
    if (!this.charts.consumption) {
      throw new Error('Consumption chart not initialized');
    }

    this.charts.consumption.data.labels = times;
    this.charts.consumption.data.datasets[0].data = consumptionData;
    this.charts.consumption.update('none'); // No animation for better performance
  }

  /**
   * Update wealth chart with trajectory data
   */
  updateWealthChart(times, wealthData) {
    if (!this.charts.wealth) {
      console.error('Wealth chart not initialized');
      return;
    }

    this.charts.wealth.data.labels = times;
    this.charts.wealth.data.datasets[0].data = wealthData;
    this.charts.wealth.update('none'); // No animation for better performance
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

    this.charts.tau.data.labels = taus;
    this.charts.tau.data.datasets[0].data = W1m;
    this.charts.tau.data.datasets[1].data = W1p;
    this.charts.tau.data.datasets[2].data = WT;
    this.charts.tau.update('none'); // No animation for better performance
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