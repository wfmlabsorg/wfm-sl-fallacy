/**
 * Erlang C calculations for service level modeling
 */

/** Factorial using Stirling's approximation for large n */
function lnFactorial(n: number): number {
  if (n <= 1) return 0;
  // Use lookup for small values
  if (n <= 20) {
    let result = 0;
    for (let i = 2; i <= n; i++) result += Math.log(i);
    return result;
  }
  // Stirling's approximation
  return n * Math.log(n) - n + 0.5 * Math.log(2 * Math.PI * n);
}

/**
 * Erlang C probability (probability of waiting)
 * @param agents - Number of agents (N)
 * @param trafficIntensity - Offered load in Erlangs (A)
 */
export function erlangC(agents: number, trafficIntensity: number): number {
  if (agents <= trafficIntensity) return 1; // Unstable
  const N = Math.floor(agents);
  const A = trafficIntensity;

  // Calculate using logarithms to avoid overflow
  const lnNumerator = N * Math.log(A) - lnFactorial(N);

  let lnSumTerms: number[] = [];
  for (let k = 0; k <= N - 1; k++) {
    lnSumTerms.push(k * Math.log(A) - lnFactorial(k));
  }

  const maxLnTerm = Math.max(...lnSumTerms, lnNumerator);

  let sumExp = 0;
  for (const lnT of lnSumTerms) {
    sumExp += Math.exp(lnT - maxLnTerm);
  }

  const lastTerm = Math.exp(lnNumerator - maxLnTerm) * (N / (N - A));

  const pW = lastTerm / (sumExp + lastTerm);
  return Math.max(0, Math.min(1, pW));
}

/**
 * Service Level: probability of answering within threshold
 * @param agents - Number of agents
 * @param trafficIntensity - Offered load in Erlangs
 * @param aht - Average Handle Time in seconds
 * @param threshold - Answer threshold in seconds
 */
export function serviceLevel(
  agents: number,
  trafficIntensity: number,
  aht: number,
  threshold: number
): number {
  if (agents <= trafficIntensity) return 0;
  const pW = erlangC(agents, trafficIntensity);
  const exponent = -((agents - trafficIntensity) * threshold) / aht;
  return 1 - pW * Math.exp(exponent);
}

/**
 * Average Speed of Answer in seconds
 */
export function averageSpeedOfAnswer(
  agents: number,
  trafficIntensity: number,
  aht: number
): number {
  if (agents <= trafficIntensity) return Infinity;
  const pW = erlangC(agents, trafficIntensity);
  return (pW * aht) / (agents - trafficIntensity);
}

/**
 * Occupancy rate
 */
export function occupancy(agents: number, trafficIntensity: number): number {
  return trafficIntensity / agents;
}

/**
 * Find required agents for a target service level
 * @param targetSL - Target service level (0-1)
 * @param trafficIntensity - Offered load in Erlangs
 * @param aht - Average Handle Time in seconds
 * @param threshold - Answer threshold in seconds
 */
export function agentsForServiceLevel(
  targetSL: number,
  trafficIntensity: number,
  aht: number,
  threshold: number
): number {
  let agents = Math.ceil(trafficIntensity) + 1;
  while (agents < trafficIntensity * 3) {
    const sl = serviceLevel(agents, trafficIntensity, aht, threshold);
    if (sl >= targetSL) return agents;
    agents++;
  }
  return agents;
}

export interface SLScenario {
  label: string;
  threshold: number; // seconds
  requiredAgents: number;
  serviceLevel: number;
  asa: number;
  occupancy: number;
  agentDiff: number;
  pctDiff: number;
}

/**
 * Calculate staffing across multiple SL thresholds
 */
export function calculateSLScenarios(
  trafficIntensity: number,
  aht: number,
  targetSLPct: number = 0.80,
  thresholds: number[] = [20, 30, 60, 90, 120]
): SLScenario[] {
  const scenarios: SLScenario[] = [];
  let baselineAgents = 0;

  for (const threshold of thresholds) {
    const agents = agentsForServiceLevel(targetSLPct, trafficIntensity, aht, threshold);
    const sl = serviceLevel(agents, trafficIntensity, aht, threshold);
    const asa = averageSpeedOfAnswer(agents, trafficIntensity, aht);
    const occ = occupancy(agents, trafficIntensity);

    if (threshold === thresholds[0]) baselineAgents = agents;

    scenarios.push({
      label: `80/${threshold}`,
      threshold,
      requiredAgents: agents,
      serviceLevel: sl,
      asa,
      occupancy: occ,
      agentDiff: agents - baselineAgents,
      pctDiff: baselineAgents > 0 ? ((agents - baselineAgents) / baselineAgents) * 100 : 0,
    });
  }

  return scenarios;
}

