// app.js - Young Farmers Stock Management - FINAL PART 1 OF 4
// Paste Part 2 directly after this

import { auth, db } from './firebase-config.js';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
  doc, 
  setDoc, 
  getDoc, 
  collection, 
  query, 
  where, 
  getDocs,
  updateDoc,
  deleteDoc,
  addDoc,
  orderBy,
  Timestamp,
  writeBatch
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const ADMIN_EMAIL = "jeckstom777@gmail.com";

const SHOPS = [
  { id: 'usigu', name: 'Usigu' },
  { id: 'port-victoria', name: 'Port Victoria' },
  { id: 'mbita', name: 'Mbita' },
  { id: 'usenge', name: 'Usenge' },
  { id: 'lwanda-kotieno', name: 'Lwanda Kotieno' },
  { id: 'obambo', name: 'Obambo' },
  { id: 'sori', name: 'Sori' }
];

const PRODUCTS = [
  { id: 'starter-mash', name: 'Starter Mash', costPrice: 4240, salesPrice: 4600 },
  { id: 'samakgro-1mm', name: 'Samakgro 1MM', costPrice: 3690, salesPrice: 4150 },
  { id: 'samakgro-2mm', name: 'Samakgro 2MM', costPrice: 3600, salesPrice: 3200 },
  { id: 'samakgro-3mm', name: 'Samakgro 3MM', costPrice: 3200, salesPrice: 2850 },
  { id: 'samakgro-4mmhp', name: 'Samakgro 4MMHP', costPrice: 2950, salesPrice: 2650 },
  { id: 'samakgro-4-5mm', name: 'Samakgro 4.5MM', costPrice: 2800, salesPrice: 2500 },
  { id: 'broodstock', name: 'Broodstock', costPrice: 3900, salesPrice: 3900 }
];

let currentUser = null;
let currentUserData = null;
let currentView = 'dashboard';
let currentShop = null;

// Initialize app
window.addEventListener('DOMContentLoaded', () => {
  showSplashScreen();
  setupAuthListeners();
  setupNavigationListeners();
  
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      currentUser = user;
      await loadUserData();
      if (currentUserData && currentUserData.status === 'active') {
        hideSplashScreen();
        showMainScreen();
      } else {
        hideSplashScreen();
        showToast('Your account is pending approval. Please contact the administrator.');
        signOut(auth);
      }
    } else {
      hideSplashScreen();
      showAuthScreen();
    }
  });
});

// Splash screen
function showSplashScreen() {
  const splash = document.getElementById('splash-screen');
  if (splash) {
    splash.classList.add('active');
    setTimeout(() => {
      splash.classList.remove('active');
    }, 2500);
  }
}

function hideSplashScreen() {
  const splash = document.getElementById('splash-screen');
  if (splash) {
    splash.classList.remove('active');
  }
}

// Screen management
function showAuthScreen() {
  hideAllScreens();
  document.getElementById('auth-screen').classList.add('active');
}

function showMainScreen() {
  hideAllScreens();
  document.getElementById('main-screen').classList.add('active');
  showDashboard();
}

function hideAllScreens() {
  document.querySelectorAll('.screen').forEach(screen => {
    screen.classList.remove('active');
  });
}

// Auth listeners
function setupAuthListeners() {
  const authForm = document.getElementById('auth-form');
  const toggleAuth = document.getElementById('toggle-auth');
  const googleSignin = document.getElementById('google-signin');
  
  if (authForm) authForm.addEventListener('submit', handleAuthSubmit);
  if (toggleAuth) toggleAuth.addEventListener('click', toggleAuthMode);
  if (googleSignin) googleSignin.addEventListener('click', handleGoogleSignin);
}

let isSignUp = false;

function toggleAuthMode(e) {
  e.preventDefault();
  isSignUp = !isSignUp;
  const title = document.getElementById('auth-title');
  const submitBtn = document.getElementById('auth-submit');
  const nameField = document.getElementById('auth-name');
  const toggleText = document.getElementById('toggle-text');
  const toggleLink = document.getElementById('toggle-auth');
  
  if (isSignUp) {
    title.textContent = 'Sign Up';
    submitBtn.textContent = 'Sign Up';
    nameField.style.display = 'block';
    toggleText.textContent = 'Already have an account?';
    toggleLink.textContent = 'Sign In';
  } else {
    title.textContent = 'Sign In';
    submitBtn.textContent = 'Sign In';
    nameField.style.display = 'none';
    toggleText.textContent = "Don't have an account?";
    toggleLink.textContent = 'Sign Up';
  }
  
  document.getElementById('auth-error').textContent = '';
}

async function handleAuthSubmit(e) {
  e.preventDefault();
  const email = document.getElementById('auth-email').value;
  const password = document.getElementById('auth-password').value;
  const name = document.getElementById('auth-name').value;
  const errorDiv = document.getElementById('auth-error');
  
  try {
    if (isSignUp) {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      await createUserDocument(userCredential.user.uid, email, name);
      showToast('Account created! Waiting for admin approval.');
      signOut(auth);
    } else {
      await signInWithEmailAndPassword(auth, email, password);
    }
  } catch (error) {
    errorDiv.textContent = error.message;
  }
}

async function handleGoogleSignin() {
  const provider = new GoogleAuthProvider();
  try {
    const result = await signInWithPopup(auth, provider);
    const user = result.user;
    
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    if (!userDoc.exists()) {
      await createUserDocument(user.uid, user.email, user.displayName || 'User');
      showToast('Account created! Waiting for admin approval.');
      await signOut(auth);
    }
  } catch (error) {
    console.error('Google sign-in error:', error);
    document.getElementById('auth-error').textContent = error.message;
  }
}

async function createUserDocument(uid, email, name) {
  const isAdmin = email === ADMIN_EMAIL;
  
  try {
    const batch = writeBatch(db);
    const userRef = doc(db, 'users', uid);
    
    batch.set(userRef, {
      email: email,
      name: name,
      role: isAdmin ? 'manager_full' : 'pending',
      shop: null,
      status: isAdmin ? 'active' : 'pending',
      createdAt: Timestamp.now()
    });
    
    await batch.commit();
    console.log('User document created successfully');
  } catch (error) {
    console.error('Error creating user document:', error);
    throw error;
  }
}

async function loadUserData() {
  const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
  if (userDoc.exists()) {
    currentUserData = userDoc.data();
    updateUIForRole();
  }
}

function updateUIForRole() {
  const role = currentUserData.role;
  
  const managerBtns = document.querySelectorAll('.manager-btn');
  const adminBtn = document.querySelector('.admin-btn');
  
  if (role === 'manager_full' || role === 'manager_view') {
    managerBtns.forEach(btn => btn.style.display = 'block');
  } else {
    managerBtns.forEach(btn => btn.style.display = 'none');
  }
  
  if (role === 'manager_full') {
    adminBtn.style.display = 'block';
  } else {
    adminBtn.style.display = 'none';
  }
}

// Navigation
function setupNavigationListeners() {
  const logoutBtn = document.getElementById('logout-btn');
  const backBtn = document.getElementById('back-btn');
  const totalSalesBtn = document.getElementById('total-sales-btn');
  const debtorsBtn = document.getElementById('debtors-btn');
  const creditorsBtn = document.getElementById('creditors-btn');
  const stockValueBtn = document.getElementById('stock-value-btn');
  const productsBtn = document.getElementById('products-btn');
  const allClientsBtn = document.getElementById('all-clients-btn');
  const adminPanelBtn = document.getElementById('admin-panel-btn');
  const shopDate = document.getElementById('shop-date');
  const salesDate = document.getElementById('sales-date');
  const clientsShopFilter = document.getElementById('clients-shop-filter');
  const clientsDateFilter = document.getElementById('clients-date-filter');
  const exportDoc1 = document.getElementById('export-doc1');
  const exportDoc2 = document.getElementById('export-doc2');
  
  if (logoutBtn) logoutBtn.addEventListener('click', () => signOut(auth));
  if (backBtn) backBtn.addEventListener('click', () => showDashboard());
  
  document.querySelectorAll('.shop-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const shopId = btn.dataset.shop;
      showShopView(shopId);
    });
  });
  
  if (totalSalesBtn) totalSalesBtn.addEventListener('click', showTotalSalesView);
  if (debtorsBtn) debtorsBtn.addEventListener('click', showDebtorsView);
  if (creditorsBtn) creditorsBtn.addEventListener('click', showCreditorsView);
  if (stockValueBtn) stockValueBtn.addEventListener('click', showStockValueView);
  if (productsBtn) productsBtn.addEventListener('click', showProductsView);
  if (allClientsBtn) allClientsBtn.addEventListener('click', showAllClientsView);
  if (adminPanelBtn) adminPanelBtn.addEventListener('click', showAdminPanel);
  
  if (shopDate) shopDate.addEventListener('change', (e) => {
    if (currentShop) {
      loadShopData(currentShop, e.target.value);
    }
  });
  
  if (salesDate) salesDate.addEventListener('change', (e) => {
    loadTotalSalesData(e.target.value);
  });
  
  if (clientsShopFilter) clientsShopFilter.addEventListener('change', loadAllClientsData);
  if (clientsDateFilter) clientsDateFilter.addEventListener('change', loadAllClientsData);
  
  if (exportDoc1) exportDoc1.addEventListener('click', () => exportDoc1PDF());
  if (exportDoc2) exportDoc2.addEventListener('click', () => exportDoc2PDF());
}

