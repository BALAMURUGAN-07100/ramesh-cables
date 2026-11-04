/**
 * RAMESH CABLES AND NET WORK - Tamil Keyboard & Phonetic Transliteration System
 * Designed specifically for easy customer data entry on mobile and desktop
 */

class TamilKeyboard {
  constructor() {
    this.activeInput = null;
    this.isOpen = false;
    this.mode = 'letters'; // 'letters' or 'translit'

    // Tamil Unicode Letters
    this.vowels = [
      'அ', 'ஆ', 'இ', 'ஈ', 'உ', 'ஊ', 'எ', 'ஏ', 'ஐ', 'ஒ', 'ஓ', 'ஔ', 'ஃ'
    ];

    this.consonants = [
      'க', 'ங', 'ச', 'ஞ', 'ட', 'ண',
      'த', 'ந', 'ப', 'ம', 'ய', 'ர',
      'ல', 'வ', 'ழ', 'ள', 'ற', 'ன'
    ];

    this.grantha = [
      'ஜ', 'ஷ', 'ஸ', 'ஹ', 'க்ஷ', 'ஸ்ரீ'
    ];

    // Vowel Diacritics (Pulli and Signs)
    this.signs = [
      { label: '் (க்)', char: '\u0BCD' },   // Pulli (e.g. க்)
      { label: 'ா (கா)', char: '\u0BBE' },   // Aa (e.g. கா)
      { label: 'ி (கி)', char: '\u0BBF' },   // I (e.g. கி)
      { label: 'ீ (கீ)', char: '\u0BC0' },   // Ee (e.g. கீ)
      { label: 'ு (கு)', char: '\u0BC1' },   // U (e.g. கு)
      { label: 'ூ (கூ)', char: '\u0BC2' },   // Oo (e.g. கூ)
      { label: 'ெ (கெ)', char: '\u0BC6' },   // E (e.g. கெ)
      { label: 'ே (கே)', char: '\u0BC7' },   // Ae (e.g. கே)
      { label: 'ை (கை)', char: '\u0BC8' },   // Ai (e.g. கை)
      { label: 'ொ (கொ)', char: '\u0BCA' },   // O (e.g. கொ)
      { label: 'ோ (கோ)', char: '\u0BCB' },   // Oh (e.g. கோ)
      { label: 'ௌ (கௌ)', char: '\u0BCC' }    // Au (e.g. கௌ)
    ];

    // Common customer words for 1-tap entry
    this.quickWords = [
      'முருகன்', 'குமார்', 'ராஜா', 'தேவி', 'அம்மா', 'மகன்', 'மகள்', 'அண்ணன்',
      'பாண்டி', 'கணேசன்', 'செல்வம்', 'மணி', 'சரவணன்', 'லட்சுமி', 'சேகர்', 'கார்த்திக்'
    ];

    this.init();
  }

  init() {
    this.createKeyboardDOM();
    this.attachInputListeners();
  }

