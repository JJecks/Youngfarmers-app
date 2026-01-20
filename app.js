// app.js - Young Farmers Stock Management App - PART 1 OF 3
// Paste Part 2 directly after this on the next line

import { auth, db, googleProvider } from './firebase-config.js';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signInWithPopup,
  signOut,
  onAuthStateChanged 
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import { 
  collection, 
  addDoc, 
  updateDoc,
  deleteDoc,
  doc, 
  getDoc,
  getDocs,
  setDoc,
  query, 
  where,
  orderBy,
  Timestamp,
  onSnapshot,
  writeBatch
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

// Global state
let currentUser = null;
let currentUserData = null;
let currentShop = null;

// Available shops
const SHOPS = [
  'Usigu',
  'Port Victoria',
  'Mbita',
  'Usenge',
  'Lwanda Kotieno',
  'Obambo',
  'Sori'
];

// Products with cost and sales prices
const PRODUCTS = [
  { name: 'Starter Mash', cost: 4240, sales: 4600 },
  { name: 'Samakgro 1MM', cost: 3690, sales: 4150 },
  { name: 'Samakgro 2MM', cost: 3600, sales: 3200 },
  { name: 'Samakgro 3MM', cost: 3200, sales: 2850 },
  { name: 'Samakgro 4MMHP', cost: 2950, sales: 2650 },
  { name: 'Samakgro 4.5MM', cost: 2800, sales: 2500 },
  { name: 'Broodstock', cost: 3900, sales: 3900 }
];

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
  initializeAuthListeners();
  setupEventListeners();
  checkAuthState();
});

// Auth state observer
function checkAuthState() {
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      currentUser = user;
      await loadUserData(user);
    } else {
      currentUser = null;
      currentUserData = null;
      showAuthScreen();
    }
  });
}

// Load user data from Firestore
async function loadUserData(user) {
  try {
    console.log('Loading user data for:', user.uid);
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    
    if (userDoc.exists()) {
      currentUserData = userDoc.data();
      console.log('User data loaded:', currentUserData);
      
      // Check if role is pending
      if (currentUserData.role === 'pending') {
        showPendingApproval();
      } else {
        currentShop = currentUserData.assignedShop;
        showMainApp();
        loadDashboard();
      }
    } else {
      console.log('User document does not exist, showing pending');
      showPendingApproval();
    }
  } catch (error) {
    console.error('Error loading user data:', error);
    showError('Error loading user data: ' + error.message);
  }
}

// Initialize auth listeners
function initializeAuthListeners() {
  // Email login
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', handleEmailLogin);
  }

  // Email signup
  const signupForm = document.getElementById('signup-form');
  if (signupForm) {
    signupForm.addEventListener('submit', handleEmailSignup);
  }

  // Google login
  const googleLoginBtn = document.getElementById('google-login-btn');
  if (googleLoginBtn) {
    googleLoginBtn.addEventListener('click', handleGoogleLogin);
  }

  // Google signup
  const googleSignupBtn = document.getElementById('google-signup-btn');
  if (googleSignupBtn) {
    googleSignupBtn.addEventListener('click', handleGoogleSignup);
  }

  // Logout
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', handleLogout);
  }

  // Toggle between login and signup
  const showSignupLink = document.getElementById('show-signup');
  const showLoginLink = document.getElementById('show-login');
  
  if (showSignupLink) {
    showSignupLink.addEventListener('click', (e) => {
      e.preventDefault();
      document.getElementById('login-container').style.display = 'none';
      document.getElementById('signup-container').style.display = 'block';
    });
  }
  
  if (showLoginLink) {
    showLoginLink.addEventListener('click', (e) => {
      e.preventDefault();
      document.getElementById('signup-container').style.display = 'none';
      document.getElementById('login-container').style.display = 'block';
    });
  }
}

// Handle email login
async function handleEmailLogin(e) {
  e.preventDefault();
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;

  try {
    await signInWithEmailAndPassword(auth, email, password);
    // Auth state observer will handle the rest
  } catch (error) {
    console.error('Login error:', error);
    showError('Login failed: ' + error.message);
  }
}

// Handle email signup - FIXED VERSION
async function handleEmailSignup(e) {
  e.preventDefault();
  const email = document.getElementById('signup-email').value;
  const password = document.getElementById('signup-password').value;
  const name = document.getElementById('signup-name').value;

  console.log('=== STARTING EMAIL SIGNUP ===');
  console.log('Email:', email);
  console.log('Name:', name);

  try {
    // Create auth account
    console.log('Creating auth account...');
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    console.log('Auth account created, UID:', user.uid);

    // Create user document - FIXED APPROACH
    await createUserDocument(user.uid, email, name, false);
    
    console.log('=== SIGNUP COMPLETE ===');
    // Auth state observer will handle the rest
  } catch (error) {
    console.error('=== SIGNUP ERROR ===');
    console.error('Error:', error);
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);
    showError('Signup failed: ' + error.message);
  }
}

// Handle Google login
async function handleGoogleLogin() {
  try {
    await signInWithPopup(auth, googleProvider);
    // Auth state observer will handle the rest
  } catch (error) {
    console.error('Google login error:', error);
    showError('Google login failed: ' + error.message);
  }
}

