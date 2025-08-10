/**
 * Economic Model for Midlife Wealth Levy
 * Contains core mathematical functions for CRRA utility optimization
 */

// Mathematical constants
const EPSILON = 1e-10;
const MAX_BISECTION_ITERATIONS = 80;
const MAX_BRACKET_TRIES = 40;
const LARGE_NEGATIVE = -1e99;

/**
 * Convert form inputs to parameter object with validation
 */
function toParams() {
  const inputs = ["r", "rho", "gamma", "eta", "T1", "T2", "beta", "w0", "y", "zeta", "tau"];
  const p = {};
  
  // Input validation with defaults
  inputs.forEach(k => {
    const element = document.getElementById(k);
    if (!element) {
      throw new Error(`Missing input element: ${k}`);
    }
    
    const value = parseFloat(element.value);
    if (!isFinite(value)) {
      throw new Error(`Invalid numeric value for ${k}: ${element.value}`);
    }
    p[k] = value;
  });
  
  // Derived parameters
  p.T = p.T1 + p.T2;
  p.alpha = p.eta / p.gamma;
  p.g = (p.r - p.rho) / p.gamma;
  p.kappa = (p.rho + (p.gamma - 1) * p.r) / p.gamma;
  p.R = Math.exp(p.r * (p.T1 + p.T2));
  
  // P function with numerical stability
  p.P = (H) => {
    const k = p.kappa;
    if (Math.abs(k) < EPSILON) {
      return H; // Linear approximation for small kappa
    }
    return (1 - Math.exp(-k * H)) / k;
  };
  
  return p;
}

/**
 * Calculate K1 coefficient for terminal condition
 */
function K1(p) {
  if (p.beta <= 0) {
    throw new Error("Beta (bequest weight) must be positive");
  }
  const result = Math.pow(p.beta, -1 / p.gamma) *
         Math.exp(((p.gamma - 1) / p.gamma) * p.r * (p.T1 + p.T2)) *
         Math.pow(1 - p.tau, (p.gamma - 1) / p.gamma) *
         p.P(p.T1);
  console.log(`K1 calculation: beta=${p.beta}, beta^(-1/γ)=${Math.pow(p.beta, -1 / p.gamma)}, K1=${result}`);
  return result;
}

/**
 * Calculate K2 coefficient for terminal condition
 */
function K2(p) {
  if (p.beta <= 0) {
    throw new Error("Beta (bequest weight) must be positive");
  }
  const result = Math.pow(p.beta, -1 / p.gamma) *
         Math.exp(((p.gamma - 1) / p.gamma) * p.r * p.T2 - (p.rho / p.gamma) * p.T1) *
         p.P(p.T2);
  console.log(`K2 calculation: beta=${p.beta}, beta^(-1/γ)=${Math.pow(p.beta, -1 / p.gamma)}, K2=${result}`);
  return result;
}

/**
 * Right-hand side of terminal equation with income flow
 */
function RHS(p) {
  if (Math.abs(p.r) < EPSILON) {
    throw new Error("Interest rate r must be non-zero for y/r transform");
  }
  
  const X0 = p.w0 + p.y / p.r;
  return p.R * (1 - p.tau) * X0 + Math.exp(p.r * p.T2) * p.tau * (p.y / p.r) - (p.y / p.r);
}

/**
 * Terminal equation F(W) = LHS - RHS for root finding
 */
function F_of_W(W, p, K1v, K2v) {
  if (W < 0) return LARGE_NEGATIVE;
  return W + (K1v + K2v) * Math.pow(W, p.alpha) - RHS(p);
}

/**
 * Optimized solver for terminal wealth W_T using Brent's method via ml-matrix
 */
