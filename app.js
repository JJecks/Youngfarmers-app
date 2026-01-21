import { auth, db } from './firebase-config.js';
import {
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signInWithPopup,
    GoogleAuthProvider,
    onAuthStateChanged,
    signOut
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import {
    collection,
    doc,
    setDoc,
    getDoc,
    getDocs,
    updateDoc,
    deleteDoc,
    query,
    where,
    orderBy
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

const ADMIN_EMAIL = 'jeckstom777@gmail.com';
const SHOPS = ['Usigu', 'Port Victoria', 'Mbita', 'Usenge', 'Lwanda Kotieno', 'Obambo', 'Sori'];
const PRODUCTS = [
    { id: 'STARTER_MASH', name: 'Starter Mash', cost: 4240, sales: 4600 },
    { id: 'SAMAKGRO_1MM', name: 'Samakgro 1MM', cost: 3690, sales: 4150 },
    { id: 'SAMAKGRO_2MM', name: 'Samakgro 2MM', cost: 3600, sales: 3200 },
    { id: 'SAMAKGRO_3MM', name: 'Samakgro 3MM', cost: 3200, sales: 2850 },
    { id: 'SAMAKGRO_4MMHP', name: 'Samakgro 4MMHP', cost: 2950, sales: 2650 },
    { id: 'SAMAKGRO_4.5MM', name: 'Samakgro 4.5MM', cost: 2800, sales: 2500 },
    { id: 'BROODSTOCK', name: 'Broodstock', cost: 3900, sales: 3900 }
];

let currentUser = null;
let currentUserData = null;
let currentShop = null;
let currentDate = formatDate(new Date());
let productsData = [...PRODUCTS];

function formatDate(date) {
    const d = new Date(date);
    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
}

function formatDateDisplay(dateStr) {
    const [day, month, year] = dateStr.split('-');
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'];
    const suffix = (d) => {
        const num = parseInt(d);
        if (num > 3 && num < 21) return 'th';
        switch (num % 10) {
            case 1: return 'st';
            case 2: return 'nd';
            case 3: return 'rd';
            default: return 'th';
        }
    };
    return `${parseInt(day)}${suffix(day)} ${monthNames[parseInt(month) - 1]} ${year}`;
}

function dateToISO(dateStr) {
    const [day, month, year] = dateStr.split('-');
    return `${year}-${month}-${day}`;
}

function isoToDate(isoStr) {
    const [year, month, day] = isoStr.split('-');
    return `${day}-${month}-${year}`;
}

function getPreviousDate(dateStr) {
    const [day, month, year] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    date.setDate(date.getDate() - 1);
    return formatDate(date);
}

function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type}`;
    toast.style.display = 'block';
    setTimeout(() => {
        toast.style.display = 'none';
    }, 3000);
}

function showView(viewId) {
    document.querySelectorAll('.view-container').forEach(view => {
        view.style.display = 'none';
    });
    const view = document.getElementById(viewId);
    if (view) view.style.display = 'block';
}
window.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        document.getElementById('splash-screen').style.display = 'none';
        document.getElementById('auth-screen').style.display = 'flex';
    }, 3000);
    setupAuthListeners();
    setupAppListeners();
});

onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
            currentUserData = userDoc.data();
            if (currentUserData.status === 'pending') {
                showPendingScreen();
            } else {
                showMainApp();
            }
        }
    } else {
        currentUser = null;
        currentUserData = null;
        document.getElementById('auth-screen').style.display = 'flex';
        document.getElementById('app').style.display = 'none';
        document.getElementById('pending-screen').style.display = 'none';
    }
});

function showPendingScreen() {
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('app').style.display = 'none';
    document.getElementById('pending-screen').style.display = 'flex';
}

function showMainApp() {
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('pending-screen').style.display = 'none';
    document.getElementById('app').style.display = 'block';
    document.getElementById('user-name').textContent = currentUserData.name;
    const roleText = currentUserData.role === 'manager_full' ? 'Manager (Full Access)' :
                     currentUserData.role === 'manager_view' ? 'Manager (View Only)' :
                     `Attendant - ${currentUserData.shop}`;
    document.getElementById('user-role').textContent = roleText;
    loadDashboard();
}

function setupAppListeners() {
    document.getElementById('signout-btn').addEventListener('click', async () => {
        await signOut(auth);
        showToast('Signed out successfully!', 'success');
    });
    document.getElementById('header-home').addEventListener('click', () => {
        loadDashboard();
    });
}
function setupAuthListeners() {
    const signinTab = document.getElementById('signin-tab');
    const signupTab = document.getElementById('signup-tab');
    const authForm = document.getElementById('auth-form');
    const nameField = document.getElementById('name-field');
    const authSubmit = document.getElementById('auth-submit');
    const googleSignin = document.getElementById('google-signin');

    signinTab.addEventListener('click', () => {
        signinTab.classList.add('active');
        signupTab.classList.remove('active');
        nameField.style.display = 'none';
        authSubmit.textContent = 'Sign In';
    });

    signupTab.addEventListener('click', () => {
        signupTab.classList.add('active');
        signinTab.classList.remove('active');
        nameField.style.display = 'block';
        authSubmit.textContent = 'Sign Up';
    });

    authForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('auth-email').value;
        const password = document.getElementById('auth-password').value;
        const name = document.getElementById('auth-name').value;

        if (signupTab.classList.contains('active')) {
            try {
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                const isAdmin = email === ADMIN_EMAIL;
                await setDoc(doc(db, 'users', userCredential.user.uid), {
                    email, name,
                    role: isAdmin ? 'manager_full' : 'pending',
                    status: isAdmin ? 'active' : 'pending',
                    shop: null,
                    createdAt: new Date().toISOString()
                });
                showToast(isAdmin ? 'Admin account created!' : 'Account created! Awaiting approval.', 'success');
            } catch (error) {
                showToast(error.message, 'error');
            }
        } else {
            try {
                await signInWithEmailAndPassword(auth, email, password);
                showToast('Signed in successfully!', 'success');
            } catch (error) {
                showToast(error.message, 'error');
            }
        }
    });

    googleSignin.addEventListener('click', async () => {
        try {
            const provider = new GoogleAuthProvider();
            const result = await signInWithPopup(auth, provider);
            const userDoc = await getDoc(doc(db, 'users', result.user.uid));
            if (!userDoc.exists()) {
                const isAdmin = result.user.email === ADMIN_EMAIL;
                await setDoc(doc(db, 'users', result.user.uid), {
                    email: result.user.email,
                    name: result.user.displayName,
                    role: isAdmin ? 'manager_full' : 'pending',
                    status: isAdmin ? 'active' : 'pending',
                    shop: null,
                    createdAt: new Date().toISOString()
                });
            }
            showToast('Signed in with Google!', 'success');
        } catch (error) {
            showToast(error.message, 'error');
        }
    });

    document.getElementById('pending-signout').addEventListener('click', async () => {
        await signOut(auth);
    });
}
function loadDashboard() {
    showView('dashboard-view');
    const container = document.getElementById('dashboard-buttons');
    container.innerHTML = '';
    const isManager = currentUserData.role === 'manager_full' || currentUserData.role === 'manager_view';

    const buttons = [
        ...SHOPS.map(shop => ({ label: shop, action: () => loadShopView(shop), color: '#2e7d32' })),
        ...(isManager ? [
            { label: 'Total Sales', action: () => loadTotalSalesView(), color: '#1976d2' },
            { label: 'Debtors', action: () => loadDebtorsView(), color: '#d32f2f' },
            { label: 'Creditors', action: () => loadCreditorsView(), color: '#f57c00' },
            { label: 'Stock Value', action: () => loadStockValueView(), color: '#7b1fa2' },
            { label: 'Products', action: () => loadProductsView(), color: '#0097a7' },
            { label: 'All Clients', action: () => loadAllClientsView(), color: '#388e3c' }
        ] : []),
        ...(currentUserData.role === 'manager_full' ? [
            { label: 'Admin Panel', action: () => loadAdminPanel(), color: '#c62828' }
        ] : [])
    ];

    buttons.forEach(btn => {
        const button = document.createElement('button');
        button.className = 'dashboard-btn';
        button.textContent = btn.label;
        button.style.background = btn.color;
        button.addEventListener('click', btn.action);
        container.appendChild(button);
    });
}

function calculateRestocking(data, productId) {
    let total = 0;
    if (data?.restocking) {
        Object.values(data.restocking).forEach(r => {
            if (r.feedType === productId) total += parseFloat(r.bags || 0);
        });
    }
    if (data?.transfersIn) {
        Object.values(data.transfersIn).forEach(t => {
            if (t.feedType === productId) total += parseFloat(t.bags || 0);
        });
    }
    return total;
}

function calculateSold(data, productId) {
    let total = 0;
    if (data?.regularSales) {
        Object.values(data.regularSales).forEach(s => {
            if (s.feedType === productId) total += parseFloat(s.bags || 0);
        });
    }
    if (data?.creditSales) {
        Object.values(data.creditSales).forEach(s => {
            if (s.feedType === productId) total += parseFloat(s.bags || 0);
        });
    }
    return total;
}

function calculateTransfersOut(data, productId) {
    let total = 0;
    if (data?.transfersOut) {
        Object.values(data.transfersOut).forEach(t => {
            if (t.feedType === productId) total += parseFloat(t.bags || 0);
        });
    }
    return total;
}

function calculateCreditorReleases(data, productId) {
    let total = 0;
    if (data?.creditorReleases) {
        Object.values(data.creditorReleases).forEach(c => {
            if (c.feedType === productId) total += parseFloat(c.bags || 0);
        });
    }
    return total;
}

function calculateClosingStock(data) {
    const closing = {};
    productsData.forEach(product => {
        const opening = data?.openingStock?.[product.id] || 0;
        const restocking = calculateRestocking(data, product.id);
        const sold = calculateSold(data, product.id);
        const transfersOut = calculateTransfersOut(data, product.id);
        const creditorReleases = calculateCreditorReleases(data, product.id);
        closing[product.id] = opening + restocking - sold - transfersOut - creditorReleases;
    });
    return closing;
}
async function loadShopView(shop) {
    currentShop = shop;
    const canEdit = currentUserData.role === 'manager_full' || 
                    (currentUserData.role === 'attendant' && currentUserData.shop === shop);

    if (!canEdit) {
        loadReadOnlyShopView(shop);
        return;
    }

    showView('shop-view');
    document.getElementById('shop-title').textContent = shop;
    
    const dateSelector = document.getElementById('date-selector');
    dateSelector.value = dateToISO(currentDate);
    dateSelector.onchange = (e) => {
        currentDate = isoToDate(e.target.value);
        loadShopData(shop, currentDate);
    };

    if (currentUserData.role !== 'attendant') {
        document.getElementById('sales-total-header').style.display = 'table-cell';
    }

    await loadShopData(shop, currentDate);
    setupTransactionForms(shop);
}

async function loadShopData(shop, date) {
    const shopDocRef = doc(db, 'shops', shop, 'daily', date);
    const shopDoc = await getDoc(shopDocRef);

    let openingStock = {};
    let isFirstEntry = false;
    let openingStockSaved = false;

    if (shopDoc.exists()) {
        const data = shopDoc.data();
        openingStock = data.openingStock || {};
        openingStockSaved = !!data.openingStock;
        renderClosingStockTable(shop, date, openingStock, shopDoc.data(), openingStockSaved, false);
        if (openingStockSaved) {
            document.getElementById('transaction-forms').style.display = 'block';
            document.getElementById('recorded-transactions').style.display = 'block';
            renderRecordedTransactions(shopDoc.data(), shop, date);
        }
    } else {
        const yesterday = getPreviousDate(date);
        const yesterdayDocRef = doc(db, 'shops', shop, 'daily', yesterday);
        const yesterdayDoc = await getDoc(yesterdayDocRef);

        if (yesterdayDoc.exists()) {
            openingStock = calculateClosingStock(yesterdayDoc.data());
            renderClosingStockTable(shop, date, openingStock, null, false, false);
        } else {
            isFirstEntry = true;
            document.getElementById('first-entry-warning').style.display = 'block';
            renderClosingStockTable(shop, date, {}, null, false, true);
        }
    }

    setupOpeningStockSave(shop, date, openingStockSaved, isFirstEntry);
}

async function loadReadOnlyShopView(shop) {
    showView('readonly-shop-view');
    document.getElementById('readonly-shop-title').textContent = `${shop} - Stock Available (View Only)`;
    
    const shopDocRef = doc(db, 'shops', shop, 'daily', currentDate);
    const shopDoc = await getDoc(shopDocRef);
    
    const tbody = document.getElementById('readonly-stock-body');
    tbody.innerHTML = '';
    
    if (shopDoc.exists()) {
        const closing = calculateClosingStock(shopDoc.data());
        productsData.forEach(product => {
            const row = tbody.insertRow();
            row.innerHTML = `
                <td>${product.name}</td>
                <td style="text-align: right; font-weight: bold;">${(closing[product.id] || 0).toFixed(1)}</td>
            `;
        });
    } else {
        productsData.forEach(product => {
            const row = tbody.insertRow();
            row.innerHTML = `
                <td>${product.name}</td>
                <td style="text-align: right; font-weight: bold;">0.0</td>
            `;
        });
    }
}
function renderClosingStockTable(shop, date, openingStock, shopData, saved, editable) {
    const tbody = document.getElementById('closing-stock-body');
    const tfoot = document.getElementById('closing-stock-footer');
    tbody.innerHTML = '';
    tfoot.innerHTML = '';

    let totalClosing = 0;
    let totalSales = 0;

    productsData.forEach((product, idx) => {
        const opening = openingStock[product.id] || 0;
        const restocking = shopData ? calculateRestocking(shopData, product.id) : 0;
        const sold = shopData ? calculateSold(shopData, product.id) : 0;
        const transfersOut = shopData ? calculateTransfersOut(shopData, product.id) : 0;
        const creditorReleases = shopData ? calculateCreditorReleases(shopData, product.id) : 0;
        const closing = opening + restocking - sold - transfersOut - creditorReleases;
        const salesTotal = sold * product.sales;

        totalClosing += closing;
        totalSales += salesTotal;

        const row = tbody.insertRow();
        row.innerHTML = `
            <td style="text-align: center;">${idx + 1}</td>
            <td>${product.name}</td>
            <td style="text-align: right;">
                ${editable ? 
                    `<input type="number" step="0.1" min="0" value="${opening}" 
                     class="opening-stock-input" data-product="${product.id}" 
                     style="width: 80px; padding: 5px; border: 1px solid #ddd; border-radius: 3px; text-align: right;">` :
                    opening.toFixed(1)}
            </td>
            <td style="text-align: right;">${restocking.toFixed(1)}</td>
            <td style="text-align: right; font-weight: bold; color: #2e7d32;">${closing.toFixed(1)}</td>
            <td style="text-align: right;">${sold.toFixed(1)}</td>
            <td style="text-align: right;">KSh ${product.sales.toLocaleString()}</td>
            ${currentUserData.role !== 'attendant' ? 
                `<td style="text-align: right; font-weight: bold;">KSh ${salesTotal.toLocaleString()}</td>` : ''}
        `;
    });

    const footerRow = tfoot.insertRow();
    footerRow.innerHTML = `
        <td colspan="4" style="text-align: left;">TOTAL</td>
        <td style="text-align: right; font-weight: bold; color: #2e7d32;">${totalClosing.toFixed(1)}</td>
        <td colspan="${currentUserData.role !== 'attendant' ? 1 : 2}"></td>
        ${currentUserData.role !== 'attendant' ? 
            `<td style="text-align: right; font-weight: bold; color: #2e7d32;">KSh ${totalSales.toLocaleString()}</td>` : ''}
    `;

    if (editable) {
        window.currentOpeningStock = openingStock;
        document.querySelectorAll('.opening-stock-input').forEach(input => {
            input.addEventListener('input', (e) => {
                const productId = e.target.dataset.product;
                window.currentOpeningStock[productId] = parseFloat(e.target.value) || 0;
            });
        });
    }
}

function setupOpeningStockSave(shop, date, saved, isFirst) {
    const saveBtn = document.getElementById('save-opening-stock');
    const copyBtn = document.getElementById('copy-clipboard');

    if (!saved && isFirst) {
        saveBtn.style.display = 'inline-block';
        copyBtn.style.display = 'none';
        document.getElementById('transaction-forms').style.display = 'none';
        document.getElementById('recorded-transactions').style.display = 'none';
    } else if (saved) {
        saveBtn.style.display = 'none';
        copyBtn.style.display = 'inline-block';
        document.getElementById('first-entry-warning').style.display = 'none';
    } else {
        saveBtn.style.display = 'inline-block';
        copyBtn.style.display = 'none';
        document.getElementById('transaction-forms').style.display = 'none';
        document.getElementById('recorded-transactions').style.display = 'none';
        document.getElementById('first-entry-warning').style.display = 'none';
    }

    saveBtn.onclick = async () => {
        const openingStock = {};
        document.querySelectorAll('.opening-stock-input').forEach(input => {
            openingStock[input.dataset.product] = parseFloat(input.value) || 0;
        });

        try {
            await setDoc(doc(db, 'shops', shop, 'daily', date), { openingStock }, { merge: true });
            showToast('Opening stock saved successfully!', 'success');
            loadShopData(shop, date);
        } catch (error) {
            showToast('Error saving opening stock: ' + error.message, 'error');
        }
    };

    copyBtn.onclick = async () => {
        const shopDocRef = doc(db, 'shops', shop, 'daily', date);
        const shopDoc = await getDoc(shopDocRef);
        const closing = calculateClosingStock(shopDoc.data());
        
        let text = `Closing Stock as at ${formatDateDisplay(date)}\n\n`;
        let totalBags = 0;
        
        productsData.forEach(product => {
            const bags = closing[product.id] || 0;
            totalBags += bags;
            text += `${product.name} - ${bags.toFixed(1)} bags\n`;
        });
        
        text += `\nTotal bags - ${totalBags.toFixed(1)} bags`;
        
        navigator.clipboard.writeText(text);
        showToast('Copied to clipboard!', 'success');
    };
}
function renderRecordedTransactions(shopData, shop, date) {
    const container = document.getElementById('transactions-list');
    container.innerHTML = '';

    const sections = [
        { title: 'Regular Sales', data: shopData.regularSales, color: '#2e7d32' },
        { title: 'Credit Sales', data: shopData.creditSales, color: '#c62828' },
        { title: 'Restocking', data: shopData.restocking, color: '#1976d2' },
        { title: 'Transfers In', data: shopData.transfersIn, color: '#7b1fa2' },
        { title: 'Transfers Out', data: shopData.transfersOut, color: '#d32f2f' },
        { title: 'Creditor Releases', data: shopData.creditorReleases, color: '#f57c00' },
        { title: 'Prepayments', data: shopData.prepayments, color: '#388e3c' },
        { title: 'Debt Payments', data: shopData.debtPayments, color: '#0097a7' }
    ];

    sections.forEach(section => {
        if (section.data && Object.keys(section.data).length > 0) {
            const div = document.createElement('div');
            div.style.marginBottom = '20px';
            div.innerHTML = `
                <h4 style="color: ${section.color}; margin-bottom: 10px;">${section.title}</h4>
                <div style="background: #f9f9f9; padding: 10px; border-radius: 5px;">
                    ${Object.entries(section.data).map(([key, val]) => {
                        const product = productsData.find(p => p.id === val.feedType);
                        const productName = product ? product.name : val.feedType;
                        return `<div style="padding: 5px; border-bottom: 1px solid #eee;">
                            ${Object.entries(val).map(([k, v]) => {
                                if (k === 'feedType') return `${k}: ${productName}`;
                                return `${k}: ${v}`;
                            }).join(', ')}
                        </div>`;
                    }).join('')}
                </div>
            `;
            container.appendChild(div);
        }
    });
}

function setupTransactionForms(shop) {
    const transactionButtons = document.querySelector('.transaction-buttons');
    transactionButtons.innerHTML = '';

    const forms = [
        { id: 'sale', label: 'Record a Sale', color: '#2e7d32' },
        { id: 'restock', label: 'Record Restocking', color: '#1976d2' },
        { id: 'transferIn', label: 'Transfers In', color: '#7b1fa2' },
        { id: 'transferOut', label: 'Transfers Out', color: '#d32f2f' },
        { id: 'creditorRelease', label: 'Feeds Released to Creditors', color: '#f57c00' },
        { id: 'creditSale', label: 'Sales Made on Credit', color: '#c62828' },
        { id: 'prepayment', label: 'Prepayments Made', color: '#388e3c' },
        { id: 'debtPayment', label: 'Payments Towards Debts', color: '#0097a7' }
    ];

    forms.forEach(form => {
        const btn = document.createElement('button');
        btn.className = 'transaction-btn';
        btn.textContent = form.label;
        btn.style.background = form.color;
        btn.addEventListener('click', () => showTransactionForm(form.id, shop));
        transactionButtons.appendChild(btn);
    });
}

async function saveTransaction(shop, date, collection, data) {
    try {
        const shopDocRef = doc(db, 'shops', shop, 'daily', date);
        const transactionId = Date.now().toString();
        const transactionData = { ...data, timestamp: new Date().toISOString() };
        
        await setDoc(shopDocRef, {
            [collection]: {
                [transactionId]: transactionData
            }
        }, { merge: true });

        if (collection === 'transfersOut' && data.toShop) {
            const destShopRef = doc(db, 'shops', data.toShop, 'daily', date);
            await setDoc(destShopRef, {
                transfersIn: {
                    [transactionId]: {
                        feedType: data.feedType,
                        bags: data.bags,
                        fromShop: shop,
                        timestamp: new Date().toISOString()
                    }
                }
            }, { merge: true });
        }

        showToast('Transaction saved successfully!', 'success');
        document.getElementById('form-container').innerHTML = '';
        loadShopData(shop, date);
    } catch (error) {
        showToast('Error saving transaction: ' + error.message, 'error');
    }
}
function showTransactionForm(formId, shop) {
    const container = document.getElementById('form-container');
    
    if (formId === 'sale') {
        container.innerHTML = `
            <div class="form-box" style="border-color: #2e7d32;">
                <h4 style="color: #2e7d32;">Record a Sale</h4>
                <form id="transaction-form" class="form-grid">
                    <input type="text" class="form-input" id="form-client" placeholder="Client Name" required>
                    <select class="form-input" id="form-feed" required>
                        <option value="">Select Feed Type</option>
                        ${productsData.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}
                    </select>
                    <input type="number" step="0.1" min="0.1" class="form-input" id="form-bags" placeholder="Number of Bags" required>
                    <input type="number" class="form-input" id="form-price" placeholder="Price" readonly style="background: #f5f5f5;">
                    <input type="number" min="0" class="form-input" id="form-discount" placeholder="Discount (KSh)" value="0" required>
                    <div class="form-buttons">
                        <button type="submit" class="btn-save" style="background: #2e7d32;">Save</button>
                        <button type="button" class="btn-cancel">Cancel</button>
                    </div>
                </form>
            </div>
        `;
        document.getElementById('form-feed').onchange = (e) => {
            const product = productsData.find(p => p.id === e.target.value);
            document.getElementById('form-price').value = product ? product.sales : '';
        };
        document.getElementById('transaction-form').onsubmit = async (e) => {
            e.preventDefault();
            await saveTransaction(shop, currentDate, 'regularSales', {
                clientName: document.getElementById('form-client').value,
                feedType: document.getElementById('form-feed').value,
                bags: document.getElementById('form-bags').value,
                price: document.getElementById('form-price').value,
                discount: document.getElementById('form-discount').value
            });
        };
    } else if (formId === 'restock') {
        container.innerHTML = `
            <div class="form-box" style="border-color: #1976d2;">
                <h4 style="color: #1976d2;">Record Restocking</h4>
                <form id="transaction-form" class="form-grid">
                    <select class="form-input" id="form-feed" required>
                        <option value="">Select Feed Type</option>
                        ${productsData.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}
                    </select>
                    <input type="number" step="0.1" min="0.1" class="form-input" id="form-bags" placeholder="Number of Bags" required>
                    <input type="text" class="form-input" id="form-supplier" placeholder="Supplier Name (optional)">
                    <div class="form-buttons">
                        <button type="submit" class="btn-save" style="background: #1976d2;">Save</button>
                        <button type="button" class="btn-cancel">Cancel</button>
                    </div>
                </form>
            </div>
        `;
        document.getElementById('transaction-form').onsubmit = async (e) => {
            e.preventDefault();
            await saveTransaction(shop, currentDate, 'restocking', {
                feedType: document.getElementById('form-feed').value,
                bags: document.getElementById('form-bags').value,
                supplierName: document.getElementById('form-supplier').value
            });
        };
    } else if (formId === 'transferIn') {
        const otherShops = SHOPS.filter(s => s !== shop);
        container.innerHTML = `
            <div class="form-box" style="border-color: #7b1fa2;">
                <h4 style="color: #7b1fa2;">Transfers In</h4>
                <form id="transaction-form" class="form-grid">
                    <select class="form-input" id="form-feed" required>
                        <option value="">Select Feed Type</option>
                        ${productsData.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}
                    </select>
                    <input type="number" step="0.1" min="0.1" class="form-input" id="form-bags" placeholder="Number of Bags" required>
                    <select class="form-input" id="form-from" required>
                        <option value="">From Shop</option>
                        ${otherShops.map(s => `<option value="${s}">${s}</option>`).join('')}
                    </select>
                    <div class="form-buttons">
                        <button type="submit" class="btn-save" style="background: #7b1fa2;">Save</button>
                        <button type="button" class="btn-cancel">Cancel</button>
                    </div>
                </form>
            </div>
        `;
        document.getElementById('transaction-form').onsubmit = async (e) => {
            e.preventDefault();
            await saveTransaction(shop, currentDate, 'transfersIn', {
                feedType: document.getElementById('form-feed').value,
                bags: document.getElementById('form-bags').value,
                fromShop: document.getElementById('form-from').value
            });
        };
    } else if (formId === 'transferOut') {
        const otherShops = SHOPS.filter(s => s !== shop);
        container.innerHTML = `
            <div class="form-box" style="border-color: #d32f2f;">
                <h4 style="color: #d32f2f;">Transfers Out</h4>
                <form id="transaction-form" class="form-grid">
                    <select class="form-input" id="form-feed" required>
                        <option value="">Select Feed Type</option>
                        ${productsData.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}
                    </select>
                    <input type="number" step="0.1" min="0.1" class="form-input" id="form-bags" placeholder="Number of Bags" required>
                    <select class="form-input" id="form-to" required>
                        <option value="">To Shop</option>
                        ${otherShops.map(s => `<option value="${s}">${s}</option>`).join('')}
                    </select>
                    <div class="form-buttons">
                        <button type="submit" class="btn-save" style="background: #d32f2f;">Save</button>
                        <button type="button" class="btn-cancel">Cancel</button>
                    </div>
                </form>
            </div>
        `;
        document.getElementById('transaction-form').onsubmit = async (e) => {
            e.preventDefault();
            await saveTransaction(shop, currentDate, 'transfersOut', {
                feedType: document.getElementById('form-feed').value,
                bags: document.getElementById('form-bags').value,
                toShop: document.getElementById('form-to').value
            });
        };
    } else if (formId === 'creditSale') {
        container.innerHTML = `
            <div class="form-box" style="border-color: #c62828;">
                <h4 style="color: #c62828;">Sales Made on Credit</h4>
                <form id="transaction-form" class="form-grid">
                    <input type="text" class="form-input" id="form-debtor" placeholder="Debtor Name" required>
                    <select class="form-input" id="form-feed" required>
                        <option value="">Select Feed Type</option>
                        ${productsData.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}
                    </select>
                    <input type="number" step="0.1" min="0.1" class="form-input" id="form-bags" placeholder="Number of Bags" required>
                    <input type="number" class="form-input" id="form-price" placeholder="Price" readonly style="background: #f5f5f5;">
                    <input type="number" min="0" class="form-input" id="form-discount" placeholder="Discount (KSh)" value="0" required>
                    <div class="form-buttons">
                        <button type="submit" class="btn-save" style="background: #c62828;">Save</button>
                        <button type="button" class="btn-cancel">Cancel</button>
                    </div>
                </form>
            </div>
        `;
        document.getElementById('form-feed').onchange = (e) => {
            const product = productsData.find(p => p.id === e.target.value);
            document.getElementById('form-price').value = product ? product.sales : '';
        };
        document.getElementById('transaction-form').onsubmit = async (e) => {
            e.preventDefault();
            await saveTransaction(shop, currentDate, 'creditSales', {
                debtorName: document.getElementById('form-debtor').value,
                feedType: document.getElementById('form-feed').value,
                bags: document.getElementById('form-bags').value,
                price: document.getElementById('form-price').value,
                discount: document.getElementById('form-discount').value
            });
        };
    } else if (formId === 'prepayment') {
        container.innerHTML = `
            <div class="form-box" style="border-color: #388e3c;">
                <h4 style="color: #388e3c;">Prepayments Made</h4>
                <form id="transaction-form" class="form-grid">
                    <input type="text" class="form-input" id="form-client" placeholder="Client Name" required>
                    <input type="number" min="0" class="form-input" id="form-amount" placeholder="Amount Paid (KSh)" required>
                    <div class="form-buttons">
                        <button type="submit" class="btn-save" style="background: #388e3c;">Save</button>
                        <button type="button" class="btn-cancel">Cancel</button>
                    </div>
                </form>
            </div>
        `;
        document.getElementById('transaction-form').onsubmit = async (e) => {
            e.preventDefault();
            await saveTransaction(shop, currentDate, 'prepayments', {
                clientName: document.getElementById('form-client').value,
                amountPaid: document.getElementById('form-amount').value
            });
        };
    } else if (formId === 'creditorRelease') {
        container.innerHTML = `
            <div class="form-box" style="border-color: #f57c00;">
                <h4 style="color: #f57c00;">Feeds Released to Creditors</h4>
                <p id="creditor-loading">Loading creditors...</p>
                <form id="transaction-form" class="form-grid" style="display: none;">
                    <select class="form-input" id="form-creditor" required>
                        <option value="">Select Creditor</option>
                    </select>
                    <select class="form-input" id="form-feed" required>
                        <option value="">Select Feed Type</option>
                        ${productsData.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}
                    </select>
                    <input type="number" step="0.1" min="0.1" class="form-input" id="form-bags" placeholder="Number of Bags" required>
                    <div class="form-buttons">
                        <button type="submit" class="btn-save" style="background: #f57c00;">Save</button>
                        <button type="button" class="btn-cancel">Cancel</button>
                    </div>
                </form>
            </div>
        `;
        loadCreditorsForRelease(shop);
    } else if (formId === 'debtPayment') {
        container.innerHTML = `
            <div class="form-box" style="border-color: #0097a7;">
                <h4 style="color: #0097a7;">Payments Towards Debts</h4>
                <p id="debtor-loading">Loading debtors...</p>
                <form id="transaction-form" class="form-grid" style="display: none;">
                    <select class="form-input" id="form-debtor" required>
                        <option value="">Select Debtor</option>
                    </select>
                    <input type="number" min="0" class="form-input" id="form-amount" placeholder="Amount Paid (KSh)" required>
                    <select class="form-input" id="form-method" required>
                        <option value="">Payment Method</option>
                        <option value="Cash">Cash</option>
                        <option value="M-Pesa">M-Pesa</option>
                        <option value="Bank">Bank</option>
                    </select>
                    <div class="form-buttons">
                        <button type="submit" class="btn-save" style="background: #0097a7;">Save</button>
                        <button type="button" class="btn-cancel">Cancel</button>
                    </div>
                </form>
            </div>
        `;
        loadDebtorsForPayment(shop);
    }
    
    document.querySelectorAll('.btn-cancel').forEach(btn => {
        btn.onclick = () => container.innerHTML = '';
    });
}

async function loadCreditorsForRelease(shop) {
    const creditors = new Set();
    const shopQuery = query(collection(db, 'shops', shop, 'daily'));
    const snapshot = await getDocs(shopQuery);
    
    snapshot.forEach(doc => {
        const data = doc.data();
        if (data.prepayments) {
            Object.values(data.prepayments).forEach(p => {
                creditors.add(p.clientName);
            });
        }
    });

    const creditorSelect = document.getElementById('form-creditor');
    const form = document.getElementById('transaction-form');
    const loading = document.getElementById('creditor-loading');

    if (creditors.size === 0) {
        loading.textContent = 'No creditors available. Record prepayments first.';
        loading.style.color = '#856404';
        loading.style.background = '#fff3cd';
        loading.style.padding = '10px';
        loading.style.borderRadius = '5px';
    } else {
        creditors.forEach(c => {
            const option = document.createElement('option');
            option.value = c;
            option.textContent = c;
            creditorSelect.appendChild(option);
        });
        loading.style.display = 'none';
        form.style.display = 'grid';
        
        form.onsubmit = async (e) => {
            e.preventDefault();
            await saveTransaction(shop, currentDate, 'creditorReleases', {
                creditorName: document.getElementById('form-creditor').value,
                feedType: document.getElementById('form-feed').value,
                bags: document.getElementById('form-bags').value
            });
        };
    }
}

async function loadDebtorsForPayment(shop) {
    const debtors = new Set();
    const shopQuery = query(collection(db, 'shops', shop, 'daily'));
    const snapshot = await getDocs(shopQuery);
    
    snapshot.forEach(doc => {
        const data = doc.data();
        if (data.creditSales) {
            Object.values(data.creditSales).forEach(s => {
                debtors.add(s.debtorName);
            });
        }
    });

    const debtorSelect = document.getElementById('form-debtor');
    const form = document.getElementById('transaction-form');
    const loading = document.getElementById('debtor-loading');

    if (debtors.size === 0) {
        loading.textContent = 'No debtors available. Record credit sales first.';
        loading.style.color = '#856404';
        loading.style.background = '#fff3cd';
        loading.style.padding = '10px';
        loading.style.borderRadius = '5px';
    } else {
        debtors.forEach(d => {
            const option = document.createElement('option');
            option.value = d;
            option.textContent = d;
            debtorSelect.appendChild(option);
        });
        loading.style.display = 'none';
        form.style.display = 'grid';
        
        form.onsubmit = async (e) => {
            e.preventDefault();
            await saveTransaction(shop, currentDate, 'debtPayments', {
                debtorName: document.getElementById('form-debtor').value,
                amountPaid: document.getElementById('form-amount').value,
                paymentMethod: document.getElementById('form-method').value
            });
        };
    }
}
async function loadTotalSalesView() {
    showView('total-sales-view');
    const dateSelector = document.getElementById('total-sales-date');
    dateSelector.value = dateToISO(currentDate);
    dateSelector.onchange = (e) => {
        currentDate = isoToDate(e.target.value);
        loadTotalSalesData(currentDate);
    };
    await loadTotalSalesData(currentDate);
}

async function loadTotalSalesData(date) {
    const tbody = document.getElementById('total-sales-body');
    const tfoot = document.getElementById('total-sales-footer');
    tbody.innerHTML = '';
    tfoot.innerHTML = '';

    let totalBagsRemaining = 0;
    let totalBagsSold = 0;
    let totalSalesAmount = 0;

    for (const shop of SHOPS) {
        const shopDocRef = doc(db, 'shops', shop, 'daily', date);
        const shopDoc = await getDoc(shopDocRef);

        if (shopDoc.exists()) {
            const data = shopDoc.data();
            const closing = calculateClosingStock(data);
            const bagsRemaining = Object.values(closing).reduce((a, b) => a + b, 0);
            
            let bagsSold = 0;
            let salesAmount = 0;
            
            productsData.forEach(product => {
                const sold = calculateSold(data, product.id);
                bagsSold += sold;
                salesAmount += sold * product.sales;
            });

            totalBagsRemaining += bagsRemaining;
            totalBagsSold += bagsSold;
            totalSalesAmount += salesAmount;

            const row = tbody.insertRow();
            row.innerHTML = `
                <td>${shop}</td>
                <td style="text-align: right;">${bagsRemaining.toFixed(1)}</td>
                <td style="text-align: right;">${bagsSold.toFixed(1)}</td>
                <td style="text-align: right; font-weight: bold;">KSh ${salesAmount.toLocaleString()}</td>
            `;
        }
    }

    const footerRow = tfoot.insertRow();
    footerRow.innerHTML = `
        <td style="font-weight: bold;">TOTAL</td>
        <td style="text-align: right; font-weight: bold; color: #2e7d32;">${totalBagsRemaining.toFixed(1)}</td>
        <td style="text-align: right; font-weight: bold; color: #2e7d32;">${totalBagsSold.toFixed(1)}</td>
        <td style="text-align: right; font-weight: bold; color: #2e7d32;">KSh ${totalSalesAmount.toLocaleString()}</td>
    `;
}

async function loadDebtorsView() {
    showView('debtors-view');
    const tbody = document.getElementById('debtors-body');
    const tfoot = document.getElementById('debtors-footer');
    tbody.innerHTML = '';
    tfoot.innerHTML = '';

    let totalAmount = 0;

    for (const shop of SHOPS) {
        const shopQuery = query(collection(db, 'shops', shop, 'daily'));
        const snapshot = await getDocs(shopQuery);

        snapshot.forEach(doc => {
            const data = doc.data();
            const date = doc.id;
            
            if (data.creditSales) {
                Object.values(data.creditSales).forEach(sale => {
                    const product = productsData.find(p => p.id === sale.feedType);
                    const amount = (parseFloat(sale.bags) * parseFloat(sale.price)) - parseFloat(sale.discount || 0);
                    totalAmount += amount;

                    const row = tbody.insertRow();
                    row.innerHTML = `
                        <td>${sale.debtorName}</td>
                        <td>${product ? product.name : sale.feedType}</td>
                        <td style="text-align: right;">${parseFloat(sale.bags).toFixed(1)}</td>
                        <td style="text-align: right;">KSh ${parseFloat(sale.price).toLocaleString()}</td>
                        <td style="text-align: right; font-weight: bold;">KSh ${amount.toLocaleString()}</td>
                        <td>${shop}</td>
                        <td>${formatDateDisplay(date)}</td>
                    `;
                });
            }
        });
    }

    const footerRow = tfoot.insertRow();
    footerRow.innerHTML = `
        <td colspan="4" style="text-align: left; font-weight: bold;">TOTAL</td>
        <td style="text-align: right; font-weight: bold; color: #d32f2f;">KSh ${totalAmount.toLocaleString()}</td>
        <td colspan="2"></td>
    `;
}

async function loadCreditorsView() {
    showView('creditors-view');
    const tbody = document.getElementById('creditors-body');
    const tfoot = document.getElementById('creditors-footer');
    tbody.innerHTML = '';
    tfoot.innerHTML = '';

    let totalAmount = 0;

    for (const shop of SHOPS) {
        const shopQuery = query(collection(db, 'shops', shop, 'daily'));
        const snapshot = await getDocs(shopQuery);

        snapshot.forEach(doc => {
            const data = doc.data();
            const date = doc.id;
            
            if (data.prepayments) {
                Object.values(data.prepayments).forEach(payment => {
                    const amount = parseFloat(payment.amountPaid);
                    totalAmount += amount;

                    const row = tbody.insertRow();
                    row.innerHTML = `
                        <td>${payment.clientName}</td>
                        <td style="text-align: right; font-weight: bold;">KSh ${amount.toLocaleString()}</td>
                        <td>${shop}</td>
                        <td>${formatDateDisplay(date)}</td>
                    `;
                });
            }
        });
    }

    const footerRow = tfoot.insertRow();
    footerRow.innerHTML = `
        <td style="font-weight: bold;">TOTAL</td>
        <td style="text-align: right; font-weight: bold; color: #f57c00;">KSh ${totalAmount.toLocaleString()}</td>
        <td colspan="2"></td>
    `;
}
async function loadStockValueView() {
    showView('stock-value-view');
    const dateSelector = document.getElementById('stock-value-date');
    dateSelector.value = dateToISO(currentDate);
    dateSelector.onchange = (e) => {
        currentDate = isoToDate(e.target.value);
        loadStockValueData(currentDate);
    };
    await loadStockValueData(currentDate);
}

async function loadStockValueData(date) {
    let debtorsValue = 0;
    let shopsValue = 0;
    let creditorsValue = 0;

    for (const shop of SHOPS) {
        const shopDocRef = doc(db, 'shops', shop, 'daily', date);
        const shopDoc = await getDoc(shopDocRef);

        if (shopDoc.exists()) {
            const data = shopDoc.data();
            const closing = calculateClosingStock(data);
            
            productsData.forEach(product => {
                const bags = closing[product.id] || 0;
                shopsValue += bags * product.cost;
            });

            if (data.creditSales) {
                Object.values(data.creditSales).forEach(sale => {
                    const amount = (parseFloat(sale.bags) * parseFloat(sale.price)) - parseFloat(sale.discount || 0);
                    debtorsValue += amount;
                });
            }

            if (data.creditorReleases) {
                Object.values(data.creditorReleases).forEach(release => {
                    const product = productsData.find(p => p.id === release.feedType);
                    if (product) {
                        creditorsValue += parseFloat(release.bags) * product.cost;
                    }
                });
            }
        }

        const shopQuery = query(collection(db, 'shops', shop, 'daily'));
        const snapshot = await getDocs(shopQuery);
        snapshot.forEach(doc => {
            const data = doc.data();
            if (data.prepayments) {
                Object.values(data.prepayments).forEach(payment => {
                    creditorsValue += parseFloat(payment.amountPaid);
                });
            }
        });
    }

    const netValue = shopsValue + debtorsValue - creditorsValue;

    document.getElementById('debtors-value').textContent = `KSh ${debtorsValue.toLocaleString()}`;
    document.getElementById('shops-value').textContent = `KSh ${shopsValue.toLocaleString()}`;
    document.getElementById('creditors-value').textContent = `KSh ${creditorsValue.toLocaleString()}`;
    document.getElementById('net-value').textContent = `KSh ${netValue.toLocaleString()}`;
    document.getElementById('formula-text').innerHTML = `
        Net Stock Value = Stock in Shops + Debtors - Creditors<br>
        Net Stock Value = ${shopsValue.toLocaleString()} + ${debtorsValue.toLocaleString()} - ${creditorsValue.toLocaleString()}
    `;
}

async function loadProductsView() {
    showView('products-view');
    const tbody = document.getElementById('products-body');
    tbody.innerHTML = '';

    productsData.forEach(product => {
        const row = tbody.insertRow();
        row.innerHTML = `
            <td>${product.name}</td>
            <td><input type="number" min="0" class="form-input product-cost" data-id="${product.id}" value="${product.cost}" ${currentUserData.role === 'manager_view' ? '' : ''}></td>
            <td><input type="number" min="0" class="form-input product-sales" data-id="${product.id}" value="${product.sales}"></td>
        `;
    });

    document.getElementById('save-prices').onclick = async () => {
        const updates = {};
        document.querySelectorAll('.product-cost').forEach(input => {
            const id = input.dataset.id;
            const product = productsData.find(p => p.id === id);
            product.cost = parseFloat(input.value) || 0;
        });
        document.querySelectorAll('.product-sales').forEach(input => {
            const id = input.dataset.id;
            const product = productsData.find(p => p.id === id);
            product.sales = parseFloat(input.value) || 0;
        });
        
        try {
            await setDoc(doc(db, 'settings', 'products'), { products: productsData });
            showToast('Prices updated successfully!', 'success');
        } catch (error) {
            showToast('Error updating prices: ' + error.message, 'error');
        }
    };
}

async function loadAllClientsView() {
    showView('all-clients-view');
    
    const shopFilter = document.getElementById('client-shop-filter');
    shopFilter.innerHTML = '<option value="">All Shops</option>';
    SHOPS.forEach(shop => {
        const option = document.createElement('option');
        option.value = shop;
        option.textContent = shop;
        shopFilter.appendChild(option);
    });

    const dateFilter = document.getElementById('client-date-filter');
    dateFilter.value = dateToISO(currentDate);

    const loadClients = async () => {
        const tbody = document.getElementById('all-clients-body');
        tbody.innerHTML = '';

        const selectedShop = shopFilter.value;
        const selectedDate = isoToDate(dateFilter.value);
        const shopsToQuery = selectedShop ? [selectedShop] : SHOPS;

        for (const shop of shopsToQuery) {
            if (selectedDate) {
                const shopDocRef = doc(db, 'shops', shop, 'daily', selectedDate);
                const shopDoc = await getDoc(shopDocRef);
                
                if (shopDoc.exists()) {
                    const data = shopDoc.data();
                    if (data.regularSales) {
                        Object.values(data.regularSales).forEach(sale => {
                            const product = productsData.find(p => p.id === sale.feedType);
                            const amount = (parseFloat(sale.bags) * parseFloat(sale.price)) - parseFloat(sale.discount || 0);
                            
                            const row = tbody.insertRow();
                            row.innerHTML = `
                                <td>${sale.clientName}</td>
                                <td>${product ? product.name : sale.feedType}</td>
                                <td style="text-align: right;">${parseFloat(sale.bags).toFixed(1)}</td>
                                <td style="text-align: right; font-weight: bold;">KSh ${amount.toLocaleString()}</td>
                                <td>${shop}</td>
                                <td>${formatDateDisplay(selectedDate)}</td>
                            `;
                        });
                    }
                }
            }
        }
    };

    shopFilter.onchange = loadClients;
    dateFilter.onchange = loadClients;
    await loadClients();
}
async function loadAdminPanel() {
    showView('admin-view');
    const container = document.getElementById('admin-users');
    container.innerHTML = '';

    const usersSnapshot = await getDocs(collection(db, 'users'));
    
    usersSnapshot.forEach(userDoc => {
        const userData = userDoc.data();
        const userId = userDoc.id;

        const card = document.createElement('div');
        card.className = 'admin-user-card';
        card.innerHTML = `
            <div class="admin-user-header">
                <div class="admin-user-info">
                    <h4>${userData.name}</h4>
                    <p>${userData.email}</p>
                </div>
                <span class="admin-status ${userData.status}">${userData.status}</span>
            </div>
            <div class="admin-controls">
                <div class="admin-control-group">
                    <label>Role</label>
                    <select class="user-role-select" data-user="${userId}">
                        <option value="manager_full" ${userData.role === 'manager_full' ? 'selected' : ''}>Manager (Full Access)</option>
                        <option value="manager_view" ${userData.role === 'manager_view' ? 'selected' : ''}>Manager (View Only)</option>
                        <option value="attendant" ${userData.role === 'attendant' ? 'selected' : ''}>Attendant</option>
                        <option value="pending" ${userData.role === 'pending' ? 'selected' : ''}>Pending</option>
                    </select>
                </div>
                <div class="admin-control-group">
                    <label>Shop</label>
                    <select class="user-shop-select" data-user="${userId}">
                        <option value="">No Shop</option>
                        ${SHOPS.map(shop => `<option value="${shop}" ${userData.shop === shop ? 'selected' : ''}>${shop}</option>`).join('')}
                    </select>
                </div>
            </div>
            <div class="admin-buttons">
                <button class="btn-admin-save" data-user="${userId}">Save</button>
                <button class="btn-admin-remove" data-user="${userId}">Remove</button>
            </div>
        `;
        container.appendChild(card);
    });

    document.querySelectorAll('.btn-admin-save').forEach(btn => {
        btn.onclick = async () => {
            const userId = btn.dataset.user;
            const role = document.querySelector(`.user-role-select[data-user="${userId}"]`).value;
            const shop = document.querySelector(`.user-shop-select[data-user="${userId}"]`).value;

            try {
                await updateDoc(doc(db, 'users', userId), {
                    role: role,
                    shop: shop || null,
                    status: role === 'pending' ? 'pending' : 'active'
                });
                showToast('User updated successfully!', 'success');
                loadAdminPanel();
            } catch (error) {
                showToast('Error updating user: ' + error.message, 'error');
            }
        };
    });

    document.querySelectorAll('.btn-admin-remove').forEach(btn => {
        btn.onclick = async () => {
            const userId = btn.dataset.user;
            if (confirm('Are you sure you want to remove this user?')) {
                try {
                    await deleteDoc(doc(db, 'users', userId));
                    showToast('User removed successfully!', 'success');
                    loadAdminPanel();
                } catch (error) {
                    showToast('Error removing user: ' + error.message, 'error');
                }
            }
        };
    });
}

document.getElementById('export-doc1').addEventListener('click', () => {
    showToast('PDF export feature - Add jsPDF implementation here', 'success');
});

document.getElementById('export-doc2').addEventListener('click', () => {
    showToast('PDF export feature - Add jsPDF implementation here', 'success');
});