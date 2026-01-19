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
  Timestamp
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

function showSplashScreen() {
  const splash = document.getElementById('splash-screen');
  splash.classList.add('active');
  setTimeout(() => {
    splash.classList.remove('active');
  }, 2500);
}

function hideSplashScreen() {
  const splash = document.getElementById('splash-screen');
  splash.classList.remove('active');
}

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

function setupAuthListeners() {
  const authForm = document.getElementById('auth-form');
  const toggleAuth = document.getElementById('toggle-auth');
  const googleSignin = document.getElementById('google-signin');
  
  authForm.addEventListener('submit', handleAuthSubmit);
  toggleAuth.addEventListener('click', toggleAuthMode);
  googleSignin.addEventListener('click', handleGoogleSignin);
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
  console.log('=== GOOGLE SIGN-IN START ===');
  
  try {
    const result = await signInWithPopup(auth, provider);
    const user = result.user;
    console.log('Google auth successful, UID:', user.uid);
    
    const userDocRef = doc(db, 'users', user.uid);
    const userDoc = await getDoc(userDocRef);
    console.log('User doc exists?', userDoc.exists());
    
    if (!userDoc.exists()) {
      console.log('Creating new user document...');
      await createUserDocument(user.uid, user.email, user.displayName || 'User');
      showToast('Account created! Waiting for admin approval.');
      await signOut(auth);
    } else {
      console.log('User already exists, signing in...');
    }
  } catch (error) {
    console.error('❌ Google sign-in error:', error);
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);
    document.getElementById('auth-error').textContent = error.message;
  }
}

async function createUserDocument(uid, email, name) {
  console.log('=== CREATE USER DOCUMENT START ===');
  console.log('UID:', uid);
  console.log('Email:', email);
  console.log('Name:', name);
  
  const isAdmin = email === ADMIN_EMAIL;
  console.log('Is Admin?', isAdmin);
  
  try {
    const userDocRef = doc(db, 'users', uid);
    console.log('Document reference created');
    
    const userData = {
      email: email,
      name: name,
      role: isAdmin ? 'manager_full' : 'pending',
      shop: null,
      status: isAdmin ? 'active' : 'pending',
      createdAt: Timestamp.now()
    };
    console.log('User data prepared:', userData);
    
    console.log('Calling setDoc...');
    const result = await Promise.race([
      setDoc(userDocRef, userData),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout after 10 seconds')), 10000))
    ]);
    console.log('SetDoc result:', result);
    console.log('✅ User document created successfully!');
    return true;
    
  } catch (error) {
    console.error('❌ ERROR creating user document:', error);
    console.error('Error type:', typeof error);
    console.error('Error name:', error.name);
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);
    console.error('Full error:', JSON.stringify(error, null, 2));
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

function setupNavigationListeners() {
  document.getElementById('logout-btn').addEventListener('click', () => {
    signOut(auth);
  });
  
  document.getElementById('back-btn').addEventListener('click', () => {
    showDashboard();
  });
  
  document.querySelectorAll('.shop-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const shopId = btn.dataset.shop;
      showShopView(shopId);
    });
  });
  
  document.getElementById('total-sales-btn').addEventListener('click', showTotalSalesView);
  document.getElementById('debtors-btn').addEventListener('click', showDebtorsView);
  document.getElementById('creditors-btn').addEventListener('click', showCreditorsView);
  document.getElementById('stock-value-btn').addEventListener('click', showStockValueView);
  document.getElementById('products-btn').addEventListener('click', showProductsView);
  document.getElementById('all-clients-btn').addEventListener('click', showAllClientsView);
  document.getElementById('admin-panel-btn').addEventListener('click', showAdminPanel);
  
  document.getElementById('shop-date').addEventListener('change', (e) => {
    if (currentShop) {
      loadShopData(currentShop, e.target.value);
    }
  });
  
  document.getElementById('sales-date').addEventListener('change', (e) => {
    loadTotalSalesData(e.target.value);
  });
  
  document.getElementById('clients-shop-filter').addEventListener('change', loadAllClientsData);
  document.getElementById('clients-date-filter').addEventListener('change', loadAllClientsData);
  
  document.getElementById('export-doc1').addEventListener('click', () => exportPDF('doc1'));
  document.getElementById('export-doc2').addEventListener('click', () => exportPDF('doc2'));
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
    const stock = stockData.stock[product.id] || { closing: 0 };
    html += `<tr><td>${product.name}</td><td>${stock.closing}</td></tr>`;
  });
  
  html += '</tbody></table></div>';
  return html;
}
function renderAttendantView(shopId, date, stockData) {
  let html = '<div class="summary-card">';
  html += '<h2>Closing Stock Update</h2>';
  html += '<form id="closing-stock-form"><table>';
  html += '<thead><tr><th>#</th><th>Feed Name</th><th>Opening Stock</th><th>Closing Stock</th><th>Price</th><th>Discount</th><th>Selling Price</th></tr></thead>';
  html += '<tbody>';
  
  let totalOpening = 0;
  let totalClosing = 0;
  
  PRODUCTS.forEach((product, index) => {
    const stock = stockData.stock[product.id] || { opening: 0, closing: 0, discount: 0 };
    const isFirstTime = !stockData.initialized;
    
    totalOpening += stock.opening;
    
    html += `<tr>`;
    html += `<td>${index + 1}</td>`;
    html += `<td>${product.name}</td>`;
    html += `<td><input type="number" name="opening-${product.id}" value="${stock.opening}" ${isFirstTime ? '' : 'readonly'}></td>`;
    html += `<td><input type="number" name="closing-${product.id}" value="${stock.closing}" min="0" required></td>`;
    html += `<td>${product.salesPrice}</td>`;
    html += `<td><input type="number" name="discount-${product.id}" value="${stock.discount}" min="0"></td>`;
    html += `<td class="selling-price-${product.id}">${product.salesPrice - stock.discount}</td>`;
    html += `</tr>`;
  });
  
  html += `<tr><td colspan="2"><strong>TOTAL</strong></td><td><strong id="total-opening">${totalOpening}</strong></td><td><strong id="total-closing">${totalClosing}</strong></td><td colspan="3"></td></tr>`;
  html += '</tbody></table>';
  html += '<button type="submit" class="add-btn">Save Closing Stock</button>';
  html += '</form></div>';
  
  html += renderCreditSalesForm();
  html += renderPrepaymentsForm();
  html += renderDebtPaymentsForm(stockData.debtors || []);
  html += renderCreditorReleasesForm(stockData.creditors || []);
  html += renderTransfersForm();
  html += renderClientsForm();
  
  return html;
}

