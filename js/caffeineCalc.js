/**
 * CaffeineCrashout – Unified Caffeine Calculation Logic
 * Watson Formula (TBW) + EFSA Guidelines
 */

const caffeineCalc = (() => {

    // ── Drink definitions ──
    const DRINKS = {
        coffee: 95,   // 200ml Filterkaffee
        espresso: 63,   // 30ml Shot
        cappuccino: 63,   // 1 Shot
        latte: 63,   // 1 Shot
        energyDrink: 160,   // 500ml Dose
        cola: 35,   // 330ml Dose
        tea: 47,   // 200ml Schwarztee
        mateLemonade: 80,   // 500ml Flasche
        decaf: 3
    };

    // ── Watson Formula: Total Body Water (TBW) in Liters ──
    function calculateTBW(weight, height, age, gender) {
        if (gender === 'male') {
            return 2.447 - (0.09156 * age) + (0.1074 * height) + (0.3362 * weight);
        }
        // Female / diverse
        return -2.097 + (0.1069 * height) + (0.2466 * weight);
    }

    // ── Personalized Limit ──
    function calculateLimit(weight, tbw, gender, age) {
        const baseLimit = weight * 5.7;
        const waterRatio = tbw / weight;
        let adjustedLimit = baseLimit * (waterRatio / 0.6);
        if (gender === 'female') adjustedLimit *= 0.85;
        if (age > 30) adjustedLimit *= Math.max(0.7, 1 - ((age - 30) * 0.01));
        return Math.round(adjustedLimit);
    }

    // ── Half-life (hours) based on gender/age ──
    function calculateHalfLife(gender, age) {
        let hl = 5;
        if (gender === 'female') hl *= 1.2;
        if (age > 40) hl *= 1.1;
        if (age > 60) hl *= 1.1;
        return hl;
    }

    // ── Effects ──
    function getShortTermEffects(mgPerKg) {
        const fx = [];
        if (mgPerKg >= 1) fx.push('alertness');
        if (mgPerKg >= 3) fx.push('heartRate');
        if (mgPerKg >= 5) fx.push('tremor');
        if (mgPerKg >= 4) fx.push('insomnia');
        if (mgPerKg >= 6) fx.push('anxiety');
        if (mgPerKg >= 3) fx.push('dehydration');
        return fx;
    }

    function getLongTermRisks(mgPerKg) {
        const r = [];
        if (mgPerKg >= 3) r.push('dependency');
        if (mgPerKg >= 4) r.push('tolerance');
        if (mgPerKg >= 5) r.push('withdrawal');
        if (mgPerKg >= 7) r.push('digestive');
        if (mgPerKg >= 8) r.push('bloodPressure');
        if (mgPerKg >= 10) r.push('heartIssues');
        return r;
    }

    // ── Badge ──
    function getBadge(totalMg, mgPerKg) {
        if (mgPerKg >= 10) return 'needsHelp';
        if (mgPerKg >= 8) return 'heartbreaker';
        if (mgPerKg >= 6) return 'espressoAddict';
        if (totalMg >= 400) return 'caffeineWarrior';
        if (totalMg >= 200) return 'dailyDrinker';
        return 'casualSipper';
    }

    // ── Percentile (simulated EU distribution) ──
    function fakePercentile(caffeineMg) {
        const z = (caffeineMg - 200) / 120;
        return Math.max(1, Math.min(99, Math.round(100 / (1 + Math.exp(-1.7 * z)))));
    }

    // ── Timeline ──
    function buildTimeline(totalMg, gender, age) {
        const halfLife = calculateHalfLife(gender, age);
        const labels = [], data = [], colors = [];

        // 3-dose model: 7:00 (50%), 10:00 (30%), 14:00 (20%)
        const doses = [
            { hour: 7, amount: totalMg * 0.5 },
            { hour: 10, amount: totalMg * 0.3 },
            { hour: 14, amount: totalMg * 0.2 }
        ];

        for (let h = 6; h <= 24; h++) {
            labels.push(`${h}:00`);
            let level = 0;
            for (const d of doses) {
                if (h >= d.hour) {
                    level += d.amount * Math.pow(0.5, (h - d.hour) / halfLife);
                }
            }
            data.push(Math.round(level));

            if (level < 100) colors.push('#66BB6A');
            else if (level < 250) colors.push('#FFC107');
            else if (level < 400) colors.push('#FF8A65');
            else colors.push('#E53935');
        }

        return { labels, data, colors, halfLife: halfLife.toFixed(1) };
    }

    // ══════════════════════════════════════
    //  PUBLIC API
    // ══════════════════════════════════════
    return {
        DRINKS,

        drinkTotal(counts) {
            let total = 0;
            for (const [k, n] of Object.entries(counts)) {
                if (DRINKS[k]) total += DRINKS[k] * n;
            }
            return total;
        },

        /**
         * Full analysis – merges Watson-based personalization with all display data.
         * @param {number} weight  kg
         * @param {number} height  cm
         * @param {number} age     years
         * @param {string} gender  'male'|'female'|'diverse'
         * @param {number} caffeineMg  daily intake
         * @returns {Object}
         */
        analyze(weight, height, age, gender, caffeineMg) {
            // ── Watson ──
            const tbw = calculateTBW(weight, height, age, gender);
            const limit = calculateLimit(weight, tbw, gender, age);
            const concentration = caffeineMg / tbw;

            // ── Risk ──
            const percentage = Math.round((caffeineMg / limit) * 100);
            const genderFactor = gender === 'female' ? 1.2 : 1.0;
            const mgPerKg = caffeineMg / weight;
            const effectiveMgPerKg = mgPerKg * genderFactor;

            let riskKey;
            if (percentage < 40) riskKey = 'low';
            else if (percentage < 80) riskKey = 'moderate';
            else if (percentage < 120) riskKey = 'high';
            else riskKey = 'extreme';

            // Gauge 0-100
            const riskPercent = Math.min(100, Math.round((effectiveMgPerKg / 12) * 100));

            return {
                caffeineMg,
                weight,
                height,
                age,
                gender,
                // Watson
                tbw: tbw.toFixed(1),
                limit,
                concentration: concentration.toFixed(1),
                // Risk
                percentage,
                riskKey,
                riskPercent,
                effectiveMgPerKg: (effectiveMgPerKg).toFixed(1),
                // Effects
                shortTermEffects: getShortTermEffects(effectiveMgPerKg),
                longTermRisks: getLongTermRisks(effectiveMgPerKg),
                // Badge
                badge: getBadge(caffeineMg, effectiveMgPerKg),
                // Percentile
                percentile: fakePercentile(caffeineMg),
                // Timeline
                timeline: buildTimeline(caffeineMg, gender, age),
                // Fun fact
                funFactIndex: Math.floor(Math.random() * 24),
                // Yearly projection
                yearlyKg: ((caffeineMg * 365) / 1000).toFixed(1)
            };
        }
    };
})();
