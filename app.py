import streamlit as st
import sqlite3
import pandas as pd
from PIL import Image
import io
from datetime import datetime

# --- DATABASE SETUP ---
def init_db():
    conn = sqlite3.connect('inventory.db')
    c = conn.cursor()
    
    # Schema Migration: Remove UNIQUE constraint on part_number, making it UNIQUE(part_number, warehouse, bin_location)
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
                pass

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
    columns = [row[1] for row in c.fetchall()]
    if 'voucher_number' not in columns:
        try:
            c.execute("ALTER TABLE transfer_journal ADD COLUMN voucher_number TEXT")
            # Populate existing rows with default vouchers
            c.execute("SELECT id FROM transfer_journal")
            ids = [row[0] for row in c.fetchall()]
            for record_id in ids:
                c.execute("UPDATE transfer_journal SET voucher_number = ? WHERE id = ?", (f"STJ-MIGRATED-{record_id:04d}", record_id))
        except sqlite3.OperationalError:
            pass
            
    conn.commit()
    conn.close()

init_db()

# --- HELPER FUNCTIONS ---
def get_db_connection():
    return sqlite3.connect('inventory.db')

# --- APP INTERFACE ---
st.set_page_config(page_title="Inventory Management System", layout="wide")

# --- CUSTOM CSS FOR PREMIUM LOOK ---
st.markdown("""
<style>
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap');

    /* Global Body styling - Light Slate/Time:minder Theme */
    html, body, [class*="css"], .stApp {
        font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif !important;
        background-color: #f6f8fa !important;
        color: #1e293b !important;
    }

    /* Main Container Padding */
    .block-container {
        padding-left: 3rem !important;
        padding-right: 3rem !important;
        padding-top: 2.5rem !important;
    }

    /* Top main title styling */
    h1 {
        color: #0f172a !important;
        font-weight: 800 !important;
        letter-spacing: -0.03em !important;
        padding-bottom: 15px !important;
        margin-bottom: 25px !important;
        border-bottom: 1px solid rgba(0, 0, 0, 0.06) !important;
        background: none !important;
        -webkit-text-fill-color: initial !important;
    }

    /* Subheaders */
    h2, h3 {
        color: #0f172a !important;
        font-weight: 700 !important;
        letter-spacing: -0.02em !important;
        margin-top: 20px !important;
        margin-bottom: 15px !important;
    }

    /* Sidebar background matching the Time:minder app */
    section[data-testid="stSidebar"] {
        background-color: #eff1f4 !important;
        border-right: 1px solid rgba(0, 0, 0, 0.05) !important;
        box-shadow: none !important;
    }

    /* Sidebar title or logo container */
    .sidebar-logo {
        font-size: 1.4rem;
        font-weight: 700;
        color: #0f172a;
        margin-bottom: 25px;
        display: flex;
        align-items: center;
        gap: 10px;
    }

    /* Sidebar Status Box (similar to dribbble shot box in the image) */
    .sidebar-status-box {
        background: #9fa6b5;
        border-radius: 12px;
        padding: 16px;
        color: #ffffff;
        margin-bottom: 25px;
        box-shadow: 0 4px 10px rgba(0, 0, 0, 0.03);
    }

    /* Sidebar Radio Navigation as custom clean vertical links */
    div[data-testid="stSidebar"] [data-testid="stRadio"] > label {
        display: none !important;
    }
    div[data-testid="stSidebar"] [data-testid="stRadio"] [role="radiogroup"] {
        gap: 8px !important;
        padding-top: 10px !important;
    }
    div[data-testid="stSidebar"] [data-testid="stRadio"] [role="radiogroup"] label {
        background: transparent !important;
        border: 1px solid transparent !important;
        border-radius: 10px !important;
        padding: 12px 18px !important;
        width: 100% !important;
        transition: all 0.2s ease !important;
        cursor: pointer !important;
        margin-bottom: 0px !important;
        display: flex !important;
        align-items: center !important;
    }
    div[data-testid="stSidebar"] [data-testid="stRadio"] [role="radiogroup"] label:hover {
        background: rgba(0, 0, 0, 0.02) !important;
        transform: none !important;
    }
    div[data-testid="stSidebar"] [data-testid="stRadio"] [role="radiogroup"] label div[data-testid="stWidgetLabel"] > div:first-child {
        display: none !important;
    }
    div[data-testid="stSidebar"] [data-testid="stRadio"] [role="radiogroup"] label [data-testid="stMarkdownContainer"] p {
        color: #556070 !important;
        font-weight: 500 !important;
        font-size: 0.95rem !important;
    }
    
    /* Active State matching white card with shadow */
    div[data-testid="stSidebar"] [data-testid="stRadio"] [role="radiogroup"] label[data-checked="true"] {
        background: #ffffff !important;
        border: 1px solid rgba(0, 0, 0, 0.03) !important;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.04), 0 2px 4px rgba(0, 0, 0, 0.02) !important;
    }
    div[data-testid="stSidebar"] [data-testid="stRadio"] [role="radiogroup"] label[data-checked="true"] [data-testid="stMarkdownContainer"] p {
        color: #0f172a !important;
        font-weight: 600 !important;
    }

    /* Form container style as white card */
    div[data-testid="stForm"] {
        background: #ffffff !important;
        border: 1px solid rgba(0, 0, 0, 0.05) !important;
        border-radius: 16px !important;
        padding: 30px !important;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.015), 0 1px 3px rgba(0, 0, 0, 0.005) !important;
        margin-top: 15px;
    }

    /* Custom input/select formatting for light theme */
    div[data-baseweb="input"], div[data-baseweb="select"], .stNumberInput input, textarea {
        background-color: #fcfdfe !important;
        border: 1px solid #e2e8f0 !important;
        border-radius: 10px !important;
        color: #0f172a !important;
        transition: all 0.25s ease !important;
    }

    div[data-baseweb="input"]:focus-within, div[data-baseweb="select"]:focus-within {
        border-color: #94a3b8 !important;
        box-shadow: 0 0 0 2px rgba(148, 163, 184, 0.12) !important;
    }

    /* Form label font weights */
    label, [data-testid="stWidgetLabel"] {
        font-weight: 600 !important;
        color: #475569 !important;
        font-size: 0.92rem !important;
        margin-bottom: 8px !important;
    }

    /* Button styles (dark slate button like in the image) */
    button[kind="secondaryFormSubmit"], button[kind="primary"], button[data-testid="baseButton-secondary"] {
        background: #0f172a !important;
        color: #ffffff !important;
        border: none !important;
        font-weight: 600 !important;
        border-radius: 10px !important;
        padding: 10px 24px !important;
        transition: all 0.2s ease !important;
        box-shadow: 0 4px 10px rgba(15, 23, 42, 0.1) !important;
        width: auto !important;
    }

    button[kind="secondaryFormSubmit"]:hover, button[kind="primary"]:hover, button[data-testid="baseButton-secondary"]:hover {
        background: #1e293b !important;
        box-shadow: 0 6px 14px rgba(15, 23, 42, 0.18) !important;
        transform: translateY(-1px) !important;
    }

    /* Tabs formatting */
    button[data-baseweb="tab"] {
        color: #64748b !important;
        font-weight: 600 !important;
        border-bottom-width: 2px !important;
        transition: all 0.25s ease !important;
        padding: 10px 20px !important;
    }

    button[data-baseweb="tab"][aria-selected="true"] {
        color: #0f172a !important;
        border-bottom-color: #0f172a !important;
    }

    /* Alerts and notifications */
    div[data-testid="stNotification"] {
        border-radius: 10px !important;
        border: 1px solid rgba(0, 0, 0, 0.05) !important;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.015) !important;
        background-color: #ffffff !important;
    }

    div[data-testid="stNotification"] [data-testid="stNotificationContentSuccess"] {
        background-color: rgba(16, 185, 129, 0.04) !important;
        border-left: 4px solid #10b981 !important;
        color: #065f46 !important;
    }

    /* Styled dataframes */
    div[data-testid="stDataFrame"] {
        border: 1px solid rgba(0, 0, 0, 0.05) !important;
        border-radius: 12px !important;
        overflow: hidden !important;
        background-color: #ffffff !important;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.015) !important;
    }

    /* Detail & Photo Viewer Layout styles */
    .viewer-card {
        background: #ffffff;
        border: 1px solid rgba(0, 0, 0, 0.05);
        border-radius: 16px;
        padding: 24px;
        margin-top: 15px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.015);
    }
    
    /* Image frames */
    div[data-testid="stImage"] img {
        border-radius: 12px !important;
        border: 1px solid rgba(0, 0, 0, 0.05) !important;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05) !important;
    }
    
    /* Checkbox labels style */
    div[data-testid="stCheckbox"] label {
        font-weight: 500 !important;
        color: #475569 !important;
    }

    /* Mobile Responsive Optimizations */
    @media (max-width: 768px) {
        /* Reduce form padding so it fits screens nicely */
        div[data-testid="stForm"] {
            padding: 16px !important;
        }

        /* Scale down title sizes slightly to prevent excessive text wrapping */
        h1 {
            font-size: 1.8rem !important;
            padding-bottom: 8px !important;
            margin-bottom: 15px !important;
        }
        h2 {
            font-size: 1.4rem !important;
        }
        h3 {
            font-size: 1.2rem !important;
        }

        /* Ensure images take up full container width on smaller screens */
        div[data-testid="stImage"] img {
            width: 100% !important;
            height: auto !important;
            max-width: 100% !important;
        }
        
        /* Adjust global margins */
        .block-container {
            padding-left: 1rem !important;
            padding-right: 1rem !important;
            padding-top: 2rem !important;
        }
    }
</style>
""", unsafe_allow_html=True)