function renderCreditSalesForm() {
  let html = '<div class="form-section">';
  html += '<h3 class="section-title">Sales Made on Credit</h3>';
  html += '<div class="form-row">';
  html += '<input type="text" id="debtor-name" placeholder="Debtor Name">';
  html += '<select id="debtor-feed"><option value="">Select Feed</option>';
  PRODUCTS.forEach(p => html += `<option value="${p.id}">${p.name}</option>`);
  html += '</select>';
  html += '<input type="number" id="debtor-bags" placeholder="Number of Bags" min="1">';
  html += '<input type="number" id="debtor-discount" placeholder="Discount (KSh)" min="0" value="0">';
  html += '</div>';
  html += '<button type="button" class="add-btn" id="add-credit-sale">Add New Sale on Credit</button>';
  html += '<div class="item-list" id="credit-sales-list"></div>';
  html += '</div>';
  return html;
}

function renderPrepaymentsForm() {
  let html = '<div class="form-section">';
  html += '<h3 class="section-title">Prepayments Made</h3>';
  html += '<div class="form-row">';
  html += '<input type="text" id="prepayment-name" placeholder="Client Name">';
  html += '<input type="number" id="prepayment-amount" placeholder="Amount Paid (KSh)" min="1">';
  html += '</div>';
  html += '<button type="button" class="add-btn" id="add-prepayment">Add New Prepayment</button>';
  html += '<div class="item-list" id="prepayments-list"></div>';
  html += '</div>';
  return html;
}

function renderDebtPaymentsForm(debtors) {
  let html = '<div class="form-section">';
  html += '<h3 class="section-title">Payments Made Towards Debts</h3>';
  
  if (debtors.length === 0) {
    html += '<div class="info-message greyed-out">No debtors recorded. Please add a credit sale first.</div>';
  } else {
    html += '<div class="form-row">';
    html += '<select id="debt-payment-debtor"><option value="">Select Debtor</option>';
    debtors.forEach(d => html += `<option value="${d.name}">${d.name}</option>`);
    html += '</select>';
    html += '<input type="number" id="debt-payment-amount" placeholder="Amount Paid (KSh)" min="1">';
    html += '</div>';
    html += '<button type="button" class="add-btn" id="add-debt-payment">Add Payment</button>';
    html += '<div class="item-list" id="debt-payments-list"></div>';
  }
  
  html += '</div>';
  return html;
}

