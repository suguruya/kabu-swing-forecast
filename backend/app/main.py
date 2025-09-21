from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from auth import ensure_tokens
from typing import List, Dict, Any, Optional
import requests


JQ_BASE = "https://api.jquants.com/v1"

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class StockInfo(BaseModel):
    code: str
    name: Optional[str] = None
    market: Optional[str] = None
    industry: Optional[str] = None


class StockInfoResponse(BaseModel):
    count: int
    items: List[StockInfo]


class Daily(BaseModel):
    Date: str
    Code: str
    Open: Optional[float] = None
    High: Optional[float] = None
    Low: Optional[float] = None
    Close: Optional[float] = None
    Volume: Optional[float] = None
    TurnoverValue: Optional[float] = None


def _normalize_stock(r: Dict[str, Any]) -> StockInfo:
    return StockInfo(
        code=r.get("Code"),
        name=r.get("CompanyName"),
        market=r.get("MarketCodeName"),
        industry=r.get("Sector17CodeName"),
    )


@app.get("/")
def read_root():
    return {"Hello": "World"}


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/info", response_model=StockInfoResponse)
def get_daily_stock_info():
    _, id_token = ensure_tokens()
    res = requests.get(
        f"{JQ_BASE}/listed/info", headers={"Authorization": f"Bearer {id_token}"}
    )
    res.raise_for_status()
    data = res.json()
    items = data.get("info")
    print(items)
    norm = [_normalize_stock(item) for item in items]
    return StockInfoResponse(count=len(norm), items=norm)
