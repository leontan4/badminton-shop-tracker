// Locally (opening index.html directly, or via localhost) we hit the
// backend directly on its own port. Once deployed behind Caddy on a real
// domain, requests go to the same origin the page was loaded from, and
// Caddy reverse-proxies them to the backend internally.
const API = (window.location.hostname === "localhost" || window.location.protocol === "file:")
  ? "http://localhost:8000"
  : "";
let services = [];
let products = [];
let racketModels = [];
let selectedCustomerId = null;

function showToast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2500);
}

// ---------------- Customer search ----------------
let lastSearchResults = [];

async function searchCustomers() {
  const q = document.getElementById("custSearch").value;
  if (!q) { document.getElementById("custResults").innerHTML = ""; return; }
  const res = await fetch(`${API}/customers?search=${encodeURIComponent(q)}`);
  const data = await res.json();
  lastSearchResults = data;

  if (data.length === 0) {
    document.getElementById("custResults").innerHTML = `
      <div class="empty" style="padding:12px;">
        No matches
        <div style="margin-top:8px;">
          <button class="secondary" onclick="quickCreateCustomer('${q.replace(/'/g, "")}')">+ Create new customer "${q}"</button>
        </div>
      </div>
    `;
    return;
  }

  document.getElementById("custResults").innerHTML = data.map(c => `
    <div class="result-row">
      <span class="cust-info" onclick="selectCustomer(${c.id}, '${c.name.replace(/'/g,"")}', '${c.phone}')">
        ${c.name} — ${c.phone}
      </span>
      <button class="ghost" style="padding:3px 8px; font-size:11px;" onclick="startEditCustomer(${c.id})">Edit</button>
    </div>
  `).join("");
}

// Opens the new-customer form with the searched name already filled in,
// so the flow is: search, not found, click once, just add the phone.
function quickCreateCustomer(name) {
  document.getElementById("custResults").innerHTML = "";
  document.getElementById("newCustomerForm").style.display = "block";
  document.getElementById("newCustName").value = name;
  document.getElementById("newCustPhone").focus();
}

function startEditCustomer(id) {
  const c = lastSearchResults.find(c => c.id === id);
  if (!c) return;
  const localNumber = c.phone.replace(/^\+1/, "");
  document.getElementById("custResults").innerHTML = `
    <div style="padding:8px; border:1px dashed var(--court-green); border-radius:6px; background:#eaf3ee;">
      <label>Name</label>
      <input id="editName" value="${c.name.replace(/"/g,"")}">
      <label>Phone</label>
      <div class="row" style="gap:4px;">
        <span style="padding:8px 10px; background:var(--line); border-radius:6px; font-size:14px;">+1</span>
        <input id="editPhone" value="${localNumber}" style="flex:1;">
      </div>
      <label>Email (optional)</label>
      <input id="editEmail" type="email" value="${c.email ? c.email.replace(/"/g,"") : ""}">
      <label>Notes (optional)</label>
      <input id="editNotes" value="${c.notes ? c.notes.replace(/"/g,"") : ""}">
      <div class="row" style="margin-top:8px;">
        <button onclick="saveEditCustomer(${id})">Save</button>
        <button class="secondary" onclick="document.getElementById('custResults').innerHTML=''">Cancel</button>
      </div>
    </div>
  `;
}

async function saveEditCustomer(id) {
  const name = document.getElementById("editName").value;
  const phone = "+1" + document.getElementById("editPhone").value.replace(/\D/g, "");
  const email = document.getElementById("editEmail").value;
  const notes = document.getElementById("editNotes").value;
  const res = await fetch(`${API}/customers/${id}`, {
    method: "PATCH", headers: {"Content-Type": "application/json"},
    body: JSON.stringify({ name, phone, email: email || null, notes: notes || null })
  });
  if (!res.ok) {
    const err = await res.json();
    showToast(err.detail || "Could not update customer");
    return;
  }
  showToast("Customer updated");
  document.getElementById("custResults").innerHTML = "";
  document.getElementById("custSearch").value = "";
}

