/**
 * CaffeineCrashout – Main Application Logic
 */

// ===========================
// i18n / Language System
// ===========================
let currentLang = 'en';
let translations = {};

async function initLanguage() {
    const browserLang = (navigator.language || navigator.userLanguage || 'en').toLowerCase();

    // Check for supported languages
    if (browserLang.startsWith('de')) currentLang = 'de';
    else if (browserLang.startsWith('es')) currentLang = 'es';
    else if (browserLang.startsWith('fr')) currentLang = 'fr';
    else currentLang = 'en';

    // Allow override via localStorage
    const savedLang = localStorage.getItem('appLang');
    if (savedLang) currentLang = savedLang;

    await loadLanguage(currentLang);
}

async function loadLanguage(lang) {
    currentLang = lang;
    localStorage.setItem('appLang', lang);
    try {
        const response = await fetch(`i18n/${lang}.json`);
        translations = await response.json();
    } catch (e) {
        console.error('Language load failed', e);
        // Fallback to en if not already en
        if (lang !== 'en') await loadLanguage('en');
    }
    applyTranslations();

    // Update active state of language switcher if it exists
    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.lang === currentLang);
    });
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
    coffee: '☕', espresso: '⚫', cappuccino: '🤎', latte: '🥛',
    energyDrink: '⚡', cola: '🥤', tea: '🫖', mateLemonade: '🧉', decaf: '💤'
};

function renderDrinkSelector() {
    const container = document.getElementById('drinkGrid');
    if (!container) return;
    container.innerHTML = '';

    const drinks = caffeineCalc.DRINKS;

    for (const [key, mg] of Object.entries(drinks)) {
        const count = drinkCounts[key] || 0;
        const drinkDiv = document.createElement('div');
        drinkDiv.className = `drink-card ${count > 0 ? 'active' : ''}`;
        drinkDiv.innerHTML = `
            <div class="drink-emoji">${DRINK_EMOJIS[key] || '☕'}</div>
            <div class="drink-name">${t(`drinks.${key}`)}</div>
            <div class="drink-mg">${mg} mg</div>
            <div class="drink-counter">
                <button class="drink-btn minus" data-drink="${key}" data-action="minus" aria-label="Minus">−</button>
                <span class="drink-count">${count}</span>
                <button class="drink-btn plus" data-drink="${key}" data-action="plus" aria-label="Plus">+</button>
            </div>
        `;
        container.appendChild(drinkDiv);
    }

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

        document.getElementById('caffeineInput').value = caffeineCalc.drinkTotal(drinkCounts) || '';
        renderDrinkSelector();
    };
}

// ===========================
// Form Handling
// ===========================
function initForm() {
    const calculateBtn = document.getElementById('calculateBtn');

    calculateBtn?.addEventListener('click', (e) => {
        e.preventDefault();

        const weight = parseFloat(document.getElementById('weightInput').value);
        const height = parseFloat(document.getElementById('heightInput').value);
        const age = parseFloat(document.getElementById('ageInput').value) || 30;
        const caffeine = parseFloat(document.getElementById('caffeineInput').value);
        const gender = document.querySelector('input[name="gender"]:checked')?.value || 'diverse';

        // Validation
        if (!weight || weight < 20 || weight > 300) {
            shakeElement(document.getElementById('weightInput'));
            return;
        }
        if (!height || height < 100 || height > 250) {
            shakeElement(document.getElementById('heightInput'));
            return;
        }
        if (!caffeine || caffeine < 0) {
            shakeElement(document.getElementById('caffeineInput'));
            return;
        }

        // Full analysis
        analysisResult = caffeineCalc.analyze(weight, height, age, gender, caffeine);
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
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Risk gauge
    renderRiskGauge(r);

    // Stats
    document.getElementById('statIntake').textContent = `${r.caffeineMg} mg`;
    document.getElementById('statPerKg').textContent = `${r.concentration} mg/L`;
    document.getElementById('statLimit').textContent = `${r.limit} mg`;
    document.getElementById('statOverLimit').textContent = `${r.percentage}%`;

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
    if (Array.isArray(facts)) {
        document.getElementById('funFact').textContent = facts[r.funFactIndex] || facts[0];
    }

    // Animate
    animateResultElements();
}

function renderRiskGauge(r) {
    const gauge = document.getElementById('riskGauge');
    const label = document.getElementById('riskLabel');
    const desc = document.getElementById('riskDesc');

    label.textContent = t(`risk.${r.riskKey}`);
    desc.textContent = t(`risk.${r.riskKey}Desc`);

    const colors = { low: '#66BB6A', moderate: '#FFC107', high: '#FF8A65', extreme: '#E53935' };
    gauge.style.setProperty('--gauge-color', colors[r.riskKey]);

    setTimeout(() => {
        gauge.querySelector('.gauge-fill').style.width = `${r.riskPercent}%`;
    }, 300);
}

function renderEffects(r) {
    const shortTermEl = document.getElementById('shortTermEffects');
    const longTermEl = document.getElementById('longTermEffects');

    shortTermEl.innerHTML = r.shortTermEffects.length
        ? r.shortTermEffects.map(e => `<div class="effect-tag effect-short">${t(`effects.${e}`)}</div>`).join('')
        : `<div class="effect-tag effect-none">✅ ${t('effects.alertness')}</div>`;

    longTermEl.innerHTML = r.longTermRisks.length
        ? r.longTermRisks.map(e => `<div class="effect-tag effect-long">${t(`effects.${e}`)}</div>`).join('')
        : '<div class="effect-tag effect-none">✅ Keine nennenswerten Risiken</div>';
}

function renderTimeline(timeline) {
    const ctx = document.getElementById('timelineChart')?.getContext('2d');
    if (!ctx) return;
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
                    const grad = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
                    grad.addColorStop(0, 'rgba(129,199,132,0.35)');
                    grad.addColorStop(1, 'rgba(129,199,132,0.02)');
                    return grad;
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
            responsive: true, maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(62,39,35,0.9)',
                    titleFont: { family: "'Inter', sans-serif", size: 13 },
                    bodyFont: { family: "'Inter', sans-serif", size: 12 },
                    padding: 12, cornerRadius: 8,
                    callbacks: { label: (c) => `${c.parsed.y} mg Koffein im Blut` }
                }
            },
            scales: {
                x: { grid: { color: 'rgba(161,136,127,0.1)' }, ticks: { color: '#A1887F', font: { size: 11 } } },
                y: { grid: { color: 'rgba(161,136,127,0.1)' }, ticks: { color: '#A1887F', font: { size: 11 } }, beginAtZero: true }
            },
            interaction: { intersect: false, mode: 'index' }
        }
    });
}

