import { useState } from "react";
import { Button, Card, Form, Alert, InputGroup } from "react-bootstrap";
import { api } from "../api";

export default function Login({ onSuccess }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.login(username, password);
      onSuccess();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="d-flex align-items-center justify-content-center" style={{ minHeight: "100vh" }}>
      <Card style={{ width: 360 }} className="shadow-sm">
        <div
          className="text-white py-3 px-4 text-center"
          style={{ background: "linear-gradient(90deg, #df94f7 0%, #9754fa 100%)" }}
        >
          <h1 className="h5 mb-0">🏸 Badminton Gallery</h1>
          <span className="small opacity-75">Service Stop</span>
        </div>
        <Card.Body className="p-4">
          <Form onSubmit={handleSubmit}>
            {error && <Alert variant="danger" className="py-2 small">{error}</Alert>}
            <Form.Group className="mb-3">
              <Form.Label>Username</Form.Label>
              <Form.Control value={username} onChange={(e) => setUsername(e.target.value)} autoFocus />
            </Form.Group>
            <Form.Group className="mb-4">
              <Form.Label>Password</Form.Label>
              <InputGroup>
                <Form.Control
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <Button variant="outline-secondary" onClick={() => setShowPassword((s) => !s)} tabIndex={-1} aria-label={showPassword ? "Hide password" : "Show password"}>
                  {showPassword ? (
                    // Eye with a slash -- currently visible, click to hide
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
                      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
                      <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
                      <line x1="2" y1="2" x2="22" y2="22" />
                    </svg>
                  ) : (
                    // Plain eye -- currently hidden, click to show
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </Button>
              </InputGroup>
            </Form.Group>
            <Button type="submit" className="w-100" disabled={submitting}>
              {submitting ? "Signing in..." : "Sign in"}
            </Button>
          </Form>
        </Card.Body>
      </Card>
    </div>
  );
}