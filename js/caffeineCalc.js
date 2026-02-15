/**
 * CoffeineCrashout – Core Caffeine Calculation Logic
 * Based on EFSA (European Food Safety Authority) guidelines
 */

// Drink definitions: name key → caffeine in mg per serving
const DRINK_CAFFEINE = {
    coffee: 95,   // 200ml Filterkaffee
    espresso: 63,   // 30ml Shot
    cappuccino: 63,   // 1 Shot Espresso
    latte: 63,   // 1 Shot Espresso
    energyDrink: 160,   // 500ml Dose (Monster/Red Bull XL)
    cola: 35,   // 330ml Dose
    tea: 47,   // 200ml Schwarztee
    mateLemonade: 80,   // 500ml Flasche
    decaf: 3    // fast nichts
};

// Risk thresholds (mg per kg body weight, EFSA-based)
const RISK_THRESHOLDS = {
    safe: 3,     // ≤3 mg/kg → green
    moderate: 6,     // 3–6 mg/kg → yellow
    high: 9,     // 6–9 mg/kg → red
    extreme: 12     // >9 mg/kg → skull
};

// EFSA recommended daily max (for healthy adults)
const SAFE_DAILY_MAX_MG = 400;

/**
 * Calculate total caffeine from drink selections
 * @param {Object} drinks - { coffee: 2, espresso: 1, ... }
 * @returns {number} total mg
 */
function calculateDrinkCaffeine(drinks) {
    let total = 0;
    for (const [drink, count] of Object.entries(drinks)) {
        if (DRINK_CAFFEINE[drink]) {
            total += DRINK_CAFFEINE[drink] * count;
        }
    }
    return total;
}

/**
 * Main analysis function
 * @param {number} weightKg
 * @param {number} caffeineMg
 * @param {string} gender - 'male'|'female'|'diverse'
 * @returns {Object} analysis result
 */
function analyzeCaffeine(weightKg, caffeineMg, gender = 'diverse') {
    const mgPerKg = caffeineMg / weightKg;

    // Gender-adjusted factor (women metabolize caffeine ~20-25% slower on average)
    const genderFactor = gender === 'female' ? 1.2 : 1.0;
    const effectiveMgPerKg = mgPerKg * genderFactor;

    // Determine risk level
    let riskLevel, riskKey;
    if (effectiveMgPerKg <= RISK_THRESHOLDS.safe) {
        riskLevel = 0;
        riskKey = 'low';
    } else if (effectiveMgPerKg <= RISK_THRESHOLDS.moderate) {
        riskLevel = 1;
        riskKey = 'moderate';
    } else if (effectiveMgPerKg <= RISK_THRESHOLDS.high) {
        riskLevel = 2;
        riskKey = 'high';
    } else {
        riskLevel = 3;
        riskKey = 'extreme';
    }

    // Risk percentage (0-100 for visual gauge)
    const riskPercent = Math.min(100, (effectiveMgPerKg / RISK_THRESHOLDS.extreme) * 100);

    // Percentile comparison (simulated distribution, roughly based on EU average ~300mg/day)
    const percentile = calculatePercentile(caffeineMg);

    // Short-term effects
    const shortTermEffects = getShortTermEffects(effectiveMgPerKg);

    // Long-term risks
    const longTermRisks = getLongTermRisks(effectiveMgPerKg);

    // Timeline data (caffeine levels throughout the day)
    const timeline = generateTimeline(caffeineMg);

    // Badge
    const badge = getBadge(caffeineMg, effectiveMgPerKg);

    // Fun fact (random)
    const funFactIndex = Math.floor(Math.random() * 8);

    return {
        caffeineMg,
        weightKg,
        mgPerKg: Math.round(mgPerKg * 10) / 10,
        effectiveMgPerKg: Math.round(effectiveMgPerKg * 10) / 10,
        riskLevel,
        riskKey,
        riskPercent: Math.round(riskPercent),
        percentile,
        shortTermEffects,
        longTermRisks,
        timeline,
        badge,
        funFactIndex,
        safeDailyMax: SAFE_DAILY_MAX_MG,
        overLimit: caffeineMg > SAFE_DAILY_MAX_MG,
        overLimitPercent: Math.round((caffeineMg / SAFE_DAILY_MAX_MG) * 100)
    };
}