function renderCreditorReleasesForm(creditors) {
  let html = '<div class="form-section">';
  html += '<h3 class="section-title">Feeds Released to Creditors</h3>';
  
  if (creditors.length === 0) {
    html += '<div class="info-message greyed-out">No creditors with prepayments.</div>';
  } else {
    html += '<div class="form-row">';
    html += '<select id="creditor-name"><option value="">Select Creditor</option>';
    creditors.forEach(c => html += `<option value="${c.name}">${c.name}</option>`);
    html += '</select>';
    html += '<select id="creditor-feed"><option value="">Select Feed</option>';
    PRODUCTS.forEach(p => html += `<option value="${p.id}">${p.name}</option>`);
    html += '</select>';
    html += '<input type="number" id="creditor-bags" placeholder="Number of Bags" min="1">';
    html += '</div>';
    html += '<button type="button" class="add-btn" id="release-feeds">Release Feeds</button>';
    html += '<div class="item-list" id="creditor-releases-list"></div>';
  }
  
  html += '</div>';
  return html;
}

function renderTransfersForm() {
  let html = '<div class="form-section">';
  html += '<h3 class="section-title">Transfers to Other Shops</h3>';
  html += '<div class="form-row">';
  html += '<select id="transfer-feed"><option value="">Select Feed</option>';
  PRODUCTS.forEach(p => html += `<option value="${p.id}">${p.name}</option>`);
  html += '</select>';
  html += '<input type="number" id="transfer-bags" placeholder="Number of Bags" min="1">';
  html += '<select id="transfer-destination"><option value="">Select Destination Shop</option>';
  SHOPS.forEach(s => html += `<option value="${s.id}">${s.name}</option>`);
  html += '</select>';
  html += '</div>';
  html += '<button type="button" class="add-btn" id="add-transfer">Add Transfer</button>';
  html += '<div class="item-list" id="transfers-list"></div>';
  html += '</div>';
  return html;
}

function renderClientsForm() {
  let html = '<div class="form-section">';
  html += '<h3 class="section-title">Client Details for Regular Sales</h3>';
  html += '<div class="form-row">';
  html += '<input type="text" id="client-name" placeholder="Client Name">';
  html += '<input type="text" id="client-phone" placeholder="Phone Number">';
  html += '<select id="client-feed"><option value="">Select Feed</option>';
  PRODUCTS.forEach(p => html += `<option value="${p.id}">${p.name}</option>`);
  html += '</select>';
  html += '<input type="number" id="client-bags" placeholder="Number of Bags" min="1">';
  html += '<input type="number" id="client-amount" placeholder="Amount Paid (KSh)" min="1">';
  html += '</div>';
  html += '<button type="button" class="add-btn" id="add-client">Add Client</button>';
  html += '<div class="item-list" id="clients-list"></div>';
  html += '</div>';
  return html;
}

function setupAttendantFormListeners(shopId, date) {
  document.getElementById('closing-stock-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    await saveClosingStock(shopId, date, e.target);
  });
  
  PRODUCTS.forEach(product => {
    const discountInput = document.querySelector(`input[name="discount-${product.id}"]`);
    const closingInput = document.querySelector(`input[name="closing-${product.id}"]`);
    
    if (discountInput) {
      discountInput.addEventListener('input', () => {
        const discount = parseInt(discountInput.value) || 0;
        const sellingPrice = product.salesPrice - discount;
        document.querySelector(`.selling-price-${product.id}`).textContent = sellingPrice;
      });
    }
    
    if (closingInput) {
      closingInput.addEventListener('input', updateTotalClosing);
    }
  });
  
  document.getElementById('add-credit-sale')?.addEventListener('click', () => addCreditSale(shopId, date));
  document.getElementById('add-prepayment')?.addEventListener('click', () => addPrepayment(shopId, date));
  document.getElementById('add-debt-payment')?.addEventListener('click', () => addDebtPayment(shopId, date));
  document.getElementById('release-feeds')?.addEventListener('click', () => releaseFeeds(shopId, date));
  document.getElementById('add-transfer')?.addEventListener('click', () => addTransfer(shopId, date));
  document.getElementById('add-client')?.addEventListener('click', () => addClient(shopId, date));
}

