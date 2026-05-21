// Cryptex Main Controller Logic

// State variables
let encryptSelectedFileObj = null;
let decryptSelectedFileObj = null;

// Tab Navigation
window.switchTab = function(tabName) {
    // Update active tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`tab-${tabName}`).classList.add('active');
    
    // Update active tab contents
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    document.getElementById(`section-${tabName}`).classList.add('active');

    // Reset results if switching
    if (tabName === 'encrypt') {
        closeDecryptedResult();
    }
};

// Toggle Password Visibility
window.togglePasswordVisibility = function(inputId) {
    const input = document.getElementById(inputId);
    const btn = input.nextElementSibling;
    
    if (input.type === 'password') {
        input.type = 'text';
        btn.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="eye-icon"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.52 13.52 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/></svg>
        `;
    } else {
        input.type = 'password';
        btn.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="eye-icon"><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0z"/><circle cx="12" cy="12" r="3"/></svg>
        `;
    }
};

// Drag and drop events setup helper
function setupDragAndDrop(dropzoneId, fileInputId, onFileSelected) {
    const dropzone = document.getElementById(dropzoneId);
    const fileInput = document.getElementById(fileInputId);

    dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('dragover');
    });

    dropzone.addEventListener('dragleave', () => {
        dropzone.classList.remove('dragover');
    });

    dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
        if (e.dataTransfer.files.length > 0) {
            fileInput.files = e.dataTransfer.files;
            onFileSelected(e.dataTransfer.files[0]);
        }
    });

    fileInput.addEventListener('change', () => {
        if (fileInput.files.length > 0) {
            onFileSelected(fileInput.files[0]);
        }
    });
}

// Initialise drag and drop
document.addEventListener('DOMContentLoaded', () => {
    // Encrypt zone
    setupDragAndDrop('encrypt-dropzone', 'encrypt-file-input', (file) => {
        encryptSelectedFileObj = file;
        
        // Show file details
        document.getElementById('encrypt-dropzone-prompt').classList.add('hidden');
        document.getElementById('encrypt-file-details').classList.remove('hidden');
        document.getElementById('encrypt-file-name').textContent = file.name;
        document.getElementById('encrypt-file-size').textContent = formatBytes(file.size);
        
        validateInputs();
    });

    // Decrypt zone
    setupDragAndDrop('decrypt-dropzone', 'decrypt-file-input', (file) => {
        if (!file.name.endsWith('.html')) {
            alert('الرجاء اختيار ملف HTML مشفر تم إنشاؤه بواسطة Cryptex!');
            clearDecryptFile();
            return;
        }
        decryptSelectedFileObj = file;
        
        // Show file details
        document.getElementById('decrypt-dropzone-prompt').classList.add('hidden');
        document.getElementById('decrypt-file-details').classList.remove('hidden');
        document.getElementById('decrypt-file-name').textContent = file.name;
        document.getElementById('decrypt-file-size').textContent = formatBytes(file.size);
        
        validateDecryptInputs();
    });

    // Setup input listeners to toggle submit buttons
    document.getElementById('decrypt-password').addEventListener('input', validateDecryptInputs);
});

// Clear selection functions
window.clearEncryptFile = function(e) {
    if (e) e.stopPropagation();
    encryptSelectedFileObj = null;
    document.getElementById('encrypt-file-input').value = '';
    document.getElementById('encrypt-dropzone-prompt').classList.remove('hidden');
    document.getElementById('encrypt-file-details').classList.add('hidden');
    validateInputs();
};

window.clearDecryptFile = function(e) {
    if (e) e.stopPropagation();
    decryptSelectedFileObj = null;
    document.getElementById('decrypt-file-input').value = '';
    document.getElementById('decrypt-dropzone-prompt').classList.remove('hidden');
    document.getElementById('decrypt-file-details').classList.add('hidden');
    validateDecryptInputs();
};