function showDashboard() {
  hideAllViews();
  document.getElementById('dashboard').style.display = 'block';
  document.getElementById('screen-title').textContent = 'Young Farmers';
  document.getElementById('back-btn').style.display = 'none';
  currentView = 'dashboard';
}

function hideAllViews() {
  document.querySelectorAll('.content').forEach(view => {
    view.style.display = 'none';
  });
}

// Toast notification
function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('show');
  
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}
// app.js - FINAL PART 2 OF 4
// Paste Part 3 directly after this

// Shop view
async function showShopView(shopId) {
  hideAllViews();
  currentShop = shopId;
  const shopName = SHOPS.find(s => s.id === shopId).name;
  document.getElementById('screen-title').textContent = shopName;
  document.getElementById('back-btn').style.display = 'block';
  document.getElementById('shop-view').style.display = 'block';
  
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('shop-date').value = today;
  
  await loadShopData(shopId, today);
}

async function loadShopData(shopId, date) {
  const content = document.getElementById('shop-content');
  const role = currentUserData.role;
  const userShop = currentUserData.shop;
  
  // If attendant viewing other shop - show only stock quantities
  if (role === 'attendant' && userShop !== shopId) {
    content.innerHTML = await renderOtherShopStock(shopId, date);
    return;
  }
  
  const stockData = await getShopStock(shopId, date);
  
  if (role === 'attendant') {
    content.innerHTML = renderAttendantView(shopId, date, stockData);
    setupAttendantFormListeners(shopId, date);
  } else {
    content.innerHTML = renderManagerShopView(shopId, date, stockData);
  }
}

async function renderOtherShopStock(shopId, date) {
  const stockData = await getShopStock(shopId, date);
  
  let html = '<div class="summary-card"><h2>Stock Available</h2>';
  html += '<table><thead><tr><th>Product</th><th>Bags Available</th></tr></thead><tbody>';
  
  PRODUCTS.forEach(product => {
    const closing = stockData.closingStock[product.id] || 0;
    html += `<tr><td>${product.name}</td><td>${closing}</td></tr>`;
  });
  
  html += '</tbody></table></div>';
  return html;
}

function renderAttendantView(shopId, date, stockData) {
  let html = '<div class="summary-card">';
  html += '<h2>Closing Stock (Auto-Calculated)</h2>';
  html += '<p style="color: #666; margin-bottom: 15px;">Record all transactions below. Closing stock updates automatically.</p>';
  html += '<table><thead><tr>';
  html += '<th>#</th><th>Feed Name</th><th>Opening Stock</th><th>Restocking</th><th>Closing Stock</th><th>Bags Sold</th><th>Selling Price</th>';
  html += '</tr></thead><tbody>';
  
  let totalClosing = 0;
  
  PRODUCTS.forEach((product, index) => {
    const opening = stockData.openingStock[product.id] || 0;
    const restocking = stockData.restocking[product.id] || 0;
    const sales = stockData.sales[product.id] || 0;
    const transfersOut = stockData.transfersOut[product.id] || 0;
    const creditorReleases = stockData.creditorReleases[product.id] || 0;
    
    const closing = opening + restocking - sales - transfersOut - creditorReleases;
    totalClosing += closing;
    
    html += `<tr>`;
    html += `<td>${index + 1}</td>`;
    html += `<td>${product.name}</td>`;
    html += `<td>${opening}</td>`;
    html += `<td>${restocking}</td>`;
    html += `<td><strong>${closing}</strong></td>`;
    html += `<td>${sales}</td>`;
    html += `<td>${product.salesPrice}</td>`;
    html += `</tr>`;
  });
  
  html += `<tr><td colspan="4"><strong>TOTAL</strong></td><td><strong>${totalClosing}</strong></td><td colspan="2"></td></tr>`;
  html += '</tbody></table>';
  html += '<button type="button" class="add-btn" id="copy-closing-stock" style="margin-top: 15px;">Copy Closing Stock to Clipboard</button>';
  html += '</div>';
  
  // Transaction forms
  html += renderRecordSaleForm();
  html += renderTransfersInForm();
  html += renderTransfersOutForm();
  html += renderFeedsReleasedForm(stockData.creditors || []);
  html += renderCreditSalesForm();
  html += renderPrepaymentsForm();
  html += renderDebtPaymentsForm(stockData.debtors || []);
  
  // Display recorded transactions
  html += renderRecordedTransactions(stockData);
  
  return html;
}

function renderRecordSaleForm() {
  let html = '<div class="form-section">';
  html += '<h3 class="section-title">Record a Sale (Regular Cash Sale)</h3>';
  html += '<div class="form-row">';
  html += '<input type="text" id="sale-client-name" placeholder="Client Name" required>';
  html += '<select id="sale-feed" required><option value="">Select Feed Type</option>';
  PRODUCTS.forEach(p => html += `<option value="${p.id}">${p.name}</option>`);
  html += '</select>';
  html += '<input type="number" id="sale-bags" placeholder="Number of Bags" min="0.1" step="0.1" required>';
  html += '<input type="number" id="sale-price" placeholder="Price" readonly class="greyed-out">';
  html += '<input type="number" id="sale-discount" placeholder="Discount (KSh)" min="0" value="0" required>';
  html += '</div>';
  html += '<button type="button" class="add-btn" id="save-sale">Save Sale</button>';
  html += '<button type="button" class="add-btn secondary-btn" id="add-new-sale">Add New Entry</button>';
  html += '</div>';
  return html;
}

function renderTransfersInForm() {
  let html = '<div class="form-section">';
  html += '<h3 class="section-title">Transfers In (Feeds Received from Other Shops)</h3>';
  html += '<div class="form-row">';
  html += '<select id="transfer-in-feed" required><option value="">Select Feed Type</option>';
  PRODUCTS.forEach(p => html += `<option value="${p.id}">${p.name}</option>`);
  html += '</select>';
  html += '<input type="number" id="transfer-in-bags" placeholder="Number of Bags" min="0.1" step="0.1" required>';
  html += '<select id="transfer-in-from" required><option value="">From Shop</option>';
  SHOPS.forEach(s => html += `<option value="${s.id}">${s.name}</option>`);
  html += '</select>';
  html += '</div>';
  html += '<button type="button" class="add-btn" id="save-transfer-in">Save</button>';
  html += '<button type="button" class="add-btn secondary-btn" id="add-new-transfer-in">Add New Entry</button>';
  html += '</div>';
  return html;
}

function renderTransfersOutForm() {
  let html = '<div class="form-section">';
  html += '<h3 class="section-title">Transfers Out (Feeds Sent to Other Shops)</h3>';
  html += '<div class="form-row">';
  html += '<select id="transfer-out-feed" required><option value="">Select Feed Type</option>';
  PRODUCTS.forEach(p => html += `<option value="${p.id}">${p.name}</option>`);
  html += '</select>';
  html += '<input type="number" id="transfer-out-bags" placeholder="Number of Bags" min="0.1" step="0.1" required>';
  html += '<select id="transfer-out-to" required><option value="">To Shop</option>';
  SHOPS.forEach(s => html += `<option value="${s.id}">${s.name}</option>`);
  html += '</select>';
  html += '</div>';
  html += '<button type="button" class="add-btn" id="save-transfer-out">Save</button>';
  html += '<button type="button" class="add-btn secondary-btn" id="add-new-transfer-out">Add New Entry</button>';
  html += '</div>';
  return html;
}

function renderFeedsReleasedForm(creditors) {
  let html = '<div class="form-section">';
  html += '<h3 class="section-title">Feeds Released to Creditors</h3>';
  
  if (creditors.length === 0) {
    html += '<div class="info-message greyed-out">No creditors with prepayments. Add prepayments first.</div>';
  } else {
    html += '<div class="form-row">';
    html += '<select id="release-creditor" required><option value="">Select Creditor</option>';
    creditors.forEach(c => html += `<option value="${c.name}">${c.name}</option>`);
    html += '</select>';
    html += '<select id="release-feed" required><option value="">Select Feed Type</option>';
    PRODUCTS.forEach(p => html += `<option value="${p.id}">${p.name}</option>`);
    html += '</select>';
    html += '<input type="number" id="release-bags" placeholder="Number of Bags" min="0.1" step="0.1" required>';
    html += '</div>';
    html += '<button type="button" class="add-btn" id="save-release">Save</button>';
    html += '<button type="button" class="add-btn secondary-btn" id="add-new-release">Add New Entry</button>';
  }
  
  html += '</div>';
  return html;
}