function animateResultElements() {
    document.querySelectorAll('.result-animate').forEach((el, i) => {
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
// Coffein Wrapped – Canvas Image Generator
// ===========================
function initWrapped() {
    document.getElementById('wrappedBtn')?.addEventListener('click', generateWrapped);
}

async function generateWrapped() {
    if (!analysisResult) return;
    const r = analysisResult;

    const W = 1080, H = 1920;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');

    // ── Helper: Draw Glass Card ──
    const drawGlassCard = (x, y, w, h) => {
        ctx.save();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
        ctx.shadowBlur = 20;
        ctx.shadowOffsetY = 10;
        roundRect(ctx, x, y, w, h, 24);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
    };

    // ── Background: Dark Coffee Gradient ──
    const bgGrad = ctx.createLinearGradient(0, 0, W, H);
    bgGrad.addColorStop(0, '#1a1a1a');      // Dark Charcoal
    bgGrad.addColorStop(0.4, '#2d1e18');    // Deep Coffee
    bgGrad.addColorStop(1, '#3e2723');      // Espresso
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    // ── ambient glow ──
    const gradGlow = ctx.createRadialGradient(W / 2, 200, 50, W / 2, 600, 600);
    gradGlow.addColorStop(0, 'rgba(109, 76, 65, 0.3)');
    gradGlow.addColorStop(1, 'transparent');
    ctx.fillStyle = gradGlow;
    ctx.fillRect(0, 0, W, H);

    // ── Top Bar ──
    const barGrad = ctx.createLinearGradient(0, 0, W, 0);
    barGrad.addColorStop(0, '#D4A373'); // Latte
    barGrad.addColorStop(0.5, '#FFD166'); // Gold
    barGrad.addColorStop(1, '#D4A373');
    ctx.fillStyle = barGrad;
    ctx.fillRect(0, 0, W, 12);

    // ── Branding ──
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '900 64px "Space Grotesk", sans-serif';
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 10;
    ctx.fillText('CaffeineCrashout', W / 2, 120);
    ctx.shadowBlur = 0;

    ctx.font = '500 28px "Inter", sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.letterSpacing = '2px';
    ctx.fillText(t('result.wrappedTitle'), W / 2, 170); // OLD

    // This block was replaced. Correct logic below:
    ctx.fillText(t('result.wrappedTitle'), W / 2, 170);

    // ── Badge / Hero ──
    const badgeText = t(`badges.${r.badge}`);
    const riskColors = { low: '#66BB6A', moderate: '#FFCA28', high: '#FF7043', extreme: '#EF5350' };
    const riskColor = riskColors[r.riskKey];

    // Glow behind badge
    const badgeY = 320;
    ctx.save();
    ctx.shadowColor = riskColor;
    ctx.shadowBlur = 60;
    ctx.fillStyle = riskColor;
    ctx.beginPath();
    ctx.arc(W / 2, badgeY, 100, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Badge Title
    ctx.font = '700 80px "Space Grotesk", sans-serif';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(badgeText.replace(/^[^\s]+\s/, ''), W / 2, badgeY + 160); // Remove emoji from text

    // Risk Description
    ctx.font = '400 32px "Inter", sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.fillText(t(`risk.${r.riskKey}`), W / 2, badgeY + 220);

    // Large Emoji
    const emoji = badgeText.match(/^[^\s]+/)?.[0] || '☕';
    ctx.font = '160px "Segoe UI Emoji", "Apple Color Emoji", sans-serif';
    ctx.fillText(emoji, W / 2, badgeY + 60);

    // ── Gauge ──
    const gaugeY = 650;
    const gaugeW = W - 200;

    // Background Track
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    roundRect(ctx, 100, gaugeY, gaugeW, 30, 15);
    ctx.fill();

    // Fill Track
    const fillW = Math.max(40, (r.riskPercent / 100) * gaugeW);
    const gaugeGrad = ctx.createLinearGradient(100, 0, 100 + fillW, 0);
    gaugeGrad.addColorStop(0, '#66BB6A');
    gaugeGrad.addColorStop(0.5, '#FFCA28');
    gaugeGrad.addColorStop(1, '#EF5350');

    ctx.fillStyle = gaugeGrad;
    ctx.shadowColor = riskColor;
    ctx.shadowBlur = 20;
    roundRect(ctx, 100, gaugeY, fillW, 30, 15);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Marker
    ctx.fillStyle = '#FFF';
    ctx.beginPath();
    ctx.arc(100 + fillW, gaugeY + 15, 20, 0, Math.PI * 2);
    ctx.fill();

    // Gauge Labels
    ctx.font = '600 24px "Inter", sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.textAlign = 'left';
    ctx.fillText('Safe', 100, gaugeY + 70);
    ctx.textAlign = 'right';
    ctx.fillText('Crashout', W - 100, gaugeY + 70);
    ctx.textAlign = 'center';

    // ── Stats Grid ──
    const statsY = 820;
    const cardW = 420;
    const cardH = 180;
    const gap = 40;

    const fmt = new Intl.NumberFormat(currentLang);

    const statsConfig = [
        { val: `${fmt.format(r.caffeineMg)}`, unit: 'mg', label: t('result.dailyIntake'), icon: '⚡' },
        { val: `${fmt.format(r.limit)}`, unit: 'mg', label: t('result.safeLimit'), icon: '🛡️' },
        { val: `${fmt.format(r.yearlyKg)}`, unit: 'kg', label: t('result.yearlyIntake'), icon: '⚖️' },
        { val: `${fmt.format(r.tbw)}`, unit: 'L', label: t('result.bodyWater'), icon: '💧' }
    ];

    statsConfig.forEach((s, i) => {
        const col = i % 2;
        const row = Math.floor(i / 2);
        const x = (W - (cardW * 2 + gap)) / 2 + col * (cardW + gap);
        const y = statsY + row * (cardH + gap);

        drawGlassCard(x, y, cardW, cardH);

        // Value
        ctx.textAlign = 'left';
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '700 64px "Space Grotesk", sans-serif';
        ctx.fillText(s.val, x + 30, y + 80);

        // Unit
        ctx.font = '500 32px "Space Grotesk", sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.fillText(s.unit, x + 30 + ctx.measureText(s.val).width + 10, y + 80);

        // Label
        ctx.font = '500 24px "Inter", sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.fillText(s.label.toUpperCase(), x + 30, y + 130);

        // Icon
        ctx.font = '60px "Segoe UI Emoji"';
        ctx.textAlign = 'right';
        ctx.fillText(s.icon, x + cardW - 30, y + 90);
    });

    // ── Comparison / Fun Fact Card ──
    const compY = statsY + 2 * (cardH + gap) + 40;
    drawGlassCard(100, compY, W - 200, 220);

    ctx.textAlign = 'center';

    // Fun Fact Header
    ctx.fillStyle = '#FFD166';
    ctx.font = '700 32px "Space Grotesk", sans-serif';
    ctx.fillText(t('result.didYouKnow'), W / 2, compY + 60);

    // Fun Fact Text
    const facts = t('funFacts');
    const factText = Array.isArray(facts) ? (facts[r.funFactIndex] || facts[0]) : '';
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '400 32px "Inter", sans-serif';
    wrapText(ctx, factText, W / 2, compY + 110, W - 280, 48);

    // ── Footer ──
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '500 24px "Inter", sans-serif';
    ctx.fillText('caffeinecrashout.vercel.app', W / 2, H - 100);

    // Decorative bottom
    ctx.fillStyle = barGrad;
    ctx.fillRect(0, H - 12, W, 12);

    // ── Download ──
    const link = document.createElement('a');
    link.download = `caffeine-wrapped-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
}

// Canvas helpers
function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
    const words = text.split(' ');
    let line = '';
    let lines = [];
    for (const word of words) {
        const test = line + word + ' ';
        if (ctx.measureText(test).width > maxWidth && line) {
            lines.push(line.trim());
            line = word + ' ';
        } else {
            line = test;
        }
    }
    lines.push(line.trim());
    const startY = y;
    lines.forEach((l, i) => {
        ctx.fillText(l, x, startY + i * lineHeight);
    });
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
    const COUNT = 50;

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
        particles = Array.from({ length: COUNT }, createParticle);
    }

    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        particles.forEach(p => {
            p.x += p.vx;
            p.y += p.vy;
            if (p.y < -10) { p.y = canvas.height + 10; p.x = Math.random() * canvas.width; }
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
    initWrapped();
    initNewAnalysis();
    initLanding();
    // Language Switcher Listeners
    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.addEventListener('click', () => loadLanguage(btn.dataset.lang));
    });

    initParticles();
});
