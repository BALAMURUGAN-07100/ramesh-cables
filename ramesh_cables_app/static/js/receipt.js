/**
 * Digital & Thermal Receipt Manager with WhatsApp Sharing
 * RAMESH CABLES AND NET WORK
 */

class ReceiptManager {
  constructor() {
    this.currentReceiptData = null;
  }

  showReceipt(payment, settings) {
    this.currentReceiptData = { payment, settings };
    const modal = document.getElementById('receiptModal');
    const container = document.getElementById('receiptContent');
    if (!modal || !container) {
      console.warn('Receipt modal elements not found');
      return;
    }

    const p = payment;
    const s = settings || {};
    const businessName = s.business_name || 'RAMESH CABLES AND NET WORK';
    const phone = s.contact_phone || '9842100000';
    const address = s.address || 'Tamil Nadu';
    let dateFormatted = new Date().toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true
    });
    try {
      const cleanDate = (p.payment_date || '').toString().replace(' ', 'T');
      const d = cleanDate ? new Date(cleanDate) : new Date();
      if (!isNaN(d.getTime())) {
        dateFormatted = d.toLocaleString('en-IN', {
          day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true
        });
      }
    } catch (_) {}
    
    const receiptNo = `RC-${new Date().getFullYear()}${(new Date().getMonth()+1).toString().padStart(2, '0')}-${p.id || Math.floor(Math.random()*9000+1000)}`;

    const opBadge = p.operator === 'SCV' ? 
      '<span class="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded font-bold">SCV Digital</span>' : 
      '<span class="bg-emerald-100 text-emerald-800 text-xs px-2 py-0.5 rounded font-bold">TACTV Arasu</span>';

    container.innerHTML = `
      <div class="receipt-paper p-5 border border-slate-300 rounded-lg text-slate-800 text-sm">
        <div class="text-center pb-3 border-b border-dashed border-slate-300">
          <div class="inline-flex items-center justify-center w-10 h-10 rounded-full bg-blue-600 text-white mb-1">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
          </div>
          <h2 class="text-base font-extrabold uppercase tracking-wide text-slate-900">${businessName}</h2>
          <p class="text-xs text-slate-500 font-medium">Cable TV & Network Distribution</p>
          <p class="text-xs text-slate-500">${address}</p>
          <p class="text-xs font-semibold text-blue-700 mt-0.5">📞 Helpline: ${phone}</p>
        </div>

        <div class="py-2.5 border-b border-dashed border-slate-300 text-xs flex justify-between items-center text-slate-600">
          <div><span class="font-bold">Rcpt #:</span> ${receiptNo}</div>
          <div>${dateFormatted}</div>
        </div>

        <div class="py-3 border-b border-dashed border-slate-300 space-y-1.5 text-xs">
          <div class="flex justify-between">
            <span class="text-slate-500">Customer Name:</span>
            <span class="font-bold text-slate-900 text-sm">${p.customer_name}</span>
          </div>
          <div class="flex justify-between items-center">
            <span class="text-slate-500">STB Box No:</span>
            <span class="font-mono font-bold text-slate-900">${p.box_number} ${opBadge}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-slate-500">Door / Street:</span>
            <span class="font-medium text-slate-800">${p.door_no ? p.door_no + ', ' : ''}${p.street || 'N/A'}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-slate-500">Mobile:</span>
            <span class="font-medium text-slate-800">${p.phone || 'N/A'}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-slate-500">Billing Month:</span>
            <span class="font-bold text-blue-700 uppercase">${p.month}</span>
          </div>
        </div>

        <div class="py-3 border-b border-dashed border-slate-300 space-y-2">
          <div class="flex justify-between items-center text-sm font-bold">
            <span class="text-slate-700">Amount Paid:</span>
            <span class="text-emerald-700 text-lg">₹${parseFloat(p.amount_paid).toFixed(2)}</span>
          </div>
          <div class="flex justify-between text-xs text-slate-600">
            <span>Payment Mode:</span>
            <span class="font-semibold px-2 py-0.5 rounded bg-slate-100">${p.payment_mode || 'Cash'}</span>
          </div>
          ${p.transaction_ref ? `
          <div class="flex justify-between text-xs text-slate-600">
            <span>UPI / Txn Ref:</span>
            <span class="font-mono text-slate-700">${p.transaction_ref}</span>
          </div>` : ''}
          <div class="flex justify-between text-xs text-slate-600">
            <span>Payment Status:</span>
            <span class="font-bold text-emerald-600">PAID & VERIFIED</span>
          </div>
        </div>

        <div class="pt-3 text-center text-xs text-slate-500 space-y-1">
          <p class="font-medium text-slate-700">கட்டணம் செலுத்தியதற்கு நன்றி!</p>
          <p class="italic text-[11px]">Collected By: ${p.collected_by || 'Ramesh'}</p>
        </div>
      </div>
    `;

    modal.classList.remove('hidden');
    modal.classList.add('flex');
  }

  closeReceipt() {
    const modal = document.getElementById('receiptModal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }

  shareOnWhatsApp() {
    if (!this.currentReceiptData) return;
    const { payment: p, settings: s } = this.currentReceiptData;
    const phone = (p.phone || '').replace(/[^0-9]/g, '');
    const businessName = s.business_name || 'RAMESH CABLES AND NET WORK';
    const bizPhone = s.contact_phone || '9842100000';
    
    let dateFormatted = new Date().toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric'
    });
    try {
      const cleanDate = (p.payment_date || '').toString().replace(' ', 'T');
      const d = cleanDate ? new Date(cleanDate) : new Date();
      if (!isNaN(d.getTime())) {
        dateFormatted = d.toLocaleDateString('en-IN', {
          day: '2-digit', month: 'short', year: 'numeric'
        });
      }
    } catch (_) {}

    const msg = 
`*${businessName}*
📞 Helpline: ${bizPhone}
----------------------------------
🧾 *CABLE TV PAYMENT RECEIPT*
📅 தேதி / Date: ${dateFormatted}
👤 பெயர் / Name: ${p.customer_name}
📺 STB Box No: ${p.box_number} (${p.operator})
🏠 முகவரி / Address: ${p.door_no ? p.door_no + ', ' : ''}${p.street || ''}
🗓️ மாதம் / Month: ${p.month}
💰 *செலுத்திய தொகை / Paid: ₹${parseFloat(p.amount_paid).toFixed(0)}*
💳 முறை / Mode: ${p.payment_mode}${p.transaction_ref ? ` (Ref: ${p.transaction_ref})` : ''}
✅ *STATUS: PAID*
----------------------------------
கட்டணம் செலுத்தியமைக்கு நன்றி!
Thank you for your payment!`.trim();

    const targetUrl = phone ? 
      `https://wa.me/91${phone}?text=${encodeURIComponent(msg)}` : 
      `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;

    window.open(targetUrl, '_blank');
  }

  sendReminderWhatsApp(cust, month, settings) {
    const phone = (cust.phone || '').replace(/[^0-9]/g, '');
    const businessName = settings.business_name || 'RAMESH CABLES AND NET WORK';
    const bizPhone = settings.contact_phone || '9842100000';
    const upiId = settings.upi_id || 'rameshcables@okaxis';
    const dueAmount = cust.due_amount || cust.monthly_fee;

    const msg = 
`*${businessName}*
📞 Helpline: ${bizPhone}
----------------------------------
📢 *CABLE TV BILL REMINDER / நினைவூட்டல்*
வணக்கம் ${cust.customer_name},

உங்கள் செட்-டாப் பாக்ஸ் கட்டணம் நிலுவையில் உள்ளது:
📺 STB Box: ${cust.box_number} (${cust.operator})
🏠 கதவு / Door: ${cust.door_no || ''}, ${cust.street || ''}
🗓️ மாதம் / Month: ${month}
💰 *கட்டணத் தொகை / Bill Due: ₹${parseFloat(dueAmount).toFixed(0)}*

📲 GPay / PhonePe UPI மூலம் செலுத்த:
*${upiId}*

நேரடியாக பணம் செலுத்துவதற்கு ரமேஷ் கேபிள்ஸ் அவர்களை தொடர்பு கொள்ளவும் (${bizPhone}).
நன்றி!`.trim();

    const targetUrl = phone ? 
      `https://wa.me/91${phone}?text=${encodeURIComponent(msg)}` : 
      `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;

    window.open(targetUrl, '_blank');
  }

  printReceipt() {
    window.print();
  }
}

window.receiptManager = new ReceiptManager();