// Format file size helper
function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// Password Strength Evaluation
window.checkPasswordStrength = function() {
    const password = document.getElementById('encrypt-password').value;
    
    // Test requirements
    const hasLength = password.length >= 8;
    const hasUpper = /[A-Z]/.test(password);
    const hasLower = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecial = /[^A-Za-z0-9]/.test(password);
    
    // Update visual checks
    updateRequirementUI('req-length', hasLength);
    updateRequirementUI('req-upper', hasUpper);
    updateRequirementUI('req-lower', hasLower);
    updateRequirementUI('req-number', hasNumber);
    updateRequirementUI('req-special', hasSpecial);
    
    // Calculate score
    let score = 0;
    if (hasLength) score++;
    if (hasUpper) score++;
    if (hasLower) score++;
    if (hasNumber) score++;
    if (hasSpecial) score++;
    
    // Calculate percentage and colors
    const bar = document.getElementById('strength-bar');
    const txt = document.getElementById('strength-text');
    
    const colors = ['#ff1744', '#ff9100', '#ffd600', '#00e676', '#00e676'];
    const labels = [
        'قوة كلمة المرور: ضعيفة جداً 🔴',
        'قوة كلمة المرور: ضعيفة 🟠',
        'قوة كلمة المرور: متوسطة 🟡',
        'قوة كلمة المرور: قوية 🟢',
        'قوة كلمة المرور: آمنة جداً ودفاعية 🛡️'
    ];
    
    const percentage = password ? (score / 5) * 100 : 0;
    bar.style.width = `${percentage}%`;
    
    if (password) {
        bar.style.backgroundColor = colors[score - 1];
        txt.textContent = labels[score - 1];
    } else {
        bar.style.backgroundColor = 'transparent';
        txt.textContent = 'قوة كلمة المرور: ضعيفة جداً';
    }
    
    validateInputs();
};

function updateRequirementUI(elementId, isValid) {
    const el = document.getElementById(elementId);
    if (isValid) {
        el.className = 'valid';
        el.querySelector('.bullet').textContent = '✓';
    } else {
        el.className = 'invalid';
        el.querySelector('.bullet').textContent = '✕';
    }
}

// Check if all rules are satisfied to enable Submit
function validateInputs() {
    const password = document.getElementById('encrypt-password').value;
    const isFileSelected = encryptSelectedFileObj !== null;
    
    const isSecure = password.length >= 8 &&
                     /[A-Z]/.test(password) &&
                     /[a-z]/.test(password) &&
                     /[0-9]/.test(password) &&
                     /[^A-Za-z0-9]/.test(password);
                     
    document.getElementById('btn-encrypt-submit').disabled = !(isFileSelected && isSecure);
}

function validateDecryptInputs() {
    const password = document.getElementById('decrypt-password').value;
    const isFileSelected = decryptSelectedFileObj !== null;
    
    document.getElementById('btn-decrypt-submit').disabled = !(isFileSelected && password);
}

// Convert ArrayBuffer to CryptoJS WordArray using native TypedArray support
function arrayBufferToWordArray(ab) {
    return CryptoJS.lib.WordArray.create(new Uint8Array(ab));
}

// Convert CryptoJS WordArray to Uint8Array
function wordArrayToUint8Array(wordArray) {
    const l = wordArray.sigBytes;
    const words = wordArray.words;
    const result = new Uint8Array(l);
    for (let j = 0; j < l; j++) {
        const word = words[j >>> 2];
        const byte = (word >>> (24 - (j % 4) * 8)) & 0xff;
        result[j] = byte;
    }
    return result;
}