function selectCustomer(id, name, phone) {
  selectedCustomerId = id;
  document.getElementById("selectedCustomer").style.display = "block";
  document.getElementById("selectedCustomer").innerHTML = `Selected: <strong>${name}</strong> (${phone})`;
  document.getElementById("custResults").innerHTML = "";
  document.getElementById("custSearch").value = "";

  document.getElementById("lineItemsSection").style.display = "block";
  if (document.getElementById("itemLines").children.length === 0) addItemLine();
}

function toggleNewCustomer() {
  const f = document.getElementById("newCustomerForm");
  f.style.display = f.style.display === "none" ? "block" : "none";
}

function cancelNewCustomer() {
  document.getElementById("newCustomerForm").style.display = "none";
  document.getElementById("newCustName").value = "";
  document.getElementById("newCustPhone").value = "";
  document.getElementById("newCustEmail").value = "";
  document.getElementById("newCustNotes").value = "";
}

async function createCustomer() {
  const name = document.getElementById("newCustName").value;
  const localNumber = document.getElementById("newCustPhone").value;
  const email = document.getElementById("newCustEmail").value;
  const notes = document.getElementById("newCustNotes").value;
  if (!name || !localNumber) { showToast("Name and phone are required"); return; }
  const phone = "+1" + localNumber.replace(/\D/g, "");
  const res = await fetch(`${API}/customers`, {
    method: "POST", headers: {"Content-Type": "application/json"},
    body: JSON.stringify({ name, phone, email: email || null, notes: notes || null })
  });
  if (!res.ok) {
    const err = await res.json();
    showToast(err.detail || "Could not create customer");
    return;
  }
  const c = await res.json();
  selectCustomer(c.id, c.name, c.phone);
  document.getElementById("newCustomerForm").style.display = "none";
  document.getElementById("newCustName").value = "";
  document.getElementById("newCustPhone").value = "";
  document.getElementById("newCustEmail").value = "";
  document.getElementById("newCustNotes").value = "";
  showToast("Customer created");
}

// ---------------- Line items ----------------
function racketModelOptionsHtml() {
  const sorted = [...racketModels].sort((a, b) => a.name.localeCompare(b.name));
  return [
    `<option value="">-- racket model --</option>`,
    ...sorted.map(r => `<option value="${r.name}">${r.name}</option>`),
    `<option value="__other__">Other (type manually)</option>`
  ].join("");
}

function toggleRacketModelOther(selectEl) {
  const wrap = selectEl.closest(".racket-fields");
  const other = wrap.querySelector(".racket-model-other");
  other.style.display = selectEl.value === "__other__" ? "block" : "none";
}

function getRacketModelValue(wrap) {
  const select = wrap.querySelector(".racket-model");
  if (!select) return "";
  if (select.value === "__other__") {
    return wrap.querySelector(".racket-model-other")?.value || "";
  }
  return select.value;
}

// For pre-filling an existing order's saved racket model: if it matches a
// known catalog entry, select it directly; otherwise fall back to "Other"
// with the value shown in the side box.
function setRacketModelValue(wrap, value) {
  if (!value) return;
  const select = wrap.querySelector(".racket-model");
  const other = wrap.querySelector(".racket-model-other");
  const matches = Array.from(select.options).some(o => o.value === value);
  if (matches) {
    select.value = value;
  } else {
    select.value = "__other__";
    other.style.display = "block";
    other.value = value;
  }
}

// If this racket model name isn't in our known list yet, save it to the
// catalog so it shows up as a suggestion next time. Fire-and-forget --
// doesn't block order submission, and duplicates are harmless (just an
// unused extra catalog row) if two staff add the same new model at once.
async function persistNewRacketModel(name) {
  if (!name) return;
  const known = racketModels.some(r => r.name === name);
  if (known) return;
  const res = await fetch(`${API}/products`, {
    method: "POST", headers: {"Content-Type": "application/json"},
    body: JSON.stringify({ name, category: "racket_model", cost_to_shop: 0, price_to_customer: 0 })
  });
  if (res.ok) racketModels.push(await res.json());
}

