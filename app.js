/* ==========================================================================
   EliteMess - Premium Webapp Core Controller & Calculation Engine
   ========================================================================== */

class MessManagementApp {
  constructor() {
    this.state = {
      members: [],
      meals: {},          // Schema: { "YYYY-MM-DD": { "memberId": { breakfast: 0, lunch: 0, dinner: 0 } } }
      bazaar: [],         // Schema: [ { id, memberId, amount, date, items } ]
      otherExpenses: [],  // Schema: [ { id, title, category, amount, date } ]
      deposits: [],       // Schema: [ { id, memberId, amount, date, notes } ]
      activeTab: 'dashboard',
      selectedMealDate: this.formatDate(new Date())
    };

    // DOM Binding and Listeners
    this.init();
  }

  // ==========================================================================
  // Initialization & LocalStorage Integration
  // ==========================================================================
  init() {
    // 1. Load Data
    this.loadFromLocalStorage();

    // If clean launch, seed beautiful mock data so user can see visual details immediately
    if (this.state.members.length === 0) {
      this.seedMockData();
    }

    // 2. Initialize DOM event listeners
    this.bindEvents();

    // 3. Render initial state
    this.switchTab(this.state.activeTab);
    this.updateGlobalCalculations();
  }

  saveToLocalStorage() {
    localStorage.setItem('elitemess_db', JSON.stringify(this.state));
  }

  loadFromLocalStorage() {
    const rawData = localStorage.getItem('elitemess_db');
    if (rawData) {
      try {
        const parsed = JSON.parse(rawData);
        // Map parsed state, keeping default fields if older keys are absent
        this.state = { ...this.state, ...parsed };
      } catch (e) {
        console.error("Failed to parse local storage mess database", e);
      }
    }
  }

  // ==========================================================================
  // Mock Data Seeding (Interactive Sandboxed Sandbox)
  // ==========================================================================
  seedMockData() {
    const today = new Date();
    const dStr = (offset) => {
      const d = new Date(today);
      d.setDate(today.getDate() - offset);
      return this.formatDate(d);
    };

    this.state.members = [
      { id: "mem-1", name: "Rakib Ahmed", phone: "01711223344", email: "rakib@gmail.com" },
      { id: "mem-2", name: "Abir Hasan", phone: "01999887766", email: "abir@gmail.com" },
      { id: "mem-3", name: "Sajid Islam", phone: "01555443322", email: "sajid@gmail.com" }
    ];

    // Seed Deposits
    this.state.deposits = [
      { id: "dep-1", memberId: "mem-1", amount: 3000, date: dStr(5), notes: "Bkash Deposit" },
      { id: "dep-2", memberId: "mem-2", amount: 2500, date: dStr(5), notes: "Cash Deposit" },
      { id: "dep-3", memberId: "mem-3", amount: 3500, date: dStr(5), notes: "Cash Deposit" },
      { id: "dep-4", memberId: "mem-1", amount: 1000, date: dStr(2), notes: "Hand Cash" }
    ];

    // Seed Bazaar expenses
    this.state.bazaar = [
      { id: "baz-1", memberId: "mem-1", amount: 1450, date: dStr(4), items: "Beef 2kg, Cooking Oil 2L, Onions, Spices" },
      { id: "baz-2", memberId: "mem-2", amount: 820, date: dStr(3), items: "Miniket Rice 10kg, Potato 5kg, Lentils 2kg" },
      { id: "baz-3", memberId: "mem-3", amount: 560, date: dStr(1), items: "Chicken 1.5kg, Eggs 1 Dozen, Green Chillies" }
    ];

    // Seed Utility Bills
    this.state.otherExpenses = [
      { id: "oth-1", title: "Internet Wi-Fi", category: "Internet", amount: 600, date: dStr(4) },
      { id: "oth-2", title: "Electricity Bill", category: "Electricity", amount: 1200, date: dStr(2) }
    ];

    // Seed meals for the last 5 days
    for (let i = 0; i < 5; i++) {
      const dateStr = dStr(i);
      this.state.meals[dateStr] = {
        "mem-1": { breakfast: i === 0 ? 0.5 : 1, lunch: 1, dinner: 1 },
        "mem-2": { breakfast: 0, lunch: 1, dinner: 1 },
        "mem-3": { breakfast: 1, lunch: 1, dinner: 1 }
      };
    }

    this.saveToLocalStorage();
  }

