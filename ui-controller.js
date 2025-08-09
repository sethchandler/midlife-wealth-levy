/**
 * UI Controller for Economic Model Interface
 * Handles DOM interactions, input validation, and coordination
 */

class UIController {
  constructor() {
    this.chartManager = new ChartManager();
    this.computationTimeoutId = null;
    this.DEBOUNCE_DELAY = 100; // milliseconds
  }

  /**
   * Initialize the UI controller
   */
  initialize() {
    this.setupInputSynchronization();
    this.chartManager.initializeCharts();
    this.computeAndRender(); // Initial render
  }

  /**
   * Setup bidirectional sync between numeric inputs and sliders
   */
  setupInputSynchronization() {
    const inputPairs = [
      ["r", "r_slider"],
      ["rho", "rho_slider"],
      ["T1", "T1_slider"],
      ["T2", "T2_slider"],
      ["gamma", "gamma_slider"],
      ["eta", "eta_slider"],
      ["beta", "beta_slider"],
      ["y", "y_slider"],
      ["zeta", "zeta_slider"],
      ["tau", "tau_slider"]
    ];

    inputPairs.forEach(([numId, sliderId]) => {
      const numInput = document.getElementById(numId);
      const sliderInput = document.getElementById(sliderId);

      if (!numInput || !sliderInput) {
        console.error(`Missing input elements: ${numId} or ${sliderId}`);
        return;
      }

      // Debounced computation trigger
      const triggerComputation = () => {
        clearTimeout(this.computationTimeoutId);
        this.computationTimeoutId = setTimeout(() => {
          this.computeAndRender();
        }, this.DEBOUNCE_DELAY);
      };

      // Sync numeric input to slider
      numInput.addEventListener('input', () => {
        const value = parseFloat(numInput.value);
        if (isFinite(value)) {
          sliderInput.value = value;
          triggerComputation();
        }
      });

      // Sync slider to numeric input
      sliderInput.addEventListener('input', () => {
        numInput.value = sliderInput.value;
        triggerComputation();
      });
    });
  }


  /**
   * Update status display
   */
  updateStatus(params) {
    const statusElement = document.getElementById('status');
    if (statusElement) {
      statusElement.innerHTML = `g=${format(params.g)}  \\\\(\\kappa\\\\)=${format(params.kappa)}  \\\\(\\alpha\\\\)=${format(params.alpha)}  \\\\(\\beta\\\\)=${format(params.beta)}`;
      this.renderKaTeX(statusElement);
    }
  }

  /**
   * Render KaTeX in a specific element
   */
  renderKaTeX(element) {
    if (typeof renderMathInElement !== 'undefined') {
      // Add timing safety to ensure DOM is settled
      setTimeout(() => {
        renderMathInElement(element, {
          delimiters: [
            {left: '$$', right: '$$', display: true},
            {left: '\\(', right: '\\)', display: false},
            {left: '\\[', right: '\\]', display: true}
          ],
          throwOnError: false
        });
      }, 0);
    }
  }

  /**
   * Update warnings display
   */
  updateWarnings(params) {
    const warningsElement = document.getElementById('warnings');
    if (!warningsElement) return;

    let warnings = [];

    // Check for numerical instability
    if (Math.abs(params.gamma - 1) < 1e-3 || Math.abs(params.eta - 1) < 1e-3) {
      warnings.push('Near log-utility (γ≈1 or η≈1): numeric stability can improve with exact log formulas.');
    }

    // Check for high levy rates
    if (params.tau >= 0.95) {
      warnings.push('τ is very high; feasibility near the levy may fail.');
    }

    // Check for zero interest rate
    if (params.r === 0) {
      warnings.push('r=0: the y/r transform is undefined; please pick r>0.');
    }

    // Check for negative interest rates
    if (params.r <= 0) {
      warnings.push('Nonpositive r reduces numerical robustness.');
    }

    warningsElement.textContent = warnings.join('  ');
  }

  /**
   * Update errors display
   */
  updateErrors(errorMessage = '') {
    const errorsElement = document.getElementById('errors');
    if (errorsElement) {
      errorsElement.textContent = errorMessage;
    }
  }

