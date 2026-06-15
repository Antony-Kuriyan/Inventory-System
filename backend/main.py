import os
import sqlite3
import base64
import io
from datetime import datetime
from typing import Optional
from fastapi import FastAPI, HTTPException, UploadFile, File, Form, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import pandas as pd
from PIL import Image

# --- CONFIGURATION & PATHS ---
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(BASE_DIR, 'inventory.db')

app = FastAPI(title="Inventory Management System API")

# Enable CORS for React frontend (defaulting to localhost:5173)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For temporary/local setup, allow all origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- DATABASE SETUP & MIGRATION ---
def init_db():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    
    # Check if table exists and if it has UNIQUE constraint on part_number
    c.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name='items'")
    row = c.fetchone()
    if row:
        table_sql = row[0]
        if "UNIQUE" in table_sql and "part_number" in table_sql and "UNIQUE(part_number" not in table_sql:
            try:
                # 1. Create a temporary table with the new schema
                c.execute('''
                    CREATE TABLE IF NOT EXISTS items_new (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        part_number TEXT NOT NULL,
                        item_name TEXT NOT NULL,
                        warehouse TEXT NOT NULL,
                        bin_location TEXT NOT NULL,
                        quantity INTEGER DEFAULT 0,
                        image BLOB,
                        UNIQUE(part_number, warehouse, bin_location)
                    )
                ''')
                # 2. Copy data
                c.execute('INSERT INTO items_new (id, part_number, item_name, warehouse, bin_location, quantity, image) SELECT id, part_number, item_name, warehouse, bin_location, quantity, image FROM items')
                # 3. Drop old table
                c.execute('DROP TABLE items')
                # 4. Rename temporary table
                c.execute('ALTER TABLE items_new RENAME TO items')
                conn.commit()
            except Exception as e:
                print(f"Migration error: {e}")

    # Stock Items Table (with composite UNIQUE constraint)
    c.execute('''
        CREATE TABLE IF NOT EXISTS items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            part_number TEXT NOT NULL,
            item_name TEXT NOT NULL,
            warehouse TEXT NOT NULL,
            bin_location TEXT NOT NULL,
            quantity INTEGER DEFAULT 0,
            image BLOB,
            UNIQUE(part_number, warehouse, bin_location)
        )
    ''')
    
    # Stock Transfer Journal Table
    c.execute('''
        CREATE TABLE IF NOT EXISTS transfer_journal (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            voucher_number TEXT,
            part_number TEXT NOT NULL,
            item_name TEXT NOT NULL,
            from_warehouse TEXT NOT NULL,
            from_bin TEXT NOT NULL,
            to_warehouse TEXT NOT NULL,
            to_bin TEXT NOT NULL,
            quantity INTEGER NOT NULL,
            transfer_date TEXT NOT NULL
        )
    ''')
    
    # Schema Migration: Add voucher_number to transfer_journal if it doesn't exist
    c.execute("PRAGMA table_info(transfer_journal)")
    columns = [r[1] for r in c.fetchall()]
    if 'voucher_number' not in columns:
        try:
            c.execute("ALTER TABLE transfer_journal ADD COLUMN voucher_number TEXT")
            # Populate existing rows with default vouchers
            c.execute("SELECT id FROM transfer_journal")
            ids = [r[0] for r in c.fetchall()]
            for record_id in ids:
                c.execute("UPDATE transfer_journal SET voucher_number = ? WHERE id = ?", (f"STJ-MIGRATED-{record_id:04d}", record_id))
        except sqlite3.OperationalError:
            pass
            
    conn.commit()
    conn.close()

init_db()

def get_db_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

# --- API MODELS ---
class TransferPostRequest(BaseModel):
    source_item_id: int
    to_warehouse: str
    to_bin: str
    quantity: int

# --- API ENDPOINTS ---

@app.get("/api/items")
def list_items(search: Optional[str] = Query(None)):
    conn = get_db_conn()
    c = conn.cursor()
    if search:
        c.execute('''
            SELECT id, part_number, item_name, warehouse, bin_location, quantity 
            FROM items 
            WHERE item_name LIKE ? OR part_number LIKE ?
        ''', (f"%{search}%", f"%{search}%"))
    else:
        c.execute("SELECT id, part_number, item_name, warehouse, bin_location, quantity FROM items")
    
    rows = c.fetchall()
    conn.close()
    return [dict(row) for row in rows]