// String/grip types are real catalog rows (linked by product_id), so a
// brand-new one has to actually be created in the database before we can
// reference it. Returns the resolved product id, or null if no name given.
async function resolveOrCreateProduct(name, category) {
  if (!name) return null;
  const existing = products.find(p => p.name === name && p.category === category);
  if (existing) return existing.id;
  const res = await fetch(`${API}/products`, {
    method: "POST", headers: {"Content-Type": "application/json"},
    body: JSON.stringify({ name, category, cost_to_shop: 0, price_to_customer: 0 })
  });
  if (!res.ok) return null;
  const created = await res.json();
  products.push(created);
  return created.id;
}

function addItemLine() {
  const container = document.getElementById("itemLines");
  const div = document.createElement("div");
  div.className = "item-line-wrap";

  const serviceOptions = [
    `<option value="">-- select --</option>`,
    ...services.map(s => `<option value="${s.id}:${s.price}:${s.name}">${s.name}</option>`)
  ].join("");

  div.innerHTML = `
    <div class="item-line">
      <select class="service-select" onchange="onServiceChange(this); updateTotal();">${serviceOptions}</select>
      <input type="number" value="1" min="1" onchange="updateTotal()" class="qty">
      <input type="number" step="0.01" placeholder="price" class="price" onchange="updateTotal()">
      <button type="button" class="danger" onclick="this.closest('.item-line-wrap').remove(); updateTotal();" style="padding:6px;">✕</button>
    </div>
    <div class="racket-fields" style="display:none;">
      <select class="racket-model" onchange="toggleRacketModelOther(this)">${racketModelOptionsHtml()}</select>
      <input type="text" class="racket-model-other" placeholder="Type new racket model" style="display:none;">
    </div>
    <div class="type-fields" style="display:none;">
      <select class="type-select" onchange="toggleTypeOther(this)"></select>
      <input type="text" class="type-other" placeholder="Type new" style="display:none;">
      <input type="text" placeholder="String tension (e.g. 24 lbs)" class="string-tension" style="display:none;">
    </div>
  `;
  container.appendChild(div);
}

// Which sub-fields appear depends on which service was picked:
// Stringing -> racket model + string type + tension
// Grip Replacement -> racket model + grip type (color's baked into the name)
// Anything else -> no sub-fields at all
function onServiceChange(selectEl) {
  const wrap = selectEl.closest(".item-line-wrap");
  const racketFields = wrap.querySelector(".racket-fields");
  const typeFields = wrap.querySelector(".type-fields");
  const typeSelect = wrap.querySelector(".type-select");
  const typeOther = wrap.querySelector(".type-other");
  const tensionInput = wrap.querySelector(".string-tension");

  // auto-fill price from the selected service
  const [, price] = selectEl.value.split(":");
  wrap.querySelector(".price").value = price || "";

  const serviceName = selectEl.value.split(":")[2] || "";
  let mode = null;
  if (serviceName === "Stringing") mode = "string";
  else if (serviceName === "Grip Replacement") mode = "grip";

  if (!mode) {
    racketFields.style.display = "none";
    typeFields.style.display = "none";
    return;
  }

  racketFields.style.display = "flex";
  typeFields.style.display = "flex";
  tensionInput.style.display = mode === "string" ? "block" : "none";
  typeOther.placeholder = mode === "string" ? "Type new string type" : "Type new grip type/color";

  const catalog = products.filter(p => p.category === mode)
    .sort((a, b) => a.name.localeCompare(b.name));
  typeSelect.innerHTML = [
    `<option value="">-- ${mode === "string" ? "string type" : "grip type"} --</option>`,
    ...catalog.map(p => `<option value="${p.id}">${p.name}</option>`),
    `<option value="__other__">Other (type manually)</option>`
  ].join("");
  typeSelect.dataset.category = mode;
}

function toggleTypeOther(selectEl) {
  const wrap = selectEl.closest(".item-line-wrap");
  const other = wrap.querySelector(".type-other");
  other.style.display = selectEl.value === "__other__" ? "block" : "none";
}

function updateTotal() {
  let total = 0;
  document.querySelectorAll(".item-line").forEach(line => {
    const qty = parseFloat(line.querySelector(".qty").value) || 0;
    const price = parseFloat(line.querySelector(".price").value) || 0;
    total += qty * price;
  });
  document.getElementById("orderTotal").textContent = total.toFixed(2);
}