# Sidebar Header Logo & Status Box (matching Time:minder theme)
st.sidebar.markdown("""
<div class="sidebar-logo">
    <span style="font-size: 1.5rem;">⏱️</span>
    <span><strong>Inventory:</strong>minder</span>
</div>
<div class="sidebar-status-box">
    <div style="font-size: 0.8rem; opacity: 0.85; margin-bottom: 4px; font-weight: 500;">Active Session</div>
    <div style="font-size: 1.15rem; font-weight: 700; display: flex; justify-content: space-between; align-items: center;">
        <span>System Sync</span>
        <span style="background: #ffffff; color: #9fa6b5; border-radius: 50%; width: 22px; height: 22px; display: inline-flex; align-items: center; justify-content: center; font-size: 0.75rem; font-weight: bold; cursor: default;">II</span>
    </div>
</div>
""", unsafe_allow_html=True)

st.title("📦 Advanced Inventory Management System")

# Sidebar Navigation
menu = ["📋 View Inventory", "➕ Add / Delete Stock Item", "🔄 Stock Transfer Journal"]
choice_raw = st.sidebar.radio("Navigation Menu", menu)

# Map choices back to the original layout names
choice_map = {
    "📋 View Inventory": "View Inventory",
    "➕ Add / Delete Stock Item": "Add / Delete Stock Item",
    "🔄 Stock Transfer Journal": "Stock Transfer Journal"
}
choice = choice_map[choice_raw]

