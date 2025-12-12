import pandas as pd

file = "CAMIONETAS RAM.xlsx"
sheet = "RUTINA PM1"

print(f"--- Analyzing {file} - {sheet} ---")
try:
    # Read rows 10 to 60
    df = pd.read_excel(file, sheet_name=sheet, header=None, skiprows=10, nrows=50)
    print(df.to_string())
except Exception as e:
    print(f"Error: {e}")