function reviewOrder() {
  if (!selectedCustomerId) { showToast("Select or create a customer first"); return; }

  const lineDescriptions = [];
  document.querySelectorAll(".item-line-wrap").forEach(wrap => {
    const sel = wrap.querySelector(".service-select");
    if (!sel.value) return;
    const label = sel.options[sel.selectedIndex].text;
    const qty = wrap.querySelector(".qty").value;
    const price = wrap.querySelector(".price").value;
    let desc = `${qty}x ${label} — $${price}`;

    const typeSelect = wrap.querySelector(".type-select");
    let typeLabel = null;
    if (typeSelect && typeSelect.value === "__other__") {
      typeLabel = wrap.querySelector(".type-other")?.value || null;
    } else if (typeSelect && typeSelect.value) {
      typeLabel = typeSelect.options[typeSelect.selectedIndex].text;
    }
    if (typeLabel) desc += ` (${typeLabel})`;

    const racketModel = getRacketModelValue(wrap);
    const tension = wrap.querySelector(".string-tension")?.value;
    const extra = [racketModel, tension].filter(Boolean).join(", ");
    if (extra) desc += ` <span style="color:var(--muted);">[${extra}]</span>`;

    lineDescriptions.push(desc);
  });

  if (lineDescriptions.length === 0) { showToast("Add at least one line item"); return; }

  const custName = document.getElementById("selectedCustomer").textContent.replace("Selected: ", "");
  const total = document.getElementById("orderTotal").textContent;

  document.getElementById("orderReview").innerHTML = `
    <div style="margin-top:12px; padding:10px; border:1px dashed var(--court-green); border-radius:6px; background:#eaf3ee; font-size:13px;">
      <strong>Confirm this order:</strong><br>
      ${custName}<br>
      ${lineDescriptions.join("<br>")}<br>
      <strong>Total: $${total}</strong>
      <div class="row" style="margin-top:10px;">
        <button onclick="submitOrder()">Confirm & Create</button>
        <button class="secondary" onclick="document.getElementById('orderReview').innerHTML=''">Back, keep editing</button>
      </div>
    </div>
  `;
}

let isSubmittingOrder = false;

async function submitOrder() {
  if (!selectedCustomerId) { showToast("Select or create a customer first"); return; }
  if (isSubmittingOrder) return;  // guards against double-click / accidental double-submit

  const confirmBtn = document.querySelector("#orderReview button[onclick='submitOrder()']");
  if (confirmBtn) confirmBtn.disabled = true;
  isSubmittingOrder = true;

  try {
    // Soft duplicate check: does this customer already have a very recent
    // active order? Doesn't block creation -- just warns, since sometimes
    // a customer genuinely does drop off two rackets close together.
    const existingRes = await fetch(`${API}/orders`);
    const existingOrders = await existingRes.json();
    const recentCutoff = Date.now() - 10 * 60 * 1000; // 10 minutes
    const possibleDuplicate = existingOrders.find(o =>
      o.customer_id === selectedCustomerId &&
      ["dropped_off", "in_progress"].includes(o.status) &&
      new Date(o.created_at).getTime() > recentCutoff
    );
    if (possibleDuplicate) {
      const minutesAgo = Math.round((Date.now() - new Date(possibleDuplicate.created_at).getTime()) / 60000);
      const proceed = confirm(
        `This customer already has an active order (#${possibleDuplicate.id}, $${possibleDuplicate.total_price.toFixed(2)}) ` +
        `created ${minutesAgo} minute(s) ago. Create another order anyway?`
      );
      if (!proceed) return;
    }

    const items = [];
    const wraps = [...document.querySelectorAll(".item-line-wrap")];

    for (const wrap of wraps) {
      const serviceVal = wrap.querySelector(".service-select").value;
      if (!serviceVal) continue;
      const [serviceId] = serviceVal.split(":");
      const qty = parseInt(wrap.querySelector(".qty").value) || 1;
      const price = parseFloat(wrap.querySelector(".price").value) || 0;
      const item = { quantity: qty, price_charged: price, service_id: parseInt(serviceId) };

      const typeSelect = wrap.querySelector(".type-select");
      if (typeSelect && typeSelect.value === "__other__") {
        const typedName = wrap.querySelector(".type-other")?.value;
        if (typedName) {
          const productId = await resolveOrCreateProduct(typedName, typeSelect.dataset.category);
          if (productId) item.product_id = productId;
        }
      } else if (typeSelect && typeSelect.value) {
        item.product_id = parseInt(typeSelect.value);
      }

      const racketModel = getRacketModelValue(wrap);
      if (racketModel) {
        await persistNewRacketModel(racketModel);
        item.racket_model = racketModel;
      }
      const tension = wrap.querySelector(".string-tension")?.value;
      if (tension) item.string_tension = tension;
      items.push(item);
    }
    if (items.length === 0) { showToast("Add at least one line item"); return; }

    const res = await fetch(`${API}/orders`, {
      method: "POST", headers: {"Content-Type": "application/json"},
      body: JSON.stringify({ customer_id: selectedCustomerId, items })
    });
    if (!res.ok) {
      const err = await res.json();
      showToast(err.detail || "Could not create order");
      return;
    }

    showToast("Order created");
    document.getElementById("itemLines").innerHTML = "";
    document.getElementById("lineItemsSection").style.display = "none";
    document.getElementById("orderReview").innerHTML = "";
    document.getElementById("selectedCustomer").style.display = "none";
    selectedCustomerId = null;
    updateTotal();
    loadOrders();
  } finally {
    isSubmittingOrder = false;
    if (confirmBtn) confirmBtn.disabled = false;
  }
}

