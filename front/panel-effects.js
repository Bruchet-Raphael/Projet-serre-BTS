// ========================================
// EFFETS ANIMÉS DES PANNEAUX DE CONTRÔLE
// À coller dans setupControlsListeners() ou après
// ========================================

// Config des effets par panneau
const PANEL_EFFECTS = [
    { index: 0, activeClass: 'irrigation-active',  particleType: 'rain' },
    { index: 1, activeClass: 'misting-active',     particleType: 'mist' },
    { index: 2, activeClass: 'ventilation-active', particleType: 'wind' },
    { index: 3, activeClass: 'heating-active',     particleType: 'fire' },
];

function applyPanelEffect(panel, activeClass, particleType, mode) {
    // Supprimer tous les effets existants
    panel.classList.remove('heating-active', 'irrigation-active', 'ventilation-active', 'misting-active');
    clearPanelParticles(panel);

    if (mode !== 'active') return;

    panel.classList.add(activeClass);
    spawnParticles(panel, particleType);
}

function clearPanelParticles(panel) {
    panel.querySelectorAll('.spark, .raindrop, .splash, .wind-particle, .mistdrop').forEach(el => el.remove());
}

function spawnParticles(panel, type) {
    const w = panel.offsetWidth;
    const h = panel.offsetHeight;

    if (type === 'fire') {
        // Étincelles
        for (let i = 0; i < 8; i++) {
            const s = document.createElement('span');
            s.className = 'spark';
            s.style.cssText = `
                left: ${10 + Math.random() * 80}%;
                --duration: ${1.2 + Math.random() * 1.4}s;
                --delay: ${Math.random() * 2}s;
                --drift: ${(Math.random() - 0.5) * 30}px;
                --drift2: ${(Math.random() - 0.5) * 50}px;
            `;
            panel.appendChild(s);
        }
    }

    if (type === 'rain') {
        // Gouttes de pluie
        for (let i = 0; i < 18; i++) {
            const d = document.createElement('span');
            d.className = 'raindrop';
            d.style.cssText = `
                left: ${Math.random() * 95}%;
                --duration: ${0.7 + Math.random() * 0.7}s;
                --delay: ${Math.random() * 1.2}s;
                --panel-h: ${h}px;
            `;
            panel.appendChild(d);
        }
        // Éclaboussures
        for (let i = 0; i < 6; i++) {
            const sp = document.createElement('span');
            sp.className = 'splash';
            sp.style.cssText = `
                left: ${8 + Math.random() * 80}%;
                --duration: ${0.5 + Math.random() * 0.4}s;
                --delay: ${Math.random() * 1.5}s;
            `;
            panel.appendChild(sp);
        }
    }

    if (type === 'wind') {
        // Particules de vent
        for (let i = 0; i < 10; i++) {
            const p = document.createElement('span');
            p.className = 'wind-particle';
            const size = 2 + Math.random() * 4;
            p.style.cssText = `
                top: ${5 + Math.random() * 85}%;
                left: -10px;
                width: ${size}px;
                height: ${size * 0.4}px;
                --duration: ${0.8 + Math.random() * 0.8}s;
                --delay: ${Math.random() * 1.5}s;
                --drift: ${(Math.random() - 0.5) * 30}px;
                --spin: ${Math.random() * 360}deg;
                --panel-w: ${w}px;
            `;
            panel.appendChild(p);
        }
    }

    if (type === 'mist') {
        // Micro-gouttelettes de brume
        for (let i = 0; i < 22; i++) {
            const m = document.createElement('span');
            m.className = 'mistdrop';
            m.style.cssText = `
                left: ${Math.random() * 95}%;
                top: -4px;
                --duration: ${1.8 + Math.random() * 1.8}s;
                --delay: ${Math.random() * 3}s;
                --drift: ${(Math.random() - 0.3) * 20}px;
                --panel-h: ${h}px;
            `;
            panel.appendChild(m);
        }
    }
}

// Hook sur les boutons de mode — à appeler dans setupControlsListeners()
function initPanelEffects() {
    const panels = document.querySelectorAll('.control-panel');

    PANEL_EFFECTS.forEach(({ index, activeClass, particleType }) => {
        const panel = panels[index];
        if (!panel) return;

        panel.querySelectorAll('.mode-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const mode = btn.getAttribute('data-mode');
                // Petit délai pour laisser la classe .active se mettre à jour
                setTimeout(() => {
                    applyPanelEffect(panel, activeClass, particleType, mode);
                }, 30);
            });
        });
    });
}

// Appeler au chargement (après initializeEventListeners)
document.addEventListener('DOMContentLoaded', () => {
    initPanelEffects();
});

// Restauration après loadControles() — re-appliquer les effets selon le mode chargé
function applyEffectsFromLoadedControles() {
    const panels = document.querySelectorAll('.control-panel');
    PANEL_EFFECTS.forEach(({ index, activeClass, particleType }) => {
        const panel = panels[index];
        if (!panel) return;
        const activeBtn = panel.querySelector('.mode-btn.active');
        const mode = activeBtn ? activeBtn.getAttribute('data-mode') : 'inactive';
        applyPanelEffect(panel, activeClass, particleType, mode);
    });
}