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
const textProviderInput = $('#textProvider');
const textBaseUrlInput = $('#textBaseUrl');
const textModelInput = $('#textModel');
const visionProviderInput = $('#visionProvider');
const visionBaseUrlInput = $('#visionBaseUrl');
const visionModelInput = $('#visionModel');
const imageProviderInput = $('#imageProvider');
const imageBaseUrlInput = $('#imageBaseUrl');
const imageServiceModelInput = $('#imageServiceModel');
let selectedMode = localStorage.getItem('prompt-pop-mode') || 'pro';
let lastResult = '';
let history = JSON.parse(localStorage.getItem('prompt-pop-history') || '[]');
let soundEnabled = localStorage.getItem('prompt-pop-sound') !== 'off';
let audioContext;
const storedSettings = JSON.parse(localStorage.getItem('prompt-pop-settings') || 'null');
if (!storedSettings && localStorage.getItem('prompt-pop-key')) {
  localStorage.setItem('prompt-pop-settings', JSON.stringify({ provider: 'openai', apiKey: localStorage.getItem('prompt-pop-key'), baseUrl: providerPresets.openai.baseUrl, model: providerPresets.openai.model }));
}

modeGrid.innerHTML = modes.map(mode => `<button class="mode-card ${mode.id === selectedMode ? 'selected' : ''}" data-mode="${mode.id}"><span class="mode-icon" style="--mode-color:${mode.color}">${mode.icon}</span><strong>${mode.title}</strong><p>${mode.desc}</p></button>`).join('');
modeGrid.addEventListener('click', event => { const card = event.target.closest('.mode-card'); if (!card) return; selectedMode = card.dataset.mode; localStorage.setItem('prompt-pop-mode', selectedMode); document.querySelectorAll('.mode-card').forEach(item => item.classList.toggle('selected', item === card)); playSound('tab'); });
document.querySelectorAll('.section-tab').forEach(tab => tab.addEventListener('click', () => { const panel = tab.dataset.panel; document.querySelectorAll('.section-tab').forEach(item => item.classList.toggle('active', item === tab)); document.querySelectorAll('[data-panel-section]').forEach(section => section.classList.toggle('active', section.dataset.panelSection === panel)); window.scrollTo({ top: 0, behavior: 'smooth' }); }));
function updateCount() { inputCount.textContent = `${rawInput.value.length} \u5b57`; }
function playSound(type = 'click') {
  if (!soundEnabled) return;
  audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
  if (audioContext.state === 'suspended') audioContext.resume();
  const notes = type === 'success' ? [523, 659, 784] : type === 'error' ? [180, 140] : type === 'tab' ? [440, 660] : [520];
  const now = audioContext.currentTime;
  notes.forEach((frequency, index) => { const oscillator = audioContext.createOscillator(); const gain = audioContext.createGain(); oscillator.type = type === 'error' ? 'sawtooth' : 'square'; oscillator.frequency.value = frequency; gain.gain.setValueAtTime(0.0001, now + index * 0.055); gain.gain.exponentialRampToValueAtTime(type === 'click' ? 0.025 : 0.04, now + index * 0.055 + 0.008); gain.gain.exponentialRampToValueAtTime(0.0001, now + index * 0.055 + 0.085); oscillator.connect(gain).connect(audioContext.destination); oscillator.start(now + index * 0.055); oscillator.stop(now + index * 0.055 + 0.1); });
}
function showToast(message) { toast.textContent = message; toast.classList.add('show'); playSound(/失败|错误/.test(message) ? 'error' : /完成|成功|已保存|已复制/.test(message) ? 'success' : 'click'); clearTimeout(showToast.timer); showToast.timer = setTimeout(() => toast.classList.remove('show'), 2200); }
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
function populateProviderFields(provider, baseUrl, model, providerInput, baseUrlInput, modelInput) {
  providerInput.value = provider || 'openai'; baseUrlInput.value = baseUrl || providerPresets[providerInput.value]?.baseUrl || ''; modelInput.value = model || '';
}
function loadSettings() {
  const configs = getConfigs();
  populateProviderFields(configs.text.provider, configs.text.baseUrl, configs.text.model, textProviderInput, textBaseUrlInput, textModelInput); $('#textApiKey').value = configs.text.apiKey || '';
  populateProviderFields(configs.vision.provider, configs.vision.baseUrl, configs.vision.model, visionProviderInput, visionBaseUrlInput, visionModelInput); $('#visionApiKey').value = configs.vision.apiKey || '';
  populateProviderFields(configs.image.provider, configs.image.baseUrl, configs.image.model, imageProviderInput, imageBaseUrlInput, imageServiceModelInput); $('#imageApiKey').value = configs.image.apiKey || '';
}
function applyProviderPreset(providerInput, baseUrlInput, modelInput) { const preset = providerPresets[providerInput.value]; if (preset && providerInput.value !== 'custom') { baseUrlInput.value = preset.baseUrl; if (!modelInput.value.trim()) modelInput.value = preset.model; } }
[[textProviderInput, textBaseUrlInput, textModelInput], [visionProviderInput, visionBaseUrlInput, visionModelInput], [imageProviderInput, imageBaseUrlInput, imageServiceModelInput]].forEach(([providerInput, baseUrlInput, modelInput]) => providerInput.addEventListener('change', () => applyProviderPreset(providerInput, baseUrlInput, modelInput)));
document.querySelectorAll('.config-tab').forEach(tab => tab.addEventListener('click', () => { const name = tab.dataset.configTab; document.querySelectorAll('.config-tab').forEach(item => item.classList.toggle('active', item === tab)); document.querySelectorAll('.config-pane').forEach(pane => pane.classList.toggle('active', pane.dataset.configPane === name)); playSound('tab'); }));
$('#settingsButton').addEventListener('click', () => { loadSettings(); settingsDialog.showModal(); });
$('#settingsForm').addEventListener('submit', event => { event.preventDefault(); const configs = { text: { provider: textProviderInput.value, apiKey: $('#textApiKey').value.trim(), baseUrl: textBaseUrlInput.value.trim(), model: textModelInput.value.trim() }, vision: { provider: visionProviderInput.value, apiKey: $('#visionApiKey').value.trim(), baseUrl: visionBaseUrlInput.value.trim(), model: visionModelInput.value.trim() }, image: { provider: imageProviderInput.value, apiKey: $('#imageApiKey').value.trim(), baseUrl: imageBaseUrlInput.value.trim(), model: imageServiceModelInput.value.trim() } }; localStorage.setItem('prompt-pop-settings', JSON.stringify(configs)); localStorage.setItem('prompt-pop-key', configs.text.apiKey); settingsDialog.close(); showToast('\u63a5\u53e3\u8bbe\u7f6e\u5df2\u4fdd\u5b58'); });
$('#historyButton').addEventListener('click', () => { renderHistory(); historyDialog.showModal(); });
$('#closeHistory').addEventListener('click', () => historyDialog.close());
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
$('#imageCopyButton').addEventListener('click', async () => { if (!imagePrompt.value) return; await navigator.clipboard.writeText(imagePrompt.value); showToast('\u751f\u56fe\u63d0\u793a\u8bcd\u5df2\u590d\u5236'); });
$('#useImagePromptButton').addEventListener('click', () => { rawInput.value = imagePrompt.value; updateCount(); rawInput.scrollIntoView({ behavior: 'smooth', block: 'center' }); showToast('\u5df2\u5e26\u5165\u901a\u7528\u4f18\u5316\u5668'); });
let imageGenerateMode = 'text';
let imageFile = null;
let imageReferenceData = '';
let generatedImageUrl = '';
document.querySelectorAll('[data-generate-mode]').forEach(button => button.addEventListener('click', () => { imageGenerateMode = button.dataset.generateMode; document.querySelectorAll('[data-generate-mode]').forEach(item => item.classList.toggle('active', item === button)); }));
$('#imageUpload').addEventListener('change', event => {
  imageFile = event.target.files?.[0] || null;
  if (!imageFile) return;
  imageGenerateMode = 'image'; document.querySelectorAll('[data-generate-mode]').forEach(item => item.classList.toggle('active', item.dataset.generateMode === 'image'));
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
    const response = await fetch(`${config.baseUrl.replace(/\/$/, '')}/chat/completions`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.apiKey}` }, body: JSON.stringify({ model: config.model, temperature: 0.35, messages: [{ role: 'system', content: 'Analyze the reference image for image-to-image generation. Return only one detailed English production prompt. Include subject, composition, camera, lighting, palette, materials, texture, and style. Do not mention that you are analyzing an image.' }, { role: 'user', content: [{ type: 'text', text: 'Create a detailed image-to-image prompt based on this reference.' }, { type: 'image_url', image_url: { url: imageReferenceData } }] }] }) });
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
  const button = $('#generateImageButton'); button.disabled = true; button.innerHTML = '\u2026 <span>\u751f\u6210\u4e2d</span>';
  const endpoint = `${config.baseUrl.replace(/\/$/, '')}/images/${imageGenerateMode === 'image' ? 'edits' : 'generations'}`;
  const imageModel = $('#imageModelCustom').value.trim() || config.model || $('#imageModel').value;
  try {
    let response;
    if (imageGenerateMode === 'image') {
      const form = new FormData(); form.append('model', imageModel); form.append('prompt', imagePrompt.value); form.append('size', $('#imageSize').value); form.append('image', imageFile, imageFile.name);
      response = await fetch(endpoint, { method: 'POST', headers: { Authorization: `Bearer ${config.apiKey}` }, body: form });
    } else {
      response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.apiKey}` }, body: JSON.stringify({ model: imageModel, prompt: imagePrompt.value, size: $('#imageSize').value }) });
    }
    if (!response.ok) { const errorBody = await response.text(); throw new Error(`HTTP ${response.status} ${errorBody.slice(0, 180)}`); }
    const data = await response.json(); const image = data.data?.[0];
    generatedImageUrl = image?.b64_json ? `data:image/png;base64,${image.b64_json}` : image?.url || '';
    if (!generatedImageUrl) throw new Error('\u63a5\u53e3\u6ca1\u6709\u8fd4\u56de\u56fe\u7247');
    $('#imageOutput').innerHTML = `<img src="${generatedImageUrl}" alt="生成结果" />`; showToast('\u56fe\u7247\u751f\u6210\u5b8c\u6210');
  } catch (error) { $('#imageOutput').innerHTML = `<div class="image-output-placeholder">${error.message}</div>`; showToast(`\u751f\u6210\u5931\u8d25\uff1a${error.message}`); }
  finally { button.disabled = false; button.innerHTML = '\u2726 <span>\u751f\u6210\u56fe\u7247</span>'; }
}
$('#generateImageButton').addEventListener('click', generateImage);
$('#analyzeThenGenerateButton').addEventListener('click', analyzeThenGenerate);
let breakdownImageData = '';
let lastBreakdown = '';
$('#breakdownUpload').addEventListener('change', event => {
  const file = event.target.files?.[0]; if (!file) return;
  const reader = new FileReader(); reader.onload = () => { breakdownImageData = reader.result; $('#breakdownPreview').src = breakdownImageData; $('#breakdownPreviewWrap').hidden = false; }; reader.readAsDataURL(file);
});
$('#removeBreakdownButton').addEventListener('click', () => { breakdownImageData = ''; $('#breakdownUpload').value = ''; $('#breakdownPreviewWrap').hidden = true; });
async function analyzeImage() {
  const config = getConfigs().vision;
  if (!config.apiKey || !config.baseUrl || !config.model) { settingsDialog.showModal(); showToast('\u8bf7\u5148\u914d\u7f6e\u89c6\u89c9\u62c6\u56fe\u6a21\u578b'); return; }
  if (!breakdownImageData) { showToast('\u8bf7\u5148\u4e0a\u4f20\u4e00\u5f20\u56fe\u7247'); return; }
  const button = $('#analyzeImageButton'); button.disabled = true; button.innerHTML = '\u2026 <span>\u6df1\u5ea6\u5206\u6790\u4e2d</span>';
  const detail = $('#breakdownDetail').value; const language = $('#breakdownLanguage').value;
  const instruction = `你是一位资深视觉分析师、摄影指导和提示词工程师。请对这张参考图进行${detail}的风格化拆解，输出语言为${language}。请不要识别或推断真实人物身份。请严格按以下结构输出：\n\n1. 一句话视觉总览\n2. 主体与叙事：主体、动作、表情、道具、环境、前景中景背景\n3. 风格流派：艺术流派、设计语言、参考媒介、时代气质\n4. 画面构成：景别、构图、视觉动线、主体位置、留白、层次\n5. 镜头语言：视角、焦段推测、景深、对焦、透视、拍摄距离\n6. 光线：主光、辅光、轮廓光、光质、方向、阴影、氛围\n7. 色彩：主色、辅色、点缀色、冷暖关系、饱和度、对比度\n8. 材质与纹理：表面质感、颗粒、网点、笔触、纸张、反射、磨损\n9. 后期与画质：清晰度、锐度、动态范围、色彩分级、印刷或渲染特征\n10. 可复用的风格关键词\n11. 反向提示词\n12. FINAL IMAGE PROMPT：输出一段可以直接用于文生图或图生图的完整英文提示词，尽可能具体，包含主体、环境、构图、镜头、光线、色彩、材质和质量词。`;
  try {
    const response = await fetch(`${config.baseUrl.replace(/\/$/, '')}/chat/completions`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.apiKey}` }, body: JSON.stringify({ model: config.model, temperature: 0.25, max_tokens: 4000, messages: [{ role: 'system', content: instruction }, { role: 'user', content: [{ type: 'text', text: '\u8bf7\u5f00\u59cb\u5206\u6790\u8fd9\u5f20\u56fe\u7247\u3002' }, { type: 'image_url', image_url: { url: breakdownImageData } }] }] }) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json(); lastBreakdown = data.choices?.[0]?.message?.content?.trim() || '\u63a5\u53e3\u6ca1\u6709\u8fd4\u56de\u5206\u6790\u7ed3\u679c'; $('#breakdownResult').textContent = lastBreakdown; $('#breakdownCount').textContent = `${lastBreakdown.length} \u5b57`; showToast('\u56fe\u7247\u62c6\u89e3\u5b8c\u6210');
  } catch (error) { showToast(`\u5206\u6790\u5931\u8d25\uff1a${error.message}`); }
  finally { button.disabled = false; button.innerHTML = '\u2726 <span>\u5f00\u59cb\u62c6\u89e3\u56fe\u7247</span>'; }
}
$('#analyzeImageButton').addEventListener('click', analyzeImage);
$('#copyBreakdownButton').addEventListener('click', async () => { if (!lastBreakdown) return showToast('\u8fd8\u6ca1\u6709\u53ef\u590d\u5236\u7684\u62c6\u89e3\u7ed3\u679c'); await navigator.clipboard.writeText(lastBreakdown); showToast('\u62c6\u89e3\u7ed3\u679c\u5df2\u590d\u5236'); });
$('#useBreakdownButton').addEventListener('click', () => { if (!lastBreakdown) return showToast('\u8bf7\u5148\u5b8c\u6210\u56fe\u7247\u62c6\u89e3'); const finalPrompt = lastBreakdown.split('FINAL IMAGE PROMPT:').pop().trim(); $('#imageSubject').value = finalPrompt || lastBreakdown; buildImagePrompt(); $('#imageSubject').scrollIntoView({ behavior: 'smooth', block: 'center' }); showToast('\u62c6\u89e3\u63d0\u793a\u8bcd\u5df2\u5e26\u5165\u751f\u56fe'); });
buildImagePrompt();

async function optimize() {
  const idea = rawInput.value.trim();
  if (!idea) return showToast('\u8bf7\u5148\u5199\u4e0b\u4e00\u70b9\u60f3\u6cd5\u5427');
  const config = getConfigs().text;
  if (!config.apiKey || !config.baseUrl || !config.model) { settingsDialog.showModal(); showToast('\u8bf7\u5148\u8865\u5168\u6587\u672c\u6a21\u578b\u63a5\u53e3\u8bbe\u7f6e'); return; }
  const button = $('#optimizeButton'); button.disabled = true; button.innerHTML = '\u2026 <span>\u6b63\u5728\u4f18\u5316</span>';
  try {
    const endpoint = `${config.baseUrl.replace(/\/$/, '')}/chat/completions`;
    const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.apiKey}` }, body: JSON.stringify({ model: config.model, temperature: selectedMode === 'creative' ? 0.9 : 0.45, messages: [{ role: 'system', content: `\u4f60\u662f\u4e13\u4e1a\u7684\u63d0\u793a\u8bcd\u5de5\u7a0b\u5e08\u3002\u8bf7\u7528${getModeLabel()}\u4f18\u5316\u7528\u6237\u8f93\u5165\uff0c\u53ea\u8f93\u51fa\u4f18\u5316\u540e\u7684\u63d0\u793a\u8bcd\uff0c\u4e0d\u8981\u89e3\u91ca\u8fc7\u7a0b\u3002` }, { role: 'user', content: idea }] }) });
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
