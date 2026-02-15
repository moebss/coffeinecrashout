/**
 * CoffeineCrashout – Main Application Logic
 */

// ===========================
// i18n / Language System
// ===========================
let currentLang = 'en';
let translations = {};

async function initLanguage() {
    // Detect browser language
    const browserLang = (navigator.language || navigator.userLanguage || 'en').toLowerCase();
    currentLang = browserLang.startsWith('de') ? 'de' : 'en';

    try {
        const response = await fetch(`i18n/${currentLang}.json`);
        translations = await response.json();
    } catch (e) {
        // Fallback to English
        currentLang = 'en';
        const response = await fetch('i18n/en.json');
        translations = await response.json();
    }

    applyTranslations();
}

function t(path) {
    const keys = path.split('.');
    let value = translations;
    for (const key of keys) {
        value = value?.[key];
    }
    return value || path;
}

function applyTranslations() {
    // Apply all data-i18n attributes
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        const val = t(key);
        if (val && typeof val === 'string') {
            if (el.tagName === 'INPUT' && el.type !== 'submit') {
                el.placeholder = val;
            } else {
                el.textContent = val;
            }
        }
    });
}

// ===========================
// State
// ===========================
let drinkCounts = {};
let analysisResult = null;
let timelineChart = null;

// ===========================
// Drink Selector
// ===========================
const DRINK_EMOJIS = {
    coffee: '☕',
    espresso: '⚫',
    cappuccino: '🤎',
    latte: '🥛',
    energyDrink: '⚡',
    cola: '🥤',
    tea: '🫖',
    mateLemonade: '🧉',
    decaf: '💤'
};

function renderDrinkSelector() {
    const container = document.getElementById('drinkGrid');
    if (!container) return;
    container.innerHTML = '';

    const drinks = CaffeineCalc.DRINK_CAFFEINE;

    for (const [key, mg] of Object.entries(drinks)) {
        const count = drinkCounts[key] || 0;
        const drinkDiv = document.createElement('div');
        drinkDiv.className = `drink-card ${count > 0 ? 'active' : ''}`;
        drinkDiv.innerHTML = `
            <div class="drink-emoji">${DRINK_EMOJIS[key] || '☕'}</div>
            <div class="drink-name" data-i18n="drinks.${key}">${t(`drinks.${key}`)}</div>
            <div class="drink-mg">${mg} mg</div>
            <div class="drink-counter">
                <button class="drink-btn minus" data-drink="${key}" data-action="minus" aria-label="Minus">−</button>
                <span class="drink-count">${count}</span>
                <button class="drink-btn plus" data-drink="${key}" data-action="plus" aria-label="Plus">+</button>
            </div>
        `;
        container.appendChild(drinkDiv);
    }

    // Event delegation
    container.onclick = (e) => {
        const btn = e.target.closest('.drink-btn');
        if (!btn) return;

        const drink = btn.dataset.drink;
        const action = btn.dataset.action;

        if (action === 'plus') {
            drinkCounts[drink] = (drinkCounts[drink] || 0) + 1;
        } else if (action === 'minus' && drinkCounts[drink] > 0) {
            drinkCounts[drink]--;
            if (drinkCounts[drink] === 0) delete drinkCounts[drink];
        }

        // Update caffeine input
        const total = CaffeineCalc.calculateDrinkCaffeine(drinkCounts);
        document.getElementById('caffeineInput').value = total || '';

        renderDrinkSelector();
    };
}

// ===========================
// Form Handling
// ===========================
function initForm() {
    const form = document.getElementById('inputForm');
    const calculateBtn = document.getElementById('calculateBtn');

    calculateBtn?.addEventListener('click', (e) => {
        e.preventDefault();

        const weight = parseFloat(document.getElementById('weightInput').value);
        const height = parseFloat(document.getElementById('heightInput').value);
        const caffeine = parseFloat(document.getElementById('caffeineInput').value);
        const gender = document.querySelector('input[name="gender"]:checked')?.value || 'diverse';

        // Validation
        if (!weight || weight < 20 || weight > 300) {
            shakeElement(document.getElementById('weightInput'));
            return;
        }
        if (!caffeine || caffeine < 0) {
            shakeElement(document.getElementById('caffeineInput'));
            return;
        }

        // Calculate
        analysisResult = CaffeineCalc.analyzeCaffeine(weight, caffeine, gender);
        showResults();
    });
}

function shakeElement(el) {
    el.classList.add('shake');
    setTimeout(() => el.classList.remove('shake'), 600);
}