// Handle Google signup - FIXED VERSION
async function handleGoogleSignup() {
  console.log('=== STARTING GOOGLE SIGNUP ===');
  
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;
    console.log('Google auth complete, UID:', user.uid);
    console.log('Email:', user.email);
    console.log('Display Name:', user.displayName);

    // Check if user document already exists
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    
    if (!userDoc.exists()) {
      console.log('User document does not exist, creating...');
      await createUserDocument(user.uid, user.email, user.displayName, false);
    } else {
      console.log('User document already exists');
    }
    
    console.log('=== GOOGLE SIGNUP COMPLETE ===');
    // Auth state observer will handle the rest
  } catch (error) {
    console.error('=== GOOGLE SIGNUP ERROR ===');
    console.error('Error:', error);
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);
    showError('Google signup failed: ' + error.message);
  }
}

// Create user document in Firestore - COMPLETELY REWRITTEN FIX
async function createUserDocument(uid, email, name, isAdmin = false) {
  console.log('=== CREATE USER DOCUMENT START ===');
  console.log('UID:', uid);
  console.log('Email:', email);
  console.log('Name:', name);
  console.log('Is Admin?', isAdmin);

  try {
    // Check if user is admin
    const adminEmail = 'jeckstom777@gmail.com';
    const shouldBeAdmin = email.toLowerCase() === adminEmail.toLowerCase();
    
    console.log('Should be admin?', shouldBeAdmin);

    // Prepare user data
    const userData = {
      email: email,
      name: name || 'User',
      role: shouldBeAdmin ? 'manager_full' : 'pending',
      assignedShop: shouldBeAdmin ? 'All Shops' : null,
      createdAt: Timestamp.now(),
      lastLogin: Timestamp.now()
    };

    console.log('User data prepared:', userData);
    console.log('Firestore instance:', db);
    console.log('Project ID:', db._databaseId.projectId);

    // Use the simpler doc/setDoc approach with merge
    const userRef = doc(db, 'users', uid);
    console.log('Document reference created');
    console.log('Path:', userRef.path);
    
    // Try setDoc with merge option and no timeout wrapper
    console.log('Calling setDoc with merge...');
    await setDoc(userRef, userData, { merge: true });
    
    console.log('✅ User document created successfully!');
    console.log('=== CREATE USER DOCUMENT END ===');
    
    return true;
  } catch (error) {
    console.error('=== CREATE USER DOCUMENT ERROR ===');
    console.error('Error creating user document:', error);
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    
    // Try alternative approach with addDoc to a subcollection as fallback
    console.log('Attempting fallback method...');
    try {
      await setDoc(doc(db, 'users', uid), {
        email: email,
        name: name || 'User',
        role: email.toLowerCase() === 'jeckstom777@gmail.com' ? 'manager_full' : 'pending',
        assignedShop: email.toLowerCase() === 'jeckstom777@gmail.com' ? 'All Shops' : null,
        createdAt: new Date().toISOString(),
        lastLogin: new Date().toISOString()
      });
      console.log('✅ Fallback method succeeded!');
      return true;
    } catch (fallbackError) {
      console.error('❌ Fallback method also failed:', fallbackError);
      throw error;
    }
  }
}

// Handle logout
async function handleLogout() {
  try {
    await signOut(auth);
    currentUser = null;
    currentUserData = null;
    currentShop = null;
    showAuthScreen();
  } catch (error) {
    console.error('Logout error:', error);
    showError('Logout failed: ' + error.message);
  }
}
// app.js - PART 2 OF 3
// Paste Part 3 directly after this on the next line

// Screen management
function showAuthScreen() {
  document.getElementById('auth-screen').style.display = 'block';
  document.getElementById('pending-screen').style.display = 'none';
  document.getElementById('main-app').style.display = 'none';
  document.getElementById('login-container').style.display = 'block';
  document.getElementById('signup-container').style.display = 'none';
}

function showPendingApproval() {
  document.getElementById('auth-screen').style.display = 'none';
  document.getElementById('pending-screen').style.display = 'block';
  document.getElementById('main-app').style.display = 'none';
}

function showMainApp() {
  document.getElementById('auth-screen').style.display = 'none';
  document.getElementById('pending-screen').style.display = 'none';
  document.getElementById('main-app').style.display = 'block';
  
  // Update user info display
  document.getElementById('user-name').textContent = currentUserData.name;
  document.getElementById('user-role').textContent = formatRole(currentUserData.role);
  document.getElementById('user-shop').textContent = currentUserData.assignedShop || 'N/A';
  
  // Show/hide admin panel based on role
  const adminNavBtn = document.getElementById('admin-nav-btn');
  if (currentUserData.role === 'manager_full') {
    adminNavBtn.style.display = 'block';
  } else {
    adminNavBtn.style.display = 'none';
  }
}

// Format role for display
function formatRole(role) {
  const roleMap = {
    'manager_full': 'Manager (Full Access)',
    'manager_view': 'Manager (View Only)',
    'attendant': 'Attendant',
    'pending': 'Pending Approval'
  };
  return roleMap[role] || role;
}

