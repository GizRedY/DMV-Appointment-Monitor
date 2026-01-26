// ============================================================================
// APP STATE
// ============================================================================

const state = {
    platform: null,
    selectedCategories: [],
    selectedLocations: [],
    userId: null,
    subscription: null
};

const API_URL = window.location.origin;

// ============================================================================
// SCREEN MANAGEMENT
// ============================================================================

function showScreen(screenName) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const screenEl = document.getElementById(`screen-${screenName}`);
    if (screenEl) {
        screenEl.classList.add('active');
    }
    window.scrollTo(0, 0);

    // Show/hide side cards based on screen (mobile only via CSS)
    const howItWorks = document.getElementById('card-how-it-works');
    const tips = document.getElementById('card-tips');

    if (screenName === 'welcome') {
        if (howItWorks) howItWorks.classList.remove('hide-on-mobile');
        if (tips) tips.classList.remove('hide-on-mobile');
    } else {
        if (howItWorks) howItWorks.classList.add('hide-on-mobile');
        if (tips) tips.classList.add('hide-on-mobile');
    }

    if (screenName === 'category') {
        loadCategories();
    } else if (screenName === 'locations') {
        loadLocations();
    }
}

window.showScreen = showScreen;

// ============================================================================
// PLATFORM SELECTION
// ============================================================================

function selectPlatform(platform) {
    state.platform = platform;

    document.querySelectorAll('.setup-instructions').forEach(el => {
        el.style.display = 'none';
    });
    const block = document.getElementById(`setup-${platform}`);
    if (block) {
        block.style.display = 'block';
    }

    showScreen('setup');
}

window.selectPlatform = selectPlatform;

// ============================================================================
// NOTIFICATION PERMISSION
// ============================================================================

async function requestNotificationPermission() {
    if (!('Notification' in window)) {
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
        const isAndroid = /Android/.test(navigator.userAgent);
        const isChrome = /Chrome/.test(navigator.userAgent) && /Google Inc/.test(navigator.vendor) && !/Edg/.test(navigator.userAgent);
        const isSafari = /Safari/.test(navigator.userAgent) && /Apple Computer/.test(navigator.vendor) && !/Chrome/.test(navigator.userAgent);

        let errorMessage = '';

        if (isIOS) {
            errorMessage = '📱 iPhone/iPad detected!\n\n✅ REQUIRED STEPS:\n1. Open this site in Safari (not Chrome!)\n2. Tap Share button (⬆️)\n3. Select "Add to Home Screen"\n4. Open the app from Home Screen\n5. Try again\n\nNotifications only work from Home Screen app!';
        } else if (isAndroid) {
            errorMessage = '🤖 Android detected!\n\n✅ REQUIRED STEPS:\n1. Open this site in Chrome\n2. Tap menu (⋮) → "Add to Home screen"\n3. Open the installed app\n4. Try again\n\nNotifications only work from installed app!';
        } else if (!isChrome && !isSafari) {
            errorMessage = '💻 Desktop detected!\n\n✅ Please install this app first:\n• Chrome: Click install icon in address bar\n• Safari: Share → "Add to Dock"\n\nThen try again!';
        } else {
            errorMessage = '💻 Desktop detected!\n\n✅ Please install this app first:\n• Chrome: Click install icon in address bar\n• Safari: Share → "Add to Dock"\n\nThen try again!';
        }
        return { granted: false, error: errorMessage };
    }

    if (Notification.permission === 'granted') {
        return { granted: true };
    }

    if (Notification.permission !== 'denied') {
        const permission = await Notification.requestPermission();
        return { granted: permission === 'granted' };
    }

    return { granted: false, error: 'Notifications are blocked in browser settings. Please enable them and try again.' };
}

// ============================================================================
// LOAD CATEGORIES
// ============================================================================

async function loadCategories() {
    try {
        const response = await fetch(`${API_URL}/categories`);
        const categories = await response.json();

        const container = document.getElementById('categoryList');
        if (!container) return;

        container.innerHTML = '';

        categories.forEach(cat => {
            const div = document.createElement('div');
            div.className = 'category-item';
            if (state.selectedCategories.includes(cat.key)) {
                div.classList.add('selected');
            }

            div.onclick = () => toggleCategory(cat.key, div);
            div.innerHTML = `
                <h4>${cat.name}</h4>
                <p>${cat.description}</p>
            `;
            container.appendChild(div);
        });

        const nextBtn = document.getElementById('categoryNextBtn');
        if (nextBtn) nextBtn.disabled = state.selectedCategories.length === 0;

    } catch (error) {
        console.error('Category load error:', error);
        showAlert('Failed to load categories', 'error');
    }
}