/**
 * Simulated percentile (based on rough EU distribution)
 */
function calculatePercentile(caffeineMg) {
    // Mean ~200mg, SD ~120mg (rough normal distribution)
    const mean = 200;
    const sd = 120;
    const z = (caffeineMg - mean) / sd;
    // Approximate CDF using logistic function
    const percentile = Math.round(100 / (1 + Math.exp(-1.7 * z)));
    return Math.max(1, Math.min(99, percentile));
}

const caffeineCalc = {
    // Watson Formula for Total Body Water (TBW) in Liters
    calculateTBW: (weight, height, age, gender) => {
        // height in cm, weight in kg, age in years
        if (gender === 'male') {
            return 2.447 - (0.09156 * age) + (0.1074 * height) + (0.3362 * weight);
        } else {
            // Female formula (Watson)
            return -2.097 + (0.1069 * height) + (0.2466 * weight);
        }
    },

    // Calculate Personalized Limit based on TBW and Metabolism
    calculateLimit: (weight, tbw, gender, age) => {
        // Base safe limit (EFSA single dose) ~ 3mg/kg to 5.7mg/kg
        // We refine this:
        // 1. TBW factor: Higher water % -> better distribution -> slightly higher tolerance
        // 2. Metabolism factor: 
        //    - Females metabolize slower (-15% tolerance)
        //    - Age > 30 metabolizes slower (-1% per year)

        const baseLimit = weight * 5.7; // EFSA upper single dose
        const waterRatio = tbw / weight; // 0.5 - 0.7 usually

        let adjustedLimit = baseLimit * (waterRatio / 0.6); // Normalize to 60% water

        // Gender adjustment
        if (gender === 'female') adjustedLimit *= 0.85;

        // Age adjustment (after 30)
        if (age > 30) {
            const ageFactor = Math.max(0.7, 1 - ((age - 30) * 0.01)); // Max 30% reduction
            adjustedLimit *= ageFactor;
        }

        return Math.round(adjustedLimit);
    },

    analyze: (weight, height, age, gender, caffeineMg) => {
        const tbw = caffeineCalc.calculateTBW(weight, height, age, gender);
        const limit = caffeineCalc.calculateLimit(weight, tbw, gender, age);

        // Calculate concentration (mg/L in TBW) - highly simplified theoretical peak
        const concentration = caffeineMg / tbw;

        // Calculate percentages
        const percentage = Math.round((caffeineMg / limit) * 100);

        // Risk Levels based on percentage of PERSONAL limit
        let riskLevel = '';
        let riskColor = '';
        let riskKey = '';

        if (percentage < 40) {
            riskLevel = 'Safe';
            riskColor = 'var(--sage)';
            riskKey = 'low';
        } else if (percentage < 80) {
            riskLevel = 'Moderate';
            riskColor = 'var(--gold)';
            riskKey = 'moderate';
        } else if (percentage < 120) {
            riskLevel = 'High';
            riskColor = 'var(--orange)';
            riskKey = 'high';
        } else {
            riskLevel = 'Extreme';
            riskColor = 'var(--red)';
            riskKey = 'extreme';
        }

        return {
            limit,
            percentage,
            riskLevel,
            riskColor,
            riskKey,
            tbw: tbw.toFixed(1),
            concentration: concentration.toFixed(1)
        };
    },

    getTimeline: (totalMg, wakeupTime = 6, gender = 'male', age = 30) => {
        // Metabolism Half-Life calculation
        let halfLife = 5; // Base 5 hours

        // Adjust half-life
        if (gender === 'female') halfLife *= 1.2; // +20% slower
        if (age > 40) halfLife *= 1.1; // Slower with age
        if (age > 60) halfLife *= 1.1;

        const labels = [];
        const data = [];
        const colors = [];

        for (let i = 0; i <= 18; i++) { // 6:00 to 24:00
            const time = wakeupTime + i;
            labels.push(`${time}:00`);

            // Decay formula: N(t) = N0 * (1/2)^(t / halfLife)
            // Assuming peak is reached at 30-60 mins (let's say t=0 for simplicity of daily view)
            // But usually people drink throughout. Simplified: Single dose at wakeup + smaller doses?
            // For this app: assume totalMg is taken effectively at start (worst case peak) or distributed.
            // Let's model a simplified curve: Peak at +1h, then decay.

            let timeSinceIntake = i;
            let level = 0;

            if (timeSinceIntake < 0) level = 0;
            else if (timeSinceIntake < 1) level = totalMg * (timeSinceIntake / 1); // Linear absorption
            else {
                // Decay
                level = totalMg * Math.pow(0.5, (timeSinceIntake - 1) / halfLife);
            }

            data.push(Math.round(level));

            // Color based on level relative to generic 400mg threshold for visual
            if (level < 100) colors.push('#66BB6A');
            else if (level < 250) colors.push('#FFC107');
            else if (level < 400) colors.push('#FF8A65');
            else colors.push('#E53935');
        }

        return { labels, data, colors, halfLife: halfLife.toFixed(1) };
    }
};