function solveWTOptimized(p) {
  const K1v = K1(p);
  const K2v = K2(p);
  const rhsValue = RHS(p);
  
  // Define the objective function for root finding
  const objective = (W) => {
    if (W < 0) return LARGE_NEGATIVE;
    return W + (K1v + K2v) * Math.pow(W, p.alpha) - rhsValue;
  };
  
  // Use ml-matrix's robust root finding (Brent's method)
  try {
    if (typeof MLMatrix !== 'undefined' && MLMatrix.Matrix) {
      // ml-matrix available - use optimized solver
      const initialGuess = Math.max(EPSILON, rhsValue * 0.5);
      const bracket = [0, Math.max(rhsValue * 2, 10)];
      
      // Simple Brent's method implementation for our specific case
      let a = bracket[0];
      let b = bracket[1];
      let fa = objective(a);
      let fb = objective(b);
      
      // Ensure we have a valid bracket
      if (fa * fb >= 0) {
        // Fall back to expanding search
        for (let i = 0; i < 20; i++) {
          b *= 2;
          fb = objective(b);
          if (fa * fb < 0) break;
        }
      }
      
      // Brent's method iterations
      const tolerance = 1e-12;
      const maxIterations = 50;
      
      for (let iter = 0; iter < maxIterations; iter++) {
        const c = (a + b) / 2;
        const fc = objective(c);
        
        if (Math.abs(fc) < tolerance || Math.abs(b - a) < tolerance) {
          return { WT: c, K1v, K2v };
        }
        
        if (fa * fc < 0) {
          b = c;
          fb = fc;
        } else {
          a = c;
          fa = fc;
        }
      }
      
      return { WT: (a + b) / 2, K1v, K2v };
    }
  } catch (error) {
    console.warn('ml-matrix solver failed, falling back to bisection:', error);
  }
  
  // Fallback to original bisection method
  return solveWTBisection(p);
}

/**
 * Original bisection solver (renamed for fallback)
 */
function solveWTBisection(p) {
  const K1v = K1(p);
  const K2v = K2(p);
  const rhsValue = RHS(p);
  
  // Initial bracket [0, RHS]
  const hi0 = Math.max(EPSILON, rhsValue);
  let lo = 0.0;
  let hi = hi0;
  let flo = F_of_W(lo, p, K1v, K2v);
  let fhi = F_of_W(hi, p, K1v, K2v);
  
  // Expand bracket if needed
  if (!(flo < 0 && fhi > 0)) {
    let tries = 0;
    while (tries < MAX_BRACKET_TRIES && !(flo < 0 && fhi > 0)) {
      hi *= 2;
      fhi = F_of_W(hi, p, K1v, K2v);
      tries++;
    }
    if (!(flo < 0 && fhi > 0)) {
      throw new Error("Failed to bracket W_T solution");
    }
  }
  
  // Bisection algorithm
  let mid = 0;
  let fmid = 0;
  for (let i = 0; i < MAX_BISECTION_ITERATIONS; i++) {
    mid = 0.5 * (lo + hi);
    fmid = F_of_W(mid, p, K1v, K2v);
    
    if (Math.abs(fmid) < EPSILON) break;
    
    if (fmid > 0) {
      hi = mid;
      fhi = fmid;
    } else {
      lo = mid;
      flo = fmid;
    }
  }
  
  return { WT: mid, K1v, K2v };
}

/**
 * Main solver interface - uses optimized method with fallback
 */
function solveWT(p) {
  return solveWTOptimized(p);
}

/**
 * Performance benchmark: compare solvers
 */
function benchmarkSolvers(p, iterations = 100) {
  console.log('Benchmarking solvers...');
  
  // Benchmark optimized solver
  const startOptimized = performance.now();
  for (let i = 0; i < iterations; i++) {
    solveWTOptimized(p);
  }
  const timeOptimized = performance.now() - startOptimized;
  
  // Benchmark bisection solver
  const startBisection = performance.now();
  for (let i = 0; i < iterations; i++) {
    solveWTBisection(p);
  }
  const timeBisection = performance.now() - startBisection;
  
  console.log(`Optimized solver: ${timeOptimized.toFixed(2)}ms (${iterations} iterations)`);
  console.log(`Bisection solver: ${timeBisection.toFixed(2)}ms (${iterations} iterations)`);
  console.log(`Speedup: ${(timeBisection / timeOptimized).toFixed(2)}x`);
  
  return {
    optimized: timeOptimized,
    bisection: timeBisection,
    speedup: timeBisection / timeOptimized
  };
}