  /**
   * Update equation displays with computed values
   */
  updateEquations(params, results) {
    const { WT, K1v, K2v } = results.solution;
    const { A, B } = results.levels;

    // Derived parameters
    const derivedElement = document.getElementById('eq_derived');
    if (derivedElement) {
      derivedElement.innerHTML = 
        `g=${format(params.g)}, \\\\(\\kappa\\\\)=${format(params.kappa)}, R=${format(params.R)}, P(T1)=${format(params.P(params.T1))}, P(T2)=${format(params.P(params.T2))}`;
      console.log('Derived element HTML:', derivedElement.innerHTML);
      this.renderKaTeX(derivedElement);
    }

    // Terminal equation
    const terminalElement = document.getElementById('eq_terminal_nums');
    if (terminalElement) {
      const rhsValue = params.R * (1 - params.tau) * (params.w0 + params.y / params.r) + 
                      Math.exp(params.r * params.T2) * params.tau * (params.y / params.r) - (params.y / params.r);
      const lhsValue = WT + (K1v + K2v) * Math.pow(WT, params.alpha);
      terminalElement.innerHTML = 
        `\\\\(\\alpha\\\\)=${format(params.alpha)};  RHS=${format(rhsValue)};  \\\\(W_T\\\\)≈${format(WT)};  LHS(\\\\(W_T\\\\))=${format(lhsValue)}`;
      this.renderKaTeX(terminalElement);
    }

    // K coefficients
    const kElement = document.getElementById('eq_K_nums');
    if (kElement) {
      kElement.innerHTML = `\\\\(K_1(\\tau)\\\\)=${format(K1v)},  \\\\(K_2\\\\)=${format(K2v)}`;
      this.renderKaTeX(kElement);
    }

    // Consumption levels
    const levelsElement = document.getElementById('eq_levels_nums');
    if (levelsElement) {
      levelsElement.innerHTML = `A=${format(A)},  B=${format(B)}`;
      this.renderKaTeX(levelsElement);
    }

    // Wealth evolution
    const wealthElement = document.getElementById('eq_we_nums');
    if (wealthElement) {
      const X0 = params.w0 + params.y / params.r;
      const X1m = Math.exp(params.r * params.T1) * (X0 - A * params.P(params.T1));
      const X1p = (1 - params.tau) * X1m + params.tau * (params.y / params.r);
      wealthElement.innerHTML = 
        `\\\\(X_0\\\\)=${format(X0)},  \\\\(X(T_1^-)\\\\)=${format(X1m)},  \\\\(X(T_1^+)\\\\)=${format(X1p)},  \\\\(W(T_1^-)\\\\)=${format(X1m - params.y / params.r)},  \\\\(W(T_1^+)\\\\)=${format(X1p - params.y / params.r)}`;
      this.renderKaTeX(wealthElement);
    }
  }

  /**
   * Check constraints and update warnings
   */
  checkConstraints(params, trajectory) {
    const warningsElement = document.getElementById('warnings');
    let currentWarnings = warningsElement ? warningsElement.textContent : '';

    // Check borrowing constraint
    const minW = Math.min(...trajectory.W);
    if (minW < params.zeta - 1e-8) {
      currentWarnings += `  Borrowing floor violated: min W(t)=${format(minW)} < ζ=${format(params.zeta)}.`;
    }

    // Check levy feasibility
    const levyFeasible = (trajectory.W1m >= params.zeta / (1 - params.tau));
    if (!levyFeasible) {
      currentWarnings += `  Levy infeasible: W(T1-)=${format(trajectory.W1m)} < ζ/(1-τ)=${format(params.zeta / (1 - params.tau))}.`;
    }

    if (warningsElement) {
      warningsElement.textContent = currentWarnings;
    }
  }

  /**
   * Main computation and rendering function
   */
  computeAndRender() {
    try {
      // Clear previous errors
      this.updateErrors();

      // Parse and validate parameters
      const params = toParams();
      
      
      // Update status
      this.updateStatus(params);
      this.updateWarnings(params);

      // Validate critical parameters
      if (params.r <= 0) {
        throw new Error("This version requires r>0 to use the X=W+y/r transform cleanly.");
      }

      // Solve the model
      const solution = solveWT(params);
      const levels = levelsFromWT(solution.WT, params);
      const trajectory = trajectories(params, solution.WT, levels.A, levels.B, 600);

      // Check constraints
      this.checkConstraints(params, trajectory);

      // Update charts
      try {
        this.chartManager.updateConsumptionChart(trajectory.times, trajectory.c);
        this.chartManager.updateWealthChart(trajectory.times, trajectory.W);

        // Generate tau sweep for comparative statics
        const tauSweepData = tauSweep(params, 140);
        this.chartManager.updateTauChart(tauSweepData);
      } catch (error) {
        console.error('Chart update failed:', error);
      }

      // Update equation displays
      this.updateEquations(params, { solution, levels });

    } catch (error) {
      console.error('Computation failed:', error);
      this.updateErrors(error.message || String(error));
    }
  }

  /**
   * Cleanup resources
   */
  destroy() {
    if (this.computationTimeoutId) {
      clearTimeout(this.computationTimeoutId);
    }
    this.chartManager.destroy();
  }
}

// Initialize after a short delay to ensure KaTeX has time to render
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    const uiController = new UIController();
    uiController.initialize();
    
    // Cleanup on page unload
    window.addEventListener('beforeunload', () => {
      uiController.destroy();
    });
  }, 100);
});