# --- 1. VIEW INVENTORY ---
if choice == "View Inventory":
    st.header("📋 Current Stock Status")
    
    conn = get_db_connection()
    df = pd.read_sql_query("SELECT id, part_number, item_name, warehouse, bin_location, quantity FROM items", conn)
    
    if df.empty:
        st.info("No items in inventory yet. Go to 'Add / Delete Stock Item' to add some!")
    else:
        # Search filter
        search = st.text_input("🔍 Search by Item Name or Part Number")
        if search:
            df = df[df['item_name'].str.contains(search, case=False) | df['part_number'].str.contains(search, case=False)]
        
        st.dataframe(df, use_container_width=True)
        
        # Detail & Photo Viewer Row
        st.markdown("---")
        st.subheader("🖼️ Item Details & Photo Viewer")
        selected_part = st.selectbox("Select a Part Number to view details & photo:", df['part_number'].unique().tolist())
        
        if selected_part:
            c = conn.cursor()
            c.execute("SELECT image, item_name, warehouse, bin_location, quantity FROM items WHERE part_number = ?", (selected_part,))
            rows = c.fetchall()
            
            if rows:
                image_data = None
                for r in rows:
                    if r[0]:
                        image_data = r[0]
                        break
                
                col1, col2 = st.columns([1, 2])
                with col1:
                    if image_data:
                        image = Image.open(io.BytesIO(image_data))
                        st.image(image, caption=f"{rows[0][1]} ({selected_part})", use_container_width=True)
                    else:
                        st.warning("No photo available for this item.")
                with col2:
                    st.write(f"**Item Name:** {rows[0][1]}")
                    total_qty = sum(r[4] for r in rows)
                    st.write(f"**Total Stock Across All Locations:** `{total_qty}`")
                    st.write("**Location Breakdown:**")
                    
                    loc_df = pd.DataFrame([
                        {"Warehouse": r[2], "Bin Location": r[3], "Quantity": r[4]}
                        for r in rows
                    ])
                    st.table(loc_df)
    conn.close()