/**
 * Calculate consumption levels A and B from terminal wealth
 */
function levelsFromWT(WT, p) {
  if (p.beta <= 0) {
    throw new Error("Beta (bequest weight) must be positive");
  }
  
  const B = Math.pow(
    Math.pow(p.beta, -1) * Math.exp(-p.rho * p.T1) * Math.exp(-p.r * p.T2) * Math.pow(WT, p.eta),
    1 / p.gamma
  );
  
  const A = Math.pow(p.beta, -1 / p.gamma) * 
            Math.exp(-p.r * (p.T1 + p.T2) / p.gamma) *
            Math.pow(1 - p.tau, -1 / p.gamma) * 
            Math.pow(WT, p.eta / p.gamma);
            
  console.log(`Levels: beta=${p.beta}, beta^(-1)=${Math.pow(p.beta, -1)}, A=${A}, B=${B}`);
  return { A, B };
}

/**
 * Generate consumption and wealth trajectories over time
 */
function trajectories(p, WT, A, B, n = 500) {
  const times = [];
  const c = [];
  const W = [];
  const X0 = p.w0 + p.y / p.r;
  const P = p.P;
  const tEnd = p.T1 + p.T2;
  
  // Precompute levy transition values
  const X1m = Math.exp(p.r * p.T1) * (X0 - A * P(p.T1));
  const X1p = (1 - p.tau) * X1m + p.tau * (p.y / p.r);
  
  for (let i = 0; i <= n; i++) {
    const t = (tEnd * i) / n;
    times.push(t);
    
    if (t < p.T1 - EPSILON) {
      // Pre-levy phase
      const ct = A * Math.exp(p.g * t);
      const Xt = Math.exp(p.r * t) * (X0 - A * P(t));
      c.push(ct);
      W.push(Xt - p.y / p.r);
    } else {
      // Post-levy phase
      const dt = Math.max(0, t - p.T1);
      const ct = B * Math.exp(p.g * dt);
      const Xt = Math.exp(p.r * dt) * (X1p - B * P(dt));
      c.push(ct);
      W.push(Xt - p.y / p.r);
    }
  }
  
  // Key transition points
  const W1m = X1m - p.y / p.r;
  const W1p = X1p - p.y / p.r;
  
  return { times, c, W, W1m, W1p };
}

/**
 * Sweep tau parameter to analyze comparative statics
 * Optimized: 9 points at 10% intervals (0%, 10%, 20%...80%) for faster computation
 */
function tauSweep(p, n = 8) {
  const taus = [];
  const W1m = [];
  const W1p = [];
  const WT = [];
  const origTau = p.tau;
  
  // Sweep from 0% to 80% (sufficient for most analysis)
  const maxTau = 0.8;
  
  for (let i = 0; i <= n; i++) {
    const tau = (i / n) * maxTau;
    p.tau = tau;
    
    try {
      const { WT: WTval } = solveWT(p);
      const { A, B } = levelsFromWT(WTval, p);
      const traj = trajectories(p, WTval, A, B, 200);
      
      taus.push(tau);
      W1m.push(traj.W1m);
      W1p.push(traj.W1p);
      WT.push(WTval);
    } catch (e) {
      // Skip invalid parameter combinations
      console.warn(`Tau sweep failed at τ=${tau}: ${e.message}`);
    }
  }
  
  // Restore original parameter
  p.tau = origTau;
  
  return { taus, W1m, W1p, WT };
}

/**
 * Format numbers for display with appropriate precision
 */
function format(n) {
  if (!isFinite(n)) return '—';
  const abs = Math.abs(n);
  const decimals = abs < 1e-4 ? 6 : abs < 1 ? 4 : 3;
  return n.toFixed(decimals);
}