function toggleCategory(key, element) {
    element.classList.toggle('selected');

    const idx = state.selectedCategories.indexOf(key);
    if (idx >= 0) {
        state.selectedCategories.splice(idx, 1);
    } else {
        state.selectedCategories.push(key);
    }

    const nextBtn = document.getElementById('categoryNextBtn');
    if (nextBtn) nextBtn.disabled = state.selectedCategories.length === 0;
}

// ============================================================================
// LOCATION SELECTION
// ============================================================================

const NC_LOCATIONS = [
    'Aberdeen', 'Ahoskie', 'Albemarle', 'Andrews', 'Asheboro',
    'Asheville', 'Boone', 'Brevard', 'Bryson City', 'Burgaw',
    'Burnsville', 'Carrboro', 'Cary', 'Charlotte East', 'Charlotte North',
    'Charlotte South', 'Charlotte West', 'Clayton', 'Clinton', 'Clyde',
    'Concord', 'Durham East', 'Durham South', 'Elizabeth City', 'Elizabethtown',
    'Elkin', 'Erwin', 'Fayetteville South', 'Fayetteville West', 'Forest City',
    'Franklin', 'Fuquay-Varina', 'Garner', 'Gastonia', 'Goldsboro',
    'Graham', 'Greensboro East', 'Greensboro West', 'Greenville', 'Hamlet',
    'Havelock', 'Henderson', 'Hendersonville', 'Hickory', 'High Point',
    'Hillsborough', 'Hudson', 'Huntersville', 'Jacksonville', 'Jefferson',
    'Kernersville', 'Kinston', 'Lexington', 'Lincolnton', 'Louisburg',
    'Lumberton', 'Marion', 'Marshall', 'Mocksville', 'Monroe', 'Mooresville',
    'Morehead City', 'Morganton', 'Mount Airy', 'Mount Holly', 'Nags Head',
    'New Bern', 'Newton', 'Oxford', 'Polkton', 'Raleigh North', 'Raleigh West',
    'Roanoke Rapids', 'Rocky Mount', 'Roxboro', 'Salisbury', 'Sanford',
    'Shallotte', 'Shelby', 'Siler City', 'Smithfield', 'Statesville',
    'Stedman', 'Sylva', 'Tarboro', 'Taylorsville', 'Thomasville', 'Troy',
    'Washington', 'Wendell', 'Wentworth', 'Whiteville', 'Wilkesboro',
    'Williamston', 'Wilmington North', 'Wilmington South', 'Wilson',
    'Winston Salem North', 'Winston Salem South', 'Yadkinville'
];

function loadLocations() {
    const grid = document.getElementById('locationGrid');
    if (!grid) return;

    grid.innerHTML = '';

    NC_LOCATIONS.forEach(loc => {
        const div = document.createElement('div');
        div.className = 'location-item';
        div.textContent = loc;

        if (state.selectedLocations.includes(loc)) {
            div.classList.add('selected');
        }

        div.onclick = () => toggleLocation(loc, div);
        grid.appendChild(div);
    });

    const btn = document.getElementById('subscribeBtn');
    if (btn) btn.disabled = state.selectedLocations.length === 0;
}

function toggleLocation(loc, element) {
    element.classList.toggle('selected');

    const idx = state.selectedLocations.indexOf(loc);
    if (idx >= 0) {
        state.selectedLocations.splice(idx, 1);
    } else {
        state.selectedLocations.push(loc);
    }

    const btn = document.getElementById('subscribeBtn');
    if (btn) btn.disabled = state.selectedLocations.length === 0;
}

window.filterLocations = function () {
    const searchEl = document.getElementById('locationSearch');
    const query = searchEl.value.toLowerCase();

    document.querySelectorAll('.location-item').forEach(item => {
        const text = item.textContent.toLowerCase();
        item.style.display = text.includes(query) ? '' : 'none';
    });
};

// ============================================================================
// SUBSCRIBE
// ============================================================================

function showInlineError(msg) {
    const el = document.getElementById('subscribeError');
    el.textContent = msg;
    el.classList.add('show');
}

