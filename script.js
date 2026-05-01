const inputs = document.querySelectorAll('.item-input');
const profileSelect = document.getElementById('profile-select');
const addProfileBtn = document.getElementById('add-profile-btn');
const renameProfileBtn = document.getElementById('rename-profile-btn');
const duplicateProfileBtn = document.getElementById('duplicate-profile-btn');
const removeProfileBtn = document.getElementById('remove-profile-btn');
const importProfileBtn = document.getElementById('import-profile-btn');
const exportProfileBtn = document.getElementById('export-profile-btn');
const exportReadableProfileBtn = document.getElementById('export-readable-profile-btn');
const profileImportInput = document.getElementById('profile-import-input');
const fingerSummary = document.getElementById('finger-summary');
const EXAMPLE_PROFILE_FILES = ['examples/fortnite-default.json', 'examples/fortnite-2.json', 'examples/valorant-default.json'];
const EXAMPLE_SEED_VERSION_KEY = 'listExampleSeedVersion';
const EXAMPLE_SEED_VERSION = 4;
const PROFILES_KEY = 'listProfiles';
const LEGACY_KEY = 'listData';
const FINGERS = [
    { id: 'thumb', label: 'Thumb', color: '#f9e2af' },
    { id: 'index', label: 'Index', color: '#a6e3a1' },
    { id: 'middle', label: 'Middle', color: '#89b4fa' },
    { id: 'ring', label: 'Ring', color: '#cba6f7' },
    { id: 'pinky', label: 'Pinky', color: '#f5c2e7' },
    { id: 'mouse', label: 'Mouse', color: '#94e2d5' }
];
const FINGER_CODES = {
    thumb: 'thumb',
    index: 'index',
    middle: 'middle',
    ring: 'ring',
    pinky: 'pinky',
    mouse: 'mouse'
};
let dragInfo = null, connDrag = null, connections = [];
let profileStore = { activeId: '', profiles: [] };

window.addEventListener('DOMContentLoaded', () => {
    initProfiles().catch(() => {
        profileStore = createFreshDefaultStore();
        renderProfileSelect();
        loadProfile(getActiveProfile());
    });
});
inputs.forEach(input => {
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && input.value.trim() !== '') {
            addItem(input.value.trim(), input.dataset.side, createId());
            input.value = '';
            saveData();
        }
    });
});
profileSelect.addEventListener('change', () => switchProfile(profileSelect.value));
addProfileBtn.addEventListener('click', addProfile);
renameProfileBtn.addEventListener('click', renameProfile);
duplicateProfileBtn.addEventListener('click', duplicateProfile);
removeProfileBtn.addEventListener('click', removeProfile);
importProfileBtn.addEventListener('click', () => profileImportInput.click());
exportProfileBtn.addEventListener('click', exportActiveProfile);
exportReadableProfileBtn.addEventListener('click', exportActiveProfileReadable);
profileImportInput.addEventListener('change', importProfileFile);

