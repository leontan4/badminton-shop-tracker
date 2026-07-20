import { useState } from "react";
import { Form, Button, ListGroup, Alert, Card } from "react-bootstrap";
import { api } from "../api";

export default function CustomerSearch({ selectedCustomer, onSelect, onToast }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState(null); // null = not searched yet
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newCust, setNewCust] = useState({ name: "", phone: "", email: "", notes: "" });

  async function search(q) {
    setQuery(q);
    if (!q) { setResults(null); return; }
    const data = await api.searchCustomers(q);
    setResults(data);
  }

  async function saveNewCustomer() {
    if (!newCust.name || !newCust.phone) { onToast("Name and phone are required"); return; }
    try {
      const c = await api.createCustomer({
        name: newCust.name,
        phone: "+1" + newCust.phone.replace(/\D/g, ""),
        email: newCust.email || null,
        notes: newCust.notes || null,
      });
      onSelect(c);
      setShowNewForm(false);
      setNewCust({ name: "", phone: "", email: "", notes: "" });
      onToast("Customer created");
    } catch (e) {
      onToast(e.message);
    }
  }

  async function saveEditCustomer() {
    try {
      const c = editingCustomer;
      await api.updateCustomer(c.id, {
        name: c.name,
        phone: "+1" + c.phone.replace(/\D/g, ""),
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

  return (
    <>
      <Form.Label>Customer</Form.Label>
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
              setShowNewForm(true);
              setNewCust((n) => ({ ...n, name: query }));
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
            <ListGroup.Item key={c.id} className="d-flex justify-content-between align-items-center cust-result-row">
              <span
                className="cust-info"
                onClick={() => { onSelect(c); setResults(null); setQuery(""); }}
              >
                {c.name} — {c.phone}
              </span>
              <Button size="sm" variant="outline-secondary" onClick={() => setEditingCustomer({ ...c })}>Edit</Button>
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
          </div>
        </Card>
      )}

      {selectedCustomer && (
        <Alert variant="light" className="mt-2 border bg-mint">
          Selected: <strong>{selectedCustomer.name}</strong> ({selectedCustomer.phone})
        </Alert>
      )}

      <div className="mt-2">
        <Button size="sm" variant="outline-primary" onClick={() => setShowNewForm((v) => !v)}>
          + New customer
        </Button>
      </div>

      {showNewForm && (
        <Card className="mt-2 p-2">
          <Form.Label>Name <span className="text-danger">*</span></Form.Label>
          <Form.Control value={newCust.name} onChange={(e) => setNewCust({ ...newCust, name: e.target.value })} />
          <Form.Label className="mt-2">Phone (US only for now) <span className="text-danger">*</span></Form.Label>
          <div className="d-flex gap-2">
            <span className="input-group-text">+1</span>
            <Form.Control placeholder="6519557275" value={newCust.phone} onChange={(e) => setNewCust({ ...newCust, phone: e.target.value })} />
          </div>
          <Form.Label className="mt-2">Email (optional)</Form.Label>
          <Form.Control type="email" value={newCust.email} onChange={(e) => setNewCust({ ...newCust, email: e.target.value })} />
          <Form.Label className="mt-2">Notes (optional)</Form.Label>
          <Form.Control value={newCust.notes} onChange={(e) => setNewCust({ ...newCust, notes: e.target.value })} />
          <div className="mt-2 d-flex gap-2">
            <Button size="sm" onClick={saveNewCustomer}>Save Customer</Button>
            <Button size="sm" variant="secondary" onClick={() => setShowNewForm(false)}>Cancel</Button>
          </div>
        </Card>
      )}
    </>
  );
}
