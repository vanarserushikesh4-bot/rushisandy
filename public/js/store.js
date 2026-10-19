(() => {
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const money = (n) => "₹ " + Number(n || 0).toLocaleString("en-IN");
const ICON = {
  cpu: '<svg viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="2"/><path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4"/></svg>',
  ram: '<svg viewBox="0 0 24 24"><rect x="2" y="7" width="20" height="9" rx="1"/><path d="M6 16v3M10 16v3M14 16v3M18 16v3M6 10v3M10 10v3M14 10v3M18 10v3"/></svg>',
  ssd: '<svg viewBox="0 0 24 24"><ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/></svg>',
  display: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="12" rx="1.5"/><path d="M8 20h8M12 16v4"/></svg>',
};

let store = { products: [], categories: [], banners: [], settings: {} };
let filter = "all", query = "", sortBy = "featured", current = null;
let cart = [];
try { cart = JSON.parse(localStorage.getItem("stratum_cart") || "[]"); } catch { cart = []; }

function toast(msg) {
  const t = $("#toast"); t.textContent = msg; t.classList.add("show");
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove("show"), 2400);
}
function waUrl(msg) { return `https://wa.me/${store.settings.whatsapp || ""}?text=${encodeURIComponent(msg)}`; }
function saveCart() {
  try { localStorage.setItem("stratum_cart", JSON.stringify(cart)); } catch {}
  $("#cartCount").textContent = cart.reduce((s, i) => s + i.qty, 0);
}
const product = (id) => store.products.find(p => p.id === id);
const img = (p) => (p.images && p.images[0]) || "/img/placeholder.svg";

async function load() {
  const r = await fetch("/api/store");
  store = await r.json();
  cart = cart.filter(i => product(i.id));
  renderShell(); renderChips(); renderGrid(); renderCats(); saveCart();
}

function renderShell() {
  const s = store.settings;
  document.title = `${s.storeName || "STRATUM IT INDIA"} | Refurbished Laptops`;
  if (s.logo) $("#logo").innerHTML = `<img class="logo-img" src="${esc(s.logo)}" alt="${esc(s.storeName)}">`;
  else {
    const [first, ...rest] = (s.storeName || "STRATUM IT INDIA").split(" ");
    $("#storeName").textContent = first; $("#storeSub").textContent = rest.join(" ");
  }
  $("#footName").textContent = s.storeName || "";
  $("#footInfo").innerHTML = [s.phone && `📞 ${esc(s.phone)}`, s.email && `✉ ${esc(s.email)}`, s.address && esc(s.address)].filter(Boolean).join("<br>");
  $("#year").textContent = new Date().getFullYear();
  $("#banners").innerHTML = store.banners.filter(b => b.image)
    .map(b => `<a href="${esc(b.link || "#laptops")}"><img src="${esc(b.image)}" alt="Offer banner"></a>`).join("");
}

function renderChips() {
  const used = new Set(store.products.flatMap(p => p.tags || []));
  const list = [{ slug: "all", name: "All" }, ...store.categories.filter(c => used.has(c.slug))];
  $("#chips").innerHTML = list.map(c => `<button class="chip ${filter === c.slug ? "on" : ""}" data-f="${esc(c.slug)}">${esc(c.name.replace(/ Laptops$/, ""))}</button>`).join("");
}

function visibleProducts() {
  const q = query.toLowerCase().split(/\s+/).filter(Boolean);
  let list = store.products.filter(p => (filter === "all" || (p.tags || []).includes(filter)) &&
    q.every(w => [p.name, p.brand, p.cpu, p.ram, p.storage, p.display].join(" ").toLowerCase().includes(w)));
  if (sortBy === "low") list = [...list].sort((a, b) => a.price - b.price);
  if (sortBy === "high") list = [...list].sort((a, b) => b.price - a.price);
  return list;
}

function cardHtml(p) {
  const off = p.mrp > p.price ? Math.round((1 - p.price / p.mrp) * 100) : 0;
  const out = p.stock <= 0;
  return `<article class="card">
    <div class="card-img" data-open="${p.id}">
      <img src="${esc(img(p))}" alt="${esc(p.name)}" loading="lazy">
      ${out ? '<span class="badge out">Sold out</span>' : off ? `<span class="badge">${off}% OFF</span>` : ""}
    </div>
    <div class="card-body">
      <h3 data-open="${p.id}">${esc(p.name)}</h3>
      <ul class="specs">
        ${p.cpu ? `<li>${ICON.cpu}${esc(p.cpu)}</li>` : ""}
        ${p.ram ? `<li>${ICON.ram}${esc(p.ram)}</li>` : ""}
        ${p.storage ? `<li>${ICON.ssd}${esc(p.storage)}</li>` : ""}
        ${p.display ? `<li>${ICON.display}${esc(p.display)}</li>` : ""}
      </ul>
      <div class="card-foot"><div><span class="price">${money(p.price)}</span>${p.mrp > p.price ? `<s class="mrp">${money(p.mrp)}</s>` : ""}</div></div>
      <div class="card-btns">
        <button class="btn" data-open="${p.id}">View Details</button>
        <button class="btn cart-ico" data-add="${p.id}" ${out ? "disabled" : ""} aria-label="Add ${esc(p.name)} to cart" title="${out ? "Sold out" : "Add to cart"}"><svg viewBox="0 0 24 24"><path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.5L21 8H6.2"/><path d="M13 9v5M10.5 11.5h5"/></svg></button>
      </div>
    </div></article>`;
}
function renderGrid() {
  const list = visibleProducts();
  $("#grid").innerHTML = list.map(cardHtml).join("");
  $("#empty").hidden = list.length > 0;
}
function renderCats() {
  $("#cats").innerHTML = store.categories.map(c => `<a class="cat" href="#laptops" data-cat="${esc(c.slug)}">
    ${c.image ? `<img src="${esc(c.image)}" alt="" loading="lazy">` : ""}
    <b>${esc(c.name)}</b><small>${esc(c.subtitle)}</small><span>View Collection →</span></a>`).join("");
}

// ---------- product modal ----------
function openModal(id) { const m = $("#" + id); m.hidden = false; document.body.style.overflow = "hidden"; }
function closeModals() { $$(".overlay").forEach(o => o.hidden = true); document.body.style.overflow = ""; }

function openProduct(id) {
  const p = product(id); if (!p) return;
  current = p;
  const images = p.images && p.images.length ? p.images : [img(p)];
  $("#pmImg").src = images[0]; $("#pmImg").alt = p.name;
  $("#pmThumbs").innerHTML = images.length > 1 ? images.map((u, i) => `<button class="${i ? "" : "on"}" data-src="${esc(u)}"><img src="${esc(u)}" alt=""></button>`).join("") : "";
  $("#pmBrand").textContent = p.brand || "";
  $("#pmTitle").textContent = p.name;
  $("#pmPrice").textContent = money(p.price);
  $("#pmMrp").textContent = p.mrp > p.price ? money(p.mrp) : "";
  $("#pmOff").textContent = p.mrp > p.price ? `${Math.round((1 - p.price / p.mrp) * 100)}% off` : "";
  const st = $("#pmStock");
  st.className = "stock" + (p.stock <= 0 ? " none" : p.stock <= 2 ? " low" : "");
  st.textContent = p.stock <= 0 ? "Out of stock" : p.stock <= 2 ? `Only ${p.stock} left` : "In stock";
  const rows = [["Processor", p.cpu], ["Memory", p.ram], ["Storage", p.storage], ["Display", p.display], ["Condition", p.condition], ["Battery", p.battery], ["Warranty", p.warranty]];
  $("#pmSpecs").innerHTML = rows.filter(r => r[1]).map(r => `<tr><td>${r[0]}</td><td>${esc(r[1])}</td></tr>`).join("");
  $("#pmDesc").textContent = p.description || "";
  $("#pmQty").value = 1;
  $("#pmAdd").disabled = $("#pmBuy").disabled = p.stock <= 0;
  $("#pmWa").href = waUrl(`Hello ${store.settings.storeName}, I have a question about ${p.name} (${money(p.price)}).`);
  $("#pmWa").target = "_blank";
  openModal("productModal");
}

// ---------- cart ----------
function addToCart(id, qty = 1) {
  const p = product(id); if (!p || p.stock <= 0) return false;
  const line = cart.find(i => i.id === id);
  const want = (line ? line.qty : 0) + qty;
  if (want > p.stock) { toast(`Only ${p.stock} available`); return false; }
  line ? line.qty = want : cart.push({ id, qty });
  saveCart(); toast(`${p.name} added to cart`); return true;
}
function cartTotal() { return cart.reduce((s, i) => s + (product(i.id)?.price || 0) * i.qty, 0); }
function renderCart() {
  $("#cartItems").innerHTML = cart.length ? cart.map(i => { const p = product(i.id); return `
    <div class="ci"><img src="${esc(img(p))}" alt="">
      <div><b>${esc(p.name)}</b><small>${money(p.price)}</small><br><button class="rm" data-rm="${p.id}">Remove</button></div>
      <div class="qty"><button data-cq="${p.id}" data-d="-1" aria-label="Less">−</button><input value="${i.qty}" readonly aria-label="Quantity"><button data-cq="${p.id}" data-d="1" aria-label="More">+</button></div>
    </div>`; }).join("") : `<p class="cart-empty">Your cart is empty.<br><br><button class="btn" data-close>Browse laptops</button></p>`;
  $("#cartTotal").textContent = money(cartTotal());
  $("#checkoutBtn").disabled = !cart.length;
}
function openCart() { renderCart(); openModal("cartDrawer"); }

// ---------- checkout ----------
function openCheckout() {
  if (!cart.length) return;
  closeModals();
  $("#coFormWrap").hidden = false; $("#coDone").hidden = true; $("#coErr").hidden = true;
  $("#coSummary").innerHTML = cart.map(i => { const p = product(i.id); return `<div><span>${esc(p.name)} × ${i.qty}</span><span>${money(p.price * i.qty)}</span></div>`; }).join("")
    + `<div class="tot"><span>Total</span><span>${money(cartTotal())}</span></div>`;
  try { const saved = JSON.parse(localStorage.getItem("stratum_customer") || "{}"); for (const k in saved) { const f = $("#coForm").elements[k]; if (f && f.type !== "radio") f.value = saved[k]; } } catch {}
  openModal("checkoutModal");
}
async function submitOrder(e) {
  e.preventDefault();
  const f = new FormData(e.target);
  const customer = Object.fromEntries(["name", "phone", "email", "address", "city", "state", "pincode"].map(k => [k, (f.get(k) || "").trim()]));
  const err = $("#coErr");
  const fail = (m) => { err.textContent = m; err.hidden = false; };
  if (!customer.name) return fail("Please enter your name.");
  if (customer.phone.replace(/\D/g, "").length < 10) return fail("Please enter a valid 10-digit phone number.");
  if (!customer.address) return fail("Please enter your delivery address.");
  if (!/^\d{6}$/.test(customer.pincode)) return fail("Please enter a 6-digit pincode.");
  err.hidden = true;
  const btn = $("#coSubmit"); btn.disabled = true; btn.textContent = "Placing order…";
  try {
    const r = await fetch("/api/orders", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customer, items: cart, payment: f.get("payment"), note: f.get("note") }) });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || "Could not place order");
    try { localStorage.setItem("stratum_customer", JSON.stringify(customer)); } catch {}
    const o = data.order;
    cart = []; saveCart();
    $("#doneId").textContent = o.id;
    const lines = o.items.map(i => `• ${i.name} × ${i.qty} = ${money(i.price * i.qty)}`).join("\n");
    $("#doneWa").href = waUrl(`Hello ${store.settings.storeName}, I placed an order.\nOrder ID: ${o.id}\n${lines}\nTotal: ${money(o.total)}\nPayment: ${o.payment}\nName: ${o.customer.name}\nPhone: ${o.customer.phone}\nAddress: ${o.customer.address}, ${o.customer.city} ${o.customer.pincode}`);
    $("#coFormWrap").hidden = true; $("#coDone").hidden = false;
    load();
  } catch (ex) { fail(ex.message); }
  finally { btn.disabled = false; btn.textContent = "Confirm Order"; }
}