function updateTotalClosing() {
  let total = 0;
  PRODUCTS.forEach(product => {
    const input = document.querySelector(`input[name="closing-${product.id}"]`);
    if (input) {
      total += parseInt(input.value) || 0;
    }
  });
  const totalEl = document.getElementById('total-closing');
  if (totalEl) {
    totalEl.textContent = total;
  }
}

async function saveClosingStock(shopId, date, form) {
  const stockData = {};
  const formData = new FormData(form);
  let isFirstTime = false;
  
  PRODUCTS.forEach(product => {
    const opening = parseInt(formData.get(`opening-${product.id}`)) || 0;
    const closing = parseInt(formData.get(`closing-${product.id}`)) || 0;
    const discount = parseInt(formData.get(`discount-${product.id}`)) || 0;
    
    if (opening > 0 && !isFirstTime) {
      isFirstTime = false;
    }
    
    stockData[product.id] = {
      opening: opening,
      closing: closing,
      discount: discount,
      sellingPrice: product.salesPrice - discount
    };
  });
  
  try {
    await setDoc(doc(db, 'shops', shopId, 'daily', date), {
      stock: stockData,
      initialized: true,
      updatedAt: Timestamp.now(),
      updatedBy: currentUser.uid
    }, { merge: true });
    
    showToast('Closing stock saved successfully!');
    loadShopData(shopId, date);
  } catch (error) {
    showToast('Error saving data: ' + error.message);
  }
}

async function addCreditSale(shopId, date) {
  const name = document.getElementById('debtor-name').value;
  const feed = document.getElementById('debtor-feed').value;
  const bags = parseInt(document.getElementById('debtor-bags').value);
  const discount = parseInt(document.getElementById('debtor-discount').value) || 0;
  
  if (!name || !feed || !bags) {
    showToast('Please fill all fields');
    return;
  }
  
  const product = PRODUCTS.find(p => p.id === feed);
  const amount = (product.salesPrice - discount) * bags;
  
  try {
    await addDoc(collection(db, 'shops', shopId, 'daily', date, 'creditSales'), {
      debtorName: name,
      feed: feed,
      feedName: product.name,
      bags: bags,
      discount: discount,
      amount: amount,
      createdAt: Timestamp.now()
    });
    
    showToast('Credit sale added!');
    document.getElementById('debtor-name').value = '';
    document.getElementById('debtor-feed').value = '';
    document.getElementById('debtor-bags').value = '';
    document.getElementById('debtor-discount').value = '0';
    loadShopData(shopId, date);
  } catch (error) {
    showToast('Error: ' + error.message);
  }
}

async function addPrepayment(shopId, date) {
  const name = document.getElementById('prepayment-name').value;
  const amount = parseInt(document.getElementById('prepayment-amount').value);
  
  if (!name || !amount) {
    showToast('Please fill all fields');
    return;
  }
  
  try {
    await addDoc(collection(db, 'shops', shopId, 'daily', date, 'prepayments'), {
      clientName: name,
      amount: amount,
      createdAt: Timestamp.now()
    });
    
    showToast('Prepayment added!');
    document.getElementById('prepayment-name').value = '';
    document.getElementById('prepayment-amount').value = '';
    loadShopData(shopId, date);
  } catch (error) {
    showToast('Error: ' + error.message);
  }
}

async function addDebtPayment(shopId, date) {
  const debtor = document.getElementById('debt-payment-debtor').value;
  const amount = parseInt(document.getElementById('debt-payment-amount').value);
  
  if (!debtor || !amount) {
    showToast('Please fill all fields');
    return;
  }
  
  try {
    await addDoc(collection(db, 'shops', shopId, 'daily', date, 'debtPayments'), {
      debtorName: debtor,
      amount: amount,
      createdAt: Timestamp.now()
    });
    
    showToast('Debt payment recorded!');
    document.getElementById('debt-payment-debtor').value = '';
    document.getElementById('debt-payment-amount').value = '';
    loadShopData(shopId, date);
  } catch (error) {
    showToast('Error: ' + error.message);
  }
}

