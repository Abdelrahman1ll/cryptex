// Cryptex - Core Controller

let encryptSelectedFileObj = null;
let decryptSelectedFileObj = null;
let decryptFileHandle = null; // Stores FileSystemFileHandle for in-place overwriting
let currentEncryptSubMode = 'file';

let currentDecryptedState = {
    filename: '',
    filetype: '',
    filesize: '',
    binaryData: null,
    textData: '',
    isText: false,
    lastPassword: ''
};

let localDecryptedUrl = null;

// Notification Toasts
function showToast(message, type = 'info', duration = 4000) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let icon = 'ℹ️';
    if (type === 'success') icon = '✅';
    if (type === 'error') icon = '⚠️';

    toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(-10px)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

// Navigation Tabs
window.switchTab = function(tabName) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    const btn = document.getElementById(`tab-${tabName}`);
    if (btn) btn.classList.add('active');
    
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    const section = document.getElementById(`section-${tabName}`);
    if (section) section.classList.add('active');
};

// Sub-mode in Encrypt tab (File vs Direct Text Note)
window.switchEncryptSubMode = function(mode) {
    currentEncryptSubMode = mode;
    document.getElementById('mode-btn-file').classList.toggle('active', mode === 'file');
    document.getElementById('mode-btn-text').classList.toggle('active', mode === 'text');

    document.getElementById('encrypt-file-mode-container').classList.toggle('hidden', mode !== 'file');
    document.getElementById('encrypt-text-mode-container').classList.toggle('hidden', mode !== 'text');

    validateNewEncryptionInputs();
};

// Toggle Password Visibility
window.togglePasswordVisibility = function(inputId) {
    const input = document.getElementById(inputId);
    if (!input) return;
    
    const btn = input.nextElementSibling;
    if (input.type === 'password') {
        input.type = 'text';
        if (btn) {
            btn.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="eye-icon"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.52 13.52 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/></svg>
            `;
        }
    } else {
        input.type = 'password';
        if (btn) {
            btn.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="eye-icon"><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0z"/><circle cx="12" cy="12" r="3"/></svg>
            `;
        }
    }
};

// Setup Drag & Drop with File System Access API
function setupDragAndDrop(dropzoneId, fileInputId, onFileSelected, isDecryptZone = false) {
    const dropzone = document.getElementById(dropzoneId);
    const fileInput = document.getElementById(fileInputId);
    if (!dropzone || !fileInput) return;

    dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('dragover');
    });

    dropzone.addEventListener('dragleave', () => {
        dropzone.classList.remove('dragover');
    });

    dropzone.addEventListener('drop', async (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
        
        if (isDecryptZone && e.dataTransfer.items && e.dataTransfer.items.length > 0) {
            try {
                const item = e.dataTransfer.items[0];
                if (item.getAsFileSystemHandle) {
                    const handle = await item.getAsFileSystemHandle();
                    if (handle && handle.kind === 'file') {
                        decryptFileHandle = handle;
                    }
                }
            } catch (err) {
                console.warn('Could not acquire FileSystemHandle on drop:', err);
            }
        }

        if (e.dataTransfer.files.length > 0) {
            fileInput.files = e.dataTransfer.files;
            onFileSelected(e.dataTransfer.files[0]);
        }
    });

    if (isDecryptZone && 'showOpenFilePicker' in window) {
        dropzone.addEventListener('click', async (e) => {
            if (e.target === fileInput || decryptSelectedFileObj) return;
            e.preventDefault();
            try {
                const [handle] = await window.showOpenFilePicker({
                    types: [{
                        description: 'Cryptex HTML Files',
                        accept: { 'text/html': ['.html', '.htm'] }
                    }],
                    multiple: false
                });
                if (handle) {
                    decryptFileHandle = handle;
                    const file = await handle.getFile();
                    onFileSelected(file);
                }
            } catch (err) {
                if (err.name !== 'AbortError') {
                    fileInput.click();
                }
            }
        });
    }

    fileInput.addEventListener('change', () => {
        if (fileInput.files.length > 0) {
            onFileSelected(fileInput.files[0]);
        }
    });
}

