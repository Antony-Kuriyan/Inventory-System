import { useState, useEffect } from 'react';
import { Plus, Upload, Trash2, Loader2, AlertCircle, CheckCircle, FileText } from 'lucide-react';

interface LocationItem {
  id: number;
  part_number: string;
  item_name: string;
  warehouse: string;
  bin_location: string;
  quantity: number;
}

const AddDeleteStock: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'add' | 'import' | 'delete'>('add');

  // Add Item States
  const [partNumber, setPartNumber] = useState('');
  const [itemName, setItemName] = useState('');
  const [warehouse, setWarehouse] = useState('');
  const [binLocation, setBinLocation] = useState('');
  const [quantity, setQuantity] = useState(0);
  const [selectedPhoto, setSelectedPhoto] = useState<File | null>(null);
  const [addLoading, setAddLoading] = useState(false);
  const [addMessage, setAddMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Bulk Import States
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importResult, setImportResult] = useState<{
    status: string;
    success_count: number;
    skipped_count: number;
    skipped_items: { part_number: string; item_name: string; reason: string }[];
  } | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  // Delete States
  const [itemsList, setItemsList] = useState<LocationItem[]>([]);
  const [selectedDeleteId, setSelectedDeleteId] = useState<number | ''>('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteMessage, setDeleteMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Fetch all items for delete dropdown
  const fetchDeleteItems = async () => {
    try {
      const res = await fetch('http://127.0.0.1:8000/api/items');
      if (res.ok) {
        const data = await res.json();
        setItemsList(data);
      }
    } catch (err) {
      console.error('Error fetching items for delete:', err);
    }
  };

  useEffect(() => {
    if (activeTab === 'delete') {
      fetchDeleteItems();
      setSelectedDeleteId('');
      setConfirmDelete(false);
    }
  }, [activeTab]);

  // Form submit for Add Item
  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!partNumber || !itemName || !warehouse || !binLocation) {
      setAddMessage({ type: 'error', text: 'Please fill out all mandatory fields (*).' });
      return;
    }

    setAddLoading(true);
    setAddMessage(null);

    const formData = new FormData();
    formData.append('part_number', partNumber);
    formData.append('item_name', itemName);
    formData.append('warehouse', warehouse);
    formData.append('bin_location', binLocation);
    formData.append('quantity', String(quantity));
    if (selectedPhoto) {
      formData.append('image', selectedPhoto);
    }

    try {
      const res = await fetch('http://127.0.0.1:8000/api/items', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (res.ok) {
        setAddMessage({ type: 'success', text: data.message || 'Successfully saved item!' });
        // Reset fields
        setPartNumber('');
        setItemName('');
        setWarehouse('');
        setBinLocation('');
        setQuantity(0);
        setSelectedPhoto(null);
      } else {
        setAddMessage({ type: 'error', text: data.detail || 'Failed to save item.' });
      }
    } catch (err) {
      setAddMessage({ type: 'error', text: 'Network connection error. Ensure API server is running.' });
    } finally {
      setAddLoading(false);
    }
  };

  // Bulk Import file upload
  const handleImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;

    setImportLoading(true);
    setImportResult(null);
    setImportError(null);

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const res = await fetch('http://127.0.0.1:8000/api/import', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();

      if (res.ok) {
        setImportResult(data);
        setSelectedFile(null);
      } else {
        setImportError(data.detail || 'Error importing file.');
      }
    } catch (err) {
      setImportError('Network error uploading template.');
    } finally {
      setImportLoading(false);
    }
  };

  // Handle Delete operation
  const handleDeleteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDeleteId) {
      setDeleteMessage({ type: 'error', text: 'Please select an item location to delete.' });
      return;
    }
    if (!confirmDelete) {
      setDeleteMessage({ type: 'error', text: 'You must check the confirmation box.' });
      return;
    }

    setDeleteLoading(true);
    setDeleteMessage(null);

    try {
      const res = await fetch(`http://127.0.0.1:8000/api/items/${selectedDeleteId}`, {
        method: 'DELETE',
      });
      const data = await res.json();

      if (res.ok) {
        setDeleteMessage({ type: 'success', text: 'Successfully removed item location record.' });
        setConfirmDelete(false);
        setSelectedDeleteId('');
        fetchDeleteItems(); // Reload list
      } else {
        setDeleteMessage({ type: 'error', text: data.detail || 'Failed to delete record.' });
      }
    } catch (err) {
      setDeleteMessage({ type: 'error', text: 'Network error deleting item.' });
    } finally {
      setDeleteLoading(false);
    }
  };

  // Download template helper
  const downloadTemplate = () => {
    const headers = 'part_number,item_name,warehouse,bin_location,quantity\n';
    const blob = new Blob([headers], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'inventory_import_template.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col gap-8">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-white mb-2">⚙️ Stock Item Management</h1>
        <p className="text-gray-400 text-sm">Add stock items individually, import spreadsheet logs, or delete items permanently.</p>
      </div>

      {/* Tabs list */}
      <div className="flex border-b border-white/5 pb-0">
        <button
          onClick={() => setActiveTab('add')}
          className={`px-6 py-3 text-sm font-semibold border-b-2 transition-all duration-200 ${
            activeTab === 'add'
              ? 'text-indigo-400 border-indigo-500'
              : 'text-gray-500 border-transparent hover:text-gray-300'
          }`}
        >
          ➕ Add New Item / Increase Stock
        </button>
        <button
          onClick={() => setActiveTab('import')}
          className={`px-6 py-3 text-sm font-semibold border-b-2 transition-all duration-200 ${
            activeTab === 'import'
              ? 'text-indigo-400 border-indigo-500'
              : 'text-gray-500 border-transparent hover:text-gray-300'
          }`}
        >
          📤 Bulk Import (Excel/CSV)
        </button>
        <button
          onClick={() => setActiveTab('delete')}
          className={`px-6 py-3 text-sm font-semibold border-b-2 transition-all duration-200 ${
            activeTab === 'delete'
              ? 'text-indigo-400 border-indigo-500'
              : 'text-gray-500 border-transparent hover:text-gray-300'
          }`}
        >
          ❌ Delete Item
        </button>
      </div>

      {/* Tab Contents */}
      <div className="max-w-2xl w-full">
        {/* ADD TAB */}
        {activeTab === 'add' && (
          <form onSubmit={handleAddSubmit} className="glass-card p-8 flex flex-col gap-6">
            <h2 className="text-xl font-bold text-white m-0">Add / Increase Stock</h2>

            {addMessage && (
              <div
                className={`p-4 rounded-xl border flex items-start gap-3 text-sm ${
                  addMessage.type === 'success'
                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                    : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                }`}
              >
                {addMessage.type === 'success' ? (
                  <CheckCircle className="w-5 h-5 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                )}
                <span>{addMessage.text}</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-xs uppercase tracking-wider text-gray-400 font-bold">Part Number *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. P-100"
                  value={partNumber}
                  onChange={(e) => setPartNumber(e.target.value)}
                  className="input-field"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs uppercase tracking-wider text-gray-400 font-bold">Item Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Hex Bolt"
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  className="input-field"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-xs uppercase tracking-wider text-gray-400 font-bold">Warehouse *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. WH-Alpha"
                  value={warehouse}
                  onChange={(e) => setWarehouse(e.target.value)}
                  className="input-field"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs uppercase tracking-wider text-gray-400 font-bold">Bin Location *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Row-A, Bin-12"
                  value={binLocation}
                  onChange={(e) => setBinLocation(e.target.value)}
                  className="input-field"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-xs uppercase tracking-wider text-gray-400 font-bold">Quantity</label>
                <input
                  type="number"
                  min="0"
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                  className="input-field font-mono"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs uppercase tracking-wider text-gray-400 font-bold">Upload Item Photo</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setSelectedPhoto(e.target.files?.[0] || null)}
                  className="input-field file:mr-4 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-indigo-600/20 file:text-indigo-400 file:cursor-pointer hover:file:bg-indigo-600/30"
                />
              </div>
            </div>

            <button type="submit" disabled={addLoading} className="btn-primary w-fit self-end mt-2">
              {addLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Plus className="w-5 h-5" />
                  <span>Save Item to Inventory</span>
                </>
              )}
            </button>
          </form>
        )}

        {/* IMPORT TAB */}
        {activeTab === 'import' && (
          <div className="glass-card p-8 flex flex-col gap-6">
            <div className="flex justify-between items-start">
              <h2 className="text-xl font-bold text-white m-0">Bulk Import Items</h2>
              <button onClick={downloadTemplate} className="btn-secondary py-2 text-xs">
                <FileText className="w-4 h-4" />
                <span>Download Template (CSV)</span>
              </button>
            </div>

            <p className="text-sm text-gray-400 leading-relaxed m-0">
              Upload an Excel (<code className="text-indigo-300">.xlsx</code>, <code className="text-indigo-300">.xls</code>) 
              or CSV (<code className="text-indigo-300">.csv</code>) file to load multiple items at once.
              Required columns: <code className="text-slate-300">part_number</code>, <code className="text-slate-300">item_name</code>, <code className="text-slate-300">warehouse</code>, <code className="text-slate-300">bin_location</code>. (Quantity is optional).
            </p>

            {importError && (
              <div className="p-4 rounded-xl border bg-rose-500/10 border-rose-500/20 text-rose-400 flex items-start gap-3 text-sm">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <span>{importError}</span>
              </div>
            )}

            {importResult && (
              <div className="flex flex-col gap-4">
                <div className="p-4 rounded-xl border bg-emerald-500/10 border-emerald-500/20 text-emerald-400 flex items-start gap-3 text-sm">
                  <CheckCircle className="w-5 h-5 shrink-0 mt-0.5" />
                  <span>Successfully imported {importResult.success_count} item(s)!</span>
                </div>

                {importResult.skipped_count > 0 && (
                  <div className="border border-white/5 rounded-xl overflow-hidden">
                    <div className="bg-rose-500/10 border-b border-white/5 p-3 text-rose-400 text-xs font-bold uppercase tracking-wider">
                      Skipped {importResult.skipped_count} row(s) due to validation errors:
                    </div>
                    <div className="max-h-40 overflow-y-auto bg-black/10 text-xs">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-white/2 border-b border-white/5 text-gray-400">
                            <th className="p-2">Part Number</th>
                            <th className="p-2">Item Name</th>
                            <th className="p-2 text-right">Reason</th>
                          </tr>
                        </thead>
                        <tbody>
                          {importResult.skipped_items.map((item, idx) => (
                            <tr key={idx} className="border-b border-white/5">
                              <td className="p-2 font-bold text-white">{item.part_number}</td>
                              <td className="p-2 text-gray-300">{item.item_name}</td>
                              <td className="p-2 text-right text-rose-400">{item.reason}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            <form onSubmit={handleImportSubmit} className="flex flex-col gap-4">
              <input
                type="file"
                accept=".csv, .xlsx, .xls"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                className="input-field file:mr-4 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-indigo-600/20 file:text-indigo-400 file:cursor-pointer hover:file:bg-indigo-600/30"
              />
              
              <button
                type="submit"
                disabled={!selectedFile || importLoading}
                className="btn-primary w-fit self-end mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {importLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-5 h-5" />
                    <span>Proceed with Import</span>
                  </>
                )}
              </button>
            </form>
          </div>
        )}

        {/* DELETE TAB */}
        {activeTab === 'delete' && (
          <form onSubmit={handleDeleteSubmit} className="glass-card p-8 flex flex-col gap-6">
            <h2 className="text-xl font-bold text-white m-0">Delete Item</h2>

            {deleteMessage && (
              <div
                className={`p-4 rounded-xl border flex items-start gap-3 text-sm ${
                  deleteMessage.type === 'success'
                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                    : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                }`}
              >
                {deleteMessage.type === 'success' ? (
                  <CheckCircle className="w-5 h-5 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                )}
                <span>{deleteMessage.text}</span>
              </div>
            )}

            <div className="flex flex-col gap-2">
              <label className="text-xs uppercase tracking-wider text-gray-400 font-bold">Select Item Location to Remove</label>
              <select
                value={selectedDeleteId}
                onChange={(e) => setSelectedDeleteId(e.target.value ? Number(e.target.value) : '')}
                className="input-field select-widget"
              >
                <option value="">-- Choose Item Location --</option>
                {itemsList.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.part_number} - {item.item_name} (Wh: {item.warehouse} / Bin: {item.bin_location}) | Stock: {item.quantity}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-3 bg-rose-950/20 border border-rose-900/30 rounded-xl p-4 mt-2">
              <input
                type="checkbox"
                id="confirm"
                checked={confirmDelete}
                onChange={(e) => setConfirmDelete(e.target.checked)}
                className="w-4 h-4 cursor-pointer accent-rose-600"
              />
              <label htmlFor="confirm" className="text-xs text-rose-200 cursor-pointer m-0 select-none">
                I confirm I want to permanently delete this item location and its records.
              </label>
            </div>

            <button
              type="submit"
              disabled={deleteLoading || !selectedDeleteId || !confirmDelete}
              className="btn-primary bg-rose-600 hover:bg-rose-700 w-fit self-end mt-2 shadow-[0_4px_12px_rgba(225,29,72,0.3)] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {deleteLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Deleting...</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-5 h-5" />
                  <span>Delete Item Permanently</span>
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default AddDeleteStock;
