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

// ==================== MASTER DASHBOARD ====================
async function renderMasterDashboard() {
  const html = `
    <div class="row g-4">
      <div class="col-12 col-md-4">
        <div class="card h-100 p-4 glass">
          <h6 class="text-success text-uppercase small mb-1">Total Revenue</h6>
          <h2 id="total-rev" class="fw-bold display-5">₦0</h2>
        </div>
      </div>
      <div class="col-12 col-md-4">
        <div class="card h-100 p-4 glass">
          <h6 class="text-warning text-uppercase small mb-1">Top Performing</h6>
          <h3 id="top-business" class="fw-semibold">—</h3>
        </div>
      </div>
      <div class="col-12 col-md-4">
        <div class="card h-100 p-4 glass">
          <h6 class="text-info text-uppercase small mb-1">Peak Profit Day</h6>
          <h3 id="peak-day" class="fw-semibold">—</h3>
        </div>
      </div>
    </div>

    <h4 class="mt-5 mb-4 fw-semibold">Your Businesses</h4>
    <div id="business-grid" class="row g-4"></div>

    <h4 class="mt-5 mb-4 fw-semibold">Revenue Trend (All Businesses)</h4>
    <div class="card p-4">
      <canvas id="masterChart"></canvas>
    </div>
  `;
  document.getElementById('main-content').innerHTML = html;

  // Sample data fetch
  const snap = await db.collection('transactions').get();
  let total = 0;
  snap.forEach(doc => total += doc.data().amount || 0);
  document.getElementById('total-rev').textContent = `₦${total.toLocaleString()}`;

  const grid = document.getElementById('business-grid');
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

  // Master chart
  new Chart(document.getElementById('masterChart'), {
    type: 'line',
    data: {
      labels: ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'],
      datasets: [{ label: 'Revenue', data: [12000,18500,32000,15000,45000,28000,67000], borderColor: '#10b981', tension: 0.4, borderWidth: 3 }]
    },
    options: { plugins: { legend: { display: false } }, scales: { y: { grid: { color: '#27272a' } } } }
  });
}

// ==================== INDIVIDUAL BUSINESS VIEW ====================
async function renderBusinessView(bizId) {
  const bizSnap = await db.collection('businesses').doc(bizId).get();
  const biz = bizSnap.data();

  const html = `
    <div class="d-flex justify-content-between align-items-center mb-4">
      <div>
        <button onclick="renderMasterDashboard()" class="btn btn-link text-success ps-0">← Back to Master Dashboard</button>
        <h1 class="display-5 fw-bold">${biz.name}</h1>
      </div>
      <span class="badge bg-success fs-6 px-4 py-2">${biz.type}</span>
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
            🔥 Bakery is in peak season.<br>
            Increase flour stock by 40% this week for maximum cash flow.
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
