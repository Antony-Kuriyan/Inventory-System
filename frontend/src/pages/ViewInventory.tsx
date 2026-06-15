import { useEffect, useState } from 'react';
import { Search, Loader2, ImageOff, MapPin, Layers } from 'lucide-react';

interface InventoryItem {
  id: number;
  part_number: string;
  item_name: string;
  warehouse: string;
  bin_location: string;
  quantity: number;
}

interface ItemDetail {
  part_number: string;
  item_name: string;
  total_quantity: number;
  image: string | null;
  locations: {
    id: number;
    warehouse: string;
    bin_location: string;
    quantity: number;
  }[];
}

const ViewInventory: React.FC = () => {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedPart, setSelectedPart] = useState<string | null>(null);
  const [detail, setDetail] = useState<ItemDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Fetch all items (filtered by search)
  const fetchItems = async () => {
    setLoading(true);
    try {
      const url = search 
        ? `http://127.0.0.1:8000/api/items?search=${encodeURIComponent(search)}`
        : 'http://127.0.0.1:8000/api/items';
      const res = await fetch(url);
      const data = await res.json();
      setItems(data);
    } catch (err) {
      console.error('Error fetching inventory items:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch item details when selection changes
  const fetchDetail = async (partNum: string) => {
    setDetailLoading(true);
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/items/${encodeURIComponent(partNum)}`);
      if (res.ok) {
        const data = await res.json();
        setDetail(data);
      } else {
        setDetail(null);
      }
    } catch (err) {
      console.error('Error fetching item details:', err);
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, [search]);

  useEffect(() => {
    if (selectedPart) {
      fetchDetail(selectedPart);
    } else {
      setDetail(null);
    }
  }, [selectedPart]);

  return (
    <div className="flex flex-col gap-8">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-white mb-2">📋 Current Stock Status</h1>
        <p className="text-gray-400 text-sm">Monitor, search, and view detailed location reports of parts.</p>
      </div>

      {/* Search Input bar */}
      <div className="relative w-full max-w-lg">
        <span className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400">
          <Search className="w-5 h-5" />
        </span>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by Item Name or Part Number..."
          className="input-field pl-12 py-3"
        />
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Inventory Table Container */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          <div className="glass-card overflow-hidden">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                <span>Loading items...</span>
              </div>
            ) : items.length === 0 ? (
              <div className="py-20 text-center text-gray-400 font-medium">
                No items found matching your criteria.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-white/5 bg-white/2">
                      <th className="p-4 text-xs font-bold uppercase tracking-wider text-indigo-400">Part Number</th>
                      <th className="p-4 text-xs font-bold uppercase tracking-wider text-indigo-400">Item Name</th>
                      <th className="p-4 text-xs font-bold uppercase tracking-wider text-indigo-400">Warehouse</th>
                      <th className="p-4 text-xs font-bold uppercase tracking-wider text-indigo-400">Bin Location</th>
                      <th className="p-4 text-xs font-bold uppercase tracking-wider text-indigo-400 text-right">Quantity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr
                        key={item.id}
                        onClick={() => setSelectedPart(item.part_number)}
                        className={`border-b border-white/5 hover:bg-white/5 transition-colors duration-150 cursor-pointer ${
                          selectedPart === item.part_number ? 'bg-indigo-600/10' : ''
                        }`}
                      >
                        <td className="p-4 font-bold text-white text-sm">{item.part_number}</td>
                        <td className="p-4 text-[#cbd5e1] text-sm">{item.item_name}</td>
                        <td className="p-4 text-[#cbd5e1] text-sm">{item.warehouse}</td>
                        <td className="p-4 text-[#cbd5e1] text-sm">{item.bin_location}</td>
                        <td className="p-4 text-right font-mono font-bold text-indigo-300 text-sm">{item.quantity}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Details & Photo Viewer Panel */}
        <div className="lg:col-span-1">
          <div className="glass-card p-6 flex flex-col gap-6 sticky top-8">
            <h2 className="text-xl font-bold text-white m-0 border-b border-white/5 pb-3 flex items-center gap-2">
              <span>🖼️ Item Details & Photo Viewer</span>
            </h2>

            {!selectedPart ? (
              <div className="py-16 text-center text-gray-500 text-sm">
                Select a row from the inventory table to view photo assets and stock details.
              </div>
            ) : detailLoading ? (
              <div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                <span>Loading details...</span>
              </div>
            ) : detail ? (
              <div className="flex flex-col gap-6 animate-slide-in">
                {/* Photo frame */}
                <div className="aspect-[4/3] w-full rounded-xl overflow-hidden bg-slate-900 border border-white/10 flex items-center justify-center relative shadow-[inset_0_4px_24px_rgba(0,0,0,0.5)]">
                  {detail.image ? (
                    <img
                      src={`data:image/jpeg;base64,${detail.image}`}
                      alt={detail.item_name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-gray-600">
                      <ImageOff className="w-12 h-12" />
                      <span className="text-xs">No Photo Available</span>
                    </div>
                  )}
                </div>

                {/* Meta details */}
                <div className="flex flex-col gap-3">
                  <div>
                    <label className="text-xs uppercase tracking-wider text-gray-500 font-bold">Item Name</label>
                    <div className="text-base font-bold text-white mt-1">{detail.item_name}</div>
                  </div>
                  <div className="flex justify-between items-center bg-white/2 p-3 rounded-lg border border-white/5">
                    <div className="flex items-center gap-2 text-indigo-400">
                      <Layers className="w-4 h-4" />
                      <span className="text-xs font-semibold uppercase tracking-wider">Total Stock</span>
                    </div>
                    <span className="text-lg font-mono font-extrabold text-white">{detail.total_quantity} pcs</span>
                  </div>
                </div>

                {/* Locations Breakdown Table */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-gray-400 font-bold mb-1">
                    <MapPin className="w-4 h-4 text-indigo-500" />
                    <span>Location Breakdown</span>
                  </div>
                  <div className="max-h-60 overflow-y-auto border border-white/5 rounded-lg bg-black/10">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-white/5 border-b border-white/5 sticky top-0">
                          <th className="p-2.5 font-bold text-indigo-300">Warehouse</th>
                          <th className="p-2.5 font-bold text-indigo-300">Bin</th>
                          <th className="p-2.5 font-bold text-indigo-300 text-right">Qty</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detail.locations.map((loc) => (
                          <tr key={loc.id} className="border-b border-white/5 hover:bg-white/2">
                            <td className="p-2.5 text-white font-medium">{loc.warehouse}</td>
                            <td className="p-2.5 text-[#cbd5e1]">{loc.bin_location}</td>
                            <td className="p-2.5 text-right font-mono font-bold text-indigo-300">{loc.quantity}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>
            ) : (
              <div className="py-16 text-center text-red-400 text-sm">
                Failed to load item details.
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default ViewInventory;