  // ==========================================================================
  // Core Calculation Engine
  // ==========================================================================
  getCalculatedMetrics() {
    // 1. Total deposits
    const totalDeposits = this.state.deposits.reduce((acc, d) => acc + Number(d.amount), 0);

    // 2. Total bazaar expenses
    const totalBazaar = this.state.bazaar.reduce((acc, b) => acc + Number(b.amount), 0);

    // 3. Total meals eaten
    let totalMeals = 0;
    Object.values(this.state.meals).forEach(dayMeals => {
      Object.values(dayMeals).forEach(m => {
        totalMeals += (Number(m.breakfast) || 0) + (Number(m.lunch) || 0) + (Number(m.dinner) || 0);
      });
    });

    // 4. Dynamic Meal Rate
    const mealRate = totalMeals > 0 ? (totalBazaar / totalMeals) : 0;

    // 5. Total shared other expenses (Utility split)
    const totalSharedExpenses = this.state.otherExpenses.reduce((acc, e) => acc + Number(e.amount), 0);

    // 6. Split share per member
    const activeMemberCount = this.state.members.length;
    const individualSharedCost = activeMemberCount > 0 ? (totalSharedExpenses / activeMemberCount) : 0;

    // 7. Calculate ledger details for each member
    const memberLedgerMap = {};
    
    // Initialize map
    this.state.members.forEach(m => {
      memberLedgerMap[m.id] = {
        member: m,
        totalDeposits: 0,
        totalBazaarContribution: 0,
        totalMealsEaten: 0,
        mealCostIncurred: 0,
        sharedCostIncurred: individualSharedCost,
        netBalance: 0
      };
    });

    // Aggregate deposits
    this.state.deposits.forEach(d => {
      if (memberLedgerMap[d.memberId]) {
        memberLedgerMap[d.memberId].totalDeposits += Number(d.amount);
      }
    });

    // Aggregate bazaar contribution
    this.state.bazaar.forEach(b => {
      if (memberLedgerMap[b.memberId]) {
        memberLedgerMap[b.memberId].totalBazaarContribution += Number(b.amount);
      }
    });

    // Aggregate meals
    Object.values(this.state.meals).forEach(dayMeals => {
      Object.entries(dayMeals).forEach(([memId, m]) => {
        if (memberLedgerMap[memId]) {
          memberLedgerMap[memId].totalMealsEaten += (Number(m.breakfast) || 0) + (Number(m.lunch) || 0) + (Number(m.dinner) || 0);
        }
      });
    });

    // Calculate dynamic ledger sums
    Object.values(memberLedgerMap).forEach(ledger => {
      ledger.mealCostIncurred = ledger.totalMealsEaten * mealRate;
      
      // FORMULA: Deposit (cash contributed) + Bazaar Done (item value contributed) - Meal Cost - Shared Utility Cost
      ledger.netBalance = (ledger.totalDeposits + ledger.totalBazaarContribution) - (ledger.mealCostIncurred + ledger.sharedCostIncurred);
    });

    // Total Spent = Bazaar Spent + Shared Bill Spent
    const totalSpent = totalBazaar + totalSharedExpenses;
    const activeBalance = totalDeposits - totalSharedExpenses - totalBazaar;

    return {
      totalDeposits,
      totalBazaar,
      totalMeals,
      mealRate,
      totalSharedExpenses,
      individualSharedCost,
      totalSpent,
      activeBalance,
      memberLedgerMap
    };
  }

