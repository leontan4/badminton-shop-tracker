const API = "http://localhost:8000";
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
  document.getElementById("custResults").innerHTML = data.map(c => `
    <div class="result-row">
      <span class="cust-info" onclick="selectCustomer(${c.id}, '${c.name.replace(/'/g,"")}', '${c.phone}')">
        ${c.name} — ${c.phone}
      </span>
      <button class="ghost" style="padding:3px 8px; font-size:11px;" onclick="startEditCustomer(${c.id})">Edit</button>
    </div>
  `).join("") || `<div class="empty">No matches</div>`;
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
  const res = await fetch(`${API}/customers/${id}`, {
    method: "PATCH", headers: {"Content-Type": "application/json"},
    body: JSON.stringify({ name, phone })
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
}

async function createCustomer() {
  const name = document.getElementById("newCustName").value;
  const localNumber = document.getElementById("newCustPhone").value;
  if (!name || !localNumber) { showToast("Name and phone are required"); return; }
  const phone = "+1" + localNumber.replace(/\D/g, "");
  const res = await fetch(`${API}/customers`, {
    method: "POST", headers: {"Content-Type": "application/json"},
    body: JSON.stringify({name, phone})
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
  showToast("Customer created");
}

// ---------------- Line items ----------------
function racketModelOptionsHtml() {
  return [
    `<option value="">-- racket model --</option>`,
    ...racketModels.map(r => `<option value="${r.name}">${r.name}</option>`)
  ].join("");
}

function toggleRacketModelOther(selectEl) {
  const wrap = selectEl.closest(".racket-fields");
  const other = wrap.querySelector(".racket-model-other");
  other.style.display = selectEl.value === "Other (type manually)" ? "block" : "none";
}

function getRacketModelValue(wrap) {
  const select = wrap.querySelector(".racket-model");
  if (!select) return "";
  if (select.value === "Other (type manually)") {
    return wrap.querySelector(".racket-model-other")?.value || "";
  }
  return select.value;
}

function setRacketModelValue(wrap, value) {
  if (!value) return;
  const select = wrap.querySelector(".racket-model");
  const other = wrap.querySelector(".racket-model-other");
  const matches = Array.from(select.options).some(o => o.value === value);
  if (matches) {
    select.value = value;
  } else {
    select.value = "Other (type manually)";
    other.style.display = "block";
    other.value = value;
  }
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
      <select class="service-select" onchange="updateTotal(); onServiceChange(this);">${serviceOptions}</select>
      <input type="number" value="1" min="1" onchange="updateTotal()" class="qty">
      <input type="number" step="0.01" placeholder="price" class="price" onchange="updateTotal()">
      <button type="button" class="danger" onclick="this.closest('.item-line-wrap').remove(); updateTotal();" style="padding:6px;">✕</button>
    </div>
    <div class="racket-fields" style="display:none;">
      <select class="racket-model" onchange="toggleRacketModelOther(this)">${racketModelOptionsHtml()}</select>
      <input type="text" class="racket-model-other" placeholder="Type racket model" style="display:none;">
    </div>
    <div class="type-fields" style="display:none;">
      <select class="type-select"></select>
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

  const catalog = products.filter(p => p.category === mode);
  typeSelect.innerHTML = [
    `<option value="">-- ${mode === "string" ? "string type" : "grip type"} --</option>`,
    ...catalog.map(p => `<option value="${p.id}">${p.name}</option>`)
  ].join("");
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
    const typeLabel = typeSelect && typeSelect.value
      ? typeSelect.options[typeSelect.selectedIndex].text
      : null;
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

async function submitOrder() {
  if (!selectedCustomerId) { showToast("Select or create a customer first"); return; }
  const items = [];
  document.querySelectorAll(".item-line-wrap").forEach(wrap => {
    const serviceVal = wrap.querySelector(".service-select").value;
    if (!serviceVal) return;
    const [serviceId] = serviceVal.split(":");
    const qty = parseInt(wrap.querySelector(".qty").value) || 1;
    const price = parseFloat(wrap.querySelector(".price").value) || 0;
    const item = { quantity: qty, price_charged: price, service_id: parseInt(serviceId) };

    const typeSelect = wrap.querySelector(".type-select");
    if (typeSelect && typeSelect.value) item.product_id = parseInt(typeSelect.value);

    const racketModel = getRacketModelValue(wrap);
    const tension = wrap.querySelector(".string-tension")?.value;
    if (racketModel) item.racket_model = racketModel;
    if (tension) item.string_tension = tension;
    items.push(item);
  });
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
      <div id="editItems-${o.id}"></div>
    </div>
  `).join("");
}

let editingOrderId = null;

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
          <input type="text" class="racket-model-other" placeholder="Type racket model" style="display:none;">
        </div>
        <div class="type-fields" style="display:none;">
          <select class="type-select"></select>
          <input type="text" placeholder="String tension" class="string-tension" style="display:none;">
        </div>
      </div>
    `;

    const container = document.getElementById(`editItems-${orderId}`);
    container.innerHTML = `
      <div style="margin-top:10px; padding:10px; border:1px dashed var(--court-green); border-radius:6px; background:#eaf3ee;">
        <div id="editLines-${orderId}">${order.items.map(lineHtml).join("")}</div>
        <button type="button" class="secondary" onclick="document.getElementById('editLines-${orderId}').insertAdjacentHTML('beforeend', document.getElementById('editLines-${orderId}').children[0].outerHTML)">+ Add line</button>
        <div class="row" style="margin-top:8px;">
          <button onclick="saveEditItems(${orderId})">Save</button>
          <button class="secondary" onclick="document.getElementById('editItems-${orderId}').innerHTML=''; editingOrderId=null;">Cancel</button>
        </div>
      </div>
    `;

    const wraps = container.querySelectorAll(".edit-item-line-wrap");
    order.items.forEach((item, i) => {
      const wrap = wraps[i];
      if (!wrap) return;
      const select = wrap.querySelector(".service-select");
      const match = Array.from(select.options).find(opt => opt.value.startsWith(`${item.service_id}:`));
      if (match) {
        select.value = match.value;
        onServiceChange(select);
      }
      if (item.product_id) wrap.querySelector(".type-select").value = item.product_id;
      if (item.string_tension) wrap.querySelector(".string-tension").value = item.string_tension;
      if (item.racket_model) setRacketModelValue(wrap, item.racket_model);
    });
  });
}

async function saveEditItems(orderId) {
  const wraps = document.querySelectorAll(`#editLines-${orderId} .edit-item-line-wrap`);
  const items = [];
  wraps.forEach(wrap => {
    const serviceVal = wrap.querySelector(".service-select").value;
    if (!serviceVal) return;
    const [serviceId] = serviceVal.split(":");
    const qty = parseInt(wrap.querySelector(".qty").value) || 1;
    const price = parseFloat(wrap.querySelector(".price").value) || 0;
    const item = { quantity: qty, price_charged: price, service_id: parseInt(serviceId) };

    const typeSelect = wrap.querySelector(".type-select");
    if (typeSelect && typeSelect.value) item.product_id = parseInt(typeSelect.value);

    const racketModel = getRacketModelValue(wrap);
    const tension = wrap.querySelector(".string-tension")?.value;
    if (racketModel) item.racket_model = racketModel;
    if (tension) item.string_tension = tension;
    items.push(item);
  });
  if (items.length === 0) { showToast("Order must have at least one line item"); return; }

  const res = await fetch(`${API}/orders/${orderId}/items`, {
    method: "PUT", headers: {"Content-Type": "application/json"},
    body: JSON.stringify(items)
  });
  if (!res.ok) { showToast("Could not update -- order may already be marked ready"); return; }
  showToast("Order updated");
  editingOrderId = null;
  document.getElementById(`editItems-${orderId}`).innerHTML = "";
  loadOrders();
}

// ---------------- Order history ----------------
let historyVisible = false;

function toggleHistory() {
  historyVisible = !historyVisible;
  document.getElementById("orderHistory").style.display = historyVisible ? "block" : "none";
  if (historyVisible) loadHistory();
}

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
  loadOrders();
  setInterval(() => {
    loadOrders();
    if (historyVisible) loadHistory();
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