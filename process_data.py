import pandas as pd
import json
import os

def extract_fleet():
    file_path = "3OT-PREVENTIVAS-ABRIL.xlsx"
    sheet_name = "FEYM511.00.CO"
    
    if not os.path.exists(file_path):
        print(f"File not found: {file_path}")
        return []

    try:
        # Read header from row 3 (0-indexed is 3)
        df = pd.read_excel(file_path, sheet_name=sheet_name, header=3)
        
        fleet = []
        for index, row in df.iterrows():
            if pd.isna(row.get('PLACA')):
                continue
                
            vehicle = {
                "id": index + 1,
                "code": str(row.get('CODIGO DEL EQUIPO', '')).strip(),
                "plate": str(row.get('PLACA', '')).strip(),
                "model": str(row.get('DESCRIPCIÓN.', '')).strip() or str(row.get('MODELO / LINEA', '')).strip(),
                "year": row.get('AÑO MODELO', 2020),
                "mileage": row.get('HR/KM INICIAL (REVISAR)', 0),
                "status": row.get('ESTADO ACTUAL', 'Activo'),
                "lastMaintenance": 0, # Default as not found in this sheet
                "driver": str(row.get('OPERADOR ASIGNADO', 'Sin Asignar')).strip(),
                "vin": str(row.get('SERIE CHASIS / VIN', '')).strip()
            }
            
            # Clean up mileage
            try:
                vehicle['mileage'] = int(vehicle['mileage'])
            except:
                vehicle['mileage'] = 0
                
            fleet.append(vehicle)
            
        return fleet
    except Exception as e:
        print(f"Error extracting fleet: {e}")
        return []

def extract_routines():
    file_path = "CAMIONETAS RAM.xlsx"
    routines = {}
    
    if not os.path.exists(file_path):
        print(f"File not found: {file_path}")
        return {}

    pm_sheets = {
        "PM1": 10000,
        "PM2": 20000,
        "PM3": 30000,
        "PM4": 50000
    }
    
    for pm_name, km in pm_sheets.items():
        sheet_name = f"RUTINA {pm_name}"
        try:
            # Read without header to access by index
            df = pd.read_excel(file_path, sheet_name=sheet_name, header=None)
            
            items = []
            # Tasks start around row 30, col 1
            start_row = 30
            col_idx = 1
            
            for i in range(start_row, len(df)):
                task = df.iloc[i, col_idx]
                if pd.isna(task):
                    continue
                
                task_str = str(task).strip()
                if not task_str:
                    continue
                    
                # Stop if we hit footer info (heuristic)
                if "OBSERVACIONES" in task_str or "FIRMA" in task_str:
                    break
                    
                items.append({
                    "description": task_str,
                    "type": "Preventivo" if "CAMBIAR" in task_str else "Inspección"
                })
            
            # Extract Supplies (Rows 20-24 approx)
            supplies = []
            
            for i in range(20, 25):
                supply_desc = df.iloc[i, 2] # Column 2 seems to be Description based on inspection
                if not pd.isna(supply_desc):
                     supplies.append(str(supply_desc).strip())
                     
                # Also check Lubricants on the right side?
                # Row 20, col 8 (approx)
                lubricant = df.iloc[i, 8]
                if not pd.isna(lubricant) and "OK" not in str(lubricant):
                     supplies.append(str(lubricant).strip())

            routines[km] = {
                "name": f"Mantenimiento {pm_name} ({km} km)",
                "items": items,
                "supplies": supplies
            }
            
        except Exception as e:
            print(f"Error extracting {pm_name}: {e}")
            
    return routines

def main():
    fleet = extract_fleet()
    routines = extract_routines()
    
    js_content = f"""
// DATA GENERATED FROM EXCEL FILES
export const INITIAL_FLEET = {json.dumps(fleet, indent=2)};

export const MAINTENANCE_ROUTINES = {json.dumps(routines, indent=2)};
"""
    
    with open("src/data.js", "w", encoding="utf-8") as f:
        f.write(js_content)
    
    print("Successfully generated src/data.js")

if __name__ == "__main__":
    main()
