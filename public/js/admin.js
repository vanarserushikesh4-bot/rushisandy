(() => {
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const money = (n) => "₹ " + Number(n || 0).toLocaleString("en-IN");
let db = null, editing = null, photos = [];

function toast(m) { const t = $("#toast"); t.textContent = m; t.classList.add("show"); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove("show"), 2600); }
async function api(url, opts = {}) {
  const r = await fetch(url, { headers: opts.body && !(opts.body instanceof FormData) ? { "Content-Type": "application/json" } : {}, ...opts,
    body: opts.body && !(opts.body instanceof FormData) ? JSON.stringify(opts.body) : opts.body });
  const d = await r.json().catch(() => ({}));
  if (r.status === 401 && !url.endsWith("/login")) { showLogin(); throw new Error("Session expired — please log in again"); }
  if (!r.ok) throw new Error(d.error || "Something went wrong");
  return d;
}
async function uploadFiles(files) {
  const fd = new FormData(); [...files].forEach(f => fd.append("photos", f));
  return (await api("/api/admin/upload", { method: "POST", body: fd })).urls;
}
function pickOne() {
  return new Promise((res) => {
    const inp = $("#singleUpload"); inp.value = "";
    inp.onchange = async () => { if (!inp.files[0]) return res(null);
      try { toast("Uploading…"); const [u] = await uploadFiles(inp.files); toast("Photo uploaded — remember to Save"); res(u); }
      catch (e) { toast(e.message); res(null); } };
    inp.click();
  });
}

// ---------- auth ----------
function showLogin() { $("#app").hidden = true; $("#login").hidden = false; }
$("#loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  try { await api("/api/admin/login", { method: "POST", body: { password: e.target.password.value } }); e.target.reset(); $("#loginErr").hidden = true; await boot(); }
  catch (ex) { $("#loginErr").textContent = ex.message; $("#loginErr").hidden = false; }
});
$("#logout").addEventListener("click", async () => { await fetch("/api/admin/logout", { method: "POST" }); showLogin(); });

async function boot() {
  try { db = await api("/api/admin/data"); } catch { return showLogin(); }
  $("#login").hidden = true; $("#app").hidden = false;
  $("#pwWarn").hidden = !db.admin.usingDefault;
  renderOrders(); renderProducts(); renderBanners(); renderCats(); fillSettings();
}

// ---------- tabs ----------
function goto(tab) {
  $$("#tabs button").forEach(b => b.classList.toggle("on", b.dataset.tab === tab));
  $$("[data-panel]").forEach(p => p.hidden = p.dataset.panel !== tab);
}
$("#tabs").addEventListener("click", (e) => { const b = e.target.closest("[data-tab]"); if (b) goto(b.dataset.tab); });
document.addEventListener("click", (e) => { const g = e.target.closest("[data-goto]"); if (g) { e.preventDefault(); goto(g.dataset.goto); } });

