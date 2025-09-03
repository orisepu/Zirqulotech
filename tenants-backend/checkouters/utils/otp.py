# utils/otp.py
import secrets, hashlib, hmac, time
from django.conf import settings

def generar_otp(num_digits=6):
    return f"{secrets.randbelow(10**num_digits):0{num_digits}d}"

def hash_otp(otp: str) -> str:
    key = (getattr(settings, "OTP_SECRET", None) or settings.SECRET_KEY).encode()
    return hmac.new(key, otp.encode(), hashlib.sha256).hexdigest()

def check_otp(otp: str, otp_hash: str) -> bool:
    return hmac.compare_digest(hash_otp(otp), otp_hash)
