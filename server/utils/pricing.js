// ==============================================================================
// CONTAQUES LEAD PRICING ENGINE
// Transparent Per-Lead Rates by Engine & Subscription Tier
// ==============================================================================

const ENGINE_PRICING = {
  free: {
    name: 'Free Plan',
    maps: 1.30,         // Google Business Index
    dorking: 1.00,      // Social / Custom Discovery
    whatsapp: 1.00,     // WhatsApp Radar
    yellowpages: 0.60,  // Yellow Pages
    yandex: 1.70        // Yandex
  },
  plus: {
    name: 'Value Plus', // ₹299
    maps: 1.10,
    dorking: 0.80,
    whatsapp: 0.80,
    yellowpages: 0.50,
    yandex: 1.50
  },
  pack: {
    name: 'Value Pack', // ₹499
    maps: 1.00,
    dorking: 0.80,
    whatsapp: 0.80,
    yellowpages: 0.50,
    yandex: 1.30
  }
};

const ENGINE_PRICING_USD = {
  free: {
    name: 'Free Plan',
    maps: 0.014,         // Google Business Index
    dorking: 0.010,      // Social / Custom Discovery
    whatsapp: 0.010,     // WhatsApp Radar
    yellowpages: 0.006,  // Yellow Pages
    yandex: 0.018        // Yandex
  },
  plus: {
    name: 'Value Plus',  // $3/mo
    maps: 0.011,         // Google Business Index
    dorking: 0.008,      // Social / Custom Discovery
    whatsapp: 0.008,     // WhatsApp Radar
    yellowpages: 0.005,  // Yellow Pages
    yandex: 0.016        // Yandex
  },
  pack: {
    name: 'Value Pack',  // $5/mo
    maps: 0.010,         // Google Business Index
    dorking: 0.008,      // Social / Custom Discovery
    whatsapp: 0.008,     // WhatsApp Radar
    yellowpages: 0.005,  // Yellow Pages
    yandex: 0.014        // Yandex
  }
};

/**
 * Normalize plan key (free, pack, plus)
 */
function normalizePlanKey(plan) {
  if (!plan) return 'free';
  const p = plan.toString().toLowerCase().trim();
  if (p === 'plus' || p === 'value plus' || p === '299' || p.includes('plus')) return 'plus';
  if (p === 'pack' || p === 'value pack' || p === '499' || p.includes('pack') || p.includes('value')) return 'pack';
  return 'free';
}

/**
 * Get the per-lead rate in INR for a given engine and user plan
 */
function getRatePerLead(source = 'maps', plan = 'free') {
  const planKey = normalizePlanKey(plan);
  const tier = ENGINE_PRICING[planKey] || ENGINE_PRICING.free;
  const src = (source || 'maps').toLowerCase().trim();
  return tier[src] !== undefined ? tier[src] : (tier.maps || 1.30);
}

/**
 * Get the per-lead rate in USD for a given engine and user plan
 */
function getRatePerLeadUSD(source = 'maps', plan = 'free') {
  const planKey = normalizePlanKey(plan);
  const tier = ENGINE_PRICING_USD[planKey] || ENGINE_PRICING_USD.free;
  const src = (source || 'maps').toLowerCase().trim();
  return tier[src] !== undefined ? tier[src] : (tier.maps || 0.020);
}

/**
 * Get complete table of engine rates for a plan
 */
function getEngineRates(plan = 'free') {
  const planKey = normalizePlanKey(plan);
  return {
    plan: planKey,
    rates: ENGINE_PRICING[planKey] || ENGINE_PRICING.free,
    allTiers: ENGINE_PRICING
  };
}

/**
 * Get complete table of USD engine rates for a plan
 */
function getEngineRatesUSD(plan = 'free') {
  const planKey = normalizePlanKey(plan);
  return {
    plan: planKey,
    rates: ENGINE_PRICING_USD[planKey] || ENGINE_PRICING_USD.free,
    allTiers: ENGINE_PRICING_USD
  };
}

/**
 * Calculate estimated job cost
 */
function calculateJobCost(source = 'maps', plan = 'free', requestedCount = 20, currency = 'INR') {
  const count = parseInt(requestedCount, 10) || 0;
  const isUSD = (currency || '').toUpperCase() === 'USD';
  const rate = isUSD ? getRatePerLeadUSD(source, plan) : getRatePerLead(source, plan);
  const estimatedCost = isUSD 
    ? parseFloat((count * rate).toFixed(4)) 
    : parseFloat((count * rate).toFixed(2));
  return {
    source,
    plan: normalizePlanKey(plan),
    currency: isUSD ? 'USD' : 'INR',
    ratePerLead: rate,
    requestedCount: count,
    estimatedCost
  };
}

module.exports = {
  ENGINE_PRICING,
  ENGINE_PRICING_USD,
  normalizePlanKey,
  getRatePerLead,
  getRatePerLeadUSD,
  getEngineRates,
  getEngineRatesUSD,
  calculateJobCost
};