// ===========================
// Results Display
// ===========================
function showResults() {
    if (!analysisResult) return;
    const r = analysisResult;

    // Transition
    document.getElementById('inputSection').classList.add('hidden');
    document.getElementById('resultSection').classList.remove('hidden');
    document.getElementById('resultSection').classList.add('fade-in');

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Risk gauge
    renderRiskGauge(r);

    // Stats
    document.getElementById('statIntake').textContent = `${r.caffeineMg} mg`;
    document.getElementById('statPerKg').textContent = `${r.effectiveMgPerKg} mg/kg`;
    document.getElementById('statLimit').textContent = `${r.safeDailyMax} mg`;
    document.getElementById('statOverLimit').textContent = `${r.overLimitPercent}%`;

    // Comparison text
    const compEl = document.getElementById('comparison');
    if (r.percentile > 50) {
        compEl.textContent = t('result.comparison').replace('{percent}', r.percentile);
    } else {
        compEl.textContent = t('result.comparisonLow');
    }

    // Badge
    const badgeEl = document.getElementById('badgeDisplay');
    badgeEl.textContent = t(`badges.${r.badge}`);
    badgeEl.className = `badge badge-${r.riskKey}`;

    // Effects
    renderEffects(r);

    // Timeline chart
    renderTimeline(r.timeline);

    // Fun fact
    const facts = t('funFacts');
    document.getElementById('funFact').textContent = facts[r.funFactIndex] || facts[0];

    // Animate elements in
    animateResultElements();
}

function renderRiskGauge(r) {
    const gauge = document.getElementById('riskGauge');
    const label = document.getElementById('riskLabel');
    const desc = document.getElementById('riskDesc');

    label.textContent = t(`risk.${r.riskKey}`);
    desc.textContent = t(`risk.${r.riskKey}Desc`);

    // Set gauge color & width
    const colors = {
        low: '#66BB6A',
        moderate: '#FFC107',
        high: '#FF8A65',
        extreme: '#E53935'
    };

    gauge.style.setProperty('--gauge-color', colors[r.riskKey]);
    gauge.style.setProperty('--gauge-width', `${r.riskPercent}%`);

    // Animate gauge fill
    setTimeout(() => {
        gauge.querySelector('.gauge-fill').style.width = `${r.riskPercent}%`;
    }, 300);
}

function renderEffects(r) {
    const shortTermEl = document.getElementById('shortTermEffects');
    const longTermEl = document.getElementById('longTermEffects');

    shortTermEl.innerHTML = r.shortTermEffects.length
        ? r.shortTermEffects.map(e => `<div class="effect-tag effect-short">${t(`effects.${e}`)}</div>`).join('')
        : `<div class="effect-tag effect-none">${t('effects.alertness')}</div>`;

    longTermEl.innerHTML = r.longTermRisks.length
        ? r.longTermRisks.map(e => `<div class="effect-tag effect-long">${t(`effects.${e}`)}</div>`).join('')
        : '<div class="effect-tag effect-none">✅ Keine nennenswerten Risiken</div>';
}

function renderTimeline(timeline) {
    const ctx = document.getElementById('timelineChart')?.getContext('2d');
    if (!ctx) return;

    // Destroy existing chart
    if (timelineChart) timelineChart.destroy();

    timelineChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: timeline.labels,
            datasets: [{
                label: 'Caffeine (mg)',
                data: timeline.data,
                borderColor: '#81C784',
                backgroundColor: (context) => {
                    const chart = context.chart;
                    const { ctx: c, chartArea } = chart;
                    if (!chartArea) return 'rgba(129,199,132,0.1)';
                    const gradient = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
                    gradient.addColorStop(0, 'rgba(129,199,132,0.35)');
                    gradient.addColorStop(1, 'rgba(129,199,132,0.02)');
                    return gradient;
                },
                fill: true,
                tension: 0.4,
                pointRadius: 3,
                pointBackgroundColor: timeline.colors,
                pointBorderColor: timeline.colors,
                borderWidth: 2.5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(62,39,35,0.9)',
                    titleFont: { family: "'Inter', sans-serif", size: 13 },
                    bodyFont: { family: "'Inter', sans-serif", size: 12 },
                    padding: 12,
                    cornerRadius: 8,
                    callbacks: {
                        label: (ctx) => `${ctx.parsed.y} mg Koffein im Blut`
                    }
                }
            },
            scales: {
                x: {
                    grid: { color: 'rgba(161,136,127,0.1)' },
                    ticks: { color: '#A1887F', font: { size: 11 } }
                },
                y: {
                    grid: { color: 'rgba(161,136,127,0.1)' },
                    ticks: { color: '#A1887F', font: { size: 11 } },
                    beginAtZero: true
                }
            },
            interaction: {
                intersect: false,
                mode: 'index'
            }
        }
    });
}

