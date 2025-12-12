import pandas as pd
import os

files = ["CAMIONETAS RAM.xlsx", "CAMIONETAS JMC.xlsx"]

for file in files:
    print(f"--- Analyzing {file} ---")
    if not os.path.exists(file):
        print("File not found")
        continue
    
    try:
        xl = pd.ExcelFile(file)
        print(f"Sheets: {xl.sheet_names}")
        
        for sheet in xl.sheet_names:
            print(f"\nSheet: {sheet}")
            df = pd.read_excel(file, sheet_name=sheet, nrows=10)
            print(df.to_string())
            print("-" * 20)
    except Exception as e:
        print(f"Error reading {file}: {e}")