// Initialise
document.addEventListener('DOMContentLoaded', () => {
    // Encrypt zone
    setupDragAndDrop('encrypt-dropzone', 'encrypt-file-input', (file) => {
        encryptSelectedFileObj = file;
        document.getElementById('encrypt-dropzone-prompt').classList.add('hidden');
        document.getElementById('encrypt-file-details').classList.remove('hidden');
        document.getElementById('encrypt-file-name').textContent = file.name;
        document.getElementById('encrypt-file-size').textContent = formatBytes(file.size);
        validateNewEncryptionInputs();
    }, false);

    // Decrypt zone
    setupDragAndDrop('decrypt-dropzone', 'decrypt-file-input', (file) => {
        if (!file.name.endsWith('.html') && !file.name.endsWith('.htm')) {
            showToast('الرجاء اختيار ملف HTML مشفر تم إنشاؤه بواسطة Cryptex!', 'error');
            clearDecryptFile();
            return;
        }
        decryptSelectedFileObj = file;
        document.getElementById('decrypt-dropzone-prompt').classList.add('hidden');
        document.getElementById('decrypt-file-details').classList.remove('hidden');
        document.getElementById('decrypt-file-name').textContent = file.name;
        document.getElementById('decrypt-file-size').textContent = formatBytes(file.size);
        validateDecryptInputs();
    }, true);

    const decryptPwd = document.getElementById('decrypt-password');
    if (decryptPwd) {
        decryptPwd.addEventListener('input', validateDecryptInputs);
    }
});

// Clear Handlers
window.clearEncryptFile = function(e) {
    if (e) e.stopPropagation();
    encryptSelectedFileObj = null;
    document.getElementById('encrypt-file-input').value = '';
    document.getElementById('encrypt-dropzone-prompt').classList.remove('hidden');
    document.getElementById('encrypt-file-details').classList.add('hidden');
    validateNewEncryptionInputs();
};

window.clearDecryptFile = function(e) {
    if (e) e.stopPropagation();
    decryptSelectedFileObj = null;
    decryptFileHandle = null;
    document.getElementById('decrypt-file-input').value = '';
    document.getElementById('decrypt-dropzone-prompt').classList.remove('hidden');
    document.getElementById('decrypt-file-details').classList.add('hidden');
    validateDecryptInputs();
};

function validateDecryptInputs() {
    const password = document.getElementById('decrypt-password').value;
    const isFileSelected = decryptSelectedFileObj !== null;
    document.getElementById('btn-decrypt-submit').disabled = !(isFileSelected && password);
}

window.validateNewEncryptionInputs = function() {
    const password = document.getElementById('encrypt-password').value;
    let isValid = false;

    if (currentEncryptSubMode === 'file') {
        isValid = encryptSelectedFileObj !== null && password.length > 0;
    } else {
        const text = document.getElementById('new-note-content').value.trim();
        isValid = text.length > 0 && password.length > 0;
    }

    document.getElementById('btn-encrypt-submit').disabled = !isValid;
};

// Format Bytes
function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function arrayBufferToWordArray(ab) {
    return CryptoJS.lib.WordArray.create(new Uint8Array(ab));
}

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

