/**
 * Camera Barcode & QR Code Scanner for Ramesh Cables
 * Automatically identifies Set-Top Box numbers and opens payment modal
 */

class STBScanner {
  constructor() {
    this.html5QrCode = null;
    this.isScanning = false;
    this.modal = document.getElementById('scannerModal');
    this.audioContext = null;
    this.initAudio();
  }

  initAudio() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.audioContext = new AudioCtx();
      }
    } catch (e) {
      console.log('AudioContext not supported');
    }
  }

  playBeep() {
    // Play cashier scanner beep
    try {
      if (!this.audioContext) this.initAudio();
      if (this.audioContext) {
        const osc = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();
        osc.connect(gain);
        gain.connect(this.audioContext.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1800, this.audioContext.currentTime);
        gain.gain.setValueAtTime(0.3, this.audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.15);
        osc.start();
        osc.stop(this.audioContext.currentTime + 0.15);
      }
    } catch (e) {
      console.log('Beep audio error', e);
    }

    // Phone vibration
    if (navigator.vibrate) {
      navigator.vibrate([80, 40, 80]);
    }
  }

  open() {
    this.modal.classList.remove('hidden');
    this.modal.classList.add('flex');
    this.startScanner();
  }

  close() {
    this.stopScanner();
    this.modal.classList.add('hidden');
    this.modal.classList.remove('flex');
  }

  async startScanner() {
    const readerElement = document.getElementById('reader');
    if (!readerElement) return;

    const statusEl = document.getElementById('scannerStatus');
    statusEl.innerHTML = '<span class="text-blue-500 font-semibold animate-pulse">Starting camera... Point at STB Barcode / QR</span>';

    // If Html5Qrcode is loaded from CDN/offline
    if (window.Html5Qrcode) {
      try {
        if (!this.html5QrCode) {
          this.html5QrCode = new Html5Qrcode("reader");
        }
        
        const config = {
          fps: 15,
          qrbox: { width: 280, height: 180 },
          aspectRatio: 1.0,
          formatsToSupport: [
            Html5QrcodeSupportedFormats.QR_CODE,
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.UPC_A
          ]
        };

        await this.html5QrCode.start(
          { facingMode: "environment" },
          config,
          (decodedText) => this.onScanSuccess(decodedText),
          (errorMessage) => {
            // Ignore ongoing frame decode failures
          }
        );
        this.isScanning = true;
        statusEl.innerHTML = '<span class="text-emerald-600 font-semibold">Camera Active! Align barcode inside the frame</span>';
      } catch (err) {
        console.warn('Html5Qrcode error:', err);
        this.fallbackBarcodeDetector(statusEl);
      }
    } else {
      this.fallbackBarcodeDetector(statusEl);
    }
  }

  async fallbackBarcodeDetector(statusEl) {
    statusEl.innerHTML = `
      <div class="text-amber-700 bg-amber-50 p-3 rounded-lg text-xs leading-relaxed mb-3">
        <strong>Camera permission or library note:</strong> Point your camera or enter the box number directly below.
      </div>
    `;
    const manualInput = document.getElementById('manualBarcodeInput');
    if (manualInput) manualInput.focus();
  }

  async stopScanner() {
    if (this.html5QrCode && this.isScanning) {
      try {
        await this.html5QrCode.stop();
        this.isScanning = false;
      } catch (e) {
        console.log('Error stopping scanner', e);
      }
    }
  }

  async onScanSuccess(decodedText) {
    if (!decodedText) return;
    this.playBeep();
    await this.stopScanner();
    this.close();

    // Look up customer
    await window.app.lookupAndOpenPayment(decodedText);
  }
}

window.scannerInstance = null;
document.addEventListener('DOMContentLoaded', () => {
  window.scannerInstance = new STBScanner();
});