function renderCreditSalesForm() {
  let html = '<div class="form-section">';
  html += '<h3 class="section-title">Sales Made on Credit</h3>';
  html += '<div class="form-row">';
  html += '<input type="text" id="credit-debtor-name" placeholder="Debtor Name" required>';
  html += '<select id="credit-feed" required><option value="">Select Feed Type</option>';
  PRODUCTS.forEach(p => html += `<option value="${p.id}">${p.name}</option>`);
  html += '</select>';
  html += '<input type="number" id="credit-bags" placeholder="Number of Bags" min="0.1" step="0.1" required>';
  html += '<input type="number" id="credit-price" placeholder="Price" readonly class="greyed-out">';
  html += '<input type="number" id="credit-discount" placeholder="Discount (KSh)" min="0" value="0" required>';
  html += '</div>';
  html += '<button type="button" class="add-btn" id="save-credit-sale">Save</button>';
  html += '<button type="button" class="add-btn secondary-btn" id="add-new-credit-sale">Add New Entry</button>';
  html += '</div>';
  return html;
}

function renderPrepaymentsForm() {
  let html = '<div class="form-section">';
  html += '<h3 class="section-title">Prepayments Made</h3>';
  html += '<div class="form-row">';
  html += '<input type="text" id="prepay-client-name" placeholder="Client Name" required>';
  html += '<input type="number" id="prepay-amount" placeholder="Amount Paid (KSh)" min="1" required>';
  html += '</div>';
  html += '<button type="button" class="add-btn" id="save-prepay">Save</button>';
  html += '<button type="button" class="add-btn secondary-btn" id="add-new-prepay">Add New Entry</button>';
  html += '</div>';
  return html;
}

function renderDebtPaymentsForm(debtors) {
  let html = '<div class="form-section">';
  html += '<h3 class="section-title">Payments Made Towards Debts</h3>';
  
  if (debtors.length === 0) {
    html += '<div class="info-message greyed-out">No debtors. Add credit sales first.</div>';
  } else {
    html += '<div class="form-row">';
    html += '<select id="debt-debtor-name" required><option value="">Select Debtor</option>';
    debtors.forEach(d => html += `<option value="${d.name}">${d.name}</option>`);
    html += '</select>';
    html += '<input type="number" id="debt-amount" placeholder="Amount Paid (KSh)" min="1" required>';
    html += '<select id="debt-method" required><option value="">Payment Method</option>';
    html += '<option value="Cash">Cash</option><option value="M-Pesa">M-Pesa</option><option value="Bank">Bank</option>';
    html += '</select>';
    html += '</div>';
    html += '<button type="button" class="add-btn" id="save-debt-payment">Save</button>';
    html += '<button type="button" class="add-btn secondary-btn" id="add-new-debt-payment">Add New Entry</button>';
  }
  
  html += '</div>';
  return html;
}

function renderRecordedTransactions(stockData) {
  let html = '<div class="summary-card"><h2>Recorded Transactions Today</h2>';
  
  // Regular sales
  if (stockData.regularSales && stockData.regularSales.length > 0) {
    html += '<h3 style="margin-top: 20px; color: #2e7d32;">Regular Sales</h3><table>';
    html += '<thead><tr><th>Client</th><th>Feed</th><th>Bags</th><th>Price</th><th>Discount</th><th>Total</th></tr></thead><tbody>';
    stockData.regularSales.forEach(sale => {
      const total = (sale.bags * sale.price) - sale.discount;
      html += `<tr><td>${sale.clientName}</td><td>${sale.feedName}</td><td>${sale.bags}</td><td>${sale.price}</td><td>${sale.discount}</td><td>${total.toLocaleString()}</td></tr>`;
    });
    html += '</tbody></table>';
  }
  
  // Credit sales
  if (stockData.creditSales && stockData.creditSales.length > 0) {
    html += '<h3 style="margin-top: 20px; color: #2e7d32;">Credit Sales</h3><table>';
    html += '<thead><tr><th>Debtor</th><th>Feed</th><th>Bags</th><th>Price</th><th>Discount</th><th>Total</th></tr></thead><tbody>';
    stockData.creditSales.forEach(sale => {
      const total = (sale.bags * sale.price) - sale.discount;
      html += `<tr><td>${sale.debtorName}</td><td>${sale.feedName}</td><td>${sale.bags}</td><td>${sale.price}</td><td>${sale.discount}</td><td>${total.toLocaleString()}</td></tr>`;
    });
    html += '</tbody></table>';
  }
  
  html += '</div>';
  return html;
}
// app.js - FINAL PART 3 OF 4
// Paste Part 4 directly after this

function setupAttendantFormListeners(shopId, date) {
  // Copy closing stock button
  document.getElementById('copy-closing-stock')?.addEventListener('click', () => copyClosingStockToClipboard(shopId, date));
  
  // Regular sale form
  document.getElementById('sale-feed')?.addEventListener('change', (e) => {
    const product = PRODUCTS.find(p => p.id === e.target.value);
    if (product) {
      document.getElementById('sale-price').value = product.salesPrice;
    }
  });
  
  document.getElementById('save-sale')?.addEventListener('click', () => saveRegularSale(shopId, date));
  document.getElementById('add-new-sale')?.addEventListener('click', clearRegularSaleForm);
  
  // Transfer in form
  document.getElementById('save-transfer-in')?.addEventListener('click', () => saveTransferIn(shopId, date));
  document.getElementById('add-new-transfer-in')?.addEventListener('click', clearTransferInForm);
  
  // Transfer out form
  document.getElementById('save-transfer-out')?.addEventListener('click', () => saveTransferOut(shopId, date));
  document.getElementById('add-new-transfer-out')?.addEventListener('click', clearTransferOutForm);
  
  // Feeds released form
  document.getElementById('save-release')?.addEventListener('click', () => saveFeedRelease(shopId, date));
  document.getElementById('add-new-release')?.addEventListener('click', clearFeedReleaseForm);
  
  // Credit sale form
  document.getElementById('credit-feed')?.addEventListener('change', (e) => {
    const product = PRODUCTS.find(p => p.id === e.target.value);
    if (product) {
      document.getElementById('credit-price').value = product.salesPrice;
    }
  });
  
  document.getElementById('save-credit-sale')?.addEventListener('click', () => saveCreditSale(shopId, date));
  document.getElementById('add-new-credit-sale')?.addEventListener('click', clearCreditSaleForm);
  
  // Prepayment form
  document.getElementById('save-prepay')?.addEventListener('click', () => savePrepayment(shopId, date));
  document.getElementById('add-new-prepay')?.addEventListener('click', clearPrepaymentForm);
  
  // Debt payment form
  document.getElementById('save-debt-payment')?.addEventListener('click', () => saveDebtPayment(shopId, date));
  document.getElementById('add-new-debt-payment')?.addEventListener('click', clearDebtPaymentForm);
}

// Copy closing stock to clipboard
async function copyClosingStockToClipboard(shopId, date) {
  const stockData = await getShopStock(shopId, date);
  
  const dateObj = new Date(date);
  const day = dateObj.getDate();
  const month = dateObj.toLocaleDateString('en-GB', { month: 'long' });
  const year = dateObj.getFullYear();
  const suffix = day % 10 === 1 && day !== 11 ? 'st' : day % 10 === 2 && day !== 12 ? 'nd' : day % 10 === 3 && day !== 13 ? 'rd' : 'th';
  const formattedDate = `${day}${suffix} ${month} ${year}`;
  
  let text = `Closing Stock as at ${formattedDate}\n`;
  let totalBags = 0;
  
  PRODUCTS.forEach(product => {
    const opening = stockData.openingStock[product.id] || 0;
    const restocking = stockData.restocking[product.id] || 0;
    const sales = stockData.sales[product.id] || 0;
    const transfersOut = stockData.transfersOut[product.id] || 0;
    const creditorReleases = stockData.creditorReleases[product.id] || 0;
    
    const closing = opening + restocking - sales - transfersOut - creditorReleases;
    totalBags += closing;
    
    text += `${product.name} - ${closing} bags\n`;
  });
  
  text += `\nTotal bags - ${totalBags} bags`;
  
  try {
    await navigator.clipboard.writeText(text);
    showToast('Closing stock copied to clipboard!');
  } catch (error) {
    showToast('Failed to copy to clipboard');
  }
}

