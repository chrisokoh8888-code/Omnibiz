let currentUser = null;
let businesses = [];

// ==================== AUTH & TRIAL LOGIC ====================
async function checkTrialStatus() {
  if (!currentUser) return;
  const userDoc = await db.collection('users').doc(currentUser.uid).get();
  const data = userDoc.data();
  
  if (data.trialEndDate) {
    const end = new Date(data.trialEndDate.seconds * 1000);
    const daysLeft = Math.ceil((end - Date.now()) / (1000*60*60*24));
    
    if (daysLeft <= 5 && daysLeft > 0) {
      document.getElementById('trial-days').innerHTML = `
        Only <strong class="text-warning">${daysLeft} days</strong> left in your free trial!<br>
        <span class="small">Upgrade to keep all insights and reports.</span>
      `;
      new bootstrap.Modal(document.getElementById('trial-modal')).show();
    }
    if (daysLeft <= 0) {
      alert("Your trial has ended. Please upgrade to continue.");
    }
  }
}

async function createTrialUser(email, password) {
  try {
    const userCred = await auth.createUserWithEmailAndPassword(email, password);
    await db.collection('users').doc(userCred.user.uid).set({
      email,
      role: "trial",
      trialEndDate: firebase.firestore.Timestamp.fromDate(new Date(Date.now() + 30*24*60*60*1000))
    });
    alert(`Trial account created!\nEmail: ${email}\nPassword: ${password}\n30 days free`);
  } catch(e) { console.error(e); }
}

// ==================== NAVIGATION ====================
function updateNav() {
  const nav = document.getElementById('nav-user');
  if (currentUser) {
    nav.innerHTML = `
      <button onclick="renderMasterDashboard()" class="btn btn-outline-light btn-sm">Dashboard</button>
      <button onclick="showAddBusinessForm()" class="btn btn-success btn-sm">+ New Business</button>
      <button onclick="logout()" class="btn btn-outline-danger btn-sm">Logout</button>
    `;
  }
}

window.logout = () => {
  auth.signOut();
};

// ==================== MASTER DASHBOARD ====================
async function renderMasterDashboard() {
  updateNav();

  const html = `
    <div class="row g-4">
      <div class="col-12 col-md-4">
        <div class="card h-100 p-4">
          <h6 class="text-success text-uppercase small mb-1">Total Revenue</h6>
          <h2 id="total-rev" class="fw-bold display-5">₦0</h2>
        </div>
      </div>
      <div class="col-12 col-md-4">
        <div class="card h-100 p-4">
          <h6 class="text-warning text-uppercase small mb-1">Top Performing</h6>
          <h3 id="top-business" class="fw-semibold">—</h3>
        </div>
      </div>
      <div class="col-12 col-md-4">
        <div class="card h-100 p-4">
          <h6 class="text-info text-uppercase small mb-1">Peak Profit Day</h6>
          <h3 id="peak-day" class="fw-semibold">—</h3>
        </div>
      </div>
    </div>

    <div class="d-flex justify-content-between align-items-center mt-5 mb-4">
      <h4 class="fw-semibold">Your Businesses</h4>
      <button onclick="showAddBusinessForm()" class="btn btn-success">+ Add New Business</button>
    </div>
    <div id="business-grid" class="row g-4"></div>

    <h4 class="mt-5 mb-4 fw-semibold">Revenue Trend (All Businesses)</h4>
    <div class="card p-4">
      <canvas id="masterChart" class="w-100"></canvas>
    </div>
  `;
  document.getElementById('main-content').innerHTML = html;

  // Sample total revenue
  const snap = await db.collection('transactions').get();
  let total = 0;
  snap.forEach(doc => total += doc.data().amount || 0);
  document.getElementById('total-rev').textContent = `₦${total.toLocaleString()}`;

  const grid = document.getElementById('business-grid');
  grid.innerHTML = ''; // clear previous
  businesses.forEach(biz => {
    const col = document.createElement('div');
    col.className = "col-12 col-md-6 col-lg-3";
    col.innerHTML = `
      <div class="card h-100 cursor-pointer" onclick="renderBusinessView('${biz.id}')">
        <div class="card-body">
          <div class="d-flex justify-content-between align-items-start">
            <div>
              <h5 class="card-title">${biz.name}</h5>
              <span class="badge bg-success">${biz.type}</span>
            </div>
            <span class="fs-1 text-success">📈</span>
          </div>
        </div>
      </div>
    `;
    grid.appendChild(col);
  });

  // Master chart (sample)
  new Chart(document.getElementById('masterChart'), {
    type: 'line',
    data: {
      labels: ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'],
      datasets: [{ label: 'Revenue', data: [12000,18500,32000,15000,45000,28000,67000], borderColor: '#10b981', tension: 0.4, borderWidth: 3 }]
    },
    options: { plugins: { legend: { display: false } }, scales: { y: { grid: { color: '#27272a' } } } }
  });
}