function createId() {
    return globalThis.crypto?.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createProfile(name, data = null) {
    return {
        id: createId(),
        name,
        data: data || { left: [], right: [], connections: [] }
    };
}

function addItem(text, side, id, finger = '') {
    const list = document.getElementById(`list-${side}`);
    const li = document.createElement('li');
    li.className = 'list-item';
    li.id = id;
    li.innerHTML = `<div class="anchor anchor-${side}" data-id="${id}"></div><span class="item-text"></span>
        ${side === 'right' ? '<span class="related-actions"></span>' : ''}
        ${side === 'left' ? createFingerSelectHtml(finger) : ''}
        <button class="btn edit-btn" type="button">✎</button><button class="btn delete-btn" type="button">&times;</button>`;
    li.dataset.fullText = text;
    li.querySelector('.item-text').textContent = text;
    if (side === 'left' && finger) li.dataset.finger = finger;
    const fingerSelect = li.querySelector('.finger-select');
    if (fingerSelect) {
        fingerSelect.addEventListener('change', () => {
            setRowFinger(li, fingerSelect.value);
            updateUI();
            saveData();
        });
    }
    li.querySelector('.delete-btn').onclick = () => { li.remove(); updateUI(); saveData(); };
    li.querySelector('.edit-btn').onclick = () => editItem(li.querySelector('.item-text'));
    li.onpointerdown = (e) => {
        if (e.target.classList.contains('anchor')) startConnDrag(e, id, side);
        else if (!e.target.closest('button, select')) startReorder(e, li);
    };
    list.appendChild(li);
    updateUI();
}

function editItem(span) {
    const li = span.closest('.list-item');
    const previous = li?.dataset.fullText ?? span.textContent;
    const newText = prompt('Edit item:', previous);
    if (newText && newText.trim()) {
        const trimmed = newText.trim();
        if (li) li.dataset.fullText = trimmed;
        span.textContent = trimmed;
        saveData();
        updateUI();
    }
}

function startReorder(e, li) {
    li.setPointerCapture(e.pointerId);
    dragInfo = { element: li, startY: e.clientY };
    li.classList.add('is-dragging');
}

function startConnDrag(e, id, side) {
    e.preventDefault();
    e.stopPropagation();
    e.target.setPointerCapture(e.pointerId);
    connDrag = { startId: id, side, anchor: e.target, pointerId: e.pointerId, x: e.clientX, y: e.clientY };
    draw();
}

window.onpointermove = (e) => {
    if (dragInfo) {
        const { element, startY } = dragInfo;
        const deltaY = e.clientY - startY;
        element.style.transform = `translateY(${deltaY}px)`;
        
        const siblings = [...element.parentElement.querySelectorAll('.list-item:not(.is-dragging)')];
        const next = siblings.find(s => e.clientY < s.getBoundingClientRect().top + s.offsetHeight / 2);
        
        const moveItem = (target) => {
            const oldTop = element.getBoundingClientRect().top;
            target ? element.parentElement.insertBefore(element, target) : element.parentElement.appendChild(element);
            const newTop = element.getBoundingClientRect().top;
            dragInfo.startY += (newTop - oldTop);
            element.style.transform = `translateY(${e.clientY - dragInfo.startY}px)`;
        };

        if (next && next !== element.nextSibling) moveItem(next);
        else if (!next && element.nextSibling) moveItem(null);
        updateUI();
    }
    if (connDrag) { connDrag.x = e.clientX; connDrag.y = e.clientY; draw(); }
};

window.onpointerup = (e) => {
    if (dragInfo) {
        const droppedElement = dragInfo.element;
        dragInfo.element.releasePointerCapture(e.pointerId);
        dragInfo.element.classList.remove('is-dragging');
        dragInfo.element.style.transform = '';
        dragInfo = null;
        redrawAfterDrop(droppedElement);
        saveData();
    }
    if (connDrag) {
        const target = document.elementFromPoint(e.clientX, e.clientY)?.closest('.anchor');
        if (target) {
            const endId = target.dataset.id, endSide = target.closest('.column').id === 'left-column' ? 'left' : 'right';
            if (connDrag.side !== endSide && connDrag.startId !== endId) {
                const from = connDrag.side === 'left' ? connDrag.startId : endId, to = connDrag.side === 'right' ? connDrag.startId : endId;
                if (!connections.some(c => c.from === from && c.to === to)) connections.push({ from, to });
            }
        }
        if (connDrag.anchor.hasPointerCapture(connDrag.pointerId)) {
            connDrag.anchor.releasePointerCapture(connDrag.pointerId);
        }
        connDrag = null;
        saveData();
        updateUI();
    }
};

function updateUI() {
    connections = connections.filter(c => document.getElementById(c.from) && document.getElementById(c.to));
    applyFingerStyles();
    renderFingerSummary();
    fitRightActionLabelsToPage();
    renderRelatedActions();
    draw();
}

function applyFingerStyles() {
    document.querySelectorAll('.list-item').forEach(li => clearRowFinger(li));

    document.querySelectorAll('#list-left .list-item').forEach(li => {
        const finger = li.querySelector('.finger-select')?.value || '';
        setRowFinger(li, finger);
    });

    document.querySelectorAll('#list-right .list-item').forEach(li => {
        const connection = connections.find(c => c.to === li.id);
        const finger = connection ? getLeftItemFinger(connection.from) : '';
        setRowFinger(li, finger);
    });
}

function clearRowFinger(li) {
    li.removeAttribute('data-finger');
    li.style.removeProperty('--finger-color');
}

function setRowFinger(li, fingerId) {
    const finger = FINGERS.find(f => f.id === fingerId);
    if (!finger) {
        clearRowFinger(li);
        return;
    }
    li.dataset.finger = finger.id;
    li.style.setProperty('--finger-color', finger.color);
}

function getLeftItemFinger(id) {
    return document.getElementById(id)?.querySelector('.finger-select')?.value || '';
}

function renderFingerSummary() {
    const totals = Object.fromEntries(FINGERS.map(finger => [finger.id, { active: new Set(), total: 0 }]));

    document.querySelectorAll('#list-left .list-item').forEach(li => {
        const finger = getLeftItemFinger(li.id);
        if (finger && totals[finger]) totals[finger].total += 1;
    });

    connections.forEach(connection => {
        const finger = getLeftItemFinger(connection.from);
        if (finger && totals[finger]) totals[finger].active.add(connection.to);
    });

    fingerSummary.innerHTML = '';
    FINGERS.forEach(finger => {
        const badge = document.createElement('span');
        badge.className = 'finger-count';
        badge.style.setProperty('--finger-color', finger.color);
        badge.textContent = `${finger.label} ${totals[finger.id].active.size}/${totals[finger.id].total}`;
        fingerSummary.appendChild(badge);
    });
}

function renderRelatedActions() {
    const rightItems = [...document.querySelectorAll('#list-right .list-item')];
    const actionFingerById = new Map();

    rightItems.forEach(li => {
        const connection = connections.find(c => c.to === li.id);
        actionFingerById.set(li.id, connection ? getLeftItemFinger(connection.from) : '');
    });

    rightItems.forEach(li => {
        const related = li.querySelector('.related-actions');
        if (!related) return;

        const finger = actionFingerById.get(li.id);
        const relatedNames = rightItems
            .filter(other => other.id !== li.id && actionFingerById.get(other.id) === finger && finger)
            .map(other => other.querySelector('.item-text').textContent);

        related.textContent = relatedNames.length ? `: ${relatedNames.join(', ')}` : '';
    });
}

function draw() {
    const svg = document.getElementById('connector-svg');
    svg.innerHTML = '';
    connections.forEach(c => svg.appendChild(createLine(getPos(c.from), getPos(c.to), false, c)));
    if (connDrag) svg.appendChild(createLine(getPos(connDrag.startId), { x: connDrag.x, y: connDrag.y }, true));
}

function getPos(id) {
    const el = document.getElementById(id);
    if (!el) return { x: 0, y: 0 };
    const rect = el.querySelector('.anchor').getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

function createLine(p1, p2, temp = false, connection = null) {
    const l = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    l.setAttribute('x1', p1.x); l.setAttribute('y1', p1.y);
    l.setAttribute('x2', p2.x); l.setAttribute('y2', p2.y);
    l.setAttribute('class', `connection-line ${temp ? 'temp-line' : ''}`);
    if (connection) {
        l.addEventListener('click', (e) => {
            e.stopPropagation();
            removeConnection(connection);
        });
    }
    return l;
}

function removeConnection(connection) {
    connections = connections.filter(c => c.from !== connection.from || c.to !== connection.to);
    saveData();
    draw();
}

function redrawAfterDrop(element) {
    updateUI();
    requestAnimationFrame(draw);
    setTimeout(draw, 0);
    setTimeout(draw, 120);
    setTimeout(draw, 240);

    const onTransitionEnd = event => {
        if (event.propertyName !== 'transform') return;
        element.removeEventListener('transitionend', onTransitionEnd);
        draw();
    };
    element.addEventListener('transitionend', onTransitionEnd);
}

function saveData() {
    const activeProfile = getActiveProfile();
    if (!activeProfile) return;
    activeProfile.data = getCurrentData();
    saveProfiles();
}

function getStoredItemText(li) {
    return li.dataset.fullText ?? li.querySelector('.item-text')?.textContent ?? '';
}

function getCurrentData() {
    return {
        left: [...document.getElementById('list-left').children].map(li => ({
            id: li.id,
            text: getStoredItemText(li),
            finger: li.querySelector('.finger-select')?.value || ''
        })),
        right: [...document.getElementById('list-right').children].map(li => ({
            id: li.id,
            text: getStoredItemText(li)
        })),
        connections
    };
}

function countWords(text) {
    const trimmed = text.trim();
    if (!trimmed) return 0;
    return trimmed.split(/\s+/).length;
}

function stripFirstWord(text) {
    const parts = text.trim().split(/\s+/).filter(Boolean);
    if (parts.length <= 1) return text.trim();
    return parts.slice(1).join(' ');
}

function pageOverflowsHorizontally() {
    const doc = document.documentElement;
    return doc.scrollWidth > doc.clientWidth + 2;
}

function fitRightActionLabelsToPage() {
    const items = [...document.querySelectorAll('#list-right .list-item')];
    if (!items.length) return;

    for (const li of items) {
        const span = li.querySelector('.item-text');
        if (!span) continue;
        const full = li.dataset.fullText ?? span.textContent;
        li.dataset.fullText = full;
        span.textContent = full;
    }

    let guard = 0;
    while (guard++ < 512 && pageOverflowsHorizontally()) {
        const spans = items.map(li => li.querySelector('.item-text')).filter(Boolean);
        const displays = spans.map(span => span.textContent);
        const counts = displays.map(countWords);
        const maxWords = Math.max(0, ...counts);
        if (maxWords <= 1) break;
        const idx = counts.indexOf(maxWords);
        const next = stripFirstWord(displays[idx]);
        if (next === displays[idx]) break;
        spans[idx].textContent = next;
    }
}

async function initProfiles() {
    profileStore = await loadProfileStore();
    renderProfileSelect();
    loadProfile(getActiveProfile());
}

function createFreshDefaultStore() {
    const firstProfile = createProfile('Default', normalizeProfileData(null));
    return { activeId: firstProfile.id, profiles: [firstProfile] };
}

async function loadProfileStore() {
    const saved = parseStoredJson(PROFILES_KEY);
    if (saved?.profiles?.length) {
        const store = cloneSavedProfileStore(saved);
        store.activeId = store.profiles.some(p => p.id === store.activeId) ? store.activeId : store.profiles[0].id;

        const prevSeed = parseInt(localStorage.getItem(EXAMPLE_SEED_VERSION_KEY) || '0', 10);
        if (prevSeed < EXAMPLE_SEED_VERSION) {
            const merged = await mergeBundledExampleProfiles(store);
            if (merged) {
                localStorage.setItem(EXAMPLE_SEED_VERSION_KEY, String(EXAMPLE_SEED_VERSION));
                localStorage.setItem(PROFILES_KEY, JSON.stringify(store));
            }
        }
        return store;
    }

    const legacyNormalized = normalizeProfileData(parseStoredJson(LEGACY_KEY));
    const hasLegacyItems =
        legacyNormalized.left.length ||
        legacyNormalized.right.length ||
        legacyNormalized.connections.length;

    if (hasLegacyItems) {
        const firstProfile = createProfile('Default', legacyNormalized);
        const store = { activeId: firstProfile.id, profiles: [firstProfile] };
        localStorage.setItem(PROFILES_KEY, JSON.stringify(store));
        return store;
    }

    const seeded = await seedExampleProfilesFromFiles();
    if (seeded) {
        localStorage.setItem(EXAMPLE_SEED_VERSION_KEY, String(EXAMPLE_SEED_VERSION));
        localStorage.setItem(PROFILES_KEY, JSON.stringify(seeded));
        return seeded;
    }

    const firstProfile = createProfile('Default', legacyNormalized);
    const store = { activeId: firstProfile.id, profiles: [firstProfile] };
    localStorage.setItem(PROFILES_KEY, JSON.stringify(store));
    return store;
}

function cloneSavedProfileStore(saved) {
    try {
        return structuredClone(saved);
    } catch {
        return JSON.parse(JSON.stringify(saved));
    }
}

async function fetchExamplePayloads() {
    try {
        const responses = await Promise.all(EXAMPLE_PROFILE_FILES.map(relPath => fetch(relPath)));
        if (!responses.every(response => response.ok)) return null;
        return await Promise.all(responses.map(response => response.json()));
    } catch {
        return null;
    }
}

function applyExamplePayloadToStore(store, payload) {
    const name = payload.name?.trim() || 'Example';
    const data = normalizeProfileData(payload.data);
    const existing = store.profiles.find(p => p.name === name);
    if (existing) {
        existing.data = data;
    } else {
        store.profiles.push(createProfile(name, data));
    }
}

async function mergeBundledExampleProfiles(store) {
    const payloads = await fetchExamplePayloads();
    if (!payloads) return false;
    payloads.forEach(payload => applyExamplePayloadToStore(store, payload));
    return true;
}

async function seedExampleProfilesFromFiles() {
    const payloads = await fetchExamplePayloads();
    if (!payloads) return null;
    const profiles = payloads.map(payload =>
        createProfile(payload.name?.trim() || 'Example', normalizeProfileData(payload.data))
    );
    return { activeId: profiles[0].id, profiles };
}

function parseStoredJson(key) {
    try {
        return JSON.parse(localStorage.getItem(key) || 'null');
    } catch {
        localStorage.removeItem(key);
        return null;
    }
}

function normalizeProfileData(data) {
    return {
        left: Array.isArray(data?.left) ? data.left.map(i => ({ ...i, finger: i.finger || '' })) : [],
        right: Array.isArray(data?.right) ? data.right : [],
        connections: Array.isArray(data?.connections) ? data.connections : []
    };
}

function getActiveProfile() {
    return profileStore.profiles.find(p => p.id === profileStore.activeId) || profileStore.profiles[0];
}

function saveProfiles() {
    localStorage.setItem(PROFILES_KEY, JSON.stringify(profileStore));
}

function renderProfileSelect() {
    profileSelect.innerHTML = '';
    profileStore.profiles.forEach(profile => {
        const option = document.createElement('option');
        option.value = profile.id;
        option.textContent = profile.name;
        profileSelect.appendChild(option);
    });
    profileSelect.value = profileStore.activeId;
}

function switchProfile(profileId) {
    saveData();
    profileStore.activeId = profileId;
    saveProfiles();
    loadProfile(getActiveProfile());
}

function loadProfile(profile) {
    clearLists();
    const data = normalizeProfileData(profile?.data);
    data.left.forEach(i => addItem(i.text, 'left', i.id, i.finger || ''));
    data.right.forEach(i => addItem(i.text, 'right', i.id));
    connections = data.connections;
    updateUI();
}

function createFingerSelectHtml(selectedFinger) {
    const options = ['<option value="">Finger</option>']
        .concat(FINGERS.map(finger => `<option value="${finger.id}" ${finger.id === selectedFinger ? 'selected' : ''}>${finger.label}</option>`));
    return `<select class="finger-select" aria-label="Finger">${options.join('')}</select>`;
}

function clearLists() {
    document.getElementById('list-left').innerHTML = '';
    document.getElementById('list-right').innerHTML = '';
    connections = [];
    dragInfo = null;
    connDrag = null;
}

function addProfile() {
    saveData();
    const name = prompt('New profile name:', nextProfileName('Profile'));
    if (!name?.trim()) return;
    const profile = createProfile(name.trim());
    profileStore.profiles.push(profile);
    profileStore.activeId = profile.id;
    saveProfiles();
    renderProfileSelect();
    loadProfile(profile);
}

function renameProfile() {
    const profile = getActiveProfile();
    if (!profile) return;
    const name = prompt('Rename profile:', profile.name);
    if (!name?.trim()) return;
    profile.name = name.trim();
    saveProfiles();
    renderProfileSelect();
}

function duplicateProfile() {
    saveData();
    const source = getActiveProfile();
    if (!source) return;
    const name = prompt('Duplicate profile name:', `${source.name} Copy`);
    if (!name?.trim()) return;
    const dataCopy = JSON.parse(JSON.stringify(source.data));
    const profile = createProfile(name.trim(), dataCopy);
    profileStore.profiles.push(profile);
    profileStore.activeId = profile.id;
    saveProfiles();
    renderProfileSelect();
    loadProfile(profile);
}

function removeProfile() {
    const profile = getActiveProfile();
    if (!profile || profileStore.profiles.length <= 1) return;
    if (!confirm(`Remove profile "${profile.name}"?`)) return;

    const removedIndex = profileStore.profiles.findIndex(p => p.id === profile.id);
    profileStore.profiles = profileStore.profiles.filter(p => p.id !== profile.id);
    const nextIndex = Math.min(Math.max(removedIndex, 0), profileStore.profiles.length - 1);
    profileStore.activeId = profileStore.profiles[nextIndex].id;
    saveProfiles();
    renderProfileSelect();
    loadProfile(getActiveProfile());
}

function exportActiveProfile() {
    saveData();
    const profile = getActiveProfile();
    if (!profile) return;

    const exportProfile = {
        name: profile.name,
        data: normalizeProfileData(profile.data)
    };
    downloadTextFile(JSON.stringify(exportProfile, null, 2), `${toSafeFileName(profile.name)}.json`, 'application/json');
}

function exportActiveProfileReadable() {
    saveData();
    const profile = getActiveProfile();
    if (!profile) return;

    const data = normalizeProfileData(profile.data);
    const leftById = new Map(data.left.map(item => [item.id, item]));
    const rightById = new Map(data.right.map(item => [item.id, item]));
    const lines = data.connections
        .map(connection => {
            const key = leftById.get(connection.from);
            const action = rightById.get(connection.to);
            if (!key || !action) return '';
            return `${key.text.trim()}(${getFingerCode(key.finger)}) : ${action.text.trim()}`;
        })
        .filter(Boolean);

    downloadTextFile(lines.join('\n'), `${toSafeFileName(profile.name)}.txt`, 'text/plain');
}

function downloadTextFile(text, fileName, type) {
    const blob = new Blob([text], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}

function importProfileFile() {
    const file = profileImportInput.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
        try {
            const imported = parseImportedProfile(reader.result, file.name);
            importProfile(imported, file.name);
        } catch {
            alert('Could not import profile. Please choose a valid JSON or readable mapping file.');
        } finally {
            profileImportInput.value = '';
        }
    };
    reader.onerror = () => {
        alert('Could not read the selected file.');
        profileImportInput.value = '';
    };
    reader.readAsText(file);
}

function parseImportedProfile(text, fileName) {
    try {
        return JSON.parse(text);
    } catch {
        return parseReadableProfile(text, fileName);
    }
}

function parseReadableProfile(text, fileName) {
    const left = [];
    const right = [];
    const parsedConnections = [];
    const lines = text.split(/\r?\n/).map(line => line.trim()).filter(line => line && !line.startsWith('#'));

    lines.forEach((line, index) => {
        const match = line.match(/^(.+?)\(([^)]+)\) : (.*)$/);
        if (!match) throw new Error(`Invalid mapping on line ${index + 1}`);

        const [, keyText, fingerCode, actionText] = match;
        const key = keyText.trim();
        const action = actionText.trim();
        const finger = parseFingerCode(fingerCode);
        if (!key || !action) throw new Error(`Invalid mapping on line ${index + 1}`);

        const leftItem = { id: createId(), text: key, finger };
        const rightItem = { id: createId(), text: action };
        left.push(leftItem);
        right.push(rightItem);
        parsedConnections.push({ from: leftItem.id, to: rightItem.id });
    });

    if (!parsedConnections.length) throw new Error('No readable mappings found');

    return {
        name: fileName.replace(/\.(txt|map)$/i, '') || 'Imported Profile',
        data: { left, right, connections: parsedConnections }
    };
}

function importProfile(imported, fileName) {
    const sourceProfile = imported?.data ? imported : { name: imported?.name, data: imported };
    const data = normalizeProfileData(sourceProfile.data);
    const hasImportableData = data.left.length || data.right.length || data.connections.length;
    if (!hasImportableData && !Array.isArray(sourceProfile.data?.left) && !Array.isArray(sourceProfile.data?.right)) {
        alert('That file does not look like an exported profile.');
        return;
    }

    saveData();
    const baseName = sourceProfile.name?.trim() || fileName.replace(/\.(json|txt|map)$/i, '') || 'Imported Profile';
    const profile = createProfile(uniqueProfileName(baseName), cloneDataWithFreshIds(data));
    profileStore.profiles.push(profile);
    profileStore.activeId = profile.id;
    saveProfiles();
    renderProfileSelect();
    loadProfile(profile);
}

function getFingerCode(fingerId) {
    return FINGERS.find(finger => finger.id === fingerId)?.label || '';
}

function parseFingerCode(code) {
    const normalized = code.trim().toLowerCase();
    const finger = FINGER_CODES[normalized];
    if (!finger) throw new Error(`Unknown finger code: ${code}`);
    return finger;
}

function cloneDataWithFreshIds(data) {
    const idMap = new Map();
    const cloneItem = item => {
        const id = createId();
        idMap.set(item.id, id);
        return { ...item, id };
    };

    return {
        left: data.left.map(cloneItem),
        right: data.right.map(cloneItem),
        connections: data.connections
            .filter(connection => idMap.has(connection.from) && idMap.has(connection.to))
            .map(connection => ({ from: idMap.get(connection.from), to: idMap.get(connection.to) }))
    };
}

function uniqueProfileName(baseName) {
    const names = new Set(profileStore.profiles.map(p => p.name));
    if (!names.has(baseName)) return baseName;

    let index = 2;
    let name = `${baseName} ${index}`;
    while (names.has(name)) {
        index += 1;
        name = `${baseName} ${index}`;
    }
    return name;
}

function toSafeFileName(name) {
    return (name || 'profile')
        .trim()
        .replace(/[\\/:*?"<>|]+/g, '-')
        .replace(/\s+/g, '-')
        .replace(/^-+|-+$/g, '')
        .toLowerCase() || 'profile';
}

function nextProfileName(base) {
    const names = new Set(profileStore.profiles.map(p => p.name));
    let index = profileStore.profiles.length + 1;
    let name = `${base} ${index}`;
    while (names.has(name)) {
        index += 1;
        name = `${base} ${index}`;
    }
    return name;
}

window.addEventListener('resize', () => {
    fitRightActionLabelsToPage();
    renderRelatedActions();
    draw();
});
window.addEventListener('scroll', draw, { passive: true });