// Setup event listeners
function setupEventListeners() {
  // Navigation
  document.getElementById('dashboard-nav-btn').addEventListener('click', () => {
    showSection('dashboard-section');
    loadDashboard();
  });
  
  document.getElementById('stock-nav-btn').addEventListener('click', () => {
    showSection('stock-section');
    loadStockPage();
  });
  
  document.getElementById('reports-nav-btn').addEventListener('click', () => {
    showSection('reports-section');
    loadReportsPage();
  });
  
  document.getElementById('stock-value-nav-btn').addEventListener('click', () => {
    showSection('stock-value-section');
    loadStockValuePage();
  });
  
  const adminNavBtn = document.getElementById('admin-nav-btn');
  if (adminNavBtn) {
    adminNavBtn.addEventListener('click', () => {
      showSection('admin-section');
      loadAdminPanel();
    });
  }

  // Shop selector
  document.getElementById('shop-selector').addEventListener('change', (e) => {
    currentShop = e.target.value;
    loadStockPage();
  });

  // Date selector
  document.getElementById('stock-date').addEventListener('change', () => {
    loadStockPage();
  });

  // Add entry buttons
  document.getElementById('add-credit-sale-btn').addEventListener('click', saveCreditSale);
  document.getElementById('add-prepayment-btn').addEventListener('click', savePrepayment);
  document.getElementById('add-debt-payment-btn').addEventListener('click', saveDebtPayment);
  document.getElementById('add-feed-release-btn').addEventListener('click', saveFeedRelease);
  document.getElementById('add-transfer-btn').addEventListener('click', saveTransfer);
  document.getElementById('add-client-btn').addEventListener('click', saveClient);

  // Save stock button
  document.getElementById('save-stock-btn').addEventListener('click', saveStockData);

  // Export buttons
  document.getElementById('export-doc1-btn').addEventListener('click', exportDoc1);
  document.getElementById('export-doc2-btn').addEventListener('click', exportDoc2);
}

// Show section
function showSection(sectionId) {
  const sections = ['dashboard-section', 'stock-section', 'reports-section', 'stock-value-section', 'admin-section'];
  sections.forEach(id => {
    document.getElementById(id).style.display = id === sectionId ? 'block' : 'none';
  });
}

// Load dashboard
async function loadDashboard() {
  try {
    // Get today's date
    const today = new Date().toISOString().split('T')[0];
    
    // Load summary data
    let totalStock = 0;
    let totalSales = 0;
    let totalDebtors = 0;
    let totalCreditors = 0;

    for (const shop of SHOPS) {
      // Check if user has access to this shop
      if (currentUserData.role === 'attendant' && currentUserData.assignedShop !== shop) {
        continue;
      }

      // Get stock data
      const stockRef = doc(db, 'stock', `${shop}_${today}`);
      const stockDoc = await getDoc(stockRef);
      
      if (stockDoc.exists()) {
        const stockData = stockDoc.data();
        
        // Calculate stock value
        PRODUCTS.forEach(product => {
          const closing = stockData.closingStock?.[product.name] || 0;
          totalStock += closing * product.cost;
        });

        // Add cash from regular sales
        totalSales += stockData.totalCash || 0;
      }

      // Get credit sales (debtors)
      const creditQuery = query(
        collection(db, 'creditSales'),
        where('shop', '==', shop),
        where('status', '==', 'pending')
      );
      const creditDocs = await getDocs(creditQuery);
      creditDocs.forEach(doc => {
        const data = doc.data();
        totalDebtors += data.remainingAmount || 0;
      });

      // Get prepayments (creditors)
      const prepayQuery = query(
        collection(db, 'prepayments'),
        where('shop', '==', shop),
        where('status', '==', 'pending')
      );
      const prepayDocs = await getDocs(prepayQuery);
      prepayDocs.forEach(doc => {
        const data = doc.data();
        totalCreditors += data.remainingBags || 0;
      });
    }

    // Update dashboard
    document.getElementById('total-stock').textContent = `KSh ${totalStock.toLocaleString()}`;
    document.getElementById('total-sales').textContent = `KSh ${totalSales.toLocaleString()}`;
    document.getElementById('total-debtors').textContent = `KSh ${totalDebtors.toLocaleString()}`;
    document.getElementById('total-creditors').textContent = `${totalCreditors} bags`;

  } catch (error) {
    console.error('Error loading dashboard:', error);
    showError('Error loading dashboard');
  }
}

