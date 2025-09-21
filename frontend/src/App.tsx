import { useState } from "react";
import "./App.css";

type Health = { status: string };

function App() {
  const [health, setHealth] = useState<Health | null>(null);

  async function onHealthCheck() {
    const res = await fetch("http://localhost:8000/health");
    setHealth(await res.json());
  }

  return (
    <>
      <h1>スイングトレード用株価予測</h1>

      <div>
        <h2>
          バックエンドのヘルスチェック（FastAPIが起動していれば200 OKが返る）
        </h2>
        <button onClick={onHealthCheck}>ヘルスチェック</button>
        <pre>{health ? JSON.stringify(health, null, 2) : "未実行"}</pre>
      </div>
    </>
  );
}

export default App;