# --- 2. ADD / DELETE STOCK ITEM ---
elif choice == "Add / Delete Stock Item":
    tab1, tab2, tab3 = st.tabs(["➕ Add New Item / Increase Stock", "📤 Bulk Import (Excel/CSV)", "❌ Delete Item"])
    
    with tab1:
        st.header("Add Stock Item")
        with st.form("add_form", clear_on_submit=True):
            part_number = st.text_input("Part Number (e.g., P-100)*")
            item_name = st.text_input("Item Name*")
            warehouse = st.text_input("Warehouse Name/Code (e.g., WH-Alpha)*")
            bin_location = st.text_input("Bin Location (e.g., Row-A, Bin-12)*")
            quantity = st.number_input("Initial Quantity", min_value=0, step=1)
            uploaded_file = st.file_uploader("Upload Item Photo", type=["jpg", "jpeg", "png"])
            
            submitted = st.form_submit_button("Save Item to Inventory")
            
            if submitted:
                if not part_number or not item_name or not warehouse or not bin_location:
                    st.error("Please fill out all mandatory fields (*)")
                else:
                    img_bytes = None
                    if uploaded_file is not None:
                        img_bytes = uploaded_file.read()
                        
                    conn = get_db_connection()
                    c = conn.cursor()
                    try:
                        # Check if this part number already exists in this specific location
                        c.execute("SELECT id, quantity, image FROM items WHERE part_number = ? AND warehouse = ? AND bin_location = ?", (part_number, warehouse, bin_location))
                        existing_loc = c.fetchone()
                        
                        if existing_loc:
                            # Update quantity and optionally update image if new one is uploaded
                            new_qty = existing_loc[1] + quantity
                            if img_bytes:
                                c.execute("UPDATE items SET quantity = ?, image = ?, item_name = ? WHERE id = ?", (new_qty, img_bytes, item_name, existing_loc[0]))
                            else:
                                c.execute("UPDATE items SET quantity = ?, item_name = ? WHERE id = ?", (new_qty, item_name, existing_loc[0]))
                            st.success(f"Successfully updated stock for '{item_name}' at {warehouse} ({bin_location}). New total: {new_qty}!")
                        else:
                            # If no image uploaded, check if image exists in other locations of the same part
                            if not img_bytes:
                                c.execute("SELECT image FROM items WHERE part_number = ? AND image IS NOT NULL LIMIT 1", (part_number,))
                                other_img = c.fetchone()
                                if other_img:
                                    img_bytes = other_img[0]
                                    
                            c.execute('''
                                INSERT INTO items (part_number, item_name, warehouse, bin_location, quantity, image)
                                VALUES (?, ?, ?, ?, ?, ?)
                            ''', (part_number, item_name, warehouse, bin_location, quantity, img_bytes))
                            st.success(f"Successfully added '{item_name}' into inventory at {warehouse} ({bin_location})!")
                        conn.commit()
                    except Exception as e:
                        st.error(f"Error saving item: {str(e)}")
                    finally:
                        conn.close()
                        
    with tab2:
        st.header("📤 Bulk Import Items")
        st.markdown("""
        Upload an Excel (`.xlsx`, `.xls`) or CSV (`.csv`) file to import multiple items at once.
        The file must have the following headers:
        - `part_number` (Unique Identifier)
        - `item_name` (Item Description)
        - `warehouse` (Warehouse name/code)
        - `bin_location` (Bin location/code)
        - `quantity` (Initial stock quantity, optional - defaults to 0)
        """)
        
        # Download Template Button
        template_df = pd.DataFrame(columns=["part_number", "item_name", "warehouse", "bin_location", "quantity"])
        template_csv = template_df.to_csv(index=False)
        st.download_button(
            label="Download Import Template (CSV)",
            data=template_csv,
            file_name="inventory_import_template.csv",
            mime="text/csv"
        )
        
        uploaded_import_file = st.file_uploader("Choose an Excel or CSV file", type=["csv", "xlsx", "xls"])
        
        if uploaded_import_file is not None:
            # Read file depending on type
            try:
                if uploaded_import_file.name.endswith(".csv"):
                    import_df = pd.read_csv(uploaded_import_file)
                else:
                    import_df = pd.read_excel(uploaded_import_file)
                    
                # Clean column names (strip spaces and convert to lowercase)
                import_df.columns = [col.strip().lower() for col in import_df.columns]
                
                # Check required columns
                required_cols = ["part_number", "item_name", "warehouse", "bin_location"]
                missing_cols = [col for col in required_cols if col not in import_df.columns]
                
                if missing_cols:
                    st.error(f"Missing required columns in uploaded file: {', '.join(missing_cols)}")
                else:
                    # Quantity column optional
                    if "quantity" not in import_df.columns:
                        import_df["quantity"] = 0
                    else:
                        import_df["quantity"] = pd.to_numeric(import_df["quantity"]).fillna(0).astype(int)
                        
                    # Show preview
                    st.subheader("📋 Import Data Preview")
                    st.dataframe(import_df, use_container_width=True)
                    
                    if st.button("Proceed with Import", type="primary"):
                        conn = get_db_connection()
                        c = conn.cursor()
                        
                        success_count = 0
                        skipped_items = []
                        
                        for idx, row in import_df.iterrows():
                            p_num = str(row["part_number"]).strip()
                            i_name = str(row["item_name"]).strip()
                            wh = str(row["warehouse"]).strip()
                            bin_loc = str(row["bin_location"]).strip()
                            qty = int(row["quantity"])
                            
                            # Skip if blank/nan
                            if not p_num or p_num == "nan" or not i_name or i_name == "nan" or not wh or wh == "nan" or not bin_loc or bin_loc == "nan":
                                skipped_items.append({
                                    "part_number": p_num if p_num != "nan" else "",
                                    "item_name": i_name if i_name != "nan" else "",
                                    "reason": "Missing mandatory field values"
                                })
                                continue
                                
                            try:
                                # Check if this part number already exists in this location
                                c.execute("SELECT id, quantity FROM items WHERE part_number = ? AND warehouse = ? AND bin_location = ?", (p_num, wh, bin_loc))
                                existing_loc = c.fetchone()
                                
                                if existing_loc:
                                    # Update quantity
                                    c.execute("UPDATE items SET quantity = ? WHERE id = ?", (existing_loc[1] + qty, existing_loc[0]))
                                    success_count += 1
                                else:
                                    # Try to fetch existing image for this part number from other locations
                                    c.execute("SELECT image FROM items WHERE part_number = ? AND image IS NOT NULL LIMIT 1", (p_num,))
                                    other_img = c.fetchone()
                                    img_val = other_img[0] if other_img else None
                                    
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
                        
                        if success_count > 0:
                            st.success(f"Successfully imported {success_count} item(s)!")
                        
                        if skipped_items:
                            st.warning(f"Skipped {len(skipped_items)} item(s) due to validation errors or duplicates.")
                            st.dataframe(pd.DataFrame(skipped_items), use_container_width=True)
                            
            except Exception as e:
                st.error(f"Error parsing file: {str(e)}")
                        
    with tab3:
        st.header("Delete Item")
        conn = get_db_connection()
        c = conn.cursor()
        c.execute("SELECT id, part_number, item_name, warehouse, bin_location, quantity FROM items")
        item_list = [f"{row[1]} - {row[2]} (Wh: {row[3]} / Bin: {row[4]}) | Stock: {row[5]} | ID: {row[0]}" for row in c.fetchall()]
        
        if not item_list:
            st.info("No items available to delete.")
        else:
            selected_item_to_delete = st.selectbox("Select Item Location to completely remove:", item_list)
            delete_id = int(selected_item_to_delete.split(" | ID: ")[-1])
            
            confirm_delete = st.checkbox("I confirm I want to permanently delete this item location and its records.")
            
            if st.button("Delete Item Permanently", type="primary"):
                if confirm_delete:
                    c.execute("DELETE FROM items WHERE id = ?", (delete_id,))
                    conn.commit()
                    st.success("Item location successfully removed.")
                    st.rerun()
                else:
                    st.error("Please check the confirmation box before deleting.")
        conn.close()