// ---------------- Order queue ----------------
const STATUS_LABEL = {
  dropped_off: "Dropped off",
  in_progress: "In progress",
  ready_pending_confirm: "Confirm & send?",
  ready: "Ready — notified",
  picked_up: "Picked up"
};

function formatItemLine(i) {
  const parts = [`${i.quantity}x ${i.service_name || i.product_name || "item"}`];
  if (i.service_name && i.product_name) parts.push(i.product_name);
  if (i.racket_model) parts.push(i.racket_model);
  if (i.string_tension) parts.push(i.string_tension);
  return parts.join(" · ");
}

async function loadOrders() {
  if (editingOrderId !== null) return;  // don't clobber an open edit panel
  const res = await fetch(`${API}/orders`);
  const orders = await res.json();
  const active = orders.filter(o => o.status !== "picked_up" && o.status !== "cancelled");
  const container = document.getElementById("orderQueue");

  if (active.length === 0) {
    container.innerHTML = `<div class="empty">No active orders</div>`;
    return;
  }

  container.innerHTML = active.map(o => `
    <div class="order-card">
      <div class="top">
        <div>
          <div class="name">${o.customer?.name || "Customer #" + o.customer_id}</div>
          <div class="meta">Order #${o.id} · $${o.total_price.toFixed(2)} · ${o.customer?.phone || ""}</div>
          <div class="meta" style="margin-top:4px;">
            <div class="item-list">${o.items.map(i => `<div class="item-row">${formatItemLine(i)}</div>`).join("")}</div>
          </div>
        </div>
        <span class="badge ${o.status}">${STATUS_LABEL[o.status]}</span>
      </div>

      ${o.status === "ready_pending_confirm" ? `
        <div class="confirm-box">
          Will text <strong>${o.customer?.phone}</strong>:<br>
          <em>"Hi ${o.customer?.name}, your racket (order #${o.id}) is ready for pickup! See you soon."</em>
        </div>
      ` : ""}

      <div class="actions">
        ${o.status === "dropped_off" ? `<button onclick="doAction(${o.id}, 'start')">Start job</button>` : ""}
        ${o.status === "in_progress" ? `<button onclick="doAction(${o.id}, 'mark-ready')">Mark ready</button>` : ""}
        ${o.status === "ready_pending_confirm" ? `
          <button onclick="doAction(${o.id}, 'send-notification', 'POST')">Confirm & Send SMS</button>
          <button class="secondary" onclick="doAction(${o.id}, 'cancel-ready')">Cancel, keep working</button>
        ` : ""}
        ${o.status === "ready" ? `
          <button onclick="doAction(${o.id}, 'pickup')">Mark picked up</button>
          <button class="ghost" onclick="doAction(${o.id}, 'send-notification', 'POST')">Resend text</button>
          <button class="secondary" onclick="revertReady(${o.id})">Revert (marked ready by mistake)</button>
        ` : ""}
        ${(o.status === "dropped_off" || o.status === "in_progress") ? `
          <button class="secondary" onclick="startEditItems(${o.id})">Edit items</button>
          <button class="danger" onclick="deleteOrder(${o.id})">Cancel order</button>
        ` : ""}
      </div>
      <div id="editItems-${o.id}" class="collapsible"><div class="collapsible-inner"></div></div>
    </div>
  `).join("");
}

