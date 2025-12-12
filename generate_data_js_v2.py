import json
import re

# Read extracted routines
with open('extracted_routines_v2.json', 'r') as f:
    extracted_data = json.load(f)

# Construct new routines object
new_routines = {}

# Helper to merge data
def merge_routine(interval, brand, data):
    # Fix RAM intervals (10 -> 10000)
    if brand == "RAM" and int(interval) < 1000:
        interval = int(interval) * 1000
    
    interval_key = str(interval)
    if interval_key not in new_routines:
        new_routines[interval_key] = {
            "name": f"Mantenimiento {int(interval):,} KM",
            "items": [], # Default empty base items
            "supplies": [],
            "variants": {}
        }
    
    new_routines[interval_key]["variants"][brand] = {
        "name": f"Mantenimiento {int(interval):,} KM ({brand})",
        "items": data["items"],
        "supplies": data["supplies"]
    }

# Process RAM
for interval, data in extracted_data.get("RAM", {}).items():
    merge_routine(interval, "RAM", data)

# Process JMC
for interval, data in extracted_data.get("JMC", {}).items():
    merge_routine(interval, "JMC", data)

# Sort keys
sorted_routines = dict(sorted(new_routines.items(), key=lambda item: int(item[0])))

# Convert to JS string
js_routines = "export const MAINTENANCE_ROUTINES = " + json.dumps(sorted_routines, indent=2, ensure_ascii=False) + ";"

# Read existing data.js
with open('src/data.js', 'r') as f:
    content = f.read()

# Find where MAINTENANCE_ROUTINES starts
match = re.search(r'export const MAINTENANCE_ROUTINES = \{', content)
if match:
    # Keep everything before
    new_content = content[:match.start()] + js_routines
    
    # Write back
    with open('src/data.js', 'w') as f:
        f.write(new_content)
    print("Successfully updated src/data.js")
else:
    print("Could not find MAINTENANCE_ROUTINES in src/data.js")