// Save regular sale
async function saveRegularSale(shopId, date) {
  const clientName = document.getElementById('sale-client-name').value;
  const feedId = document.getElementById('sale-feed').value;
  const bags = parseFloat(document.getElementById('sale-bags').value);
  const discount = parseFloat(document.getElementById('sale-discount').value);
  
  if (!clientName || !feedId || !bags || discount === null || discount === undefined) {
    showToast('Please fill all fields including discount (0 if none)');
    return;
  }
  
  const product = PRODUCTS.find(p => p.id === feedId);
  
  try {
    await addDoc(collection(db, 'shops', shopId, 'daily', date, 'regularSales'), {
      clientName: clientName,
      feed: feedId,
      feedName: product.name,
      bags: bags,
      price: product.salesPrice,
      discount: discount,
      createdAt: Timestamp.now()
    });
    
    showToast('Sale saved!');
    clearRegularSaleForm();
    loadShopData(shopId, date);
  } catch (error) {
    showToast('Error: ' + error.message);
  }
}

function clearRegularSaleForm() {
  document.getElementById('sale-client-name').value = '';
  document.getElementById('sale-feed').value = '';
  document.getElementById('sale-bags').value = '';
  document.getElementById('sale-price').value = '';
  document.getElementById('sale-discount').value = '0';
}

// Save transfer in
async function saveTransferIn(shopId, date) {
  const feedId = document.getElementById('transfer-in-feed').value;
  const bags = parseFloat(document.getElementById('transfer-in-bags').value);
  const fromShop = document.getElementById('transfer-in-from').value;
  
  if (!feedId || !bags || !fromShop) {
    showToast('Please fill all fields');
    return;
  }
  
  const product = PRODUCTS.find(p => p.id === feedId);
  const shop = SHOPS.find(s => s.id === fromShop);
  
  try {
    await addDoc(collection(db, 'shops', shopId, 'daily', date, 'transfersIn'), {
      feed: feedId,
      feedName: product.name,
      bags: bags,
      fromShop: fromShop,
      fromShopName: shop.name,
      createdAt: Timestamp.now()
    });
    
    showToast('Transfer recorded!');
    clearTransferInForm();
    loadShopData(shopId, date);
  } catch (error) {
    showToast('Error: ' + error.message);
  }
}

function clearTransferInForm() {
  document.getElementById('transfer-in-feed').value = '';
  document.getElementById('transfer-in-bags').value = '';
  document.getElementById('transfer-in-from').value = '';
}

// Save transfer out
async function saveTransferOut(shopId, date) {
  const feedId = document.getElementById('transfer-out-feed').value;
  const bags = parseFloat(document.getElementById('transfer-out-bags').value);
  const toShop = document.getElementById('transfer-out-to').value;
  
  if (!feedId || !bags || !toShop) {
    showToast('Please fill all fields');
    return;
  }
  
  const product = PRODUCTS.find(p => p.id === feedId);
  const shop = SHOPS.find(s => s.id === toShop);
  
  try {
    await addDoc(collection(db, 'shops', shopId, 'daily', date, 'transfersOut'), {
      feed: feedId,
      feedName: product.name,
      bags: bags,
      toShop: toShop,
      toShopName: shop.name,
      createdAt: Timestamp.now()
    });
    
    showToast('Transfer recorded!');
    clearTransferOutForm();
    loadShopData(shopId, date);
  } catch (error) {
    showToast('Error: ' + error.message);
  }
}

function clearTransferOutForm() {
  document.getElementById('transfer-out-feed').value = '';
  document.getElementById('transfer-out-bags').value = '';
  document.getElementById('transfer-out-to').value = '';
}

// Save feed release to creditor
async function saveFeedRelease(shopId, date) {
  const creditorName = document.getElementById('release-creditor').value;
  const feedId = document.getElementById('release-feed').value;
  const bags = parseFloat(document.getElementById('release-bags').value);
  
  if (!creditorName || !feedId || !bags) {
    showToast('Please fill all fields');
    return;
  }
  
  const product = PRODUCTS.find(p => p.id === feedId);
  
  try {
    await addDoc(collection(db, 'shops', shopId, 'daily', date, 'creditorReleases'), {
      creditorName: creditorName,
      feed: feedId,
      feedName: product.name,
      bags: bags,
      createdAt: Timestamp.now()
    });
    
    showToast('Feed release recorded!');
    clearFeedReleaseForm();
    loadShopData(shopId, date);
  } catch (error) {
    showToast('Error: ' + error.message);
  }
}

function clearFeedReleaseForm() {
  document.getElementById('release-creditor').value = '';
  document.getElementById('release-feed').value = '';
  document.getElementById('release-bags').value = '';
}

// Save credit sale
async function saveCreditSale(shopId, date) {
  const debtorName = document.getElementById('credit-debtor-name').value;
  const feedId = document.getElementById('credit-feed').value;
  const bags = parseFloat(document.getElementById('credit-bags').value);
  const discount = parseFloat(document.getElementById('credit-discount').value);
  
  if (!debtorName || !feedId || !bags || discount === null || discount === undefined) {
    showToast('Please fill all fields including discount (0 if none)');
    return;
  }
  
  const product = PRODUCTS.find(p => p.id === feedId);
  
  try {
    await addDoc(collection(db, 'shops', shopId, 'daily', date, 'creditSales'), {
      debtorName: debtorName,
      feed: feedId,
      feedName: product.name,
      bags: bags,
      price: product.salesPrice,
      discount: discount,
      createdAt: Timestamp.now()
    });
    
    showToast('Credit sale saved!');
    clearCreditSaleForm();
    loadShopData(shopId, date);
  } catch (error) {
    showToast('Error: ' + error.message);
  }
}

function clearCreditSaleForm() {
  document.getElementById('credit-debtor-name').value = '';
  document.getElementById('credit-feed').value = '';
  document.getElementById('credit-bags').value = '';
  document.getElementById('credit-price').value = '';
  document.getElementById('credit-discount').value = '0';
}

// Save prepayment
async function savePrepayment(shopId, date) {
  const clientName = document.getElementById('prepay-client-name').value;
  const amount = parseFloat(document.getElementById('prepay-amount').value);
  
  if (!clientName || !amount) {
    showToast('Please fill all fields');
    return;
  }
  
  try {
    await addDoc(collection(db, 'shops', shopId, 'daily', date, 'prepayments'), {
      clientName: clientName,
      amount: amount,
      createdAt: Timestamp.now()
    });
    
    showToast('Prepayment saved!');
    clearPrepaymentForm();
    loadShopData(shopId, date);
  } catch (error) {
    showToast('Error: ' + error.message);
  }
}

function clearPrepaymentForm() {
  document.getElementById('prepay-client-name').value = '';
  document.getElementById('prepay-amount').value = '';
}

// Save debt payment
async function saveDebtPayment(shopId, date) {
  const debtorName = document.getElementById('debt-debtor-name').value;
  const amount = parseFloat(document.getElementById('debt-amount').value);
  const method = document.getElementById('debt-method').value;
  
  if (!debtorName || !amount || !method) {
    showToast('Please fill all fields');
    return;
  }
  
  try {
    await addDoc(collection(db, 'shops', shopId, 'daily', date, 'debtPayments'), {
      debtorName: debtorName,
      amount: amount,
      method: method,
      createdAt: Timestamp.now()
    });
    
    showToast('Debt payment saved!');
    clearDebtPaymentForm();
    loadShopData(shopId, date);
  } catch (error) {
    showToast('Error: ' + error.message);
  }
}

function clearDebtPaymentForm() {
  document.getElementById('debt-debtor-name').value = '';
  document.getElementById('debt-amount').value = '';
  document.getElementById('debt-method').value = '';
}

