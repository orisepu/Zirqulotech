from __future__ import annotations

from django.conf import settings

DEFAULT_APPLE_PRESETS = [
    {"product_id": 101, "tipo": "iPhone", "marca": "Apple"},
    {"product_id": 102, "tipo": "iPad", "marca": "Apple"},
    {"product_id": 103, "tipo": "Mac", "marca": "Apple"},
]

DEFAULT_EXTRA_PRESETS = [
    {
        "product_id": 104,
        "brand_id": 291,
        "tipo": "SmartPhone",
        "marca": "Google",
        # Excluye variantes no europeas (ej.: mmWave USA, Japón).
       "exclude_m_models": [
                            "G9S9B","GR1YH","GKWS6","GZPF0","G8V0U","GF5KQ","GQML3","G03Z5","GE2AE","GFE4J",
                            "G9BQD","G1MNW","GE9DP","G0B96",
                            
                            ],

    },
    {"product_id": 104, "brand_id": 100, "tipo": "SmartPhone", "marca": "Samsung",
     "exclude_m_models": ["SM-N971N","SM-N976U","SM-N9750","SM-N975U","SM-N975U1","SM-N9700","SM-N970U","SM-N970U1",
                            "SM-N981U","SM-N9860","SM-N986U","SM-N985F",
                            "SC-01L","SCV40","SM-N770F DSM"
                            "SM-N9600","SM-N9608","SM-N960N","SM-N960U","SM-N960U1","SM-N960W",
                            "SM-G977N","SM-G977U",
                            "SC-03L","SC-04L","SC-05L","SCV41","SCV42",
                            "SM-G9730","SM-G9738","SM-G973C","SM-G973U","SM-G973U1","SM-G973W",
                            "SM-G9700","SM-G9708","SM-G970N","SM-G970U","SM-G970U1","SM-G970W",
                            "SM-G9810","SM-G981N","SM-G981U","SM-G981V",
                            "SM-G7810","SM-G781N","SM-G781U","SM-G781V","SM-G781W",
                            "SM-G9860","SM-G986N","SM-G986U","SM-G986U1","SM-G986W",
                            "SCG03","SM-G9880","SM-G988N","SM-G988Q","SM-G988U","SM-G988U1","SM-G988W",

                            "SC-51B","SCG09","SM-G9910","SM-G991N","SM-G991U","SM-G991U1","SM-G991W",
                            "SM-G9900","SM-G990E","SM-G990N","SM-G990U","SM-G990U1","SM-G990V","SM-G990W",
                            "SCG10","SM-G9960","SM-G996N","SM-G996U","SM-G996U1","SM-G996W",
                            "SC-52B","SM-G9980","SM-G998N","SM-G998U","SM-G998U1","SM-G998W",

                            "SM-S9010","SM-S901E","SM-S901N","SM-S901U","SM-S901U1","SM-S901W",
                            "SM-S9060","SM-S906E","SM-S906N","SM-S906U","SM-S906U1","SM-S906W",
                            "SM-S9080","SM-S908E","SM-S908N","SM-S908U","SM-S908U1","SM-S908W",

                            "SM-S9160","SM-S916N","SM-S916U","SM-S916U1","SM-S916W",
                            "SM-S9110","SM-S911C","SM-S911N","SM-S911U","SM-S911U1","SM-S911W",
                            "SM-S9180","SM-S918N","SM-S918U","SM-S918U1","SM-S918W",

                            "SM-S9260","SM-S926N","SM-S926U","SM-S926U1","SM-S926W",
                            "SM-S9210","SM-S921J","SM-S921N","SM-S921U","SM-S921U1","SM-S921W",
                            "SM-S9280","SM-S928J","SM-S928N","SM-S928U","SM-S928U1","SM-S928W",

                            "SC-54B","SM-F711W",
                            "SC-54D","SCG23","SM-F7310","SM-F731D","SM-F731N","SM-F731U","SM-F731U1","SM-F731W",
                            "SM-F9160",
                            "SM-F9360","SM-F936N","SM-F936U","SM-F936U1","SM-F936W",
                            "SC-55D","SCG22","SM-F9460","SM-F946N","SM-F946U","SM-F946U1","SM-F946W"],
                            },
    {"product_id": 104, "brand_id": 304, "tipo": "SmartPhone", "marca": "Microsoft"},
]


def get_apple_presets() -> list[dict]:
    return list(getattr(settings, "LIKEWIZE_APPLE_PRESETS", DEFAULT_APPLE_PRESETS))


def get_extra_presets() -> list[dict]:
    return list(getattr(settings, "LIKEWIZE_EXTRA_PRESETS", DEFAULT_EXTRA_PRESETS))


def list_unique_brands(presets: list[dict]) -> list[str]:
    seen = {
        (preset.get("marca") or "").strip()
        for preset in presets
        if (preset.get("marca") or "").strip()
    }
    return sorted(seen)
