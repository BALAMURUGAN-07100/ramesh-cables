/**
 * RAMESH CABLES AND NET WORK - Core Application
 * Streets 1 to 15 Management (TACTV in 5 Streets)
 * Security PIN Access, Another Box Number, and Street-wise Filing
 */

// Safe DOM helpers to eliminate ANY null element access errors
function setElText(id, val) {
  const el = typeof id === 'string' ? document.getElementById(id) : id;
  if (el) el.textContent = (val !== null && val !== undefined) ? val : '';
}

function setElVal(id, val) {
  const el = typeof id === 'string' ? document.getElementById(id) : id;
  if (el) el.value = (val !== null && val !== undefined) ? val : '';
}

class RameshCablesApp {
  constructor() {
    this.currentMonth = this.getInitialMonth();
    this.operator = 'SCV'; // Default to SCV
    this.status = 'all'; // Default to all so Dad sees customers under selected street
    this.search = '';
    this.street = ''; // Default to '' (All Streets) so all houses are visible on opening!
    this.currentStreetNum = null;
    this.streets = [];
    this.page = 1;
    this.limit = 45;
    this.settings = {};
    this.statsData = null;
    this.selectedCustomer = null;
    this.searchDebounceTimer = null;
    this.toastTimer = null;

    this.init();
  }

