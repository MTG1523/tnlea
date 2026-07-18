/* ═══════════════════════════════════════════════════════════════════════════
   TNLEA App — Main Application Logic
   Features: Firebase Auth/Firestore, Search, Filters, Drag-and-Drop,
             College Comparison, Rank Eligibility, Dark Mode, CSV Export
   ═══════════════════════════════════════════════════════════════════════════ */

// ── Firebase Config ──────────────────────────────────────────────────────────
const firebaseConfig = {
    apiKey: "AIzaSyCqcnfGLPtQhVBFm7zhSiY0pUre_LSPxlY",
    authDomain: "tnlea-a3ea2.firebaseapp.com",
    projectId: "tnlea-a3ea2",
    storageBucket: "tnlea-a3ea2.firebasestorage.app",
    messagingSenderId: "185173026809",
    appId: "1:185173026809:web:b5e2af654615885cdaff28",
    measurementId: "G-48Z2EPXYQG"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const provider = new firebase.auth.GoogleAuthProvider();

// ── DOM References ───────────────────────────────────────────────────────────
const searchInput      = document.getElementById('search-input');
const collegeTableBody = document.getElementById('college-table-body');
const choicesList      = document.getElementById('choices-list');
const choicesCount     = document.getElementById('choices-count');
const publicListEl     = document.getElementById('public-list');
const publicCount      = document.getElementById('public-count');
const compareCount     = document.getElementById('compare-count');
const compareContainer = document.getElementById('compare-container');
const compareEmptyState= document.getElementById('compare-empty-state');
const compareHintBar   = document.getElementById('compare-hint-bar');
const clearCompareBtn  = document.getElementById('clear-compare-btn');
const navItems         = document.querySelectorAll('.nav-item');
const sections         = document.querySelectorAll('.section');
const emptyState       = document.getElementById('empty-state');
const publicEmptyState = document.getElementById('public-empty-state');
const toastEl          = document.getElementById('toast');
const toastMsg         = document.getElementById('toast-message');
const exportBtn        = document.getElementById('export-btn');
const clearChoicesBtn  = document.getElementById('clear-choices-btn');
const themeBtn         = document.getElementById('theme-btn');
const themeIcon        = document.getElementById('theme-icon');
const loginBtn         = document.getElementById('login-btn');
const userProfile      = document.getElementById('user-profile');
const userName         = document.getElementById('user-name');
const userAvatar       = document.getElementById('user-avatar');
const logoutBtn        = document.getElementById('logout-btn');
const rankInput        = document.getElementById('rank-input');
const filterBranch     = document.getElementById('filter-branch');
const filterType       = document.getElementById('filter-type');
const filterDistrict   = document.getElementById('filter-district');
const clearFiltersBtn  = document.getElementById('clear-filters-btn');
const activeFiltersEl  = document.getElementById('active-filters');
const resultsCount     = document.getElementById('results-count');
const pageBreadcrumb   = document.getElementById('page-breadcrumb');
const mobileMenuBtn    = document.getElementById('mobile-menu-btn');
const sidebar          = document.getElementById('sidebar');
const sidebarOverlay   = document.getElementById('sidebar-overlay');

// ── App State ────────────────────────────────────────────────────────────────
let myChoices    = [];
let compareList  = [];
let publicChoices = [];
let currentUser  = null;
let dragSrcIndex = null;
let currentTheme = localStorage.getItem('tnlea_theme') || 'light';

try { myChoices   = JSON.parse(localStorage.getItem('tnlea_choices'))  || []; } catch(e) { myChoices   = []; }
try { compareList = JSON.parse(localStorage.getItem('tnlea_compare'))  || []; } catch(e) { compareList = []; }
try { publicChoices = JSON.parse(localStorage.getItem('tnlea_public')) || []; } catch(e) { publicChoices = []; }

// Filter state
let filterState = {
    search:   '',
    branch:   'all',
    type:     'all',
    district: 'all',
    rank:     ''
};

// ── Init ─────────────────────────────────────────────────────────────────────
function init() {
    applyTheme();
    populateStats();
    populateFilterDropdowns();
    applyFilters();
    renderChoices();
    renderPublicChoices(); // Show localStorage data immediately on load
    renderCompare();
    updateChoicesCount();
    updateCompareCount();
    publicCount.textContent = publicChoices.length;
    attachEventListeners();

    // Handle sessionStorage nav target from home.html action cards
    const navTarget = sessionStorage.getItem('tnlea_nav_target');
    if (navTarget) {
        sessionStorage.removeItem('tnlea_nav_target');
        setTimeout(() => navigateTo(navTarget), 100);
    }

    // Firebase auth listener — guarded for file:// environments
    try {
        auth.onAuthStateChanged(user => {
            currentUser = user ? { name: user.displayName, email: user.email, uid: user.uid } : null;
            updateAuthUI();
            
            if (currentUser) {
                // Fetch choices from Firestore
                db.collection('user_choices').doc(currentUser.uid).get()
                    .then(doc => {
                        if (doc.exists && doc.data().choices) {
                            myChoices = doc.data().choices;
                            localStorage.setItem('tnlea_choices', JSON.stringify(myChoices));
                        } else if (myChoices.length > 0) {
                            // If Firestore has no choices but local does, sync them up
                            saveChoices();
                        }
                        updateChoicesCount();
                        renderChoices();
                        applyFilters(); // re-render so public buttons update
                    })
                    .catch(err => {
                        console.warn('Failed to fetch choices', err);
                        applyFilters();
                    });
            } else {
                applyFilters(); // re-render so public buttons update
            }
        });
    } catch (e) {
        console.warn('Firebase Auth unavailable on file:// URL:', e.code);
    }

    // On file:// — update Sign In button label
    if (window.location.protocol === 'file:') {
        if (loginBtn) {
            loginBtn.title = 'Open with Live Server for Google Sign-In';
            loginBtn.innerHTML = '<i class="ri-google-fill"></i> Sign In';
        }
    }

    // Firestore real-time public list
    let firestoreLoaded = false;
    try {
        db.collection('public_choices')
            .orderBy('createdAt', 'desc')
            .onSnapshot(snapshot => {
                firestoreLoaded = true;
                const firestoreChoices = [];
                snapshot.forEach(doc => firestoreChoices.push({ id: doc.id, ...doc.data() }));
                
                // Reorder according to the saved local order
                const localOrderMap = {};
                local.forEach((item, index) => {
                    localOrderMap[item.code + '_' + item.branchCode] = index;
                });
                
                let merged = [...firestoreChoices, ...publicChoices.filter(l => l.id && l.id.startsWith('local_'))];
                
                // Remove exact duplicates that might occur if local_ item was just synced
                const uniqueMerged = [];
                const seenCodes = new Set();
                merged.forEach(item => {
                    const key = item.code + '_' + item.branchCode;
                    if (!seenCodes.has(key)) {
                        seenCodes.add(key);
                        uniqueMerged.push(item);
                    }
                });

                uniqueMerged.sort((a, b) => {
                    const idxA = localOrderMap[a.code + '_' + a.branchCode];
                    const idxB = localOrderMap[b.code + '_' + b.branchCode];
                    
                    if (idxA !== undefined && idxB !== undefined) return idxA - idxB;
                    // If a is new (not in local map), put it at the top
                    if (idxA === undefined && idxB !== undefined) return -1;
                    if (idxB === undefined && idxA !== undefined) return 1;
                    
                    // Fallback to createdAt
                    const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                    const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                    return timeB - timeA;
                });
                
                publicChoices = uniqueMerged;
                
                // Sync merged list back to localStorage
                localStorage.setItem('tnlea_public', JSON.stringify(publicChoices));

                publicCount.textContent = publicChoices.length;
                animateBadge(publicCount);
                renderPublicChoices();
                applyFilters();
            }, err => {
                firestoreLoaded = true;
                if (err.code !== 'permission-denied') {
                    console.warn('Firestore error:', err.code);
                }
                // Firestore failed — keep showing localStorage data (already rendered in init)
                try { publicChoices = JSON.parse(localStorage.getItem('tnlea_public')) || []; } catch(e) { publicChoices = []; }
                publicCount.textContent = publicChoices.length;
                animateBadge(publicCount);
                renderPublicChoices();
                applyFilters();
            });

        // Fallback: if Firestore hasn't responded in 3s, show localStorage data
        setTimeout(() => {
            if (!firestoreLoaded) {
                try { publicChoices = JSON.parse(localStorage.getItem('tnlea_public')) || []; } catch(e) { publicChoices = []; }
                publicCount.textContent = publicChoices.length;
                renderPublicChoices();
                applyFilters();
            }
        }, 3000);

    } catch (e) {
        console.warn('Firestore unavailable:', e.message);
        try { publicChoices = JSON.parse(localStorage.getItem('tnlea_public')) || []; } catch(err) { publicChoices = []; }
        renderPublicChoices();
        applyFilters();
    }
}

// ── Stats Bar ────────────────────────────────────────────────────────────────
function populateStats() {
    const uniqueCodes    = [...new Set(collegesData.map(c => c.code))];
    const uniqueDistricts= [...new Set(collegesData.map(c => c.district))];
    const govtCodes      = [...new Set(collegesData.filter(c => c.type === 'Government').map(c => c.code))];

    document.getElementById('stat-colleges').textContent  = uniqueCodes.length;
    document.getElementById('stat-govt').textContent      = govtCodes.length;
    document.getElementById('stat-districts').textContent = uniqueDistricts.length;
    document.getElementById('stat-entries').textContent   = collegesData.length;
}

// ── Filter Dropdowns Population ──────────────────────────────────────────────
function populateFilterDropdowns() {
    // Branch
    const branches = [...new Set(collegesData.map(c => c.branchCode))].sort();
    branches.forEach(code => {
        const sample = collegesData.find(c => c.branchCode === code);
        const opt = document.createElement('option');
        opt.value = code;
        opt.textContent = `${code} — ${sample ? truncate(sample.branchName, 35) : ''}`;
        filterBranch.appendChild(opt);
    });

    // District
    const districts = [...new Set(collegesData.map(c => c.district))].sort();
    districts.forEach(d => {
        const opt = document.createElement('option');
        opt.value = d;
        opt.textContent = d;
        filterDistrict.appendChild(opt);
    });
}

// ── Apply All Filters ────────────────────────────────────────────────────────
function applyFilters() {
    const query  = filterState.search.toLowerCase();
    const branch = filterState.branch;
    const type   = filterState.type;
    const dist   = filterState.district;
    const rank   = parseFloat(filterState.rank) || 0;

    const safeQ  = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex  = query ? new RegExp('\\b' + safeQ, 'i') : null;

    const filtered = collegesData.filter(c => {
        if (regex) {
            const matchesSearch = regex.test(c.name) || regex.test(c.code) ||
                                  regex.test(c.branchName) || regex.test(c.branchCode) ||
                                  regex.test(c.district);
            if (!matchesSearch) return false;
        }
        if (branch !== 'all' && c.branchCode !== branch) return false;
        if (type   !== 'all' && c.type !== type)         return false;
        if (dist   !== 'all' && c.district !== dist)     return false;
        return true;
    });

    renderColleges(filtered, rank);
    resultsCount.textContent = filtered.length;
    renderActiveFilterChips();
}

// ── Active Filter Chips ──────────────────────────────────────────────────────
function renderActiveFilterChips() {
    activeFiltersEl.innerHTML = '';

    if (filterState.branch !== 'all') {
        const s = collegesData.find(c => c.branchCode === filterState.branch);
        addChip(`Branch: ${filterState.branch}`, () => { filterBranch.value = 'all'; filterState.branch = 'all'; applyFilters(); });
    }
    if (filterState.type !== 'all') {
        addChip(`Type: ${filterState.type}`, () => { filterType.value = 'all'; filterState.type = 'all'; applyFilters(); });
    }
    if (filterState.district !== 'all') {
        addChip(`District: ${filterState.district}`, () => { filterDistrict.value = 'all'; filterState.district = 'all'; applyFilters(); });
    }
    if (filterState.rank) {
        addChip(`Diploma: ${parseFloat(filterState.rank).toFixed(2)}%`, () => { rankInput.value = ''; filterState.rank = ''; applyFilters(); });
    }
    if (filterState.search) {
        addChip(`"${filterState.search}"`, () => { searchInput.value = ''; filterState.search = ''; applyFilters(); });
    }
}

function addChip(label, onRemove) {
    const chip = document.createElement('div');
    chip.className = 'filter-chip';
    chip.innerHTML = `${label}<button title="Remove filter">×</button>`;
    chip.querySelector('button').addEventListener('click', onRemove);
    activeFiltersEl.appendChild(chip);
}

function clearAllFilters() {
    filterState = { search: '', branch: 'all', type: 'all', district: 'all', rank: '' };
    searchInput.value   = '';
    filterBranch.value  = 'all';
    filterType.value    = 'all';
    filterDistrict.value= 'all';
    rankInput.value     = '';
    applyFilters();
}

// ── Render Colleges Table ────────────────────────────────────────────────────
function renderColleges(data, userRank = 0) {
    collegeTableBody.innerHTML = '';

    if (data.length === 0) {
        collegeTableBody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align:center;padding:3rem;color:var(--text-muted);">
                    <i class="ri-search-line" style="font-size:2rem;display:block;margin-bottom:0.5rem;color:var(--border);"></i>
                    No results found. Try adjusting your filters.
                </td>
            </tr>`;
        return;
    }

    data.forEach(college => {
        const tr = document.createElement('tr');

        const isAddedPrivate = myChoices.some(c => c.code === college.code && c.branchCode === college.branchCode);
        const isAddedPublic  = publicChoices.some(c => c.code === college.code && c.branchCode === college.branchCode);
        const isCompared     = compareList.some(c => c.code === college.code && c.branchCode === college.branchCode);

        // Rank eligibility
        const cutoffBadgeHtml = getCutoffBadgeHtml(college.cutoff, userRank);

        // Type badge
        const typeBadgeClass = getTypeBadgeClass(college.type);
        const typeBadgeHtml  = `<span class="type-badge ${typeBadgeClass}">${college.type}</span>`;

        // Eligible row highlight
        if (userRank > 0 && college.cutoff && userRank >= college.cutoff) {
            tr.classList.add('eligible-row');
        }

        tr.innerHTML = `
            <td class="col-code">${college.code}</td>
            <td class="col-name" title="${college.name}">${truncate(college.name, 45)}</td>
            <td class="col-branch">
                <strong>${college.branchCode}</strong> · ${truncate(college.branchName, 38)}
            </td>
            <td>
                ${typeBadgeHtml}
                <div style="font-size:0.75rem;color:var(--text-muted);margin-top:0.3rem;">
                    <i class="ri-map-pin-line" style="font-size:0.7rem;"></i> ${college.district}
                </div>
            </td>
            <td>${cutoffBadgeHtml}</td>
            <td class="col-actions">
                <div class="actions-cell">
                    <button class="btn btn-sm ${isAddedPrivate ? 'btn-ghost' : 'btn-primary'}"
                            id="mine-btn-${college.code}-${college.branchCode}"
                            onclick="toggleChoice('${college.code}','${college.branchCode}',false)"
                            title="${isAddedPrivate ? 'Remove from My Choices' : 'Add to My Choices'}">
                        <i class="${isAddedPrivate ? 'ri-check-line' : 'ri-add-line'}"></i>
                        ${isAddedPrivate ? 'Added' : 'Mine'}
                    </button>
                    <button class="btn btn-sm ${isAddedPublic ? 'btn-ghost' : 'btn-secondary'}"
                            id="pub-btn-${college.code}-${college.branchCode}"
                            onclick="toggleChoice('${college.code}','${college.branchCode}',true)"
                            title="${isAddedPublic ? 'Remove from Public List' : 'Add to Public List'}">
                        <i class="${isAddedPublic ? 'ri-check-double-line' : 'ri-global-line'}"></i>
                        ${isAddedPublic ? 'Shared' : 'Public'}
                    </button>
                    <button class="btn btn-xs ${isCompared ? 'btn-teal' : 'btn-outline'}"
                            id="cmp-btn-${college.code}-${college.branchCode}"
                            onclick="toggleCompare('${college.code}','${college.branchCode}')"
                            title="${isCompared ? 'Remove from Compare' : 'Add to Compare'}">
                        <i class="${isCompared ? 'ri-bar-chart-grouped-fill' : 'ri-bar-chart-grouped-line'}"></i>
                    </button>
                </div>
            </td>
        `;
        collegeTableBody.appendChild(tr);
    });
}

function getCutoffBadgeHtml(cutoff, userRank) {
    if (!cutoff) return `<span class="cutoff-badge neutral">—</span>`;
    const label = cutoff.toLocaleString();

    if (!userRank) return `<span class="cutoff-badge neutral">${label}</span>`;

    if (userRank >= cutoff) {
        return `<span class="cutoff-badge eligible"><i class="ri-checkbox-circle-line"></i>${label}</span>`;
    } else if (userRank >= cutoff - 5) {
        return `<span class="cutoff-badge borderline"><i class="ri-alert-line"></i>${label}</span>`;
    } else {
        return `<span class="cutoff-badge hard"><i class="ri-close-circle-line"></i>${label}</span>`;
    }
}

function getTypeBadgeClass(type) {
    switch (type) {
        case 'Government':        return 'govt';
        case 'Government Aided':  return 'aided';
        case 'Self-Financing':    return 'sf';
        case 'Deemed':            return 'deemed';
        default:                  return 'sf';
    }
}

// ── Toggle Choice (Private / Public) ────────────────────────────────────────
window.toggleChoice = async function(code, branchCode, isPublic) {
    // No login required for public list — anyone can add

    const college = collegesData.find(c => c.code === code && c.branchCode === branchCode);

    if (isPublic) {
        const existingIdx = publicChoices.findIndex(c => c.code === code && c.branchCode === branchCode);
        if (existingIdx >= 0) {
            const existing = publicChoices[existingIdx];
            
            // Remove locally instantly
            publicChoices.splice(existingIdx, 1);
            localStorage.setItem('tnlea_public', JSON.stringify(publicChoices));
            showToast('Removed from Public List', 'info');
            
            // Fire and forget server removal
            if (existing.id && !existing.id.startsWith('local_')) {
                db.collection('public_choices').doc(existing.id).delete().catch(e => console.warn('Server delete failed', e));
            }
        } else {
            const entry = {
                ...college,
                addedBy: currentUser?.name || 'Anonymous',
                addedByUid: currentUser?.uid || null,
                createdAt: new Date().toISOString(),
                id: 'local_' + Date.now()
            };
            
            // Add locally instantly
            publicChoices.unshift(entry);
            localStorage.setItem('tnlea_public', JSON.stringify(publicChoices));
            showToast('Added to Public List 🌍', 'success');
            
            // Fire and forget server add — updates the local entry's id when done
            db.collection('public_choices').add({
                ...entry,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            }).then(docRef => {
                // Update the local entry with the real Firestore id
                const localIdx = publicChoices.findIndex(c => c.code === entry.code && c.branchCode === entry.branchCode);
                if (localIdx >= 0) publicChoices[localIdx].id = docRef.id;
                localStorage.setItem('tnlea_public', JSON.stringify(publicChoices));
            }).catch(e => console.warn('Server add failed:', e.message));
        }
        
        publicCount.textContent = publicChoices.length;
        animateBadge(publicCount);
        renderPublicChoices();
        applyFilters();
    } else {
        const idx = myChoices.findIndex(c => c.code === code && c.branchCode === branchCode);
        if (idx >= 0) {
            myChoices.splice(idx, 1);
            showToast('Removed from My Choices', 'info');
        } else {
            myChoices.push(college);
            showToast(`Added: ${college.branchCode} @ ${truncate(college.name, 30)}`, 'success');
        }
        saveChoices();
        updateChoicesCount();
        renderChoices();
        applyFilters();
    }
};

// ── My Choices ───────────────────────────────────────────────────────────────
function renderChoices() {
    const existingCards = choicesList.querySelectorAll('.choice-card');
    existingCards.forEach(c => c.remove());

    if (myChoices.length === 0) {
        emptyState.style.display = 'flex';
        return;
    }

    emptyState.style.display = 'none';

    myChoices.forEach((choice, index) => {
        const div = document.createElement('div');
        div.className = 'choice-card';
        div.setAttribute('draggable', 'true');
        div.dataset.index = index;

        div.innerHTML = `
            <i class="ri-draggable drag-handle" title="Drag to reorder"></i>
            <div class="choice-rank">${index + 1}</div>
            <div class="choice-details">
                <div class="choice-title" title="${choice.name}">${truncate(choice.name, 50)}</div>
                <div class="choice-subtitle">
                    <span class="choice-code">${choice.code}</span>
                    <span>${choice.branchCode} · ${truncate(choice.branchName, 35)}</span>
                    ${choice.district ? `<span style="opacity:0.7;"><i class="ri-map-pin-line"></i> ${choice.district}</span>` : ''}
                </div>
            </div>
            <div class="choice-actions">
                <div class="order-controls">
                    <button class="btn-icon" onclick="moveChoice(${index}, -1)" ${index === 0 ? 'disabled style="opacity:0.3"' : ''} title="Move up">
                        <i class="ri-arrow-up-s-line"></i>
                    </button>
                    <button class="btn-icon" onclick="moveChoice(${index}, 1)" ${index === myChoices.length - 1 ? 'disabled style="opacity:0.3"' : ''} title="Move down">
                        <i class="ri-arrow-down-s-line"></i>
                    </button>
                </div>
                <button class="btn-icon danger" onclick="removeChoice(${index})" title="Remove">
                    <i class="ri-delete-bin-line"></i>
                </button>
            </div>
        `;

        // Drag events
        div.addEventListener('dragstart', e => handleDragStart(e, index));
        div.addEventListener('dragover',  e => handleDragOver(e, index));
        div.addEventListener('dragleave', e => e.currentTarget.classList.remove('drag-over'));
        div.addEventListener('drop',      e => handleDrop(e, index));
        div.addEventListener('dragend',   () => {
            document.querySelectorAll('.choice-card').forEach(c => {
                c.classList.remove('dragging', 'drag-over');
            });
        });

        choicesList.appendChild(div);
    });
}

// ── Drag and Drop ─────────────────────────────────────────────────────────────
function handleDragStart(e, index) {
    dragSrcIndex = index;
    e.dataTransfer.effectAllowed = 'move';
    setTimeout(() => e.target.classList.add('dragging'), 0);
}

function handleDragOver(e, index) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragSrcIndex !== index) {
        e.currentTarget.classList.add('drag-over');
    }
}

function handleDrop(e, targetIndex) {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');
    if (dragSrcIndex === null || dragSrcIndex === targetIndex) return;

    const moved = myChoices.splice(dragSrcIndex, 1)[0];
    myChoices.splice(targetIndex, 0, moved);
    dragSrcIndex = null;

    saveChoices();
    renderChoices();
    showToast('Order updated ↕', 'success');
}

// ── Choice Controls ───────────────────────────────────────────────────────────
window.moveChoice = function(index, dir) {
    const newIdx = index + dir;
    if (newIdx < 0 || newIdx >= myChoices.length) return;
    [myChoices[index], myChoices[newIdx]] = [myChoices[newIdx], myChoices[index]];
    saveChoices();
    renderChoices();
};

window.removeChoice = function(index) {
    myChoices.splice(index, 1);
    saveChoices();
    updateChoicesCount();
    renderChoices();
    applyFilters();
    showToast('Choice removed', 'info');
};

function saveChoices() {
    localStorage.setItem('tnlea_choices', JSON.stringify(myChoices));
    if (currentUser) {
        db.collection('user_choices').doc(currentUser.uid).set({
            choices: myChoices,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }).catch(err => console.warn('Failed to sync choices to Firestore', err));
    }
}

function updateChoicesCount() {
    choicesCount.textContent = myChoices.length;
    if (myChoices.length > 0) animateBadge(choicesCount);
}

// ── Public Choices ────────────────────────────────────────────────────────────
function renderPublicChoices() {
    const existingCards = publicListEl.querySelectorAll('.choice-card');
    existingCards.forEach(c => c.remove());

    if (publicChoices.length === 0) {
        publicEmptyState.style.display = 'flex';
        return;
    }

    publicEmptyState.style.display = 'none';

    publicChoices.forEach((choice, index) => {
        const div = document.createElement('div');
        div.className = 'choice-card';
        div.setAttribute('draggable', 'true');
        div.dataset.index = index;

        const addedBy = choice.addedBy || 'Anonymous';
        const initial = addedBy.charAt(0).toUpperCase();
        const avatarColors = ['#6366f1','#8b5cf6','#ec4899','#14b8a6','#f59e0b','#ef4444','#22c55e'];
        const color = avatarColors[addedBy.charCodeAt(0) % avatarColors.length];
        const isLoggedIn = !!currentUser;
        
        div.innerHTML = `
            <i class="ri-draggable drag-handle" title="Drag to reorder"></i>
            <div class="choice-rank public-rank" style="background:${color};color:#fff;font-size:0.9rem;font-weight:700;">${initial}</div>
            <div class="choice-details">
                <div class="choice-title" title="${choice.name}">${truncate(choice.name, 50)}</div>
                <div class="choice-subtitle">
                    <span class="choice-code">${choice.code}</span>
                    <span>${choice.branchCode} · ${truncate(choice.branchName, 30)}</span>
                    <span class="added-by" style="color:${color};font-weight:600;"><i class="ri-user-fill"></i> ${addedBy}</span>
                </div>
            </div>
            <div class="choice-actions">
                <div class="order-controls">
                    <button class="btn-icon" onclick="movePublicChoice(${index}, -1)" ${index === 0 ? 'disabled style="opacity:0.3"' : ''} title="Move up">
                        <i class="ri-arrow-up-s-line"></i>
                    </button>
                    <button class="btn-icon" onclick="movePublicChoice(${index}, 1)" ${index === publicChoices.length - 1 ? 'disabled style="opacity:0.3"' : ''} title="Move down">
                        <i class="ri-arrow-down-s-line"></i>
                    </button>
                </div>
                ${isLoggedIn ? `<button class="btn-icon danger" onclick="removePublicChoice('${choice.id}','${choice.code}','${choice.branchCode}')" title="Remove from public"><i class="ri-delete-bin-line"></i></button>` : `<span style="font-size:0.7rem;color:var(--text-muted);padding:0.25rem;">Sign in<br>to remove</span>`}
            </div>
        `;

        // Drag events
        div.addEventListener('dragstart', e => handlePublicDragStart(e, index));
        div.addEventListener('dragover',  e => handlePublicDragOver(e, index));
        div.addEventListener('dragleave', e => e.currentTarget.classList.remove('drag-over'));
        div.addEventListener('drop',      e => handlePublicDrop(e, index));
        div.addEventListener('dragend',   () => {
            document.querySelectorAll('#public-list .choice-card').forEach(c => {
                c.classList.remove('dragging', 'drag-over');
            });
        });

        publicListEl.appendChild(div);
    });
}

// ── Public List Drag and Drop ───────────────────────────────────────────────
let publicDragSrcIndex = null;

function handlePublicDragStart(e, index) {
    publicDragSrcIndex = index;
    e.dataTransfer.effectAllowed = 'move';
    setTimeout(() => e.target.classList.add('dragging'), 0);
}

function handlePublicDragOver(e, index) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (publicDragSrcIndex !== index) {
        e.currentTarget.classList.add('drag-over');
    }
}

function handlePublicDrop(e, targetIndex) {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');
    if (publicDragSrcIndex === null || publicDragSrcIndex === targetIndex) return;

    const moved = publicChoices.splice(publicDragSrcIndex, 1)[0];
    publicChoices.splice(targetIndex, 0, moved);
    publicDragSrcIndex = null;

    localStorage.setItem('tnlea_public', JSON.stringify(publicChoices));
    renderPublicChoices();
    showToast('Public list order updated ↕', 'success');
}

window.movePublicChoice = function(index, dir) {
    const newIdx = index + dir;
    if (newIdx < 0 || newIdx >= publicChoices.length) return;
    [publicChoices[index], publicChoices[newIdx]] = [publicChoices[newIdx], publicChoices[index]];
    
    localStorage.setItem('tnlea_public', JSON.stringify(publicChoices));
    renderPublicChoices();
};

window.removePublicChoice = async function(docId, code, branchCode) {
    if (!currentUser) {
        showToast('Please sign in to remove entries from the Public List', 'info');
        return;
    }
    
    // Remove locally first for instant UI update
    const idx = publicChoices.findIndex(c => c.id === docId);
    if (idx >= 0) publicChoices.splice(idx, 1);
    localStorage.setItem('tnlea_public', JSON.stringify(publicChoices));
    publicCount.textContent = publicChoices.length;
    renderPublicChoices();
    applyFilters();
    showToast('Removed from Public List', 'info');
    
    // Then remove from Firestore
    if (docId && !docId.startsWith('local_')) {
        db.collection('public_choices').doc(docId).delete().catch(err => {
            console.warn('Firestore delete failed:', err.message);
        });
    }
};

// ── Compare Feature ───────────────────────────────────────────────────────────
window.toggleCompare = function(code, branchCode) {
    const idx = compareList.findIndex(c => c.code === code && c.branchCode === branchCode);
    if (idx >= 0) {
        compareList.splice(idx, 1);
        showToast('Removed from compare', 'info');
    } else {
        if (compareList.length >= 3) {
            showToast('You can compare up to 3 colleges at a time', 'error');
            return;
        }
        const college = collegesData.find(c => c.code === code && c.branchCode === branchCode);
        compareList.push(college);
        showToast(`Added to compare: ${college.branchCode}`, 'success');
    }
    localStorage.setItem('tnlea_compare', JSON.stringify(compareList));
    updateCompareCount();
    renderCompare();
    applyFilters(); // refresh button states
};

function updateCompareCount() {
    compareCount.textContent = compareList.length;
    if (compareList.length > 0) animateBadge(compareCount);

    // Update compare slots indicator
    for (let i = 0; i < 3; i++) {
        const slot = document.getElementById(`slot-${i}`);
        if (slot) slot.classList.toggle('filled', i < compareList.length);
    }
}

function renderCompare() {
    // Remove existing cards
    compareContainer.querySelectorAll('.compare-card').forEach(c => c.remove());

    clearCompareBtn.style.display = compareList.length > 0 ? 'inline-flex' : 'none';

    if (compareList.length === 0) {
        compareEmptyState.style.display = 'flex';
        return;
    }

    compareEmptyState.style.display = 'none';

    const grid = document.createElement('div');
    grid.className = 'compare-grid';

    compareList.forEach(college => {
        const card = document.createElement('div');
        card.className = 'compare-card';

        const typeBadge = `<span class="type-badge ${getTypeBadgeClass(college.type)}">${college.type}</span>`;
        const cutoffDisplay = college.cutoff ? college.cutoff.toLocaleString() : '—';

        const userRank = parseInt(filterState.rank) || 0;
        let eligibility = '—';
        if (userRank && college.cutoff) {
            if (userRank <= college.cutoff) eligibility = `<span style="color:var(--eligible-color);font-weight:700;">✓ Likely Eligible</span>`;
            else if (userRank <= college.cutoff * 1.15) eligibility = `<span style="color:var(--borderline-color);font-weight:700;">⚠ Borderline</span>`;
            else eligibility = `<span style="color:var(--hard-color);font-weight:700;">✗ Unlikely</span>`;
        }

        card.innerHTML = `
            <div class="compare-card-header">
                <div class="college-name">${truncate(college.name, 55)}</div>
                <div style="margin-top:0.5rem;display:flex;gap:0.4rem;flex-wrap:wrap;">
                    ${typeBadge}
                    <span class="type-badge" style="background:rgba(20,184,166,0.1);color:#14b8a6;border-color:rgba(20,184,166,0.2);">
                        <i class="ri-map-pin-line" style="font-size:0.7rem;"></i> ${college.district}
                    </span>
                </div>
            </div>
            <div class="compare-card-body">
                <div class="compare-row">
                    <span class="label">College Code</span>
                    <span class="value" style="font-family:'JetBrains Mono',monospace;color:var(--primary);">${college.code}</span>
                </div>
                <div class="compare-row">
                    <span class="label">Branch</span>
                    <span class="value" style="text-align:right;max-width:160px;">${college.branchCode} · ${truncate(college.branchName, 28)}</span>
                </div>
                <div class="compare-row">
                    <span class="label">Approx. Cutoff</span>
                    <span class="value" style="font-family:'JetBrains Mono',monospace;">${cutoffDisplay}</span>
                </div>
                ${userRank ? `
                <div class="compare-row">
                    <span class="label">Your Eligibility</span>
                    <span class="value">${eligibility}</span>
                </div>` : ''}
            </div>
            <div class="compare-card-footer">
                <button class="btn btn-outline btn-sm" style="flex:1;"
                        onclick="toggleChoice('${college.code}','${college.branchCode}',false)">
                    <i class="ri-add-line"></i> Add to Mine
                </button>
                <button class="btn btn-danger-soft btn-sm"
                        onclick="toggleCompare('${college.code}','${college.branchCode}')" title="Remove from compare">
                    <i class="ri-close-line"></i>
                </button>
            </div>
        `;
        grid.appendChild(card);
    });

    compareContainer.appendChild(grid);
}

// ── Auth ─────────────────────────────────────────────────────────────────────
const IS_FILE_URL = window.location.protocol === 'file:';

function handleLogin() {
    // Firebase Auth does not support file:// URLs
    if (IS_FILE_URL) {
        showToast('Open with Live Server (not file://) for Google Sign-In', 'info');
        return;
    }
    auth.signInWithPopup(provider)
        .then(result => {
            showToast(`Welcome, ${result.user.displayName} 👋`, 'success');
        })
        .catch(err => {
            console.warn('Auth error:', err.code, err.message);
            const code = err.code || '';
            if (code === 'auth/unauthorized-domain') {
                showToast('Domain not authorized. Add localhost in Firebase Console → Auth → Authorized Domains.', 'error');
            } else if (code === 'auth/operation-not-supported-in-this-environment') {
                showToast('Open with Live Server for Google Sign-In to work.', 'info');
            } else if (code === 'auth/popup-blocked') {
                showToast('Popup blocked — please allow popups and try again.', 'error');
            } else if (code === 'auth/popup-closed-by-user') {
                // User cancelled — silent
            } else {
                showToast('Sign-in failed: ' + (err.code || 'unknown error'), 'error');
            }
        });
}

function handleLogout() {
    auth.signOut()
        .then(() => {
            localStorage.removeItem('tnlea_guest');
            localStorage.removeItem('tnlea_choices');
            localStorage.removeItem('tnlea_compare');
            showToast('Signed out', 'info');
            setTimeout(() => { window.location.href = 'login.html'; }, 1000);
        })
        .catch(err => console.warn('Logout error:', err));
}

function updateAuthUI() {
    if (currentUser) {
        loginBtn.style.display = 'none';
        userProfile.classList.remove('hidden');
        userName.textContent = currentUser.name || 'User';
        userAvatar.textContent = (currentUser.name || 'U').charAt(0).toUpperCase();
    } else {
        loginBtn.style.display = 'inline-flex';
        userProfile.classList.add('hidden');
    }
}

// ── Theme ─────────────────────────────────────────────────────────────────────
function applyTheme() {
    document.documentElement.setAttribute('data-theme', currentTheme);
    themeIcon.className = currentTheme === 'dark' ? 'ri-sun-fill' : 'ri-moon-fill';
}

function toggleTheme() {
    currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('tnlea_theme', currentTheme);
    applyTheme();
}

// ── Export CSV ────────────────────────────────────────────────────────────────
function exportChoices() {
    if (myChoices.length === 0) {
        showToast('No choices to export', 'error');
        return;
    }
    let csv = 'Choice No,College Code,College Name,Branch Code,Branch Name,District,Type,Approx. Cutoff\n';
    myChoices.forEach((c, i) => {
        csv += `${i + 1},"${c.code}","${c.name}","${c.branchCode}","${c.branchName}","${c.district || ''}","${c.type || ''}","${c.cutoff || ''}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `tnlea_choices_${new Date().toISOString().slice(0,10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    showToast('Choices exported as CSV ✓', 'success');
}

// ── Navigation ────────────────────────────────────────────────────────────────
const pageNames = {
    browse:  'Browse Colleges',
    public:  'Public List',
    choices: 'My Choices',
    compare: 'Compare'
};

function navigateTo(target) {
    navItems.forEach(n => n.classList.toggle('active', n.dataset.target === target));
    sections.forEach(s => s.classList.toggle('active', s.id === `${target}-section`));
    pageBreadcrumb.innerHTML = `<strong>${pageNames[target] || target}</strong>`;
}

// ── Toast ─────────────────────────────────────────────────────────────────────
let toastTimeout;
function showToast(message, type = 'success') {
    clearTimeout(toastTimeout);
    toastMsg.textContent = message;
    const icon = toastEl.querySelector('i');
    if (icon) {
        icon.className = type === 'success' ? 'ri-checkbox-circle-line'
                       : type === 'error'   ? 'ri-close-circle-line'
                       : 'ri-information-line';
    }
    toastEl.className = `toast ${type} show`;
    toastTimeout = setTimeout(() => toastEl.classList.remove('show'), 3000);
}

// ── Badge Animation ────────────────────────────────────────────────────────────
function animateBadge(el) {
    el.classList.remove('pulse');
    void el.offsetWidth;
    el.classList.add('pulse');
}

// ── Utilities ─────────────────────────────────────────────────────────────────
function truncate(str, maxLen) {
    if (!str) return '';
    return str.length > maxLen ? str.slice(0, maxLen) + '…' : str;
}

// ── Event Listeners ───────────────────────────────────────────────────────────
function attachEventListeners() {
    // Navigation
    navItems.forEach(item => {
        item.addEventListener('click', e => {
            const target = e.currentTarget.dataset.target;
            if (target) {
                e.preventDefault();
                navigateTo(target);
            }
            // Close mobile sidebar
            sidebar.classList.remove('open');
            sidebarOverlay.classList.add('hidden');
        });
    });

    // Search
    searchInput.addEventListener('input', e => {
        filterState.search = e.target.value.trim();
        applyFilters();
    });

    // Filter dropdowns
    filterBranch.addEventListener('change', e => { filterState.branch = e.target.value; applyFilters(); });
    filterType.addEventListener('change',   e => { filterState.type   = e.target.value; applyFilters(); });
    filterDistrict.addEventListener('change',e => { filterState.district = e.target.value; applyFilters(); });

    // Rank input
    rankInput.addEventListener('input', e => {
        filterState.rank = e.target.value;
        applyFilters();
    });

    // Clear filters
    clearFiltersBtn.addEventListener('click', clearAllFilters);

    // Export
    exportBtn.addEventListener('click', exportChoices);

    // Clear all choices
    clearChoicesBtn.addEventListener('click', () => {
        if (myChoices.length === 0) return;
        if (confirm(`Clear all ${myChoices.length} choices? This cannot be undone.`)) {
            myChoices = [];
            saveChoices();
            updateChoicesCount();
            renderChoices();
            applyFilters();
            showToast('All choices cleared', 'info');
        }
    });

    // Clear compare
    clearCompareBtn.addEventListener('click', () => {
        compareList = [];
        localStorage.removeItem('tnlea_compare');
        updateCompareCount();
        renderCompare();
        applyFilters();
        showToast('Compare list cleared', 'info');
    });

    // Auth
    loginBtn.addEventListener('click', handleLogin);
    logoutBtn.addEventListener('click', handleLogout);

    // Theme
    themeBtn.addEventListener('click', toggleTheme);

    // Mobile sidebar
    mobileMenuBtn.addEventListener('click', () => {
        sidebar.classList.add('open');
        sidebarOverlay.classList.remove('hidden');
    });

    sidebarOverlay.addEventListener('click', () => {
        sidebar.classList.remove('open');
        sidebarOverlay.classList.add('hidden');
    });
}

// ── Start ─────────────────────────────────────────────────────────────────────
init();