function hideInlineError() {
    const el = document.getElementById('subscribeError');
    el.classList.remove('show');
}

async function subscribe() {
    const btn = document.getElementById('subscribeBtn');
    const original = btn.textContent;

    // CRITICAL: Prevent multiple simultaneous subscription attempts
    if (btn.dataset.subscribing === 'true') {
        console.warn('Subscription already in progress, ignoring duplicate request');
        return;
    }

    btn.dataset.subscribing = 'true';
    btn.disabled = true;
    btn.textContent = '⏳ Setting up...';
    hideInlineError();

    try {
        // 1. Check: are categories selected
        if (state.selectedCategories.length === 0) {
            showInlineError('Please select at least one category.');
            btn.disabled = false;
            btn.textContent = original;
            btn.dataset.subscribing = 'false';
            return;
        }

        // 1.5. Browser check on DESKTOP (before Service Worker verification)
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
        const isAndroid = /Android/.test(navigator.userAgent);

        // If this is DESKTOP (not iOS and not Android), check the browser
        if (!isIOS && !isAndroid) {
            const isChrome = /Chrome/.test(navigator.userAgent) && /Google Inc/.test(navigator.vendor) && !/Edg/.test(navigator.userAgent);
            const isSafari = /Safari/.test(navigator.userAgent) && /Apple Computer/.test(navigator.vendor) && !/Chrome/.test(navigator.userAgent);

            if (!isChrome && !isSafari) {
                showInlineError('⚠️Unsupported Browser!⚠️ This browser is not supported. Please use: Chrome or Safari (for Mac). Then try again.');
                btn.disabled = false;
                btn.textContent = original;
                btn.dataset.subscribing = 'false';
                return;
            }
        }

        // 2. Notification permission
        const permission = await requestNotificationPermission();
        if (!permission.granted) {
            showInlineError(permission.error || 'Notifications are required.');
            btn.disabled = false;
            btn.textContent = original;
            return;
        }

        // 3. Service Worker registration and push subscription
        let pushSubscription = null;

        if ('serviceWorker' in navigator && 'PushManager' in window) {
            try {
                // Ensure SW is properly registered and activated
                let reg = await navigator.serviceWorker.getRegistration('/');

                if (!reg) {
                    console.log('No existing registration, creating new one...');
                    reg = await navigator.serviceWorker.register('/sw.js');
                }

                // Wait for SW to be ready (active)
                console.log('Waiting for service worker to be ready...');
                const readyReg = await navigator.serviceWorker.ready;
                console.log('Service worker is ready, state:', readyReg.active?.state);

                // Extra safety: wait a bit if SW just activated
                if (readyReg.active?.state === 'activating') {
                    console.log('SW still activating, waiting...');
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }

                // Check existing subscription
                let existingSub = await readyReg.pushManager.getSubscription();

                if (existingSub) {
                    console.log('Using existing push subscription');
                    pushSubscription = existingSub;
                } else {
                    const vapidKey = await getVapidPublicKey();

                    try {
                        pushSubscription = await reg.pushManager.subscribe({
                            userVisibleOnly: true,
                            applicationServerKey: urlBase64ToUint8Array(vapidKey)
                        });
                        console.log('Created new push subscription');
                    } catch (subError) {
                        console.error('Push subscription error:', subError);

                        if (subError.name === 'NotAllowedError') {
                            throw new Error('Notifications are blocked. Please allow notifications in browser settings and try again.');
                        } else if (subError.name === 'NotSupportedError') {
                            throw new Error('Push notifications are not supported in this browser. Please use Chrome (or Safari on iOS Home Screen).');
                        } else {
                            // IMPORTANT: We do NOT support "subscription without push"
                            throw new Error('Failed to create push subscription. Please reinstall the app (Add to Home Screen / Install app) and try again.');
                        }
                    }
                }

                state.subscription = pushSubscription;
                // IMPORTANT: push subscription is required for this app
                if (!pushSubscription) {
                    throw new Error('Push subscription was not created. Please install the app (PWA) and enable notifications, then try again.');
                }

            } catch (swError) {
                console.error('Service Worker error:', swError);
                throw new Error('Failed to register service worker: ' + swError.message);
            }
        } else {
            throw new Error('Your browser does not support push notifications. Please use Chrome (recommended) or Safari on iOS (installed to Home Screen).');
        }

        // userId and sending to the backend
        state.userId = btoa(pushSubscription.endpoint).substring(0, 50);

        localStorage.setItem('dmv_user_id', state.userId);

        let subscriptionCreated = false;
        let lastError = null;

        for (let attempt = 1; attempt <= 3; attempt++) {
            try {
                console.log(`API subscription attempt ${attempt}/3...`);

                const response = await fetch(`${API_URL}/subscriptions`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        user_id: state.userId,
                        push_subscription: pushSubscription ? JSON.stringify(pushSubscription.toJSON()) : null,
                        categories: state.selectedCategories,
                        locations: state.selectedLocations,
                        date_range_days: 30
                    })
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`Server error (${response.status}): ${errorText}`);
                }

                const result = await response.json();
                console.log('✅ Subscription created successfully:', result);
                subscriptionCreated = true;
                break;

            } catch (apiError) {
                lastError = apiError;
                console.error(`❌ API attempt ${attempt} failed:`, apiError);

                if (attempt < 3) {
                    console.log('Retrying in 1 second...');
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
        }

        if (!subscriptionCreated) {
            throw new Error(`Failed to create subscription after 3 attempts: ${lastError?.message || 'Unknown error'}`);
        }

        showSuccessScreen();
        showDonatePopup();

    } catch (err) {
        console.error('Subscribe error:', err);
        showInlineError('Failed: ' + (err.message || 'Unknown error'));
    } finally {
        // Always reset the subscribing flag
        btn.dataset.subscribing = 'false';
        btn.textContent = original;
        btn.disabled = false;
    }
}