// ==================== ADD NEW BUSINESS FORM ====================
function showAddBusinessForm() {
  const html = `
    <div class="card mx-auto" style="max-width: 620px;">
      <div class="card-header bg-dark border-bottom border-secondary">
        <h4 class="mb-0">Add New Business</h4>
      </div>
      <div class="card-body p-4">
        <form id="business-form">
          <div class="mb-3">
            <label class="form-label">Business Name</label>
            <input type="text" id="biz-name" class="form-control form-control-lg" placeholder="e.g. Golden Bakery" required>
          </div>
          <div class="mb-3">
            <label class="form-label">Business Type</label>
            <select id="biz-type" class="form-select form-select-lg">
              <option value="bakery">Bakery</option>
              <option value="purewater">Pure Water Factory</option>
              <option value="fastfood">Fast Food</option>
              <option value="printing">Printing Company</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div class="mb-4">
            <label class="form-label">Currency</label>
            <select id="biz-currency" class="form-select form-select-lg">
              <option value="NGN">₦ Nigerian Naira</option>
            </select>
          </div>

          <button type="button" onclick="saveNewBusiness()" class="btn btn-success btn-lg w-100">Create Business</button>
        </form>
      </div>
    </div>

    <div class="text-center mt-4">
      <button onclick="renderMasterDashboard()" class="btn btn-link text-secondary">← Back to Dashboard</button>
    </div>
  `;
  document.getElementById('main-content').innerHTML = html;
}