// Main Encryption Handler
window.encryptSelectedFile = function() {
    if (!encryptSelectedFileObj) return;
    
    const password = document.getElementById('encrypt-password').value;
    
    // Show Loading Modal
    const overlay = document.getElementById('processing-overlay');
    document.getElementById('processing-title').textContent = 'جاري تشفير الملف...';
    const descEl = document.getElementById('processing-desc');
    if (descEl) {
        descEl.textContent = 'يتم توليد مفتاح الحماية وتطبيق خوارزمية التشفير محلياً.';
    }
    overlay.classList.remove('hidden');
    
    const file = encryptSelectedFileObj;
    const reader = new FileReader();
    
    reader.onload = function(e) {
        // Keep UI active in setTimeout
        setTimeout(() => {
            try {
                const arrayBuffer = e.target.result;
                const fileWordArray = arrayBufferToWordArray(arrayBuffer);
                
                // 1. Generate salt and IV
                const salt = CryptoJS.lib.WordArray.random(128 / 8);
                const iv = CryptoJS.lib.WordArray.random(128 / 8);
                
                // 2. Derive key (600,000 PBKDF2 iterations with SHA-256)
                const derivedKey = CryptoJS.PBKDF2(password, salt, {
                    keySize: 256 / 32,
                    iterations: 600000,
                    hasher: CryptoJS.algo.SHA256
                });
                
                // 3. Encrypt data using AES-256-CBC
                const encrypted = CryptoJS.AES.encrypt(fileWordArray, derivedKey, {
                    iv: iv,
                    padding: CryptoJS.pad.Pkcs7,
                    mode: CryptoJS.mode.CBC
                });
                
                const ciphertext = encrypted.toString();
                
                // 4. Create secure payload bundle
                const payload = {
                    filename: file.name,
                    filetype: file.type,
                    filesize: formatBytes(file.size),
                    salt: salt.toString(CryptoJS.enc.Hex),
                    iv: iv.toString(CryptoJS.enc.Hex),
                    ciphertext: ciphertext
                };
                
                // 5. Inject payload into template
                // CRYPTEX_TEMPLATE comes from template.js loaded globally
                const outputHtml = CRYPTEX_TEMPLATE.replace('/* FILE_PAYLOAD */', JSON.stringify(payload));
                
                // 6. Download the compiled file
                const blob = new Blob([outputHtml], { type: 'text/html;charset=utf-8;' });
                const downloadLink = document.createElement('a');
                downloadLink.href = URL.createObjectURL(blob);
                downloadLink.download = `${file.name}.html`;
                document.body.appendChild(downloadLink);
                downloadLink.click();
                document.body.removeChild(downloadLink);
                
                // Hide loading and reset form
                overlay.classList.add('hidden');
                document.getElementById('encrypt-password').value = '';
                checkPasswordStrength();
                clearEncryptFile();
                
            } catch (err) {
                console.error(err);
                overlay.classList.add('hidden');
                alert('حدث خطأ أثناء تشفير الملف: ' + err.message + '\n' + err.stack);
            }
        }, 100);
    };
    
    reader.readAsArrayBuffer(file);
};

// Main Decryption Handler (built-in tab)
window.decryptSelectedFile = function() {
    if (!decryptSelectedFileObj) return;
    
    const password = document.getElementById('decrypt-password').value;
    const file = decryptSelectedFileObj;
    
    const overlay = document.getElementById('processing-overlay');
    document.getElementById('processing-title').textContent = 'جاري فك التشفير...';
    const descEl = document.getElementById('processing-desc');
    if (descEl) {
        descEl.textContent = 'جاري استخراج البيانات وفك التشفير والتحقق من كلمة المرور.';
    }
    overlay.classList.remove('hidden');
    
    const reader = new FileReader();
    reader.onload = function(e) {
        setTimeout(() => {
            try {
                const text = e.target.result;
                
                // Extract SECURE_PAYLOAD JSON string using Regex
                const match = text.match(/const SECURE_PAYLOAD\s*=\s*(\{[\s\S]*?\});/);
                if (!match) {
                    throw new Error('الملف المرفوع لا يحتوي على بيانات مشفرة صالحة من Cryptex!');
                }
                
                const payload = JSON.parse(match[1]);
                
                // Extract params
                const salt = CryptoJS.enc.Hex.parse(payload.salt);
                const iv = CryptoJS.enc.Hex.parse(payload.iv);
                const ciphertext = payload.ciphertext;
                
                // Derive key
                const key = CryptoJS.PBKDF2(password, salt, {
                    keySize: 256 / 32,
                    iterations: 600000,
                    hasher: CryptoJS.algo.SHA256
                });
                
                // Decrypt
                const decrypted = CryptoJS.AES.decrypt(ciphertext, key, {
                    iv: iv,
                    padding: CryptoJS.pad.Pkcs7,
                    mode: CryptoJS.mode.CBC
                });
                
                if (decrypted.sigBytes <= 0) {
                    throw new Error('Incorrect password');
                }
                
                // Convert back to binary array
                const binaryData = wordArrayToUint8Array(decrypted);
                
                // Populate result UI
                displayDecryptedResult(payload.filename, payload.filetype, payload.filesize, binaryData);
                
                overlay.classList.add('hidden');
                document.getElementById('decrypt-password').value = '';
                clearDecryptFile();
                
            } catch (err) {
                console.error(err);
                overlay.classList.add('hidden');
                alert('فشل فك التشفير! كلمة المرور غير صحيحة أو الملف تالف.');
            }
        }, 100);
    };
    
    reader.readAsText(file);
};