@app.get("/api/items/{part_number}")
def get_item_detail(part_number: str):
    conn = get_db_conn()
    c = conn.cursor()
    c.execute("SELECT id, part_number, item_name, warehouse, bin_location, quantity, image FROM items WHERE part_number = ?", (part_number,))
    rows = c.fetchall()
    conn.close()
    
    if not rows:
        raise HTTPException(status_code=404, detail="Item not found")
    
    # Extract item details and locate first non-empty image
    item_name = rows[0]["item_name"]
    image_bytes = None
    for row in rows:
        if row["image"]:
            image_bytes = row["image"]
            break
            
    image_b64 = None
    if image_bytes:
        image_b64 = base64.b64encode(image_bytes).decode('utf-8')
        
    locations = []
    total_qty = 0
    for row in rows:
        locations.append({
            "id": row["id"],
            "warehouse": row["warehouse"],
            "bin_location": row["bin_location"],
            "quantity": row["quantity"]
        })
        total_qty += row["quantity"]
        
    return {
        "part_number": part_number,
        "item_name": item_name,
        "total_quantity": total_qty,
        "image": image_b64,
        "locations": locations
    }

@app.post("/api/items")
async def add_item(
    part_number: str = Form(...),
    item_name: str = Form(...),
    warehouse: str = Form(...),
    bin_location: str = Form(...),
    quantity: int = Form(0),
    image: Optional[UploadFile] = File(None)
):
    part_number = part_number.strip()
    item_name = item_name.strip()
    warehouse = warehouse.strip()
    bin_location = bin_location.strip()
    
    if not part_number or not item_name or not warehouse or not bin_location:
        raise HTTPException(status_code=400, detail="Missing required fields")
        
    img_bytes = None
    if image:
        img_bytes = await image.read()
        
    conn = get_db_conn()
    c = conn.cursor()
    try:
        # Check if the part already exists at this exact location
        c.execute("SELECT id, quantity, image FROM items WHERE part_number = ? AND warehouse = ? AND bin_location = ?", 
                  (part_number, warehouse, bin_location))
        existing_loc = c.fetchone()
        
        if existing_loc:
            new_qty = existing_loc["quantity"] + quantity
            if img_bytes:
                c.execute("UPDATE items SET quantity = ?, image = ?, item_name = ? WHERE id = ?", 
                          (new_qty, img_bytes, item_name, existing_loc["id"]))
            else:
                c.execute("UPDATE items SET quantity = ?, item_name = ? WHERE id = ?", 
                          (new_qty, item_name, existing_loc["id"]))
            conn.commit()
            return {"status": "success", "message": f"Updated stock at {warehouse} ({bin_location}). New total: {new_qty}."}
        else:
            # Propagate image from other locations if none uploaded
            if not img_bytes:
                c.execute("SELECT image FROM items WHERE part_number = ? AND image IS NOT NULL LIMIT 1", (part_number,))
                other_img = c.fetchone()
                if other_img:
                    img_bytes = other_img["image"]
                    
            c.execute('''
                INSERT INTO items (part_number, item_name, warehouse, bin_location, quantity, image)
                VALUES (?, ?, ?, ?, ?, ?)
            ''', (part_number, item_name, warehouse, bin_location, quantity, img_bytes))
            conn.commit()
            return {"status": "success", "message": f"Added item {part_number} to {warehouse} ({bin_location})."}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

@app.delete("/api/items/{item_id}")
def delete_item(item_id: int):
    conn = get_db_conn()
    c = conn.cursor()
    try:
        c.execute("SELECT id FROM items WHERE id = ?", (item_id,))
        if not c.fetchone():
            raise HTTPException(status_code=404, detail="Item location record not found")
        c.execute("DELETE FROM items WHERE id = ?", (item_id,))
        conn.commit()
        return {"status": "success", "message": "Item location successfully removed"}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

@app.get("/api/transfers")
def get_transfers():
    conn = get_db_conn()
    c = conn.cursor()
    c.execute('''
        SELECT id, voucher_number, part_number, item_name, from_warehouse, from_bin, to_warehouse, to_bin, quantity, transfer_date 
        FROM transfer_journal 
        ORDER BY id DESC
    ''')
    rows = c.fetchall()
    conn.close()
    return [dict(row) for row in rows]