// Load stock page
async function loadStockPage() {
  const selectedShop = document.getElementById('shop-selector').value;
  const selectedDate = document.getElementById('stock-date').value;

  if (!selectedShop || !selectedDate) return;

  currentShop = selectedShop;

  // Populate shop selector if needed
  const shopSelector = document.getElementById('shop-selector');
  if (shopSelector.options.length === 1) {
    if (currentUserData.role === 'attendant') {
      // Attendant sees only their shop
      const option = document.createElement('option');
      option.value = currentUserData.assignedShop;
      option.textContent = currentUserData.assignedShop;
      shopSelector.appendChild(option);
      shopSelector.value = currentUserData.assignedShop;
      shopSelector.disabled = true;
    } else {
      // Managers see all shops
      SHOPS.forEach(shop => {
        const option = document.createElement('option');
        option.value = shop;
        option.textContent = shop;
        shopSelector.appendChild(option);
      });
    }
  }

  try {
    // Get stock data
    const stockRef = doc(db, 'stock', `${selectedShop}_${selectedDate}`);
    const stockDoc = await getDoc(stockRef);

    let stockData = {
      openingStock: {},
      restocking: {},
      closingStock: {},
      sales: {},
      totalCash: 0
    };

    if (stockDoc.exists()) {
      stockData = stockDoc.data();
    } else {
      // Get previous day's closing stock for opening stock
      const prevDate = new Date(selectedDate);
      prevDate.setDate(prevDate.getDate() - 1);
      const prevDateStr = prevDate.toISOString().split('T')[0];
      
      const prevStockRef = doc(db, 'stock', `${selectedShop}_${prevDateStr}`);
      const prevStockDoc = await getDoc(prevStockRef);
      
      if (prevStockDoc.exists()) {
        const prevData = prevStockDoc.data();
        PRODUCTS.forEach(product => {
          stockData.openingStock[product.name] = prevData.closingStock?.[product.name] || 0;
        });
      }
    }

    // Render stock table with restocking column
    renderStockTable(stockData);

    // Load transactions
    await loadTransactions(selectedShop, selectedDate);

  } catch (error) {
    console.error('Error loading stock page:', error);
    showError('Error loading stock data');
  }
}

// Render stock table with restocking column
function renderStockTable(stockData) {
  const tbody = document.getElementById('stock-table-body');
  tbody.innerHTML = '';

  let totalCash = 0;

  PRODUCTS.forEach(product => {
    const opening = stockData.openingStock?.[product.name] || 0;
    const restocking = stockData.restocking?.[product.name] || 0;
    const closing = stockData.closingStock?.[product.name] || 0;
    
    // Calculate sales: Sales = Opening + Restocking - Closing
    const sales = opening + restocking - closing;
    const cash = sales * product.sales;
    totalCash += cash;

    const row = document.createElement('tr');
    const isReadOnly = currentUserData.role === 'manager_view';
    
    row.innerHTML = `
      <td>${product.name}</td>
      <td><input type="number" value="${opening}" readonly class="stock-input opening-stock" data-product="${product.name}"></td>
      <td><input type="number" value="${restocking}" ${isReadOnly ? 'readonly' : ''} class="stock-input restocking" data-product="${product.name}" min="0"></td>
      <td><input type="number" value="${closing}" ${isReadOnly ? 'readonly' : ''} class="stock-input closing-stock" data-product="${product.name}" min="0"></td>
      <td class="sales-display">${sales}</td>
      <td class="cash-display">KSh ${cash.toLocaleString()}</td>
    `;
    tbody.appendChild(row);
  });

  // Update total
  document.getElementById('total-cash-display').textContent = `KSh ${totalCash.toLocaleString()}`;

  // Add change listeners to recalculate
  document.querySelectorAll('.restocking, .closing-stock').forEach(input => {
    input.addEventListener('input', recalculateStockTable);
  });
}

// Recalculate stock table
function recalculateStockTable() {
  let totalCash = 0;
  
  PRODUCTS.forEach(product => {
    const openingInput = document.querySelector(`.opening-stock[data-product="${product.name}"]`);
    const restockingInput = document.querySelector(`.restocking[data-product="${product.name}"]`);
    const closingInput = document.querySelector(`.closing-stock[data-product="${product.name}"]`);
    
    const opening = parseFloat(openingInput.value) || 0;
    const restocking = parseFloat(restockingInput.value) || 0;
    const closing = parseFloat(closingInput.value) || 0;
    
    const sales = opening + restocking - closing;
    const cash = sales * product.sales;
    totalCash += cash;
    
    const row = closingInput.closest('tr');
    row.querySelector('.sales-display').textContent = sales;
    row.querySelector('.cash-display').textContent = `KSh ${cash.toLocaleString()}`;
  });
  
  document.getElementById('total-cash-display').textContent = `KSh ${totalCash.toLocaleString()}`;
}

// Save stock data
async function saveStockData() {
  if (currentUserData.role === 'manager_view') {
    showError('You do not have permission to edit stock data');
    return;
  }

  const selectedShop = document.getElementById('shop-selector').value;
  const selectedDate = document.getElementById('stock-date').value;

  if (!selectedShop || !selectedDate) {
    showError('Please select shop and date');
    return;
  }

  try {
    const stockData = {
      shop: selectedShop,
      date: selectedDate,
      openingStock: {},
      restocking: {},
      closingStock: {},
      sales: {},
      totalCash: 0,
      updatedAt: Timestamp.now(),
      updatedBy: currentUser.uid
    };

    let totalCash = 0;

    PRODUCTS.forEach(product => {
      const opening = parseFloat(document.querySelector(`.opening-stock[data-product="${product.name}"]`).value) || 0;
      const restocking = parseFloat(document.querySelector(`.restocking[data-product="${product.name}"]`).value) || 0;
      const closing = parseFloat(document.querySelector(`.closing-stock[data-product="${product.name}"]`).value) || 0;
      
      const sales = opening + restocking - closing;
      const cash = sales * product.sales;

      stockData.openingStock[product.name] = opening;
      stockData.restocking[product.name] = restocking;
      stockData.closingStock[product.name] = closing;
      stockData.sales[product.name] = sales;
      
      totalCash += cash;
    });

    stockData.totalCash = totalCash;

    const stockRef = doc(db, 'stock', `${selectedShop}_${selectedDate}`);
    await setDoc(stockRef, stockData);

    showSuccess('Stock data saved successfully!');
  } catch (error) {
    console.error('Error saving stock data:', error);
    showError('Error saving stock data');
  }
}
// app.js - PART 3 OF 3
// This is the final part

