import pandas as pd
import json
import re

def extract_data(file_path, brand):
    print(f"Extracting from {file_path} ({brand})...")
    df = pd.read_excel(file_path, header=None)
    
    # Header row is 18 (0-indexed)
    header_row_idx = 18
    header_row = df.iloc[header_row_idx]
    
    # Identify interval columns
    intervals = {}
    for idx, cell in enumerate(header_row):
        if idx < 7: continue # Skip first columns
        if pd.isna(cell): continue
        
        # Extract number from "PM1\n10.000KM" or "PM1\n7000 KM"
        s_cell = str(cell).replace('\n', ' ').upper()
        match = re.search(r'(\d+)[.,]?\d*\s*KM', s_cell)
        if match:
            km_str = match.group(1).replace('.', '').replace(',', '')
            try:
                km = int(km_str)
                intervals[idx] = km
            except:
                pass
    
    print(f"Found intervals: {list(intervals.values())}")
    
    routines = {}
    for km in intervals.values():
        routines[km] = {"items": [], "supplies": []}
        
    # Iterate data rows
    for r_idx in range(header_row_idx + 1, len(df)):
        row = df.iloc[r_idx]
        
        col0 = str(row[0]).strip() if not pd.isna(row[0]) else ""
        col1 = str(row[1]).strip() if not pd.isna(row[1]) else "" # Reference
        col6 = str(row[6]).strip() if not pd.isna(row[6]) else "1" # Quantity
        
        if not col0 or col0.lower() == "nan": continue
        
        # Check which intervals have 'X'
        for col_idx, km in intervals.items():
            val = str(row[col_idx]).strip().upper()
            if val == 'X':
                # It's part of this routine
                if col1 and col1.lower() != "nan":
                    # Supply
                    routines[km]["supplies"].append({
                        "name": col0,
                        "reference": col1,
                        "quantity": col6
                    })
                else:
                    # Activity
                    routines[km]["items"].append({
                        "description": col0,
                        "type": "Cambio" if "CAMBIAR" in col0.upper() else "Inspección"
                    })
                    
    return routines

all_data = {}
all_data["RAM"] = extract_data('CAMIONETAS RAM.xlsx', 'RAM')
all_data["JMC"] = extract_data('CAMIONETAS JMC.xlsx', 'JMC')

with open('extracted_routines_v2.json', 'w') as f:
    json.dump(all_data, f, indent=2, ensure_ascii=False)

print("Extraction complete. Saved to extracted_routines_v2.json")