async function releaseFeeds(shopId, date) {
  const creditor = document.getElementById('creditor-name').value;
  const feed = document.getElementById('creditor-feed').value;
  const bags = parseInt(document.getElementById('creditor-bags').value);
  
  if (!creditor || !feed || !bags) {
    showToast('Please fill all fields');
    return;
  }
  
  const product = PRODUCTS.find(p => p.id === feed);
  
  try {
    await addDoc(collection(db, 'shops', shopId, 'daily', date, 'creditorReleases'), {
      creditorName: creditor,
      feed: feed,
      feedName: product.name,
      bags: bags,
      createdAt: Timestamp.now()
    });
    
    showToast('Feeds released!');
    document.getElementById('creditor-name').value = '';
    document.getElementById('creditor-feed').value = '';
    document.getElementById('creditor-bags').value = '';
    loadShopData(shopId, date);
  } catch (error) {
    showToast('Error: ' + error.message);
  }
}

async function addTransfer(shopId, date) {
  const feed = document.getElementById('transfer-feed').value;
  const bags = parseInt(document.getElementById('transfer-bags').value);
  const destination = document.getElementById('transfer-destination').value;
  
  if (!feed || !bags || !destination) {
    showToast('Please fill all fields');
    return;
  }
  
  const product = PRODUCTS.find(p => p.id === feed);
  
  try {
    await addDoc(collection(db, 'shops', shopId, 'daily', date, 'transfers'), {
      feed: feed,
      feedName: product.name,
      bags: bags,
      destination: destination,
      destinationName: SHOPS.find(s => s.id === destination).name,
      createdAt: Timestamp.now()
    });
    
    showToast('Transfer recorded!');
    document.getElementById('transfer-feed').value = '';
    document.getElementById('transfer-bags').value = '';
    document.getElementById('transfer-destination').value = '';
    loadShopData(shopId, date);
  } catch (error) {
    showToast('Error: ' + error.message);
  }
}

async function addClient(shopId, date) {
  const name = document.getElementById('client-name').value;
  const phone = document.getElementById('client-phone').value;
  const feed = document.getElementById('client-feed').value;
  const bags = parseInt(document.getElementById('client-bags').value);
  const amount = parseInt(document.getElementById('client-amount').value);
  
  if (!name || !phone || !feed || !bags || !amount) {
    showToast('Please fill all fields');
    return;
  }
  
  const product = PRODUCTS.find(p => p.id === feed);
  
  try {
    await addDoc(collection(db, 'shops', shopId, 'daily', date, 'clients'), {
      name: name,
      phone: phone,
      feed: feed,
      feedName: product.name,
      bags: bags,
      amount: amount,
      createdAt: Timestamp.now()
    });
    
    showToast('Client added!');
    document.getElementById('client-name').value = '';
    document.getElementById('client-phone').value = '';
    document.getElementById('client-feed').value = '';
    document.getElementById('client-bags').value = '';
    document.getElementById('client-amount').value = '';
    loadShopData(shopId, date);
  } catch (error) {
    showToast('Error: ' + error.message);
  }
}
function renderManagerShopView(shopId, date, stockData) {
  let html = '<div class="summary-card">';
  html += '<h2>Stock Report</h2>';
  html += '<table>';
  html += '<thead><tr><th>#</th><th>Product</th><th>Opening</th><th>Closing</th><th>Cost Price</th><th>Sales Price</th><th>Sales</th><th>Sales Amt</th><th>Stock Value</th></tr></thead>';
  html += '<tbody>';
  
  let totalSales = 0;
  let totalStockValue = 0;
  
  PRODUCTS.forEach((product, index) => {
    const stock = stockData.stock[product.id] || { opening: 0, closing: 0, discount: 0 };
    const sales = stock.opening - stock.closing;
    const salesAmt = sales * (product.salesPrice - stock.discount);
    const stockValue = stock.closing * product.costPrice;
    
    totalSales += salesAmt;
    totalStockValue += stockValue;
    
    html += `<tr>`;
    html += `<td>${index + 1}</td>`;
    html += `<td>${product.name}</td>`;
    html += `<td>${stock.opening}</td>`;
    html += `<td>${stock.closing}</td>`;
    html += `<td>${product.costPrice}</td>`;
    html += `<td>${product.salesPrice - stock.discount}</td>`;
    html += `<td>${sales}</td>`;
    html += `<td>${salesAmt.toLocaleString()}</td>`;
    html += `<td>${stockValue.toLocaleString()}</td>`;
    html += `</tr>`;
  });
  
  html += `<tr><td colspan="7"><strong>TOTAL</strong></td><td><strong>${totalSales.toLocaleString()}</strong></td><td><strong>${totalStockValue.toLocaleString()}</strong></td></tr>`;
  html += '</tbody></table></div>';
  
  if (stockData.clients && stockData.clients.length > 0) {
    html += '<div class="summary-card"><h2>Clients</h2><table>';
    html += '<thead><tr><th>Name</th><th>Phone</th><th>Feed</th><th>Bags</th><th>Amount</th></tr></thead><tbody>';
    stockData.clients.forEach(client => {
      html += `<tr><td>${client.name}</td><td>${client.phone}</td><td>${client.feedName}</td><td>${client.bags}</td><td>${client.amount.toLocaleString()}</td></tr>`;
    });
    html += '</tbody></table></div>';
  }
  
  if (stockData.creditSales && stockData.creditSales.length > 0) {
    html += '<div class="summary-card"><h2>Credit Sales</h2><table>';
    html += '<thead><tr><th>Debtor</th><th>Feed</th><th>Bags</th><th>Amount</th></tr></thead><tbody>';
    stockData.creditSales.forEach(sale => {
      html += `<tr><td>${sale.debtorName}</td><td>${sale.feedName}</td><td>${sale.bags}</td><td>${sale.amount.toLocaleString()}</td></tr>`;
    });
    html += '</tbody></table></div>';
  }
  
  return html;
}