// ---------- orders ----------
const STATUSES = ["New", "Confirmed", "Shipped", "Delivered", "Cancelled"];
function renderOrders() {
  const f = $("#orderFilter").value;
  const list = db.orders.filter(o => !f || o.status === f);
  const n = db.orders.filter(o => o.status === "New").length;
  $("#newCount").textContent = n || "";
  $("#orders").innerHTML = list.length ? list.map(o => {
    const c = o.customer, phone10 = c.phone.replace(/\D/g, "").slice(-10);
    return `<div class="order st-${o.status}">
      <div><h4>${esc(c.name)}</h4>
        <small>#${esc(o.id)} • ${new Date(o.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</small><br>
        📞 <a href="tel:${esc(c.phone)}">${esc(c.phone)}</a>${c.email ? ` • ${esc(c.email)}` : ""}<br>
        📍 ${esc(c.address)}${c.city ? ", " + esc(c.city) : ""}${c.state ? ", " + esc(c.state) : ""} – ${esc(c.pincode)}<br>
        💳 ${esc(o.payment)}${o.note ? `<br>📝 ${esc(o.note)}` : ""}</div>
      <div class="items">${o.items.map(i => `<div><span>${esc(i.name)} × ${i.qty}</span><span>${money(i.price * i.qty)}</span></div>`).join("")}
        <div class="tot"><span>Total</span><span>${money(o.total)}</span></div></div>
      <div class="order-side">
        <select data-status="${o.id}">${STATUSES.map(s => `<option ${s === o.status ? "selected" : ""}>${s}</option>`).join("")}</select>
        <a class="btn sm" target="_blank" rel="noopener" href="https://wa.me/91${phone10}?text=${encodeURIComponent(`Hello ${c.name}, thank you for your order #${o.id} with ${db.settings.storeName}. `)}">WhatsApp customer</a>
      </div></div>`;
  }).join("") : `<div class="empty">No orders yet. When a customer orders, it will show here.</div>`;
}
$("#orderFilter").addEventListener("change", renderOrders);
$("#orders").addEventListener("change", async (e) => {
  const s = e.target.closest("[data-status]"); if (!s) return;
  if (s.value === "Cancelled" && !confirm("Cancel this order? The stock will be added back.")) return renderOrders();
  try { const o = await api(`/api/admin/orders/${s.dataset.status}`, { method: "PUT", body: { status: s.value } });
    Object.assign(db.orders.find(x => x.id === o.id), o); db = await api("/api/admin/data"); renderOrders(); renderProducts(); toast(`Order marked ${o.status}`); }
  catch (ex) { toast(ex.message); }
});

// ---------- products ----------
function renderProducts() {
  $("#products").innerHTML = db.products.map(p => `<div class="pitem">
    <img src="${esc(p.images[0] || "/img/placeholder.svg")}" alt="">
    <div><b>${esc(p.name)}</b>
      <span class="price">${money(p.price)}</span>${p.mrp > p.price ? `<span class="off">${Math.round((1 - p.price / p.mrp) * 100)}% off</span>` : ""}
      <div class="meta">${p.images.length} photo${p.images.length === 1 ? "" : "s"} • Stock: ${p.stock}${p.visible === false ? " • <b style='display:inline;color:#c2410c'>Hidden</b>" : ""}</div></div>
    <div class="row"><button class="btn sm" data-edit="${p.id}">Edit / Change photo</button></div></div>`).join("")
    || `<div class="empty">No laptops yet. Click “+ Add laptop”.</div>`;
}
$("#products").addEventListener("click", (e) => { const b = e.target.closest("[data-edit]"); if (b) openEditor(db.products.find(p => p.id === b.dataset.edit)); });
$("#newProduct").addEventListener("click", () => openEditor(null));

function openEditor(p) {
  editing = p;
  const f = $("#productForm");
  f.reset();
  const d = p || { name: "", brand: "", price: "", mrp: "", stock: 1, cpu: "", ram: "", storage: "", display: "", condition: "Refurbished – quality tested", warranty: "Warranty support", battery: "", description: "", tags: [], visible: true, images: [] };
  ["name", "brand", "price", "mrp", "stock", "cpu", "ram", "storage", "display", "condition", "warranty", "battery", "description"].forEach(k => f.elements[k].value = d[k] ?? "");
  if (!d.mrp) f.elements.mrp.value = "";
  f.elements.visible.checked = d.visible !== false;
  $("#tagBoxes").innerHTML = db.categories.map(c => `<label><input type="checkbox" value="${esc(c.slug)}" ${(d.tags || []).includes(c.slug) ? "checked" : ""}> ${esc(c.name)}</label>`).join("");
  photos = [...(d.images || [])];
  renderPhotos();
  $("#edTitle").textContent = p ? "Edit laptop" : "Add a new laptop";
  $("#delProduct").hidden = !p;
  $("#editor").hidden = false; document.body.style.overflow = "hidden";
}
function closeEditor() { $("#editor").hidden = true; document.body.style.overflow = ""; }
function renderPhotos() {
  $("#photos").innerHTML = photos.map((u, i) => `<div class="ph ${i ? "" : "first"}">
    ${i ? "" : '<span class="tag">Main photo</span>'}<img src="${esc(u)}" alt="">
    <div class="ctl"><button type="button" data-mv="${i}" data-d="-1" title="Move left" ${i ? "" : "disabled"}>◀</button>
    <button type="button" data-mv="${i}" data-d="1" title="Move right" ${i < photos.length - 1 ? "" : "disabled"}>▶</button>
    <button type="button" class="del" data-del="${i}" title="Remove">🗑</button></div></div>`).join("");
}
$("#photos").addEventListener("click", (e) => {
  const mv = e.target.closest("[data-mv]"), del = e.target.closest("[data-del]");
  if (mv) { const i = +mv.dataset.mv, j = i + +mv.dataset.d; [photos[i], photos[j]] = [photos[j], photos[i]]; renderPhotos(); }
  if (del) { photos.splice(+del.dataset.del, 1); renderPhotos(); }
});
async function addPhotos(files) {
  if (!files.length) return;
  const drop = $("#drop"); drop.classList.add("uploading"); drop.querySelector("b").textContent = "Uploading…";
  try { photos.push(...await uploadFiles(files)); renderPhotos(); toast("Photo added — click Save laptop"); }
  catch (ex) { toast(ex.message); }
  finally { drop.classList.remove("uploading"); drop.querySelector("b").textContent = "+ Add photos"; $("#photoInput").value = ""; }
}
$("#photoInput").addEventListener("change", (e) => addPhotos(e.target.files));
const drop = $("#drop");
["dragenter", "dragover"].forEach(ev => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add("over"); }));
["dragleave", "drop"].forEach(ev => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove("over"); }));
drop.addEventListener("drop", (e) => addPhotos(e.dataTransfer.files));

$("#productForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = e.target, body = {};
  ["name", "brand", "price", "mrp", "stock", "cpu", "ram", "storage", "display", "condition", "warranty", "battery", "description"].forEach(k => body[k] = f.elements[k].value);
  body.visible = f.elements.visible.checked;
  body.tags = $$("#tagBoxes input:checked").map(i => i.value);
  body.images = photos;
  try {
    const saved = editing ? await api(`/api/admin/products/${editing.id}`, { method: "PUT", body }) : await api("/api/admin/products", { method: "POST", body });
    if (editing) db.products[db.products.findIndex(p => p.id === saved.id)] = saved; else db.products.unshift(saved);
    renderProducts(); closeEditor(); toast("Saved — the store is updated");
  } catch (ex) { toast(ex.message); }
});
$("#delProduct").addEventListener("click", async () => {
  if (!editing || !confirm(`Delete "${editing.name}"? This cannot be undone.`)) return;
  try { await api(`/api/admin/products/${editing.id}`, { method: "DELETE" }); db.products = db.products.filter(p => p.id !== editing.id); renderProducts(); closeEditor(); toast("Laptop deleted"); }
  catch (ex) { toast(ex.message); }
});
$("#editor").addEventListener("click", (e) => { if (e.target.closest("[data-close]") || e.target.id === "editor") closeEditor(); });

// ---------- banners ----------
function renderBanners() {
  $("#banners").innerHTML = db.banners.map((b, i) => `<div class="tile">
    <div class="pic">${b.image ? `<img src="${esc(b.image)}" alt="">` : ""}<button class="btn sm" data-bpic="${i}">Change photo</button></div>
    <div class="body"><label>Link when clicked<input data-blink="${i}" value="${esc(b.link)}" placeholder="#laptops"></label>
    <button class="rm" data-brm="${i}">Remove banner</button></div></div>`).join("");
}
$("#banners").addEventListener("click", async (e) => {
  const pic = e.target.closest("[data-bpic]"), rm = e.target.closest("[data-brm]");
  if (pic) { const u = await pickOne(); if (u) { db.banners[+pic.dataset.bpic].image = u; renderBanners(); } }
  if (rm && confirm("Remove this banner?")) { db.banners.splice(+rm.dataset.brm, 1); renderBanners(); }
});
$("#banners").addEventListener("input", (e) => { const l = e.target.closest("[data-blink]"); if (l) db.banners[+l.dataset.blink].link = l.value; });
$("#addBanner").addEventListener("click", async () => { const u = await pickOne(); if (u) { db.banners.push({ id: "b" + Date.now(), image: u, link: "#laptops" }); renderBanners(); } });
$("#saveBanners").addEventListener("click", async () => { try { db.banners = await api("/api/admin/banners", { method: "PUT", body: db.banners }); renderBanners(); toast("Banners saved"); } catch (ex) { toast(ex.message); } });

// ---------- categories ----------
function renderCats() {
  $("#cats").innerHTML = db.categories.map((c, i) => `<div class="tile cat">
    <div class="pic">${c.image ? `<img src="${esc(c.image)}" alt="">` : ""}<button class="btn sm" data-cpic="${i}">Change photo</button></div>
    <div class="body">
      <label>Name<input data-c="${i}" data-k="name" value="${esc(c.name)}"></label>
      <label>Subtitle<input data-c="${i}" data-k="subtitle" value="${esc(c.subtitle)}"></label>
      <label>Code (no spaces)<input data-c="${i}" data-k="slug" value="${esc(c.slug)}"></label>
      <button class="rm" data-crm="${i}">Remove category</button></div></div>`).join("");
}
$("#cats").addEventListener("click", async (e) => {
  const pic = e.target.closest("[data-cpic]"), rm = e.target.closest("[data-crm]");
  if (pic) { const u = await pickOne(); if (u) { db.categories[+pic.dataset.cpic].image = u; renderCats(); } }
  if (rm && confirm("Remove this category?")) { db.categories.splice(+rm.dataset.crm, 1); renderCats(); }
});
$("#cats").addEventListener("input", (e) => { const t = e.target.closest("[data-c]"); if (t) db.categories[+t.dataset.c][t.dataset.k] = t.dataset.k === "slug" ? t.value.toLowerCase().replace(/[^a-z0-9-]/g, "") : t.value; });
$("#addCat").addEventListener("click", () => { db.categories.push({ slug: "new" + db.categories.length, name: "New category", subtitle: "", image: "" }); renderCats(); });
$("#saveCats").addEventListener("click", async () => { try { db.categories = await api("/api/admin/categories", { method: "PUT", body: db.categories }); renderCats(); toast("Categories saved"); } catch (ex) { toast(ex.message); } });

// ---------- settings ----------
function fillSettings() {
  const f = $("#settingsForm");
  ["storeName", "tagline", "whatsapp", "phone", "email", "address", "logo"].forEach(k => f.elements[k].value = db.settings[k] || "");
  $("#logoPrev").src = db.settings.logo || "";
  if (!db.settings.logo) $("#logoPrev").removeAttribute("src");
}
$("#logoBtn").addEventListener("click", async () => { const u = await pickOne(); if (u) { $("#settingsForm").elements.logo.value = u; $("#logoPrev").src = u; } });
$("#logoClear").addEventListener("click", () => { $("#settingsForm").elements.logo.value = ""; $("#logoPrev").removeAttribute("src"); });
$("#settingsForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const body = Object.fromEntries(new FormData(e.target));
  try { db.settings = await api("/api/admin/settings", { method: "PUT", body }); fillSettings(); toast("Settings saved"); } catch (ex) { toast(ex.message); }
});
$("#pwForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  try { await api("/api/admin/password", { method: "PUT", body: Object.fromEntries(new FormData(e.target)) }); e.target.reset(); $("#pwWarn").hidden = true; toast("Password changed"); }
  catch (ex) { toast(ex.message); }
});

// refresh orders every 30s so new orders appear
setInterval(async () => { if ($("#app").hidden) return; try { const d = await api("/api/admin/data"); if (d.orders.length !== db.orders.length) { db.orders = d.orders; renderOrders(); toast("New order received!"); } } catch {} }, 30000);

boot();
})();
