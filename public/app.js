/* ==========================================================================
   EliteMess - Premium Webapp Core Controller & Express + PostgreSQL REST Client
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

    this.hasUnsavedMealEdits = false;

    // DOM Binding and Listeners
    this.init();
  }

  // ==========================================================================
  // Initialization & Express API Synchronization
  // ==========================================================================
  async init() {
    console.log("Initializing EliteMess client and establishing server connections...");
    
    // 1. Initialize DOM event listeners immediately so buttons work instantly!
    this.bindEvents();

    // 2. Load cached data from LocalStorage first so the user sees their data INSTANTLY on refresh!
    this.loadFromLocalStorage();

    // 3. Verify session role access
    this.checkSession();

    // 4. Perform initial UI render with local state (loaded from cache)
    this.switchTab(this.state.activeTab);
    this.updateGlobalCalculations();

    // 5. Fetch live data from Express Server and update cache
    await this.loadFromServer();

    // 6. Setup smart polling: Fetch live data from the server every 5 seconds.
    // This provides a fully real-time synced experience across all phones & devices!
    setInterval(() => this.loadFromServer(), 5000);
  }

  // --- Fetch entire relational state from Express server ---
  async loadFromServer(forceRender = false) {
    try {
      const res = await fetch('/api/mess-data');
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const data = await res.json();
      
      if (data && data.members) {
        this.state.members = data.members || [];
        this.state.bazaar = data.bazaar || [];
        this.state.otherExpenses = data.otherExpenses || [];
        this.state.deposits = data.deposits || [];
        
        // Only overwrite meals state if there are no unsaved local edits or if we force it
        if (!this.hasUnsavedMealEdits || forceRender) {
          this.state.meals = data.meals || {};
        }
        
        // Save to LocalStorage as a cached backup
        this.saveToLocalStorage();

        // Re-render active views with fresh server data
        // Bypass rendering meals tab in background polling to prevent cursor jump/overwrite!
        if (this.state.activeTab !== 'meals' || forceRender) {
          this.renderActiveTabContent();
        }
        this.updateGlobalCalculations();
      }
    } catch (err) {
      console.warn("Express Server connection failed. App running in standalone fallback mode.", err);
      // Local fallback: load from LocalStorage to keep user's state intact
      this.loadFromLocalStorage(forceRender);
    }
  }

  // --- Helper: Save complete state to LocalStorage ---
  saveToLocalStorage() {
    try {
      localStorage.setItem('elitemess_state', JSON.stringify({
        members: this.state.members,
        meals: this.state.meals,
        bazaar: this.state.bazaar,
        otherExpenses: this.state.otherExpenses,
        deposits: this.state.deposits
      }));
    } catch (err) {
      console.error("Failed to save to localStorage", err);
    }
  }

  // --- Helper: Load complete state from LocalStorage ---
  loadFromLocalStorage(forceRender = false) {
    try {
      const raw = localStorage.getItem('elitemess_state');
      if (raw) {
        const parsed = JSON.parse(raw);
        this.state.members = parsed.members || [];
        this.state.bazaar = parsed.bazaar || [];
        this.state.otherExpenses = parsed.otherExpenses || [];
        this.state.deposits = parsed.deposits || [];
        
        // Only overwrite meals state if there are no active unsaved edits or if we force it
        if (!this.hasUnsavedMealEdits || forceRender) {
          this.state.meals = parsed.meals || {};
        }
        
        // Re-render active views
        if (this.state.activeTab !== 'meals' || forceRender) {
          this.renderActiveTabContent();
        }
        this.updateGlobalCalculations();
        console.log("EliteMess successfully loaded backup state from localStorage.");
        return true;
      }
    } catch (err) {
      console.error("Failed to load from localStorage", err);
    }
    
    // Seed initial local fallback data if completely empty so the user doesn't see a blank slate
    if (this.state.members.length === 0) {
      this.seedLocalMockData();
    }
    return false;
  }

  // --- Helper: Seed realistic offline fallback mock data ---
  seedLocalMockData() {
    console.log("Seeding beautiful local mock data...");
    const today = new Date();
    const dStr = (offset) => {
      const d = new Date(today);
      d.setDate(today.getDate() - offset);
      return this.formatDate(d);
    };

    this.state.members = [
      { id: 'mem-1', name: 'Rakib Ahmed', phone: '01711223344', email: 'rakib@gmail.com' },
      { id: 'mem-2', name: 'Abir Hasan', phone: '01999887766', email: 'abir@gmail.com' },
      { id: 'mem-3', name: 'Sajid Islam', phone: '01555443322', email: 'sajid@gmail.com' }
    ];

    this.state.deposits = [
      { id: 'dep-1', memberId: 'mem-1', amount: 3000, date: dStr(5), notes: 'Bkash Deposit' },
      { id: 'dep-2', memberId: 'mem-2', amount: 2500, date: dStr(5), notes: 'Cash Deposit' },
      { id: 'dep-3', memberId: 'mem-3', amount: 3500, date: dStr(5), notes: 'Cash Deposit' },
      { id: 'dep-4', memberId: 'mem-1', amount: 1000, date: dStr(2), notes: 'Hand Cash' }
    ];

    this.state.bazaar = [
      { id: 'baz-1', memberId: 'mem-1', amount: 1450, date: dStr(4), items: 'Beef 2kg, Cooking Oil 2L, Onions, Spices' },
      { id: 'baz-2', memberId: 'mem-2', amount: 820, date: dStr(3), items: 'Miniket Rice 10kg, Potato 5kg, Lentils 2kg' },
      { id: 'baz-3', memberId: 'mem-3', amount: 560, date: dStr(1), items: 'Chicken 1.5kg, Eggs 1 Dozen, Green Chillies' }
    ];

    this.state.otherExpenses = [
      { id: 'oth-1', title: 'Internet Wi-Fi', category: 'Internet', amount: 600, date: dStr(4) },
      { id: 'oth-2', title: 'Electricity Bill', category: 'Electricity', amount: 1200, date: dStr(2) }
    ];

    this.state.meals = {};
    for (let i = 0; i < 5; i++) {
      const dateStr = dStr(i);
      this.state.meals[dateStr] = {
        'mem-1': { breakfast: i === 0 ? 0.5 : 1, lunch: 1, dinner: 1 },
        'mem-2': { breakfast: 0, lunch: 1, dinner: 1 },
        'mem-3': { breakfast: 1, lunch: 1, dinner: 1 }
      };
    }

    this.saveToLocalStorage();
    this.renderActiveTabContent();
    this.updateGlobalCalculations();
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
    document.getElementById('btn-add-bazaar-item').addEventListener('click', () => this.createBazaarItemRow());
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
      
      // Reset active edit states when switching date via picker
      this.hasUnsavedMealEdits = false;
      const saveBtn = document.getElementById('btn-save-meals');
      if (saveBtn) {
        saveBtn.textContent = '💾 Save Meals';
        saveBtn.style.boxShadow = '';
      }

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
    this.closeMobileMenu();
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
        if (this.currentUser && this.currentUser.role === 'member') {
          titleEl.textContent = `Welcome, ${this.currentUser.name}!`;
          subEl.textContent = 'Personal boarder account ledger and meal reservations';
        } else {
          titleEl.textContent = 'Dashboard Overview';
          subEl.textContent = 'Live financial audit and overview of your shared mess workspace';
        }
        break;
      case 'members':
        titleEl.textContent = 'Mess Members';
        subEl.textContent = 'Register, edit, view ledger history, and trace cash dues of mess boarders';
        break;
      case 'meals':
        titleEl.textContent = 'Daily Meal Book';
        subEl.textContent = 'Add daily breakfast, lunch, and dinner records on an interactive grid';
        break;
      case 'bazaar':
        titleEl.textContent = 'Grocery Bazaar Log';
        subEl.textContent = 'Record grocery purchases made by mess members to credit their ledger';
        break;
      case 'expenses':
        titleEl.textContent = 'Shared Utility Expenses';
        subEl.textContent = 'Log utilities, water, gas, Wi-Fi, rent, and household shared bills';
        break;
      case 'reports':
        titleEl.textContent = 'Final Settled Statements';
        subEl.textContent = 'Audit-grade billing invoice sheet. Printable as physical copy or PDF report';
        break;
    }

    this.renderActiveTabContent();
  }

  renderActiveTabContent() {
    const tabName = this.state.activeTab;
    switch (tabName) {
      case 'dashboard':
        this.renderDashboard();
        break;
      case 'members':
        this.renderMembers();
        break;
      case 'meals':
        this.renderMealBook();
        break;
      case 'bazaar':
        this.renderBazaar();
        break;
      case 'expenses':
        this.renderExpenses();
        break;
      case 'reports':
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
    const isMember = this.currentUser && this.currentUser.role === 'member';
    const ledger = isMember ? metrics.memberLedgerMap[this.currentUser.memberId] : null;

    if (isMember && ledger) {
      // 1. Personalized Boarder Dashboard metrics
      
      // Update Labels dynamically to make it crystal clear to the boarder
      document.getElementById('kpi-label-1').textContent = 'Meal Rate (Mess)';
      document.getElementById('kpi-sublabel-1').textContent = 'Dynamic rate of the mess';
      document.getElementById('kpi-meal-rate').textContent = `৳${metrics.mealRate.toFixed(2)}`;

      document.getElementById('kpi-label-2').textContent = 'My Meals Eaten';
      document.getElementById('kpi-sublabel-2').textContent = 'Eaten by me this month';
      document.getElementById('kpi-total-meals').textContent = ledger.totalMealsEaten.toFixed(1);

      document.getElementById('kpi-label-3').textContent = 'My Meal Cost';
      document.getElementById('kpi-sublabel-3').textContent = 'My meals × dynamic meal rate';
      document.getElementById('kpi-total-bazaar').textContent = `৳${ledger.mealCostIncurred.toFixed(2)}`;

      document.getElementById('kpi-label-4').textContent = 'My Utility Share';
      document.getElementById('kpi-sublabel-4').textContent = 'Equal split of fixed utilities';
      document.getElementById('kpi-total-shared').textContent = `৳${ledger.sharedCostIncurred.toFixed(2)}`;

      // Secondary personalized metrics
      document.getElementById('sub-kpi-label-1').textContent = 'My Total Deposits';
      document.getElementById('kpi-total-deposits').textContent = `৳${ledger.totalDeposits.toFixed(2)}`;

      document.getElementById('sub-kpi-label-2').textContent = 'My Net Dues / Balance';
      const balEl = document.getElementById('kpi-active-balance');
      const isCredit = ledger.netBalance >= 0;
      balEl.textContent = `${isCredit ? '+' : ''}৳${ledger.netBalance.toFixed(2)} (${isCredit ? 'Refund' : 'Owes'})`;
      if (isCredit) {
        balEl.style.color = 'var(--success-color)';
      } else {
        balEl.style.color = 'var(--danger-color)';
      }

      document.getElementById('sub-kpi-label-3').textContent = 'My Total Expenses';
      const myExpenses = ledger.mealCostIncurred + ledger.sharedCostIncurred;
      document.getElementById('kpi-total-spent').textContent = `৳${myExpenses.toFixed(2)}`;

      document.getElementById('sub-kpi-label-4').textContent = 'My Bazaar Logs';
      document.getElementById('kpi-total-members').textContent = `৳${ledger.totalBazaarContribution.toFixed(2)}`;
    } else {
      // 2. Manager / Global Mess Dashboard metrics
      
      // Restore default labels
      document.getElementById('kpi-label-1').textContent = 'Meal Rate';
      document.getElementById('kpi-sublabel-1').textContent = 'Calculated dynamically';
      document.getElementById('kpi-meal-rate').textContent = `৳${metrics.mealRate.toFixed(2)}`;

      document.getElementById('kpi-label-2').textContent = 'Total Meals';
      document.getElementById('kpi-sublabel-2').textContent = 'Eaten by all members';
      document.getElementById('kpi-total-meals').textContent = metrics.totalMeals.toFixed(1);

      document.getElementById('kpi-label-3').textContent = 'Bazaar Expenses';
      document.getElementById('kpi-sublabel-3').textContent = 'Total grocery cost';
      document.getElementById('kpi-total-bazaar').textContent = `৳${metrics.totalBazaar.toFixed(2)}`;

      document.getElementById('kpi-label-4').textContent = 'Shared / Fixed Cost';
      document.getElementById('kpi-sublabel-4').textContent = 'Utilities, Rent, Internet';
      document.getElementById('kpi-total-shared').textContent = `৳${metrics.totalSharedExpenses.toFixed(2)}`;

      // Restore default secondary labels
      document.getElementById('sub-kpi-label-1').textContent = 'Total Deposits';
      document.getElementById('kpi-total-deposits').textContent = `৳${metrics.totalDeposits.toFixed(2)}`;

      document.getElementById('sub-kpi-label-2').textContent = 'Active Balance';
      const balEl = document.getElementById('kpi-active-balance');
      balEl.textContent = `৳${metrics.activeBalance.toFixed(2)}`;
      if (metrics.activeBalance < 0) {
        balEl.style.color = 'var(--danger-color)';
      } else {
        balEl.style.color = 'var(--success-color)';
      }

      document.getElementById('sub-kpi-label-3').textContent = 'Total Budget Spent';
      document.getElementById('kpi-total-spent').textContent = `৳${metrics.totalSpent.toFixed(2)}`;

      document.getElementById('sub-kpi-label-4').textContent = 'Total Members';
      document.getElementById('kpi-total-members').textContent = this.state.members.length;
    }
  }

  renderDashboard() {
    const metrics = this.getCalculatedMetrics();

    // 1. Render Recent Bazaar List on Dashboard
    const bListContainer = document.getElementById('dash-bazaar-list');
    bListContainer.innerHTML = '';
    
    // Get last 5 bazaar entries sorted by date desc
    const recentBazaar = [...this.state.bazaar]
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 5);

    if (recentBazaar.length === 0) {
      bListContainer.innerHTML = `<div class="empty-state">No bazaar logged yet.</div>`;
    } else {
      recentBazaar.forEach(item => {
        const buyer = this.state.members.find(m => m.id === item.memberId);
        const buyerName = buyer ? buyer.name : 'Unknown';
        
        // Parse items as JSON or fallback to legacy text
        let itemsTitle = '';
        try {
          const parsedItems = JSON.parse(item.items);
          if (Array.isArray(parsedItems)) {
            itemsTitle = parsedItems.map(it => `${it.name} (${it.qty || '1'})`).join(', ');
          } else {
            itemsTitle = item.items;
          }
        } catch (e) {
          itemsTitle = item.items;
        }

        const row = document.createElement('div');
        row.className = 'bazaar-item-row';
        row.innerHTML = `
          <div class="bazaar-item-meta">
            <span class="bazaar-item-title">${itemsTitle}</span>
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

    const isMember = this.currentUser && this.currentUser.role === 'member';

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
          ${(!isMember || member.id === this.currentUser.memberId) ? `<button class="secondary-btn small-btn" onclick="app.openMemberModal('${member.id}')" title="Edit member profiles">Edit Profile</button>` : ''}
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

    // Calculate difference in days for 2-day lock check
    const selectedDate = new Date(todayStr + 'T00:00:00');
    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);
    const diffTime = selectedDate.getTime() - todayDate.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    const isMember = this.currentUser && this.currentUser.role === 'member';
    const isLocked = isMember && diffDays < 2;

    const lockAlert = document.getElementById('meal-booking-lock-alert');
    const saveBtn = document.getElementById('btn-save-meals');

    if (isLocked) {
      if (lockAlert) {
        lockAlert.style.display = 'inline-flex';
        lockAlert.className = 'alert-lock-message';
        lockAlert.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 4px;"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          🔒 Locked: Bookings must be placed at least 2 days in advance. (Current: ${diffDays <= 0 ? 'Past/Today' : diffDays + ' day advance'})
        `;
      }
      if (saveBtn) saveBtn.style.display = 'none';
    } else {
      if (lockAlert) lockAlert.style.display = 'none';
      if (saveBtn) saveBtn.style.display = 'inline-block';
    }

    this.state.members.forEach(member => {
      const records = dayMeals[member.id] || { breakfast: 0, lunch: 0, dinner: 0 };
      const isInputDisabled = isLocked || (isMember && member.id !== this.currentUser.memberId);
      
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${member.name}</strong> ${isMember && member.id === this.currentUser.memberId ? '<span class="info-badge" style="background: var(--primary-glow); color: var(--primary-color);">You</span>' : ''}</td>
        <td class="center-align">
          <input type="number" step="0.5" min="0" max="5" class="meal-input-spinner" 
            id="meal-b-${member.id}" value="${records.breakfast || 0}" ${isInputDisabled ? 'disabled' : ''}>
        </td>
        <td class="center-align">
          <input type="number" step="0.5" min="0" max="5" class="meal-input-spinner" 
            id="meal-l-${member.id}" value="${records.lunch || 0}" ${isInputDisabled ? 'disabled' : ''}>
        </td>
        <td class="center-align">
          <input type="number" step="0.5" min="0" max="5" class="meal-input-spinner" 
            id="meal-d-${member.id}" value="${records.dinner || 0}" ${isInputDisabled ? 'disabled' : ''}>
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
        
        // Mark local edits active to prevent background polling from overriding them!
        this.hasUnsavedMealEdits = true;
        const saveBtn = document.getElementById('btn-save-meals');
        if (saveBtn) {
          saveBtn.textContent = '💾 Save Meals (Unsaved Changes)';
          saveBtn.style.boxShadow = '0 0 12px var(--success-color)';
        }
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

    const isMember = this.currentUser && this.currentUser.role === 'member';

    sortedBazaar.forEach(item => {
      const buyer = this.state.members.find(m => m.id === item.memberId);
      const buyerName = buyer ? buyer.name : 'Deleted Member';
      
      // Parse items as JSON or fallback to legacy text
      let itemsHtml = '';
      try {
        const parsedItems = JSON.parse(item.items);
        if (Array.isArray(parsedItems)) {
          itemsHtml = `<div class="itemized-badges">` + 
            parsedItems.map((it, idx) => {
              const hue = (idx * 137.5) % 360;
              return `<span class="item-badge" style="background: hsla(${hue}, 70%, 50%, 0.12); border: 1px solid hsla(${hue}, 70%, 50%, 0.3); color: hsl(${hue}, 85%, 65%);" title="${it.name}">${it.name} (${it.qty || '1'}): <strong style="color: var(--success-color); margin-left: 4px;">৳${it.price}</strong></span>`;
            }).join('') + 
            `</div>`;
        } else {
          itemsHtml = item.items;
        }
      } catch (e) {
        itemsHtml = item.items;
      }

      const actionsHtml = isMember ? `
        <span class="info-badge" style="background: rgba(255,255,255,0.03); color: var(--text-muted); padding: 4px 8px;">View Only</span>
      ` : `
        <div style="display: flex; gap: 8px; justify-content: center;">
          <button class="secondary-btn small-btn" onclick="app.openBazaarModal('${item.id}')" title="Edit cost details">Edit</button>
          <button class="secondary-btn small-btn" style="color: var(--danger-color);" onclick="app.deleteBazaar('${item.id}')">Delete</button>
        </div>
      `;

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${this.formatReadableDate(item.date)}</td>
        <td><strong>${buyerName}</strong></td>
        <td>${itemsHtml}</td>
        <td class="right-align" style="font-weight: 700;">৳${Number(item.amount).toFixed(2)}</td>
        <td class="center-align">
          ${actionsHtml}
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

    const isMember = this.currentUser && this.currentUser.role === 'member';

    sortedExpenses.forEach(exp => {
      const actionsHtml = isMember ? `
        <span class="info-badge" style="background: rgba(255,255,255,0.03); color: var(--text-muted); padding: 4px 8px;">View Only</span>
      ` : `
        <div style="display: flex; gap: 8px; justify-content: center;">
          <button class="secondary-btn small-btn" onclick="app.openExpenseModal('${exp.id}')">Edit</button>
          <button class="secondary-btn small-btn" style="color: var(--danger-color);" onclick="app.deleteExpense('${exp.id}')">Delete</button>
        </div>
      `;

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${exp.title}</strong></td>
        <td><span class="info-badge">${exp.category}</span></td>
        <td>${this.formatReadableDate(exp.date)}</td>
        <td class="right-align" style="font-weight: 700;">৳${Number(exp.amount).toFixed(2)}</td>
        <td class="center-align">
          ${actionsHtml}
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
  // Form Event Handlers & Mutations (HTTP Fetch REST integration)
  // ==========================================================================
  
  // --- Members Form Submit ---
  async handleMemberSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('member-edit-id').value;
    const name = document.getElementById('member-name').value.trim();
    const phone = document.getElementById('member-phone').value.trim();
    const email = document.getElementById('member-email').value.trim();
    const password = document.getElementById('member-password').value.trim() || '1234';
    const depositVal = parseFloat(document.getElementById('member-deposit').value) || 0;

    if (!name) return;

    const targetId = id || 'mem-' + Date.now();
    const localMember = { id: targetId, name, phone, email, password };
    const payload = { id, name, phone, email, password, initialDeposit: depositVal };
    
    try {
      const res = await fetch('/api/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (res.ok) {
        this.closeAllModals();
        await this.loadFromServer();
        this.switchTab('members');
        return;
      }
    } catch (err) {
      console.warn("Server POST failed. Performing local storage fallback.", err);
    }

    // Local Fallback: Update locally and save to cache
    if (id) {
      this.state.members = this.state.members.map(m => m.id === id ? localMember : m);
    } else {
      this.state.members.push(localMember);
      if (depositVal > 0) {
        this.state.deposits.push({
          id: 'dep-' + Date.now(),
          memberId: targetId,
          amount: depositVal,
          date: this.formatDate(new Date()),
          notes: "Initial Capital Deposit"
        });
      }
    }
    this.saveToLocalStorage();
    this.closeAllModals();
    this.renderActiveTabContent();
    this.updateGlobalCalculations();
    this.switchTab('members');
  }

  // --- Deposit Form Submit ---
  async handleDepositSubmit(e) {
    e.preventDefault();
    const memberId = document.getElementById('deposit-member-id').value;
    const amount = parseFloat(document.getElementById('deposit-amount').value);
    const date = document.getElementById('deposit-date').value;
    const notes = document.getElementById('deposit-notes').value.trim();

    if (!memberId || isNaN(amount) || !date) return;

    const payload = { memberId, amount, date, notes };

    try {
      const res = await fetch('/api/deposits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (res.ok) {
        this.closeAllModals();
        await this.loadFromServer();
        this.switchTab('members');
        return;
      }
    } catch (err) {
      console.warn("Server POST failed. Performing local storage fallback.", err);
    }

    // Local Fallback: Update locally and save to cache
    this.state.deposits.push({
      id: 'dep-' + Date.now(),
      memberId,
      amount,
      date,
      notes: notes || 'Logged Deposit'
    });
    this.saveToLocalStorage();
    this.closeAllModals();
    this.renderActiveTabContent();
    this.updateGlobalCalculations();
    this.switchTab('members');
  }

  // --- Bazaar Form Submit ---
  async handleBazaarSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('bazaar-edit-id').value;
    const memberId = document.getElementById('bazaar-member-id').value;
    const amount = parseFloat(document.getElementById('bazaar-amount').value);
    const date = document.getElementById('bazaar-date').value;

    if (!memberId || isNaN(amount) || amount <= 0 || !date) {
      alert("Please ensure a buyer is chosen, date is valid, and total cost is greater than 0.");
      return;
    }

    // Build itemized JSON array from input rows
    const itemRows = [];
    document.querySelectorAll('.bazaar-item-form-row').forEach(row => {
      const name = row.querySelector('.baz-it-name').value.trim();
      const qty = row.querySelector('.baz-it-qty').value.trim() || '1';
      const price = parseFloat(row.querySelector('.baz-it-price').value) || 0;
      if (name) {
        itemRows.push({ name, qty, price });
      }
    });

    if (itemRows.length === 0) {
      alert("Please add at least one item with a name.");
      return;
    }

    const items = JSON.stringify(itemRows);
    const payload = { id, memberId, amount, date, items };

    try {
      const res = await fetch('/api/bazaar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (res.ok) {
        this.closeAllModals();
        await this.loadFromServer();
        this.switchTab('bazaar');
        return;
      }
    } catch (err) {
      console.warn("Server POST failed. Performing local storage fallback.", err);
    }

    // Local Fallback: Update locally and save to cache
    const targetId = id || 'baz-' + Date.now();
    const localBazaar = { id: targetId, memberId, amount, date, items };
    if (id) {
      this.state.bazaar = this.state.bazaar.map(b => b.id === id ? localBazaar : b);
    } else {
      this.state.bazaar.push(localBazaar);
    }
    this.saveToLocalStorage();
    this.closeAllModals();
    this.renderActiveTabContent();
    this.updateGlobalCalculations();
    this.switchTab('bazaar');
  }

  // --- Shared Expense Form Submit ---
  async handleExpenseSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('expense-edit-id').value;
    const title = document.getElementById('expense-title').value.trim();
    const category = document.getElementById('expense-category').value;
    const amount = parseFloat(document.getElementById('expense-amount').value);
    const date = document.getElementById('expense-date').value;

    if (!title || !category || isNaN(amount) || !date) return;

    const payload = { id, title, category, amount, date };

    try {
      const res = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (res.ok) {
        this.closeAllModals();
        await this.loadFromServer();
        this.switchTab('expenses');
        return;
      }
    } catch (err) {
      console.warn("Server POST failed. Performing local storage fallback.", err);
    }

    // Local Fallback: Update locally and save to cache
    const targetId = id || 'oth-' + Date.now();
    const localExpense = { id: targetId, title, category, amount, date };
    if (id) {
      this.state.otherExpenses = this.state.otherExpenses.map(e => e.id === id ? localExpense : e);
    } else {
      this.state.otherExpenses.push(localExpense);
    }
    this.saveToLocalStorage();
    this.closeAllModals();
    this.renderActiveTabContent();
    this.updateGlobalCalculations();
    this.switchTab('expenses');
  }

  // ==========================================================================
  // Delete Actions
  // ==========================================================================
  async deleteBazaar(id) {
    if (confirm("Are you sure you want to delete this bazaar entry? This will immediately recalculate everyone's balances.")) {
      try {
        const res = await fetch(`/api/bazaar/${id}`, { method: 'DELETE' });
        if (res.ok) {
          await this.loadFromServer();
          return;
        }
      } catch (err) {
        console.warn("Server DELETE failed. Performing local storage fallback.", err);
      }

      // Local Fallback: Remove locally and save to cache
      this.state.bazaar = this.state.bazaar.filter(b => b.id !== id);
      this.saveToLocalStorage();
      this.renderActiveTabContent();
      this.updateGlobalCalculations();
    }
  }

  async deleteExpense(id) {
    if (confirm("Are you sure you want to delete this shared expense? It will change the split cost of all members.")) {
      try {
        const res = await fetch(`/api/expenses/${id}`, { method: 'DELETE' });
        if (res.ok) {
          await this.loadFromServer();
          return;
        }
      } catch (err) {
        console.warn("Server DELETE failed. Performing local storage fallback.", err);
      }

      // Local Fallback: Remove locally and save to cache
      this.state.otherExpenses = this.state.otherExpenses.filter(e => e.id !== id);
      this.saveToLocalStorage();
      this.renderActiveTabContent();
      this.updateGlobalCalculations();
    }
  }

  // ==========================================================================
  // Meal Matrix Logging Actions
  // ==========================================================================
  adjustMealDate(daysOffset) {
    const curDate = new Date(this.state.selectedMealDate);
    curDate.setDate(curDate.getDate() + daysOffset);
    this.state.selectedMealDate = this.formatDate(curDate);
    
    // Clear unsaved edits flag and button visuals when changing dates
    this.hasUnsavedMealEdits = false;
    const saveBtn = document.getElementById('btn-save-meals');
    if (saveBtn) {
      saveBtn.textContent = '💾 Save Meals';
      saveBtn.style.boxShadow = '';
    }

    this.renderMealBook();
  }

  async saveMealMatrix() {
    const todayStr = this.state.selectedMealDate;
    const memberMeals = [];

    this.state.members.forEach(member => {
      const b = parseFloat(document.getElementById(`meal-b-${member.id}`).value) || 0;
      const l = parseFloat(document.getElementById(`meal-l-${member.id}`).value) || 0;
      const d = parseFloat(document.getElementById(`meal-d-${member.id}`).value) || 0;
      memberMeals.push({ memberId: member.id, breakfast: b, lunch: l, dinner: d });
    });

    try {
      const res = await fetch('/api/meals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: todayStr, memberMeals })
      });
      
      if (res.ok) {
        // Reset unsaved flag and button visuals on success
        this.hasUnsavedMealEdits = false;
        const saveBtn = document.getElementById('btn-save-meals');
        if (saveBtn) {
          saveBtn.textContent = '💾 Save Meals';
          saveBtn.style.boxShadow = '';
        }

        alert(`Meals for date ${this.formatReadableDate(todayStr)} saved successfully! Cloud updated.`);
        await this.loadFromServer(true);
        return;
      }
    } catch (err) {
      console.warn("Server POST failed. Performing local storage fallback.", err);
    }

    // Local Fallback: Update locally and save to cache
    if (!this.state.meals[todayStr]) {
      this.state.meals[todayStr] = {};
    }
    memberMeals.forEach(m => {
      this.state.meals[todayStr][m.memberId] = {
        breakfast: m.breakfast,
        lunch: m.lunch,
        dinner: m.dinner
      };
    });

    // Reset unsaved flag and button visuals for local backup as well
    this.hasUnsavedMealEdits = false;
    const saveBtn = document.getElementById('btn-save-meals');
    if (saveBtn) {
      saveBtn.textContent = '💾 Save Meals';
      saveBtn.style.boxShadow = '';
    }

    this.saveToLocalStorage();
    alert(`Meals for date ${this.formatReadableDate(todayStr)} saved successfully (Offline local backup)!`);
    this.renderMealBook();
  }

  async resetMonthData() {
    if (confirm("WARNING: Are you sure you want to wipe this month's calculations and reset everything? We recommend exporting a JSON database backup before doing this.")) {
      try {
        const res = await fetch('/api/reset', { method: 'POST' });
        if (res.ok) {
          alert("All monthly records, bazaar entries, deposits, and meals have been successfully reset. Active member accounts are retained.");
          await this.loadFromServer();
          this.switchTab('dashboard');
          return;
        }
      } catch (err) {
        console.warn("Server POST failed. Performing local storage fallback.", err);
      }

      // Local Fallback: Reset transactional states and cache
      this.state.meals = {};
      this.state.bazaar = [];
      this.state.otherExpenses = [];
      this.state.deposits = [];
      this.saveToLocalStorage();
      alert("All monthly records, bazaar entries, deposits, and meals have been successfully reset locally.");
      this.renderActiveTabContent();
      this.updateGlobalCalculations();
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
        document.getElementById('member-password').value = member.password || '1234';
        depositContainer.style.display = 'none'; // Hide initial deposit field during profile edit
      }
    } else {
      // Create mode
      titleEl.textContent = 'Add New Mess Member';
      document.getElementById('member-edit-id').value = '';
      document.getElementById('member-password').value = '';
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

  // --- Helper: Create a single dynamic grocery item input row in bazaar modal ---
  createBazaarItemRow(name = '', qty = '', price = 0) {
    const container = document.getElementById('bazaar-items-list');
    const rowId = 'baz-item-row-' + Date.now() + Math.random().toString(36).substr(2, 5);
    
    const row = document.createElement('div');
    row.className = 'bazaar-item-form-row';
    row.id = rowId;
    row.style.display = 'flex';
    row.style.gap = '8px';
    row.style.alignItems = 'center';
    row.style.marginBottom = '6px';
    
    row.innerHTML = `
      <input type="text" placeholder="Item Name (e.g. Beef)" required class="form-control baz-it-name" style="flex: 2; font-size: 0.9rem; padding: 6px 10px;" value="${name}">
      <input type="text" placeholder="Qty (e.g. 2kg)" class="form-control baz-it-qty" style="flex: 1; font-size: 0.9rem; padding: 6px 10px;" value="${qty}">
      <input type="number" min="0" placeholder="Price" required class="form-control baz-it-price" style="width: 100px; font-size: 0.9rem; padding: 6px 10px;" value="${price || ''}">
      <button type="button" class="secondary-btn btn-delete-baz-item" style="color: var(--danger-color); padding: 6px 10px; min-width: auto; height: 35px; display: flex; align-items: center; justify-content: center;" title="Remove Item">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" class="bi bi-trash" viewBox="0 0 16 16">
          <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5Zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5Zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6Z"/>
          <path d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1ZM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118ZM2.5 3h11V2h-11v1Z"/>
        </svg>
      </button>
    `;
    
    // Add delete listener
    row.querySelector('.btn-delete-baz-item').addEventListener('click', () => {
      row.remove();
      this.recalculateBazaarFormTotal();
    });
    
    // Add price change listener to auto-calculate sum
    row.querySelector('.baz-it-price').addEventListener('input', () => {
      this.recalculateBazaarFormTotal();
    });
    
    container.appendChild(row);
  }

  // --- Helper: Recalculate and update the running total cost inside modal ---
  recalculateBazaarFormTotal() {
    let total = 0;
    document.querySelectorAll('.baz-it-price').forEach(input => {
      total += parseFloat(input.value) || 0;
    });
    document.getElementById('bazaar-amount').value = total;
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

    const itemsList = document.getElementById('bazaar-items-list');
    itemsList.innerHTML = '';

    if (editId) {
      const item = this.state.bazaar.find(b => b.id === editId);
      if (item) {
        titleEl.textContent = 'Edit Bazaar Expense';
        document.getElementById('bazaar-edit-id').value = item.id;
        document.getElementById('bazaar-member-id').value = item.memberId;
        document.getElementById('bazaar-amount').value = item.amount;
        document.getElementById('bazaar-date').value = item.date;
        
        try {
          const parsed = JSON.parse(item.items);
          if (Array.isArray(parsed)) {
            parsed.forEach(it => {
              this.createBazaarItemRow(it.name, it.qty, it.price);
            });
          } else {
            // Fallback for plain-text legacy entries
            this.createBazaarItemRow(item.items, '1', item.amount);
          }
        } catch (e) {
          // Fallback for plain-text legacy entries
          this.createBazaarItemRow(item.items, '1', item.amount);
        }
      }
    } else {
      titleEl.textContent = 'Record Bazaar Expense';
      document.getElementById('bazaar-edit-id').value = '';
      document.getElementById('bazaar-date').value = this.formatDate(new Date());
      document.getElementById('bazaar-amount').value = '';
      
      // Auto-inject first empty item row by default
      this.createBazaarItemRow();
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
  async importDatabase(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = JSON.parse(e.target.result);
        
        // Strict Schema validation check
        if (data.members && Array.isArray(data.members) && data.bazaar && data.deposits && data.meals) {
          const res = await fetch('/api/import', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
          });
          
          if (res.ok) {
            alert("Mess database backup successfully imported to PostgreSQL Cloud Database! Layout synchronizing.");
            await this.loadFromServer();
            this.switchTab('dashboard');
          } else {
            alert("Failed to import database on server.");
          }
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

  toggleMobileMenu() {
    const sidebar = document.querySelector('.sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');
    if (sidebar) {
      sidebar.classList.toggle('open');
      if (sidebar.classList.contains('open')) {
        if (backdrop) {
          backdrop.style.display = 'block';
          setTimeout(() => backdrop.classList.add('active'), 10);
        }
      } else {
        if (backdrop) {
          backdrop.classList.remove('active');
          setTimeout(() => backdrop.style.display = 'none', 250);
        }
      }
    }
  }

  closeMobileMenu() {
    const sidebar = document.querySelector('.sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');
    if (sidebar) sidebar.classList.remove('open');
    if (backdrop) {
      backdrop.classList.remove('active');
      setTimeout(() => backdrop.style.display = 'none', 250);
    }
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

  // ==========================================================================
  // Auth & Session Management Helpers (Role-Based Access Control)
  // ==========================================================================
  checkSession() {
    try {
      const rawUser = localStorage.getItem('elitemess_user');
      if (rawUser) {
        this.currentUser = JSON.parse(rawUser);
        this.applyRoleAccessControl();
      } else {
        this.currentUser = null;
        const gateway = document.getElementById('identity-gateway');
        if (gateway) gateway.style.display = 'flex';
        this.resetGateway();
      }
    } catch (e) {
      console.error("Session verification failed", e);
      this.logout();
    }
  }

  applyRoleAccessControl() {
    const gateway = document.getElementById('identity-gateway');
    if (gateway) gateway.style.display = 'none';

    if (!this.currentUser) return;

    const isMember = this.currentUser.role === 'member';

    // 1. Hide or show managerial capabilities
    const quickDepositBtn = document.getElementById('btn-quick-deposit');
    const addMemberBtn = document.getElementById('btn-add-member');
    const addExpenseBtn = document.getElementById('btn-add-expense');
    const addBazaarBtn = document.getElementById('btn-add-bazaar');
    const resetMonthBtn = document.getElementById('btn-reset-month');

    if (isMember) {
      if (quickDepositBtn) quickDepositBtn.style.display = 'none';
      if (addMemberBtn) addMemberBtn.style.display = 'none';
      if (addExpenseBtn) addExpenseBtn.style.display = 'none';
      if (addBazaarBtn) addBazaarBtn.style.display = 'none';
      if (resetMonthBtn) resetMonthBtn.style.display = 'none';
    } else {
      if (quickDepositBtn) quickDepositBtn.style.display = 'inline-flex';
      if (addMemberBtn) addMemberBtn.style.display = 'inline-flex';
      if (addExpenseBtn) addExpenseBtn.style.display = 'inline-flex';
      if (addBazaarBtn) addBazaarBtn.style.display = 'inline-flex';
      if (resetMonthBtn) resetMonthBtn.style.display = 'inline-flex';
    }

    // 2. Refresh active UI tabs
    this.renderActiveTabContent();
  }

  showManagerLogin() {
    const mainOpts = document.getElementById('gateway-main-options');
    const mForm = document.getElementById('manager-login-form');
    if (mainOpts) mainOpts.style.display = 'none';
    if (mForm) mForm.style.display = 'block';
    
    const pinInput = document.getElementById('manager-pin');
    if (pinInput) {
      pinInput.value = '';
      pinInput.focus();
    }
  }

  showBoarderLogin() {
    const mainOpts = document.getElementById('gateway-main-options');
    const bForm = document.getElementById('boarder-login-form');
    const bRegForm = document.getElementById('boarder-registration-form');
    
    if (mainOpts) mainOpts.style.display = 'none';
    if (bRegForm) bRegForm.style.display = 'none';
    if (bForm) bForm.style.display = 'block';
    
    const loginIdInput = document.getElementById('boarder-login-id');
    const loginPassInput = document.getElementById('boarder-login-pass');
    if (loginIdInput) {
      loginIdInput.value = '';
      loginIdInput.focus();
    }
    if (loginPassInput) loginPassInput.value = '';
  }

  showBoarderRegistration() {
    const bForm = document.getElementById('boarder-login-form');
    const bRegForm = document.getElementById('boarder-registration-form');
    
    if (bForm) bForm.style.display = 'none';
    if (bRegForm) bRegForm.style.display = 'block';
    
    // Reset registration form fields
    const nameInput = document.getElementById('reg-name');
    const phoneInput = document.getElementById('reg-phone');
    const emailInput = document.getElementById('reg-email');
    const passwordInput = document.getElementById('reg-password');
    if (nameInput) nameInput.value = '';
    if (phoneInput) phoneInput.value = '';
    if (emailInput) emailInput.value = '';
    if (passwordInput) passwordInput.value = '';
  }

  resetGateway() {
    const mainOpts = document.getElementById('gateway-main-options');
    const mForm = document.getElementById('manager-login-form');
    const bForm = document.getElementById('boarder-login-form');
    const bRegForm = document.getElementById('boarder-registration-form');
    
    if (mForm) mForm.style.display = 'none';
    if (bForm) bForm.style.display = 'none';
    if (bRegForm) bRegForm.style.display = 'none';
    if (mainOpts) mainOpts.style.display = 'grid';
  }

  loginAsManager() {
    const pinInput = document.getElementById('manager-pin');
    const pin = pinInput ? pinInput.value.trim() : '';
    
    if (pin === '1234') {
      this.currentUser = { role: 'manager', name: 'Mess Manager' };
      localStorage.setItem('elitemess_user', JSON.stringify(this.currentUser));
      this.applyRoleAccessControl();
      this.loadFromServer(true);
      if (pinInput) pinInput.value = '';
    } else {
      alert("❌ Incorrect passcode! The default passcode is 1234.");
    }
  }

  loginAsBoarder() {
    const enteredIdInput = document.getElementById('boarder-login-id');
    const enteredPassInput = document.getElementById('boarder-login-pass');
    
    const enteredId = enteredIdInput ? enteredIdInput.value.trim() : '';
    const enteredPass = enteredPassInput ? enteredPassInput.value.trim() : '';
    
    if (!enteredId || !enteredPass) {
      alert("⚠️ Please enter both your Phone Number (or Member ID) and Passcode.");
      return;
    }
    
    // Find member by Phone or ID (case-insensitive for IDs)
    const member = this.state.members.find(m => 
      (m.phone && m.phone.trim() === enteredId) || 
      (m.id && m.id.toLowerCase().trim() === enteredId.toLowerCase())
    );
    
    if (member) {
      // Check passcode (default passcode is 1234)
      const correctPass = member.password ? member.password.trim() : '1234';
      if (enteredPass === correctPass) {
        this.currentUser = { role: 'member', memberId: member.id, name: member.name };
        localStorage.setItem('elitemess_user', JSON.stringify(this.currentUser));
        this.applyRoleAccessControl();
        this.loadFromServer(true);
        if (enteredIdInput) enteredIdInput.value = '';
        if (enteredPassInput) enteredPassInput.value = '';
      } else {
        alert("❌ Incorrect Passcode! The default passcode is 1234 unless customized.");
      }
    } else {
      alert("❌ Member profile not found! Please check your credentials or register as a new member below.");
    }
  }

  async registerAndLoginBoarder() {
    const name = document.getElementById('reg-name').value.trim();
    const phone = document.getElementById('reg-phone').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-password').value.trim();
    
    if (!name || !phone || !password) {
      alert("⚠️ Name, Phone Number, and Passcode are required fields.");
      return;
    }
    
    const payload = { name, phone, email, password };
    
    try {
      const res = await fetch('/api/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (res.ok) {
        const result = await res.json();
        const memberId = result.id;
        
        // Log in immediately under this newly registered member
        this.currentUser = { role: 'member', memberId, name };
        localStorage.setItem('elitemess_user', JSON.stringify(this.currentUser));
        this.applyRoleAccessControl();
        await this.loadFromServer(true);
        return;
      }
    } catch (err) {
      console.warn("Server self-registration failed. Performing offline fallback.", err);
    }
    
    // Offline local storage fallback
    const offlineId = 'mem-' + Date.now();
    const localMember = { id: offlineId, name, phone, email, password };
    this.state.members.push(localMember);
    this.saveToLocalStorage();
    
    this.currentUser = { role: 'member', memberId: offlineId, name };
    localStorage.setItem('elitemess_user', JSON.stringify(this.currentUser));
    this.applyRoleAccessControl();
    this.renderActiveTabContent();
  }

  logout() {
    localStorage.removeItem('elitemess_user');
    this.currentUser = null;
    
    const gateway = document.getElementById('identity-gateway');
    if (gateway) gateway.style.display = 'flex';
    this.resetGateway();
    this.loadFromServer(true);
  }
}

// Instantiate App immediately (DOM is fully parsed when static JS loads from Express server)
const savedTheme = localStorage.getItem('elitemess_theme') || 'dark';
document.documentElement.setAttribute('data-theme', savedTheme);

const app = new MessManagementApp();
window.app = app; // Expose globally to inline HTML event handlers!
