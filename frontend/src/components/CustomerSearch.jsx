import { useState } from "react";
import { Form, Button, ListGroup, Alert, Card, ButtonGroup, Modal } from "react-bootstrap";
import { api } from "../api";

// Simple client-side checks -- backend also validates, this just gives
// faster feedback before the request round-trip.
function isValidUsPhone(localDigits) {
  return /^\d{10}$/.test(localDigits);
}
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export default function CustomerSearch({ tab, setTab, selectedCustomer, onSelect, onClearSelection, onToast }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState(null); // null = not searched yet
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [newCust, setNewCust] = useState({ name: "", phone: "", email: "", notes: "" });

  async function search(q) {
    setQuery(q);
    if (!q) { setResults(null); return; }
    const data = await api.searchCustomers(q);
    setResults(data);
  }

  async function saveNewCustomer() {
    if (!newCust.name || !newCust.phone) { onToast("Name and phone are required"); return; }
    const digits = newCust.phone.replace(/\D/g, "");
    if (!isValidUsPhone(digits)) { onToast("Phone number must be exactly 10 digits"); return; }
    if (newCust.email && !isValidEmail(newCust.email)) { onToast("Email doesn't look valid"); return; }
    try {
      const c = await api.createCustomer({
        name: newCust.name,
        phone: "+1" + digits,
        email: newCust.email || null,
        notes: newCust.notes || null,
      });
      onSelect(c);
      setNewCust({ name: "", phone: "", email: "", notes: "" });
      setTab("search");
      onToast("Customer created");
    } catch (e) {
      onToast(e.message);
    }
  }

  async function saveEditCustomer() {
    const digits = editingCustomer.phone.replace(/\D/g, "");
    if (!isValidUsPhone(digits)) { onToast("Phone number must be exactly 10 digits"); return; }
    if (editingCustomer.email && !isValidEmail(editingCustomer.email)) { onToast("Email doesn't look valid"); return; }
    try {
      const c = editingCustomer;
      await api.updateCustomer(c.id, {
        name: c.name,
        phone: "+1" + digits,
        email: c.email || null,
        notes: c.notes || null,
      });
      onToast("Customer updated");
      setEditingCustomer(null);
      setResults(null);
      setQuery("");
    } catch (e) {
      onToast(e.message);
    }
  }

  async function confirmDeleteCustomer() {
    setShowDeleteConfirm(false);
    try {
      await api.deleteCustomer(editingCustomer.id);
      onToast("Customer deleted");
      setEditingCustomer(null);
      setResults(null);
      setQuery("");
      if (selectedCustomer?.id === editingCustomer.id) onClearSelection?.();
    } catch (e) {
      onToast(e.message);
    }
  }

  return (
    <>
      <ButtonGroup size="sm" className="mb-2 w-100 tab-group">
        <Button variant={tab === "search" ? "primary" : "outline-primary"} onClick={() => setTab("search")}>
          Find Customer
        </Button>
        <Button variant={tab === "new" ? "primary" : "outline-primary"} onClick={() => setTab("new")}>
          + New Customer
        </Button>
      </ButtonGroup>

      {selectedCustomer && tab === "search" && (
        <Alert variant="light" className="mb-2 border bg-mint d-flex justify-content-between align-items-center">
          <span>Selected: <strong>{selectedCustomer.name}</strong> ({selectedCustomer.phone})</span>
          <Button
            size="sm"
            variant="link"
            className="text-danger p-0 ms-2"
            style={{ textDecoration: "none", fontSize: "1.1rem", lineHeight: 1 }}
            onClick={() => onClearSelection?.()}
            title="Clear selected customer"
          >
            ×
          </Button>
        </Alert>
      )}

      {tab === "search" && (
        <>
          <Form.Control
            placeholder="Search by name or phone..."
            value={query}
            onChange={(e) => search(e.target.value)}
          />

          {results && results.length === 0 && !editingCustomer && (
            <Alert variant="light" className="mt-2 text-center border">
              No matches
              <div className="mt-2">
                <Button size="sm" variant="secondary" onClick={() => {
                  setNewCust((n) => ({ ...n, name: query }));
                  setTab("new");
                  setResults(null);
                  setQuery("");
                }}>
                  + Create new customer "{query}"
                </Button>
              </div>
            </Alert>
          )}

          {results && results.length > 0 && !editingCustomer && (
            <ListGroup className="mt-2">
              {results.map((c) => (
                <ListGroup.Item
                  key={c.id}
                  className="d-flex justify-content-between align-items-center cust-result-row"
                  onClick={() => { onSelect(c); setResults(null); setQuery(""); }}
                >
                  <div className="cust-info">
                    <div className="fw-semibold">{c.name}</div>
                    <div className="text-muted small">{c.phone}</div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline-secondary"
                    onClick={(e) => { e.stopPropagation(); setEditingCustomer({ ...c }); }}
                  >
                    Edit
                  </Button>
                </ListGroup.Item>
              ))}
            </ListGroup>
          )}

          {editingCustomer && (
            <Card className="mt-2 p-2 bg-mint border-dashed">
              <Form.Label>Name</Form.Label>
              <Form.Control
                value={editingCustomer.name}
                onChange={(e) => setEditingCustomer({ ...editingCustomer, name: e.target.value })}
              />
              <Form.Label className="mt-2">Phone</Form.Label>
              <Form.Control
                value={editingCustomer.phone.replace(/^\+1/, "")}
                onChange={(e) => setEditingCustomer({ ...editingCustomer, phone: e.target.value })}
              />
              <Form.Label className="mt-2">Email (optional)</Form.Label>
              <Form.Control
                type="email"
                value={editingCustomer.email || ""}
                onChange={(e) => setEditingCustomer({ ...editingCustomer, email: e.target.value })}
              />
              <Form.Label className="mt-2">Notes (optional)</Form.Label>
              <Form.Control
                value={editingCustomer.notes || ""}
                onChange={(e) => setEditingCustomer({ ...editingCustomer, notes: e.target.value })}
              />
              <div className="mt-2 d-flex gap-2">
                <Button size="sm" onClick={saveEditCustomer}>Save</Button>
                <Button size="sm" variant="secondary" onClick={() => setEditingCustomer(null)}>Cancel</Button>
                <Button size="sm" variant="outline-danger" className="ms-auto" onClick={() => setShowDeleteConfirm(true)}>
                  Delete Customer
                </Button>
              </div>
            </Card>
          )}
        </>
      )}

      {tab === "new" && (
        <Card className="p-2">
          <Form.Label>Name <span className="text-danger">*</span></Form.Label>
          <Form.Control value={newCust.name} onChange={(e) => setNewCust({ ...newCust, name: e.target.value })} />
          <Form.Label className="mt-2">Phone (US only for now, 10 digits) <span className="text-danger">*</span></Form.Label>
          <div className="d-flex gap-2">
            <span className="input-group-text">+1</span>
            <Form.Control placeholder="" value={newCust.phone} onChange={(e) => setNewCust({ ...newCust, phone: e.target.value })} />
          </div>
          <Form.Label className="mt-2">Email (optional)</Form.Label>
          <Form.Control type="email" value={newCust.email} onChange={(e) => setNewCust({ ...newCust, email: e.target.value })} />
          <Form.Label className="mt-2">Notes (optional)</Form.Label>
          <Form.Control value={newCust.notes} onChange={(e) => setNewCust({ ...newCust, notes: e.target.value })} />
          <div className="mt-2 d-flex gap-2">
            <Button size="sm" onClick={saveNewCustomer}>Save Customer</Button>
            <Button size="sm" variant="secondary" onClick={() => setTab("search")}>Cancel</Button>
          </div>
        </Card>
      )}

      <Modal show={showDeleteConfirm} onHide={() => setShowDeleteConfirm(false)} centered size="sm">
        <Modal.Body>
          <p className="mb-3">
            Delete <strong>{editingCustomer?.name}</strong>? This only works if they have
            no order history -- if they do, this'll tell you and nothing will be deleted.
          </p>
          <div className="d-flex gap-2 justify-content-end">
            <Button size="sm" variant="secondary" onClick={() => setShowDeleteConfirm(false)}>Cancel</Button>
            <Button size="sm" variant="danger" onClick={confirmDeleteCustomer}>Delete</Button>
          </div>
        </Modal.Body>
      </Modal>
    </>
  );
}