// Load transactions
async function loadTransactions(shop, date) {
  try {
    // Credit sales
    const creditQuery = query(
      collection(db, 'creditSales'),
      where('shop', '==', shop),
      where('date', '==', date)
    );
    const creditDocs = await getDocs(creditQuery);
    renderCreditSales(creditDocs);

    // Prepayments
    const prepayQuery = query(
      collection(db, 'prepayments'),
      where('shop', '==', shop),
      where('date', '==', date)
    );
    const prepayDocs = await getDocs(prepayQuery);
    renderPrepayments(prepayDocs);

    // Debt payments
    const debtQuery = query(
      collection(db, 'debtPayments'),
      where('shop', '==', shop),
      where('date', '==', date)
    );
    const debtDocs = await getDocs(debtQuery);
    renderDebtPayments(debtDocs);

    // Feed releases
    const releaseQuery = query(
      collection(db, 'feedReleases'),
      where('shop', '==', shop),
      where('date', '==', date)
    );
    const releaseDocs = await getDocs(releaseQuery);
    renderFeedReleases(releaseDocs);

    // Transfers
    const transferQuery = query(
      collection(db, 'transfers'),
      where('fromShop', '==', shop),
      where('date', '==', date)
    );
    const transferDocs = await getDocs(transferQuery);
    renderTransfers(transferDocs);

    // Clients
    const clientQuery = query(
      collection(db, 'clients'),
      where('shop', '==', shop),
      where('date', '==', date)
    );
    const clientDocs = await getDocs(clientQuery);
    renderClients(clientDocs);

  } catch (error) {
    console.error('Error loading transactions:', error);
  }
}

// Render functions for each transaction type
function renderCreditSales(docs) {
  const tbody = document.getElementById('credit-sales-list');
  tbody.innerHTML = '';
  docs.forEach(doc => {
    const data = doc.data();
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${data.clientName}</td>
      <td>${data.feedType}</td>
      <td>${data.bags}</td>
      <td>KSh ${data.totalAmount.toLocaleString()}</td>
      <td>KSh ${data.paidAmount.toLocaleString()}</td>
      <td>KSh ${data.remainingAmount.toLocaleString()}</td>
    `;
    tbody.appendChild(row);
  });
}

function renderPrepayments(docs) {
  const tbody = document.getElementById('prepayments-list');
  tbody.innerHTML = '';
  docs.forEach(doc => {
    const data = doc.data();
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${data.clientName}</td>
      <td>${data.feedType}</td>
      <td>${data.totalBags}</td>
      <td>KSh ${data.amountPaid.toLocaleString()}</td>
      <td>${data.remainingBags}</td>
    `;
    tbody.appendChild(row);
  });
}

function renderDebtPayments(docs) {
  const tbody = document.getElementById('debt-payments-list');
  tbody.innerHTML = '';
  docs.forEach(doc => {
    const data = doc.data();
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${data.clientName}</td>
      <td>KSh ${data.amountPaid.toLocaleString()}</td>
      <td>${data.paymentMethod}</td>
    `;
    tbody.appendChild(row);
  });
}

function renderFeedReleases(docs) {
  const tbody = document.getElementById('feed-releases-list');
  tbody.innerHTML = '';
  docs.forEach(doc => {
    const data = doc.data();
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${data.clientName}</td>
      <td>${data.feedType}</td>
      <td>${data.bags}</td>
    `;
    tbody.appendChild(row);
  });
}

function renderTransfers(docs) {
  const tbody = document.getElementById('transfers-list');
  tbody.innerHTML = '';
  docs.forEach(doc => {
    const data = doc.data();
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${data.toShop}</td>
      <td>${data.feedType}</td>
      <td>${data.bags}</td>
    `;
    tbody.appendChild(row);
  });
}

function renderClients(docs) {
  const tbody = document.getElementById('clients-list');
  tbody.innerHTML = '';
  docs.forEach(doc => {
    const data = doc.data();
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${data.clientName}</td>
      <td>${data.feedType}</td>
      <td>${data.bags}</td>
      <td>KSh ${data.totalAmount.toLocaleString()}</td>
    `;
    tbody.appendChild(row);
  });
}