// Encryption Core Engine
async function executeEncryption(filename, filetype, rawBytes, password, targetHandle = null) {
    const overlay = document.getElementById('processing-overlay');
    document.getElementById('processing-title').textContent = 'جاري التشفير والحفظ...';
    overlay.classList.remove('hidden');

    await new Promise(resolve => setTimeout(resolve, 80));

    try {
        const fileWordArray = arrayBufferToWordArray(rawBytes);
        const salt = CryptoJS.lib.WordArray.random(128 / 8);
        const iv = CryptoJS.lib.WordArray.random(128 / 8);

        const derivedKey = CryptoJS.PBKDF2(password, salt, {
            keySize: 256 / 32,
            iterations: 600000,
            hasher: CryptoJS.algo.SHA256
        });

        const encrypted = CryptoJS.AES.encrypt(fileWordArray, derivedKey, {
            iv: iv,
            padding: CryptoJS.pad.Pkcs7,
            mode: CryptoJS.mode.CBC
        });

        const ciphertext = encrypted.toString();

        const payload = {
            filename: filename,
            filetype: filetype,
            filesize: formatBytes(rawBytes.byteLength || rawBytes.length),
            salt: salt.toString(CryptoJS.enc.Hex),
            iv: iv.toString(CryptoJS.enc.Hex),
            ciphertext: ciphertext
        };

        const outputHtml = CRYPTEX_TEMPLATE.replace('/* FILE_PAYLOAD */', JSON.stringify(payload));
        const safeDownloadName = filename.endsWith('.html') ? filename : `${filename}.html`;

        // 1. Direct FileSystem Handle Overwrite
        if (targetHandle) {
            try {
                const writable = await targetHandle.createWritable();
                await writable.write(outputHtml);
                await writable.close();
            } catch (err) {
                console.warn('In-place write failed:', err);
                downloadRawBlob(outputHtml, safeDownloadName);
            }
        } else if ('showSaveFilePicker' in window) {
            try {
                const handle = await window.showSaveFilePicker({
                    suggestedName: safeDownloadName,
                    types: [{
                        description: 'Cryptex HTML File',
                        accept: { 'text/html': ['.html'] }
                    }]
                });
                const writable = await handle.createWritable();
                await writable.write(outputHtml);
                await writable.close();
                decryptFileHandle = handle;
            } catch (err) {
                if (err.name !== 'AbortError') {
                    downloadRawBlob(outputHtml, safeDownloadName);
                }
            }
        } else {
            downloadRawBlob(outputHtml, safeDownloadName);
        }

        overlay.classList.add('hidden');

        // IMMEDIATELY LOCK AND RETURN TO PASSWORD INPUT VIEW
        closeDecryptedResult();
        showToast(`تم حفظ وتشفير التعديلات بنجاح! 🔒 تم قفل الملف، أدخل كلمة المرور لفتحه مجدداً.`, 'success', 5000);

    } catch (err) {
        console.error(err);
        overlay.classList.add('hidden');
        showToast('حدث خطأ أثناء التشفير: ' + err.message, 'error');
    }
}

function downloadRawBlob(content, downloadName) {
    const blob = new Blob([content], { type: 'text/html;charset=utf-8;' });
    const downloadLink = document.createElement('a');
    downloadLink.href = URL.createObjectURL(blob);
    downloadLink.download = downloadName;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
}

// Execute New Encryption
window.executeNewEncryption = async function() {
    const password = document.getElementById('encrypt-password').value;
    
    if (currentEncryptSubMode === 'file') {
        const file = encryptSelectedFileObj;
        const reader = new FileReader();
        reader.onload = async function(e) {
            await executeEncryption(file.name, file.type || 'application/octet-stream', e.target.result, password);
            document.getElementById('encrypt-password').value = '';
            clearEncryptFile();
        };
        reader.readAsArrayBuffer(file);
    } else {
        const text = document.getElementById('new-note-content').value;
        const title = document.getElementById('new-note-title').value.trim() || 'secret_note.txt';
        const encoder = new TextEncoder();
        const rawBytes = encoder.encode(text);
        
        await executeEncryption(title, 'text/plain;charset=utf-8', rawBytes, password);
        document.getElementById('encrypt-password').value = '';
        document.getElementById('new-note-content').value = '';
        validateNewEncryptionInputs();
    }
};

