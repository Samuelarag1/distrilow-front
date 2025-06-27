// views/CashboxPage.tsx
import { useState, useEffect } from "react";
import axios from "axios";
export default function CashboxPage() {
  const [logs, setLogs] = useState([]);
  const [amount, setAmount] = useState("");
  const [type, setType] = useState("MOVEMENT");
  const [note, setNote] = useState("");

  const fetchLogs = async () => {
    const res = await axios.get("/api/cashbox?branchId=xxx&date=2025-06-27");
    setLogs(res.data);
  };

  const registerMovement = async () => {
    await axios.post("/api/cashbox", {
      amount: parseFloat(amount),
      type,
      note,
      branchId: "xxx",
    });
    fetchLogs();
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-bold">Arqueo de Caja</h1>

      <div className="grid grid-cols-2 gap-2">
        <select value={type} onChange={(e) => setType(e.target.value)}>
          <option value="OPENING">Apertura</option>
          <option value="MOVEMENT">Movimiento</option>
          <option value="CLOSURE">Cierre</option>
        </select>

        <input
          type="number"
          placeholder="Monto"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <input
          type="text"
          placeholder="Nota (opcional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <button
          onClick={registerMovement}
          className="bg-blue-600 text-white rounded px-2 py-1"
        >
          Registrar
        </button>
      </div>

      <div>
        <h2 className="font-semibold mt-4">Historial del día</h2>
        <ul className="mt-2 space-y-1">
          {logs.map((log: any) => (
            <li key={log.id} className="border rounded p-2">
              <strong>{log.type}</strong> - ${log.amount} - {log.user.name}
              <br />
              <small>{new Date(log.createdAt).toLocaleString()}</small>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
