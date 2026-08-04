const modes = [
  { id: 'pro', icon: '\u25c9', title: '\u4e13\u4e1a\u7cbe\u51c6\u578b', desc: '\u7ed3\u6784\u5316\u3001\u6307\u4ee4\u6e05\u6670\uff0c\u9002\u5408\u6280\u672f\u573a\u666f', color: '#fff' },
  { id: 'creative', icon: '\u2723', title: '\u521b\u610f\u53d1\u6563\u578b', desc: '\u4e30\u5bcc\u7ec6\u8282\uff0c\u6fc0\u53d1\u60f3\u8c61\u529b\uff0c\u9002\u5408\u521b\u4f5c\u573a\u666f', color: '#ff5a5a' },
  { id: 'role', icon: '\u2659', title: '\u89d2\u8272\u626e\u6f14\u578b', desc: '\u751f\u6210\u5e26\u5165\u89d2\u8272\u8bbe\u5b9a\u7684\u63d0\u793a\u8bcd', color: '#4bdc6a' },
  { id: 'reason', icon: '\u2637', title: '\u5206\u6b65\u63a8\u7406\u578b', desc: '\u751f\u6210\u5e26\u601d\u7ef4\u94fe/\u5206\u6b65\u6267\u884c\u7684\u63d0\u793a\u8bcd', color: '#ffd51a' },
];
const providerPresets = {
  openai: { baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
  deepseek: { baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat' },
  qwen: { baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus' },
  doubao: { baseUrl: 'https://ark.cn-beijing.volces.com/api/v3', model: 'doubao-1-5-pro-32k-250115' },
  zhipu: { baseUrl: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-4-flash' },
  moonshot: { baseUrl: 'https://api.moonshot.cn/v1', model: 'moonshot-v1-8k' },
  siliconflow: { baseUrl: 'https://api.siliconflow.cn/v1', model: 'Qwen/Qwen2.5-72B-Instruct' },
  custom: { baseUrl: '', model: '' },
};
const $ = selector => document.querySelector(selector);
const modeGrid = $('#modeGrid');
const rawInput = $('#rawInput');
const resultBody = $('#resultBody');
const inputCount = $('#inputCount');
const outputCount = $('#outputCount');
const settingsDialog = $('#settingsDialog');
const historyDialog = $('#historyDialog');
const errorLogDialog = $('#errorLogDialog');
const toast = $('#toast');
const textProviderInput = $('#textProvider');
const textBaseUrlInput = $('#textBaseUrl');
const textModelInput = $('#textModel');
const visionProviderInput = $('#visionProvider');
const visionBaseUrlInput = $('#visionBaseUrl');
const visionModelInput = $('#visionModel');
const imageProviderInput = $('#imageProvider');
const imageBaseUrlInput = $('#imageBaseUrl');
const imageServiceModelInput = $('#imageServiceModel');
const modelPickerSheet = $('#modelPickerSheet');
const modelPickerList = $('#modelPickerList');
const modelPickerTitle = $('#modelPickerTitle');
const APP_VERSION = '1.2.31';
const UPDATE_MANIFEST_URL = 'https://raw.githubusercontent.com/TTflysky/prompt-Pop/main/update.json';
const updateRequests = new Map();
let availableUpdate;
let selectedMode = localStorage.getItem('prompt-pop-mode') || 'pro';
let lastResult = '';
let history = JSON.parse(localStorage.getItem('prompt-pop-history') || '[]');
let errorLogs = JSON.parse(localStorage.getItem('prompt-pop-error-log') || '[]');
let soundEnabled = localStorage.getItem('prompt-pop-sound') !== 'off';
let soundPreset = localStorage.getItem('prompt-pop-sound-preset') || 'fc';
let soundVolume = Number(localStorage.getItem('prompt-pop-sound-volume') || 80);
let audioContext;
const storedSettings = JSON.parse(localStorage.getItem('prompt-pop-settings') || 'null');
if (!storedSettings && localStorage.getItem('prompt-pop-key')) {
  localStorage.setItem('prompt-pop-settings', JSON.stringify({ provider: 'openai', apiKey: localStorage.getItem('prompt-pop-key'), baseUrl: providerPresets.openai.baseUrl, model: providerPresets.openai.model }));
}

modeGrid.innerHTML = modes.map(mode => `<button class="mode-card ${mode.id === selectedMode ? 'selected' : ''}" data-mode="${mode.id}"><span class="mode-icon" style="--mode-color:${mode.color}">${mode.icon}</span><strong>${mode.title}</strong><p>${mode.desc}</p></button>`).join('');
modeGrid.addEventListener('click', event => { const card = event.target.closest('.mode-card'); if (!card) return; selectedMode = card.dataset.mode; localStorage.setItem('prompt-pop-mode', selectedMode); document.querySelectorAll('.mode-card').forEach(item => item.classList.toggle('selected', item === card)); playSound('tab'); });
function activatePanel(panel, focusTarget) { document.querySelectorAll('.section-tab').forEach(item => item.classList.toggle('active', item.dataset.panel === panel)); document.querySelectorAll('[data-panel-section]').forEach(section => section.classList.toggle('active', section.dataset.panelSection === panel)); window.scrollTo({ top: 0, behavior: 'smooth' }); if (focusTarget) setTimeout(() => $(focusTarget)?.focus(), 260); }
document.querySelectorAll('.section-tab').forEach(tab => tab.addEventListener('click', () => activatePanel(tab.dataset.panel)));
function updateCount() { inputCount.textContent = `${rawInput.value.length} \u5b57`; }
function playSound(type = 'click') {
  if (!soundEnabled) return;
  audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
  if (audioContext.state === 'suspended') audioContext.resume();
  const profiles = {
    fc: { waveform: 'square', click: [660], tab: [440, 660], success: [523, 659, 784], error: [196, 147], spacing: .055, duration: .095 },
    mac: { waveform: 'sine', click: [1047], tab: [784, 1047], success: [659, 880, 1319], error: [392, 294], spacing: .07, duration: .16 },
    arcade: { waveform: 'sawtooth', click: [330, 495], tab: [330, 494, 659], success: [440, 660, 880, 1320], error: [220, 165, 110], spacing: .045, duration: .12 }
  };
  const profile = profiles[soundPreset] || profiles.fc;
  const notes = profile[type] || profile.click;
  const now = audioContext.currentTime;
  const peak = (soundVolume / 100) * (soundPreset === 'mac' ? .14 : .12);
  notes.forEach((frequency, index) => {
    const start = now + index * profile.spacing;
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = type === 'error' ? 'sawtooth' : profile.waveform;
    oscillator.frequency.setValueAtTime(frequency, start);
    if (soundPreset === 'arcade' && type !== 'error') oscillator.frequency.exponentialRampToValueAtTime(frequency * 1.12, start + profile.duration * .45);
    gain.gain.setValueAtTime(.0001, start);
    gain.gain.exponentialRampToValueAtTime(peak, start + .008);
    gain.gain.exponentialRampToValueAtTime(.0001, start + profile.duration);
    oscillator.connect(gain).connect(audioContext.destination);
    oscillator.start(start); oscillator.stop(start + profile.duration + .02);
  });
}
function showToast(message) { toast.textContent = message; toast.classList.add('show'); playSound(/失败|错误/.test(message) ? 'error' : /完成|成功|已保存|已复制/.test(message) ? 'success' : 'click'); clearTimeout(showToast.timer); showToast.timer = setTimeout(() => toast.classList.remove('show'), 2200); }
function cleanErrorDetail(value) { return String(value || '').replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [redacted]').slice(0, 5000); }
function recordApiError({ url = '', status = 0, detail = '', source = 'API' }) {
  const entry = { time: new Date().toLocaleString('zh-CN'), source, status, url: String(url).split('?')[0], detail: cleanErrorDetail(detail) || 'No error body returned.' };
  errorLogs.unshift(entry); errorLogs = errorLogs.slice(0, 30); localStorage.setItem('prompt-pop-error-log', JSON.stringify(errorLogs));
}
function renderErrorLogs() {
  const list = $('#errorLogList'); list.replaceChildren();
  if (!errorLogs.length) { const empty = document.createElement('p'); empty.className = 'muted'; empty.textContent = '暂无错误日志。'; list.append(empty); return; }
  errorLogs.forEach(entry => {
    const item = document.createElement('article'); item.className = 'error-log-entry';
    const title = document.createElement('strong'); title.textContent = `${entry.source} · HTTP ${entry.status || 'NETWORK'}`;
    const meta = document.createElement('small'); meta.textContent = `${entry.time} · ${entry.url || 'No endpoint'}`;
    const detail = document.createElement('pre'); detail.textContent = entry.detail;
    item.append(title, meta, detail); list.append(item);
  });
}
async function copyText(text) {
  if (!text) return false;
  try { if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(text); return true; } } catch { /* Android WebView often blocks the modern clipboard API for local files. */ }
  const field = document.createElement('textarea'); field.value = text; field.setAttribute('readonly', ''); field.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0;'; document.body.append(field); field.focus(); field.select();
  const copied = document.execCommand('copy'); field.remove(); return copied;
}
const nativeRequests = new Map();
const nativeSaveRequests = new Map();
const nativeTextSaveRequests = new Map();
const nativeLastImageRequests = new Map();
let desktopActivityCount = 0;
window.__nativeApiResponse = (id, status, body, error) => {
  const request = nativeRequests.get(id); if (!request) return; nativeRequests.delete(id);
  if (error) { recordApiError({ url: request.url, detail: error, source: 'Android native' }); return request.reject(new Error(error)); }
  if (status < 200 || status >= 300) recordApiError({ url: request.url, status, detail: body, source: 'Android native' });
  request.resolve({ ok: status >= 200 && status < 300, status, json: async () => JSON.parse(body || '{}'), text: async () => body || '' });
};
window.__nativeSaveImageResponse = (id, uri, error) => {
  const request = nativeSaveRequests.get(id); if (!request) return; nativeSaveRequests.delete(id);
  if (error) return request.reject(new Error(error));
  request.resolve(uri);
};
window.__nativeSaveTextResponse = (id, uri, error) => { const request = nativeTextSaveRequests.get(id); if (!request) return; nativeTextSaveRequests.delete(id); if (error) return request.reject(new Error(error)); request.resolve(uri); };
window.__nativeLastGeneratedImageResponse = (id, kind, source, error) => {
  const request = nativeLastImageRequests.get(id); if (!request) return; nativeLastImageRequests.delete(id);
  if (error) return request.reject(new Error(error)); request.resolve({ kind, source });
};
window.__nativeUpdateResponse = (id, status, body, error) => {
  const request = updateRequests.get(id); if (!request) return; updateRequests.delete(id);
  if (error) return request.reject(new Error(error));
  if (status < 200 || status >= 300) return request.reject(new Error(`HTTP ${status}`));
  try { request.resolve(JSON.parse(body || '{}')); } catch { request.reject(new Error('更新信息解析失败')); }
};
function compareVersions(left, right) { const a = String(left).split('.').map(Number); const b = String(right).split('.').map(Number); for (let i = 0; i < Math.max(a.length, b.length); i += 1) { const diff = (a[i] || 0) - (b[i] || 0); if (diff) return diff; } return 0; }
function nativeUpdateRequest(method) { return new Promise((resolve, reject) => { const id = `update-${Date.now()}-${Math.random().toString(16).slice(2)}`; updateRequests.set(id, { resolve, reject }); window.PromptPopNative[method](id); }); }
async function checkForUpdate() {
  const status = $('#updateStatus'); const checkButton = $('#checkUpdateButton'); const applyButton = $('#applyUpdateButton');
  checkButton.disabled = true; status.textContent = '正在检查 GitHub 更新...';
  try {
    const update = window.PromptPopNative?.checkForUpdate ? await nativeUpdateRequest('checkForUpdate') : await (await fetch(UPDATE_MANIFEST_URL, { cache: 'no-store' })).json();
    if (!update.version) throw new Error('未找到版本号');
    if (compareVersions(update.version, APP_VERSION) > 0) { availableUpdate = update; status.textContent = `发现 v${update.version}`; applyButton.hidden = false; applyButton.textContent = `更新至 v${update.version}`; }
    else { availableUpdate = null; applyButton.hidden = true; status.textContent = `已是最新版本 v${APP_VERSION}`; }
  } catch (error) { applyButton.hidden = true; status.textContent = '检查更新失败'; showToast(`更新检查失败：${error.message}`); }
  finally { checkButton.disabled = false; }
}
async function applyHotUpdate() {
  if (!availableUpdate) return checkForUpdate();
  if (!window.PromptPopNative?.applyUpdate) return showToast('网页版不支持本地热更新');
  const applyButton = $('#applyUpdateButton'); applyButton.disabled = true; $('#updateStatus').textContent = `正在更新至 v${availableUpdate.version}...`;
  try { await nativeUpdateRequest('applyUpdate'); $('#updateStatus').textContent = '更新完成，正在重新加载...'; window.PromptPopNative.reloadUpdatedApp(); }
  catch (error) { applyButton.disabled = false; showToast(`更新失败：${error.message}`); }
}
function readFileDataUrl(file) { return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(new Error('Unable to read selected image')); reader.readAsDataURL(file); }); }
async function apiRequest(url, options = {}) {
  if (window.PromptPopDesktop?.request) {
    desktopActivityCount += 1; window.PromptPopDesktop.setActivity?.(true);
    try {
      const headers = options.headers || {}; let bodyType = 'none'; let body = ''; const fields = [];
      if (options.body instanceof FormData) {
        bodyType = 'multipart';
        for (const [name, value] of options.body.entries()) {
          if (value instanceof Blob) fields.push({ name, fileName: value.name || 'upload.png', mimeType: value.type || 'image/png', fileData: await readFileDataUrl(value) });
          else fields.push({ name, value: String(value) });
        }
      } else if (typeof options.body === 'string') { bodyType = 'json'; body = options.body; }
      const result = await window.PromptPopDesktop.request(JSON.stringify({ url, method: options.method || 'GET', headers, bodyType, body, fields }));
      if (result.status < 200 || result.status >= 300) recordApiError({ url, status: result.status, detail: result.body, source: 'Desktop native' });
      return { ok: result.status >= 200 && result.status < 300, status: result.status, json: async () => JSON.parse(result.body || '{}'), text: async () => result.body || '' };
    } catch (error) {
      recordApiError({ url, detail: error.message || error, source: 'Desktop native' }); throw error;
    } finally {
      desktopActivityCount = Math.max(0, desktopActivityCount - 1);
      if (!desktopActivityCount) window.PromptPopDesktop.setActivity?.(false);
    }
  }
  if (!window.PromptPopNative?.request) {
    try {
      const response = await fetch(url, options);
      if (!response.ok) recordApiError({ url, status: response.status, detail: await response.clone().text(), source: 'Web request' });
      return response;
    } catch (error) { recordApiError({ url, detail: error.message || error, source: 'Web request' }); throw error; }
  }
  const headers = options.headers || {}; let bodyType = 'none'; let body = ''; let fields = [];
  if (options.body instanceof FormData) {
    bodyType = 'multipart';
    for (const [name, value] of options.body.entries()) {
      if (value instanceof Blob) fields.push({ name, fileName: value.name || 'upload.png', mimeType: value.type || 'image/png', fileData: await readFileDataUrl(value) });
      else fields.push({ name, value: String(value) });
    }
  } else if (typeof options.body === 'string') { bodyType = 'json'; body = options.body; }
  const id = `request-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return new Promise((resolve, reject) => { nativeRequests.set(id, { resolve, reject, url }); window.PromptPopNative.request(id, JSON.stringify({ url, method: options.method || 'GET', headers, bodyType, body, fields })); });
}
function getModeLabel() { return modes.find(mode => mode.id === selectedMode)?.title || '\u4e13\u4e1a\u7cbe\u51c6\u578b'; }
function getConfigs() {
  const saved = JSON.parse(localStorage.getItem('prompt-pop-settings') || '{}');
  if (saved.text && saved.vision && saved.image) return saved;
  const legacyKey = saved.apiKey || localStorage.getItem('prompt-pop-key') || '';
  const legacyProvider = saved.provider || 'openai';
  const legacyBaseUrl = saved.baseUrl || providerPresets[legacyProvider]?.baseUrl || '';
  return {
    text: { provider: legacyProvider, apiKey: legacyKey, baseUrl: legacyBaseUrl, model: saved.textModel || saved.model || providerPresets[legacyProvider]?.model || '' },
    vision: { provider: legacyProvider, apiKey: legacyKey, baseUrl: legacyBaseUrl, model: saved.visionModel || 'gpt-4o' },
    image: { provider: legacyProvider, apiKey: legacyKey, baseUrl: legacyBaseUrl, model: saved.imageModel || 'gpt-image-2' },
  };
}
function setModelOption(control, model) {
  if (!model) return;
  if (![...control.options].some(option => option.value === model)) control.append(new Option(model, model));
  control.value = model;
}
function getModelControl(target) { return $(`#${target === 'image' ? 'imageServiceModel' : `${target}Model`}`); }
function syncModelPickerDisplay(target) { const control = getModelControl(target); const button = document.querySelector(`[data-model-display="${target}"]`); if (button) button.textContent = control.value || '点击选择模型'; }
function syncAllModelPickerDisplays() { ['text', 'vision', 'image'].forEach(syncModelPickerDisplay); }
function getModelLabel(target) { return ({ text: '选择文本优化模型', vision: '选择视觉拆图模型', image: '选择生图模型' })[target]; }
function openModelPicker(target) {
  const control = getModelControl(target);
  const models = [...control.options].map(option => option.value).filter(Boolean);
  if (!models.length) return showToast('请先点击 ↻ 拉取模型');
  modelPickerTitle.textContent = getModelLabel(target);
  modelPickerList.replaceChildren();
  models.forEach(model => {
    const option = document.createElement('button');
    option.type = 'button'; option.className = `model-picker-option${model === control.value ? ' active' : ''}`; option.textContent = model;
    option.addEventListener('click', () => { control.value = model; syncModelPickerDisplay(target); control.dispatchEvent(new Event('change', { bubbles: true })); modelPickerSheet.hidden = true; showToast(`已选择 ${model}`); });
    modelPickerList.append(option);
  });
  modelPickerSheet.hidden = false;
}
function populateProviderFields(provider, baseUrl, model, providerInput, baseUrlInput, modelInput) {
  providerInput.value = provider || 'openai'; baseUrlInput.value = baseUrl || providerPresets[providerInput.value]?.baseUrl || ''; setModelOption(modelInput, model);
}
function loadSettings() {
  const configs = getConfigs();
  populateProviderFields(configs.text.provider, configs.text.baseUrl, configs.text.model, textProviderInput, textBaseUrlInput, textModelInput); $('#textApiKey').value = configs.text.apiKey || '';
  populateProviderFields(configs.vision.provider, configs.vision.baseUrl, configs.vision.model, visionProviderInput, visionBaseUrlInput, visionModelInput); $('#visionApiKey').value = configs.vision.apiKey || '';
  populateProviderFields(configs.image.provider, configs.image.baseUrl, configs.image.model, imageProviderInput, imageBaseUrlInput, imageServiceModelInput); $('#imageApiKey').value = configs.image.apiKey || '';
  syncAllModelPickerDisplays();
}
function applyProviderPreset(providerInput, baseUrlInput, modelInput) { const preset = providerPresets[providerInput.value]; if (preset && providerInput.value !== 'custom') { baseUrlInput.value = preset.baseUrl; if (!modelInput.value.trim()) setModelOption(modelInput, preset.model); } }
[[textProviderInput, textBaseUrlInput, textModelInput], [visionProviderInput, visionBaseUrlInput, visionModelInput], [imageProviderInput, imageBaseUrlInput, imageServiceModelInput]].forEach(([providerInput, baseUrlInput, modelInput]) => providerInput.addEventListener('change', () => applyProviderPreset(providerInput, baseUrlInput, modelInput)));
document.querySelectorAll('.config-tab').forEach(tab => tab.addEventListener('click', () => { const name = tab.dataset.configTab; document.querySelectorAll('.config-tab').forEach(item => item.classList.toggle('active', item === tab)); document.querySelectorAll('.config-pane').forEach(pane => pane.classList.toggle('active', pane.dataset.configPane === name)); playSound('tab'); }));
$('#settingsButton').addEventListener('click', () => { loadSettings(); settingsDialog.showModal(); });
$('#checkUpdateButton').addEventListener('click', checkForUpdate);
$('#applyUpdateButton').addEventListener('click', applyHotUpdate);
$('#settingsForm').addEventListener('submit', event => { event.preventDefault(); const configs = { text: { provider: textProviderInput.value, apiKey: $('#textApiKey').value.trim(), baseUrl: textBaseUrlInput.value.trim(), model: textModelInput.value.trim() }, vision: { provider: visionProviderInput.value, apiKey: $('#visionApiKey').value.trim(), baseUrl: visionBaseUrlInput.value.trim(), model: visionModelInput.value.trim() }, image: { provider: imageProviderInput.value, apiKey: $('#imageApiKey').value.trim(), baseUrl: imageBaseUrlInput.value.trim(), model: imageServiceModelInput.value.trim() } }; localStorage.setItem('prompt-pop-settings', JSON.stringify(configs)); localStorage.setItem('prompt-pop-key', configs.text.apiKey); settingsDialog.close(); showToast('\u63a5\u53e3\u8bbe\u7f6e\u5df2\u4fdd\u5b58'); });
function getConfigBackupText() {
  const configs = getConfigs(); const lines = ['# Prompt Pop Configuration v1'];
  ['text', 'vision', 'image'].forEach(group => ['provider', 'apiKey', 'baseUrl', 'model'].forEach(key => lines.push(`${group}.${key}=${String(configs[group][key] || '').replace(/[\r\n]/g, '')}`)));
  return `${lines.join('\n')}\n`;
}
function parseConfigBackup(text) {
  const configs = { text: {}, vision: {}, image: {} }; let found = 0;
  text.split(/\r?\n/).forEach(line => { const marker = line.indexOf('='); if (marker < 1 || line.trimStart().startsWith('#')) return; const key = line.slice(0, marker).trim(); const value = line.slice(marker + 1).trim(); const match = /^(text|vision|image)\.(provider|apiKey|baseUrl|model)$/.exec(key); if (match) { configs[match[1]][match[2]] = value; found++; } });
  if (!found) throw new Error('未识别到 Prompt Pop 配置');
  ['text', 'vision', 'image'].forEach(group => { configs[group] = { provider: configs[group].provider || 'openai', apiKey: configs[group].apiKey || '', baseUrl: configs[group].baseUrl || '', model: configs[group].model || '' }; });
  return configs;
}
$('#exportConfigButton').addEventListener('click', async () => {
  const text = getConfigBackupText(); const filename = `prompt-pop-config-${new Date().toISOString().slice(0, 10)}.txt`;
  try {
    if (window.PromptPopDesktop?.saveText) await window.PromptPopDesktop.saveText(text, filename);
    else if (window.PromptPopNative?.saveTextFile) await new Promise((resolve, reject) => { const id = `config-${Date.now()}-${Math.random().toString(16).slice(2)}`; nativeTextSaveRequests.set(id, { resolve, reject }); window.PromptPopNative.saveTextFile(id, text, filename); });
    else { const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' })); link.download = filename; document.body.append(link); link.click(); link.remove(); }
    showToast('配置 TXT 已导出到下载目录');
  } catch (error) { showToast(`导出失败：${error.message}`); }
});
$('#importConfigInput').addEventListener('change', event => { const file = event.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => { try { const configs = parseConfigBackup(String(reader.result || '')); localStorage.setItem('prompt-pop-settings', JSON.stringify(configs)); localStorage.setItem('prompt-pop-key', configs.text.apiKey); loadSettings(); showToast('配置已导入，请点击保存设置'); } catch (error) { showToast(`导入失败：${error.message}`); } finally { event.target.value = ''; } }; reader.readAsText(file, 'UTF-8'); });
function readConfigFromForm(target) {
  const fields = { text: [textProviderInput, $('#textApiKey'), textBaseUrlInput, textModelInput], vision: [visionProviderInput, $('#visionApiKey'), visionBaseUrlInput, visionModelInput], image: [imageProviderInput, $('#imageApiKey'), imageBaseUrlInput, imageServiceModelInput] }[target];
  return { provider: fields[0].value, apiKey: fields[1].value.trim(), baseUrl: fields[2].value.trim(), model: fields[3].value.trim() };
}
async function fetchModels(target) {
  const config = readConfigFromForm(target);
  if (!config.apiKey || !config.baseUrl) return showToast('\u8bf7\u5148\u586b\u5199\u8be5\u6a21\u578b\u7684 API Key \u548c Base URL');
  const button = document.querySelector(`[data-model-target="${target}"]`); button.disabled = true; button.textContent = '\u2026';
  try {
    const response = await apiRequest(`${config.baseUrl.replace(/\/$/, '')}/models`, { headers: { Authorization: `Bearer ${config.apiKey}` } });
    if (!response.ok) { const message = await response.text(); throw new Error(`HTTP ${response.status} ${message.slice(0, 120)}`); }
    const data = await response.json(); const models = (data.data || data.models || []).map(item => typeof item === 'string' ? item : item.id).filter(Boolean).sort();
    if (!models.length) throw new Error('\u63a5\u53e3\u672a\u8fd4\u56de\u6a21\u578b\u5217\u8868');
    const control = getModelControl(target); const selected = config.model || control.value;
    control.replaceChildren(new Option('请选择模型', ''));
    models.forEach(model => control.append(new Option(model, model)));
    setModelOption(control, selected || (models.find(model => target === 'vision' ? /vision|vl|gpt-4o|glm-4v/i.test(model) : target === 'image' ? /image|seedream|wanx|flux/i.test(model) : /chat|gpt|qwen|deepseek|glm/i.test(model)) || models[0]));
    syncModelPickerDisplay(target);
    showToast(`\u5df2\u62c9\u53d6 ${models.length} \u4e2a\u6a21\u578b`);
  } catch (error) { showToast(`\u62c9\u53d6\u6a21\u578b\u5931\u8d25\uff1a${error.message}`); }
  finally { button.disabled = false; button.textContent = '\u21bb'; }
}
document.querySelectorAll('.fetch-models').forEach(button => button.addEventListener('click', () => fetchModels(button.dataset.modelTarget)));
document.querySelectorAll('.model-picker-trigger').forEach(button => button.addEventListener('click', () => openModelPicker(button.dataset.modelPicker)));
$('#closeModelPicker').addEventListener('click', () => { modelPickerSheet.hidden = true; });
$('#historyButton').addEventListener('click', () => { renderHistory(); historyDialog.showModal(); });
$('#closeHistory').addEventListener('click', () => historyDialog.close());
$('#errorLogButton').addEventListener('click', () => { renderErrorLogs(); errorLogDialog.showModal(); });
$('#closeErrorLog').addEventListener('click', () => errorLogDialog.close());
$('#clearErrorLog').addEventListener('click', () => { errorLogs = []; localStorage.removeItem('prompt-pop-error-log'); renderErrorLogs(); showToast('错误日志已清空'); });
$('#copyErrorLog').addEventListener('click', async () => {
  const text = errorLogs.map(entry => `[${entry.time}] ${entry.source} HTTP ${entry.status || 'NETWORK'}\n${entry.url}\n${entry.detail}`).join('\n\n');
  showToast(await copyText(text) ? '错误日志已复制' : '复制失败');
});
function syncAudioPanel() {
  document.querySelectorAll('[data-sound-preset]').forEach(button => button.classList.toggle('active', button.dataset.soundPreset === soundPreset));
  $('#soundVolume').value = soundVolume;
  $('#soundVolumeValue').textContent = `${soundVolume}%`;
}
document.querySelectorAll('[data-sound-preset]').forEach(button => button.addEventListener('click', () => {
  soundPreset = button.dataset.soundPreset;
  soundEnabled = true;
  localStorage.setItem('prompt-pop-sound-preset', soundPreset);
  localStorage.setItem('prompt-pop-sound', 'on');
  syncAudioPanel();
  showToast(`已切换为 ${button.textContent}`);
}));
$('#soundVolume').addEventListener('input', event => {
  soundVolume = Number(event.target.value);
  localStorage.setItem('prompt-pop-sound-volume', soundVolume);
  $('#soundVolumeValue').textContent = `${soundVolume}%`;
});
syncAudioPanel();
$('#themeButton').addEventListener('click', () => { document.body.classList.toggle('dark'); localStorage.setItem('prompt-pop-theme', document.body.classList.contains('dark') ? 'dark' : 'light'); });
$('#soundButton').addEventListener('click', () => { soundEnabled = !soundEnabled; localStorage.setItem('prompt-pop-sound', soundEnabled ? 'on' : 'off'); $('#soundButton').textContent = soundEnabled ? '♫' : '♩'; if (soundEnabled) playSound('success'); showToast(soundEnabled ? '\u4ea4\u4e92\u97f3\u6548\u5df2\u5f00\u542f' : '\u4ea4\u4e92\u97f3\u6548\u5df2\u5173\u95ed'); });
document.addEventListener('click', event => { const button = event.target.closest('button'); if (button && button.id !== 'soundButton' && !button.matches('[data-generate-mode]') && !button.matches('.mode-card')) playSound('click'); });
let lastSliderSound = 0;
document.addEventListener('input', event => { if (event.target.matches('input[type="range"]') && Date.now() - lastSliderSound > 90) { lastSliderSound = Date.now(); playSound('click'); } });
$('#soundButton').textContent = soundEnabled ? '♫' : '♩';
if (localStorage.getItem('prompt-pop-theme') === 'dark') document.body.classList.add('dark');
rawInput.addEventListener('input', updateCount);
$('#clearButton').addEventListener('click', () => { rawInput.value = ''; updateCount(); rawInput.focus(); });

const imagePrompt = $('#imagePrompt');
const imageCount = $('#imageCount');
const imageControls = ['imageSubject', 'imageStyle', 'imageAngle', 'imageLight', 'imageComposition', 'imageRatio', 'lensSlider', 'detailSlider', 'styleSlider', 'negativePrompt'];
function buildImagePrompt() {
  if (!$('#useImageControls').checked) return;
  const subject = $('#imageSubject').value.trim() || '\u9ad8\u8d28\u91cf\u89c6\u89c9\u4f5c\u54c1';
  const lens = $('#lensSlider').value;
  const detail = $('#detailSlider').value;
  const stylize = $('#styleSlider').value;
  const negative = $('#negativePrompt').value.trim();
  const prompt = `${subject}, ${$('#imageStyle').value}, ${lens}mm lens, ${$('#imageAngle').value}, ${$('#imageLight').value}, ${$('#imageComposition').value}, highly detailed, detail level ${detail}/100, stylization ${stylize}/100, professional visual quality, sharp focus, rich textures ${negative ? `, negative prompt: ${negative}` : ''} ${$('#imageRatio').value}`;
  imagePrompt.value = prompt;
  imageCount.textContent = `${prompt.length} \u5b57`;
  $('#lensValue').textContent = `${lens}mm`;
  $('#detailValue').textContent = `${detail}%`;
  $('#styleValue').textContent = `${stylize}%`;
}
imageControls.forEach(id => $(`#${id}`).addEventListener('input', buildImagePrompt));
imageControls.forEach(id => $(`#${id}`).addEventListener('change', buildImagePrompt));
$('#useImageControls').addEventListener('change', event => { const enabled = event.target.checked; $('#imageControlsStatus').textContent = enabled ? '已开启：风格、镜头、光线和滑块会写入提示词' : '已关闭：保留你手动输入的提示词，不会自动改写'; if (enabled) buildImagePrompt(); showToast(enabled ? '已启用通用提示词控件' : '已关闭通用提示词控件'); });
$('#imageCopyButton').addEventListener('click', async () => { if (!imagePrompt.value) return; showToast(await copyText(imagePrompt.value) ? '\u751f\u56fe\u63d0\u793a\u8bcd\u5df2\u590d\u5236' : '\u590d\u5236\u5931\u8d25\uff0c\u8bf7\u957f\u6309\u6587\u5b57\u590d\u5236'); });
$('#useImagePromptButton').addEventListener('click', () => { rawInput.value = imagePrompt.value; updateCount(); activatePanel('main', '#rawInput'); showToast('\u5df2\u5e26\u5165\u901a\u7528\u4f18\u5316\u5668'); });
let imageGenerateMode = 'text';
let imageFile = null;
let imageReferenceData = '';
let generatedImageUrl = '';
let lastGenerationKind = '';
function setImageGenerateMode(mode) { imageGenerateMode = mode; document.querySelectorAll('[data-generate-mode]').forEach(item => item.classList.toggle('active', item.dataset.generateMode === mode)); $('#generateImageButton').innerHTML = mode === 'image' ? '⌁ <span>图生图</span>' : '✦ <span>文生图</span>'; }
document.querySelectorAll('[data-generate-mode]').forEach(button => button.addEventListener('click', () => setImageGenerateMode(button.dataset.generateMode)));
$('#imageUpload').addEventListener('change', event => {
  imageFile = event.target.files?.[0] || null;
  if (!imageFile) return;
  setImageGenerateMode('image');
  $('#imageUploadName').textContent = imageFile.name; $('#imageUploadStatus').textContent = `已选择 ${imageFile.name}，点击“生成图片”开始图生图`;
  const reader = new FileReader(); reader.onload = () => { imageReferenceData = reader.result; $('#imagePreview').src = imageReferenceData; $('#imagePreviewWrap').hidden = false; showToast('\u53c2\u8003\u56fe\u5df2\u52a0\u8f7d'); }; reader.onerror = () => showToast('\u56fe\u7247\u8bfb\u53d6\u5931\u8d25'); reader.readAsDataURL(imageFile);
});
$('#removeImageButton').addEventListener('click', () => { imageFile = null; $('#imageUpload').value = ''; $('#imagePreviewWrap').hidden = true; $('#imageUploadName').textContent = '\u70b9\u51fb\u9009\u62e9\u56fe\u7247\uff0c\u652f\u6301 PNG / JPG / WEBP'; $('#imageUploadStatus').textContent = '\u672a\u4e0a\u4f20\u56fe\u7247\u65f6\u4e3a\u6587\u751f\u56fe\uff0c\u4e0a\u4f20\u540e\u81ea\u52a8\u5207\u6362\u4e3a\u56fe\u751f\u56fe'; });
async function analyzeThenGenerate() {
  if (!imageFile || !imageReferenceData) { showToast('\u8bf7\u5148\u4e0a\u4f20\u53c2\u8003\u56fe'); return; }
  const config = getConfigs().vision;
  if (!config.apiKey || !config.baseUrl || !config.model) { settingsDialog.showModal(); showToast('\u8bf7\u5148\u914d\u7f6e\u89c6\u89c9\u62c6\u56fe\u6a21\u578b'); return; }
  const button = $('#analyzeThenGenerateButton'); button.disabled = true; button.innerHTML = '\u2026 <span>\u89c6\u89c9\u5206\u6790\u4e2d</span>';
  try {
    const response = await apiRequest(`${config.baseUrl.replace(/\/$/, '')}/chat/completions`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.apiKey}` }, body: JSON.stringify({ model: config.model, temperature: 0.35, messages: [{ role: 'system', content: 'Analyze the reference image for image-to-image generation. Return only one detailed English production prompt. Include subject, composition, camera, lighting, palette, materials, texture, and style. Do not mention that you are analyzing an image.' }, { role: 'user', content: [{ type: 'text', text: 'Create a detailed image-to-image prompt based on this reference.' }, { type: 'image_url', image_url: { url: imageReferenceData } }] }] }) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json(); const analyzedPrompt = data.choices?.[0]?.message?.content?.trim();
    if (!analyzedPrompt) throw new Error('\u89c6\u89c9\u6a21\u578b\u6ca1\u6709\u8fd4\u56de\u63d0\u793a\u8bcd');
    imagePrompt.value = analyzedPrompt; imageCount.textContent = `${analyzedPrompt.length} \u5b57`; $('#imageUploadStatus').textContent = '\u89c6\u89c9\u5206\u6790\u5b8c\u6210\uff0c\u6b63\u5728\u4ea4\u7ed9\u751f\u56fe\u6a21\u578b'; await generateImage();
  } catch (error) { $('#imageOutput').innerHTML = `<div class="image-output-placeholder">${error.message}</div>`; showToast(`\u89c6\u89c9\u5206\u6790\u5931\u8d25：${error.message}`); }
  finally { button.disabled = false; button.innerHTML = '\u2301 <span>\u5148\u770b\u56fe\u518d\u751f\u56fe</span>'; }
}
async function generateImage() {
  const config = getConfigs().image;
  if (!config.apiKey || !config.baseUrl || !config.model) { settingsDialog.showModal(); showToast('\u8bf7\u5148\u8865\u5168\u751f\u56fe\u6a21\u578b\u8bbe\u7f6e'); return; }
  if (imageGenerateMode === 'image' && !imageFile) { showToast('\u56fe\u751f\u56fe\u8bf7\u5148\u4e0a\u4f20\u53c2\u8003\u56fe'); return; }
  const button = $('#generateImageButton'); generatedImageUrl = ''; $('#saveTextToImageButton').disabled = true; button.disabled = true; button.innerHTML = '\u2026 <span>\u751f\u6210\u4e2d</span>';
  const endpoint = `${config.baseUrl.replace(/\/$/, '')}/images/${imageGenerateMode === 'image' ? 'edits' : 'generations'}`;
  const imageModel = $('#imageModelCustom').value.trim() || config.model || $('#imageModel').value;
  try {
    let response;
    if (imageGenerateMode === 'image') {
      const form = new FormData(); form.append('model', imageModel); form.append('prompt', buildI2IPrompt(imagePrompt.value, $('#imageStyle').value, 20, $('#styleSlider').value, $('#negativePrompt').value)); form.append('size', $('#imageSize').value); form.append('image', imageFile, imageFile.name); appendImageReferenceFidelity(form, config, imageModel);
      response = await apiRequest(endpoint, { method: 'POST', headers: { Authorization: `Bearer ${config.apiKey}` }, body: form });
    } else {
      response = await apiRequest(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.apiKey}` }, body: JSON.stringify({ model: imageModel, prompt: imagePrompt.value, size: $('#imageSize').value }) });
    }
    if (!response.ok) { const errorBody = await response.text(); throw new Error(`HTTP ${response.status} ${errorBody.slice(0, 180)}`); }
    const data = await response.json(); const image = data.data?.[0]; lastGenerationKind = imageGenerateMode === 'image' ? 'image-to-image' : 'text-to-image';
    generatedImageUrl = image?.b64_json ? `data:image/png;base64,${image.b64_json}` : image?.url || '';
    if (!generatedImageUrl) throw new Error('\u63a5\u53e3\u6ca1\u6709\u8fd4\u56de\u56fe\u7247');
    $('#imageOutput').innerHTML = `<img src="${generatedImageUrl}" alt="生成结果" />`; $('#saveTextToImageButton').disabled = false; queueWorkspacePersist(); showToast('\u56fe\u7247\u751f\u6210\u5b8c\u6210');
  } catch (error) { $('#imageOutput').innerHTML = `<div class="image-output-placeholder">${error.message}</div>`; showToast(`\u751f\u6210\u5931\u8d25\uff1a${error.message}`); }
  finally { button.disabled = false; button.innerHTML = imageGenerateMode === 'image' ? '\u2301 <span>\u56fe\u751f\u56fe</span>' : '\u2726 <span>\u6587\u751f\u56fe</span>'; }
}
$('#generateImageButton').addEventListener('click', generateImage);
async function optimizeImagePrompt() {
  const config = getConfigs().text; const draft = imagePrompt.value.trim();
  if (!draft) return showToast('\u8bf7\u5148\u8f93\u5165\u6216\u7ec4\u5408\u751f\u56fe\u63d0\u793a\u8bcd');
  if (!config.apiKey || !config.baseUrl || !config.model) { settingsDialog.showModal(); showToast('\u8bf7\u5148\u914d\u7f6e\u6587\u672c\u4f18\u5316\u6a21\u578b'); return; }
  const button = $('#optimizeImageButton'); button.disabled = true; button.innerHTML = '\u2026 <span>\u4f18\u5316\u4e2d</span>';
  try {
    const response = await apiRequest(`${config.baseUrl.replace(/\/$/, '')}/chat/completions`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.apiKey}` }, body: JSON.stringify({ model: config.model, temperature: 0.6, messages: [{ role: 'system', content: 'You are an expert image prompt engineer. Rewrite the user prompt into one detailed production-ready English text-to-image prompt. Keep the intended subject, improve composition, lighting, materials, and quality. Output only the prompt.' }, { role: 'user', content: draft }] }) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`); const data = await response.json(); const optimized = data.choices?.[0]?.message?.content?.trim(); if (!optimized) throw new Error('\u6a21\u578b\u6ca1\u6709\u8fd4\u56de\u4f18\u5316\u7ed3\u679c'); imagePrompt.value = optimized; imageCount.textContent = `${optimized.length} \u5b57`; showToast('\u751f\u56fe\u63d0\u793a\u8bcd\u4f18\u5316\u5b8c\u6210');
  } catch (error) { showToast(`\u4f18\u5316\u5931\u8d25\uff1a${error.message}`); }
  finally { button.disabled = false; button.innerHTML = '\u2726 <span>\u4f18\u5316\u751f\u56fe\u8bcd</span>'; }
}
$('#optimizeImageButton').addEventListener('click', optimizeImagePrompt);
let breakdownImageData = '';
let breakdownFile = null;
let lastBreakdown = '';
$('#breakdownUpload').addEventListener('change', event => {
  const file = event.target.files?.[0]; if (!file) return; breakdownFile = file;
  const reader = new FileReader(); reader.onload = () => { breakdownImageData = reader.result; $('#breakdownPreview').src = breakdownImageData; $('#breakdownPreviewWrap').hidden = false; }; reader.readAsDataURL(file);
});
$('#removeBreakdownButton').addEventListener('click', () => { breakdownImageData = ''; breakdownFile = null; $('#breakdownUpload').value = ''; $('#breakdownPreviewWrap').hidden = true; });
async function analyzeImage() {
  const config = getConfigs().vision;
  if (!config.apiKey || !config.baseUrl || !config.model) { settingsDialog.showModal(); showToast('\u8bf7\u5148\u914d\u7f6e\u89c6\u89c9\u62c6\u56fe\u6a21\u578b'); return; }
  if (!breakdownImageData) { showToast('\u8bf7\u5148\u4e0a\u4f20\u4e00\u5f20\u56fe\u7247'); return; }
  const button = $('#analyzeImageButton'); button.disabled = true; button.innerHTML = '\u2026 <span>\u6df1\u5ea6\u5206\u6790\u4e2d</span>';
  const detail = $('#breakdownDetail').value; const language = $('#breakdownLanguage').value;
  const quickInstruction = `你是一位图生图提示词工程师。对参考图做“快速概括”，只输出两小段，总字数不超过 150 个汉字加 80 个英文词，绝不输出分析过程、编号或解释。\n\n第一段用中文，格式必须是：\n“照片转[概括后的目标风格]提示词：视觉风格、色彩气质与材质/印刷质感，保留真实照片中人物的面部神态、五官比例、表情特征、发型轮廓、身体姿态与主体识别度，将其转换为一张[合适的画面类型/比例]作品。”\n如果参考图无人像，则删除人物保留句，改为保留主体轮廓与识别度。\n\n第二段以“整体采用：”开头，紧跟一条逗号分隔的英文图生图提示词，仅提炼最关键的风格、媒介、色彩、光线、构图和质感标签。不要复述具体人物、物品、文字、地点或故事。`;
  const detailedInstruction = `你是一位资深视觉风格分析师和提示词工程师。请对这张参考图进行${detail}的“纯风格 DNA”拆解，输出语言为${language}。严格禁止描述、复述或猜测图中的任何主体、人物、物体、动作、文字、标识、地点、服饰、道具、具体场景或叙事内容；即使这些内容显眼也必须忽略。目标是让用户能把风格迁移到全新的主体上，而不是复刻原图。请严格按以下结构输出：\n\n1. 风格总览：艺术流派、时代气质、媒介感\n2. 构图语法：只描述抽象构图规律、留白、层次、视觉动线，不出现具体主体或位置描述\n3. 镜头与空间：景别、透视、焦段倾向、景深、距离感的通用规律\n4. 光线与氛围：方向、光质、反差、阴影、环境氛围\n5. 色彩系统：主辅色关系、冷暖、饱和度、对比度、分级方法\n6. 材质与纹理：颗粒、笔触、纸张、网点、反射、磨损等\n7. 后期与画质：锐度、动态范围、渲染或印刷特征\n8. 可复用风格关键词\n9. 反向提示词：避免复刻原图主体、文字、标识、原始场景\n10. FINAL STYLE PROMPT：输出一段只包含风格、构图语法、镜头、光线、色彩、材质和画质的英文提示词；绝不能包含或暗示原图主体、物体、人物、文字、地点和场景。`;
  const instruction = detail === '快速概括' ? quickInstruction : detailedInstruction;
  try {
    const response = await apiRequest(`${config.baseUrl.replace(/\/$/, '')}/chat/completions`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.apiKey}` }, body: JSON.stringify({ model: config.model, temperature: 0.25, max_tokens: 4000, messages: [{ role: 'system', content: instruction }, { role: 'user', content: [{ type: 'text', text: '\u8bf7\u5f00\u59cb\u5206\u6790\u8fd9\u5f20\u56fe\u7247\u3002' }, { type: 'image_url', image_url: { url: breakdownImageData } }] }] }) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json(); lastBreakdown = data.choices?.[0]?.message?.content?.trim() || '\u63a5\u53e3\u6ca1\u6709\u8fd4\u56de\u5206\u6790\u7ed3\u679c'; $('#breakdownResult').textContent = lastBreakdown; $('#breakdownCount').textContent = `${lastBreakdown.length} \u5b57`; showToast('\u98ce\u683c\u62c6\u89e3\u5b8c\u6210');
  } catch (error) { showToast(`\u5206\u6790\u5931\u8d25\uff1a${error.message}`); }
  finally { button.disabled = false; button.innerHTML = '\u2726 <span>\u5f00\u59cb\u62c6\u89e3\u56fe\u7247</span>'; }
}
$('#analyzeImageButton').addEventListener('click', analyzeImage);
$('#copyBreakdownButton').addEventListener('click', async () => { if (!lastBreakdown) return showToast('\u8fd8\u6ca1\u6709\u53ef\u590d\u5236\u7684\u62c6\u89e3\u7ed3\u679c'); showToast(await copyText(lastBreakdown) ? '\u62c6\u89e3\u7ed3\u679c\u5df2\u590d\u5236' : '\u590d\u5236\u5931\u8d25\uff0c\u8bf7\u957f\u6309\u6587\u5b57\u590d\u5236'); });
function getBreakdownStylePrompt() { const quick = lastBreakdown.match(/整体采用：\s*([\s\S]+)/); return (quick?.[1] || lastBreakdown.split(/FINAL STYLE PROMPT:/i).pop() || '').trim(); }
$('#sendToTextToImageButton').addEventListener('click', () => { const prompt = getBreakdownStylePrompt(); if (!prompt) return showToast('\u8bf7\u5148\u5b8c\u6210\u62c6\u56fe'); imagePrompt.value = prompt; imageCount.textContent = `${prompt.length} \u5b57`; activatePanel('image', '#imagePrompt'); showToast('\u5df2\u5e26\u5165\u6587\u751f\u56fe'); });
const DIRECT_I2I_MAX_REFERENCES = 6;
let directI2IFiles = [];
let directI2IPreviewUrls = [];
let directI2IResultUrl = '';
function escapeHtml(value) { return String(value).replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]); }
function renderDirectI2IReferences() {
  directI2IPreviewUrls.forEach(URL.revokeObjectURL); directI2IPreviewUrls = [];
  const grid = $('#directI2IReferenceGrid');
  if (!directI2IFiles.length) {
    grid.innerHTML = ''; $('#directI2IPreviewWrap').hidden = true;
    $('#directI2IUploadName').textContent = '点击添加图片，最多 6 张，按编号发送';
    $('#directI2IReferenceStatus').textContent = '图片只按编号排列；图 1、图 2 的用途由你在提示词中自由说明。';
    return;
  }
  grid.innerHTML = directI2IFiles.map((file, index) => {
    const previewUrl = URL.createObjectURL(file); directI2IPreviewUrls.push(previewUrl);
    return `<div class="reference-image-card"><img src="${previewUrl}" alt="参考图 ${index + 1}" /><span class="reference-image-number">${index + 1}</span><button class="reference-image-remove" data-direct-i2i-remove="${index}" type="button" aria-label="移除参考图 ${index + 1}">×</button><span class="reference-image-name">${escapeHtml(file.name || `参考图 ${index + 1}`)}</span></div>`;
  }).join('');
  $('#directI2IPreviewWrap').hidden = false;
  $('#directI2IUploadName').textContent = `已添加 ${directI2IFiles.length} 张参考图，可继续添加`;
  $('#directI2IReferenceStatus').textContent = `将按图 1 - 图 ${directI2IFiles.length} 的编号顺序发送；每张图的用途由你的提示词决定。`;
}
function addDirectI2IReferences(files) {
  const incoming = [...(files || [])].filter(file => file.type.startsWith('image/'));
  const known = new Set(directI2IFiles.map(file => `${file.name}-${file.size}-${file.lastModified}`));
  const allowed = incoming.filter(file => !known.has(`${file.name}-${file.size}-${file.lastModified}`)).slice(0, DIRECT_I2I_MAX_REFERENCES - directI2IFiles.length);
  if (!allowed.length) return showToast(directI2IFiles.length >= DIRECT_I2I_MAX_REFERENCES ? '最多添加 6 张参考图' : '没有可添加的新图片');
  directI2IFiles.push(...allowed); renderDirectI2IReferences(); showToast(`已添加 ${allowed.length} 张参考图`);
}
function getDroppedImageFiles(event) {
  const files = [...(event.dataTransfer?.files || [])].filter(file => file.type?.startsWith('image/'));
  if (files.length) return files;
  return [...(event.dataTransfer?.items || [])].filter(item => item.kind === 'file' && item.type?.startsWith('image/')).map(item => item.getAsFile()).filter(Boolean);
}
function enableImageDrop(target, onFiles, maxFiles = 1) {
  let dragDepth = 0;
  const clear = () => { dragDepth = 0; target.classList.remove('dragging-file'); };
  target.addEventListener('dragenter', event => { if (!getDroppedImageFiles(event).length && !event.dataTransfer?.types?.includes('Files')) return; event.preventDefault(); dragDepth += 1; target.classList.add('dragging-file'); });
  target.addEventListener('dragover', event => { if (event.dataTransfer?.types?.includes('Files')) { event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; } });
  target.addEventListener('dragleave', event => { if (dragDepth > 0) dragDepth -= 1; if (!dragDepth) target.classList.remove('dragging-file'); });
  target.addEventListener('drop', event => { event.preventDefault(); clear(); const files = getDroppedImageFiles(event).slice(0, maxFiles); if (!files.length) return showToast('请拖入图片文件'); onFiles(files); });
}
enableImageDrop($('#breakdownUpload').closest('.breakdown-dropzone'), files => {
  const file = files[0]; breakdownFile = file;
  const reader = new FileReader(); reader.onload = () => { breakdownImageData = reader.result; $('#breakdownPreview').src = breakdownImageData; $('#breakdownPreviewWrap').hidden = false; showToast('图片已拖入拆图分析'); }; reader.readAsDataURL(file);
});
enableImageDrop($('#directI2IUpload').closest('.control-field'), files => addDirectI2IReferences(files), DIRECT_I2I_MAX_REFERENCES);
$('#directI2IUpload').addEventListener('change', event => { addDirectI2IReferences(event.target.files); event.target.value = ''; });
$('#directI2ICamera').addEventListener('change', event => { addDirectI2IReferences(event.target.files); event.target.value = ''; });
$('#directI2IReferenceGrid').addEventListener('click', event => { const button = event.target.closest('[data-direct-i2i-remove]'); if (!button) return; directI2IFiles.splice(Number(button.dataset.directI2iRemove), 1); renderDirectI2IReferences(); showToast('已移除参考图'); });
$('#directI2IPoseStrength').addEventListener('input', event => { $('#directI2IPoseStrengthValue').textContent = `${event.target.value}%`; });
$('#directI2IStrength').addEventListener('input', event => { $('#directI2IStrengthValue').textContent = `${event.target.value}%`; });
async function generateDirectI2I() {
  const prompt = $('#directI2IPrompt').value.trim(); const config = getConfigs().image;
  if (!directI2IFiles.length) return showToast('\u8bf7\u5148\u6dfb\u52a0\u81f3\u5c11\u4e00\u5f20\u53c2\u8003\u56fe');
  if (!prompt) return showToast('\u8bf7\u8f93\u5165\u56fe\u751f\u56fe\u63d0\u793a\u8bcd');
  if (!config.apiKey || !config.baseUrl || !config.model) { settingsDialog.showModal(); showToast('\u8bf7\u5148\u914d\u7f6e\u751f\u56fe\u6a21\u578b'); return; }
  const button = $('#generateDirectI2IButton'); directI2IResultUrl = ''; $('#saveDirectI2IButton').disabled = true; button.disabled = true; button.innerHTML = '\u2026 <span>\u56fe\u751f\u56fe\u4e2d</span>';
  try {
    const fullPrompt = `${buildI2IPrompt(prompt, $('#directI2IStyle').value, $('#directI2IPoseStrength').value, $('#directI2IStrength').value, $('#directI2INegative').value)} ${directI2IFiles.length > 1 ? `Multiple numbered reference images are attached. Their roles are defined entirely by the user's prompt. Follow the explicit references to image 1, image 2, and so on; do not assume that any image is a person, subject, style, or composition anchor.` : ''}`.trim(); lastGenerationKind = 'image-to-image';
    const form = new FormData(); form.append('model', config.model); form.append('prompt', fullPrompt); form.append('size', $('#directI2ISize').value); directI2IFiles.forEach(file => form.append('image', file, file.name)); appendImageReferenceFidelity(form, config, config.model);
    const response = await apiRequest(`${config.baseUrl.replace(/\/$/, '')}/images/edits`, { method: 'POST', headers: { Authorization: `Bearer ${config.apiKey}` }, body: form });
    if (!response.ok) { const detail = await response.text(); throw new Error(`HTTP ${response.status} ${detail.slice(0, 180)}`); }
    const image = (await response.json()).data?.[0]; directI2IResultUrl = image?.b64_json ? `data:image/png;base64,${image.b64_json}` : image?.url || ''; if (!directI2IResultUrl) throw new Error('\u63a5\u53e3\u6ca1\u6709\u8fd4\u56de\u56fe\u7247'); $('#directI2IOutput').innerHTML = `<img src="${directI2IResultUrl}" alt="图生图结果" />`; $('#saveDirectI2IButton').disabled = false; queueWorkspacePersist(); showToast('\u56fe\u751f\u56fe\u5b8c\u6210');
  } catch (error) { $('#directI2IOutput').innerHTML = `<div class="image-output-placeholder">${error.message}</div>`; showToast(`\u56fe\u751f\u56fe\u5931\u8d25：${error.message}`); }
  finally { button.disabled = false; button.innerHTML = '\u2301 <span>\u751f\u6210\u56fe\u751f\u56fe</span>'; }
}
$('#generateDirectI2IButton').addEventListener('click', generateDirectI2I);
const imagePresets = [
  ['富士胶片人像', 'Fujifilm Superia film portrait, soft daylight, gentle green and cyan cast, subtle film grain, natural skin tone, candid editorial photography'],
  ['复古印刷海报', 'retro art poster, risograph-inspired photo treatment, screen print grain, limited ink palette, vintage magazine cover aesthetic'],
  ['CCD 闪光夜拍', 'early 2000s CCD camera flash photography, direct flash, nightlife candid, cool blue shadows, slight motion blur, nostalgic digital grain'],
  ['日杂清透', 'Japanese lifestyle magazine photography, clean natural light, airy composition, soft pastel color grading, relaxed editorial mood'],
  ['港风霓虹', 'Hong Kong neon night photography, saturated red and cyan practical lights, cinematic rain reflections, urban film still'],
  ['法式杂志', 'French fashion editorial, soft window light, muted cream and wine palette, refined texture, effortless composition'],
  ['油画肖像', 'classical oil portrait painting, visible brushwork, museum canvas texture, dramatic soft chiaroscuro, rich pigments'],
  ['梦核柔焦', 'dreamcore photography, soft focus, hazy glow, pastel liminal atmosphere, gentle surreal color palette'],
  ['赛博机能', 'cyberpunk fashion portrait, neon rim lighting, wet reflective surfaces, futuristic city atmosphere, high contrast'],
  ['黑白电影', 'black and white cinematic portrait, silver gelatin film grain, dramatic side light, deep shadows, timeless editorial frame']
];
$('#quickPresets').innerHTML = imagePresets.map(([name], index) => `<button class="quick-preset" data-preset-index="${index}" type="button">${name}</button>`).join('');
$('#quickPresets').addEventListener('click', event => { const button = event.target.closest('[data-preset-index]'); if (!button) return; const [name, prompt] = imagePresets[Number(button.dataset.presetIndex)]; $('#directI2IPrompt').value = prompt; showToast(`已应用“${name}”，请点击生成图生图`); });
function appendImageReferenceFidelity(form, config, model) {
  if (config.provider === 'openai' && /^gpt-image-1(?:\.5)?$/i.test(model)) form.append('input_fidelity', 'high');
}
function buildI2IPrompt(prompt, style, poseStrength, styleStrength, negative) {
  const styleLevel = Number(styleStrength);
  const referenceLevel = Number(poseStrength);
  const transformation = styleLevel <= 30
    ? 'Make only subtle refinements to lighting, color, texture, and styling.'
    : styleLevel <= 70
      ? 'Make clear stylistic and environmental changes while keeping the referenced person unmistakably the same.'
      : 'Apply a bold transformation to style, clothing, background, lighting, and artistic treatment, but never replace the referenced person.';
  const referenceDirection = referenceLevel <= 20
    ? 'Keep only the reference face identity. Freely generate a new expression, pose, action, body gesture, and outfit from the user prompt and target style.'
    : referenceLevel <= 60
      ? 'Keep the reference face identity and broadly similar body proportions, but allow the user prompt to substantially reinterpret expression, pose, action, and outfit.'
      : referenceLevel <= 85
        ? 'Keep the reference face identity, expression mood, pose, gesture, and outfit direction broadly recognizable, allowing only natural stylistic adaptation.'
        : 'Faithfully preserve the reference face identity, expression, pose, gesture, body posture, and outfit while applying the requested image style.';
  return [
    'REFERENCE IMAGE IS A BINDING FACE IDENTITY REFERENCE. The generated person must have the same face identity and recognizable facial features as the reference image at every setting. Never swap the face, gender, age group, or identity.',
    'Re-render the entire person natively inside the requested style and scene. The face, skin, hair, clothing, materials, color grading, lighting, shadows, and texture must all belong to the same coherent target art direction, never like a pasted photographic cutout.',
    'Keep the person as the main subject. The full image may be artistically reinterpreted, but the face must remain recognizably the same person.',
    `Person reference fidelity: ${poseStrength}%. ${referenceDirection}`,
    `Style and scene transformation: ${styleStrength}%. ${transformation}`,
    `Requested visual direction: ${style}.`,
    prompt ? `User-requested changes: ${prompt}` : '',
    'Never turn this into a text-only generation. Never ignore the uploaded reference image. Avoid: different person, identity loss, gender swap, age swap, face replacement, unrelated subject, missing subject.',
    negative ? `Additional avoid list: ${negative}.` : ''
  ].filter(Boolean).join('\n');
}
function makeImageFilename(kind) { return `prompt-pop-${kind}-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.png`; }
const framePresets = [
  ['画册封面', '#1d1d1d', '#ece6d9', 'editorial'], ['日期印记', '#1d1d1d', '#f8f5ee', 'date'], ['接触印样', '#111111', '#111111', 'contact'], ['旅行明信片', '#806e58', '#f9f3e5', 'postcard'],
  ['旅行票根', '#2c5d69', '#edd7ba', 'ticket'], ['画廊藏品卡', '#1a1a1a', '#fbfaf5', 'museum'], ['音乐封套', '#ffffff', '#3f55a8', 'music'], ['报纸头版', '#1d1d1d', '#e7e0d0', 'newspaper'],
  ['拼贴手账', '#b52f60', '#f8d7df', 'scrapbook'], ['护照档案', '#e3d39e', '#2b5161', 'passport'], ['纪念相卡', '#a44e45', '#f2e8d8', 'memory'], ['极简摄影书', '#1d1d1d', '#ffffff', 'minimal']
];
let pendingImageExport = null;
let selectedFrameIndex = 0;
async function updateFramePreview() { const [name] = framePresets[selectedFrameIndex]; $('#framePreviewTitle').textContent = name; if (!pendingImageExport) return; const token = `${selectedFrameIndex}-${Date.now()}`; $('#framePreviewImage').dataset.token = token; try { const preview = await addFrameToImageExact(pendingImageExport.url, framePresets[selectedFrameIndex], true); if ($('#framePreviewImage').dataset.token === token) $('#framePreviewImage').src = preview; } catch { $('#framePreviewImage').src = pendingImageExport.url; } }
function renderFrameOptions() { $('#frameGrid').innerHTML = framePresets.map(([name, color, fill], index) => `<button class="frame-option ${index === selectedFrameIndex ? 'active' : ''}" data-frame-index="${index}" type="button"><span class="frame-swatch" style="--frame-color:${color};--frame-fill:${fill};--frame-size:14px"></span>${name}</button>`).join(''); updateFramePreview(); }
function openFramePicker(url, kind) { if (!url) return showToast('请先生成图片'); pendingImageExport = { url, kind }; selectedFrameIndex = 0; $('#framePreviewImage').src = url; renderFrameOptions(); $('#frameDialog').showModal(); }
$('#frameGrid').addEventListener('click', event => { const button = event.target.closest('[data-frame-index]'); if (!button) return; selectedFrameIndex = Number(button.dataset.frameIndex); renderFrameOptions(); });
$('#closeFrameDialog').addEventListener('click', () => $('#frameDialog').close());
function loadExportImage(url) { return new Promise((resolve, reject) => { const image = new Image(); image.onload = () => resolve(image); image.onerror = () => reject(new Error('图片读取失败')); image.src = url; }); }
async function addFrameToImage(url, frame, preview = false) {
  const source = await loadExportImage(url);
  const scale = preview ? Math.min(1, 520 / Math.max(source.naturalWidth, source.naturalHeight)) : 1;
  const iw = Math.round(source.naturalWidth * scale);
  const ih = Math.round(source.naturalHeight * scale);
  const [name, color, fill, type] = frame;
  const p = Math.max(26, Math.round(Math.min(iw, ih) * .08));
  const top = ['editorial', 'ticket', 'music', 'newspaper', 'passport', 'memory'].includes(type) ? Math.round(p * 1.42) : p;
  const bottom = ['editorial', 'postcard', 'ticket', 'museum', 'music', 'newspaper', 'memory', 'minimal', 'passport'].includes(type) ? Math.round(p * 1.68) : p;
  const canvas = document.createElement('canvas');
  canvas.width = iw + p * 2;
  canvas.height = ih + top + bottom;
  const c = canvas.getContext('2d');
  const small = Math.max(9, Math.round(p * .15));
  const body = Math.max(11, Math.round(p * .2));
  const title = Math.max(15, Math.round(p * .29));
  const x = p;
  const y = top;
  const imageW = iw;
  const imageH = ih;
  const footerY = y + imageH;
  const text = (value, px, py, font, align = 'left', ink = color) => { c.fillStyle = ink; c.font = font; c.textAlign = align; c.fillText(value, px, py); };

  c.fillStyle = fill;
  c.fillRect(0, 0, canvas.width, canvas.height);
  c.drawImage(source, x, y, imageW, imageH);

  if (type === 'editorial') {
    text('PORTRAIT', x, Math.round(p * .58), `700 ${title}px Georgia, serif`, 'left', '#1d1d1d');
    text('STORIES IN COLOR', x, Math.round(p * .86), `${small}px sans-serif`, 'left', '#1d1d1d');
    text('VOL. 08 / 2026', canvas.width - x, canvas.height - Math.round(p * .42), `700 ${small}px sans-serif`, 'right', '#1d1d1d');
  } else if (type === 'date') {
    c.strokeStyle = color; c.lineWidth = Math.max(2, Math.round(p * .04));
    [[p*.4,p*.4,1,1], [canvas.width-p*.4,p*.4,-1,1], [p*.4,canvas.height-p*.4,1,-1], [canvas.width-p*.4,canvas.height-p*.4,-1,-1]].forEach(([cx,cy,dx,dy]) => {
      c.beginPath(); c.moveTo(cx, cy + dy * p * .42); c.lineTo(cx, cy); c.lineTo(cx + dx * p * .42, cy); c.stroke();
    });
    text('08.03', canvas.width - Math.round(p * .38), footerY - Math.round(p * .25), `700 ${Math.max(17, Math.round(p * .36))}px Georgia, serif`, 'right', '#ffffff');
  } else if (type === 'contact') {
    c.fillStyle = '#111'; c.fillRect(0, 0, canvas.width, canvas.height); c.drawImage(source, x, y, imageW, imageH);
    const holeH = Math.max(13, Math.round(p * .4)); const holeW = Math.max(9, Math.round(p * .27));
    for (let holeY = Math.round(p * .5); holeY < canvas.height - p * .5; holeY += Math.round(holeH * 1.75)) { c.fillStyle = '#f2eadb'; c.fillRect(Math.round(p*.22), holeY, holeW, holeH); c.fillRect(canvas.width - Math.round(p*.22) - holeW, holeY, holeW, holeH); }
    text('35MM / ISO 400 / PROMPT POP', x, canvas.height - Math.round(p * .3), `700 ${small}px monospace`, 'left', '#ffffff');
  } else if (type === 'postcard') {
    c.strokeStyle = '#c8bca3'; c.lineWidth = 1; c.strokeRect(x, y, imageW, imageH);
    c.strokeStyle = '#bdb29f'; c.beginPath(); c.moveTo(x, footerY + Math.round(p*.57)); c.lineTo(canvas.width - x, footerY + Math.round(p*.57)); c.stroke();
    text('Wish you were here', x, canvas.height - Math.round(p * .4), `italic ${body}px Georgia, serif`, 'left', color);
    c.strokeStyle = '#b54e42'; c.lineWidth = Math.max(1, Math.round(p*.035)); c.setLineDash([4,3]); c.strokeRect(canvas.width - Math.round(p*1.25), canvas.height - Math.round(p*1.05), Math.round(p*.7), Math.round(p*.78)); c.setLineDash([]);
    text('AIR', canvas.width - Math.round(p*.9), canvas.height - Math.round(p*.66), `700 ${small}px sans-serif`, 'center', '#b54e42');
  } else if (type === 'ticket') {
    c.strokeStyle = color; c.setLineDash([Math.max(5,p*.15), Math.max(3,p*.1)]); c.beginPath(); c.moveTo(x, y - Math.round(p*.28)); c.lineTo(canvas.width-x, y - Math.round(p*.28)); c.moveTo(x, footerY + Math.round(p*.72)); c.lineTo(canvas.width-x, footerY + Math.round(p*.72)); c.stroke(); c.setLineDash([]);
    text('PROMPT POP EXPRESS', x, Math.round(p*.45), `700 ${small}px sans-serif`, 'left');
    text('ONE WAY', x, Math.round(p*.94), `700 ${title}px Georgia, serif`, 'left');
    text('NO. 87996 / 2026.08 / SEAT 08A', x, canvas.height - Math.round(p*.35), `${small}px monospace`, 'left');
  } else if (type === 'museum') {
    c.strokeStyle = '#1a1a1a'; c.lineWidth = Math.max(5, Math.round(p*.09)); c.strokeRect(Math.round(c.lineWidth/2), Math.round(c.lineWidth/2), canvas.width-c.lineWidth, canvas.height-c.lineWidth);
    c.strokeStyle = '#1a1a1a'; c.lineWidth = 1; c.beginPath(); c.moveTo(x, footerY + Math.round(p*.35)); c.lineTo(canvas.width-x, footerY + Math.round(p*.35)); c.stroke();
    text('UNTITLED, 2026', x, canvas.height - Math.round(p*.66), `700 ${body}px sans-serif`, 'left', '#1a1a1a');
    text('Digital print / Prompt Pop archive', x, canvas.height - Math.round(p*.36), `${small}px sans-serif`, 'left', '#666');
  } else if (type === 'music') {
    c.strokeStyle = '#f9ce44'; c.lineWidth = Math.max(5, Math.round(p*.09)); c.strokeRect(x - c.lineWidth/2, y - c.lineWidth/2, imageW+c.lineWidth, imageH+c.lineWidth);
    text('PROMPT POP / SIDE A', x, Math.round(p*.48), `700 ${small}px sans-serif`, 'left', '#ffffff');
    text('LOUD', x, canvas.height - Math.round(p*.83), `700 ${title}px Georgia, serif`, 'left', '#ffffff');
    text('MEMORY', x, canvas.height - Math.round(p*.48), `700 ${title}px Georgia, serif`, 'left', '#ffffff');
    text('A SUNDAY IN AUGUST', x, canvas.height - Math.round(p*.22), `${small}px sans-serif`, 'left', '#ffffff');
  } else if (type === 'newspaper') {
    c.strokeStyle = '#1d1d1d'; c.lineWidth = Math.max(1, Math.round(p*.025)); c.strokeRect(Math.round(p*.15), Math.round(p*.15), canvas.width-Math.round(p*.3), canvas.height-Math.round(p*.3));
    text('THE DAILY IMAGE', canvas.width/2, Math.round(p*.55), `700 ${title}px Georgia, serif`, 'center', '#1d1d1d');
    c.lineWidth = Math.max(1, Math.round(p*.025)); c.beginPath(); c.moveTo(x, y-Math.round(p*.25)); c.lineTo(canvas.width-x, y-Math.round(p*.25)); c.stroke();
    text('A SMALL MOMENT, A BIG STORY', x, canvas.height - Math.round(p*.74), `700 ${body}px Georgia, serif`, 'left', '#1d1d1d');
    text('Photography, memory and the quiet color of an ordinary day.', x, canvas.height - Math.round(p*.42), `${small}px sans-serif`, 'left', '#4f4b43');
  } else if (type === 'scrapbook') {
    c.save(); c.translate(canvas.width - p*.72, p*.55); c.rotate(.16); c.fillStyle = '#7ad6cb'; c.globalAlpha = .82; c.fillRect(-p*.65, -p*.1, p*1.3, p*.28); c.restore();
    c.strokeStyle = '#fffdf8'; c.lineWidth = Math.max(7, Math.round(p*.17)); c.strokeRect(x, y, imageW, imageH); c.strokeStyle = '#b94c72'; c.lineWidth = Math.max(2, Math.round(p*.04)); c.strokeRect(x+p*.12, y+p*.12, imageW, imageH);
    text('good day!', x, canvas.height - Math.round(p*.35), `700 ${title}px Georgia, serif`, 'left', color);
  } else if (type === 'passport') {
    c.strokeStyle = color; c.lineWidth = Math.max(1, Math.round(p*.03)); c.strokeRect(x, y, imageW, imageH);
    c.beginPath(); c.arc(Math.round(p*.62), Math.round(p*.64), Math.round(p*.29), 0, Math.PI*2); c.stroke(); text('PP', Math.round(p*.62), Math.round(p*.7), `700 ${small}px sans-serif`, 'center');
    text('THE JOURNEY', Math.round(p*1.15), Math.round(p*.57), `700 ${body}px Georgia, serif`, 'left'); text('MEMORY PASSPORT', Math.round(p*1.15), Math.round(p*.85), `${small}px sans-serif`, 'left');
    text('PPOP 2026 0803 001', x, canvas.height - Math.round(p*.35), `${small}px monospace`, 'left');
  } else if (type === 'memory') {
    c.strokeStyle = color; c.lineWidth = Math.max(6, Math.round(p*.1)); c.strokeRect(Math.round(c.lineWidth/2), Math.round(c.lineWidth/2), canvas.width-c.lineWidth, canvas.height-c.lineWidth);
    text('MOMENT / 08', x, Math.round(p*.55), `700 ${body}px Georgia, serif`, 'left');
    text('This is how we remember.', canvas.width/2, canvas.height - Math.round(p*.4), `italic ${body}px Georgia, serif`, 'center');
  } else if (type === 'minimal') {
    c.strokeStyle = '#1d1d1d'; c.lineWidth = 1; c.beginPath(); c.moveTo(x, footerY + Math.round(p*.42)); c.lineTo(canvas.width-x, footerY + Math.round(p*.42)); c.stroke();
    text('PROMPT POP ARCHIVE / 2026', x, canvas.height - Math.round(p*.68), `700 ${small}px sans-serif`, 'left', '#1d1d1d');
    text('Keep the image. Keep the feeling.', x, canvas.height - Math.round(p*.35), `${small}px Georgia, serif`, 'left', '#777');
  }

  return canvas.toDataURL('image/png');
}
async function addFrameToImageExact(url, frame, preview = false) {
  const source = await loadExportImage(url);
  const [name, color, fill, type] = frame;
  const W = 280, H = 389;
  const outputWidth = preview ? 360 : Math.max(900, source.naturalWidth);
  const scale = outputWidth / W;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(W * scale); canvas.height = Math.round(H * scale);
  const c = canvas.getContext('2d'); c.scale(scale, scale);
  const drawCover = (x, y, w, h) => {
    const cover = Math.max(w / source.naturalWidth, h / source.naturalHeight);
    const drawW = source.naturalWidth * cover, drawH = source.naturalHeight * cover;
    c.drawImage(source, x + (w - drawW) / 2, y + (h - drawH) / 2, drawW, drawH);
  };
  const text = (value, x, y, font, fillStyle = color, align = 'left') => { c.fillStyle = fillStyle; c.font = font; c.textAlign = align; c.fillText(value, x, y); };
  const line = (x1, y1, x2, y2, stroke = color, width = 1) => { c.strokeStyle = stroke; c.lineWidth = width; c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke(); };

  c.fillStyle = fill; c.fillRect(0, 0, W, H);
  if (type === 'editorial') {
    drawCover(13, 42, 254, 299); text('PORTRAIT', 13, 33, '700 23px Georgia, serif', '#1d1d1d'); text('STORIES IN COLOR', 13, 45, '10px Arial', '#1d1d1d'); text('VOL. 08 / 2026', 267, 374, '700 11px Arial', '#1d1d1d', 'right');
  } else if (type === 'date') {
    c.strokeStyle = '#b4afa5'; c.lineWidth = 1; c.strokeRect(.5, .5, W - 1, H - 1); drawCover(11, 11, 258, 367);
    c.strokeStyle = '#202020'; c.lineWidth = 2;
    [[18,18,1,1],[262,18,-1,1],[18,371,1,-1],[262,371,-1,-1]].forEach(([x,y,dx,dy]) => { c.beginPath(); c.moveTo(x, y + dy * 46); c.lineTo(x, y); c.lineTo(x + dx * 46, y); c.stroke(); });
    text('08.03', 261, 354, '700 19px Georgia, serif', '#fff', 'right');
  } else if (type === 'contact') {
    c.fillStyle = '#101010'; c.fillRect(0, 0, W, H); drawCover(24, 19, 232, 351);
    c.fillStyle = '#e9e5db'; for (let y = 12; y < 377; y += 28) { c.fillRect(6, y, 12, 15); c.fillRect(262, y, 12, 15); }
    text('35MM / ISO 400 / PROMPT POP', 24, 383, '9px monospace', '#fff');
  } else if (type === 'postcard') {
    drawCover(17, 17, 246, 304); c.strokeStyle = '#c8bca3'; c.lineWidth = 1; c.strokeRect(17.5, 17.5, 245, 303); line(17, 342, 263, 342, '#bdb29f'); text('Wish you were here', 18, 369, 'italic 13px Georgia, serif', '#806e58');
    c.strokeStyle = '#b54e42'; c.lineWidth = 2; c.setLineDash([4, 3]); c.strokeRect(224, 330, 36, 42); c.setLineDash([]); text('AIR', 242, 348, '700 8px Arial', '#b54e42', 'center'); text('MAIL', 242, 358, '700 8px Arial', '#b54e42', 'center');
  } else if (type === 'ticket') {
    text('PROMPT POP EXPRESS', 14, 21, '700 10px Arial', color); text('ONE WAY', 14, 44, '700 24px Georgia, serif', color); c.strokeStyle = color; c.setLineDash([5, 4]); line(14, 56, 266, 56, color); line(14, 338, 266, 338, color); c.setLineDash([]); drawCover(14, 70, 252, 268); text('NO. 87996 / 2026.08 / SEAT 08A', 14, 370, '9px monospace', color);
  } else if (type === 'museum') {
    c.strokeStyle = '#191919'; c.lineWidth = 7; c.strokeRect(3.5, 3.5, 273, 382); drawCover(20, 20, 240, 285); line(20, 326, 260, 326, '#222'); text('UNTITLED, 2026', 20, 347, '700 10px Arial', '#222'); text('Digital print / Prompt Pop archive', 20, 362, '10px Arial', '#666');
  } else if (type === 'music') {
    c.fillStyle = '#3f55a8'; c.fillRect(0, 0, W, H); text('PROMPT POP / SIDE A', 17, 29, '700 12px Arial', '#fff'); drawCover(17, 52, 246, 269); c.strokeStyle = '#f9ce44'; c.lineWidth = 5; c.strokeRect(17, 52, 246, 269); text('LOUD', 17, 350, '700 28px Georgia, serif', '#fff'); text('MEMORY', 17, 373, '700 28px Georgia, serif', '#fff'); text('A SUNDAY IN AUGUST', 17, 385, '10px Arial', '#fff');
  } else if (type === 'newspaper') {
    c.strokeStyle = '#8d877c'; c.lineWidth = 1; c.strokeRect(.5, .5, W - 1, H - 1); text('THE DAILY IMAGE', 140, 27, '700 20px Georgia, serif', '#1d1d1d', 'center'); c.strokeStyle = '#1d1d1d'; c.lineWidth = 1; c.beginPath(); c.moveTo(13, 40); c.lineTo(267, 40); c.stroke(); c.lineWidth = 1; c.beginPath(); c.moveTo(13, 44); c.lineTo(267, 44); c.stroke(); drawCover(13, 62, 254, 261); text('A SMALL MOMENT, A BIG STORY', 13, 348, '700 15px Georgia, serif', '#1d1d1d'); text('Photography, memory and the quiet color of an ordinary day.', 13, 367, '9px Arial', '#4f4b43');
  } else if (type === 'scrapbook') {
    c.fillStyle = '#f8d7df'; c.fillRect(0, 0, W, H); c.save(); c.translate(236, 27); c.rotate(.16); c.globalAlpha = .8; c.fillStyle = '#7ad6cb'; c.fillRect(-40, -9, 80, 18); c.restore(); c.save(); c.translate(140, 194); c.rotate(-.017); drawCover(-118, -151, 236, 303); c.strokeStyle = '#fffdf8'; c.lineWidth = 9; c.strokeRect(-118, -151, 236, 303); c.strokeStyle = '#b94c72'; c.lineWidth = 2; c.strokeRect(-115, -148, 236, 303); c.restore(); text('good day!', 19, 370, '700 22px Georgia, serif', '#b52f60');
  } else if (type === 'passport') {
    c.fillStyle = '#2b5161'; c.fillRect(0, 0, W, H); c.strokeStyle = '#e3d39e'; c.lineWidth = 1; c.strokeRect(17, 63, 246, 272); c.beginPath(); c.arc(33, 34, 15, 0, Math.PI * 2); c.lineWidth = 2; c.stroke(); text('PP', 33, 38, '700 10px Arial', '#e3d39e', 'center'); text('THE JOURNEY', 60, 31, '700 15px Georgia, serif', '#e3d39e'); text('MEMORY PASSPORT', 60, 43, '8px Arial', '#e3d39e'); drawCover(17, 63, 246, 272); c.strokeStyle = '#e3d39e'; c.lineWidth = 1; c.strokeRect(17, 63, 246, 272); text('PPOP 2026 0803 001', 17, 369, '10px monospace', '#e3d39e');
  } else if (type === 'memory') {
    c.strokeStyle = '#a44e45'; c.lineWidth = 9; c.strokeRect(4.5, 4.5, 271, 380); text('MOMENT / 08', 19, 33, '700 14px Georgia, serif', '#a44e45'); drawCover(17, 17, 246, 300); text('This is how we remember.', 140, 369, 'italic 15px Georgia, serif', '#a44e45', 'center');
  } else if (type === 'minimal') {
    drawCover(24, 24, 232, 277); line(24, 322, 256, 322, '#222'); text('PROMPT POP ARCHIVE / 2026', 24, 343, '700 12px Arial', '#1d1d1d'); text('Keep the image. Keep the feeling.', 24, 364, '10px Georgia, serif', '#777');
  }
  return canvas.toDataURL('image/png');
}
$('#exportOriginalButton').addEventListener('click', () => { const item = pendingImageExport; $('#frameDialog').close(); if (item) saveGeneratedImage(item.url, item.kind); });
$('#exportFramedButton').addEventListener('click', async () => { const item = pendingImageExport; if (!item) return; const button = $('#exportFramedButton'); button.disabled = true; try { const framed = await addFrameToImageExact(item.url, framePresets[selectedFrameIndex]); $('#frameDialog').close(); await saveGeneratedImage(framed, `${item.kind}-frame`); } catch (error) { showToast(`相框处理失败：${error.message}`); } finally { button.disabled = false; } });
async function saveGeneratedImage(url, kind) {
  if (!url) return showToast('请先生成图片');
  const filename = makeImageFilename(kind);
  if (window.PromptPopDesktop?.saveImage) {
    try { await window.PromptPopDesktop.saveImage(url, filename); showToast('已保存到图片/Prompt Pop'); return; }
    catch (error) { showToast(`保存到电脑失败：${error.message}`); return; }
  }
  if (window.PromptPopNative?.saveImageToGallery) {
    const id = `save-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    try {
      await new Promise((resolve, reject) => { nativeSaveRequests.set(id, { resolve, reject }); window.PromptPopNative.saveImageToGallery(id, url, filename); });
      showToast('已保存到系统相册');
      return;
    } catch (error) { showToast(`保存到相册失败：${error.message}`); return; }
  }
  try {
    const response = await fetch(url); if (!response.ok) throw new Error('图片下载失败');
    const blob = await response.blob(); const file = new File([blob], filename, { type: blob.type || 'image/png' });
    if (navigator.canShare?.({ files: [file] }) && navigator.share) { await navigator.share({ files: [file], title: 'Prompt Pop 图片' }); showToast('已打开保存/分享面板'); return; }
    const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = filename; document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(link.href), 1000); showToast('图片已开始保存');
  } catch (error) {
    const link = document.createElement('a'); link.href = url; link.download = filename; link.target = '_blank'; document.body.append(link); link.click(); link.remove(); showToast('已请求保存图片');
  }
}
$('#saveTextToImageButton').addEventListener('click', () => openFramePicker(generatedImageUrl, 'text-to-image'));
$('#saveDirectI2IButton').addEventListener('click', () => openFramePicker(directI2IResultUrl, 'image-to-image'));
function openImagePreview(url) { if (!url) return; $('#fullImagePreview').src = url; $('#imagePreviewDialog').showModal(); }
$('#imageOutput').addEventListener('click', event => { if (event.target.tagName === 'IMG') openImagePreview(generatedImageUrl); });
$('#directI2IOutput').addEventListener('click', event => { if (event.target.tagName === 'IMG') openImagePreview(directI2IResultUrl); });
$('#closeImagePreview').addEventListener('click', () => $('#imagePreviewDialog').close());
const WORKSPACE_DB_NAME = 'prompt-pop-workspace';
const WORKSPACE_STATE_KEY = 'latest-workspace';
const WORKSPACE_LOCAL_KEY = 'prompt-pop-workspace-latest';
let workspacePersistTimer = 0;
function openWorkspaceDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(WORKSPACE_DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('workspace');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
function workspaceRead(db, key) { return new Promise((resolve, reject) => { const request = db.transaction('workspace', 'readonly').objectStore('workspace').get(key); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); }); }
function workspaceWrite(db, key, value) { return new Promise((resolve, reject) => { const request = db.transaction('workspace', 'readwrite').objectStore('workspace').put(value, key); request.onsuccess = () => resolve(); request.onerror = () => reject(request.error); }); }
function queueWorkspacePersist() { clearTimeout(workspacePersistTimer); workspacePersistTimer = setTimeout(() => { persistWorkspaceState(); }, 350); }
async function persistWorkspaceState() {
  try {
    const ids = ['rawInput', 'optimizedOutput', 'imagePrompt', 'negativePrompt', 'imageSubject', 'imageStyle', 'imageAngle', 'imageLight', 'imageComposition', 'imageRatio', 'lensSlider', 'detailSlider', 'styleSlider', 'directI2IPrompt', 'directI2ISize', 'directI2IStyle', 'directI2IPoseStrength', 'directI2IStrength', 'directI2INegative', 'breakdownResult'];
    const values = {};
    ids.forEach(id => { const element = $(`#${id}`); if (element) values[id] = 'value' in element ? element.value : element.textContent; });
    const db = await openWorkspaceDb();
    await workspaceWrite(db, WORKSPACE_STATE_KEY, { values, imageGenerateMode, generatedImageUrl, directI2IResultUrl, savedAt: Date.now() });
    db.close();
  } catch { /* Session recovery is best-effort and must never interrupt generation. */ }
}
async function restoreWorkspaceState() {
  try {
    const db = await openWorkspaceDb(); const state = await workspaceRead(db, WORKSPACE_STATE_KEY); db.close();
    if (!state) return;
    Object.entries(state.values || {}).forEach(([id, value]) => { const element = $(`#${id}`); if (!element) return; if ('value' in element) element.value = value; else element.textContent = value; });
    setImageGenerateMode(state.imageGenerateMode || 'text');
    if (state.generatedImageUrl) { generatedImageUrl = state.generatedImageUrl; $('#imageOutput').innerHTML = `<img src="${generatedImageUrl}" alt="生成结果" />`; $('#saveTextToImageButton').disabled = false; }
    if (state.directI2IResultUrl) { directI2IResultUrl = state.directI2IResultUrl; $('#directI2IOutput').innerHTML = `<img src="${directI2IResultUrl}" alt="图生图结果" />`; $('#saveDirectI2IButton').disabled = false; }
    ['lensSlider', 'detailSlider', 'styleSlider', 'directI2IPoseStrength', 'directI2IStrength'].forEach(id => $(`#${id}`).dispatchEvent(new Event('input')));
    updateCount();
  } catch { /* A missing or unavailable cache should not block the workspace. */ }
}
function collectWorkspaceState() {
  const ids = ['rawInput', 'optimizedOutput', 'imagePrompt', 'negativePrompt', 'imageSubject', 'imageStyle', 'imageAngle', 'imageLight', 'imageComposition', 'imageRatio', 'lensSlider', 'detailSlider', 'styleSlider', 'directI2IPrompt', 'directI2ISize', 'directI2IStyle', 'directI2IPoseStrength', 'directI2IStrength', 'directI2INegative', 'breakdownResult'];
  const values = {};
  ids.forEach(id => { const element = $(`#${id}`); if (element) values[id] = 'value' in element ? element.value : element.textContent; });
  return { values, imageGenerateMode, generatedImageUrl, directI2IResultUrl, lastGenerationKind, savedAt: Date.now() };
}
function saveWorkspaceFallback(state) {
  try {
    // Large data URLs are kept in IndexedDB; Android has a durable gallery copy for recovery.
    const fallback = { ...state, generatedImageUrl: state.generatedImageUrl.startsWith('data:') ? '' : state.generatedImageUrl, directI2IResultUrl: state.directI2IResultUrl.startsWith('data:') ? '' : state.directI2IResultUrl };
    localStorage.setItem(WORKSPACE_LOCAL_KEY, JSON.stringify(fallback));
  } catch { /* Storage quota must not interrupt editing. */ }
}
function queueWorkspacePersist() { clearTimeout(workspacePersistTimer); workspacePersistTimer = setTimeout(() => { persistWorkspaceState(); }, 180); }
async function persistWorkspaceState() {
  const state = collectWorkspaceState();
  saveWorkspaceFallback(state);
  try {
    const db = await openWorkspaceDb(); await workspaceWrite(db, WORKSPACE_STATE_KEY, state); db.close();
  } catch { /* IndexedDB is optional on Android local-file WebViews. */ }
}
function renderRecoveredImage(kind, source) {
  if (!source) return;
  if (kind === 'image-to-image') {
    directI2IResultUrl = source; $('#directI2IOutput').innerHTML = `<img src="${source}" alt="image-to-image result" />`; $('#saveDirectI2IButton').disabled = false;
  } else {
    generatedImageUrl = source; $('#imageOutput').innerHTML = `<img src="${source}" alt="generated result" />`; $('#saveTextToImageButton').disabled = false;
  }
}
function requestLastGeneratedImage() {
  if (!window.PromptPopNative?.getLastGeneratedImage) return Promise.resolve(null);
  return new Promise((resolve, reject) => {
    const id = `last-image-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    nativeLastImageRequests.set(id, { resolve, reject }); window.PromptPopNative.getLastGeneratedImage(id);
  });
}
async function restoreWorkspaceState() {
  let state = null;
  try { const db = await openWorkspaceDb(); state = await workspaceRead(db, WORKSPACE_STATE_KEY); db.close(); } catch { /* Fall back below. */ }
  try {
    const fallback = JSON.parse(localStorage.getItem(WORKSPACE_LOCAL_KEY) || 'null');
    if (!state || (fallback && fallback.savedAt > (state.savedAt || 0))) state = fallback;
  } catch { /* Ignore malformed old data. */ }
  if (state) {
    Object.entries(state.values || {}).forEach(([id, value]) => { const element = $(`#${id}`); if (!element) return; if ('value' in element) element.value = value; else element.textContent = value; });
    setImageGenerateMode(state.imageGenerateMode || 'text'); lastGenerationKind = state.lastGenerationKind || '';
    if (state.generatedImageUrl) renderRecoveredImage('text-to-image', state.generatedImageUrl);
    if (state.directI2IResultUrl) renderRecoveredImage('image-to-image', state.directI2IResultUrl);
  }
  try {
    const nativeImage = await requestLastGeneratedImage();
    if (nativeImage?.source) { lastGenerationKind = nativeImage.kind || lastGenerationKind || 'text-to-image'; renderRecoveredImage(lastGenerationKind, nativeImage.source); queueWorkspacePersist(); }
  } catch { /* A deleted gallery image should not block the page. */ }
  ['lensSlider', 'detailSlider', 'styleSlider', 'directI2IPoseStrength', 'directI2IStrength'].forEach(id => $(`#${id}`).dispatchEvent(new Event('input')));
  updateCount();
}
document.addEventListener('input', event => { if (!event.target.closest('#settingsDialog')) queueWorkspacePersist(); });
document.addEventListener('change', event => { if (!event.target.closest('#settingsDialog')) queueWorkspacePersist(); });
window.addEventListener('pagehide', () => { saveWorkspaceFallback(collectWorkspaceState()); persistWorkspaceState(); });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') { saveWorkspaceFallback(collectWorkspaceState()); persistWorkspaceState(); } });
restoreWorkspaceState().finally(() => { if (!imagePrompt.value) buildImagePrompt(); });

async function optimize() {
  const idea = rawInput.value.trim();
  if (!idea) return showToast('\u8bf7\u5148\u5199\u4e0b\u4e00\u70b9\u60f3\u6cd5\u5427');
  const config = getConfigs().text;
  if (!config.apiKey || !config.baseUrl || !config.model) { settingsDialog.showModal(); showToast('\u8bf7\u5148\u8865\u5168\u6587\u672c\u6a21\u578b\u63a5\u53e3\u8bbe\u7f6e'); return; }
  const button = $('#optimizeButton'); button.disabled = true; button.innerHTML = '\u2026 <span>\u6b63\u5728\u4f18\u5316</span>';
  try {
    const endpoint = `${config.baseUrl.replace(/\/$/, '')}/chat/completions`;
    const response = await apiRequest(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.apiKey}` }, body: JSON.stringify({ model: config.model, temperature: selectedMode === 'creative' ? 0.9 : 0.45, messages: [{ role: 'system', content: `\u4f60\u662f\u4e13\u4e1a\u7684\u63d0\u793a\u8bcd\u5de5\u7a0b\u5e08\u3002\u8bf7\u7528${getModeLabel()}\u4f18\u5316\u7528\u6237\u8f93\u5165\uff0c\u53ea\u8f93\u51fa\u4f18\u5316\u540e\u7684\u63d0\u793a\u8bcd，\u4e0d\u8981\u89e3\u91ca\u8fc7\u7a0b\u3002` }, { role: 'user', content: idea }] }) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    lastResult = data.choices?.[0]?.message?.content?.trim() || '\u63a5\u53e3\u6ca1\u6709\u8fd4\u56de\u6709\u6548\u5185\u5bb9';
    resultBody.innerHTML = '<pre class="generated-text"></pre>'; resultBody.querySelector('pre').textContent = lastResult; outputCount.textContent = `${lastResult.length} \u5b57`;
    history.unshift({ idea, result: lastResult, mode: getModeLabel(), time: new Date().toLocaleString('zh-CN') }); history = history.slice(0, 8); localStorage.setItem('prompt-pop-history', JSON.stringify(history)); showToast('\u63d0\u793a\u8bcd\u4f18\u5316\u5b8c\u6210');
  } catch (error) { showToast(`\u8bf7\u6c42\u5931\u8d25\uff1a${error.message}`); }
  finally { button.disabled = false; button.innerHTML = '\u2723 <span>\u4f18\u5316\u63d0\u793a\u8bcd</span>'; }
}
$('#optimizeButton').addEventListener('click', optimize);
$('#regenerateButton').addEventListener('click', optimize);
$('#copyButton').addEventListener('click', async () => { if (!lastResult) return showToast('\u8fd8\u6ca1\u6709\u53ef\u590d\u5236\u7684\u5185\u5bb9'); showToast(await copyText(lastResult) ? '\u5df2\u590d\u5236\u5230\u526a\u8d34\u677f' : '\u590d\u5236\u5931\u8d25\uff0c\u8bf7\u957f\u6309\u6587\u5b57\u590d\u5236'); });
rawInput.addEventListener('keydown', event => { if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') optimize(); });
function renderHistory() { const list = $('#historyList'); list.innerHTML = history.length ? history.map(item => `<div class="history-item"><strong>${item.mode}</strong><div>${item.idea.slice(0, 80)}${item.idea.length > 80 ? '...' : ''}</div><small>${item.time}</small></div>`).join('') : '<p class="muted">\u8fd8\u6ca1\u6709\u4f18\u5316\u8bb0\u5f55\u3002</p>'; }
updateCount();
