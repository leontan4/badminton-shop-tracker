import { useState, useEffect } from "react";
import { Table } from "react-bootstrap";
import { api } from "../api";

export default function Summary() {
  const [data, setData] = useState(null);

  useEffect(() => {
    api.analyticsSummary(8).then(setData);
  }, []);

  if (!data) return <div className="text-muted text-center py-4">Loading...</div>;

  const topList = (items) => items.length
    ? items.map((i, idx) => <li key={idx}>{i.name} — {i.count}x</li>)
    : <li className="text-muted">No data yet</li>;

  return (
    <div>
      <Table size="sm" className="small">
        <thead>
          <tr className="text-muted">
            <th>Week of</th><th>Created</th><th>Value created</th><th>Completed</th><th>Value completed</th>
          </tr>
        </thead>
        <tbody>
          {data.weekly.length === 0
            ? <tr><td colSpan={5} className="text-muted text-center">No orders yet</td></tr>
            : data.weekly.slice().reverse().map((w) => (
              <tr key={w.week_start}>
                <td>{w.week_start}</td>
                <td>{w.orders_created}</td>
                <td>${w.created_total.toFixed(2)}</td>
                <td>{w.orders_completed}</td>
                <td>${w.completed_total.toFixed(2)}</td>
              </tr>
            ))}
        </tbody>
      </Table>
      <div className="d-flex gap-4 flex-wrap">
        <div>
          <strong className="small text-muted">TOP STRINGS</strong>
          <ul className="small ps-3 mt-1">{topList(data.top_strings)}</ul>
        </div>
        <div>
          <strong className="small text-muted">TOP GRIPS</strong>
          <ul className="small ps-3 mt-1">{topList(data.top_grips)}</ul>
        </div>
        <div>
          <strong className="small text-muted">TOP RACKET MODELS</strong>
          <ul className="small ps-3 mt-1">{topList(data.top_racket_models)}</ul>
        </div>
      </div>
    </div>
  );
}