async function getShopStock(shopId, date) {
  const docRef = doc(db, 'shops', shopId, 'daily', date);
  const docSnap = await getDoc(docRef);
  
  const data = {
    stock: {},
    initialized: false,
    clients: [],
    creditSales: [],
    prepayments: [],
    debtPayments: [],
    creditorReleases: [],
    transfers: [],
    debtors: [],
    creditors: []
  };
  
  if (docSnap.exists()) {
    const docData = docSnap.data();
    data.stock = docData.stock || {};
    data.initialized = docData.initialized || false;
  }
  
  const clientsSnap = await getDocs(collection(db, 'shops', shopId, 'daily', date, 'clients'));
  clientsSnap.forEach(doc => data.clients.push(doc.data()));
  
  const creditSalesSnap = await getDocs(collection(db, 'shops', shopId, 'daily', date, 'creditSales'));
  creditSalesSnap.forEach(doc => {
    const saleData = doc.data();
    data.creditSales.push(saleData);
    if (!data.debtors.find(d => d.name === saleData.debtorName)) {
      data.debtors.push({ name: saleData.debtorName });
    }
  });
  
  const prepaymentsSnap = await getDocs(collection(db, 'shops', shopId, 'daily', date, 'prepayments'));
  prepaymentsSnap.forEach(doc => {
    const prepayData = doc.data();
    data.prepayments.push(prepayData);
    if (!data.creditors.find(c => c.name === prepayData.clientName)) {
      data.creditors.push({ name: prepayData.clientName });
    }
  });
  
  const debtPaymentsSnap = await getDocs(collection(db, 'shops', shopId, 'daily', date, 'debtPayments'));
  debtPaymentsSnap.forEach(doc => data.debtPayments.push(doc.data()));
  
  const creditorReleasesSnap = await getDocs(collection(db, 'shops', shopId, 'daily', date, 'creditorReleases'));
  creditorReleasesSnap.forEach(doc => data.creditorReleases.push(doc.data()));
  
  const transfersSnap = await getDocs(collection(db, 'shops', shopId, 'daily', date, 'transfers'));
  transfersSnap.forEach(doc => data.transfers.push(doc.data()));
  
  return data;
}

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
  html += '<thead><tr><th>Shop</th><th>Bags</th><th>Bags Sold</th><th>Sales Amount</th></tr></thead><tbody>';
  
  let totalBags = 0;
  let totalBagsSold = 0;
  let totalSales = 0;
  
  for (const shop of SHOPS) {
    const stockData = await getShopStock(shop.id, date);
    let bags = 0;
    let bagsSold = 0;
    let sales = 0;
    
    PRODUCTS.forEach(product => {
      const stock = stockData.stock[product.id] || { opening: 0, closing: 0, discount: 0 };
      bags += stock.closing;
      const sold = stock.opening - stock.closing;
      bagsSold += sold;
      sales += sold * (product.salesPrice - stock.discount);
    });
    
    totalBags += bags;
    totalBagsSold += bagsSold;
    totalSales += sales;
    
    html += `<tr><td>${shop.name}</td><td>${bags}</td><td>${bagsSold}</td><td>${sales.toLocaleString()}</td></tr>`;
  }
  
  html += `<tr><td><strong>TOTAL</strong></td><td><strong>${totalBags}</strong></td><td><strong>${totalBagsSold}</strong></td><td><strong>${totalSales.toLocaleString()}</strong></td></tr>`;
  html += '</tbody></table></div>';
  
  content.innerHTML = html;
}

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
        totalAmount += sale.amount;
        html += `<tr><td>${sale.debtorName}</td><td>${sale.feedName}</td><td>${sale.bags}</td><td>${(sale.amount / sale.bags).toFixed(0)}</td><td>${sale.amount.toLocaleString()}</td><td>${shop.name}</td><td>${date}</td></tr>`;
      });
    }
  }
  
  html += `<tr><td colspan="4"><strong>TOTAL</strong></td><td><strong>${totalAmount.toLocaleString()}</strong></td><td colspan="2"></td></tr>`;
  html += '</tbody></table></div>';
  
  content.innerHTML = html;
}

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
  
  html += `<tr><td><strong>TOTAL</strong></td><td><strong>${totalAmount.toLocaleString()}</strong></td><td colspan="2"></td></tr>`;
  html += '</tbody></table></div>';
  
  content.innerHTML = html;
}

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
  
  let html = '<div class="summary-card"><h2>Stock Value Summary</h2><table>';
  html += '<thead><tr><th>Shop</th><th>Bags</th><th>Value</th></tr></thead><tbody>';
  
  let totalValue = 0;
  
  for (const shop of SHOPS) {
    const stockData = await getShopStock(shop.id, today);
    let value = 0;
    let bags = 0;
    
    PRODUCTS.forEach(product => {
      const stock = stockData.stock[product.id] || { closing: 0 };
      bags += stock.closing;
      value += stock.closing * product.costPrice;
    });
    
    totalValue += value;
    
    html += `<tr><td>${shop.name}</td><td>${bags}</td><td>${value.toLocaleString()}</td></tr>`;
  }
  
  html += `<tr><td><strong>TOTAL</strong></td><td></td><td><strong>${totalValue.toLocaleString()}</strong></td></tr>`;
  html += '</tbody></table></div>';
  
  content.innerHTML = html;
}

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
  const updates = {};
  
  inputs.forEach(input => {
    const productId = input.dataset.product;
    const field = input.dataset.field;
    const value = parseInt(input.value);
    
    if (!updates[productId]) {
      updates[productId] = {};
    }
    
    updates[productId][field] = value;
  });
  
  try {
    for (const productId in updates) {
      const product = PRODUCTS.find(p => p.id === productId);
      if (updates[productId].cost) product.costPrice = updates[productId].cost;
      if (updates[productId].sales) product.salesPrice = updates[productId].sales;
    }
    
    showToast('Prices updated successfully!');
  } catch (error) {
    showToast('Error updating prices: ' + error.message);
  }
}

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
  html += '<thead><tr><th>Name</th><th>Phone</th><th>Shop</th><th>Feed</th><th>Bags</th><th>Amount</th><th>Date</th></tr></thead><tbody>';
  
  const shopsToQuery = shopFilter ? [SHOPS.find(s => s.id === shopFilter)] : SHOPS;
  
  for (const shop of shopsToQuery) {
    const dailyQuery = dateFilter 
      ? query(collection(db, 'shops', shop.id, 'daily'), where('__name__', '==', dateFilter))
      : query(collection(db, 'shops', shop.id, 'daily'));
    
    const querySnapshot = await getDocs(dailyQuery);
    
    for (const dateDoc of querySnapshot.docs) {
      const date = dateDoc.id;
      const clientsSnap = await getDocs(collection(db, 'shops', shop.id, 'daily', date, 'clients'));
      
      clientsSnap.forEach(doc => {
        const client = doc.data();
        html += `<tr><td>${client.name}</td><td>${client.phone}</td><td>${shop.name}</td><td>${client.feedName}</td><td>${client.bags}</td><td>${client.amount.toLocaleString()}</td><td>${date}</td></tr>`;
      });
    }
  }
  
  html += '</tbody></table></div>';
  
  content.innerHTML = html;
}

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

function exportPDF(type) {
  showToast(`Exporting ${type.toUpperCase()} PDF - Feature coming soon!`);
}

function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('show');
  
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}