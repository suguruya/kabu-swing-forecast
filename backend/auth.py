import os
from dotenv import load_dotenv, find_dotenv, set_key
import requests


BASE = "https://api.jquants.com/v1"

load_dotenv(find_dotenv(), override=True)

MAIL = os.getenv("JQ_MAIL")
PASSWORD = os.getenv("JQ_PASSWORD")
REFRESH_TOKEN = os.getenv("JQ_REFRESH_TOKEN")


# 新しい idToken を発行するための鍵を取得。（約1週間有効）
def get_refresh_token() -> str:
    data = {"mailaddress": MAIL, "password": PASSWORD}
    res = requests.post(f"{BASE}/token/auth_user", json=data)
    res.raise_for_status()
    refresh_token = res.json()["refreshToken"]
    return refresh_token


# リフレッシュトークンから新しい idToken を取得。（有効24時間）
def get_id_token(refresh_token: str) -> str:  # type: ignore
    res = requests.post(
        f"{BASE}/token/auth_refresh", params={"refreshtoken": refresh_token}
    )
    res.raise_for_status()
    return res.json()["idToken"]


# 必要ならトークンを更新して返す
def ensure_tokens() -> tuple[str, str]:
    global REFRESH_TOKEN
    refresh = REFRESH_TOKEN

    try:
        id_token = get_id_token(refresh)  # type: ignore
    except requests.HTTPError as e:
        # 期限切れで失敗したらリフレッシュトークンを再取得して再挑戦
        refresh = get_refresh_token()
        env_path = find_dotenv() or ".env"
        print(f"Updating .env file at {env_path}")
        set_key(env_path, "JQ_REFRESH_TOKEN", refresh)
        REFRESH_TOKEN = refresh
        id_token = get_id_token(refresh)

    return refresh, id_token  # type: ignore


if __name__ == "__main__":
    refresh, id_token = ensure_tokens()
