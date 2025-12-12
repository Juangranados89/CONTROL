import pandas as pd

def inspect_excel(file_path):
    print(f"--- Inspecting {file_path} ---")
    try:
        # Read the first sheet
        df = pd.read_excel(file_path, header=None)
        
        # Search for "ACEITE"
        print("Searching for 'ACEITE'...")
        for r_idx, row in df.iterrows():
            for c_idx, cell in enumerate(row):
                if isinstance(cell, str) and "ACEITE" in cell.upper():
                    print(f"Found 'ACEITE' at ({r_idx}, {c_idx}): {cell}")
                    # Print surrounding cells
                    print(f"  Row {r_idx}: {row.tolist()}")

    except Exception as e:
        print(f"Error: {e}")

inspect_excel('CAMIONETAS RAM.xlsx')
inspect_excel('CAMIONETAS JMC.xlsx')