async function saveNewBusiness() {
  const name = document.getElementById('biz-name').value.trim();
  const type = document.getElementById('biz-type').value;
  const currency = document.getElementById('biz-currency').value;

  if (!name) {
    alert("Please enter a business name");
    return;
  }

  try {
    const docRef = await db.collection('businesses').add({
      ownerId: currentUser.uid,
      name: name,
      type: type,
      currency: currency,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    alert(`✅ Business "${name}" created successfully!`);
    
    // Refresh businesses list
    const snap = await db.collection('businesses').where('ownerId', '==', currentUser.uid).get();
    businesses = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    renderMasterDashboard();
  } catch (error) {
    console.error(error);
    alert("Error creating business: " + error.message);
  }
}

// ==================== ADD PRODUCTS TO A BUSINESS ====================
// This will be called from the individual business view later
function showAddProductForm(bizId, bizName) {
  const html = `
    <div class="card mx-auto" style="max-width: 620px;">
      <div class="card-header bg-dark">
        <h4>Add Product to <span class="text-success">${bizName}</span></h4>
      </div>
      <div class="card-body p-4">
        <form id="product-form">
          <div class="mb-3">
            <label class="form-label">Product Name</label>
            <input type="text" id="prod-name" class="form-control" placeholder="e.g. Bread Loaf" required>
          </div>
          <div class="row">
            <div class="col-md-6 mb-3">
              <label class="form-label">Cost Price (₦)</label>
              <input type="number" id="prod-cost" class="form-control" placeholder="0.00" required>
            </div>
            <div class="col-md-6 mb-3">
              <label class="form-label">Selling Price (₦)</label>
              <input type="number" id="prod-sell" class="form-control" placeholder="0.00" required>
            </div>
          </div>
          <div class="row">
            <div class="col-md-6 mb-3">
              <label class="form-label">Current Stock</label>
              <input type="number" id="prod-stock" class="form-control" value="100" required>
            </div>
            <div class="col-md-6 mb-3">
              <label class="form-label">Reorder Level</label>
              <input type="number" id="prod-reorder" class="form-control" value="20" required>
            </div>
          </div>
          <button type="button" onclick="saveNewProduct('${bizId}')" class="btn btn-success w-100">Save Product</button>
        </form>
      </div>
    </div>
    <div class="text-center mt-4">
      <button onclick="renderBusinessView('${bizId}')" class="btn btn-link text-secondary">← Back</button>
    </div>
  `;
  document.getElementById('main-content').innerHTML = html;
}

async function saveNewProduct(bizId) {
  const name = document.getElementById('prod-name').value.trim();
  const cost = parseFloat(document.getElementById('prod-cost').value);
  const sell = parseFloat(document.getElementById('prod-sell').value);
  const stock = parseInt(document.getElementById('prod-stock').value);
  const reorder = parseInt(document.getElementById('prod-reorder').value);

  if (!name || isNaN(cost) || isNaN(sell)) {
    alert("Please fill all required fields");
    return;
  }

  try {
    await db.collection(`products/${bizId}/items`).add({
      name,
      costPrice: cost,
      sellingPrice: sell,
      currentStock: stock,
      reorderLevel: reorder,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    alert(`✅ Product "${name}" added successfully!`);
    renderBusinessView(bizId); // go back to business view
  } catch (error) {
    console.error(error);
    alert("Error saving product");
  }
}

// ==================== INDIVIDUAL BUSINESS VIEW (updated) ====================
async function renderBusinessView(bizId) {
  const bizSnap = await db.collection('businesses').doc(bizId).get();
  const biz = bizSnap.data();

  const html = `
    <div class="d-flex justify-content-between align-items-center mb-4">
      <div>
        <button onclick="renderMasterDashboard()" class="btn btn-link text-success ps-0">← Back to Master</button>
        <h1 class="display-5 fw-bold">${biz.name}</h1>
      </div>
      <div>
        <span class="badge bg-success fs-6 px-4 py-2">${biz.type}</span>
        <button onclick="showAddProductForm('${bizId}', '${biz.name}')" class="btn btn-outline-success ms-3">+ Add Product</button>
      </div>
    </div>

    <div class="row g-4">
      <div class="col-lg-8">
        <div class="card p-4">
          <h5 class="mb-3">Sales Trend & Peak Period</h5>
          <canvas id="bizChart" class="w-100"></canvas>
        </div>
      </div>
      <div class="col-lg-4">
        <div class="card p-4 h-100">
          <h5 class="mb-4">Smart Inventory Recommendation</h5>
          <div id="inventory-list" class="text-success fw-semibold">
            🔥 ${biz.type === 'bakery' ? 'Bakery' : biz.name} is performing well.<br>
            Consider increasing stock of top products this week.
          </div>
        </div>
      </div>
    </div>
  `;
  document.getElementById('main-content').innerHTML = html;

  new Chart(document.getElementById('bizChart'), {
    type: 'bar',
    data: {
      labels: ['Week 1','Week 2','Week 3','Week 4'],
      datasets: [{ label: 'Profit', data: [45000,82000,31000,95000], backgroundColor: '#10b981' }]
    },
    options: { plugins: { legend: { display: false } } }
  });
}

// ==================== LOGIN & ROUTING ====================
auth.onAuthStateChanged(async user => {
  currentUser = user;
  if (!user) {
    document.getElementById('main-content').innerHTML = `
      <div class="row justify-content-center mt-5">
        <div class="col-12 col-md-5">
          <div class="card p-5">
            <h2 class="text-center fw-bold mb-4">Welcome to OmniBiz</h2>
            <div class="mb-3">
              <input id="login-email" type="email" class="form-control form-control-lg" placeholder="Email">
            </div>
            <div class="mb-4">
              <input id="login-pass" type="password" class="form-control form-control-lg" placeholder="Password">
            </div>
            <button onclick="login()" class="btn btn-light btn-lg w-100">Login</button>
            <p class="text-center text-secondary mt-4 small">Demo trial: trial@omnibiz.ng / password123</p>
          </div>
        </div>
      </div>
    `;
  } else {
    const snap = await db.collection('businesses').where('ownerId', '==', user.uid).get();
    businesses = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    await checkTrialStatus();
    renderMasterDashboard();
  }
});

window.login = async () => {
  const email = document.getElementById('login-email').value;
  const pass = document.getElementById('login-pass').value;
  try {
    await auth.signInWithEmailAndPassword(email, pass);
  } catch(e) { alert(e.message); }
};

window.subscribeNow = () => {
  alert("In production this would open Paystack/Flutterwave checkout.\n\nFor testing, trial extended 7 days.");
  bootstrap.Modal.getInstance(document.getElementById('trial-modal')).hide();
};

// For testing (run once in browser console):
// createTrialUser("trial@omnibiz.ng", "password123")