function animateResultElements() {
    const elements = document.querySelectorAll('.result-animate');
    elements.forEach((el, i) => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(20px)';
        setTimeout(() => {
            el.style.transition = 'all 0.5s cubic-bezier(0.16, 1, 0.3, 1)';
            el.style.opacity = '1';
            el.style.transform = 'translateY(0)';
        }, 150 * i);
    });
}

// ===========================
// Share Functionality
// ===========================
function initShare() {
    document.getElementById('shareWhatsApp')?.addEventListener('click', () => {
        const text = getShareText();
        const url = encodeURIComponent(text);
        window.open(`https://wa.me/?text=${url}`, '_blank');
    });

    document.getElementById('shareTwitter')?.addEventListener('click', () => {
        const text = getShareText();
        const url = encodeURIComponent(text);
        window.open(`https://twitter.com/intent/tweet?text=${url}`, '_blank');
    });

    document.getElementById('shareCopy')?.addEventListener('click', () => {
        const text = getShareText();
        navigator.clipboard.writeText(text).then(() => {
            const btn = document.getElementById('shareCopy');
            const original = btn.textContent;
            btn.textContent = t('share.copied');
            setTimeout(() => btn.textContent = original, 2000);
        });
    });

    document.getElementById('shareScreenshot')?.addEventListener('click', async () => {
        const card = document.getElementById('resultCard');
        if (!card || typeof html2canvas === 'undefined') return;

        try {
            const canvas = await html2canvas(card, {
                backgroundColor: '#F5F5F5',
                scale: 2,
                useCORS: true
            });

            const link = document.createElement('a');
            link.download = `coffeine-crashout-${Date.now()}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
        } catch (err) {
            console.error('Screenshot failed:', err);
        }
    });
}

function getShareText() {
    if (!analysisResult) return '';
    const r = analysisResult;
    const badge = t(`badges.${r.badge}`);
    const risk = t(`risk.${r.riskKey}`);

    if (currentLang === 'de') {
        return `☕ Mein CoffeineCrashout-Ergebnis: ${badge}\n` +
            `Risikostufe: ${risk}\n` +
            `${r.caffeineMg}mg Koffein/Tag (${r.effectiveMgPerKg} mg/kg)\n\n` +
            `Wie viel verträgst du? 👉 coffeinecrashout.vercel.app`;
    } else {
        return `☕ My CoffeineCrashout result: ${badge}\n` +
            `Risk level: ${risk}\n` +
            `${r.caffeineMg}mg caffeine/day (${r.effectiveMgPerKg} mg/kg)\n\n` +
            `How much can YOU handle? 👉 coffeinecrashout.vercel.app`;
    }
}

// ===========================
// New Analysis
// ===========================
function initNewAnalysis() {
    document.getElementById('newAnalysisBtn')?.addEventListener('click', () => {
        document.getElementById('resultSection').classList.add('hidden');
        document.getElementById('inputSection').classList.remove('hidden');
        document.getElementById('inputSection').classList.add('fade-in');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
}

// ===========================
// Landing Page CTA
// ===========================
function initLanding() {
    document.getElementById('ctaBtn')?.addEventListener('click', () => {
        document.getElementById('landingSection').classList.add('hidden');
        document.getElementById('inputSection').classList.remove('hidden');
        document.getElementById('inputSection').classList.add('fade-in');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
}

// ===========================
// Particles Background
// ===========================
function initParticles() {
    const canvas = document.getElementById('particleCanvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let particles = [];
    const PARTICLE_COUNT = 50;

    function resize() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }

    function createParticle() {
        return {
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            vx: (Math.random() - 0.5) * 0.3,
            vy: -Math.random() * 0.3 - 0.05,
            radius: Math.random() * 2 + 0.5,
            alpha: Math.random() * 0.25 + 0.05,
            color: ['#81C784', '#A1887F', '#FFD54F', '#D7CCC8'][Math.floor(Math.random() * 4)]
        };
    }

    function init() {
        resize();
        particles = Array.from({ length: PARTICLE_COUNT }, createParticle);
    }

    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        particles.forEach(p => {
            p.x += p.vx;
            p.y += p.vy;

            if (p.y < -10) {
                p.y = canvas.height + 10;
                p.x = Math.random() * canvas.width;
            }
            if (p.x < -10) p.x = canvas.width + 10;
            if (p.x > canvas.width + 10) p.x = -10;

            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            ctx.fillStyle = p.color;
            ctx.globalAlpha = p.alpha;
            ctx.fill();
        });

        ctx.globalAlpha = 1;
        requestAnimationFrame(animate);
    }

    window.addEventListener('resize', resize);
    init();
    animate();
}

// ===========================
// Initialize
// ===========================
document.addEventListener('DOMContentLoaded', async () => {
    await initLanguage();
    renderDrinkSelector();
    initForm();
    initShare();
    initNewAnalysis();
    initLanding();
    initParticles();
});