@app.get("/api/transfers/next-voucher")
def get_next_voucher():
    conn = get_db_conn()
    c = conn.cursor()
    today_date_str = datetime.now().strftime("%Y%m%d")
    today_start = datetime.now().strftime("%Y-%m-%d 00:00:00")
    c.execute("SELECT COUNT(*) FROM transfer_journal WHERE transfer_date >= ?", (today_start,))
    today_count = c.fetchone()[0]
    next_voucher = f"STJ-{today_date_str}-{(today_count + 1):04d}"
    conn.close()
    return {"voucher_number": next_voucher}

@app.post("/api/transfers")
def post_transfer(req: TransferPostRequest):
    conn = get_db_conn()
    c = conn.cursor()
    try:
        # Get source item details
        c.execute("SELECT part_number, item_name, warehouse, bin_location, quantity, image FROM items WHERE id = ?", (req.source_item_id,))
        source_item = c.fetchone()
        
        if not source_item:
            raise HTTPException(status_code=404, detail="Source item not found")
            
        if source_item["quantity"] < req.quantity:
            raise HTTPException(status_code=400, detail="Insufficient stock at source location")
            
        if source_item["warehouse"] == req.to_warehouse.strip() and source_item["bin_location"] == req.to_bin.strip():
            raise HTTPException(status_code=400, detail="Destination cannot be the same as the source location")
            
        # Get next voucher
        today_date_str = datetime.now().strftime("%Y%m%d")
        today_start = datetime.now().strftime("%Y-%m-%d 00:00:00")
        c.execute("SELECT COUNT(*) FROM transfer_journal WHERE transfer_date >= ?", (today_start,))
        today_count = c.fetchone()[0]
        voucher = f"STJ-{today_date_str}-{(today_count + 1):04d}"
        
        today_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        
        # 1. Log to transfer journal
        c.execute('''
            INSERT INTO transfer_journal (voucher_number, part_number, item_name, from_warehouse, from_bin, to_warehouse, to_bin, quantity, transfer_date)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (voucher, source_item["part_number"], source_item["item_name"], source_item["warehouse"], source_item["bin_location"], req.to_warehouse, req.to_bin, req.quantity, today_str))
        
        # 2. Update source row
        new_source_qty = source_item["quantity"] - req.quantity
        if new_source_qty == 0:
            c.execute("DELETE FROM items WHERE id = ?", (req.source_item_id,))
        else:
            c.execute("UPDATE items SET quantity = ? WHERE id = ?", (new_source_qty, req.source_item_id))
            
        # 3. Update or Insert destination row
        c.execute("SELECT id, quantity FROM items WHERE part_number = ? AND warehouse = ? AND bin_location = ?", 
                  (source_item["part_number"], req.to_warehouse, req.to_bin))
        dest_row = c.fetchone()
        
        if dest_row:
            c.execute("UPDATE items SET quantity = ? WHERE id = ?", (dest_row["quantity"] + req.quantity, dest_row["id"]))
        else:
            c.execute('''
                INSERT INTO items (part_number, item_name, warehouse, bin_location, quantity, image)
                VALUES (?, ?, ?, ?, ?, ?)
            ''', (source_item["part_number"], source_item["item_name"], req.to_warehouse, req.to_bin, req.quantity, source_item["image"]))
            
        conn.commit()
        return {"status": "success", "voucher_number": voucher, "message": f"Transferred {req.quantity} units successfully."}
    except HTTPException:
        conn.rollback()
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

@app.get("/api/transfers/analytics")
def get_analytics_summary():
    # Returns list of distinct part numbers that have transfers for analytics selector
    conn = get_db_conn()
    c = conn.cursor()
    c.execute("SELECT DISTINCT part_number, item_name FROM transfer_journal")
    rows = c.fetchall()
    conn.close()
    return [dict(row) for row in rows]

@app.get("/api/transfers/analytics/{part_number}")
def get_item_analytics(part_number: str):
    conn = get_db_conn()
    c = conn.cursor()
    c.execute('''
        SELECT voucher_number, from_warehouse, from_bin, to_warehouse, to_bin, quantity, transfer_date 
        FROM transfer_journal 
        WHERE part_number = ?
        ORDER BY transfer_date ASC
    ''', (part_number,))
    rows = [dict(row) for row in c.fetchall()]
    conn.close()
    
    if not rows:
        return {
            "total_transferred": 0,
            "num_transfers": 0,
            "max_transfer": 0,
            "timeline": [],
            "distribution": []
        }
        
    total_transferred = sum(r["quantity"] for r in rows)
    num_transfers = len(rows)
    max_transfer = max(r["quantity"] for r in rows)
    
    # 1. Timeline Chart Data (aggregate by date)
    timeline_dict = {}
    for r in rows:
        # Group by Date-Time clean string
        dt_str = datetime.strptime(r["transfer_date"], "%Y-%m-%d %H:%M:%S").strftime("%Y-%m-%d %H:%M")
        timeline_dict[dt_str] = timeline_dict.get(dt_str, 0) + r["quantity"]
        
    timeline = [{"date": k, "quantity": v} for k, v in sorted(timeline_dict.items())]
    
    # 2. Destination Distribution Chart Data
    dist_dict = {}
    for r in rows:
        dest = r["to_warehouse"]
        dist_dict[dest] = dist_dict.get(dest, 0) + r["quantity"]
        
    distribution = [{"destination": k, "quantity": v} for k, v in dist_dict.items()]
    
    return {
        "total_transferred": total_transferred,
        "num_transfers": num_transfers,
        "max_transfer": max_transfer,
        "timeline": timeline,
        "distribution": distribution,
        "history": rows
    }

@app.post("/api/import")
async def bulk_import(file: UploadFile = File(...)):
    filename = file.filename
    contents = await file.read()
    
    try:
        # Read Excel or CSV
        if filename.endswith(".csv"):
            import_df = pd.read_csv(io.BytesIO(contents))
        elif filename.endswith((".xlsx", ".xls")):
            import_df = pd.read_excel(io.BytesIO(contents))
        else:
            raise HTTPException(status_code=400, detail="Unsupported file format. Please upload CSV or Excel.")
            
        # Clean column names
        import_df.columns = [col.strip().lower() for col in import_df.columns]
        
        required_cols = ["part_number", "item_name", "warehouse", "bin_location"]
        missing_cols = [col for col in required_cols if col not in import_df.columns]
        
        if missing_cols:
            raise HTTPException(status_code=400, detail=f"Missing columns: {', '.join(missing_cols)}")
            
        # Parse quantity
        if "quantity" not in import_df.columns:
            import_df["quantity"] = 0
        else:
            import_df["quantity"] = pd.to_numeric(import_df["quantity"]).fillna(0).astype(int)
            
        conn = get_db_conn()
        c = conn.cursor()
        
        success_count = 0
        skipped_items = []
        
        for idx, row in import_df.iterrows():
            p_num = str(row["part_number"]).strip()
            i_name = str(row["item_name"]).strip()
            wh = str(row["warehouse"]).strip()
            bin_loc = str(row["bin_location"]).strip()
            qty = int(row["quantity"])
            
            if not p_num or p_num == "nan" or not i_name or i_name == "nan" or not wh or wh == "nan" or not bin_loc or bin_loc == "nan":
                skipped_items.append({
                    "part_number": p_num if p_num != "nan" else "",
                    "item_name": i_name if i_name != "nan" else "",
                    "reason": "Missing mandatory field values"
                })
                continue
                
            try:
                # Check if this part number already exists in this location
                c.execute("SELECT id, quantity FROM items WHERE part_number = ? AND warehouse = ? AND bin_location = ?", 
                          (p_num, wh, bin_loc))
                existing_loc = c.fetchone()
                
                if existing_loc:
                    c.execute("UPDATE items SET quantity = ? WHERE id = ?", (existing_loc["quantity"] + qty, existing_loc["id"]))
                    success_count += 1
                else:
                    # Fetch existing image if any
                    c.execute("SELECT image FROM items WHERE part_number = ? AND image IS NOT NULL LIMIT 1", (p_num,))
                    other_img = c.fetchone()
                    img_val = other_img["image"] if other_img else None
                    
                    c.execute('''
                        INSERT INTO items (part_number, item_name, warehouse, bin_location, quantity, image)
                        VALUES (?, ?, ?, ?, ?, ?)
                    ''', (p_num, i_name, wh, bin_loc, qty, img_val))
                    success_count += 1
            except Exception as e:
                skipped_items.append({
                    "part_number": p_num,
                    "item_name": i_name,
                    "reason": str(e)
                })
                
        conn.commit()
        conn.close()
        
        return {
            "status": "success",
            "success_count": success_count,
            "skipped_count": len(skipped_items),
            "skipped_items": skipped_items
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"File parsing error: {str(e)}")