# --- 3. STOCK TRANSFER JOURNAL ---
elif choice == "Stock Transfer Journal":
    st.header("🔄 Stock Transfer Journal")
    
    tab1, tab2, tab3 = st.tabs(["⚡ Record New Transfer", "📜 View Transfer History", "📊 Transfer Analytics"])
    
    conn = get_db_connection()
    c = conn.cursor()
    
    with tab1:
        st.subheader("Move Stock Between Warehouse / Bins")
        
        # Fetch existing items for transfer dropdown
        c.execute("SELECT id, part_number, item_name, warehouse, bin_location, quantity, image FROM items")
        items_pool = c.fetchall()
        
        if not items_pool:
            st.info("No stock available to transfer.")
        else:
            selected_item = st.selectbox(
                "Select Item to Transfer:",
                items_pool,
                format_func=lambda r: f"{r[1]} | {r[2]} (Wh: {r[3]} / Bin: {r[4]}) | Stock: {r[5]}"
            )
            
            # Extract basic selected item info
            source_item_id = selected_item[0]
            sel_part_no = selected_item[1]
            source_item_name = selected_item[2]
            from_warehouse = selected_item[3]
            from_bin = selected_item[4]
            source_item_qty = selected_item[5]
            source_item_image = selected_item[6]
            
            st.markdown(f"**Current Allocation:** Warehouse: `{from_warehouse}` | Bin Location: `{from_bin}`")
            
            # Auto-calculate sequential voucher number for today
            today_date_str = datetime.now().strftime("%Y%m%d")
            today_start = datetime.now().strftime("%Y-%m-%d 00:00:00")
            c.execute("SELECT COUNT(*) FROM transfer_journal WHERE transfer_date >= ?", (today_start,))
            today_count = c.fetchone()[0]
            next_voucher = f"STJ-{today_date_str}-{(today_count + 1):04d}"
            
            st.info(f"📋 **Next Generated Voucher Number:** `{next_voucher}`")
            
            col1, col2 = st.columns(2)
            with col1:
                to_warehouse = st.text_input("Destination Warehouse*")
                to_bin = st.text_input("Destination Bin Location*")
            with col2:
                transfer_qty = st.number_input("Quantity to Transfer", min_value=1, max_value=int(source_item_qty), step=1)
                
            if st.button("Post Transfer Journal"):
                if not to_warehouse or not to_bin:
                    st.error("Destination Warehouse and Bin Location are mandatory.")
                elif to_warehouse.strip() == from_warehouse and to_bin.strip() == from_bin:
                    st.error("Destination location cannot be the same as the source location.")
                else:
                    # Execute Transfer Transaction
                    today_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                    
                    # 1. Log to Transfer Journal
                    c.execute('''
                        INSERT INTO transfer_journal (voucher_number, part_number, item_name, from_warehouse, from_bin, to_warehouse, to_bin, quantity, transfer_date)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ''', (next_voucher, sel_part_no, source_item_name, from_warehouse, from_bin, to_warehouse, to_bin, transfer_qty, today_str))
                    
                    # 2. Update source row quantity
                    new_source_qty = source_item_qty - transfer_qty
                    if new_source_qty == 0:
                        c.execute("DELETE FROM items WHERE id = ?", (source_item_id,))
                    else:
                        c.execute("UPDATE items SET quantity = ? WHERE id = ?", (new_source_qty, source_item_id))
                        
                    # 3. Insert or update target row
                    c.execute("SELECT id, quantity FROM items WHERE part_number = ? AND warehouse = ? AND bin_location = ?", (sel_part_no, to_warehouse, to_bin))
                    dest_row = c.fetchone()
                    
                    if dest_row:
                        c.execute("UPDATE items SET quantity = ? WHERE id = ?", (dest_row[1] + transfer_qty, dest_row[0]))
                    else:
                        c.execute('''
                            INSERT INTO items (part_number, item_name, warehouse, bin_location, quantity, image)
                            VALUES (?, ?, ?, ?, ?, ?)
                        ''', (sel_part_no, source_item_name, to_warehouse, to_bin, transfer_qty, source_item_image))
                        
                    conn.commit()
                    st.success(f"Journal Posted! Moved {transfer_qty} units of {sel_part_no} to {to_warehouse} ({to_bin}). Voucher: {next_voucher}")
                    st.rerun()
                    
    with tab2:
        st.subheader("Journal History Log")
        journal_df = pd.read_sql_query("SELECT id, voucher_number, part_number, item_name, from_warehouse, from_bin, to_warehouse, to_bin, quantity, transfer_date FROM transfer_journal ORDER BY id DESC", conn)
        if journal_df.empty:
            st.info("No inventory transfer records found.")
        else:
            st.dataframe(journal_df, use_container_width=True)
            
    with tab3:
        st.subheader("📈 Stock Transfer Analytics by Item")
        c.execute("SELECT DISTINCT part_number, item_name FROM transfer_journal")
        transfer_items = c.fetchall()
        
        if not transfer_items:
            st.info("No stock transfers recorded yet. Post a transfer to see analytics!")
        else:
            item_options = [f"{row[0]} | {row[1]}" for row in transfer_items]
            selected_item_str = st.selectbox("Select Item to View Transfer Chart:", item_options)
            sel_part_no = selected_item_str.split(" | ")[0]
            
            df_transfers = pd.read_sql_query('''
                SELECT voucher_number, from_warehouse, from_bin, to_warehouse, to_bin, quantity, transfer_date 
                FROM transfer_journal 
                WHERE part_number = ?
                ORDER BY transfer_date ASC
            ''', conn, params=(sel_part_no,))
            
            if df_transfers.empty:
                st.warning("No transfer history found for this item.")
            else:
                total_transferred = df_transfers['quantity'].sum()
                num_transfers = len(df_transfers)
                max_transfer = df_transfers['quantity'].max()
                
                col1, col2, col3 = st.columns(3)
                with col1:
                    st.metric("Total Units Transferred", f"{total_transferred} pcs")
                with col2:
                    st.metric("Total Transfer Transactions", f"{num_transfers} times")
                with col3:
                    st.metric("Largest Single Transfer", f"{max_transfer} pcs")
                
                st.markdown("### 📅 Quantity Transferred Over Time")
                df_transfers['Date'] = pd.to_datetime(df_transfers['transfer_date']).dt.strftime('%Y-%m-%d %H:%M')
                chart_data = df_transfers[['Date', 'quantity']].copy()
                chart_data = chart_data.rename(columns={'quantity': 'Transferred Quantity'})
                chart_data = chart_data.set_index('Date')
                st.bar_chart(chart_data)
                
                st.markdown("### 🏢 Destination Warehouse Distribution")
                dest_data = df_transfers.groupby('to_warehouse')['quantity'].sum().reset_index()
                dest_data = dest_data.rename(columns={'to_warehouse': 'Destination Warehouse', 'quantity': 'Quantity Received'})
                dest_data = dest_data.set_index('Destination Warehouse')
                st.bar_chart(dest_data)
                
                st.markdown("### 📋 History Log for this Item")
                st.dataframe(df_transfers, use_container_width=True)
                
    conn.close()