let editingOrderId = null;

function closeEditItems(orderId) {
  const outer = document.getElementById(`editItems-${orderId}`);
  outer.classList.remove("open");
  editingOrderId = null;
  // Clear the content after the collapse animation finishes, not before --
  // clearing immediately would make it vanish instantly instead of shrinking.
  setTimeout(() => {
    const inner = outer.querySelector(".collapsible-inner");
    if (inner) inner.innerHTML = "";
  }, 250);
}

function startEditItems(orderId) {
  editingOrderId = orderId;
  fetch(`${API}/orders/${orderId}`).then(r => r.json()).then(order => {
    const serviceOptions = [
      `<option value="">-- select --</option>`,
      ...services.map(s => `<option value="${s.id}:${s.price}:${s.name}">${s.name}</option>`)
    ].join("");

    const lineHtml = (item) => `
      <div class="item-line-wrap edit-item-line-wrap">
        <div class="item-line edit-item-line">
          <select class="service-select" onchange="onServiceChange(this)">${serviceOptions}</select>
          <input type="number" value="${item.quantity}" min="1" class="qty">
          <input type="number" step="0.01" value="${item.price_charged}" class="price">
          <button type="button" class="danger" onclick="this.closest('.edit-item-line-wrap').remove();" style="padding:6px;">✕</button>
        </div>
        <div class="racket-fields" style="display:none;">
          <select class="racket-model" onchange="toggleRacketModelOther(this)">${racketModelOptionsHtml()}</select>
          <input type="text" class="racket-model-other" placeholder="Type new racket model" style="display:none;">
        </div>
        <div class="type-fields" style="display:none;">
          <select class="type-select" onchange="toggleTypeOther(this)"></select>
          <input type="text" class="type-other" placeholder="Type new" style="display:none;">
          <input type="text" placeholder="String tension" class="string-tension" style="display:none;" value="${item.string_tension || ""}">
        </div>
      </div>
    `;

    const outer = document.getElementById(`editItems-${orderId}`);
    const container = outer.querySelector(".collapsible-inner");
    container.innerHTML = `
      <div style="margin-top:10px; padding:10px; border:1px dashed var(--court-green); border-radius:6px; background:#eaf3ee;">
        <div id="editLines-${orderId}">${order.items.map(lineHtml).join("")}</div>
        <button type="button" class="secondary" onclick="document.getElementById('editLines-${orderId}').insertAdjacentHTML('beforeend', document.getElementById('editLines-${orderId}').children[0].outerHTML)">+ Add line</button>
        <div class="row" style="margin-top:8px;">
          <button onclick="saveEditItems(${orderId})">Save</button>
          <button class="secondary" onclick="closeEditItems(${orderId})">Cancel</button>
        </div>
      </div>
    `;
    outer.classList.add("open"); // triggers the smooth expand

    // Pre-fill each line: service selection triggers the sub-fields to
    // appear and the type select to populate; then set the specific
    // product/racket-model/tension values on top of that.
    const wraps = container.querySelectorAll(".edit-item-line-wrap");
    order.items.forEach((item, i) => {
      const wrap = wraps[i];
      if (!wrap) return;
      const select = wrap.querySelector(".service-select");
      const match = Array.from(select.options).find(opt => opt.value.startsWith(`${item.service_id}:`));
      if (match) {
        select.value = match.value;
        onServiceChange(select); // populates the type select options and shows sub-fields
      }
      const typeSelect = wrap.querySelector(".type-select");
      if (item.product_id && typeSelect) {
        const hasOption = Array.from(typeSelect.options).some(o => o.value === String(item.product_id));
        if (hasOption) {
          typeSelect.value = String(item.product_id);
        } else if (item.product_name) {
          typeSelect.value = "__other__";
          wrap.querySelector(".type-other").style.display = "block";
          wrap.querySelector(".type-other").value = item.product_name;
        }
      }
      if (item.racket_model) setRacketModelValue(wrap, item.racket_model);
    });
  });
}