// Get shop stock data
async function getShopStock(shopId, date) {
  const data = {
    openingStock: {},
    restocking: {},
    closingStock: {},
    sales: {},
    transfersOut: {},
    creditorReleases: {},
    regularSales: [],
    creditSales: [],
    prepayments: [],
    debtPayments: [],
    transfersIn: [],
    transfersOutList: [],
    creditorReleasesList: [],
    debtors: [],
    creditors: []
  };
  
  // Get yesterday's closing stock for opening stock
  const yesterday = new Date(date);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayDate = yesterday.toISOString().split('T')[0];
  
  const yesterdayRef = doc(db, 'shops', shopId, 'daily', yesterdayDate);
  const yesterdaySnap = await getDoc(yesterdayRef);
  
  if (yesterdaySnap.exists()) {
    const yesterdayData = yesterdaySnap.data();
    // Yesterday's closing becomes today's opening
    PRODUCTS.forEach(product => {
      const opening = yesterdayData.openingStock?.[product.id] || 0;
      const restocking = yesterdayData.restocking?.[product.id] || 0;
      const sales = yesterdayData.sales?.[product.id] || 0;
      const transfersOut = yesterdayData.transfersOut?.[product.id] || 0;
      const creditorReleases = yesterdayData.creditorReleases?.[product.id] || 0;
      
      data.openingStock[product.id] = opening + restocking - sales - transfersOut - creditorReleases;
    });
  }
  
  // Get today's transactions
  // Regular sales
  const regularSalesSnap = await getDocs(collection(db, 'shops', shopId, 'daily', date, 'regularSales'));
  regularSalesSnap.forEach(doc => {
    const saleData = doc.data();
    data.regularSales.push(saleData);
    data.sales[saleData.feed] = (data.sales[saleData.feed] || 0) + saleData.bags;
  });
  
  // Credit sales
  const creditSalesSnap = await getDocs(collection(db, 'shops', shopId, 'daily', date, 'creditSales'));
  creditSalesSnap.forEach(doc => {
    const saleData = doc.data();
    data.creditSales.push(saleData);
    data.sales[saleData.feed] = (data.sales[saleData.feed] || 0) + saleData.bags;
    
    if (!data.debtors.find(d => d.name === saleData.debtorName)) {
      data.debtors.push({ name: saleData.debtorName });
    }
  });
  
  // Transfers in (restocking)
  const transfersInSnap = await getDocs(collection(db, 'shops', shopId, 'daily', date, 'transfersIn'));
  transfersInSnap.forEach(doc => {
    const transferData = doc.data();
    data.transfersIn.push(transferData);
    data.restocking[transferData.feed] = (data.restocking[transferData.feed] || 0) + transferData.bags;
  });
  
  // Transfers out
  const transfersOutSnap = await getDocs(collection(db, 'shops', shopId, 'daily', date, 'transfersOut'));
  transfersOutSnap.forEach(doc => {
    const transferData = doc.data();
    data.transfersOutList.push(transferData);
    data.transfersOut[transferData.feed] = (data.transfersOut[transferData.feed] || 0) + transferData.bags;
  });
  
  // Creditor releases
  const creditorReleasesSnap = await getDocs(collection(db, 'shops', shopId, 'daily', date, 'creditorReleases'));
  creditorReleasesSnap.forEach(doc => {
    const releaseData = doc.data();
    data.creditorReleasesList.push(releaseData);
    data.creditorReleases[releaseData.feed] = (data.creditorReleases[releaseData.feed] || 0) + releaseData.bags;
  });
  
  // Prepayments
  const prepaymentsSnap = await getDocs(collection(db, 'shops', shopId, 'daily', date, 'prepayments'));
  prepaymentsSnap.forEach(doc => {
    const prepayData = doc.data();
    data.prepayments.push(prepayData);
    
    if (!data.creditors.find(c => c.name === prepayData.clientName)) {
      data.creditors.push({ name: prepayData.clientName });
    }
  });
  
  // Debt payments
  const debtPaymentsSnap = await getDocs(collection(db, 'shops', shopId, 'daily', date, 'debtPayments'));
  debtPaymentsSnap.forEach(doc => data.debtPayments.push(doc.data()));
  
  return data;
}
// app.js - FINAL PART 4 OF 4
// This is the final part - includes Manager views, exports, and admin

function renderManagerShopView(shopId, date, stockData) {
  let html = '<div class="summary-card">';
  html += '<h2>Stock Report</h2>';
  html += '<table><thead><tr>';
  html += '<th>#</th><th>Feed Name</th><th>Opening Stock</th><th>Restocking</th><th>Closing Stock</th><th>Bags Sold</th><th>Selling Price</th><th>Sales Total</th>';
  html += '</tr></thead><tbody>';
  
  let totalClosing = 0;
  let totalSales = 0;
  
  PRODUCTS.forEach((product, index) => {
    const opening = stockData.openingStock[product.id] || 0;
    const restocking = stockData.restocking[product.id] || 0;
    const sales = stockData.sales[product.id] || 0;
    const transfersOut = stockData.transfersOut[product.id] || 0;
    const creditorReleases = stockData.creditorReleases[product.id] || 0;
    
    const closing = opening + restocking - sales - transfersOut - creditorReleases;
    const salesTotal = sales * product.salesPrice;
    
    totalClosing += closing;
    totalSales += salesTotal;
    
    html += `<tr>`;
    html += `<td>${index + 1}</td>`;
    html += `<td>${product.name}</td>`;
    html += `<td>${opening}</td>`;
    html += `<td>${restocking}</td>`;
    html += `<td><strong>${closing}</strong></td>`;
    html += `<td>${sales}</td>`;
    html += `<td>${product.salesPrice}</td>`;
    html += `<td>${salesTotal.toLocaleString()}</td>`;
    html += `</tr>`;
  });
  
  html += `<tr><td colspan="4"><strong>TOTAL</strong></td><td><strong>${totalClosing}</strong></td><td colspan="2"></td><td><strong>${totalSales.toLocaleString()}</strong></td></tr>`;
  html += '</tbody></table></div>';
  
  // Show recorded transactions
  if (stockData.regularSales.length > 0 || stockData.creditSales.length > 0) {
    html += '<div class="summary-card"><h2>Transactions</h2>';
    
    if (stockData.regularSales.length > 0) {
      html += '<h3 style="margin-top: 15px; color: #2e7d32;">Regular Sales</h3><table>';
      html += '<thead><tr><th>Client</th><th>Feed</th><th>Bags</th><th>Price</th><th>Discount</th><th>Total</th></tr></thead><tbody>';
      stockData.regularSales.forEach(sale => {
        const total = (sale.bags * sale.price) - sale.discount;
        html += `<tr><td>${sale.clientName}</td><td>${sale.feedName}</td><td>${sale.bags}</td><td>${sale.price}</td><td>${sale.discount}</td><td>${total.toLocaleString()}</td></tr>`;
      });
      html += '</tbody></table>';
    }
    
    if (stockData.creditSales.length > 0) {
      html += '<h3 style="margin-top: 15px; color: #2e7d32;">Credit Sales</h3><table>';
      html += '<thead><tr><th>Debtor</th><th>Feed</th><th>Bags</th><th>Price</th><th>Discount</th><th>Total</th></tr></thead><tbody>';
      stockData.creditSales.forEach(sale => {
        const total = (sale.bags * sale.price) - sale.discount;
        html += `<tr><td>${sale.debtorName}</td><td>${sale.feedName}</td><td>${sale.bags}</td><td>${sale.price}</td><td>${sale.discount}</td><td>${total.toLocaleString()}</td></tr>`;
      });
      html += '</tbody></table>';
    }
    
    html += '</div>';
  }
  
  return html;
}

// Total Sales View
async function showTotalSalesView() {
  hideAllViews();
  document.getElementById('screen-title').textContent = 'Total Sales';
  document.getElementById('back-btn').style.display = 'block';
  document.getElementById('total-sales-view').style.display = 'block';
  
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('sales-date').value = today;
  
  await loadTotalSalesData(today);
}

async function loadTotalSalesData(date) {
  const content = document.getElementById('sales-content');
  
  let html = '<div class="summary-card"><h2>Shop Sales Summary</h2><table>';
  html += '<thead><tr><th>Shop</th><th>Bags Remaining</th><th>Bags Sold</th><th>Total Sales Amount</th></tr></thead><tbody>';
  
  let totalBagsRemaining = 0;
  let totalBagsSold = 0;
  let totalSalesAmount = 0;
  
  for (const shop of SHOPS) {
    const stockData = await getShopStock(shop.id, date);
    let bagsRemaining = 0;
    let bagsSold = 0;
    let salesAmount = 0;
    
    PRODUCTS.forEach(product => {
      const opening = stockData.openingStock[product.id] || 0;
      const restocking = stockData.restocking[product.id] || 0;
      const sales = stockData.sales[product.id] || 0;
      const transfersOut = stockData.transfersOut[product.id] || 0;
      const creditorReleases = stockData.creditorReleases[product.id] || 0;
      
      const closing = opening + restocking - sales - transfersOut - creditorReleases;
      bagsRemaining += closing;
      bagsSold += sales;
      salesAmount += sales * product.salesPrice;
    });
    
    totalBagsRemaining += bagsRemaining;
    totalBagsSold += bagsSold;
    totalSalesAmount += salesAmount;
    
    html += `<tr><td>${shop.name}</td><td>${bagsRemaining}</td><td>${bagsSold}</td><td>KSh ${salesAmount.toLocaleString()}</td></tr>`;
  }
  
  html += `<tr class="breakdown-row total"><td><strong>TOTAL</strong></td><td><strong>${totalBagsRemaining}</strong></td><td><strong>${totalBagsSold}</strong></td><td><strong>KSh ${totalSalesAmount.toLocaleString()}</strong></td></tr>`;
  html += '</tbody></table></div>';
  
  content.innerHTML = html;
}

// Debtors View
async function showDebtorsView() {
  hideAllViews();
  document.getElementById('screen-title').textContent = 'Debtors';
  document.getElementById('back-btn').style.display = 'block';
  document.getElementById('debtors-view').style.display = 'block';
  
  await loadDebtorsData();
}

