# 📦 Advanced Inventory Management System

A beautiful, high-performance inventory management system built with Python, Streamlit, SQLite, and Pandas. It features:
* **Current Stock Status View**: Search, inspect details, and view item photos.
* **Stock Item Management**: Add new items (with photos) and safely delete entries.
* **Bulk Import Utility**: Load multiple inventory items at once using Excel (`.xlsx`, `.xls`) or CSV (`.csv`) sheets with automated duplicate prevention and schema validation.
* **Stock Transfer Journal**: Transfer stock between warehouses and bins with auto-generated unique, sequential daily vouchers (`STJ-YYYYMMDD-XXXX`).
* **Visual Premium Dark Theme**: Custom slate-and-indigo CSS layout with Plus Jakarta Sans typography.

---

## 🛠️ Prerequisites

To run this application, you need:
1. **Python 3.8** or higher installed on your system. You can download it from [python.org](https://www.python.org/downloads/).
2. A modern web browser (Chrome, Edge, Firefox, Safari).

---

## 🚀 Step-by-Step Installation & Setup

Follow these steps to run the project on any other machine:

### 1. Copy the Project Files
Ensure you have copied the following files and folders into a directory on the target system:
* `app.py` (Main Python application)
* `requirements.txt` (List of dependencies)
* `.streamlit/config.toml` (Streamlit visual theme config)

*Note: The database file `inventory.db` will be automatically created on the first run, so there is no need to copy it.*

### 2. Open Command Line / Terminal
Open your terminal (macOS/Linux) or Command Prompt / PowerShell (Windows) and navigate to the directory where the project files are located:
```bash
cd /path/to/your/project-folder
```

### 3. Create a Virtual Environment (Recommended)
It is best practice to run Python projects in a virtual environment to prevent package version conflicts:

* **Windows**:
  ```powershell
  python -m venv venv
  .\venv\Scripts\activate
  ```
* **macOS / Linux**:
  ```bash
  python3 -m venv venv
  source venv/bin/activate
  ```

### 4. Install Dependencies
Install all required libraries using the provided `requirements.txt`:
```bash
pip install -r requirements.txt
```
This command installs:
* `streamlit` - The application framework.
* `pandas` - Used for dataframe rendering, query output, and CSV loading.
* `Pillow` - For item photo rendering and scaling.
* `openpyxl` - Required to process Excel `.xlsx` spreadsheets for bulk importing.

---

## ⚙️ How to Run the App

Once the installation is complete, start the application by running:
```bash
streamlit run app.py
```

Streamlit will boot up the local dev server and output the access URLs:
```text
  You can now view your Streamlit app in your browser.

  Local URL: http://localhost:8501
  Network URL: http://192.168.1.15:8501
```

If it does not open automatically, copy and paste `http://localhost:8501` into your browser.

---

## 📤 Preparing Files for Bulk Import

When importing multiple items via the **Bulk Import** tab, your CSV or Excel file should have these header columns (case-insensitive):
1. `part_number` (Required - Must be a unique code)
2. `item_name` (Required - Brief description)
3. `warehouse` (Required - Warehouse name/code)
4. `bin_location` (Required - Bin coordinate)
5. `quantity` (Optional - Defaults to `0` if empty or omitted)

*Tip: A template file can be downloaded directly from the app interface by clicking **"Download Import Template (CSV)"**.*