async function saveEditItems(orderId) {
  const wraps = [...document.querySelectorAll(`#editLines-${orderId} .edit-item-line-wrap`)];
  const items = [];
  for (const wrap of wraps) {
    const serviceVal = wrap.querySelector(".service-select").value;
    if (!serviceVal) continue;
    const [serviceId] = serviceVal.split(":");
    const qty = parseInt(wrap.querySelector(".qty").value) || 1;
    const price = parseFloat(wrap.querySelector(".price").value) || 0;
    const item = { quantity: qty, price_charged: price, service_id: parseInt(serviceId) };

    const typeSelect = wrap.querySelector(".type-select");
    if (typeSelect && typeSelect.value === "__other__") {
      const typedName = wrap.querySelector(".type-other")?.value;
      if (typedName) {
        const productId = await resolveOrCreateProduct(typedName, typeSelect.dataset.category);
        if (productId) item.product_id = productId;
      }
    } else if (typeSelect && typeSelect.value) {
      item.product_id = parseInt(typeSelect.value);
    }

    const racketModel = getRacketModelValue(wrap);
    if (racketModel) {
      await persistNewRacketModel(racketModel);
      item.racket_model = racketModel;
    }
    const tension = wrap.querySelector(".string-tension")?.value;
    if (tension) item.string_tension = tension;
    items.push(item);
  }
  if (items.length === 0) { showToast("Order must have at least one line item"); return; }

  const res = await fetch(`${API}/orders/${orderId}/items`, {
    method: "PUT", headers: {"Content-Type": "application/json"},
    body: JSON.stringify(items)
  });
  if (!res.ok) { showToast("Could not update -- order may already be marked ready"); return; }
  showToast("Order updated");
  closeEditItems(orderId);
  setTimeout(loadOrders, 260);  // wait for the collapse animation to finish first
}

// ---------------- View switching (Active / Summary / History) ----------------
let currentView = "active";

const VIEW_TITLES = { active: "Active Orders", summary: "Summary", history: "History" };

function showView(view) {
  currentView = view;
  document.getElementById("queueTitle").textContent = VIEW_TITLES[view];
  document.getElementById("orderQueue").style.display = view === "active" ? "block" : "none";
  document.getElementById("orderStats").style.display = view === "summary" ? "block" : "none";
  document.getElementById("orderHistory").style.display = view === "history" ? "block" : "none";

  if (view === "active") loadOrders();
  else if (view === "summary") loadStats();
  else if (view === "history") loadHistory();
}