  getInitialMonth() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }

  async init() {
    this.setupEventListeners();
    await this.checkAuthStatus();
  }

  // ================= AUTHENTICATION & SECURITY =================
  async checkAuthStatus() {
    try {
      const res = await fetch('/api/auth/status');
      const data = await res.json();
      const overlay = document.getElementById('securityLoginOverlay');

      if (data.authenticated) {
        if (overlay) overlay.classList.add('hidden');
        await this.loadAppContent();
      } else {
        if (overlay) overlay.classList.remove('hidden');
        const pinInput = document.getElementById('loginPinInput');
        if (pinInput) pinInput.focus();
      }
    } catch (e) {
      console.error('Auth check error', e);
    }
  }

  appendPin(digit) {
    const input = document.getElementById('loginPinInput');
    if (input && input.value.length < 6) {
      input.value += digit;
      if (input.value.length === 4) {
        this.submitLogin();
      }
    }
  }

  clearPin() {
    const input = document.getElementById('loginPinInput');
    if (input) input.value = '';
    const err = document.getElementById('loginErrorMsg');
    if (err) err.classList.add('hidden');
  }

  backspacePin() {
    const input = document.getElementById('loginPinInput');
    if (input) input.value = input.value.slice(0, -1);
  }

  async submitLogin() {
    const pin = document.getElementById('loginPinInput').value.trim();
    const errEl = document.getElementById('loginErrorMsg');
    const unlockBtn = document.getElementById('unlockSystemBtn');

    if (!pin) {
      if (errEl) {
        errEl.textContent = 'Please enter your Security PIN';
        errEl.classList.remove('hidden');
      }
      return;
    }

    if (unlockBtn) {
      unlockBtn.disabled = true;
      unlockBtn.innerHTML = 'Verifying...';
    }

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: pin, remember: true })
      });
      const data = await res.json();

      if (data.success) {
        if (errEl) errEl.classList.add('hidden');
        const overlay = document.getElementById('securityLoginOverlay');
        if (overlay) overlay.classList.add('hidden');
        
        this.showToast('✓ Welcome, Ramesh!', 'Access granted to Ramesh Cables system.');
        await this.loadAppContent();
      } else {
        if (errEl) {
          errEl.textContent = data.error || 'Incorrect Security PIN! Try again.';
          errEl.classList.remove('hidden');
        }
        const pinInput = document.getElementById('loginPinInput');
        if (pinInput) pinInput.value = '';
      }
    } catch (e) {
      if (errEl) {
        errEl.textContent = 'Connection error. Please try again.';
        errEl.classList.remove('hidden');
      }
    } finally {
      if (unlockBtn) {
        unlockBtn.disabled = false;
        unlockBtn.innerHTML = '<span>🔓</span><span>Unlock & Enter System</span>';
      }
    }
  }

  async logout() {
    if (!confirm('Do you want to lock the system and logout?')) return;
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      const overlay = document.getElementById('securityLoginOverlay');
      if (overlay) overlay.classList.remove('hidden');
      const pinInput = document.getElementById('loginPinInput');
      if (pinInput) {
        pinInput.value = '';
        pinInput.focus();
      }
    } catch (e) {
      window.location.reload();
    }
  }

  // ================= MAIN CONTENT LOADER =================
  async loadAppContent() {
    await this.loadSettings();
    await this.loadStreets();
    this.updateMonthDisplay();
    this.updateOperatorUI();
    this.updateStatusTabUI();
    await this.refreshAll();
  }

  async loadSettings() {
    try {
      const res = await fetch('/api/settings');
      if (res.status === 401) {
        this.checkAuthStatus();
        alert('Security PIN required. Please enter your 4-digit PIN (1234) on screen to confirm payment.');
        return;
      }
      this.settings = await res.json();
      this.applySettingsToUI();
    } catch (e) {
      console.error('Failed to load settings', e);
    }
  }

  applySettingsToUI() {
    const titleElements = document.querySelectorAll('.business-name-display');
    titleElements.forEach(el => el.textContent = this.settings.business_name || 'RAMESH CABLES AND NET WORK');

    const phoneElements = document.querySelectorAll('.business-phone-display');
    phoneElements.forEach(el => el.textContent = this.settings.contact_phone || '9842100000');
  }

  // ================= STREETS 1 TO 15 MANAGEMENT =================
  async loadStreets() {
    try {
      const res = await fetch(`/api/streets?month=${this.currentMonth}`);
      if (res.status === 401) return;
      this.streets = await res.json();

      // Render Street Buttons (All Streets + Street 1 to 15)
      const container = document.getElementById('streetsButtonsContainer');
      if (container) {
        let buttonsHtml = `
          <button type="button" onclick="app.selectStreet('')" class="street-nav-btn whitespace-nowrap px-3.5 py-2 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5 ${!this.street ? 'bg-blue-600 text-white border-blue-600 shadow-md ring-2 ring-blue-200' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'}">
            <span>🌐 All Streets</span>
          </button>
        `;

        this.streets.forEach(st => {
          const isSelected = this.street === st.street_name || this.street === `Street ${st.street_number}`;
          const isTactv = st.operator_coverage === 'BOTH' || st.operator_coverage === 'TACTV';
          const activeStyle = isSelected ? 
            'bg-slate-900 text-white border-slate-900 shadow-md ring-2 ring-blue-300 scale-105' : 
            'bg-white text-slate-700 border-slate-200 hover:bg-slate-50';

          const coverageTag = isTactv ? 
            `<span class="ml-1 text-[9px] px-1.5 py-0.2 rounded font-extrabold ${isSelected ? 'bg-emerald-500 text-white' : 'bg-emerald-100 text-emerald-800'}">TACTV (5)</span>` : '';

          const countBadge = st.total_customers > 0 ? 
            `<span class="ml-1 text-[10px] px-1.5 py-0.5 rounded-full ${isSelected ? 'bg-blue-500 text-white font-black' : 'bg-slate-100 text-slate-700 font-bold'}">${st.total_customers}</span>` : '';

          buttonsHtml += `
            <button type="button" onclick="app.selectStreet('${st.street_name}', ${st.street_number})" class="street-nav-btn whitespace-nowrap px-3 py-2 rounded-xl text-xs font-bold transition-all border flex items-center ${activeStyle}">
              <span>${st.street_name}</span>
              ${coverageTag}
              ${countBadge}
            </button>
          `;
        });

        container.innerHTML = buttonsHtml;
      }

      // Populate Street Filter Dropdown
      const select = document.getElementById('streetFilter');
      if (select) {
        select.innerHTML = '<option value="">All Streets / Areas (அனைத்து தெருக்கள்)</option>';
        this.streets.forEach(st => {
          const opt = document.createElement('option');
          opt.value = st.street_name;
          opt.textContent = `${st.street_name} (${st.total_customers} houses)`;
          if (this.street === st.street_name) opt.selected = true;
          select.appendChild(opt);
        });
      }

      // Populate custStreet in Customer Add/Edit Modal
      const custStreetSelect = document.getElementById('custStreet');
      if (custStreetSelect) {
        custStreetSelect.innerHTML = '';
        this.streets.forEach(st => {
          const opt = document.createElement('option');
          opt.value = st.street_name;
          const coverageNote = st.operator_coverage === 'BOTH' ? ' (SCV & TACTV)' : ' (SCV)';
          opt.textContent = `${st.street_name}${coverageNote}`;
          custStreetSelect.appendChild(opt);
        });
      }

      this.updateActiveStreetBanner();
    } catch (e) {
      console.error('Failed to load streets', e);
    }
  }

  selectStreet(streetName, streetNum) {
    this.street = streetName;
    this.currentStreetNum = streetNum || (this.streets.find(s => s.street_name === streetName)?.street_number || 1);
    this.page = 1;
    this.loadStreets();
    this.loadCustomers();
  }

  updateActiveStreetBanner() {
    const banner = document.getElementById('activeStreetBanner');
    const titleEl = document.getElementById('streetBannerTitle');
    const numEl = document.getElementById('streetBannerNumber');
    const covEl = document.getElementById('streetBannerCoverage');
    const countEl = document.getElementById('streetBannerCounts');

    if (!banner) return;

    if (!this.street) {
      if (numEl) numEl.textContent = '🌐';
      if (titleEl) titleEl.textContent = 'All Streets (Streets 1 to 15)';
      if (covEl) {
        covEl.textContent = 'Coverage: Streets 1 to 5 (SCV & TACTV) • Streets 6 to 15 (SCV)';
        covEl.className = 'bg-blue-500/30 text-blue-300 text-[10px] font-extrabold px-2 py-0.5 rounded-full border border-blue-400/30';
      }
      const totalH = this.streets.reduce((sum, s) => sum + (s.total_customers || 0), 0);
      if (countEl) countEl.textContent = `${totalH} Total Houses across all 15 streets`;
      return;
    }

    const currentSt = this.streets.find(s => s.street_name === this.street || `Street ${s.street_number}` === this.street) || {
      street_number: this.currentStreetNum || 1,
      street_name: this.street,
      operator_coverage: (this.currentStreetNum <= 5 ? 'BOTH' : 'SCV'),
      total_customers: 0,
      scv_count: 0,
      tactv_count: 0
    };

    if (numEl) numEl.textContent = currentSt.street_number;
    if (titleEl) titleEl.textContent = currentSt.street_name;

    const isTactv = currentSt.operator_coverage === 'BOTH' || currentSt.operator_coverage === 'TACTV';
    if (covEl) {
      if (isTactv) {
        covEl.textContent = 'SCV & TACTV (One of 5 TACTV Streets)';
        covEl.className = 'bg-emerald-500/30 text-emerald-300 text-[10px] font-extrabold px-2 py-0.5 rounded-full border border-emerald-400/30';
      } else {
        covEl.textContent = 'SCV Digital Coverage';
        covEl.className = 'bg-blue-500/30 text-blue-300 text-[10px] font-extrabold px-2 py-0.5 rounded-full border border-blue-400/30';
      }
    }

    if (countEl) {
      countEl.textContent = `${currentSt.total_customers || 0} Total Houses in this street (SCV: ${currentSt.scv_count || 0} | TACTV: ${currentSt.tactv_count || 0})`;
    }
  }

  openAddCustomerInCurrentStreet() {
    this.openAddCustomer();
    const custStreetSelect = document.getElementById('custStreet');
    if (custStreetSelect && this.street) {
      custStreetSelect.value = this.street;
    }
  }

  openEditStreetModal() {
    const currentSt = this.streets.find(s => s.street_name === this.street || `Street ${s.street_number}` === this.street) || this.streets[0];
    if (!currentSt) return;

    setElText('editStreetModalTitle', `Edit Street ${currentSt.street_number}`);
    setElVal('editStreetNumberInput', currentSt.street_number);
    setElVal('editStreetNameInput', currentSt.street_name);
    setElVal('editStreetCoverageInput', currentSt.operator_coverage || 'BOTH');

    const modal = document.getElementById('editStreetModal');
    if (modal) {
      modal.classList.remove('hidden');
      modal.classList.add('flex');
    }
  }

  closeEditStreetModal() {
    const modal = document.getElementById('editStreetModal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }

  async saveStreetEdit() {
    const streetNum = document.getElementById('editStreetNumberInput').value;
    const newName = document.getElementById('editStreetNameInput').value.trim();
    const coverage = document.getElementById('editStreetCoverageInput').value;

    if (!newName) {
      alert('Please enter a street name');
      return;
    }

    try {
      const res = await fetch(`/api/streets/${streetNum}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ street_name: newName, operator_coverage: coverage })
      });
      const data = await res.json();
      if (data.success) {
        this.closeEditStreetModal();
        this.street = newName;
        this.showToast('Street Updated', data.message);
        await this.loadStreets();
        await this.loadCustomers();
      } else {
        alert(data.error || 'Failed to update street');
      }
    } catch (e) {
      alert('Error updating street');
    }
  }

  updateMonthDisplay() {
    const [year, month] = this.currentMonth.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, 1);
    const monthName = date.toLocaleString('en-IN', { month: 'long', year: 'numeric' });

    const el = document.getElementById('currentMonthDisplay');
    if (el) el.textContent = monthName;

    const input = document.getElementById('monthPicker');
    if (input) input.value = this.currentMonth;
  }

  changeMonth(delta) {
    const [year, month] = this.currentMonth.split('-').map(Number);
    const date = new Date(year, month - 1 + delta, 1);
    this.currentMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    this.page = 1;
    this.updateMonthDisplay();
    this.refreshAll();
  }

  // ================= OPERATOR SELECTION =================
  selectOperator(op) {
    this.operator = op;
    this.page = 1;
    this.updateOperatorUI();
    this.loadCustomers();
  }

  updateOperatorUI() {
    const isScv = this.operator === 'SCV';
    const scvCard = document.getElementById('opCardScv');
    const tactvCard = document.getElementById('opCardTactv');
    const scvBadge = document.getElementById('scvActiveBadge');
    const tactvBadge = document.getElementById('tactvActiveBadge');
    const dot = document.getElementById('activeOpIndicatorDot');
    const title = document.getElementById('activeOpTitle');
    const subtitle = document.getElementById('activeOpSubtitle');

    if (scvCard && tactvCard) {
      if (isScv) {
        scvCard.classList.add('op-active');
        tactvCard.classList.remove('op-active');
        if (scvBadge) scvBadge.classList.remove('hidden');
        if (tactvBadge) tactvBadge.classList.add('hidden');
        if (dot) dot.className = 'w-3.5 h-3.5 rounded-full bg-blue-600 ring-4 ring-blue-100';
        if (title) title.textContent = 'Managing SCV DIGITAL';
        if (subtitle) subtitle.textContent = 'Standard Monthly Fee: ₹250 • Click "PAID / COLLECT" button on any house to record payment.';
      } else {
        tactvCard.classList.add('op-active');
        scvCard.classList.remove('op-active');
        if (tactvBadge) tactvBadge.classList.remove('hidden');
        if (scvBadge) scvBadge.classList.add('hidden');
        if (dot) dot.className = 'w-3.5 h-3.5 rounded-full bg-emerald-600 ring-4 ring-emerald-100';
        if (title) title.textContent = 'Managing TACTV ARASU (5 Streets Coverage)';
        if (subtitle) subtitle.textContent = 'Standard Monthly Fee: ₹150 • Covers Streets 1 to 5.';
      }
    }
    this.updateTabCounts();
  }

  // ================= STATUS SELECTION =================
  selectStatus(st) {
    this.status = st;
    this.page = 1;
    this.updateStatusTabUI();
    this.loadCustomers();
  }

  updateStatusTabUI() {
    const unpaidBtn = document.getElementById('tabBtnUnpaid');
    const paidBtn = document.getElementById('tabBtnPaid');
    const allBtn = document.getElementById('tabBtnAll');

    if (this.status === 'unpaid' && unpaidBtn) {
      unpaidBtn.className = 'status-action-tab p-3.5 rounded-2xl border-2 border-rose-500 bg-rose-50 text-rose-950 font-bold transition-all text-left flex items-center justify-between shadow-md ring-4 ring-rose-100 scale-[1.02]';
      if (paidBtn) paidBtn.className = 'status-action-tab p-3.5 rounded-2xl border-2 border-slate-200 bg-white hover:bg-emerald-50 text-slate-700 font-bold transition-all text-left flex items-center justify-between opacity-80';
      if (allBtn) allBtn.className = 'status-action-tab p-3.5 rounded-2xl border-2 border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold transition-all text-left flex items-center justify-between opacity-80';
    } else if (this.status === 'paid' && paidBtn) {
      if (paidBtn) paidBtn.className = 'status-action-tab p-3.5 rounded-2xl border-2 border-emerald-500 bg-emerald-50 text-emerald-950 font-bold transition-all text-left flex items-center justify-between shadow-md ring-4 ring-emerald-100 scale-[1.02]';
      if (unpaidBtn) unpaidBtn.className = 'status-action-tab p-3.5 rounded-2xl border-2 border-slate-200 bg-white hover:bg-rose-50 text-slate-700 font-bold transition-all text-left flex items-center justify-between opacity-80';
      if (allBtn) allBtn.className = 'status-action-tab p-3.5 rounded-2xl border-2 border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold transition-all text-left flex items-center justify-between opacity-80';
    } else if (allBtn) {
      if (allBtn) allBtn.className = 'status-action-tab p-3.5 rounded-2xl border-2 border-blue-500 bg-blue-50 text-blue-950 font-bold transition-all text-left flex items-center justify-between shadow-md ring-4 ring-blue-100 scale-[1.02]';
      if (unpaidBtn) unpaidBtn.className = 'status-action-tab p-3.5 rounded-2xl border-2 border-slate-200 bg-white hover:bg-rose-50 text-slate-700 font-bold transition-all text-left flex items-center justify-between opacity-80';
      if (paidBtn) paidBtn.className = 'status-action-tab p-3.5 rounded-2xl border-2 border-slate-200 bg-white hover:bg-emerald-50 text-slate-700 font-bold transition-all text-left flex items-center justify-between opacity-80';
    }
  }

  updateTabCounts() {
    if (!this.statsData) return;
    const opData = this.operator === 'SCV' ? this.statsData.scv : this.statsData.tactv;
    if (!opData) return;

    const unpaidCountEl = document.getElementById('tabCountUnpaid');
    const paidCountEl = document.getElementById('tabCountPaid');
    const allCountEl = document.getElementById('tabCountAll');

    if (unpaidCountEl) unpaidCountEl.textContent = `${opData.unpaid_count} Houses`;
    if (paidCountEl) paidCountEl.textContent = `${opData.paid_count} Houses`;
    if (allCountEl) allCountEl.textContent = `${opData.total} Houses`;
  }

  showToast(title, desc) {
    const toast = document.getElementById('toastMessage');
    const titleEl = document.getElementById('toastTitle');
    const descEl = document.getElementById('toastDesc');
    if (!toast) return;

    if (titleEl) titleEl.textContent = title;
    if (descEl) descEl.textContent = desc;

    clearTimeout(this.toastTimer);
    toast.classList.remove('translate-y-[-100px]', 'opacity-0', 'pointer-events-none');
    toast.classList.add('translate-y-0', 'opacity-100');

    this.toastTimer = setTimeout(() => {
      toast.classList.remove('translate-y-0', 'opacity-100');
      toast.classList.add('translate-y-[-100px]', 'opacity-0', 'pointer-events-none');
    }, 4500);
  }

  async refreshAll() {
    await Promise.all([
      this.loadStats(),
      this.loadCustomers()
    ]);
  }

  async loadStats() {
    try {
      const res = await fetch(`/api/stats?month=${this.currentMonth}`);
      if (res.status === 401) {
        this.checkAuthStatus();
        alert('Security PIN required. Please enter your 4-digit PIN (1234) on screen to confirm payment.');
        return;
      }
      const data = await res.json();
      this.statsData = data;

      const revEl = document.getElementById('statTotalRevenue');
      if (revEl) revEl.textContent = `₹${data.total_collected.toLocaleString('en-IN')}`;

      const pendEl = document.getElementById('statPendingAmount');
      if (pendEl) pendEl.textContent = `₹${data.pending_amount.toLocaleString('en-IN')}`;

      // SCV Breakdown Card
      const scvCollEl = document.getElementById('scvCollected');
      if (scvCollEl) scvCollEl.textContent = `₹${data.scv.collected.toLocaleString('en-IN')}`;
      
      const scvPaidEl = document.getElementById('scvPaidCount');
      if (scvPaidEl) scvPaidEl.textContent = `${data.scv.paid_count} Paid`;

      const scvUnpaidEl = document.getElementById('scvUnpaidCount');
      if (scvUnpaidEl) scvUnpaidEl.textContent = `${data.scv.unpaid_count} Due`;

      // TACTV Breakdown Card
      const tactvCollEl = document.getElementById('tactvCollected');
      if (tactvCollEl) tactvCollEl.textContent = `₹${data.tactv.collected.toLocaleString('en-IN')}`;

      const tactvPaidEl = document.getElementById('tactvPaidCount');
      if (tactvPaidEl) tactvPaidEl.textContent = `${data.tactv.paid_count} Paid`;

      const tactvUnpaidEl = document.getElementById('tactvUnpaidCount');
      if (tactvUnpaidEl) tactvUnpaidEl.textContent = `${data.tactv.unpaid_count} Due`;

      this.updateOperatorUI();
    } catch (e) {
      console.error('Error loading stats', e);
    }
  }

  async loadCustomers() {
    const listContainer = document.getElementById('customersList');
    const loadingSpinner = document.getElementById('customersLoading');
    if (loadingSpinner) loadingSpinner.classList.remove('hidden');

    try {
      const url = `/api/customers?month=${this.currentMonth}&operator=${this.operator}&status=${this.status}&search=${encodeURIComponent(this.search)}&street=${encodeURIComponent(this.street)}&page=${this.page}&limit=${this.limit}`;
      const res = await fetch(url);
      if (res.status === 401) {
        this.checkAuthStatus();
        alert('Security PIN required. Please enter your 4-digit PIN (1234) on screen to confirm payment.');
        return;
      }
      const data = await res.json();

      const streetNote = this.street ? `in ${this.street}` : 'across all streets';
      setElText('customerResultCount', `Showing ${data.customers.length} of ${data.total} houses (${this.operator} ${streetNote})`);
      this.renderCustomerCards(data.customers);
      this.renderPagination(data);
    } catch (e) {
      console.error('Error loading customers', e);
      if (listContainer) listContainer.innerHTML = '<div class="col-span-full p-8 text-center text-red-500">Failed to load data. Please retry.</div>';
    } finally {
      if (loadingSpinner) loadingSpinner.classList.add('hidden');
    }
  }

  renderCustomerCards(customers) {
    const container = document.getElementById('customersList');
    if (!container) return;

    if (!customers || customers.length === 0) {
      const streetDisplay = this.street ? this.street : 'this filter';
      container.innerHTML = `
        <div class="col-span-full py-14 text-center bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
          <div class="w-16 h-16 rounded-3xl bg-blue-50 text-blue-600 flex items-center justify-center text-3xl mx-auto mb-3">
            🏠
          </div>
          <h3 class="text-base font-black text-slate-800">No Customers in ${streetDisplay} Yet</h3>
          <p class="text-xs text-slate-500 mt-1 max-w-md mx-auto mb-5">
            Demo data has been removed. You can now start filing your father's real customer houses directly under ${streetDisplay}!
          </p>
          <button onclick="app.openAddCustomerInCurrentStreet()" class="bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-extrabold py-3 px-6 rounded-2xl text-xs shadow-lg transition-all inline-flex items-center gap-2">
            <span>➕</span>
            <span>Add Customer in ${streetDisplay}</span>
          </button>
        </div>
      `;
      return;
    }

    let html = '';
    customers.forEach(c => {
      const isPaid = c.status_code === 'PAID';
      const isPartial = c.status_code === 'PARTIAL';
      const isUnpaid = c.status_code === 'UNPAID';

      const opBadgeClass = c.operator === 'SCV' ? 'badge-scv' : 'badge-tactv';
      const statusBadgeClass = isPaid ? 'badge-paid' : (isPartial ? 'badge-partial' : 'badge-unpaid pulse-due');

      html += `
        <div class="customer-card bg-white rounded-2xl border border-slate-200 p-4 shadow-sm hover:border-blue-400 transition-all flex flex-col justify-between">
          <div>
            <!-- Top Box No & Operator & Status -->
            <div class="flex items-start justify-between gap-2 pb-2.5 border-b border-slate-100">
              <div>
                <div class="flex items-center gap-1.5 flex-wrap">
                  <span class="font-mono font-black text-sm text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200" title="Primary Box Number">
                    📺 ${c.box_number}
                  </span>
                  ${c.secondary_box_number ? `
                  <span class="font-mono font-bold text-xs text-blue-800 bg-blue-100/90 px-2 py-0.5 rounded border border-blue-200" title="Another Box Number (2வது பாக்ஸ்)">
                    Box 2: ${c.secondary_box_number}
                  </span>
                  ` : ''}
                  ${c.smart_card_number ? `
                  <span class="font-mono text-[10px] text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded" title="Smart Card / VC No">
                    VC: ${c.smart_card_number}
                  </span>
                  ` : ''}
                  <span class="text-[11px] font-extrabold px-2 py-0.5 rounded ${opBadgeClass}">
                    ${c.operator}
                  </span>
                </div>
              </div>

              <!-- Status Pill -->
              <span class="text-xs font-black px-2.5 py-1 rounded-full ${statusBadgeClass} text-center">
                ${isPaid ? '✓ PAID' : (isPartial ? `⚠ PARTIAL` : `✕ NOT PAID`)}
              </span>
            </div>

            <!-- Customer Details -->
            <div class="py-3 space-y-1.5">
              <div class="flex items-center justify-between">
                <h4 class="font-black text-slate-900 text-sm truncate" title="${c.customer_name}">
                  ${c.customer_name}
                </h4>
                <span class="text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                  Fee: ₹${c.monthly_fee}
                </span>
              </div>

              <div class="text-xs text-slate-600 flex items-center gap-1">
                <span>🏠</span>
                <span class="truncate font-medium">${c.door_no ? c.door_no + ', ' : ''}${c.street || 'Street not specified'}</span>
              </div>

              <div class="text-xs text-slate-500 flex items-center justify-between pt-1">
                <span class="flex items-center gap-1 font-mono">
                  <span>📞</span>
                  <span>${c.phone || 'No phone'}</span>
                </span>
                ${c.phone ? `
                <a href="tel:${c.phone}" class="text-blue-600 hover:underline text-[11px] font-bold">Call</a>
                ` : ''}
              </div>
            </div>

            <!-- Month Payment Summary -->
            <div class="bg-slate-50 rounded-xl p-2.5 mb-3 text-xs border border-slate-100">
              <div class="flex justify-between items-center">
                <span class="text-slate-500 font-medium">${this.currentMonth} Status:</span>
                <span class="font-black ${isPaid ? 'text-emerald-700' : 'text-rose-700'}">
                  ${isPaid ? `Paid ₹${c.paid_amount}` : (isPartial ? `Paid ₹${c.paid_amount} / Due ₹${c.due_amount}` : `Due: ₹${c.due_amount}`)}
                </span>
              </div>
              ${c.last_payment_date ? `
              <div class="text-[11px] text-slate-400 mt-1 flex justify-between font-medium">
                <span>Mode: ${c.last_payment_mode || 'Cash'}</span>
                <span>${c.last_payment_date.split(' ')[0]}</span>
              </div>
              ` : ''}
            </div>
          </div>

          <!-- Action Buttons -->
          <div class="pt-2 border-t border-slate-100 flex items-center gap-1.5">
            ${!isPaid ? `
            <!-- PAID / COLLECT BUTTON -->
            <button onclick="app.openPaymentModal(${c.id})" class="flex-1 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-black py-2.5 px-3 rounded-xl text-xs shadow-md flex items-center justify-center gap-1.5 transition-all">
              <span class="text-sm">💰</span>
              <span>PAID / COLLECT ₹${c.due_amount || c.monthly_fee}</span>
            </button>
            ` : `
            <!-- PAID RECEIPT BUTTON -->
            <button onclick="app.viewLatestReceipt(${c.id})" class="flex-1 bg-blue-50 hover:bg-blue-100 text-blue-700 font-extrabold py-2.5 px-3 rounded-xl text-xs border border-blue-200 flex items-center justify-center gap-1.5 transition-all">
              <span class="text-sm">🧾</span>
              <span>View Receipt</span>
            </button>
            `}

            <!-- EDIT CUSTOMER DETAILS BUTTON -->
            <button onclick="app.openEditCustomer(${c.id})" title="Edit Customer Details / Box No" class="bg-slate-100 hover:bg-slate-200 text-slate-700 py-2.5 px-3 rounded-xl transition-all flex items-center justify-center font-bold text-xs gap-1">
              <span>✏️</span>
              <span class="hidden sm:inline">Edit</span>
            </button>

            ${!isPaid ? `
            <button onclick="app.sendWhatsAppReminder(${c.id})" title="Send WhatsApp Due Reminder" class="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 p-2.5 rounded-xl border border-emerald-200 transition-all flex items-center justify-center">
              <span class="text-sm">💬</span>
            </button>
            ` : ''}

            <button onclick="app.viewHistory(${c.id})" title="Past Payment History" class="bg-slate-100 hover:bg-slate-200 text-slate-700 p-2.5 rounded-xl transition-all flex items-center justify-center">
              <span class="text-sm">👁️</span>
            </button>
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
  }

  renderPagination(data) {
    const container = document.getElementById('paginationControls');
    if (!container) return;

    if (data.total_pages <= 1) {
      container.innerHTML = '';
      return;
    }

    container.innerHTML = `
      <div class="flex items-center justify-center gap-2 py-4">
        <button onclick="app.goToPage(${this.page - 1})" ${this.page <= 1 ? 'disabled' : ''} class="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold bg-white disabled:opacity-40">
          ◀ Prev
        </button>
        <span class="text-xs text-slate-600 font-medium px-2">Page ${data.page} of ${data.total_pages}</span>
        <button onclick="app.goToPage(${this.page + 1})" ${this.page >= data.total_pages ? 'disabled' : ''} class="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold bg-white disabled:opacity-40">
          Next ▶
        </button>
      </div>
    `;
  }

  goToPage(p) {
    this.page = p;
    this.loadCustomers();
    window.scrollTo({ top: 380, behavior: 'smooth' });
  }

  // ================= STB SCANNER / SEARCH LOOKUP =================
  async lookupAndOpenPayment(code) {
    try {
      const res = await fetch(`/api/stb/lookup?code=${encodeURIComponent(code)}&month=${this.currentMonth}`);
      if (res.status === 401) {
        this.checkAuthStatus();
        alert('Security PIN required. Please enter your 4-digit PIN (1234) on screen to confirm payment.');
        return;
      }
      const data = await res.json();
      if (data.found && data.customer) {
        this.openPaymentModalWithCustomer(data.customer);
      } else {
        alert(data.message || `No Set-Top Box found with number/barcode: "${code}"`);
      }
    } catch (e) {
      console.error('Lookup error', e);
      alert('Error searching for STB number');
    }
  }

  async openPaymentModal(customerId) {
    try {
      const res = await fetch(`/api/customers/${customerId}?month=${this.currentMonth}`);
      if (res.status === 401) {
        this.checkAuthStatus();
        alert('Security PIN required. Please enter your 4-digit PIN (1234) on screen to unlock.');
        return;
      }
      const customer = await res.json().catch(() => ({ error: 'Invalid response from server' }));
      if (!res.ok || customer.error) {
        alert(customer.error || `Server error (${res.status})`);
        return;
      }
      this.openPaymentModalWithCustomer(customer);
    } catch (e) {
      console.error('Error opening payment modal:', e);
      alert('Could not fetch customer details: ' + (e.message || 'Check connection') + '. Please check if server is running or refresh.');
    }
  }

  openPaymentModalWithCustomer(cust) {
    this.selectedCustomer = cust;
    const modal = document.getElementById('paymentModal');

    setElText('payModalCustName', cust.customer_name || 'Customer');
    setElText('payModalBoxNo', cust.box_number || '');

    const opBadge = document.getElementById('payModalOperator');
    if (opBadge) {
      opBadge.textContent = cust.operator || 'SCV';
      opBadge.className = cust.operator === 'SCV' ? 
        'text-xs font-bold px-2 py-0.5 rounded badge-scv' : 
        'text-xs font-bold px-2 py-0.5 rounded badge-tactv';
    }

    setElText('payModalDoorStreet', `${cust.door_no ? cust.door_no + ', ' : ''}${cust.street || ''}`);
    setElText('payModalPhone', cust.phone || 'N/A');
    setElText('payModalMonth', this.currentMonth);

    const due = cust.current_month_due !== undefined ? cust.current_month_due : cust.monthly_fee;
    const fee = cust.monthly_fee || 250;

    setElText('payModalFee', `₹${fee}`);
    setElText('payModalDue', `(Due: ₹${due})`);
    
    setElVal('paymentAmountInput', due > 0 ? due : fee);
    setElVal('paymentRemarks', '');
    setElVal('paymentTxnRef', '');

    const upiContainer = document.getElementById('upiQrContainer');
    if (upiContainer) upiContainer.classList.add('hidden');

    setElText('showUpiBtnText', '📲 Show Customer UPI QR Code');

    if (modal) {
      modal.classList.remove('hidden');
      modal.classList.add('flex');
    }
    const amtInput = document.getElementById('paymentAmountInput');
    if (amtInput) amtInput.focus();
  }

  closePaymentModal() {
    const modal = document.getElementById('paymentModal');
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }
    this.selectedCustomer = null;
  }

  setPaymentAmount(amt) {
    setElVal('paymentAmountInput', amt);
    this.updateUpiQrIfOpen();
  }

  selectPaymentMode(mode) {
    const buttons = document.querySelectorAll('.pay-mode-btn');
    buttons.forEach(btn => {
      if (btn.dataset.mode === mode) {
        btn.classList.add('bg-blue-600', 'text-white', 'border-blue-600');
        btn.classList.remove('bg-white', 'text-slate-700', 'border-slate-300');
      } else {
        btn.classList.remove('bg-blue-600', 'text-white', 'border-blue-600');
        btn.classList.add('bg-white', 'text-slate-700', 'border-slate-300');
      }
    });

    setElVal('selectedPaymentMode', mode);

    if (['GPay', 'PhonePe', 'Paytm', 'UPI'].includes(mode)) {
      this.generateAndShowUpiQr();
    }
  }

  toggleUpiQr() {
    const container = document.getElementById('upiQrContainer');
    if (!container) return;
    if (container.classList.contains('hidden')) {
      this.generateAndShowUpiQr();
    } else {
      container.classList.add('hidden');
      setElText('showUpiBtnText', '📲 Show Customer UPI QR Code');
    }
  }

  updateUpiQrIfOpen() {
    const container = document.getElementById('upiQrContainer');
    if (container && !container.classList.contains('hidden')) {
      this.generateAndShowUpiQr();
    }
  }

  generateAndShowUpiQr() {
    if (!this.selectedCustomer) return;
    const container = document.getElementById('upiQrContainer');
    const qrDiv = document.getElementById('upiQrCodeTarget');
    if (!container || !qrDiv) return;

    const amtInp = document.getElementById('paymentAmountInput');
    const amount = (amtInp && parseFloat(amtInp.value)) || this.selectedCustomer.monthly_fee;
    
    const upiId = this.settings.upi_id || 'rameshcables@okaxis';
    const bizName = this.settings.business_name || 'RAMESH CABLES';
    const note = `CableTV ${this.selectedCustomer.box_number} ${this.currentMonth}`;

    const upiUri = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(bizName)}&am=${amount}&cu=INR&tn=${encodeURIComponent(note)}`;

    qrDiv.innerHTML = '';
    if (typeof QRCode !== 'undefined') {
      new QRCode(qrDiv, {
        text: upiUri,
        width: 200,
        height: 200
      });
    }

    setElText('upiQrAmountDisplay', `₹${amount}`);
    setElText('upiQrIdDisplay', upiId);
    container.classList.remove('hidden');
    setElText('showUpiBtnText', 'Hide UPI QR Code');
  }

  // ================= SAVE PAYMENT =================
  async submitPayment() {
    if (!this.selectedCustomer) return;
    const custId = this.selectedCustomer.id;
    const custName = this.selectedCustomer.customer_name;
    const boxNo = this.selectedCustomer.box_number;
    const amtInp = document.getElementById('paymentAmountInput');
    const amount = amtInp ? parseFloat(amtInp.value) : 0;
    const modeEl = document.getElementById('selectedPaymentMode');
    const mode = modeEl ? modeEl.value || 'Cash' : 'Cash';
    const remEl = document.getElementById('paymentRemarks');
    const remarks = remEl ? remEl.value : '';
    const txnEl = document.getElementById('paymentTxnRef');
    const txnRef = txnEl ? txnEl.value : '';

    if (!amount || amount <= 0) {
      alert('Please enter a valid payment amount greater than ₹0');
      return;
    }

    const submitBtn = document.getElementById('submitPaymentBtn');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = 'Saving...';
    }

    try {
      const res = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id: custId,
          month: this.currentMonth,
          amount: amount,
          payment_mode: mode,
          remarks: remarks,
          transaction_ref: txnRef,
          collected_by: (this.settings && this.settings.owner_name) || 'Ramesh'
        })
      });

      if (res.status === 401) {
        this.checkAuthStatus();
        alert('Security PIN required. Please enter your 4-digit PIN (1234) on screen to confirm payment.');
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (data.success) {
        this.closePaymentModal();
        
        this.showToast(
          `✓ Payment of ₹${amount} Saved!`,
          `House ${boxNo} (${custName}) has been moved to Paid section.`
        );

        await this.loadStreets();
        await this.refreshAll();

        try {
          if (window.receiptManager && data.receipt) {
            window.receiptManager.showReceipt(data.receipt, data.settings);
          }
        } catch (receiptErr) {
          console.warn('Receipt display error:', receiptErr);
        }
      } else {
        alert(data.error || `Failed to record payment (Server status: ${res.status})`);
      }
    } catch (e) {
      console.error('Error submitting payment:', e);
      alert('Error recording payment: ' + (e.message || 'Check connection'));
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '✓ Confirm & Save Payment';
      }
    }
  }

  async viewLatestReceipt(customerId) {
    try {
      const res = await fetch(`/api/customers/${customerId}?month=${this.currentMonth}`);
      if (res.status === 401) {
        this.checkAuthStatus();
        alert('Security PIN required. Please enter your 4-digit PIN (1234) on screen to confirm payment.');
        return;
      }
      const cust = await res.json();
      
      const payments = (cust.payments || []).filter(p => p.month === this.currentMonth);
      if (payments.length > 0) {
        const latest = payments[0];
        latest.customer_name = cust.customer_name;
        latest.box_number = cust.box_number;
        latest.operator = cust.operator;
        latest.door_no = cust.door_no;
        latest.street = cust.street;
        latest.phone = cust.phone;
        if (window.receiptManager) {
          window.receiptManager.showReceipt(latest, this.settings);
        } else {
          alert('Receipt module loading, please try again in a moment');
        }
      } else {
        alert('No payment recorded for this customer in ' + this.currentMonth);
      }
    } catch (e) {
      console.error('Error generating receipt:', e);
      alert('Could not generate receipt: ' + (e.message || 'Error'));
    }
  }

  async sendWhatsAppReminder(customerId) {
    try {
      const res = await fetch(`/api/customers/${customerId}?month=${this.currentMonth}`);
      if (res.status === 401) {
        this.checkAuthStatus();
        alert('Security PIN required. Please enter your 4-digit PIN (1234) on screen to confirm payment.');
        return;
      }
      const cust = await res.json();
      window.receiptManager.sendReminderWhatsApp(cust, this.currentMonth, this.settings);
    } catch (e) {
      alert('Could not prepare WhatsApp reminder');
    }
  }

  async viewHistory(customerId) {
    try {
      const res = await fetch(`/api/customers/${customerId}?month=${this.currentMonth}`);
      if (res.status === 401) {
        this.checkAuthStatus();
        alert('Security PIN required. Please enter your 4-digit PIN (1234) on screen to confirm payment.');
        return;
      }
      const cust = await res.json();

      setElText('historyCustName', cust.customer_name);
      setElText('historyBoxNo', `${cust.box_number} (${cust.operator})`);
      
      const container = document.getElementById('historyTableBody');
      if (cust.payments && cust.payments.length > 0) {
        let rows = '';
        cust.payments.forEach(p => {
          rows += `
            <tr class="border-b border-slate-100 text-xs">
              <td class="py-2.5 px-3 font-bold font-mono text-blue-700">${p.month}</td>
              <td class="py-2.5 px-3 font-bold text-emerald-700">₹${p.amount_paid}</td>
              <td class="py-2.5 px-3">${p.payment_mode}</td>
              <td class="py-2.5 px-3 text-slate-500">${p.payment_date ? p.payment_date.split(' ')[0] : ''}</td>
              <td class="py-2.5 px-3 text-slate-500">${p.transaction_ref || '-'}</td>
              <td class="py-2.5 px-3 text-right">
                <button onclick="app.deletePaymentRecord(${p.id}, ${cust.id})" class="text-rose-600 hover:text-rose-800 text-[11px] font-semibold">Delete</button>
              </td>
            </tr>
          `;
        });
        container.innerHTML = rows;
      } else {
        container.innerHTML = '<tr><td colspan="6" class="text-center py-6 text-slate-400 text-xs">No past payments recorded yet.</td></tr>';
      }

      const modal = document.getElementById('historyModal');
      modal.classList.remove('hidden');
      modal.classList.add('flex');
    } catch (e) {
      alert('Could not fetch history');
    }
  }

  closeHistoryModal() {
    const modal = document.getElementById('historyModal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }

  async deletePaymentRecord(paymentId, customerId) {
    if (!confirm('Are you sure you want to delete this payment record? This will mark the month as unpaid or adjusted.')) {
      return;
    }

    try {
      const res = await fetch(`/api/payments/${paymentId}`, { method: 'DELETE' });
      if (res.status === 401) {
        this.checkAuthStatus();
        alert('Security PIN required. Please enter your 4-digit PIN (1234) on screen to confirm payment.');
        return;
      }
      const data = await res.json();
      if (data.success) {
        this.viewHistory(customerId);
        await this.loadStreets();
        await this.refreshAll();
      } else {
        alert(data.error || 'Failed to delete');
      }
    } catch (e) {
      alert('Error deleting payment');
    }
  }

  // ================= ADD / EDIT ALL CUSTOMERS =================
  openAddCustomer() {
    setElText('customerModalTitle', 'Add New Customer / STB');
    setElVal('customerIdInput', '');
    setElVal('custBoxNo', '');
    setElVal('custSecondaryBoxNo', '');
    setElVal('custSmartCard', '');
    setElVal('custName', '');
    setElVal('custPhone', '');
    setElVal('custDoorNo', '');
    
    // Default street to currently selected street or first street
    const streetSelect = document.getElementById('custStreet');
    if (streetSelect) {
      if (this.street) {
        streetSelect.value = this.street;
      }
      if (!streetSelect.value && streetSelect.options.length > 0) {
        streetSelect.selectedIndex = 0;
      }
    }

    setElVal('custArea', '');
    setElVal('custOperator', this.operator || 'SCV');
    setElVal('custMonthlyFee', this.operator === 'SCV' ? 
      (this.settings.scv_default_fee || '250') : 
      (this.settings.tactv_default_fee || '150'));
    setElVal('custPlanDetails', 'Standard Package');
    
    const delBtn = document.getElementById('deleteCustomerBtn');
    if (delBtn) delBtn.classList.add('hidden');

    const modal = document.getElementById('customerModal');
    if (modal) {
      modal.classList.remove('hidden');
      modal.classList.add('flex');
    }
  }

  async openEditCustomer(customerId) {
    try {
      const res = await fetch(`/api/customers/${customerId}?month=${this.currentMonth}`);
      if (res.status === 401) {
        this.checkAuthStatus();
        alert('Security PIN required. Please enter your 4-digit PIN (1234) on screen to confirm payment.');
        return;
      }
      const cust = await res.json();

      setElText('customerModalTitle', `Edit Customer: ${cust.customer_name}`);
      setElVal('customerIdInput', cust.id);
      setElVal('custBoxNo', cust.box_number);
      setElVal('custSecondaryBoxNo', cust.secondary_box_number || '');
      setElVal('custSmartCard', cust.smart_card_number || '');
      setElVal('custName', cust.customer_name);
      setElVal('custPhone', cust.phone || '');
      setElVal('custDoorNo', cust.door_no || '');
      
      const streetSelect = document.getElementById('custStreet');
      if (streetSelect) streetSelect.value = cust.street || '';

      setElVal('custArea', cust.area || '');
      setElVal('custOperator', cust.operator);
      setElVal('custMonthlyFee', cust.monthly_fee);
      setElVal('custPlanDetails', cust.plan_details || '');

      const deleteBtn = document.getElementById('deleteCustomerBtn');
      if (deleteBtn) deleteBtn.classList.remove('hidden');

      const modal = document.getElementById('customerModal');
      if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
      }
    } catch (e) {
      alert('Could not fetch customer info');
    }
  }

  closeCustomerModal() {
    const modal = document.getElementById('customerModal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }

  async saveCustomer() {
    const id = document.getElementById('customerIdInput').value;
    const boxNo = document.getElementById('custBoxNo').value.trim();
    const secondaryBoxNo = document.getElementById('custSecondaryBoxNo').value.trim();
    const smartCard = document.getElementById('custSmartCard').value.trim();
    const name = document.getElementById('custName').value.trim();
    const phone = document.getElementById('custPhone').value.trim();
    const doorNo = document.getElementById('custDoorNo').value.trim();
    let street = document.getElementById('custStreet').value.trim();
    if (!street) {
      street = this.street || (this.streets.length > 0 ? this.streets[0].street_name : 'Street 1');
    }
    const area = document.getElementById('custArea').value.trim();
    const operator = document.getElementById('custOperator').value;
    const fee = parseFloat(document.getElementById('custMonthlyFee').value) || 250;
    const plan = document.getElementById('custPlanDetails').value.trim();

    if (!boxNo || !name) {
      alert('Please fill Primary Set-top Box Number and Customer Name');
      return;
    }

    const payload = {
      box_number: boxNo,
      secondary_box_number: secondaryBoxNo,
      smart_card_number: smartCard,
      barcode: boxNo,
      customer_name: name,
      phone: phone,
      door_no: doorNo,
      street: street,
      area: area,
      operator: operator,
      monthly_fee: fee,
      plan_details: plan
    };

    try {
      let res;
      if (id) {
        res = await fetch(`/api/customers/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } else {
        res = await fetch('/api/customers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }

      if (res.status === 401) {
        this.checkAuthStatus();
        alert('Security PIN required. Please enter your 4-digit PIN (1234) on screen to confirm payment.');
        return;
      }
      const data = await res.json();
      if (data.success) {
        this.closeCustomerModal();
        if (this.street && this.street.toLowerCase() !== street.toLowerCase()) {
          this.street = street;
        }
        this.showToast('✓ Saved Successfully!', `Customer ${name} filed under ${street}.`);
        await this.loadStreets();
        await this.refreshAll();
      } else {
        alert(data.error || 'Failed to save customer');
      }
    } catch (e) {
      alert('Error saving customer');
    }
  }

  async deleteCurrentCustomer() {
    const id = document.getElementById('customerIdInput').value;
    const name = document.getElementById('custName').value;
    if (!id) return;

    if (!confirm(`Are you sure you want to delete customer "${name}" and their STB box from the system completely?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/customers/${id}`, { method: 'DELETE' });
      if (res.status === 401) {
        this.checkAuthStatus();
        alert('Security PIN required. Please enter your 4-digit PIN (1234) on screen to confirm payment.');
        return;
      }
      const data = await res.json();
      if (data.success) {
        this.closeCustomerModal();
        this.showToast('Customer Deleted', `Customer ${name} removed from system.`);
        await this.loadStreets();
        await this.refreshAll();
      } else {
        alert(data.error || 'Failed to delete customer');
      }
    } catch (e) {
      alert('Error deleting customer');
    }
  }

  // ================= SETTINGS & SECURITY =================
  openSettings() {
    setElVal('settingBizName', this.settings.business_name || '');
    setElVal('settingOwnerName', this.settings.owner_name || '');
    setElVal('settingPhone', this.settings.contact_phone || '');
    setElVal('settingUpiId', this.settings.upi_id || '');
    setElVal('settingScvFee', this.settings.scv_default_fee || '250');
    setElVal('settingTactvFee', this.settings.tactv_default_fee || '150');
    setElVal('settingAddress', this.settings.address || '');
    setElVal('settingSecurityPin', this.settings.security_pin || '1234');
    setElVal('settingAdminPassword', this.settings.admin_password || 'ramesh123');

    const modal = document.getElementById('settingsModal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  }

  closeSettings() {
    const modal = document.getElementById('settingsModal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }

  async saveSettings() {
    const newPin = document.getElementById('settingSecurityPin').value.trim();
    const newPass = document.getElementById('settingAdminPassword').value.trim();

    const payload = {
      business_name: document.getElementById('settingBizName').value.trim(),
      owner_name: document.getElementById('settingOwnerName').value.trim(),
      contact_phone: document.getElementById('settingPhone').value.trim(),
      upi_id: document.getElementById('settingUpiId').value.trim(),
      scv_default_fee: document.getElementById('settingScvFee').value.trim(),
      tactv_default_fee: document.getElementById('settingTactvFee').value.trim(),
      address: document.getElementById('settingAddress').value.trim(),
      security_pin: newPin || '1234',
      admin_password: newPass || 'ramesh123'
    };

    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.status === 401) {
        this.checkAuthStatus();
        alert('Security PIN required. Please enter your 4-digit PIN (1234) on screen to confirm payment.');
        return;
      }
      const data = await res.json();
      if (data.success) {
        this.settings = data.settings;
        this.applySettingsToUI();
        this.closeSettings();
        this.showToast('Settings Saved', 'System settings & security PIN updated successfully!');
      }
    } catch (e) {
      alert('Failed to save settings');
    }
  }

  async reloadRealCustomers() {
    if (!confirm('Do you want to restore and protect the real 291 SCV customer houses?')) return;
    try {
      const res = await fetch('/api/restore-real-customers', { method: 'POST' });
      if (res.status === 401) {
        this.checkAuthStatus();
        alert('Security PIN required. Please enter PIN (1234 or 0987).');
        return;
      }
      const data = await res.json();
      if (data.success) {
        this.showToast('✓ 291 Customers Restored', 'All real customer houses are permanently protected.');
        this.closeSettings();
        await this.loadStreets();
        await this.refreshAll();
      } else {
        alert(data.error || 'Failed to restore');
      }
    } catch (e) {
      alert('Error restoring real customers');
    }
  }

  async resetData(seedDemo) {
    if (!seedDemo) {
      alert('Real customer data is protected and cannot be deleted.');
      return;
    }
    const msg = seedDemo ? 
      'This will reload sample customer houses. Continue?' : 
      'WARNING: This will delete ALL customer and payment records permanently. Continue?';

    if (!confirm(msg)) return;

    try {
      const res = await fetch('/api/reset-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seed_demo: seedDemo })
      });
      if (res.status === 401) {
        this.checkAuthStatus();
        alert('Security PIN required. Please enter your 4-digit PIN (1234) on screen to confirm payment.');
        return;
      }
      const data = await res.json();
      if (data.success) {
        alert(data.message);
        this.closeSettings();
        await this.loadStreets();
        await this.refreshAll();
      }
    } catch (e) {
      alert('Error updating data');
    }
  }

  async handleCsvUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/import-csv', {
        method: 'POST',
        body: formData
      });
      if (res.status === 401) {
        this.checkAuthStatus();
        alert('Security PIN required. Please enter your 4-digit PIN (1234) on screen to confirm payment.');
        return;
      }
      const data = await res.json();
      if (data.success) {
        alert(data.message);
        await this.loadStreets();
        await this.refreshAll();
      } else {
        alert(data.error || 'Import failed');
      }
    } catch (e) {
      alert('Error uploading CSV file');
    } finally {
      event.target.value = '';
    }
  }

  exportCsv() {
    window.location.href = `/api/export-csv?month=${this.currentMonth}`;
  }

  setupEventListeners() {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        clearTimeout(this.searchDebounceTimer);
        this.searchDebounceTimer = setTimeout(() => {
          this.search = e.target.value;
          this.page = 1;
          this.loadCustomers();
        }, 300);
      });
    }

    const streetSelect = document.getElementById('streetFilter');
    if (streetSelect) {
      streetSelect.addEventListener('change', (e) => {
        this.selectStreet(e.target.value);
      });
    }

    const quickBarcodeInput = document.getElementById('quickBoxSearchInput');
    if (quickBarcodeInput) {
      quickBarcodeInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          const val = quickBarcodeInput.value.trim();
          if (val) {
            this.lookupAndOpenPayment(val);
            quickBarcodeInput.value = '';
          }
        }
      });
    }

    const loginPinInput = document.getElementById('loginPinInput');
    if (loginPinInput) {
      loginPinInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          this.submitLogin();
        }
      });
    }
  }
}

// Global App Instance
window.app = null;
document.addEventListener('DOMContentLoaded', () => {
  window.app = new RameshCablesApp();
});
