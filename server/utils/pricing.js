// ==============================================================================
// CONTAQUES LEAD PRICING ENGINE
// Transparent Per-Lead Rates by Engine & Subscription Tier
// ==============================================================================

const ENGINE_PRICING = {
  free: {
    name: 'Free Starter',
    maps: 1.30,         // Google Business Indexes
    dorking: 1.00,      // Socials & Custom Domain Discovery
    whatsapp: 1.00,     // WhatsApp Radar
    yellowpages: 0.60,  // Yellow Pages B2B
    yandex: 1.70        // Yandex + MAX Messenger
  },
  pack: {
    name: 'Value Pack',
    maps: 1.10,
    dorking: 0.80,
    whatsapp: 0.80,
    yellowpages: 0.50,
    yandex: 1.50
  },
  plus: {
    name: 'Value Plus',
    maps: 0.90,
    dorking: 0.70,
    whatsapp: 0.70,
    yellowpages: 0.40,
    yandex: 1.30
  }
};

/**
 * Normalize plan key (free, pack, plus)
 */
function normalizePlanKey(plan) {
  if (!plan) return 'free';
  const p = plan.toString().toLowerCase().trim();
  if (p.includes('plus') || p === 'enterprise') return 'plus';
  if (p.includes('pack') || p === 'value') return 'pack';
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
 * Calculate estimated job cost
 */
function calculateJobCost(source = 'maps', plan = 'free', requestedCount = 20) {
  const count = parseInt(requestedCount, 10) || 0;
  const rate = getRatePerLead(source, plan);
  const estimatedCost = parseFloat((count * rate).toFixed(2));
  return {
    source,
    plan: normalizePlanKey(plan),
    ratePerLead: rate,
    requestedCount: count,
    estimatedCost
  };
}

module.exports = {
  ENGINE_PRICING,
  normalizePlanKey,
  getRatePerLead,
  getEngineRates,
  calculateJobCost
};