// Save functions with individual save buttons
async function saveCreditSale() {
  if (currentUserData.role === 'manager_view') {
    showError('You do not have permission to add transactions');
    return;
  }

  const clientName = document.getElementById('credit-client-name').value;
  const feedType = document.getElementById('credit-feed-type').value;
  const bags = parseFloat(document.getElementById('credit-bags').value);
  const paidAmount = parseFloat(document.getElementById('credit-paid').value);

  if (!clientName || !feedType || !bags || isNaN(paidAmount)) {
    showError('Please fill all fields');
    return;
  }

  const product = PRODUCTS.find(p => p.name === feedType);
  const totalAmount = bags * product.sales;
  const remainingAmount = totalAmount - paidAmount;

  try {
    await addDoc(collection(db, 'creditSales'), {
      shop: currentShop,
      date: document.getElementById('stock-date').value,
      clientName,
      feedType,
      bags,
      totalAmount,
      paidAmount,
      remainingAmount,
      status: remainingAmount > 0 ? 'pending' : 'paid',
      createdAt: Timestamp.now(),
      createdBy: currentUser.uid
    });

    showSuccess('Credit sale saved!');
    document.getElementById('credit-client-name').value = '';
    document.getElementById('credit-bags').value = '';
    document.getElementById('credit-paid').value = '';
    loadTransactions(currentShop, document.getElementById('stock-date').value);
  } catch (error) {
    console.error('Error saving credit sale:', error);
    showError('Error saving credit sale');
  }
}

async function savePrepayment() {
  if (currentUserData.role === 'manager_view') {
    showError('You do not have permission to add transactions');
    return;
  }

  const clientName = document.getElementById('prepay-client-name').value;
  const feedType = document.getElementById('prepay-feed-type').value;
  const amountPaid = parseFloat(document.getElementById('prepay-amount').value);

  if (!clientName || !feedType || !amountPaid) {
    showError('Please fill all fields');
    return;
  }

  const product = PRODUCTS.find(p => p.name === feedType);
  const totalBags = Math.floor(amountPaid / product.sales);

  try {
    await addDoc(collection(db, 'prepayments'), {
      shop: currentShop,
      date: document.getElementById('stock-date').value,
      clientName,
      feedType,
      amountPaid,
      totalBags,
      remainingBags: totalBags,
      status: 'pending',
      createdAt: Timestamp.now(),
      createdBy: currentUser.uid
    });

    showSuccess('Prepayment saved!');
    document.getElementById('prepay-client-name').value = '';
    document.getElementById('prepay-amount').value = '';
    loadTransactions(currentShop, document.getElementById('stock-date').value);
  } catch (error) {
    console.error('Error saving prepayment:', error);
    showError('Error saving prepayment');
  }
}

async function saveDebtPayment() {
  if (currentUserData.role === 'manager_view') {
    showError('You do not have permission to add transactions');
    return;
  }

  const clientName = document.getElementById('debt-client-name').value;
  const amountPaid = parseFloat(document.getElementById('debt-amount').value);
  const paymentMethod = document.getElementById('debt-method').value;

  if (!clientName || !amountPaid || !paymentMethod) {
    showError('Please fill all fields');
    return;
  }

  try {
    await addDoc(collection(db, 'debtPayments'), {
      shop: currentShop,
      date: document.getElementById('stock-date').value,
      clientName,
      amountPaid,
      paymentMethod,
      createdAt: Timestamp.now(),
      createdBy: currentUser.uid
    });

    showSuccess('Debt payment saved!');
    document.getElementById('debt-client-name').value = '';
    document.getElementById('debt-amount').value = '';
    loadTransactions(currentShop, document.getElementById('stock-date').value);
  } catch (error) {
    console.error('Error saving debt payment:', error);
    showError('Error saving debt payment');
  }
}

async function saveFeedRelease() {
  if (currentUserData.role === 'manager_view') {
    showError('You do not have permission to add transactions');
    return;
  }

  const clientName = document.getElementById('release-client-name').value;
  const feedType = document.getElementById('release-feed-type').value;
  const bags = parseFloat(document.getElementById('release-bags').value);

  if (!clientName || !feedType || !bags) {
    showError('Please fill all fields');
    return;
  }

  try {
    await addDoc(collection(db, 'feedReleases'), {
      shop: currentShop,
      date: document.getElementById('stock-date').value,
      clientName,
      feedType,
      bags,
      createdAt: Timestamp.now(),
      createdBy: currentUser.uid
    });

    showSuccess('Feed release saved!');
    document.getElementById('release-client-name').value = '';
    document.getElementById('release-bags').value = '';
    loadTransactions(currentShop, document.getElementById('stock-date').value);
  } catch (error) {
    console.error('Error saving feed release:', error);
    showError('Error saving feed release');
  }
}

async function saveTransfer() {
  if (currentUserData.role === 'manager_view') {
    showError('You do not have permission to add transactions');
    return;
  }

  const toShop = document.getElementById('transfer-to-shop').value;
  const feedType = document.getElementById('transfer-feed-type').value;
  const bags = parseFloat(document.getElementById('transfer-bags').value);

  if (!toShop || !feedType || !bags) {
    showError('Please fill all fields');
    return;
  }

  try {
    await addDoc(collection(db, 'transfers'), {
      fromShop: currentShop,
      toShop,
      date: document.getElementById('stock-date').value,
      feedType,
      bags,
      createdAt: Timestamp.now(),
      createdBy: currentUser.uid
    });

    showSuccess('Transfer saved!');
    document.getElementById('transfer-bags').value = '';
    loadTransactions(currentShop, document.getElementById('stock-date').value);
  } catch (error) {
    console.error('Error saving transfer:', error);
    showError('Error saving transfer');
  }
}