// Decrypt & Open Editor/Reader
window.decryptSelectedFile = function() {
    if (!decryptSelectedFileObj) return;
    
    const password = document.getElementById('decrypt-password').value;
    const file = decryptSelectedFileObj;
    
    const overlay = document.getElementById('processing-overlay');
    document.getElementById('processing-title').textContent = 'جاري التحقق وفك التشفير...';
    overlay.classList.remove('hidden');
    
    const reader = new FileReader();
    reader.onload = function(e) {
        setTimeout(() => {
            try {
                const text = e.target.result;
                const match = text.match(/(?:let|const|var)\s+SECURE_PAYLOAD\s*=\s*(\{[\s\S]*?\});/);
                if (!match) {
                    throw new Error('الملف لا يحتوي على بنية تشفير صالحة من Cryptex!');
                }
                
                const payload = JSON.parse(match[1]);
                const salt = CryptoJS.enc.Hex.parse(payload.salt);
                const iv = CryptoJS.enc.Hex.parse(payload.iv);
                const ciphertext = payload.ciphertext;
                
                const key = CryptoJS.PBKDF2(password, salt, {
                    keySize: 256 / 32,
                    iterations: 600000,
                    hasher: CryptoJS.algo.SHA256
                });
                
                const decrypted = CryptoJS.AES.decrypt(ciphertext, key, {
                    iv: iv,
                    padding: CryptoJS.pad.Pkcs7,
                    mode: CryptoJS.mode.CBC
                });
                
                if (decrypted.sigBytes <= 0) {
                    throw new Error('كلمة المرور غير صحيحة');
                }
                
                const binaryData = wordArrayToUint8Array(decrypted);
                
                currentDecryptedState.filename = payload.filename;
                currentDecryptedState.filetype = payload.filetype || 'application/octet-stream';
                currentDecryptedState.filesize = payload.filesize;
                currentDecryptedState.binaryData = binaryData;
                currentDecryptedState.lastPassword = password;

                displayDecryptedResult();
                
                overlay.classList.add('hidden');
                document.getElementById('decrypt-password').value = '';
                showToast('تم فك التشفير بنجاح! يمكنك قراءة وتعديل البيانات الآن.', 'success');
                
            } catch (err) {
                console.error(err);
                overlay.classList.add('hidden');
                showToast('فشل فك التشفير! كلمة المرور غير صحيحة.', 'error');
            }
        }, 80);
    };
    reader.readAsText(file);
};

// Display Result & Set up Editor
function displayDecryptedResult() {
    const card = document.getElementById('decrypted-result-card');
    const previewContainer = document.getElementById('result-preview-container');
    const editorPane = document.getElementById('editor-pane');
    const liveTextEditor = document.getElementById('live-text-editor');

    if (localDecryptedUrl) {
        URL.revokeObjectURL(localDecryptedUrl);
    }
    
    const blob = new Blob([currentDecryptedState.binaryData], { type: currentDecryptedState.filetype });
    localDecryptedUrl = URL.createObjectURL(blob);
    
    document.body.classList.add('fullscreen-active');
    
    document.getElementById('result-file-name').textContent = currentDecryptedState.filename;
    document.getElementById('result-file-size').textContent = currentDecryptedState.filesize;
    
    const ft = currentDecryptedState.filetype.toLowerCase();
    const fn = currentDecryptedState.filename.toLowerCase();
    const isText = ft.startsWith('text/') || 
                   ft === 'application/json' || 
                   ft === 'application/javascript' ||
                   fn.endsWith('.txt') || 
                   fn.endsWith('.json') || 
                   fn.endsWith('.js') || 
                   fn.endsWith('.html') || 
                   fn.endsWith('.css') || 
                   fn.endsWith('.md') ||
                   fn.endsWith('.csv') ||
                   fn.endsWith('.xml') ||
                   fn.endsWith('.py');

    currentDecryptedState.isText = isText;

    if (isText) {
        editorPane.classList.remove('hidden');
        previewContainer.classList.add('hidden');

        const decoder = new TextDecoder('utf-8');
        const textContent = decoder.decode(currentDecryptedState.binaryData);
        currentDecryptedState.textData = textContent;
        liveTextEditor.value = textContent;
        
        handleLiveTextEdit();
    } else {
        editorPane.classList.add('hidden');
        previewContainer.classList.remove('hidden');
        previewContainer.innerHTML = '';
        
        if (ft.startsWith('image/')) {
            const img = document.createElement('img');
            img.src = localDecryptedUrl;
            img.className = 'preview-image';
            previewContainer.appendChild(img);
        } else if (ft === 'application/pdf') {
            const iframe = document.createElement('iframe');
            iframe.src = localDecryptedUrl;
            iframe.className = 'preview-pdf';
            previewContainer.appendChild(iframe);
        } else if (ft.startsWith('audio/') || ft.startsWith('video/')) {
            const media = document.createElement(ft.startsWith('audio/') ? 'audio' : 'video');
            media.src = localDecryptedUrl;
            media.className = 'preview-media';
            media.controls = true;
            previewContainer.appendChild(media);
        } else {
            const fallback = document.createElement('div');
            fallback.className = 'no-preview';
            fallback.innerHTML = `
                <div style="font-size: 2rem; margin-bottom: 0.5rem;">📄</div>
                <strong>${currentDecryptedState.filename}</strong><br>
                <span>لا تتوفر معاينة مباشرة. يمكنك الضغط على "تنزيل خام" لحفظ الملف بدون تشفير.</span>
            `;
            previewContainer.appendChild(fallback);
        }
    }
    
    // Download Raw Button
    const dlBtn = document.getElementById('btn-download-decrypted');
    dlBtn.onclick = () => {
        let downloadBlob;
        if (currentDecryptedState.isText) {
            const encoder = new TextEncoder();
            downloadBlob = new Blob([encoder.encode(document.getElementById('live-text-editor').value)], { type: currentDecryptedState.filetype });
        } else {
            downloadBlob = new Blob([currentDecryptedState.binaryData], { type: currentDecryptedState.filetype });
        }
        
        const a = document.createElement('a');
        a.href = URL.createObjectURL(downloadBlob);
        a.download = currentDecryptedState.filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        showToast(`تم تنزيل ${currentDecryptedState.filename}`, 'info');
    };

    card.classList.remove('hidden');
}