async function loadDebtorsData() {
  const content = document.getElementById('debtors-content');
  
  let html = '<div class="summary-card"><h2>Debtors List</h2><table>';
  html += '<thead><tr><th>Client</th><th>Feed</th><th>Bags</th><th>Price</th><th>Amount</th><th>Shop</th><th>Date</th></tr></thead><tbody>';
  
  let totalAmount = 0;
  
  for (const shop of SHOPS) {
    const q = query(collection(db, 'shops', shop.id, 'daily'));
    const querySnapshot = await getDocs(q);
    
    for (const dateDoc of querySnapshot.docs) {
      const date = dateDoc.id;
      const creditSalesSnap = await getDocs(collection(db, 'shops', shop.id, 'daily', date, 'creditSales'));
      
      creditSalesSnap.forEach(doc => {
        const sale = doc.data();
        const amount = (sale.bags * sale.price) - sale.discount;
        totalAmount += amount;
        html += `<tr><td>${sale.debtorName}</td><td>${sale.feedName}</td><td>${sale.bags}</td><td>${sale.price}</td><td>${amount.toLocaleString()}</td><td>${shop.name}</td><td>${date}</td></tr>`;
      });
    }
  }
  
  html += `<tr class="breakdown-row total"><td colspan="4"><strong>TOTAL</strong></td><td><strong>${totalAmount.toLocaleString()}</strong></td><td colspan="2"></td></tr>`;
  html += '</tbody></table></div>';
  
  content.innerHTML = html;
}

// Creditors View
async function showCreditorsView() {
  hideAllViews();
  document.getElementById('screen-title').textContent = 'Creditors';
  document.getElementById('back-btn').style.display = 'block';
  document.getElementById('creditors-view').style.display = 'block';
  
  await loadCreditorsData();
}

async function loadCreditorsData() {
  const content = document.getElementById('creditors-content');
  
  let html = '<div class="summary-card"><h2>Creditors List</h2><table>';
  html += '<thead><tr><th>Client</th><th>Amount Prepaid</th><th>Shop</th><th>Date</th></tr></thead><tbody>';
  
  let totalAmount = 0;
  
  for (const shop of SHOPS) {
    const q = query(collection(db, 'shops', shop.id, 'daily'));
    const querySnapshot = await getDocs(q);
    
    for (const dateDoc of querySnapshot.docs) {
      const date = dateDoc.id;
      const prepaymentsSnap = await getDocs(collection(db, 'shops', shop.id, 'daily', date, 'prepayments'));
      
      prepaymentsSnap.forEach(doc => {
        const prepay = doc.data();
        totalAmount += prepay.amount;
        html += `<tr><td>${prepay.clientName}</td><td>${prepay.amount.toLocaleString()}</td><td>${shop.name}</td><td>${date}</td></tr>`;
      });
    }
  }
  
  html += `<tr class="breakdown-row total"><td><strong>TOTAL</strong></td><td><strong>${totalAmount.toLocaleString()}</strong></td><td colspan="2"></td></tr>`;
  html += '</tbody></table></div>';
  
  content.innerHTML = html;
}

// Stock Value View
async function showStockValueView() {
  hideAllViews();
  document.getElementById('screen-title').textContent = 'Stock Value';
  document.getElementById('back-btn').style.display = 'block';
  document.getElementById('stock-value-view').style.display = 'block';
  
  await loadStockValueData();
}

async function loadStockValueData() {
  const content = document.getElementById('stock-value-content');
  const today = new Date().toISOString().split('T')[0];
  
  let shopsStockValue = 0;
  let debtorsValue = 0;
  let creditorsValue = 0;
  
  let html = '<div class="summary-card"><h2>Stock Value Summary</h2><table>';
  html += '<thead><tr><th>Shop</th><th>Bags</th><th>Value</th></tr></thead><tbody>';
  
  for (const shop of SHOPS) {
    const stockData = await getShopStock(shop.id, today);
    let value = 0;
    let bags = 0;
    
    PRODUCTS.forEach(product => {
      const opening = stockData.openingStock[product.id] || 0;
      const restocking = stockData.restocking[product.id] || 0;
      const sales = stockData.sales[product.id] || 0;
      const transfersOut = stockData.transfersOut[product.id] || 0;
      const creditorReleases = stockData.creditorReleases[product.id] || 0;
      
      const closing = opening + restocking - sales - transfersOut - creditorReleases;
      bags += closing;
      value += closing * product.costPrice;
    });
    
    shopsStockValue += value;
    
    html += `<tr><td>${shop.name}</td><td>${bags}</td><td>${value.toLocaleString()}</td></tr>`;
  }
  
  html += `<tr class="breakdown-row total"><td><strong>TOTAL SHOPS STOCK</strong></td><td></td><td><strong>${shopsStockValue.toLocaleString()}</strong></td></tr>`;
  html += '</tbody></table></div>';
  
  // Calculate debtors and creditors
  for (const shop of SHOPS) {
    const q = query(collection(db, 'shops', shop.id, 'daily'));
    const querySnapshot = await getDocs(q);
    
    for (const dateDoc of querySnapshot.docs) {
      const date = dateDoc.id;
      
      const creditSalesSnap = await getDocs(collection(db, 'shops', shop.id, 'daily', date, 'creditSales'));
      creditSalesSnap.forEach(doc => {
        const sale = doc.data();
        debtorsValue += (sale.bags * sale.price) - sale.discount;
      });
      
      const prepaymentsSnap = await getDocs(collection(db, 'shops', shop.id, 'daily', date, 'prepayments'));
      prepaymentsSnap.forEach(doc => {
        const prepay = doc.data();
        creditorsValue += prepay.amount;
      });
    }
  }
  
  const netStockValue = shopsStockValue + debtorsValue - creditorsValue;
  
  html += '<div class="summary-card"><h2>Financial Breakdown</h2>';
  html += '<div class="breakdown-row"><span>Debtors Value (Money owed to us):</span><span class="breakdown-value">KSh ' + debtorsValue.toLocaleString() + '</span></div>';
  html += '<div class="breakdown-row"><span>Shops Stock Value (Physical stock):</span><span class="breakdown-value">KSh ' + shopsStockValue.toLocaleString() + '</span></div>';
  html += '<div class="breakdown-row"><span>Creditors Value (Feeds we owe):</span><span class="breakdown-value negative">KSh ' + creditorsValue.toLocaleString() + '</span></div>';
  html += '<div class="formula-display">Net Stock Value = Stock in Shops + Debtors - Creditors</div>';
  html += '<div class="breakdown-row total"><span>Net Stock Value:</span><span class="breakdown-value">KSh ' + netStockValue.toLocaleString() + '</span></div>';
  html += '</div>';
  
  content.innerHTML = html;
}

// Products View
async function showProductsView() {
  hideAllViews();
  document.getElementById('screen-title').textContent = 'Products';
  document.getElementById('back-btn').style.display = 'block';
  document.getElementById('products-view').style.display = 'block';
  
  await loadProductsData();
}

async function loadProductsData() {
  const content = document.getElementById('products-content');
  const canEdit = currentUserData.role === 'manager_full';
  
  let html = '<div class="summary-card"><h2>Product Prices</h2><table>';
  html += '<thead><tr><th>Product</th><th>Cost Price</th><th>Sales Price</th></tr></thead><tbody>';
  
  PRODUCTS.forEach(product => {
    html += `<tr><td>${product.name}</td>`;
    if (canEdit) {
      html += `<td><input type="number" value="${product.costPrice}" data-product="${product.id}" data-field="cost" class="price-input"></td>`;
      html += `<td><input type="number" value="${product.salesPrice}" data-product="${product.id}" data-field="sales" class="price-input"></td>`;
    } else {
      html += `<td>${product.costPrice}</td><td>${product.salesPrice}</td>`;
    }
    html += `</tr>`;
  });
  
  html += '</tbody></table>';
  
  if (canEdit) {
    html += '<button class="add-btn" id="save-prices">Save Prices</button>';
  }
  
  html += '</div>';
  
  content.innerHTML = html;
  
  if (canEdit) {
    document.getElementById('save-prices').addEventListener('click', savePrices);
  }
}

async function savePrices() {
  const inputs = document.querySelectorAll('.price-input');
  
  inputs.forEach(input => {
    const productId = input.dataset.product;
    const field = input.dataset.field;
    const value = parseInt(input.value);
    
    const product = PRODUCTS.find(p => p.id === productId);
    if (field === 'cost') {
      product.costPrice = value;
    } else {
      product.salesPrice = value;
    }
  });
  
  showToast('Prices updated successfully!');
}

// All Clients View
async function showAllClientsView() {
  hideAllViews();
  document.getElementById('screen-title').textContent = 'All Clients';
  document.getElementById('back-btn').style.display = 'block';
  document.getElementById('all-clients-view').style.display = 'block';
  
  await loadAllClientsData();
}