async function saveClient() {
  if (currentUserData.role === 'manager_view') {
    showError('You do not have permission to add transactions');
    return;
  }

  const clientName = document.getElementById('client-name').value;
  const feedType = document.getElementById('client-feed-type').value;
  const bags = parseFloat(document.getElementById('client-bags').value);

  if (!clientName || !feedType || !bags) {
    showError('Please fill all fields');
    return;
  }

  const product = PRODUCTS.find(p => p.name === feedType);
  const totalAmount = bags * product.sales;

  try {
    await addDoc(collection(db, 'clients'), {
      shop: currentShop,
      date: document.getElementById('stock-date').value,
      clientName,
      feedType,
      bags,
      totalAmount,
      createdAt: Timestamp.now(),
      createdBy: currentUser.uid
    });

    showSuccess('Client details saved!');
    document.getElementById('client-name').value = '';
    document.getElementById('client-bags').value = '';
    loadTransactions(currentShop, document.getElementById('stock-date').value);
  } catch (error) {
    console.error('Error saving client details:', error);
    showError('Error saving client details');
  }
}

// Load stock value page with detailed breakdown
async function loadStockValuePage() {
  try {
    let shopsStockValue = 0;
    let debtorsValue = 0;
    let creditorsValue = 0;

    const today = new Date().toISOString().split('T')[0];

    for (const shop of SHOPS) {
      // Check access
      if (currentUserData.role === 'attendant' && currentUserData.assignedShop !== shop) {
        continue;
      }

      // Calculate shops stock value
      const stockRef = doc(db, 'stock', `${shop}_${today}`);
      const stockDoc = await getDoc(stockRef);
      
      if (stockDoc.exists()) {
        const stockData = stockDoc.data();
        PRODUCTS.forEach(product => {
          const closing = stockData.closingStock?.[product.name] || 0;
          shopsStockValue += closing * product.cost;
        });
      }

      // Calculate debtors value (money owed to us)
      const creditQuery = query(
        collection(db, 'creditSales'),
        where('shop', '==', shop),
        where('status', '==', 'pending')
      );
      const creditDocs = await getDocs(creditQuery);
      creditDocs.forEach(doc => {
        debtorsValue += doc.data().remainingAmount || 0;
      });

      // Calculate creditors value (feeds we owe)
      const prepayQuery = query(
        collection(db, 'prepayments'),
        where('shop', '==', shop),
        where('status', '==', 'pending')
      );
      const prepayDocs = await getDocs(prepayQuery);
      prepayDocs.forEach(doc => {
        const data = doc.data();
        const product = PRODUCTS.find(p => p.name === data.feedType);
        if (product) {
          creditorsValue += (data.remainingBags || 0) * product.cost;
        }
      });
    }

    // Calculate net stock value
    const netStockValue = shopsStockValue + debtorsValue - creditorsValue;

    // Display breakdown
    const breakdownHtml = `
      <div class="stock-value-breakdown">
        <div class="value-item">
          <h3>Debtors Value</h3>
          <p class="value-amount">KSh ${debtorsValue.toLocaleString()}</p>
          <p class="value-desc">Money owed to us from credit sales</p>
        </div>
        
        <div class="value-item">
          <h3>Shops Stock Value</h3>
          <p class="value-amount">KSh ${shopsStockValue.toLocaleString()}</p>
          <p class="value-desc">Physical stock in all shops (at cost price)</p>
        </div>
        
        <div class="value-item">
          <h3>Creditors Value</h3>
          <p class="value-amount negative">KSh ${creditorsValue.toLocaleString()}</p>
          <p class="value-desc">Feeds we owe to prepaid clients (at cost price)</p>
        </div>
        
        <div class="value-formula">
          <h3>Formula</h3>
          <p>Net Stock Value = Stock in Shops + Debtors - Creditors</p>
          <p>Net Stock Value = ${shopsStockValue.toLocaleString()} + ${debtorsValue.toLocaleString()} - ${creditorsValue.toLocaleString()}</p>
        </div>
        
        <div class="value-item net-value">
          <h3>Net Stock Value</h3>
          <p class="value-amount final">KSh ${netStockValue.toLocaleString()}</p>
          <p class="value-desc">Total business value after all obligations</p>
        </div>
      </div>
    `;

    document.getElementById('stock-value-content').innerHTML = breakdownHtml;

  } catch (error) {
    console.error('Error loading stock value:', error);
    showError('Error loading stock value');
  }
}

// Load reports page
function loadReportsPage() {
  // Placeholder for reports
  document.getElementById('reports-content').innerHTML = `
    <p>Select date range and shop to generate reports</p>
  `;
}