let localDecryptedUrl = null;

function displayDecryptedResult(filename, filetype, filesize, binaryData) {
    const card = document.getElementById('decrypted-result-card');
    const previewContainer = document.getElementById('result-preview-container');
    
    // Revoke old URL if any
    if (localDecryptedUrl) {
        URL.revokeObjectURL(localDecryptedUrl);
    }
    
    const blob = new Blob([binaryData], { type: filetype || 'application/octet-stream' });
    localDecryptedUrl = URL.createObjectURL(blob);
    
    // Add full screen mode to app container
    document.querySelector('.app-container').classList.add('fullscreen-mode');
    document.body.classList.add('fullscreen-active');
    
    // Set headers
    document.getElementById('result-file-name').textContent = filename;
    document.getElementById('result-file-type').textContent = filetype || 'غير معروف';
    document.getElementById('result-file-size').textContent = filesize;
    
    // Configure download button
    const dlBtn = document.getElementById('btn-download-decrypted');
    dlBtn.onclick = () => {
        const a = document.createElement('a');
        a.href = localDecryptedUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };
    
    // Handle Theme Selector visibility
    const isText = filetype && (filetype.startsWith('text/') || filetype === 'application/json' || filetype === 'application/javascript');
    const localThemeSel = document.getElementById('local-theme-selector');
    if (isText) {
        localThemeSel.classList.remove('hidden');
        document.getElementById('local-theme-select').value = 'obsidian';
    } else {
        localThemeSel.classList.add('hidden');
    }

    // Render preview inside encryptor UI
    previewContainer.innerHTML = '';
    
    if (filetype && filetype.startsWith('image/')) {
        const img = document.createElement('img');
        img.src = localDecryptedUrl;
        img.className = 'preview-image';
        previewContainer.appendChild(img);
    } else if (filetype === 'application/pdf') {
        const iframe = document.createElement('iframe');
        iframe.src = localDecryptedUrl;
        iframe.className = 'preview-pdf';
        previewContainer.appendChild(iframe);
    } else if (isText) {
        const textContainer = document.createElement('pre');
        textContainer.className = 'preview-text theme-obsidian';
        
        const reader = new FileReader();
        reader.onload = function(e) {
            textContainer.textContent = e.target.result;
        };
        reader.readAsText(blob);
        previewContainer.appendChild(textContainer);
    } else if (filetype && (filetype.startsWith('audio/') || filetype.startsWith('video/'))) {
        const media = document.createElement(filetype.startsWith('audio/') ? 'audio' : 'video');
        media.src = localDecryptedUrl;
        media.className = 'preview-media';
        media.controls = true;
        previewContainer.appendChild(media);
    } else {
        const fallback = document.createElement('div');
        fallback.className = 'no-preview';
        fallback.innerHTML = 'لا تتوفر معاينة مباشرة لهذا النوع من الملفات.<br>يرجى النقر فوق زر "تحميل الملف الأصلي" لحفظ الملف واستعراضه.';
        previewContainer.appendChild(fallback);
    }
    
    card.classList.remove('hidden');
}

window.closeDecryptedResult = function() {
    const card = document.getElementById('decrypted-result-card');
    card.classList.add('hidden');
    
    // Remove full screen mode
    document.querySelector('.app-container').classList.remove('fullscreen-mode');
    document.body.classList.remove('fullscreen-active');
    
    if (localDecryptedUrl) {
        URL.revokeObjectURL(localDecryptedUrl);
        localDecryptedUrl = null;
    }

    // Reset local theme selector
    const localThemeSel = document.getElementById('local-theme-selector');
    if (localThemeSel) {
        localThemeSel.classList.add('hidden');
    }
    const localThemeSelect = document.getElementById('local-theme-select');
    if (localThemeSelect) {
        localThemeSelect.value = 'obsidian';
    }
};

window.changeLocalTextTheme = function(themeName) {
    const textContainer = document.querySelector('#result-preview-container .preview-text');
    if (textContainer) {
        textContainer.className = 'preview-text theme-' + themeName;
    }
};
