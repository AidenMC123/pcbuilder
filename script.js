const STORAGE_KEY = 'buildvault-builds-v1';
let builds = [];
let activeBuildId = null;
let componentSort = 'default';
const $ = selector => document.querySelector(selector);
const uid = () => crypto.randomUUID ? crypto.randomUUID() : `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
const money = value => new Intl.NumberFormat('nb-NO', { style: 'currency', currency: 'NOK', maximumFractionDigits: 0 }).format(Number(value) || 0);
const escapeHTML = value => String(value || '').replace(/[&<>'"]/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[char]));

function totalPrice(build) { return (build.components || []).reduce((sum, component) => sum + (Number(component.price) || 0), 0); }
function save() { localStorage.setItem(STORAGE_KEY, JSON.stringify(builds)); render(); }
function load() { try { builds = JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; } catch { builds = []; } render(); }
function fallbackImage() { return '<div class="image-fallback">🖥</div>'; }
function imageContent(src) { return src ? `<img src="${escapeHTML(src)}" alt="" onerror="this.style.display='none'">` : fallbackImage(); }

function toast(message) {
  const item = document.createElement('div');
  item.className = 'toast'; item.textContent = message; $('#toastContainer').append(item);
  setTimeout(() => { item.classList.add('out'); setTimeout(() => item.remove(), 300); }, 2500);
}

function render() {
  const query = $('#searchInput').value.trim().toLowerCase();
  const sort = $('#sortSelect').value;
  const filtered = builds.filter(build => [build.title, build.description, ...(build.components || []).map(c => `${c.name} ${c.category}`)].join(' ').toLowerCase().includes(query));
  filtered.sort((a, b) => {
    if (sort === 'title') return a.title.localeCompare(b.title);
    if (sort === 'price-high') return totalPrice(b) - totalPrice(a);
    if (sort === 'price-low') return totalPrice(a) - totalPrice(b);
    return new Date(b.updatedAt) - new Date(a.updatedAt);
  });
  $('#buildCount').textContent = builds.length;
  $('#totalValue').textContent = money(builds.reduce((sum, build) => sum + totalPrice(build), 0));
  $('#buildGrid').innerHTML = filtered.map((build, index) => `<article class="build-card" style="animation-delay:${index * 40}ms" data-id="${build.id}">
    <div class="build-image">${imageContent(build.image)}</div><button class="fav-button ${build.favorite ? 'active' : ''}" data-fav="${build.id}" title="Toggle favorite">★</button>
    <div class="build-info"><h3>${escapeHTML(build.title)}</h3><p>${escapeHTML(build.description || 'No description added')}</p><div class="card-bottom"><span>${money(totalPrice(build))}</span><span class="part-count">${(build.components || []).length} parts</span></div></div>
  </article>`).join('');
  $('#buildGrid').hidden = filtered.length === 0;
  $('#emptyState').hidden = filtered.length > 0;
}

function openBuildForm(build) {
  $('#buildForm').reset();
  $('#buildId').value = build?.id || '';
  $('#image').dataset.current = build?.image || '';
  $('#modalKicker').textContent = build ? 'EDIT BUILD' : 'NEW BUILD';
  $('#modalTitle').textContent = build ? 'Edit build' : 'Create a build';
  ['title', 'description', 'notes'].forEach(key => $(`#${key}`).value = build?.[key] || '');
  $('#favorite').checked = !!build?.favorite;
  previewImage(); $('#buildModal').showModal();
}
function previewImage() {
  const input = $('#image'); const file = input.files?.[0]; const src = file ? URL.createObjectURL(file) : input.dataset.current;
  $('#imagePreview').innerHTML = src ? `<img src="${escapeHTML(src)}" alt="Cover preview">` : '<span>🖥</span><small>Cover image preview</small>';
}
function readImage(file) {
  return new Promise((resolve, reject) => {
    if (!file) return resolve('');
    if (file.size > 4 * 1024 * 1024) return reject(new Error('Please choose an image smaller than 4 MB.'));
    const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file);
  });
}

function sortedComponents(build) {
  const items = [...(build.components || [])];
  if (componentSort === 'name') items.sort((a, b) => a.name.localeCompare(b.name));
  if (componentSort === 'price-low') items.sort((a, b) => (Number(a.price) || 0) - (Number(b.price) || 0));
  if (componentSort === 'price-high') items.sort((a, b) => (Number(b.price) || 0) - (Number(a.price) || 0));
  return items;
}
function renderComponents(build) {
  $('#componentCount').textContent = (build.components || []).length;
  const components = sortedComponents(build);
  $('#componentsList').innerHTML = components.length ? components.map(component => `<div class="component-row">
    <span class="category-pill">${escapeHTML(component.category)}</span>
    <div><div class="component-name">${escapeHTML(component.name)}</div>${component.details ? `<div class="component-details">${escapeHTML(component.details)}</div>` : ''}${component.link ? `<a class="component-link" href="${escapeHTML(component.link)}" target="_blank" rel="noopener noreferrer">View product ↗</a>` : ''}</div>
    <span class="component-price">${money(component.price)}</span><div><button class="row-button" data-edit-component="${component.id}" title="Edit">✎</button><button class="row-button" data-delete-component="${component.id}" title="Delete">×</button></div>
  </div>`).join('') : '<p class="component-details">No components yet. Add your first part above.</p>';
}
function openDetail(id) {
  activeBuildId = id; const build = builds.find(item => item.id === id); if (!build) return;
  $('#detailTitle').textContent = build.title; $('#detailCover').innerHTML = imageContent(build.image);
  const coverImage = $('#detailCover img'); if (coverImage) coverImage.style.cssText = 'width:100%;height:100%;object-fit:contain;background:#fff';
  $('#detailDescription').textContent = build.description || 'No description added.'; $('#detailPrice').textContent = money(totalPrice(build));
  $('#detailNotes').textContent = build.notes || 'No notes yet.'; $('#notesSection').hidden = !build.notes;
  $('#componentSort').value = componentSort; renderComponents(build); $('#detailModal').showModal();
}
function openComponentForm(component) {
  $('#componentForm').reset(); $('#componentId').value = component?.id || '';
  $('#componentKicker').textContent = component ? 'EDIT COMPONENT' : 'NEW COMPONENT'; $('#componentModalTitle').textContent = component ? 'Edit component' : 'Add component';
  ['category', 'name', 'details', 'price', 'link'].forEach(key => $(`#component${key[0].toUpperCase()}${key.slice(1)}`).value = component?.[key] ?? '');
  $('#componentModal').showModal();
}