// PDF Export functions using jsPDF
async function exportDoc1() {
  try {
    // Import jsPDF
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    const selectedShop = document.getElementById('shop-selector').value;
    const selectedDate = document.getElementById('stock-date').value;
    
    // Title
    doc.setFontSize(16);
    doc.text(`Stock Report - ${selectedShop}`, 20, 20);
    doc.setFontSize(12);
    doc.text(`Date: ${selectedDate}`, 20, 30);
    
    // Get stock data
    const stockRef = doc(db, 'stock', `${selectedShop}_${selectedDate}`);
    const stockDoc = await getDoc(stockRef);
    
    if (stockDoc.exists()) {
      const stockData = stockDoc.data();
      
      let y = 50;
      doc.text('Product', 20, y);
      doc.text('Opening', 70, y);
      doc.text('Restocking', 100, y);
      doc.text('Closing', 135, y);
      doc.text('Sales', 165, y);
      
      y += 10;
      
      PRODUCTS.forEach(product => {
        const opening = stockData.openingStock?.[product.name] || 0;
        const restocking = stockData.restocking?.[product.name] || 0;
        const closing = stockData.closingStock?.[product.name] || 0;
        const sales = opening + restocking - closing;
        
        doc.text(product.name, 20, y);
        doc.text(opening.toString(), 70, y);
        doc.text(restocking.toString(), 100, y);
        doc.text(closing.toString(), 135, y);
        doc.text(sales.toString(), 165, y);
        
        y += 8;
      });
      
      y += 10;
      doc.text(`Total Cash: KSh ${stockData.totalCash.toLocaleString()}`, 20, y);
    }
    
    doc.save(`${selectedShop}_${selectedDate}_report.pdf`);
    showSuccess('Report exported successfully!');
    
  } catch (error) {
    console.error('Error exporting PDF:', error);
    showError('Error exporting PDF. Please ensure jsPDF library is loaded.');
  }
}

async function exportDoc2() {
  showError('Doc2 export feature coming soon!');
}

// Admin panel functions
async function loadAdminPanel() {
  if (currentUserData.role !== 'manager_full') {
    showError('Access denied');
    return;
  }

  try {
    const usersSnapshot = await getDocs(collection(db, 'users'));
    const tbody = document.getElementById('users-table-body');
    tbody.innerHTML = '';

    usersSnapshot.forEach(doc => {
      const user = doc.data();
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${user.name}</td>
        <td>${user.email}</td>
        <td>
          <select class="role-select" data-uid="${doc.id}">
            <option value="pending" ${user.role === 'pending' ? 'selected' : ''}>Pending</option>
            <option value="manager_full" ${user.role === 'manager_full' ? 'selected' : ''}>Manager (Full Access)</option>
            <option value="manager_view" ${user.role === 'manager_view' ? 'selected' : ''}>Manager (View Only)</option>
            <option value="attendant" ${user.role === 'attendant' ? 'selected' : ''}>Attendant</option>
          </select>
        </td>
        <td>
          <select class="shop-select" data-uid="${doc.id}" ${user.role !== 'attendant' ? 'disabled' : ''}>
            <option value="">Select Shop</option>
            ${SHOPS.map(shop => `<option value="${shop}" ${user.assignedShop === shop ? 'selected' : ''}>${shop}</option>`).join('')}
          </select>
        </td>
        <td>
          <button onclick="updateUser('${doc.id}')" class="btn-small">Update</button>
          <button onclick="deleteUser('${doc.id}')" class="btn-small btn-danger">Delete</button>
        </td>
      `;
      tbody.appendChild(row);
    });

    // Enable/disable shop selector based on role
    document.querySelectorAll('.role-select').forEach(select => {
      select.addEventListener('change', (e) => {
        const uid = e.target.dataset.uid;
        const shopSelect = document.querySelector(`.shop-select[data-uid="${uid}"]`);
        shopSelect.disabled = e.target.value !== 'attendant';
      });
    });

  } catch (error) {
    console.error('Error loading admin panel:', error);
    showError('Error loading users');
  }
}

// Update user (global function for admin panel)
window.updateUser = async function(uid) {
  const roleSelect = document.querySelector(`.role-select[data-uid="${uid}"]`);
  const shopSelect = document.querySelector(`.shop-select[data-uid="${uid}"]`);
  
  const role = roleSelect.value;
  const assignedShop = role === 'attendant' ? shopSelect.value : 'All Shops';

  if (role === 'attendant' && !assignedShop) {
    showError('Please select a shop for attendant');
    return;
  }

  try {
    await updateDoc(doc(db, 'users', uid), {
      role,
      assignedShop
    });
    showSuccess('User updated successfully!');
  } catch (error) {
    console.error('Error updating user:', error);
    showError('Error updating user');
  }
};

// Delete user (global function for admin panel)
window.deleteUser = async function(uid) {
  if (!confirm('Are you sure you want to delete this user?')) return;

  try {
    await deleteDoc(doc(db, 'users', uid));
    showSuccess('User deleted successfully!');
    loadAdminPanel();
  } catch (error) {
    console.error('Error deleting user:', error);
    showError('Error deleting user');
  }
};

// Utility functions
function showError(message) {
  alert('Error: ' + message);
}

function showSuccess(message) {
  alert(message);
}

// Set today's date as default
document.addEventListener('DOMContentLoaded', () => {
  const dateInput = document.getElementById('stock-date');
  if (dateInput) {
    dateInput.value = new Date().toISOString().split('T')[0];
  }
});