window.subscribe = subscribe;

// ============================================================================
// SUCCESS SCREEN
// ============================================================================

function showSuccessScreen() {
    const categoryEl = document.getElementById('successCategory');
    const locationsEl = document.getElementById('successLocations');

    const categories = state.selectedCategories.join(', ');
    const locations = state.selectedLocations.join(', ');

    categoryEl.textContent = categories || 'All categories';
    locationsEl.textContent = locations || 'All NC locations';

    showScreen('success');
}

// ============================================================================
// UNSUBSCRIBE
// ============================================================================

async function unsubscribe() {
    if (!confirm('Unsubscribe?')) return;

    try {
        const userId = state.userId || localStorage.getItem('dmv_user_id');

        await fetch(`${API_URL}/subscriptions/${encodeURIComponent(userId)}`, {
            method: 'DELETE'
        });

        if ('serviceWorker' in navigator) {
            const reg = await navigator.serviceWorker.getRegistration();
            if (reg) {
                const sub = await reg.pushManager.getSubscription();
                if (sub) await sub.unsubscribe();
            }
        }

        state.userId = null;
        state.subscription = null;
        state.selectedCategories = [];
        state.selectedLocations = [];
        localStorage.removeItem('dmv_user_id');

        showAlert('Unsubscribed', 'success');
        setTimeout(() => location.reload(), 1000);

    } catch (err) {
        console.error('Unsubscribe error:', err);
        showAlert('Failed to unsubscribe', 'error');
    }
}

window.unsubscribe = unsubscribe;

// ============================================================================
// TEST NOTIFICATION
// ============================================================================

function testNotification() {
    console.log('testNotification called');

    if (Notification.permission === 'granted') {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.ready.then(function(reg) {
                reg.showNotification('🧪 Test notification', {
                    body: 'Notifications working!',
                    icon: '/icon-192.png',
                    badge: '/icon-192.png',
                    tag: 'test-notification'
                }).then(function() {
                    showAlert('Test sent!', 'success');
                }).catch(function(err) {
                    console.error('SW notification error:', err);
                    showAlert('Error: ' + err.message, 'error');
                });
            }).catch(function(err) {
                console.error('SW ready error:', err);
                showAlert('Error: ' + err.message, 'error');
            });
        } else {
            new Notification('🧪 Test notification', {
                body: 'Notifications working!',
                icon: '/icon-192.png'
            });
            showAlert('Test sent!', 'success');
        }
    } else {
        showAlert('Enable notifications first', 'error');
    }
}

window.testNotification = testNotification;

// ============================================================================
// HELPERS
// ============================================================================

function showAlert(msg, type = 'info') {
    const alert = document.getElementById('alert');
    alert.textContent = msg;
    alert.className = `alert ${type}`;
    alert.style.display = 'block';
    setTimeout(() => alert.style.display = 'none', 4000);
}

