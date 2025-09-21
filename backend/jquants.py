import requests
from auth import ensure_tokens
import json
import pandas as pd

BASE = "https://api.jquants.com/v1"

refreshToken, idToken = ensure_tokens()

code = "7203"
from_date = "20240620"
to_date = "20250620"

headers = {"Authorization": "Bearer {}".format(idToken)}
res = requests.get(
    f"{BASE}/prices/daily_quotes?code={code}&from={from_date}&to={to_date}",
    headers=headers,
)
data = res.json()
items = data.get("daily_quotes", [])
df = pd.DataFrame(items)
print(df)