  // ==========================================================================
  // Event Binding
  // ==========================================================================
  bindEvents() {
    // Nav Tabs clicks
    document.querySelectorAll('.nav-item').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tab = e.currentTarget.getAttribute('data-tab');
        this.switchTab(tab);
      });
    });

    // Dark/Light toggle
    document.getElementById('theme-toggle').addEventListener('click', () => this.toggleTheme());

    // Import/Export
    document.getElementById('btn-export').addEventListener('click', () => this.exportDatabase());
    document.getElementById('btn-import-trigger').addEventListener('click', () => {
      document.getElementById('btn-import').click();
    });
    document.getElementById('btn-import').addEventListener('change', (e) => this.importDatabase(e));

    // Form Submissions
    document.getElementById('form-member').addEventListener('submit', (e) => this.handleMemberSubmit(e));
    document.getElementById('form-deposit').addEventListener('submit', (e) => this.handleDepositSubmit(e));
    document.getElementById('form-bazaar').addEventListener('submit', (e) => this.handleBazaarSubmit(e));
    document.getElementById('form-expense').addEventListener('submit', (e) => this.handleExpenseSubmit(e));

    // Modals Opening Triggers
    document.getElementById('btn-add-member').addEventListener('click', () => this.openMemberModal());
    document.getElementById('btn-quick-meal').addEventListener('click', () => this.switchTab('meals'));
    document.getElementById('btn-quick-deposit').addEventListener('click', () => this.openDepositModal());
    document.getElementById('btn-add-bazaar').addEventListener('click', () => this.openBazaarModal());
    document.getElementById('btn-add-expense').addEventListener('click', () => this.openExpenseModal());

    // Modals Closing Triggers
    const closeBackdrop = () => this.closeAllModals();
    document.getElementById('modal-backdrop').addEventListener('click', closeBackdrop);
    document.getElementById('btn-close-member-modal').addEventListener('click', closeBackdrop);
    document.getElementById('btn-cancel-member').addEventListener('click', closeBackdrop);
    document.getElementById('btn-close-deposit-modal').addEventListener('click', closeBackdrop);
    document.getElementById('btn-cancel-deposit').addEventListener('click', closeBackdrop);
    document.getElementById('btn-close-bazaar-modal').addEventListener('click', closeBackdrop);
    document.getElementById('btn-cancel-bazaar').addEventListener('click', closeBackdrop);
    document.getElementById('btn-close-expense-modal').addEventListener('click', closeBackdrop);
    document.getElementById('btn-cancel-expense').addEventListener('click', closeBackdrop);
    document.getElementById('btn-close-ledger-modal').addEventListener('click', closeBackdrop);

    // Meal view date changes
    const datePicker = document.getElementById('meal-date-picker');
    datePicker.value = this.state.selectedMealDate;
    datePicker.addEventListener('change', (e) => {
      this.state.selectedMealDate = e.target.value;
      this.renderMealBook();
    });

    document.getElementById('btn-prev-day').addEventListener('click', () => this.adjustMealDate(-1));
    document.getElementById('btn-next-day').addEventListener('click', () => this.adjustMealDate(1));
    document.getElementById('btn-save-meals').addEventListener('click', () => this.saveMealMatrix());

    // Reports printing
    document.getElementById('btn-print-report').addEventListener('click', () => window.print());
    document.getElementById('btn-reset-month').addEventListener('click', () => this.resetMonthData());
  }

  // ==========================================================================
  // Router / Tab Switching Control
  // ==========================================================================
  switchTab(tabName) {
    this.state.activeTab = tabName;
    
    // Toggle active state in navigation
    document.querySelectorAll('.nav-item').forEach(btn => {
      if (btn.getAttribute('data-tab') === tabName) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // Toggle active layout section
    document.querySelectorAll('.tab-view').forEach(view => {
      if (view.id === `view-${tabName}`) {
        view.classList.add('active');
      } else {
        view.classList.remove('active');
      }
    });

    // Dynamic Title Header Updates
    const titleEl = document.getElementById('page-title');
    const subEl = document.getElementById('page-subtitle');
    
    switch (tabName) {
      case 'dashboard':
        titleEl.textContent = 'Dashboard Overview';
        subEl.textContent = 'Live financial audit and overview of your shared mess workspace';
        this.renderDashboard();
        break;
      case 'members':
        titleEl.textContent = 'Mess Members';
        subEl.textContent = 'Register, edit, view ledger history, and trace cash dues of mess boarders';
        this.renderMembers();
        break;
      case 'meals':
        titleEl.textContent = 'Daily Meal Book';
        subEl.textContent = 'Add daily breakfast, lunch, and dinner records on an interactive grid';
        this.renderMealBook();
        break;
      case 'bazaar':
        titleEl.textContent = 'Grocery Bazaar Log';
        subEl.textContent = 'Record grocery purchases made by mess members to credit their ledger';
        this.renderBazaar();
        break;
      case 'expenses':
        titleEl.textContent = 'Shared Utility Expenses';
        subEl.textContent = 'Log utilities, water, gas, Wi-Fi, rent, and household shared bills';
        this.renderExpenses();
        break;
      case 'reports':
        titleEl.textContent = 'Final Settled Statements';
        subEl.textContent = 'Audit-grade billing invoice sheet. Printable as physical copy or PDF report';
        this.renderReports();
        break;
    }
  }

  // ==========================================================================
  // Dynamic Views Renderers
  // ==========================================================================
  
  // --- Global recalculation and dashboard statistics updater ---
  updateGlobalCalculations() {
    const metrics = this.getCalculatedMetrics();
    
    // Update Dashboard metric values
    document.getElementById('kpi-meal-rate').textContent = `৳${metrics.mealRate.toFixed(2)}`;
    document.getElementById('kpi-total-meals').textContent = metrics.totalMeals.toFixed(1);
    document.getElementById('kpi-total-bazaar').textContent = `৳${metrics.totalBazaar.toFixed(2)}`;
    document.getElementById('kpi-total-shared').textContent = `৳${metrics.totalSharedExpenses.toFixed(2)}`;

    document.getElementById('kpi-total-deposits').textContent = `৳${metrics.totalDeposits.toFixed(2)}`;
    
    const balEl = document.getElementById('kpi-active-balance');
    balEl.textContent = `৳${metrics.activeBalance.toFixed(2)}`;
    if (metrics.activeBalance < 0) {
      balEl.style.color = 'var(--danger-color)';
    } else {
      balEl.style.color = 'var(--success-color)';
    }

    document.getElementById('kpi-total-spent').textContent = `৳${metrics.totalSpent.toFixed(2)}`;
    document.getElementById('kpi-total-members').textContent = this.state.members.length;
  }

  renderDashboard() {
    this.updateGlobalCalculations();
    const metrics = this.getCalculatedMetrics();

    // 1. Render Recent Bazaar List on Dashboard
    const bListContainer = document.getElementById('dash-bazaar-list');
    bListContainer.innerHTML = '';
    
    // Get last 5 bazaar entries sorted by date desc
    const recentBazaar = [...this.state.bazaar]
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 5);

    if (recentBazaar.length === 0) {
      bListContainer.innerHTML = `<div class="empty-state">No bazaar items recorded. Add one to see activity logs!</div>`;
    } else {
      recentBazaar.forEach(item => {
        const buyer = this.state.members.find(m => m.id === item.memberId);
        const buyerName = buyer ? buyer.name : 'Unknown';
        
        const row = document.createElement('div');
        row.className = 'bazaar-item-row';
        row.innerHTML = `
          <div class="bazaar-item-meta">
            <span class="bazaar-item-title">${item.items}</span>
            <span class="bazaar-item-desc">Bought by <strong>${buyerName}</strong> on ${this.formatReadableDate(item.date)}</span>
          </div>
          <span class="bazaar-item-amount">৳${Number(item.amount).toFixed(2)}</span>
        `;
        bListContainer.appendChild(row);
      });
    }

    // 2. Render Member Standing quick summary table
    const mSummaryBody = document.getElementById('dash-members-summary');
    mSummaryBody.innerHTML = '';

    if (this.state.members.length === 0) {
      mSummaryBody.innerHTML = `<tr><td colspan="4" class="center-align">No members registered yet!</td></tr>`;
    } else {
      Object.values(metrics.memberLedgerMap).forEach(ledger => {
        const tr = document.createElement('tr');
        
        const balClass = ledger.netBalance >= 0 ? 'in-credit' : 'in-debit';
        const balLabel = ledger.netBalance >= 0 ? 'Refunding' : 'Owes';
        const balSymbol = ledger.netBalance >= 0 ? '+' : '';
        
        tr.innerHTML = `
          <td><strong>${ledger.member.name}</strong></td>
          <td>${ledger.totalMealsEaten.toFixed(1)}</td>
          <td>৳${ledger.totalDeposits.toFixed(0)}</td>
          <td>
            <span class="status-badge ${balClass}">
              ${balLabel}: ${balSymbol}৳${ledger.netBalance.toFixed(2)}
            </span>
          </td>
        `;
        mSummaryBody.appendChild(tr);
      });
    }
  }

  renderMembers() {
    const metrics = this.getCalculatedMetrics();
    const container = document.getElementById('members-card-container');
    container.innerHTML = '';

    if (this.state.members.length === 0) {
      container.innerHTML = `
        <div class="card empty-state" style="grid-column: 1 / -1; width: 100%;">
          <h3>No Mess Members Yet</h3>
          <p>Register boarders to trace daily meal bookings and expense balances.</p>
          <button class="primary-btn margin-top-2" onclick="app.openMemberModal()">
            Add First Member
          </button>
        </div>
      `;
      return;
    }

    this.state.members.forEach(member => {
      const ledger = metrics.memberLedgerMap[member.id] || {
        totalDeposits: 0,
        totalBazaarContribution: 0,
        totalMealsEaten: 0,
        netBalance: 0
      };

      const balClass = ledger.netBalance >= 0 ? 'positive' : 'negative';
      const balSign = ledger.netBalance >= 0 ? '+' : '';

      const card = document.createElement('div');
      card.className = 'card member-card';
      card.innerHTML = `
        <div class="member-card-header">
          <div class="member-avatar">${member.name.charAt(0)}</div>
          <div class="member-info">
            <h3>${member.name}</h3>
            <p>${member.phone || 'No phone'}</p>
          </div>
        </div>
        
        <div class="member-stats">
          <div class="m-stat">
            <span class="lbl">Deposited</span>
            <span class="val">৳${ledger.totalDeposits.toFixed(0)}</span>
          </div>
          <div class="m-stat">
            <span class="lbl">Bazaar Contribution</span>
            <span class="val">৳${ledger.totalBazaarContribution.toFixed(0)}</span>
          </div>
          <div class="m-stat" style="grid-column: span 2; border-top: 1px solid var(--border-color); padding-top: 12px; margin-top: 4px;">
            <span class="lbl">Total Meals Eaten: <strong>${ledger.totalMealsEaten.toFixed(1)}</strong></span>
          </div>
        </div>

        <div class="member-balance-box">
          <span class="lbl">Net Balance Status</span>
          <span class="val ${balClass}">${balSign}৳${ledger.netBalance.toFixed(2)}</span>
        </div>

        <div class="member-card-actions">
          <button class="secondary-btn small-btn" onclick="app.openMemberLedgerModal('${member.id}')">Detailed Ledger</button>
          <button class="secondary-btn small-btn" onclick="app.openMemberModal('${member.id}')" title="Edit member profiles">Edit Profile</button>
        </div>
      `;
      container.appendChild(card);
    });
  }

  renderMealBook() {
    const todayStr = this.state.selectedMealDate;
    document.getElementById('meal-date-picker').value = todayStr;

    // Get current day's meals map
    const dayMeals = this.state.meals[todayStr] || {};

    // 1. Render active day matrix table
    const matrixBody = document.getElementById('meal-matrix-body');
    matrixBody.innerHTML = '';

    if (this.state.members.length === 0) {
      matrixBody.innerHTML = `<tr><td colspan="5" class="center-align">Please add members first before logging meals!</td></tr>`;
      return;
    }

    this.state.members.forEach(member => {
      const records = dayMeals[member.id] || { breakfast: 0, lunch: 0, dinner: 0 };
      
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${member.name}</strong></td>
        <td class="center-align">
          <input type="number" step="0.5" min="0" max="5" class="meal-input-spinner" 
            id="meal-b-${member.id}" value="${records.breakfast || 0}">
        </td>
        <td class="center-align">
          <input type="number" step="0.5" min="0" max="5" class="meal-input-spinner" 
            id="meal-l-${member.id}" value="${records.lunch || 0}">
        </td>
        <td class="center-align">
          <input type="number" step="0.5" min="0" max="5" class="meal-input-spinner" 
            id="meal-d-${member.id}" value="${records.dinner || 0}">
        </td>
        <td class="center-align" style="font-weight: 700;" id="meal-total-${member.id}">
          ${((Number(records.breakfast) || 0) + (Number(records.lunch) || 0) + (Number(records.dinner) || 0)).toFixed(1)}
        </td>
      `;

      // Live computation update when inputs change
      const updateSum = () => {
        const b = parseFloat(document.getElementById(`meal-b-${member.id}`).value) || 0;
        const l = parseFloat(document.getElementById(`meal-l-${member.id}`).value) || 0;
        const d = parseFloat(document.getElementById(`meal-d-${member.id}`).value) || 0;
        document.getElementById(`meal-total-${member.id}`).textContent = (b + l + d).toFixed(1);
      };

      tr.querySelectorAll('input').forEach(input => {
        input.addEventListener('input', updateSum);
      });

      matrixBody.appendChild(tr);
    });

    // 2. Render monthly totals summary block
    const monthlyBody = document.getElementById('meals-monthly-aggregates');
    monthlyBody.innerHTML = '';

    const monthlyAggregate = {};
    this.state.members.forEach(m => {
      monthlyAggregate[m.id] = { name: m.name, breakfast: 0, lunch: 0, dinner: 0, total: 0 };
    });

    // Loop through meals object to aggregate
    Object.values(this.state.meals).forEach(dayMeals => {
      Object.entries(dayMeals).forEach(([memId, m]) => {
        if (monthlyAggregate[memId]) {
          monthlyAggregate[memId].breakfast += Number(m.breakfast) || 0;
          monthlyAggregate[memId].lunch += Number(m.lunch) || 0;
          monthlyAggregate[memId].dinner += Number(m.dinner) || 0;
          monthlyAggregate[memId].total += (Number(m.breakfast) || 0) + (Number(m.lunch) || 0) + (Number(m.dinner) || 0);
        }
      });
    });

    Object.values(monthlyAggregate).forEach(agg => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${agg.name}</strong></td>
        <td>${agg.breakfast.toFixed(1)}</td>
        <td>${agg.lunch.toFixed(1)}</td>
        <td>${agg.dinner.toFixed(1)}</td>
        <td><strong>${agg.total.toFixed(1)}</strong></td>
      `;
      monthlyBody.appendChild(tr);
    });
  }

  renderBazaar() {
    const body = document.getElementById('bazaar-table-body');
    body.innerHTML = '';

    if (this.state.bazaar.length === 0) {
      body.innerHTML = `<tr><td colspan="5" class="center-align empty-state">No bazaar transactions logged yet!</td></tr>`;
      return;
    }

    // Sort Bazaar by date descending
    const sortedBazaar = [...this.state.bazaar].sort((a, b) => new Date(b.date) - new Date(a.date));

    sortedBazaar.forEach(item => {
      const buyer = this.state.members.find(m => m.id === item.memberId);
      const buyerName = buyer ? buyer.name : 'Deleted Member';
      
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${this.formatReadableDate(item.date)}</td>
        <td><strong>${buyerName}</strong></td>
        <td>${item.items}</td>
        <td class="right-align" style="font-weight: 700;">৳${Number(item.amount).toFixed(2)}</td>
        <td class="center-align">
          <div style="display: flex; gap: 8px; justify-content: center;">
            <button class="secondary-btn small-btn" onclick="app.openBazaarModal('${item.id}')" title="Edit cost details">Edit</button>
            <button class="secondary-btn small-btn" style="color: var(--danger-color);" onclick="app.deleteBazaar('${item.id}')">Delete</button>
          </div>
        </td>
      `;
      body.appendChild(tr);
    });
  }

  renderExpenses() {
    const body = document.getElementById('expenses-table-body');
    body.innerHTML = '';

    if (this.state.otherExpenses.length === 0) {
      body.innerHTML = `<tr><td colspan="5" class="center-align empty-state">No utility shared costs registered!</td></tr>`;
      return;
    }

    // Sort expenses by date descending
    const sortedExpenses = [...this.state.otherExpenses].sort((a, b) => new Date(b.date) - new Date(a.date));

    sortedExpenses.forEach(exp => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${exp.title}</strong></td>
        <td><span class="info-badge">${exp.category}</span></td>
        <td>${this.formatReadableDate(exp.date)}</td>
        <td class="right-align" style="font-weight: 700;">৳${Number(exp.amount).toFixed(2)}</td>
        <td class="center-align">
          <div style="display: flex; gap: 8px; justify-content: center;">
            <button class="secondary-btn small-btn" onclick="app.openExpenseModal('${exp.id}')">Edit</button>
            <button class="secondary-btn small-btn" style="color: var(--danger-color);" onclick="app.deleteExpense('${exp.id}')">Delete</button>
          </div>
        </td>
      `;
      body.appendChild(tr);
    });
  }

  renderReports() {
    this.updateGlobalCalculations();
    const metrics = this.getCalculatedMetrics();
    
    // Render print details info header
    document.getElementById('bill-gen-date').textContent = this.formatReadableDate(new Date());
    document.getElementById('rep-bazaar-cost').textContent = `৳${metrics.totalBazaar.toFixed(2)}`;
    document.getElementById('rep-total-meals').textContent = metrics.totalMeals.toFixed(1);
    document.getElementById('rep-meal-rate').textContent = `৳${metrics.mealRate.toFixed(4)}`;
    document.getElementById('rep-total-shared').textContent = `৳${metrics.totalSharedExpenses.toFixed(2)}`;

    // Render reports main breakdown ledger body
    const body = document.getElementById('reports-ledger-body');
    body.innerHTML = '';

    if (this.state.members.length === 0) {
      body.innerHTML = `<tr><td colspan="8" class="center-align">No mess members configured yet.</td></tr>`;
      return;
    }

    Object.values(metrics.memberLedgerMap).forEach(ledger => {
      const tr = document.createElement('tr');
      
      const isCredit = ledger.netBalance >= 0;
      const statusClass = isCredit ? 'refund' : 'due';
      const verdictLabel = isCredit ? 'Get Refund' : 'Pay Due';
      
      tr.innerHTML = `
        <td><strong>${ledger.member.name}</strong></td>
        <td>৳${ledger.totalDeposits.toFixed(2)}</td>
        <td>৳${ledger.totalBazaarContribution.toFixed(2)}</td>
        <td>${ledger.totalMealsEaten.toFixed(1)}</td>
        <td>৳${ledger.mealCostIncurred.toFixed(2)}</td>
        <td>৳${ledger.sharedCostIncurred.toFixed(2)}</td>
        <td class="right-align verdict-text ${statusClass}">
          ${isCredit ? '+' : ''}৳${ledger.netBalance.toFixed(2)}
        </td>
        <td>
          <span class="status-badge ${isCredit ? 'in-credit' : 'in-debit'}">
            ${verdictLabel}
          </span>
        </td>
      `;
      body.appendChild(tr);
    });
  }

  // ==========================================================================
  // Form Event Handlers & Mutations
  // ==========================================================================
  
  // --- Members Form Submit ---
  handleMemberSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('member-edit-id').value;
    const name = document.getElementById('member-name').value.trim();
    const phone = document.getElementById('member-phone').value.trim();
    const email = document.getElementById('member-email').value.trim();
    const depositVal = parseFloat(document.getElementById('member-deposit').value) || 0;

    if (!name) return;

    if (id) {
      // Edit existing member
      const member = this.state.members.find(m => m.id === id);
      if (member) {
        member.name = name;
        member.phone = phone;
        member.email = email;
      }
    } else {
      // Add new member
      const newId = 'mem-' + Date.now();
      const newMember = { id: newId, name, phone, email };
      this.state.members.push(newMember);

      // Save initial deposit if any
      if (depositVal > 0) {
        this.state.deposits.push({
          id: 'dep-' + Date.now(),
          memberId: newId,
          amount: depositVal,
          date: this.formatDate(new Date()),
          notes: "Initial Capital Deposit"
        });
      }
    }

    this.saveToLocalStorage();
    this.closeAllModals();
    this.switchTab('members');
  }

  // --- Deposit Form Submit ---
  handleDepositSubmit(e) {
    e.preventDefault();
    const memberId = document.getElementById('deposit-member-id').value;
    const amount = parseFloat(document.getElementById('deposit-amount').value);
    const date = document.getElementById('deposit-date').value;
    const notes = document.getElementById('deposit-notes').value.trim();

    if (!memberId || isNaN(amount) || !date) return;

    const newDeposit = {
      id: 'dep-' + Date.now(),
      memberId,
      amount,
      date,
      notes: notes || 'Logged Deposit'
    };

    this.state.deposits.push(newDeposit);
    this.saveToLocalStorage();
    this.closeAllModals();
    
    // Direct routing to members view to verify new balance
    this.switchTab('members');
  }

  // --- Bazaar Form Submit ---
  handleBazaarSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('bazaar-edit-id').value;
    const memberId = document.getElementById('bazaar-member-id').value;
    const amount = parseFloat(document.getElementById('bazaar-amount').value);
    const date = document.getElementById('bazaar-date').value;
    const items = document.getElementById('bazaar-items').value.trim();

    if (!memberId || isNaN(amount) || !date || !items) return;

    if (id) {
      // Edit expense
      const item = this.state.bazaar.find(b => b.id === id);
      if (item) {
        item.memberId = memberId;
        item.amount = amount;
        item.date = date;
        item.items = items;
      }
    } else {
      // Add expense
      const newBazaar = {
        id: 'baz-' + Date.now(),
        memberId,
        amount,
        date,
        items
      };
      this.state.bazaar.push(newBazaar);
    }

    this.saveToLocalStorage();
    this.closeAllModals();
    this.switchTab('bazaar');
  }

  // --- Shared Expense Form Submit ---
  handleExpenseSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('expense-edit-id').value;
    const title = document.getElementById('expense-title').value.trim();
    const category = document.getElementById('expense-category').value;
    const amount = parseFloat(document.getElementById('expense-amount').value);
    const date = document.getElementById('expense-date').value;

    if (!title || !category || isNaN(amount) || !date) return;

    if (id) {
      const exp = this.state.otherExpenses.find(e => e.id === id);
      if (exp) {
        exp.title = title;
        exp.category = category;
        exp.amount = amount;
        exp.date = date;
      }
    } else {
      const newExp = {
        id: 'oth-' + Date.now(),
        title,
        category,
        amount,
        date
      };
      this.state.otherExpenses.push(newExp);
    }

    this.saveToLocalStorage();
    this.closeAllModals();
    this.switchTab('expenses');
  }

  // ==========================================================================
  // Delete Actions
  // ==========================================================================
  deleteBazaar(id) {
    if (confirm("Are you sure you want to delete this bazaar entry? This will immediately recalculate everyone's balances.")) {
      this.state.bazaar = this.state.bazaar.filter(b => b.id !== id);
      this.saveToLocalStorage();
      this.renderBazaar();
    }
  }

  deleteExpense(id) {
    if (confirm("Are you sure you want to delete this shared expense? It will change the split cost of all members.")) {
      this.state.otherExpenses = this.state.otherExpenses.filter(e => e.id !== id);
      this.saveToLocalStorage();
      this.renderExpenses();
    }
  }

  // ==========================================================================
  // Meal Matrix Logging Actions
  // ==========================================================================
  adjustMealDate(daysOffset) {
    const curDate = new Date(this.state.selectedMealDate);
    curDate.setDate(curDate.getDate() + daysOffset);
    this.state.selectedMealDate = this.formatDate(curDate);
    this.renderMealBook();
  }

  saveMealMatrix() {
    const todayStr = this.state.selectedMealDate;
    if (!this.state.meals[todayStr]) {
      this.state.meals[todayStr] = {};
    }

    this.state.members.forEach(member => {
      const b = parseFloat(document.getElementById(`meal-b-${member.id}`).value) || 0;
      const l = parseFloat(document.getElementById(`meal-l-${member.id}`).value) || 0;
      const d = parseFloat(document.getElementById(`meal-d-${member.id}`).value) || 0;

      this.state.meals[todayStr][member.id] = { breakfast: b, lunch: l, dinner: d };
    });

    this.saveToLocalStorage();
    alert(`Meals for date ${this.formatReadableDate(todayStr)} saved successfully! Ledger updated.`);
    this.renderMealBook();
  }

  resetMonthData() {
    if (confirm("WARNING: Are you sure you want to wipe this month's calculations and reset everything? We recommend exporting a JSON database backup before doing this.")) {
      this.state.meals = {};
      this.state.bazaar = [];
      this.state.otherExpenses = [];
      this.state.deposits = [];
      
      this.saveToLocalStorage();
      alert("All monthly records, bazaar entries, deposits, and meals have been successfully reset. Active member accounts are retained.");
      this.switchTab('dashboard');
    }
  }

  // ==========================================================================
  // Modals Open / Close Layout Actions
  // ==========================================================================
  openMemberModal(editId = '') {
    this.resetAllForms();
    const modal = document.getElementById('modal-member');
    const backdrop = document.getElementById('modal-backdrop');
    
    const titleEl = document.getElementById('member-modal-title');
    const depositContainer = document.getElementById('initial-deposit-container');

    if (editId) {
      // Edit mode
      const member = this.state.members.find(m => m.id === editId);
      if (member) {
        titleEl.textContent = 'Edit Member Profile';
        document.getElementById('member-edit-id').value = member.id;
        document.getElementById('member-name').value = member.name;
        document.getElementById('member-phone').value = member.phone || '';
        document.getElementById('member-email').value = member.email || '';
        depositContainer.style.display = 'none'; // Hide initial deposit field during profile edit
      }
    } else {
      // Create mode
      titleEl.textContent = 'Add New Mess Member';
      document.getElementById('member-edit-id').value = '';
      depositContainer.style.display = 'flex';
    }

    backdrop.style.display = 'block';
    modal.style.display = 'flex';
    setTimeout(() => modal.classList.add('active'), 10);
  }

  openDepositModal() {
    this.resetAllForms();
    const modal = document.getElementById('modal-deposit');
    const backdrop = document.getElementById('modal-backdrop');

    // Populate Member dropdown
    const select = document.getElementById('deposit-member-id');
    select.innerHTML = '<option value="">-- Choose Member --</option>';
    this.state.members.forEach(m => {
      select.innerHTML += `<option value="${m.id}">${m.name}</option>`;
    });

    document.getElementById('deposit-date').value = this.formatDate(new Date());

    backdrop.style.display = 'block';
    modal.style.display = 'flex';
    setTimeout(() => modal.classList.add('active'), 10);
  }

  openBazaarModal(editId = '') {
    this.resetAllForms();
    const modal = document.getElementById('modal-bazaar');
    const backdrop = document.getElementById('modal-backdrop');
    const titleEl = document.getElementById('bazaar-modal-title');

    // Populate Member dropdown
    const select = document.getElementById('bazaar-member-id');
    select.innerHTML = '<option value="">-- Choose Buyer --</option>';
    this.state.members.forEach(m => {
      select.innerHTML += `<option value="${m.id}">${m.name}</option>`;
    });

    if (editId) {
      const item = this.state.bazaar.find(b => b.id === editId);
      if (item) {
        titleEl.textContent = 'Edit Bazaar Expense';
        document.getElementById('bazaar-edit-id').value = item.id;
        document.getElementById('bazaar-member-id').value = item.memberId;
        document.getElementById('bazaar-amount').value = item.amount;
        document.getElementById('bazaar-date').value = item.date;
        document.getElementById('bazaar-items').value = item.items;
      }
    } else {
      titleEl.textContent = 'Record Bazaar Expense';
      document.getElementById('bazaar-edit-id').value = '';
      document.getElementById('bazaar-date').value = this.formatDate(new Date());
    }

    backdrop.style.display = 'block';
    modal.style.display = 'flex';
    setTimeout(() => modal.classList.add('active'), 10);
  }

  openExpenseModal(editId = '') {
    this.resetAllForms();
    const modal = document.getElementById('modal-expense');
    const backdrop = document.getElementById('modal-backdrop');
    const titleEl = document.getElementById('expense-modal-title');

    if (editId) {
      const exp = this.state.otherExpenses.find(e => e.id === editId);
      if (exp) {
        titleEl.textContent = 'Edit Shared Expense';
        document.getElementById('expense-edit-id').value = exp.id;
        document.getElementById('expense-title').value = exp.title;
        document.getElementById('expense-category').value = exp.category;
        document.getElementById('expense-amount').value = exp.amount;
        document.getElementById('expense-date').value = exp.date;
      }
    } else {
      titleEl.textContent = 'Add Shared Bill / Utility';
      document.getElementById('expense-edit-id').value = '';
      document.getElementById('expense-date').value = this.formatDate(new Date());
    }

    backdrop.style.display = 'block';
    modal.style.display = 'flex';
    setTimeout(() => modal.classList.add('active'), 10);
  }

  openMemberLedgerModal(memberId) {
    const member = this.state.members.find(m => m.id === memberId);
    if (!member) return;

    const metrics = this.getCalculatedMetrics();
    const ledger = metrics.memberLedgerMap[memberId] || {
      totalDeposits: 0,
      totalBazaarContribution: 0,
      totalMealsEaten: 0,
      mealCostIncurred: 0,
      sharedCostIncurred: 0,
      netBalance: 0
    };

    const isCredit = ledger.netBalance >= 0;
    const balanceSign = isCredit ? '+' : '';
    const balanceClass = isCredit ? 'positive' : 'negative';

    // Set Avatar & Info
    document.getElementById('ledger-member-avatar').textContent = member.name.charAt(0);
    document.getElementById('ledger-member-name').textContent = member.name;
    document.getElementById('ledger-member-contact').textContent = `Phone: ${member.phone || 'N/A'} | Email: ${member.email || 'N/A'}`;
    
    const balEl = document.getElementById('ledger-member-net');
    balEl.innerHTML = `
      <span class="lbl">Net Balance</span>
      <span class="val ${balanceClass}">${balanceSign}৳${ledger.netBalance.toFixed(2)}</span>
    `;

    // Fill Summary KPI
    document.getElementById('ledger-stat-deposits').textContent = `৳${ledger.totalDeposits.toFixed(2)}`;
    document.getElementById('ledger-stat-bazaar').textContent = `৳${ledger.totalBazaarContribution.toFixed(2)}`;
    document.getElementById('ledger-stat-meals').textContent = ledger.totalMealsEaten.toFixed(1);
    document.getElementById('ledger-stat-meal-cost').textContent = `৳${ledger.mealCostIncurred.toFixed(2)}`;
    document.getElementById('ledger-stat-shared-cost').textContent = `৳${ledger.sharedCostIncurred.toFixed(2)}`;

    // Compile logs lists (Deposits & Bazaar) sorted by date
    const logs = [];

    // Filter deposits
    this.state.deposits
      .filter(d => d.memberId === memberId)
      .forEach(d => {
        logs.push({
          date: d.date,
          type: 'Deposit',
          details: d.notes,
          amount: Number(d.amount),
          isPositive: true
        });
      });

    // Filter bazaar
    this.state.bazaar
      .filter(b => b.memberId === memberId)
      .forEach(b => {
        logs.push({
          date: b.date,
          type: 'Bazaar Log',
          details: b.items,
          amount: Number(b.amount),
          isPositive: true // counts as contribution credit
        });
      });

    // Sort by date desc
    logs.sort((a, b) => new Date(b.date) - new Date(a.date));

    const tbody = document.getElementById('ledger-logs-tbody');
    tbody.innerHTML = '';

    if (logs.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" class="center-align">No transactional logs recorded for this member.</td></tr>`;
    } else {
      logs.forEach(log => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${this.formatReadableDate(log.date)}</td>
          <td><span class="info-badge" style="background-color: ${log.type === 'Deposit' ? 'var(--success-bg)' : 'var(--primary-glow)'}; color: ${log.type === 'Deposit' ? 'var(--success-color)' : 'var(--primary-color)'}">${log.type}</span></td>
          <td>${log.details}</td>
          <td class="right-align" style="font-weight: 700; color: var(--text-main);">৳${log.amount.toFixed(2)}</td>
        `;
        tbody.appendChild(tr);
      });
    }

    const modal = document.getElementById('modal-member-ledger');
    const backdrop = document.getElementById('modal-backdrop');
    
    backdrop.style.display = 'block';
    modal.style.display = 'flex';
    setTimeout(() => modal.classList.add('active'), 10);
  }

  closeAllModals() {
    document.querySelectorAll('.modal').forEach(modal => {
      modal.classList.remove('active');
      setTimeout(() => modal.style.display = 'none', 200);
    });
    document.getElementById('modal-backdrop').style.display = 'none';
  }

  resetAllForms() {
    document.getElementById('form-member').reset();
    document.getElementById('form-deposit').reset();
    document.getElementById('form-bazaar').reset();
    document.getElementById('form-expense').reset();
  }

  // ==========================================================================
  // Themes and Utility Functions
  // ==========================================================================
  toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', newTheme);
    
    // Save theme setting
    localStorage.setItem('elitemess_theme', newTheme);
  }

  // --- Import Database Backup JSON ---
  importDatabase(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        
        // Strict Schema validation check
        if (data.members && Array.isArray(data.members) && data.bazaar && data.deposits && data.meals) {
          this.state = {
            members: data.members,
            meals: data.meals,
            bazaar: data.bazaar,
            otherExpenses: data.otherExpenses || [],
            deposits: data.deposits,
            activeTab: 'dashboard',
            selectedMealDate: this.formatDate(new Date())
          };
          this.saveToLocalStorage();
          alert("Mess database backup successfully imported! Layout synchronizing.");
          this.switchTab('dashboard');
        } else {
          alert("Invalid backup file format! Please upload a valid EliteMess database JSON.");
        }
      } catch (err) {
        alert("Failed to parse JSON file! Corrupted file.");
        console.error(err);
      }
    };
    reader.readAsText(file);
    // Reset file input value so same file can be selected again
    event.target.value = '';
  }

  // --- Export Database Backup JSON ---
  exportDatabase() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(this.state, null, 2));
    const downloadAnchor = document.createElement('a');
    
    const formattedDate = this.formatDate(new Date());
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `elitemess_backup_${formattedDate}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  }

  // Formats date object to YYYY-MM-DD
  formatDate(date) {
    const d = new Date(date);
    let month = '' + (d.getMonth() + 1);
    let day = '' + d.getDate();
    const year = d.getFullYear();

    if (month.length < 2) month = '0' + month;
    if (day.length < 2) day = '0' + day;

    return [year, month, day].join('-');
  }

  // Formats YYYY-MM-DD to DD-MMM-YYYY
  formatReadableDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    
    const day = date.getDate();
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    
    return `${day < 10 ? '0' + day : day}-${month}-${year}`;
  }
}

// Instantiate App on Page Load
let app;
window.addEventListener('DOMContentLoaded', () => {
  // Load saved theme settings from localStorage
  const savedTheme = localStorage.getItem('elitemess_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);

  app = new MessManagementApp();
});
