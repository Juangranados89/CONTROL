import pandas as pd

def find_headers(file_path):
    print(f"--- Inspecting Headers in {file_path} ---")
    try:
        df = pd.read_excel(file_path, header=None)
        for r_idx, row in df.iterrows():
            first_cell = str(row[0]).strip().upper()
            if first_cell in ["ACEITES Y REFRIGERANTES", "REPUESTOS", "ACTIVIDADES"]:
                print(f"Found '{first_cell}' at Row {r_idx}")
    except Exception as e:
        print(f"Error: {e}")

find_headers('CAMIONETAS RAM.xlsx')
find_headers('CAMIONETAS JMC.xlsx')