async function loadStats() {
  const res = await fetch(`${API}/analytics/summary?weeks=8`);
  const data = await res.json();
  const container = document.getElementById("orderStats");

  const weeklyRows = data.weekly.slice().reverse().map(w => `
    <tr>
      <td>${w.week_start}</td>
      <td>${w.orders_created}</td>
      <td>$${w.created_total.toFixed(2)}</td>
      <td>${w.orders_completed}</td>
      <td>$${w.completed_total.toFixed(2)}</td>
    </tr>
  `).join("");

  const topList = (items) => items.length
    ? items.map(i => `<li>${i.name} — ${i.count}x</li>`).join("")
    : `<li class="empty" style="padding:4px 0;">No data yet</li>`;

  container.innerHTML = `
    <h2 style="margin-bottom:10px;">Stats (last 8 weeks)</h2>
    <table style="width:100%; border-collapse:collapse; font-size:12px; margin-bottom:16px;">
      <thead>
        <tr style="text-align:left; color:var(--muted);">
          <th style="padding:4px;">Week of</th>
          <th style="padding:4px;">Created</th>
          <th style="padding:4px;">Value created</th>
          <th style="padding:4px;">Completed</th>
          <th style="padding:4px;">Value completed</th>
        </tr>
      </thead>
      <tbody>${weeklyRows || `<tr><td colspan="5" class="empty">No orders yet</td></tr>`}</tbody>
    </table>
    <div class="row" style="align-items:flex-start; gap:24px;">
      <div>
        <strong style="font-size:12px; color:var(--muted);">TOP STRINGS</strong>
        <ul style="margin:6px 0 0; padding-left:18px; font-size:12px;">${topList(data.top_strings)}</ul>
      </div>
      <div>
        <strong style="font-size:12px; color:var(--muted);">TOP GRIPS</strong>
        <ul style="margin:6px 0 0; padding-left:18px; font-size:12px;">${topList(data.top_grips)}</ul>
      </div>
      <div>
        <strong style="font-size:12px; color:var(--muted);">TOP RACKET MODELS</strong>
        <ul style="margin:6px 0 0; padding-left:18px; font-size:12px;">${topList(data.top_racket_models)}</ul>
      </div>
    </div>
  `;
}

// ---------------- Order history ----------------

async function loadHistory() {
  const [pickedUpRes, cancelledRes] = await Promise.all([
    fetch(`${API}/orders?status=picked_up`),
    fetch(`${API}/orders?status=cancelled`),
  ]);
  const orders = [...(await pickedUpRes.json()), ...(await cancelledRes.json())]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const container = document.getElementById("orderHistory");

  if (orders.length === 0) {
    container.innerHTML = `<div class="empty">No completed or cancelled orders yet</div>`;
    return;
  }

  container.innerHTML = `<h2 style="margin-bottom:10px;">History</h2>` + orders.map(o => `
    <div class="order-card" style="opacity:0.75;">
      <div class="top">
        <div>
          <div class="name">${o.customer?.name || "Customer #" + o.customer_id}</div>
          <div class="meta">Order #${o.id} · $${o.total_price.toFixed(2)} · ${
            o.status === "cancelled"
              ? "cancelled " + new Date(o.cancelled_at).toLocaleDateString()
              : "picked up " + new Date(o.picked_up_at).toLocaleDateString()
          }</div>
          <div class="meta" style="margin-top:4px;">
            <div class="item-list">${o.items.map(i => `<div class="item-row">${formatItemLine(i)}</div>`).join("")}</div>
          </div>
        </div>
        <span class="badge ${o.status}">${o.status === "cancelled" ? "Cancelled" : "Picked up"}</span>
      </div>
    </div>
  `).join("");
}

async function deleteOrder(orderId) {
  if (!confirm("Cancel this order? This can't be undone.")) return;
  await fetch(`${API}/orders/${orderId}`, { method: "DELETE" });
  loadOrders();
}

async function doAction(orderId, action, method = "PATCH") {
  await fetch(`${API}/orders/${orderId}/${action}`, { method });
  loadOrders();
}

async function revertReady(orderId) {
  const ok = confirm(
    "This moves the order back to 'In progress' -- but it can NOT un-send " +
    "a text message that already reached the customer's phone. Only use " +
    "this if you clicked 'Confirm & Send' by mistake and know the customer " +
    "hasn't been notified, or you're okay following up with them directly."
  );
  if (!ok) return;
  await fetch(`${API}/orders/${orderId}/revert-ready`, { method: "PATCH" });
  loadOrders();
}

// ---------------- Init ----------------
async function init() {
  const allProducts = await (await fetch(`${API}/products`)).json();
  products = allProducts.filter(p => p.category !== "racket_model");
  racketModels = allProducts.filter(p => p.category === "racket_model");
  services = await (await fetch(`${API}/services`)).json();
  loadOrders();  // Active Orders is the default view on load
  setInterval(() => {
    if (currentView === "active") loadOrders();
    else if (currentView === "summary") loadStats();
    else if (currentView === "history") loadHistory();
  }, 5000);
}
init();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("service-worker.js").catch(() => {
      // Non-fatal: PWA install just won't be offered, app still works normally.
    });
  });
}