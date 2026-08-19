import urllib.request
import sys

try:
    url = "http://localhost:8000/index.html"
    print(f"Loading {url}...")
    with urllib.request.urlopen(url, timeout=5) as response:
        html = response.read().decode('utf-8')
        
        # Verify essential updated content elements
        verifications = {
            "Kate Greatness": "Kate Greatness in roster",
            "Kirill Greatness": "Kirill Greatness in roster",
            "Antonio Banderras": "Antonio Banderras in roster",
            "14/15": "Cars count (14/15)",
            "47/50": "Members count (47/50)",
            "LVL 14": "Family level 14",
            "7 Рівень": "TC Level 7",
            "Steelbilt 389 (JH68 / SQ74)": "Steelbilt in TC fleet",
            "Ceterpilort ST680 (88AT / UN77 / 99VD)": "Ceterpilort in TC fleet",
            "Fraitliner N2 (33UF)": "Fraitliner in TC fleet",
            "Ubermacht X7": "Ubermacht X7 in family fleet",
            "Benefactor AWG H63 6x6": "AWG 6x6 in family fleet",
            "Chawrole Carvotte ZR1": "ZR1 in family fleet",
            "Vapid GS Superia": "GS Superia in family fleet",
            "Buntley Convidenal GT": "Buntley in family fleet",
            "Pfister Teycan": "Pfister Taycan in family fleet",
            "вік 30+ років": "Requirement Age 30+",
            "рівень: 10+ LVL": "Requirement Level 10+",
            "дотримання правил сім'ї": "Requirement Follow rules",
            "assets/logo.svg": "SVG Logo inclusion"
        }
        
        failures = []
        for term, desc in verifications.items():
            if term.lower() in html.lower():
                print(f"[PASS] {desc}")
            else:
                failures.append(f"[FAIL] {desc} (Expected text: '{term}')")
                
        if failures:
            print("\nVerification failures found:")
            for f in failures:
                print(f)
            sys.exit(1)
        else:
            print("\nAll HTML verifications passed successfully!")
            sys.exit(0)

except Exception as e:
    print(f"Error loading website: {e}")
    sys.exit(1)