function getShortTermEffects(mgPerKg) {
    const effects = [];
    if (mgPerKg >= 1) effects.push('alertness');
    if (mgPerKg >= 3) effects.push('heartRate');
    if (mgPerKg >= 5) effects.push('tremor');
    if (mgPerKg >= 4) effects.push('insomnia');
    if (mgPerKg >= 6) effects.push('anxiety');
    if (mgPerKg >= 3) effects.push('dehydration');
    return effects;
}

function getLongTermRisks(mgPerKg) {
    const risks = [];
    if (mgPerKg >= 3) risks.push('dependency');
    if (mgPerKg >= 4) risks.push('tolerance');
    if (mgPerKg >= 5) risks.push('withdrawal');
    if (mgPerKg >= 7) risks.push('digestive');
    if (mgPerKg >= 8) risks.push('bloodPressure');
    if (mgPerKg >= 10) risks.push('heartIssues');
    return risks;
}

/**
 * Generate timeline data for Chart.js
 * Assumes caffeine is consumed in the morning (7-9am)
 * Half-life: ~5 hours
 */
function generateTimeline(totalMg) {
    const halfLife = 5; // hours
    const labels = [];
    const data = [];
    const colors = [];

    // Simulate 3 doses: 7am (50%), 10am (30%), 14pm (20%)
    const doses = [
        { hour: 7, amount: totalMg * 0.5 },
        { hour: 10, amount: totalMg * 0.3 },
        { hour: 14, amount: totalMg * 0.2 }
    ];

    for (let h = 6; h <= 24; h++) {
        labels.push(`${h}:00`);

        let level = 0;
        for (const dose of doses) {
            if (h >= dose.hour) {
                const elapsed = h - dose.hour;
                // Exponential decay: C(t) = C0 * (0.5)^(t/halflife)
                level += dose.amount * Math.pow(0.5, elapsed / halfLife);
            }
        }

        data.push(Math.round(level));

        // Color based on level
        if (level < 100) colors.push('#66BB6A');
        else if (level < 250) colors.push('#FFC107');
        else if (level < 400) colors.push('#FF8A65');
        else colors.push('#E53935');
    }

    return { labels, data, colors };
}

function getBadge(totalMg, mgPerKg) {
    if (mgPerKg >= 10) return 'needsHelp';
    if (mgPerKg >= 8) return 'heartbreaker';
    if (mgPerKg >= 6) return 'espressoAddict';
    if (totalMg >= 400) return 'caffeineWarrior';
    if (totalMg >= 200) return 'dailyDrinker';
    return 'casualSipper';
}

// Export for use in app.js
window.CaffeineCalc = {
    DRINK_CAFFEINE,
    RISK_THRESHOLDS,
    SAFE_DAILY_MAX_MG,
    calculateDrinkCaffeine,
    analyzeCaffeine
};