// Live Text Edit stats
window.handleLiveTextEdit = function() {
    const editor = document.getElementById('live-text-editor');
    const text = editor.value;
    currentDecryptedState.textData = text;
    
    const chars = text.length;
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    const lines = text ? text.split('\n').length : 1;

    document.getElementById('editor-char-count').textContent = `${chars} حرف`;
    document.getElementById('editor-word-count').textContent = `${words} كلمة`;
    document.getElementById('editor-line-count').textContent = `${lines} سطر`;
    
    const encoder = new TextEncoder();
    const bytes = encoder.encode(text);
    document.getElementById('result-file-size').textContent = formatBytes(bytes.length);
};

window.handleFilenameEdit = function(element) {
    let newName = element.textContent.trim();
    if (newName) {
        currentDecryptedState.filename = newName;
    } else {
        element.textContent = currentDecryptedState.filename;
    }
};

// 1-Click Save and Re-encrypt Modified Data
window.saveAndReEncryptDirectly = async function() {
    const filename = currentDecryptedState.filename;
    const password = currentDecryptedState.lastPassword;

    if (!password) {
        showToast('تعذر العثور على كلمة المرور السابقة لإعادة التشفير', 'error');
        return;
    }

    let rawBytes;
    if (currentDecryptedState.isText) {
        const text = document.getElementById('live-text-editor').value;
        const encoder = new TextEncoder();
        rawBytes = encoder.encode(text);
    } else {
        rawBytes = currentDecryptedState.binaryData;
    }

    await executeEncryption(filename, currentDecryptedState.filetype, rawBytes, password, decryptFileHandle);
};

// Close & Lock
window.closeDecryptedResult = function() {
    const card = document.getElementById('decrypted-result-card');
    card.classList.add('hidden');
    document.body.classList.remove('fullscreen-active');
    
    if (localDecryptedUrl) {
        URL.revokeObjectURL(localDecryptedUrl);
        localDecryptedUrl = null;
    }

    currentDecryptedState = {
        filename: '',
        filetype: '',
        filesize: '',
        binaryData: null,
        textData: '',
        isText: false,
        lastPassword: ''
    };

    // Reset password input in UI so user enters it again
    const pwdInput = document.getElementById('decrypt-password');
    if (pwdInput) {
        pwdInput.value = '';
        pwdInput.focus();
    }
    validateDecryptInputs();
};
