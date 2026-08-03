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
const toast = $('#toast');
const providerSelect = $('#provider');
const baseUrlInput = $('#baseUrl');
const modelNameInput = $('#modelName');
let selectedMode = localStorage.getItem('prompt-pop-mode') || 'pro';
let lastResult = '';
let history = JSON.parse(localStorage.getItem('prompt-pop-history') || '[]');
const storedSettings = JSON.parse(localStorage.getItem('prompt-pop-settings') || 'null');
if (!storedSettings && localStorage.getItem('prompt-pop-key')) {
  localStorage.setItem('prompt-pop-settings', JSON.stringify({ provider: 'openai', apiKey: localStorage.getItem('prompt-pop-key'), baseUrl: providerPresets.openai.baseUrl, model: providerPresets.openai.model }));
}

modeGrid.innerHTML = modes.map(mode => `<button class="mode-card ${mode.id === selectedMode ? 'selected' : ''}" data-mode="${mode.id}"><span class="mode-icon" style="--mode-color:${mode.color}">${mode.icon}</span><strong>${mode.title}</strong><p>${mode.desc}</p></button>`).join('');
modeGrid.addEventListener('click', event => { const card = event.target.closest('.mode-card'); if (!card) return; selectedMode = card.dataset.mode; localStorage.setItem('prompt-pop-mode', selectedMode); document.querySelectorAll('.mode-card').forEach(item => item.classList.toggle('selected', item === card)); });
function updateCount() { inputCount.textContent = `${rawInput.value.length} \u5b57`; }
function showToast(message) { toast.textContent = message; toast.classList.add('show'); clearTimeout(showToast.timer); showToast.timer = setTimeout(() => toast.classList.remove('show'), 2200); }
function getModeLabel() { return modes.find(mode => mode.id === selectedMode)?.title || '\u4e13\u4e1a\u7cbe\u51c6\u578b'; }
function loadSettings() {
  const saved = JSON.parse(localStorage.getItem('prompt-pop-settings') || '{}');
  providerSelect.value = saved.provider || 'openai';
  $('#apiKey').value = saved.apiKey || localStorage.getItem('prompt-pop-key') || '';
  baseUrlInput.value = saved.baseUrl ?? providerPresets[providerSelect.value].baseUrl;
  modelNameInput.value = saved.model || providerPresets[providerSelect.value].model;
}
providerSelect.addEventListener('change', () => { const preset = providerPresets[providerSelect.value]; if (providerSelect.value !== 'custom') { baseUrlInput.value = preset.baseUrl; modelNameInput.value = preset.model; } });
$('#settingsButton').addEventListener('click', () => { loadSettings(); settingsDialog.showModal(); });
$('#settingsForm').addEventListener('submit', event => { event.preventDefault(); const settings = { provider: providerSelect.value, apiKey: $('#apiKey').value.trim(), baseUrl: baseUrlInput.value.trim(), model: modelNameInput.value.trim() }; localStorage.setItem('prompt-pop-settings', JSON.stringify(settings)); localStorage.setItem('prompt-pop-key', settings.apiKey); settingsDialog.close(); showToast('\u63a5\u53e3\u8bbe\u7f6e\u5df2\u4fdd\u5b58'); });
$('#historyButton').addEventListener('click', () => { renderHistory(); historyDialog.showModal(); });
$('#closeHistory').addEventListener('click', () => historyDialog.close());
$('#themeButton').addEventListener('click', () => { document.body.classList.toggle('dark'); localStorage.setItem('prompt-pop-theme', document.body.classList.contains('dark') ? 'dark' : 'light'); });
if (localStorage.getItem('prompt-pop-theme') === 'dark') document.body.classList.add('dark');
rawInput.addEventListener('input', updateCount);
$('#clearButton').addEventListener('click', () => { rawInput.value = ''; updateCount(); rawInput.focus(); });

async function optimize() {
  const idea = rawInput.value.trim();
  if (!idea) return showToast('\u8bf7\u5148\u5199\u4e0b\u4e00\u70b9\u60f3\u6cd5\u5427');
  const settings = JSON.parse(localStorage.getItem('prompt-pop-settings') || '{}');
  if (!settings.apiKey || !settings.baseUrl || !settings.model) { settingsDialog.showModal(); showToast('\u8bf7\u5148\u8865\u5168\u63a5\u53e3\u8bbe\u7f6e'); return; }
  const button = $('#optimizeButton'); button.disabled = true; button.innerHTML = '\u2026 <span>\u6b63\u5728\u4f18\u5316</span>';
  try {
    const endpoint = `${settings.baseUrl.replace(/\/$/, '')}/chat/completions`;
    const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${settings.apiKey}` }, body: JSON.stringify({ model: settings.model, temperature: selectedMode === 'creative' ? 0.9 : 0.45, messages: [{ role: 'system', content: `\u4f60\u662f\u4e13\u4e1a\u7684\u63d0\u793a\u8bcd\u5de5\u7a0b\u5e08\u3002\u8bf7\u7528${getModeLabel()}\u4f18\u5316\u7528\u6237\u8f93\u5165\uff0c\u53ea\u8f93\u51fa\u4f18\u5316\u540e\u7684\u63d0\u793a\u8bcd\uff0c\u4e0d\u8981\u89e3\u91ca\u8fc7\u7a0b\u3002` }, { role: 'user', content: idea }] }) });
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
$('#copyButton').addEventListener('click', async () => { if (!lastResult) return showToast('\u8fd8\u6ca1\u6709\u53ef\u590d\u5236\u7684\u5185\u5bb9'); await navigator.clipboard.writeText(lastResult); showToast('\u5df2\u590d\u5236\u5230\u526a\u8d34\u677f'); });
rawInput.addEventListener('keydown', event => { if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') optimize(); });
function renderHistory() { const list = $('#historyList'); list.innerHTML = history.length ? history.map(item => `<div class="history-item"><strong>${item.mode}</strong><div>${item.idea.slice(0, 80)}${item.idea.length > 80 ? '...' : ''}</div><small>${item.time}</small></div>`).join('') : '<p class="muted">\u8fd8\u6ca1\u6709\u4f18\u5316\u8bb0\u5f55\u3002</p>'; }
updateCount();
