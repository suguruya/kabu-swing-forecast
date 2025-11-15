from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from auth import ensure_tokens
from typing import List, Dict, Any, Optional
import requests
from datetime import datetime, date
from enum import Enum
from collections import deque


JQ_BASE = "https://api.jquants.com/v1"
DATE_FORMATS = ("%Y-%m-%d", "%Y%m%d")
MA_WINDOWS = (5, 25, 75)

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


class Interval(str, Enum):
    daily = "daily"
    weekly = "weekly"
    monthly = "monthly"


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
    interval: Interval = Interval.daily
    ma5: Optional[float] = None
    ma25: Optional[float] = None
    ma75: Optional[float] = None
    volume_ma25: Optional[float] = None


def _normalize_stock(r: Dict[str, Any]) -> StockInfo:
    return StockInfo(
        code=r.get("Code"),
        name=r.get("CompanyName"),
        market=r.get("MarketCodeName"),
        industry=r.get("Sector17CodeName"),
    )


def _parse_date(value: str) -> date:
    for fmt in DATE_FORMATS:
        try:
            return datetime.strptime(value, fmt).date()
        except (TypeError, ValueError):
            continue
    raise ValueError(f"Unsupported date format: {value}")


def _to_float(value: Any) -> Optional[float]:
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _prepare_quotes(items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    quotes: List[Dict[str, Any]] = []
    for item in items:
        date_str = item.get("Date")
        if not date_str:
            continue
        try:
            dt = _parse_date(date_str)
        except ValueError:
            continue
        quotes.append(
            {
                "dt": dt,
                "Date": dt.strftime("%Y-%m-%d"),
                "Code": item.get("Code"),
                "Open": _to_float(item.get("Open")),
                "High": _to_float(item.get("High")),
                "Low": _to_float(item.get("Low")),
                "Close": _to_float(item.get("Close")),
                "Volume": _to_float(item.get("Volume")),
                "TurnoverValue": _to_float(item.get("TurnoverValue")),
                "interval": Interval.daily,
            }
        )
    quotes.sort(key=lambda q: q["dt"])
    return quotes


def _aggregate_quotes(quotes: List[Dict[str, Any]], interval: Interval) -> List[Dict[str, Any]]:
    if interval == Interval.daily:
        return [quote.copy() for quote in quotes]

    aggregated: List[Dict[str, Any]] = []
    bucket: List[Dict[str, Any]] = []
    current_key = None

    for quote in quotes:
        dt = quote["dt"]
        if interval == Interval.weekly:
            iso = dt.isocalendar()
            key = (iso.year, iso.week)
        else:
            key = (dt.year, dt.month)

        if key != current_key:
            if bucket:
                aggregated.append(_aggregate_bucket(bucket, interval))
            bucket = []
            current_key = key

        bucket.append(quote)

    if bucket:
        aggregated.append(_aggregate_bucket(bucket, interval))

    return aggregated


def _aggregate_bucket(bucket: List[Dict[str, Any]], interval: Interval) -> Dict[str, Any]:
    last = bucket[-1]

    def _first_valid(key: str) -> Optional[float]:
        for item in bucket:
            value = item.get(key)
            if value is not None:
                return value
        return None

    def _last_valid(key: str) -> Optional[float]:
        for item in reversed(bucket):
            value = item.get(key)
            if value is not None:
                return value
        return None

    high_values = [item.get("High") for item in bucket if item.get("High") is not None]
    low_values = [item.get("Low") for item in bucket if item.get("Low") is not None]

    return {
        "dt": last["dt"],
        "Date": last["Date"],
        "Code": last.get("Code"),
        "Open": _first_valid("Open"),
        "High": max(high_values) if high_values else None,
        "Low": min(low_values) if low_values else None,
        "Close": _last_valid("Close"),
        "Volume": sum(item.get("Volume") or 0 for item in bucket),
        "TurnoverValue": sum(item.get("TurnoverValue") or 0 for item in bucket),
        "interval": interval,
    }


def _apply_indicators(quotes: List[Dict[str, Any]]) -> None:
    ma_windows = {window: deque(maxlen=window) for window in MA_WINDOWS}
    volume_window = deque(maxlen=25)

    for quote in quotes:
        close = quote.get("Close")
        volume = quote.get("Volume")

        for window, cache in ma_windows.items():
            if close is None:
                cache.clear()
                quote[f"ma{window}"] = None
                continue
            cache.append(close)
            if len(cache) == window:
                quote[f"ma{window}"] = sum(cache) / window
            else:
                quote[f"ma{window}"] = None

        if volume is None:
            volume_window.clear()
            quote["volume_ma25"] = None
        else:
            volume_window.append(volume)
            if len(volume_window) == volume_window.maxlen:
                quote["volume_ma25"] = sum(volume_window) / volume_window.maxlen
            else:
                quote["volume_ma25"] = None


def _serialize_quotes(quotes: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    serialized: List[Dict[str, Any]] = []
    for quote in quotes:
        payload = {k: v for k, v in quote.items() if k != "dt"}
        serialized.append(payload)
    return serialized


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


@app.get("/daily/{code}", response_model=List[Daily])
def get_daily_stock_data(
    code: str,
    from_date: str = "20240620",
    to_date: str = "20250620",
    interval: Interval = Interval.daily,
):
    _, id_token = ensure_tokens()
    res = requests.get(
        f"{JQ_BASE}/prices/daily_quotes?code={code}&from={from_date}&to={to_date}",
        headers={"Authorization": f"Bearer {id_token}"},
    )
    res.raise_for_status()
    data = res.json()
    items = data.get("daily_quotes", [])
    quotes = _prepare_quotes(items)
    if not quotes:
        return []
    aggregated = _aggregate_quotes(quotes, interval)
    _apply_indicators(aggregated)
    serialized = _serialize_quotes(aggregated)
    return [Daily(**quote) for quote in serialized]