  createKeyboardDOM() {
    if (document.getElementById('tamilKeyboardContainer')) return;

    const div = document.createElement('div');
    div.id = 'tamilKeyboardContainer';
    div.className = 'fixed bottom-0 left-0 right-0 z-50 bg-slate-900/95 backdrop-blur-md text-white border-t-2 border-indigo-500 shadow-2xl transition-transform duration-300 transform translate-y-full';
    div.innerHTML = `
      <!-- Keyboard Header / Toolbar -->
      <div class="max-w-4xl mx-auto px-3 py-2 flex items-center justify-between border-b border-slate-700/80 bg-slate-950/70">
        <div class="flex items-center gap-2">
          <span class="text-base">⌨️</span>
          <span class="text-xs font-black tracking-wide text-indigo-300 uppercase">தமிழ் விசைப்பலகை (Tamil Keyboard)</span>
          <span class="text-[10px] text-slate-400 hidden sm:inline">| கிளிக் செய்து தட்டச்சு செய்க</span>
        </div>
        
        <div class="flex items-center gap-2">
          <!-- Phonetic Tanglish Helper Button -->
          <button type="button" onclick="tamilKeyboard.showTranslitBar()" class="text-xs font-bold px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white flex items-center gap-1 transition-all">
            <span>🔤 Tanglish ➔ தமிழ்</span>
          </button>
          
          <!-- Close Button -->
          <button type="button" onclick="tamilKeyboard.toggle(false)" class="p-1 px-2.5 rounded-lg bg-slate-800 hover:bg-rose-600 text-slate-300 hover:text-white text-xs font-bold transition-all">
            ✕ மூடு (Close)
          </button>
        </div>
      </div>

      <!-- Quick Tanglish Transliteration Bar (Convert typing like 'murugan' -> 'முருகன்') -->
      <div id="tkTranslitBar" class="max-w-4xl mx-auto px-3 py-2 bg-slate-800/90 border-b border-slate-700 flex items-center gap-2">
        <span class="text-xs text-indigo-300 font-bold whitespace-nowrap">English Type:</span>
        <input type="text" id="tkTranslitInput" placeholder="Type name in English (e.g. murugan, selvam, devi)..." class="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-400">
        <button type="button" onclick="tamilKeyboard.convertTranslitAndInsert()" class="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold px-3 py-1.5 rounded-lg shadow-sm whitespace-nowrap transition-all">
          ✓ தமிழில் மாற்று (Insert)
        </button>
      </div>

      <!-- Quick Names Pill Bar -->
      <div class="max-w-4xl mx-auto px-3 py-1.5 overflow-x-auto flex items-center gap-1.5 no-scrollbar bg-slate-900/60 border-b border-slate-800">
        <span class="text-[10px] text-slate-400 font-bold uppercase whitespace-nowrap">அடிக்கடி பெயர்கள்:</span>
        ${this.quickWords.map(w => `
          <button type="button" onclick="tamilKeyboard.insertText('${w} ')" class="text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-800 hover:bg-indigo-600 text-slate-200 hover:text-white whitespace-nowrap transition-all">
            ${w}
          </button>
        `).join('')}
      </div>

      <!-- Keyboard Keys Section -->
      <div class="max-w-4xl mx-auto p-2 sm:p-3 overflow-y-auto max-h-[42vh] sm:max-h-[38vh] space-y-2 select-none">
        
        <!-- ROW 1: Vowels (உயிர் எழுத்துக்கள்) -->
        <div class="flex items-center gap-1 overflow-x-auto pb-1">
          <span class="text-[10px] text-amber-400 font-bold w-12 shrink-0">உயிர்:</span>
          ${this.vowels.map(v => `
            <button type="button" onclick="tamilKeyboard.insertText('${v}')" class="tk-key flex-1 min-w-[32px] sm:min-w-[40px] h-9 sm:h-10 rounded-lg bg-slate-800 hover:bg-amber-600 active:scale-95 text-sm sm:text-base font-bold text-amber-200 transition-all flex items-center justify-center shadow-sm">
              ${v}
            </button>
          `).join('')}
        </div>

        <!-- ROW 2: Diacritics / Signs (உயிர்மெய் குறிகள்) -->
        <div class="flex items-center gap-1 overflow-x-auto pb-1">
          <span class="text-[10px] text-emerald-400 font-bold w-12 shrink-0">குறிகள்:</span>
          ${this.signs.map(s => `
            <button type="button" onclick="tamilKeyboard.insertText('${s.char}')" class="tk-key flex-1 min-w-[34px] sm:min-w-[42px] h-9 sm:h-10 rounded-lg bg-emerald-950/70 hover:bg-emerald-600 border border-emerald-700/50 active:scale-95 text-xs sm:text-sm font-black text-emerald-200 transition-all flex items-center justify-center shadow-sm" title="${s.label}">
              ${s.label}
            </button>
          `).join('')}
        </div>

        <!-- ROW 3 & 4: Consonants (மெய் எழுத்துக்கள்) -->
        <div class="flex items-center gap-1 overflow-x-auto pb-1">
          <span class="text-[10px] text-blue-400 font-bold w-12 shrink-0">மெய் 1:</span>
          ${this.consonants.slice(0, 9).map(c => `
            <button type="button" onclick="tamilKeyboard.insertText('${c}')" class="tk-key flex-1 min-w-[34px] sm:min-w-[42px] h-9 sm:h-10 rounded-lg bg-slate-800 hover:bg-blue-600 active:scale-95 text-sm sm:text-base font-bold text-white transition-all flex items-center justify-center shadow-sm">
              ${c}
            </button>
          `).join('')}
        </div>

        <div class="flex items-center gap-1 overflow-x-auto pb-1">
          <span class="text-[10px] text-blue-400 font-bold w-12 shrink-0">மெய் 2:</span>
          ${this.consonants.slice(9).map(c => `
            <button type="button" onclick="tamilKeyboard.insertText('${c}')" class="tk-key flex-1 min-w-[34px] sm:min-w-[42px] h-9 sm:h-10 rounded-lg bg-slate-800 hover:bg-blue-600 active:scale-95 text-sm sm:text-base font-bold text-white transition-all flex items-center justify-center shadow-sm">
              ${c}
            </button>
          `).join('')}
        </div>

        <!-- ROW 5: Grantha + Action Buttons -->
        <div class="flex items-center gap-1 overflow-x-auto">
          <span class="text-[10px] text-purple-400 font-bold w-12 shrink-0">கிரந்தம்:</span>
          ${this.grantha.map(g => `
            <button type="button" onclick="tamilKeyboard.insertText('${g}')" class="tk-key flex-1 min-w-[34px] sm:min-w-[40px] h-9 sm:h-10 rounded-lg bg-purple-950/60 hover:bg-purple-600 border border-purple-700/50 active:scale-95 text-xs sm:text-sm font-bold text-purple-200 transition-all flex items-center justify-center shadow-sm">
              ${g}
            </button>
          `).join('')}

          <!-- Spacebar -->
          <button type="button" onclick="tamilKeyboard.insertText(' ')" class="flex-2 min-w-[80px] sm:min-w-[120px] h-9 sm:h-10 rounded-lg bg-slate-700 hover:bg-slate-600 active:scale-95 text-xs font-extrabold text-white transition-all flex items-center justify-center gap-1 shadow-sm">
            <span>␣ இடைவெளி (Space)</span>
          </button>

          <!-- Backspace -->
          <button type="button" onclick="tamilKeyboard.backspace()" class="min-w-[60px] sm:min-w-[80px] h-9 sm:h-10 rounded-lg bg-rose-900/80 hover:bg-rose-600 active:scale-95 text-xs font-extrabold text-rose-100 transition-all flex items-center justify-center gap-1 shadow-sm">
            <span>⌫ அழி (Del)</span>
          </button>
        </div>

      </div>
    `;

    document.body.appendChild(div);

    // Also add enter listener on the translit input
    setTimeout(() => {
      const translitInp = document.getElementById('tkTranslitInput');
      if (translitInp) {
        translitInp.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            this.convertTranslitAndInsert();
          }
        });
      }
    }, 200);
  }

  attachInputListeners() {
    // Listen to focus on text inputs so keyboard knows where to write
    document.addEventListener('focusin', (e) => {
      const tag = e.target.tagName;
      const type = e.target.type;
      if (tag === 'INPUT' || tag === 'TEXTAREA') {
        if (!['button', 'submit', 'checkbox', 'radio', 'file'].includes(type)) {
          // If focus is NOT inside the transliteration bar
          if (e.target.id !== 'tkTranslitInput') {
            this.activeInput = e.target;
          }
        }
      }
    });
  }

  toggle(force) {
    const container = document.getElementById('tamilKeyboardContainer');
    if (!container) return;

    if (force !== undefined) {
      this.isOpen = force;
    } else {
      this.isOpen = !this.isOpen;
    }

    if (this.isOpen) {
      container.classList.remove('translate-y-full');
      container.classList.add('translate-y-0');
      // If no active input set yet, default to search or customer name
      if (!this.activeInput) {
        this.activeInput = document.getElementById('custName') || 
                           document.getElementById('searchInput') || 
                           document.querySelector('input[type="text"]');
      }
    } else {
      container.classList.add('translate-y-full');
      container.classList.remove('translate-y-0');
    }
  }

  showTranslitBar() {
    const input = document.getElementById('tkTranslitInput');
    if (input) {
      input.focus();
    }
  }

  insertText(text) {
    if (!this.activeInput) {
      this.activeInput = document.getElementById('custName') || document.getElementById('searchInput');
    }
    if (!this.activeInput) return;

    const el = this.activeInput;
    const start = el.selectionStart || el.value.length;
    const end = el.selectionEnd || el.value.length;
    const val = el.value;

    el.value = val.substring(0, start) + text + val.substring(end);
    el.selectionStart = el.selectionEnd = start + text.length;
    el.focus();

    // Trigger input event so any search or validation listeners fire
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }

  backspace() {
    if (!this.activeInput) return;
    const el = this.activeInput;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const val = el.value;

    if (start === 0 && end === 0) return;

    if (start === end) {
      // Remove previous grapheme cluster / character
      el.value = val.substring(0, start - 1) + val.substring(end);
      el.selectionStart = el.selectionEnd = start - 1;
    } else {
      el.value = val.substring(0, start) + val.substring(end);
      el.selectionStart = el.selectionEnd = start;
    }

    el.focus();
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }

  convertTranslitAndInsert() {
    const inp = document.getElementById('tkTranslitInput');
    if (!inp || !inp.value.trim()) return;

    const englishText = inp.value.trim();
    const tamilConverted = this.transliterateToTamil(englishText);

    this.insertText(tamilConverted + ' ');
    inp.value = '';
    
    if (this.activeInput) {
      this.activeInput.focus();
    }
  }

  /**
   * Phonetic English (Tanglish) to Tamil Converter
   * Example: 'murugan' -> 'முருகன்', 'devi' -> 'தேவி', 'selvam' -> 'செல்வம்'
   */
  transliterateToTamil(text) {
    let s = text.toLowerCase();

    // Common words dictionary for 100% precision
    const dict = {
      'murugan': 'முருகன்',
      'devi': 'தேவி',
      'murugesan': 'முருகேசன்',
      'paulraj': 'பால்ராஜ்',
      'palraj': 'பால்ராஜ்',
      'pushpam': 'புஷ்பம்',
      'nurse': 'நர்ஸ்',
      'gopi': 'கோபி',
      'muniyammal': 'முனியம்மாள்',
      'muniyandi': 'முனியாண்டி',
      'kabali': 'கபாலி',
      'samsudeen': 'சம்சுதீன்',
      'velmurugan': 'வேல்முருகன்',
      'meena': 'மீனா',
      'thangapandi': 'தங்கப்பாண்டி',
      'durga': 'துர்கா',
      'surya': 'சூர்யா',
      'suryakala': 'சூர்ய கலா',
      'guna': 'குணா',
      'sangeetha': 'சங்கீதா',
      'kannan': 'கண்ணன்',
      'saravanan': 'சரவணன்',
      'lakshmanan': 'லட்சுமணன்',
      'jothi': 'ஜோதி',
      'priya': 'பிரியா',
      'sarasu': 'சரசு',
      'rajendran': 'ராஜேந்திரன்',
      'ganesh': 'கணேஷ்',
      'ganesan': 'கணேசன்',
      'shanmugam': 'சண்முகம்',
      'manivel': 'மணிவேல்',
      'velu': 'வேலு',
      'moorthi': 'மூர்த்தி',
      'senthil': 'செந்தில்',
      'senthilkumar': 'செந்தில் குமார்',
      'pandi': 'பாண்டி',
      'valli': 'வள்ளி',
      'murali': 'முரளி',
      'suresh': 'சுரேஷ்',
      'karthik': 'கார்த்திக்',
      'kanagaraj': 'கனகராஜ்',
      'thangam': 'தங்கம்',
      'raman': 'ராமன்',
      'vasanthi': 'வசந்தி',
      'latha': 'லதா',
      'sekar': 'சேகர்',
      'babu': 'பாபு',
      'selvam': 'செல்வம்',
      'geetha': 'கீதா',
      'magendran': 'மகேந்திரன்',
      'bakkiyam': 'பாக்கியம்',
      'fathima': 'பாத்திமா',
      'mohan': 'மோகன்',
      'kumaresan': 'குமரேசன்',
      'mariammal': 'மாரியம்மாள்',
      'lakshmi': 'லட்சுமி',
      'parameswari': 'பரமேஸ்வரி',
      'vijayakumar': 'விஜயகுமார்',
      'chandru': 'சந்துரு',
      'pandiammal': 'பாண்டியம்மாள்',
      'subramani': 'சுப்பிரமணி',
      'rajesh': 'ராஜேஷ்',
      'tamilselvi': 'தமிழ்செல்வி',
      'jeeva': 'ஜீவா',
      'ramesh': 'ரமேஷ்',
      'shanthi': 'சாந்தி',
      'chinnamma': 'சின்னம்மா',
      'sakthivel': 'சக்திவேல்',
      'john': 'ஜான்',
      'ramakrishnan': 'ராமகிருஷ்ணன்',
      'ramachandran': 'ராமச்சந்திரன்',
      'rani': 'ராணி',
      'dinesh': 'தினேஷ்',
      'saraswathi': 'சரஸ்வதி',
      'soundarya': 'சௌந்தர்யா',
      'raja': 'ராஜா',
      'rajkumar': 'ராஜ்குமார்',
      'anand': 'ஆனந்த்',
      'balamurugan': 'பாலமுருகன்',
      'bala': 'பாலா',
      'street': 'தெரு',
      'house': 'வீடு'
    };

    if (dict[s]) return dict[s];

    // Word by word conversion
    const words = s.split(/\s+/);
    const converted = words.map(w => {
      if (dict[w]) return dict[w];
      return this.transliterateWord(w);
    });

    return converted.join(' ');
  }

  transliterateWord(word) {
    const vowelMap = {
      'aa': 'ஆ', 'a': 'அ', 'ee': 'ஈ', 'i': 'இ', 'oo': 'ஊ', 'u': 'உ',
      'ae': 'ஏ', 'e': 'எ', 'ai': 'ஐ', 'oa': 'ஓ', 'o': 'ஒ', 'au': 'ஔ'
    };

    const signMap = {
      'aa': 'ா', 'a': '', 'ee': 'ீ', 'i': 'ி', 'oo': 'ூ', 'u': 'ு',
      'ae': 'ே', 'e': 'ெ', 'ai': 'ை', 'oa': 'ோ', 'o': 'ொ', 'au': 'ௌ'
    };

    const consMap = {
      'k': 'க', 'g': 'க', 'ng': 'ங', 'ch': 'ச', 'c': 'ச', 's': 'ச',
      'j': 'ஜ', 'th': 'த', 'dh': 'த', 'd': 'ட', 't': 'ட', 'n': 'ந',
      'p': 'ப', 'b': 'ப', 'm': 'ம', 'y': 'ய', 'r': 'ர', 'l': 'ல',
      'v': 'வ', 'w': 'வ', 'zh': 'ழ', 'z': 'ழ', 'sh': 'ஷ', 'h': 'ஹ'
    };

    // Fallback phonetic parsing
    let out = '';
    let i = 0;
    while (i < word.length) {
      // Check 2-letter consonants
      let c = null, cLen = 0;
      if (i + 1 < word.length && consMap[word.substr(i, 2)]) {
        c = consMap[word.substr(i, 2)];
        cLen = 2;
      } else if (consMap[word.substr(i, 1)]) {
        c = consMap[word.substr(i, 1)];
        cLen = 1;
      }

      if (c) {
        i += cLen;
        // Check following vowel
        let vSign = null, vLen = 0;
        if (i + 1 < word.length && signMap[word.substr(i, 2)] !== undefined) {
          vSign = signMap[word.substr(i, 2)];
          vLen = 2;
        } else if (i < word.length && signMap[word.substr(i, 1)] !== undefined) {
          vSign = signMap[word.substr(i, 1)];
          vLen = 1;
        }

        if (vSign !== null) {
          out += c + vSign;
          i += vLen;
        } else {
          // No vowel follows: consonant with pulli
          out += c + '\u0BCD';
        }
      } else {
        // Leading or standalone vowel
        let v = null, vLen = 0;
        if (i + 1 < word.length && vowelMap[word.substr(i, 2)]) {
          v = vowelMap[word.substr(i, 2)];
          vLen = 2;
        } else if (vowelMap[word.substr(i, 1)]) {
          v = vowelMap[word.substr(i, 1)];
          vLen = 1;
        }

        if (v) {
          out += v;
          i += vLen;
        } else {
          out += word[i];
          i++;
        }
      }
    }
    return out;
  }
}

// Global initialization
window.tamilKeyboard = new TamilKeyboard();