export interface HiddenCosts {
  attritionCost: number;
  abandonmentCost: number;
  ahtCreepCost: number;
  clvErosionCost: number;
  totalHiddenCost: number;
}

export interface CostAnalysis {
  visibleSavings: number;
  hiddenCosts: HiddenCosts;
  netImpact: number;
  baselineOccupancy: number;
  newOccupancy: number;
  baselineASA: number;
  newASA: number;
  agentsRemoved: number;
}

/**
 * Calculate the full P&L impact of loosening service level
 */
export function calculateCostAnalysis(
  baselineAgents: number,
  newAgents: number,
  trafficIntensity: number,
  aht: number,
  loadedCostPerAgent: number,
  callsPerHour: number,
  revenuePerContact: number,
  customerBase: number,
  clv: number,
  operatingHoursPerYear: number = 2080
): CostAnalysis {
  const agentsRemoved = baselineAgents - newAgents;
  const visibleSavings = agentsRemoved * loadedCostPerAgent;

  // Occupancy
  const baseOcc = occupancy(baselineAgents, trafficIntensity);
  const newOcc = occupancy(newAgents, trafficIntensity);

  // ASA
  const baseASA = averageSpeedOfAnswer(baselineAgents, trafficIntensity, aht);
  const newASA = averageSpeedOfAnswer(newAgents, trafficIntensity, aht);

  // Cost 1: Attrition from occupancy rise
  const incrementalAttritionRate = Math.max(0, (newOcc - baseOcc)) * 0.5; // ~5% per 10% occ increase
  const attritionDepartures = newAgents * incrementalAttritionRate;
  const replacementCost = 15000; // per departure
  const attritionCost = attritionDepartures * replacementCost;

  // Cost 2: Abandonment and lost revenue
  const baseAbandonRate = 0.02; // 2% at 80/20
  const asaRatio = Math.min(newASA / Math.max(baseASA, 1), 10);
  const newAbandonRate = Math.min(baseAbandonRate * asaRatio, 0.15);
  const incrementalAbandons = callsPerHour * (newAbandonRate - baseAbandonRate);
  const noCallbackRate = 0.30;
  const lostContactsPerHour = incrementalAbandons * noCallbackRate;
  const abandonmentCost = lostContactsPerHour * revenuePerContact * operatingHoursPerYear;

  // Cost 3: AHT creep (5-15% increase from long waits)
  const ahtCreepPct = Math.min(0.15, Math.max(0, (newASA - baseASA) / 100) * 0.08);
  const newAHT = aht * (1 + ahtCreepPct);
  const newTrafficIntensity = (callsPerHour * newAHT) / 3600;
  const additionalAgentsNeeded = Math.max(0, agentsForServiceLevel(0.80, newTrafficIntensity, newAHT, 120) - newAgents);
  const ahtCreepCost = additionalAgentsNeeded * loadedCostPerAgent * 0.3; // overtime premium

  // Cost 4: CLV erosion (per wiki: 5% of customerBase contacts experience long wait, 3% churn)
  const pctExperiencingLongWait = 0.05;
  const churnRate = 0.03;
  const attributionConfidence = 0.20;
  const incrementalChurn = customerBase * pctExperiencingLongWait * churnRate;
  const clvErosionCost = incrementalChurn * clv * attributionConfidence;

  const totalHiddenCost = attritionCost + abandonmentCost + ahtCreepCost + clvErosionCost;

  return {
    visibleSavings,
    hiddenCosts: {
      attritionCost,
      abandonmentCost,
      ahtCreepCost,
      clvErosionCost,
      totalHiddenCost,
    },
    netImpact: visibleSavings - totalHiddenCost,
    baselineOccupancy: baseOcc,
    newOccupancy: newOcc,
    baselineASA: baseASA,
    newASA: newASA,
    agentsRemoved,
  };
}