function urlBase64ToUint8Array(str) {
    const pad = '='.repeat((4 - str.length % 4) % 4);
    const base64 = (str + pad).replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(base64);
    return Uint8Array.from([...raw].map(ch => ch.charCodeAt(0)));
}

// ============================================================================
// RESTORE EXISTING SUBSCRIPTION
// ============================================================================

async function restoreExistingSubscription() {
    try {
        const savedUserId = localStorage.getItem('dmv_user_id');
        if (!savedUserId) {
            console.log('No saved user ID found');
            return false;
        }

        console.log('Checking for existing subscription:', savedUserId);

        const resp = await fetch(`${API_URL}/subscriptions/${encodeURIComponent(savedUserId)}`);

        if (!resp.ok) {
            if (resp.status === 404) {
                console.log('No active subscription found on server, clearing local storage');
                localStorage.removeItem('dmv_user_id');
            }
            return false;
        }

        const subData = await resp.json();
        console.log('✅ Found existing subscription:', subData);

        state.userId = savedUserId;
        state.selectedCategories = subData.categories || [];
        state.selectedLocations = subData.locations || [];

        showSuccessScreen();
        showAlert('Notifications already active', 'success');

        return true;

    } catch (err) {
        console.error('Restore error:', err);
        // Clear potentially corrupted data
        localStorage.removeItem('dmv_user_id');
        return false;
    }
}

// ============================================================================
// GET VAPID KEY
// ============================================================================

async function getVapidPublicKey() {
    const resp = await fetch(`${API_URL}/vapid-public-key`);
    const data = await resp.json();
    return data.public_key;
}

// ============================================================================
// LIVE AVAILABILITY POPUP
// ============================================================================

let availabilityData = [];