$('#newBuildBtn').onclick = () => openBuildForm();
$('.empty-create').onclick = () => openBuildForm();
$('#searchInput').oninput = render; $('#sortSelect').onchange = render; $('#image').onchange = previewImage;
$('#componentSort').onchange = event => { componentSort = event.target.value; const build = builds.find(item => item.id === activeBuildId); if (build) renderComponents(build); };

document.addEventListener('click', event => {
  const close = event.target.closest('[data-close]'); if (close) { $(`#${close.dataset.close}`).close(); return; }
  const favorite = event.target.closest('[data-fav]');
  if (favorite) { event.stopPropagation(); const build = builds.find(item => item.id === favorite.dataset.fav); build.favorite = !build.favorite; build.updatedAt = new Date().toISOString(); save(); toast(build.favorite ? 'Added to favorites' : 'Removed from favorites'); return; }
  const card = event.target.closest('.build-card'); if (card) { openDetail(card.dataset.id); return; }
  const edit = event.target.closest('[data-edit-component]'); if (edit) { const build = builds.find(item => item.id === activeBuildId); openComponentForm(build.components.find(component => component.id === edit.dataset.editComponent)); return; }
  const remove = event.target.closest('[data-delete-component]');
  if (remove && confirm('Delete this component?')) { const build = builds.find(item => item.id === activeBuildId); build.components = build.components.filter(component => component.id !== remove.dataset.deleteComponent); build.updatedAt = new Date().toISOString(); save(); openDetail(build.id); toast('Component deleted'); }
});

$('#buildForm').onsubmit = async event => {
  event.preventDefault(); const id = $('#buildId').value; const existing = builds.find(build => build.id === id); let image = $('#image').dataset.current || '';
  try { if ($('#image').files[0]) image = await readImage($('#image').files[0]); } catch (error) { toast(error.message); return; }
  const build = { id: id || uid(), title: $('#title').value.trim(), description: $('#description').value.trim(), image, notes: $('#notes').value.trim(), favorite: $('#favorite').checked, components: existing?.components || [], createdAt: existing?.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString() };
  if (existing) Object.assign(existing, build); else builds.push(build); save(); $('#buildModal').close(); toast(existing ? 'Build updated' : 'Build created'); if (existing && activeBuildId === id) openDetail(id);
};
$('#editBuildBtn').onclick = () => { const build = builds.find(item => item.id === activeBuildId); $('#detailModal').close(); openBuildForm(build); };
$('#addComponentBtn').onclick = () => openComponentForm();
$('#componentForm').onsubmit = event => {
  event.preventDefault(); const build = builds.find(item => item.id === activeBuildId); const id = $('#componentId').value; const existing = build.components.find(component => component.id === id);
  const component = { id: id || uid(), category: $('#componentCategory').value.trim(), name: $('#componentName').value.trim(), details: $('#componentDetails').value.trim(), link: $('#componentLink').value.trim(), price: Math.max(0, Number($('#componentPrice').value) || 0) };
  if (existing) Object.assign(existing, component); else build.components.push(component); build.updatedAt = new Date().toISOString(); save(); $('#componentModal').close(); openDetail(build.id); toast(existing ? 'Component updated' : 'Component added');
};
$('#deleteBuildBtn').onclick = () => { const build = builds.find(item => item.id === activeBuildId); if (confirm(`Delete “${build.title}”? This cannot be undone.`)) { builds = builds.filter(item => item.id !== activeBuildId); save(); $('#detailModal').close(); toast('Build deleted'); } };
$('#exportBtn').onclick = () => { const blob = new Blob([JSON.stringify({ app: 'BuildVault', version: 1, builds }, null, 2)], { type: 'application/json' }); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = 'buildvault-backup.json'; link.click(); URL.revokeObjectURL(link.href); toast('Builds exported'); };
$('#importBtn').onclick = () => $('#importFile').click();
$('#importFile').onchange = async event => { const file = event.target.files[0]; if (!file) return; try { const parsed = JSON.parse(await file.text()); const incoming = Array.isArray(parsed) ? parsed : parsed.builds; if (!Array.isArray(incoming)) throw new Error(); if (!confirm(`Import ${incoming.length} build(s)? Your current builds will be kept.`)) return; const known = new Set(builds.map(build => build.id)); incoming.forEach(build => { if (!build?.title) return; build.id = known.has(build.id) ? uid() : (build.id || uid()); build.components = Array.isArray(build.components) ? build.components : []; build.updatedAt = build.updatedAt || new Date().toISOString(); builds.push(build); }); save(); toast('Import complete'); } catch { toast('That file is not a valid BuildVault export'); } finally { event.target.value = ''; } };

load();