async function loadAllClientsData() {
  const content = document.getElementById('all-clients-content');
  const shopFilter = document.getElementById('clients-shop-filter').value;
  const dateFilter = document.getElementById('clients-date-filter').value;
  
  let html = '<div class="summary-card"><h2>All Clients</h2><table>';
  html += '<thead><tr><th>Name</th><th>Feed</th><th>Bags</th><th>Amount</th><th>Shop</th><th>Date</th></tr></thead><tbody>';
  
  const shopsToQuery = shopFilter ? [SHOPS.find(s => s.id === shopFilter)] : SHOPS;
  
  for (const shop of shopsToQuery) {
    const dailyQuery = dateFilter 
      ? query(collection(db, 'shops', shop.id, 'daily'), where('__name__', '==', dateFilter))
      : query(collection(db, 'shops', shop.id, 'daily'));
    
    const querySnapshot = await getDocs(dailyQuery);
    
    for (const dateDoc of querySnapshot.docs) {
      const date = dateDoc.id;
      const regularSalesSnap = await getDocs(collection(db, 'shops', shop.id, 'daily', date, 'regularSales'));
      
      regularSalesSnap.forEach(doc => {
        const sale = doc.data();
        const amount = (sale.bags * sale.price) - sale.discount;
        html += `<tr><td>${sale.clientName}</td><td>${sale.feedName}</td><td>${sale.bags}</td><td>${amount.toLocaleString()}</td><td>${shop.name}</td><td>${date}</td></tr>`;
      });
    }
  }
  
  html += '</tbody></table></div>';
  
  content.innerHTML = html;
}

// Admin Panel
async function showAdminPanel() {
  hideAllViews();
  document.getElementById('screen-title').textContent = 'Admin Panel';
  document.getElementById('back-btn').style.display = 'block';
  document.getElementById('admin-panel-view').style.display = 'block';
  
  await loadAdminData();
}

async function loadAdminData() {
  const content = document.getElementById('admin-content');
  
  const usersQuery = query(collection(db, 'users'));
  const usersSnapshot = await getDocs(usersQuery);
  
  let html = '<div class="summary-card"><h2>User Management</h2>';
  
  usersSnapshot.forEach(doc => {
    const user = doc.data();
    const userId = doc.id;
    
    html += `<div class="user-card">`;
    html += `<h3>${user.name}</h3>`;
    html += `<p>Email: ${user.email}</p>`;
    html += `<p>Current Role: ${user.role}</p>`;
    html += `<p>Shop: ${user.shop || 'None'}</p>`;
    html += `<p>Status: ${user.status}</p>`;
    html += `<div class="user-actions">`;
    html += `<select class="role-select" data-user="${userId}">`;
    html += `<option value="manager_full" ${user.role === 'manager_full' ? 'selected' : ''}>Manager (Full Access)</option>`;
    html += `<option value="manager_view" ${user.role === 'manager_view' ? 'selected' : ''}>Manager (View Only)</option>`;
    html += `<option value="attendant" ${user.role === 'attendant' ? 'selected' : ''}>Attendant</option>`;
    html += `<option value="pending" ${user.role === 'pending' ? 'selected' : ''}>Pending</option>`;
    html += `</select>`;
    html += `<select class="shop-select" data-user="${userId}">`;
    html += `<option value="">No Shop</option>`;
    SHOPS.forEach(shop => {
      html += `<option value="${shop.id}" ${user.shop === shop.id ? 'selected' : ''}>${shop.name}</option>`;
    });
    html += `</select>`;
    html += `<button class="save-btn" data-user="${userId}">Save</button>`;
    html += `<button class="remove-btn" data-user="${userId}">Remove</button>`;
    html += `</div></div>`;
  });
  
  html += '</div>';
  
  content.innerHTML = html;
  
  document.querySelectorAll('.save-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const userId = e.target.dataset.user;
      const role = document.querySelector(`.role-select[data-user="${userId}"]`).value;
      const shop = document.querySelector(`.shop-select[data-user="${userId}"]`).value;
      
      await updateDoc(doc(db, 'users', userId), {
        role: role,
        shop: shop || null,
        status: role === 'pending' ? 'pending' : 'active'
      });
      
      showToast('User updated!');
      loadAdminData();
    });
  });
  
  document.querySelectorAll('.remove-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const userId = e.target.dataset.user;
      
      if (confirm('Are you sure you want to remove this user?')) {
        await deleteDoc(doc(db, 'users', userId));
        showToast('User removed!');
        loadAdminData();
      }
    });
  });
}

// Export functions will continue in a separate message due to length...
// ADD THIS TO THE END OF APP.JS PART 4

// Helper function for date formatting
function formatDateForPDF(dateString) {
  const date = new Date(dateString);
  const day = date.getDate();
  const month = date.toLocaleString('en-US', { month: 'short' }).toUpperCase();
  const year = date.getFullYear();
  
  let suffix = 'th';
  if (day === 1 || day === 21 || day === 31) suffix = 'st';
  else if (day === 2 || day === 22) suffix = 'nd';
  else if (day === 3 || day === 23) suffix = 'rd';
  
  return `${day}${suffix} ${month} ${year}`;
}