// Format category key into pretty label
function formatCategoryLabel(key) {
    if (!key) return '';
    return key
        .split('_')
        .map(part => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
}

// Render locations list for selected category
function renderAvailabilityList(categoryKey) {
    const listEl = document.getElementById('availabilityList');
    if (!listEl) {
        return;
    }

    if (!categoryKey) {
        listEl.innerHTML = '<div class="availability-empty">Please choose a category.</div>';
        return;
    }

    const items = availabilityData
        .filter(item => item.category === categoryKey)
        .sort((a, b) => a.location_name.localeCompare(b.location_name));

    if (items.length === 0) {
        listEl.innerHTML = '<div class="availability-empty">No locations for this category.</div>';
        return;
    }

    listEl.innerHTML = '';

    items.forEach(item => {
        const row = document.createElement('div');
        row.className = 'availability-row';

        let lastCheckedText = 'Unknown';
        if (item.last_checked) {
            const d = new Date(item.last_checked);
            if (!isNaN(d.getTime())) {
                lastCheckedText = d.toLocaleString();
            } else {
                lastCheckedText = item.last_checked;
            }
        }

        const slotsCount = Number(item.slots_count || 0);
        const isAvailable = slotsCount > 0;

        let statusLabel = '';
        let statusClass = '';

        if (isAvailable) {
            statusLabel = `${slotsCount} Slot${slotsCount === 1 ? '' : 's'}`;
            statusClass = ' availability-slots-available';
        } else {
            statusLabel = 'No slots';
            statusClass = ' availability-slots-unavailable';
        }

            row.innerHTML = `
                <div class="availability-main">
                    <div class="availability-location">${item.location_name}</div>
                    <div class="availability-meta">Last checked: ${lastCheckedText}</div>
                </div>
                <div class="availability-slots${statusClass}">
                    ${statusLabel}
                </div>
            `;


        listEl.appendChild(row);
    });
}

// Open modal and load data if needed
// Open modal and load data if needed
async function openAvailabilityModal() {
    const modal = document.getElementById('availabilityModal');
    const listEl = document.getElementById('availabilityList');
    const selectEl = document.getElementById('availabilityCategorySelect');

    if (!modal || !listEl || !selectEl) {
        console.error('Availability modal elements not found');
        return;
    }

    modal.classList.add('open');
    document.body.classList.add('availability-modal-open');

    // Show loading state
    listEl.innerHTML = '<div class="availability-empty">Loading availability data…</div>';

    // If data isn't loaded yet, load it now and wait
    if (availabilityData.length === 0) {
        console.log('Data not loaded yet, loading now...');
        await updateAvailabilityData();

        // If still no data after loading, show error
        if (availabilityData.length === 0) {
            listEl.innerHTML = '<div class="availability-empty">Failed to load data. Please refresh the page.</div>';
            return;
        }
    }

    // Populate categories if they don't exist yet
    if (selectEl.options.length === 0) {
        const categories = Array.from(
            new Set(availabilityData.map(item => item.category))
        ).sort();

        categories.forEach(catKey => {
            const opt = document.createElement('option');
            opt.value = catKey;
            opt.textContent = formatCategoryLabel(catKey);
            selectEl.appendChild(opt);
        });
    }

    // Show the list
    const current = selectEl.value || (selectEl.options[0] ? selectEl.options[0].value : '');
    if (current) {
        selectEl.value = current;
        renderAvailabilityList(current);
    } else {
        listEl.innerHTML = '<div class="availability-empty">No categories found.</div>';
    }
}

// Close modal
function closeAvailabilityModal() {
    const modal = document.getElementById('availabilityModal');
    if (!modal) {
        return;
    }
    modal.classList.remove('open');
    document.body.classList.remove('availability-modal-open');
}

// Handler for category change (used in HTML onchange)
function onAvailabilityCategoryChange() {
    const selectEl = document.getElementById('availabilityCategorySelect');
    if (!selectEl) {
        return;
    }
    const categoryKey = selectEl.value;
    renderAvailabilityList(categoryKey);
}

// Expose functions to window so HTML can call them
window.openAvailabilityModal = openAvailabilityModal;
window.closeAvailabilityModal = closeAvailabilityModal;
window.onAvailabilityCategoryChange = onAvailabilityCategoryChange;

// ============================================================================
// AUTO-UPDATE AVAILABILITY DATA
// ============================================================================

//let availabilityUpdateInterval = null;

async function updateAvailabilityData() {
    try {
        console.log('🔄 Loading availability data...');
        const resp = await fetch(`${API_URL}/availability?t=${Date.now()}`);
        if (!resp.ok) {
            throw new Error('HTTP ' + resp.status);
        }
        availabilityData = await resp.json();
        console.log('✅ Availability data loaded:', availabilityData.length, 'items');

        // If the modal is open, update the UI
        const modal = document.getElementById('availabilityModal');
        if (modal && modal.classList.contains('open')) {
            const selectEl = document.getElementById('availabilityCategorySelect');
            if (selectEl) {
                const currentValue = selectEl.value;

                // Update categories
                selectEl.innerHTML = '';
                const categories = Array.from(
                    new Set(availabilityData.map(item => item.category))
                ).sort();

                categories.forEach(catKey => {
                    const opt = document.createElement('option');
                    opt.value = catKey;
                    opt.textContent = formatCategoryLabel(catKey);
                    selectEl.appendChild(opt);
                });

                // Restore the selection
                if (currentValue && categories.includes(currentValue)) {
                    selectEl.value = currentValue;
                } else if (selectEl.options[0]) {
                    selectEl.value = selectEl.options[0].value;
                }

                // Update the list
                renderAvailabilityList(selectEl.value);
            }
        }
    } catch (err) {
        console.error('❌ Failed to update availability data', err);
    }
}

// ============================================================================
// DONATE POPUP
// ============================================================================

function showDonatePopup() {
    const popup = document.getElementById('donatePopup');
    if (!popup) return;

    // Show the popup only once per device
    if (localStorage.getItem('dmv_donate_popup_shown') === '1') {
        return;
    }

    popup.classList.add('show');
}

function closeDonatePopup() {
    const popup = document.getElementById('donatePopup');
    if (!popup) return;

    popup.classList.remove('show');
    // Remember that the popup was shown so we don’t annoy the user again
    localStorage.setItem('dmv_donate_popup_shown', '1');
}

function handleDonateClick() {
    closeDonatePopup();
    // Open Ko-fi in a new tab
    window.open('https://ko-fi.com/gizred', '_blank');
}

// Make the functions available for HTML onclick attributes
window.closeDonatePopup = closeDonatePopup;
window.handleDonateClick = handleDonateClick;

// ============================================================================
// SKIP LOCATIONS (SELECT/DESELECT ALL)
// ============================================================================

function skipLocations() {
    const allLocations = NC_LOCATIONS;
    const selected = state.selectedLocations || [];

    // Check whether ALL locations are currently selected
    const allSelected =
        selected.length === allLocations.length &&
        allLocations.every(loc => selected.includes(loc));

    const grid = document.getElementById('locationGrid');
    const btn = document.getElementById('subscribeBtn');

    if (allSelected) {
        // If all are already selected - reset the selection
        state.selectedLocations = [];

        if (grid) {
            grid.querySelectorAll('.location-item').forEach(item => {
                item.classList.remove('selected');
            });
        }

        if (btn) {
            btn.disabled = true; // You can’t subscribe without selecting locations
        }
    } else {
        // If some or none are selected - select all
        state.selectedLocations = [...allLocations];

        if (grid) {
            grid.querySelectorAll('.location-item').forEach(item => {
                item.classList.add('selected');
                item.style.display = '';
            });
        }

        if (btn) {
            btn.disabled = false;
        }
    }
}

// So that onclick="skipLocations()" works
window.skipLocations = skipLocations;

// ============================================================================
// INSTRUCTIONS MODAL
// ============================================================================

function openInstructionsModal() {
    const modal = document.getElementById('instructionsModal');
    if (!modal) {
        console.error('Instructions modal not found');
        return;
    }

    modal.classList.add('open');
    document.body.classList.add('availability-modal-open');

    // Hide all instruction blocks
    document.querySelectorAll('[id^="modal-setup-"]').forEach(el => {
        el.style.display = 'none';
    });
}

function closeInstructionsModal() {
    const modal = document.getElementById('instructionsModal');
    if (!modal) return;

    modal.classList.remove('open');
    document.body.classList.remove('availability-modal-open');
}

function showInstructionForPlatform(platform) {
    // Hide all
    document.querySelectorAll('[id^="modal-setup-"]').forEach(el => {
        el.style.display = 'none';
    });

    // Show selected
    const instructionEl = document.getElementById(`modal-setup-${platform}`);
    if (instructionEl) {
        instructionEl.style.display = 'block';
    }
}

window.openInstructionsModal = openInstructionsModal;
window.closeInstructionsModal = closeInstructionsModal;
window.showInstructionForPlatform = showInstructionForPlatform;

// ============================================================================
// INITIALIZATION - SINGLE DOMContentLoaded HANDLER
// ============================================================================

// Define all window functions BEFORE DOMContentLoaded
// This ensures onclick handlers work immediately
console.log('App.js loaded, defining window functions...');

// Re-export all functions to window to ensure they're available
window.showScreen = showScreen;
window.selectPlatform = selectPlatform;
window.subscribe = subscribe;
window.unsubscribe = unsubscribe;
window.testNotification = testNotification;
window.openAvailabilityModal = openAvailabilityModal;
window.closeAvailabilityModal = closeAvailabilityModal;
window.onAvailabilityCategoryChange = onAvailabilityCategoryChange;
window.closeDonatePopup = closeDonatePopup;
window.handleDonateClick = handleDonateClick;
window.skipLocations = skipLocations;
window.openInstructionsModal = openInstructionsModal;
window.closeInstructionsModal = closeInstructionsModal;
window.showInstructionForPlatform = showInstructionForPlatform;
window.filterLocations = filterLocations;

console.log('All window functions defined successfully');

document.addEventListener('DOMContentLoaded', () => {
    console.log('='.repeat(60));
    console.log('DMV Monitor - Frontend Initialization');
    console.log('='.repeat(60));
    console.log('DOM loaded, initializing app...');
    console.log('User Agent:', navigator.userAgent);
    console.log('Service Worker support:', 'serviceWorker' in navigator);
    console.log('Push Manager support:', 'PushManager' in window);
    console.log('Notification support:', 'Notification' in window);
    console.log('Current permission:', Notification?.permission);

    // Restore existing subscription
    restoreExistingSubscription().then(restored => {
        console.log('Subscription restore result:', restored);
    });

    // Load availability data immediately with retry
    console.log('Starting initial data load...');
    updateAvailabilityData().then(() => {
        console.log('Initial data load completed');
    }).catch(err => {
        console.error('Initial data load failed:', err);
        // Retry after 2 seconds
        setTimeout(() => {
            console.log('Retrying data load...');
            updateAvailabilityData();
        }, 2000);
    });

    console.log('✅ App initialized successfully');
    console.log('='.repeat(60));
});