// ---------- events ----------
document.addEventListener("click", (e) => {
  const t = e.target;
  const open = t.closest("[data-open]"); if (open) return openProduct(open.dataset.open);
  const add = t.closest("[data-add]"); if (add) return addToCart(add.dataset.add);
  const chip = t.closest("[data-f]"); if (chip) { filter = chip.dataset.f; renderChips(); renderGrid(); return; }
  const cat = t.closest("[data-cat]"); if (cat) { filter = cat.dataset.cat; renderChips(); renderGrid(); return; }
  const thumb = t.closest("[data-src]"); if (thumb) { $("#pmImg").src = thumb.dataset.src; $$("#pmThumbs button").forEach(b => b.classList.toggle("on", b === thumb)); return; }
  const cq = t.closest("[data-cq]");
  if (cq) { const line = cart.find(i => i.id === cq.dataset.cq); const p = product(line.id); const n = line.qty + Number(cq.dataset.d);
    if (n > p.stock) toast(`Only ${p.stock} available`); else if (n >= 1) line.qty = n; saveCart(); renderCart(); return; }
  const rm = t.closest("[data-rm]"); if (rm) { cart = cart.filter(i => i.id !== rm.dataset.rm); saveCart(); renderCart(); return; }
  const wa = t.closest(".wa-link"); if (wa) { e.preventDefault(); window.open(waUrl(wa.dataset.msg), "_blank", "noopener"); return; }
  if (t.closest("[data-close]") || t.classList.contains("overlay")) closeModals();
});
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModals(); });
$$("[data-q]").forEach(b => b.addEventListener("click", () => {
  const q = $("#pmQty"); q.value = Math.max(1, Math.min(current?.stock || 1, (parseInt(q.value) || 1) + Number(b.dataset.q)));
}));
$("#pmAdd").addEventListener("click", () => { if (addToCart(current.id, parseInt($("#pmQty").value) || 1)) closeModals(); });
$("#pmBuy").addEventListener("click", () => {
  const line = cart.find(i => i.id === current.id);
  if (line || addToCart(current.id, parseInt($("#pmQty").value) || 1)) openCheckout();
});
$("#cartBtn").addEventListener("click", openCart);
$("#checkoutBtn").addEventListener("click", openCheckout);
$("#coForm").addEventListener("submit", submitOrder);
$("#sort").addEventListener("change", (e) => { sortBy = e.target.value; renderGrid(); });
$("#searchForm").addEventListener("submit", (e) => { e.preventDefault(); query = $("#searchInput").value; filter = "all"; renderChips(); renderGrid(); $("#laptops").scrollIntoView(); });
$("#searchInput").addEventListener("input", (e) => { query = e.target.value; renderGrid(); });
$("#clearFilter").addEventListener("click", (e) => { e.preventDefault(); filter = "all"; query = ""; $("#searchInput").value = ""; renderChips(); renderGrid(); });
$("#trackForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = new FormData(e.target), box = $("#trackResult");
  const r = await fetch(`/api/orders/track?id=${encodeURIComponent(f.get("id").trim())}&phone=${encodeURIComponent(f.get("phone"))}`);
  const d = await r.json(); box.hidden = false;
  box.innerHTML = r.ok ? `<b>Order ${esc(d.id)}</b> — <span class="status-pill">${esc(d.status)}</span><br>
    Placed on ${new Date(d.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })} • Total ${money(d.total)}<br>
    ${d.items.map(i => `${esc(i.name)} × ${i.qty}`).join(", ")}` : esc(d.error);
});

load().catch(() => toast("Could not load products. Please refresh."));
})();