// Export Doc1 - Stock Report
async function exportDoc1PDF() {
  const date = document.getElementById('sales-date').value;
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF();
  
  const formattedDate = formatDateForPDF(date);
  
  let yPosition = 15;
  
  for (const shop of SHOPS) {
    if (yPosition > 250) {
      pdf.addPage();
      yPosition = 20;
    }
    
    const stockData = await getShopStock(shop.id, date);
    
    pdf.setFontSize(14);
    pdf.setFont(undefined, 'bold');
    pdf.text(shop.name.toUpperCase() + ' SHOP', 105, yPosition, { align: 'center' });
    yPosition += 7;
    pdf.setFontSize(12);
    pdf.text(formattedDate, 105, yPosition, { align: 'center' });
    yPosition += 5;
    pdf.setFont(undefined, 'normal');
    pdf.setFontSize(11);
    pdf.text('TOTAL STOCK VALUE AND SALES', 105, yPosition, { align: 'center' });
    yPosition += 10;
    
    const tableData = [];
    let totalOpeningBags = 0;
    let totalClosingBags = 0;
    let totalSales = 0;
    let totalStockValue = 0;
    
    PRODUCTS.forEach((product, index) => {
      const opening = stockData.openingStock[product.id] || 0;
      const restocking = stockData.restocking[product.id] || 0;
      const sales = stockData.sales[product.id] || 0;
      const transfersOut = stockData.transfersOut[product.id] || 0;
      const creditorReleases = stockData.creditorReleases[product.id] || 0;
      
      const closing = opening + restocking - sales - transfersOut - creditorReleases;
      const salesAmt = sales * product.salesPrice;
      const stockValue = closing * product.costPrice;
      
      totalOpeningBags += opening;
      totalClosingBags += closing;
      totalSales += salesAmt;
      totalStockValue += stockValue;
      
      tableData.push([
        index + 1,
        product.name,
        opening,
        closing,
        product.costPrice,
        product.salesPrice,
        sales,
        salesAmt.toLocaleString(),
        stockValue.toLocaleString()
      ]);
    });
    
    tableData.push([
      '', 'TOTAL', totalOpeningBags, totalClosingBags, '', '', '', 
      totalSales.toLocaleString(), totalStockValue.toLocaleString()
    ]);
    
    pdf.autoTable({
      startY: yPosition,
      head: [['#', 'Product', 'Opening', 'Closing', 'Cost', 'Sales', 'Sales Qty', 'Sales Amt', 'Stock Value']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [46, 125, 50], fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      columnStyles: {
        0: { cellWidth: 8 },
        1: { cellWidth: 30 },
        2: { cellWidth: 18 },
        3: { cellWidth: 18 },
        4: { cellWidth: 18 },
        5: { cellWidth: 18 },
        6: { cellWidth: 18 },
        7: { cellWidth: 25 },
        8: { cellWidth: 28 }
      }
    });
    
    yPosition = pdf.lastAutoTable.finalY + 15;
  }
  
  // Summary page
  pdf.addPage();
  pdf.setFontSize(14);
  pdf.setFont(undefined, 'bold');
  pdf.text('SHOPS SUMMARY TOTALS', 105, 15, { align: 'center' });
  pdf.setFontSize(12);
  pdf.text(`SHOPS TOTALS ${formattedDate}`, 105, 23, { align: 'center' });
  
  yPosition = 35;
  
  const summaryData = [];
  let grandTotalBags = 0;
  let grandTotalSold = 0;
  let grandTotalSales = 0;
  
  let shopIndex = 1;
  for (const shop of SHOPS) {
    const stockData = await getShopStock(shop.id, date);
    let totalBags = 0;
    let totalSold = 0;
    let totalSalesAmt = 0;
    
    PRODUCTS.forEach(product => {
      const opening = stockData.openingStock[product.id] || 0;
      const restocking = stockData.restocking[product.id] || 0;
      const sales = stockData.sales[product.id] || 0;
      const transfersOut = stockData.transfersOut[product.id] || 0;
      const creditorReleases = stockData.creditorReleases[product.id] || 0;
      
      const closing = opening + restocking - sales - transfersOut - creditorReleases;
      totalBags += closing;
      totalSold += sales;
      totalSalesAmt += sales * product.salesPrice;
    });
    
    grandTotalBags += totalBags;
    grandTotalSold += totalSold;
    grandTotalSales += totalSalesAmt;
    
    const dateFormatted = new Date(date).toLocaleDateString('en-GB');
    summaryData.push([shopIndex, dateFormatted, shop.name, totalBags, totalSold, totalSalesAmt.toLocaleString()]);
    shopIndex++;
  }
  
  summaryData.push(['', '', 'TOTAL SALES', '', '', grandTotalSales.toLocaleString()]);
  
  pdf.autoTable({
    startY: yPosition,
    head: [['INDEX', 'DATE', 'SHOP', 'BAGS', 'BAGS SOLD', 'SALES AMOUNT']],
    body: summaryData,
    theme: 'grid',
    headStyles: { fillColor: [46, 125, 50] }
  });
  
  pdf.save(`YFarmers Stock Report as at ${formattedDate}.pdf`);
  showToast('Report exported successfully!');
}

// Export Doc2 - Stock Value Book
async function exportDoc2PDF() {
  const date = document.getElementById('sales-date').value;
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF();
  
  const formattedDate = formatDateForPDF(date);
  
  // PAGE 1: Total Sales
  pdf.setFontSize(16);
  pdf.setFont(undefined, 'bold');
  pdf.text('YOUNG FARMERS AGENCIES LTD', 105, 15, { align: 'center' });
  pdf.setFontSize(12);
  pdf.text(`TOTAL SALES AS AT ${formattedDate}`, 105, 23, { align: 'center' });
  
  let yPosition = 35;
  
  const salesData = [];
  let totalSalesAmount = 0;
  
  let shopIndex = 1;
  for (const shop of SHOPS) {
    const stockData = await getShopStock(shop.id, date);
    let bags = 0;
    let bagsSold = 0;
    let sales = 0;
    
    PRODUCTS.forEach(product => {
      const opening = stockData.openingStock[product.id] || 0;
      const restocking = stockData.restocking[product.id] || 0;
      const soldQty = stockData.sales[product.id] || 0;
      const transfersOut = stockData.transfersOut[product.id] || 0;
      const creditorReleases = stockData.creditorReleases[product.id] || 0;
      
      const closing = opening + restocking - soldQty - transfersOut - creditorReleases;
      bags += closing;
      bagsSold += soldQty;
      sales += soldQty * product.salesPrice;
    });
    
    totalSalesAmount += sales;
    const dateFormatted = new Date(date).toLocaleDateString('en-GB');
    salesData.push([shopIndex, dateFormatted, shop.name, bags, bagsSold, sales.toLocaleString()]);
    shopIndex++;
  }
  
  salesData.push(['', '', 'TOTAL', '', '', totalSalesAmount.toLocaleString()]);
  
  pdf.autoTable({
    startY: yPosition,
    head: [['INDEX', 'DATE', 'SHOP', 'BAGS', 'BAGS SOLD', 'SALES AMOUNT']],
    body: salesData,
    theme: 'grid',
    headStyles: { fillColor: [46, 125, 50] }
  });
  
  // PAGE 2: Debtors
  pdf.addPage();
  pdf.setFontSize(16);
  pdf.setFont(undefined, 'bold');
  pdf.text('YOUNG FARMERS AGENCIES LTD', 105, 15, { align: 'center' });
  pdf.setFontSize(12);
  pdf.text('DEBTORS', 105, 23, { align: 'center' });
  
  yPosition = 35;
  
  const debtorsData = [];
  let totalDebtors = 0;
  
  for (const shop of SHOPS) {
    const q = query(collection(db, 'shops', shop.id, 'daily'));
    const querySnapshot = await getDocs(q);
    
    for (const dateDoc of querySnapshot.docs) {
      const docDate = dateDoc.id;
      const creditSalesSnap = await getDocs(collection(db, 'shops', shop.id, 'daily', docDate, 'creditSales'));
      
      creditSalesSnap.forEach(doc => {
        const sale = doc.data();
        const amount = (sale.bags * sale.price) - sale.discount;
        totalDebtors += amount;
        debtorsData.push([
          sale.debtorName,
          sale.feedName,
          sale.bags,
          sale.price,
          amount.toLocaleString(),
          shop.name,
          docDate
        ]);
      });
    }
  }
  
  if (debtorsData.length > 0) {
    debtorsData.push(['', '', '', 'TOTAL', totalDebtors.toLocaleString(), '', '']);
    
    pdf.autoTable({
      startY: yPosition,
      head: [['CLIENT', 'FEEDS', 'BAGS', 'PRICE', 'AMOUNT', 'SHOP', 'DATE']],
      body: debtorsData,
      theme: 'grid',
      headStyles: { fillColor: [46, 125, 50] }
    });
  } else {
    pdf.text('No debtors recorded', 14, yPosition);
  }
  
  // PAGE 3: Creditors
  pdf.addPage();
  pdf.setFontSize(16);
  pdf.setFont(undefined, 'bold');
  pdf.text('YOUNG FARMERS AGENCIES LTD', 105, 15, { align: 'center' });
  pdf.setFontSize(12);
  pdf.text('CREDITORS VALUE', 105, 23, { align: 'center' });
  
  yPosition = 35;
  
  const creditorsData = [];
  let totalCreditors = 0;
  
  let creditorIndex = 1;
  for (const shop of SHOPS) {
    const q = query(collection(db, 'shops', shop.id, 'daily'));
    const querySnapshot = await getDocs(q);
    
    for (const dateDoc of querySnapshot.docs) {
      const docDate = dateDoc.id;
      const prepaymentsSnap = await getDocs(collection(db, 'shops', shop.id, 'daily', docDate, 'prepayments'));
      
      prepaymentsSnap.forEach(doc => {
        const prepay = doc.data();
        totalCreditors += prepay.amount;
        const dateFormatted = new Date(docDate).toLocaleDateString('en-GB');
        creditorsData.push([creditorIndex, dateFormatted, shop.name, prepay.clientName, prepay.amount.toLocaleString()]);
        creditorIndex++;
      });
    }
  }
  
  if (creditorsData.length > 0) {
    creditorsData.push(['', '', '', 'TOTAL', totalCreditors.toLocaleString()]);
    
    pdf.autoTable({
      startY: yPosition,
      head: [['INDEX', 'DATE', 'SHOP', 'CLIENT', 'AMOUNT']],
      body: creditorsData,
      theme: 'grid',
      headStyles: { fillColor: [46, 125, 50] }
    });
  } else {
    pdf.text('No creditors recorded', 14, yPosition);
  }
  
  // PAGE 4: Stock Value Summary
  pdf.addPage();
  pdf.setFontSize(16);
  pdf.setFont(undefined, 'bold');
  pdf.text('YOUNG FARMERS AGENCIES LTD', 105, 15, { align: 'center' });
  pdf.setFontSize(12);
  pdf.text(`STOCK VALUE AS AT ${formattedDate}`, 105, 23, { align: 'center' });
  
  yPosition = 35;
  
  const stockValueData = [];
  let totalStockValue = 0;
  
  shopIndex = 1;
  for (const shop of SHOPS) {
    const stockData = await getShopStock(shop.id, date);
    let value = 0;
    let bags = 0;
    
    PRODUCTS.forEach(product => {
      const opening = stockData.openingStock[product.id] || 0;
      const restocking = stockData.restocking[product.id] || 0;
      const sales = stockData.sales[product.id] || 0;
      const transfersOut = stockData.transfersOut[product.id] || 0;
      const creditorReleases = stockData.creditorReleases[product.id] || 0;
      
      const closing = opening + restocking - sales - transfersOut - creditorReleases;
      bags += closing;
      value += closing * product.costPrice;
    });
    
    totalStockValue += value;
    const dateFormatted = new Date(date).toLocaleDateString('en-GB');
    stockValueData.push([shopIndex, dateFormatted, shop.name, bags, value.toLocaleString()]);
    shopIndex++;
  }
  
  stockValueData.push(['', '', 'TOTAL', '', totalStockValue.toLocaleString()]);
  stockValueData.push(['', '', 'DEBTORS VALUE', '', totalDebtors.toLocaleString()]);
  stockValueData.push(['', '', 'CREDITORS VALUE', '', totalCreditors.toLocaleString()]);
  const netValue = totalStockValue + totalDebtors - totalCreditors;
  stockValueData.push(['', '', 'NET VALUE', '', `Ksh ${netValue.toLocaleString()}.00`]);
  
  pdf.autoTable({
    startY: yPosition,
    head: [['INDEX', 'DATE', 'SHOP', 'BAGS', 'VALUE']],
    body: stockValueData,
    theme: 'grid',
    headStyles: { fillColor: [46, 125, 50] }
  });
  
  pdf.save('YFarmers Stock Value Book.pdf');
  showToast('Stock Value Book exported successfully!');
}