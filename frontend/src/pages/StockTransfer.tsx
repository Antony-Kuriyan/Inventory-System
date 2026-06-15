import { useState, useEffect } from 'react';
import { Loader2, ArrowRightLeft, AlertCircle, CheckCircle, TrendingUp, Shuffle, Maximize2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

interface PoolItem {
  id: number;
  part_number: string;
  item_name: string;
  warehouse: string;
  bin_location: string;
  quantity: number;
  image: string | null;
}

interface TransferRecord {
  id: number;
  voucher_number: string;
  part_number: string;
  item_name: string;
  from_warehouse: string;
  from_bin: string;
  to_warehouse: string;
  to_bin: string;
  quantity: number;
  transfer_date: string;
}

interface AnalyticsItem {
  part_number: string;
  item_name: string;
}

interface AnalyticsDetail {
  total_transferred: number;
  num_transfers: number;
  max_transfer: number;
  timeline: { date: string; quantity: number }[];
  distribution: { destination: string; quantity: number }[];
  history: TransferRecord[];
}

const StockTransfer: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'record' | 'history' | 'analytics'>('record');

  // Common Database States
  const [itemsPool, setItemsPool] = useState<PoolItem[]>([]);
  const [selectedSourceId, setSelectedSourceId] = useState<number | ''>('');
  
  // Record States
  const [toWarehouse, setToWarehouse] = useState('');
  const [toBin, setToBin] = useState('');
  const [transferQty, setTransferQty] = useState(1);
  const [voucherNo, setVoucherNo] = useState('');
  const [transferLoading, setTransferLoading] = useState(false);
  const [transferMessage, setTransferMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // History States
  const [historyList, setHistoryList] = useState<TransferRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Analytics States
  const [analyticsItems, setAnalyticsItems] = useState<AnalyticsItem[]>([]);
  const [selectedAnalyticsPart, setSelectedAnalyticsPart] = useState('');
  const [analyticsDetail, setAnalyticsDetail] = useState<AnalyticsDetail | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  // Fetch pool items and next voucher number
  const fetchTransferInitData = async () => {
    try {
      const poolRes = await fetch('http://127.0.0.1:8000/api/items');
      if (poolRes.ok) {
        const poolData = await poolRes.json();
        setItemsPool(poolData);
      }
      const vRes = await fetch('http://127.0.0.1:8000/api/transfers/next-voucher');
      if (vRes.ok) {
        const vData = await vRes.json();
        setVoucherNo(vData.voucher_number);
      }
    } catch (err) {
      console.error('Error fetching transfer page initialization data:', err);
    }
  };

  // Fetch transfer logs history
  const fetchHistory = async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch('http://127.0.0.1:8000/api/transfers');
      if (res.ok) {
        const data = await res.json();
        setHistoryList(data);
      }
    } catch (err) {
      console.error('Error loading history:', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  // Fetch distinct items for analytics dropdown
  const fetchAnalyticsItems = async () => {
    try {
      const res = await fetch('http://127.0.0.1:8000/api/transfers/analytics');
      if (res.ok) {
        const data = await res.json();
        setAnalyticsItems(data);
        if (data.length > 0 && !selectedAnalyticsPart) {
          setSelectedAnalyticsPart(data[0].part_number);
        }
      }
    } catch (err) {
      console.error('Error loading analytics items dropdown:', err);
    }
  };

  // Fetch analytics details for selected item
  const fetchAnalyticsDetail = async (partNum: string) => {
    setAnalyticsLoading(true);
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/transfers/analytics/${encodeURIComponent(partNum)}`);
      if (res.ok) {
        const data = await res.json();
        setAnalyticsDetail(data);
      }
    } catch (err) {
      console.error('Error fetching analytics detail:', err);
    } finally {
      setAnalyticsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'record') {
      fetchTransferInitData();
      setSelectedSourceId('');
      setToWarehouse('');
      setToBin('');
      setTransferQty(1);
      setTransferMessage(null);
    } else if (activeTab === 'history') {
      fetchHistory();
    } else if (activeTab === 'analytics') {
      fetchAnalyticsItems();
    }
  }, [activeTab]);

  useEffect(() => {
    if (selectedAnalyticsPart) {
      fetchAnalyticsDetail(selectedAnalyticsPart);
    }
  }, [selectedAnalyticsPart]);

  // Selected source item object details
  const selectedSourceItem = itemsPool.find(item => item.id === selectedSourceId);

  // Form Submit for Posting Transfer
  const handleTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSourceId || !toWarehouse || !toBin || !transferQty) {
      setTransferMessage({ type: 'error', text: 'All fields are mandatory.' });
      return;
    }
    if (selectedSourceItem && transferQty > selectedSourceItem.quantity) {
      setTransferMessage({ type: 'error', text: 'Transfer quantity exceeds available stock.' });
      return;
    }

    setTransferLoading(true);
    setTransferMessage(null);

    try {
      const res = await fetch('http://127.0.0.1:8000/api/transfers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source_item_id: selectedSourceId,
          to_warehouse: toWarehouse,
          to_bin: toBin,
          quantity: transferQty,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setTransferMessage({
          type: 'success',
          text: `Journal Posted! Voucher: ${data.voucher_number}. ${data.message}`,
        });
        // Reset states
        setSelectedSourceId('');
        setToWarehouse('');
        setToBin('');
        setTransferQty(1);
        // Refresh init details (pool & next voucher)
        fetchTransferInitData();
      } else {
        setTransferMessage({ type: 'error', text: data.detail || 'Failed to post transfer.' });
      }
    } catch (err) {
      setTransferMessage({ type: 'error', text: 'Network connection error.' });
    } finally {
      setTransferLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-8">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-white mb-2">🔄 Stock Transfer Journal</h1>
        <p className="text-gray-400 text-sm">Move inventory stock between different warehouse bins and review transfer analytics charts.</p>
      </div>

      {/* Tabs list */}
      <div className="flex border-b border-white/5 pb-0">
        <button
          onClick={() => setActiveTab('record')}
          className={`px-6 py-3 text-sm font-semibold border-b-2 transition-all duration-200 ${
            activeTab === 'record'
              ? 'text-indigo-400 border-indigo-500'
              : 'text-gray-500 border-transparent hover:text-gray-300'
          }`}
        >
          ⚡ Record New Transfer
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-6 py-3 text-sm font-semibold border-b-2 transition-all duration-200 ${
            activeTab === 'history'
              ? 'text-indigo-400 border-indigo-500'
              : 'text-gray-500 border-transparent hover:text-gray-300'
          }`}
        >
          📜 View Transfer History
        </button>
        <button
          onClick={() => setActiveTab('analytics')}
          className={`px-6 py-3 text-sm font-semibold border-b-2 transition-all duration-200 ${
            activeTab === 'analytics'
              ? 'text-indigo-400 border-indigo-500'
              : 'text-gray-500 border-transparent hover:text-gray-300'
          }`}
        >
          📊 Transfer Analytics
        </button>
      </div>

      {/* Tab Contents */}
      <div className="w-full">
        {/* RECORD TAB */}
        {activeTab === 'record' && (
          <div className="max-w-2xl w-full">
            <form onSubmit={handleTransferSubmit} className="glass-card p-8 flex flex-col gap-6">
              <h2 className="text-xl font-bold text-white m-0">Move Stock Between Warehouse / Bins</h2>

              {transferMessage && (
                <div
                  className={`p-4 rounded-xl border flex items-start gap-3 text-sm ${
                    transferMessage.type === 'success'
                      ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                      : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                  }`}
                >
                  {transferMessage.type === 'success' ? (
                    <CheckCircle className="w-5 h-5 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                  )}
                  <span>{transferMessage.text}</span>
                </div>
              )}

              <div className="flex flex-col gap-2">
                <label className="text-xs uppercase tracking-wider text-gray-400 font-bold">Select Item to Transfer</label>
                <select
                  value={selectedSourceId}
                  onChange={(e) => setSelectedSourceId(e.target.value ? Number(e.target.value) : '')}
                  className="input-field select-widget"
                >
                  <option value="">-- Choose Item Location --</option>
                  {itemsPool.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.part_number} | {item.item_name} (Wh: {item.warehouse} / Bin: {item.bin_location}) | Stock: {item.quantity}
                    </option>
                  ))}
                </select>
              </div>

              {selectedSourceItem && (
                <div className="p-4 rounded-xl border border-indigo-500/20 bg-indigo-500/5 text-sm text-[#cbd5e1] leading-relaxed">
                  <strong>Current Allocation:</strong> Warehouse: <code className="text-white bg-white/10 px-1.5 py-0.5 rounded">{selectedSourceItem.warehouse}</code> | Bin Location: <code className="text-white bg-white/10 px-1.5 py-0.5 rounded">{selectedSourceItem.bin_location}</code>
                </div>
              )}

              <div className="p-4 rounded-xl border border-white/5 bg-white/2 text-sm text-gray-400">
                📋 Next Generated Voucher Number: <strong className="text-indigo-400 font-mono">{voucherNo}</strong>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <label className="text-xs uppercase tracking-wider text-gray-400 font-bold">Destination Warehouse *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. WH-Beta"
                    value={toWarehouse}
                    onChange={(e) => setToWarehouse(e.target.value)}
                    className="input-field"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-xs uppercase tracking-wider text-gray-400 font-bold">Destination Bin Location *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Row-B, Bin-5"
                    value={toBin}
                    onChange={(e) => setToBin(e.target.value)}
                    className="input-field"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2 max-w-xs">
                <label className="text-xs uppercase tracking-wider text-gray-400 font-bold">Quantity to Transfer</label>
                <input
                  type="number"
                  min="1"
                  max={selectedSourceItem ? selectedSourceItem.quantity : undefined}
                  value={transferQty}
                  onChange={(e) => setTransferQty(Math.max(1, Number(e.target.value)))}
                  className="input-field font-mono"
                />
              </div>

              <button
                type="submit"
                disabled={transferLoading || !selectedSourceId || !toWarehouse || !toBin}
                className="btn-primary w-fit self-end mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {transferLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    <ArrowRightLeft className="w-5 h-5" />
                    <span>Post Transfer Journal</span>
                  </>
                )}
              </button>
            </form>
          </div>
        )}

        {/* HISTORY TAB */}
        {activeTab === 'history' && (
          <div className="glass-card overflow-hidden">
            {historyLoading ? (
              <div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                <span>Loading history logs...</span>
              </div>
            ) : historyList.length === 0 ? (
              <div className="py-20 text-center text-gray-400 font-medium">
                No inventory transfer records found.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-white/5 bg-white/2">
                      <th className="p-4 text-xs font-bold uppercase tracking-wider text-indigo-400">Voucher</th>
                      <th className="p-4 text-xs font-bold uppercase tracking-wider text-indigo-400">Part</th>
                      <th className="p-4 text-xs font-bold uppercase tracking-wider text-indigo-400">Item Name</th>
                      <th className="p-4 text-xs font-bold uppercase tracking-wider text-indigo-400">Source</th>
                      <th className="p-4 text-xs font-bold uppercase tracking-wider text-indigo-400">Destination</th>
                      <th className="p-4 text-xs font-bold uppercase tracking-wider text-indigo-400 text-right">Qty</th>
                      <th className="p-4 text-xs font-bold uppercase tracking-wider text-indigo-400">Date Posted</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyList.map((log) => (
                      <tr key={log.id} className="border-b border-white/5 hover:bg-white/2 transition-colors duration-150">
                        <td className="p-4 font-bold text-white font-mono text-sm">{log.voucher_number}</td>
                        <td className="p-4 text-[#cbd5e1] text-sm">{log.part_number}</td>
                        <td className="p-4 text-[#cbd5e1] text-sm">{log.item_name}</td>
                        <td className="p-4 text-sm text-[#94a3b8]">
                          {log.from_warehouse} <span className="opacity-50">({log.from_bin})</span>
                        </td>
                        <td className="p-4 text-sm text-[#34d399]">
                          {log.to_warehouse} <span className="opacity-50">({log.to_bin})</span>
                        </td>
                        <td className="p-4 text-right font-mono font-bold text-indigo-300 text-sm">{log.quantity}</td>
                        <td className="p-4 text-gray-500 text-sm">{log.transfer_date}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ANALYTICS TAB */}
        {activeTab === 'analytics' && (
          <div className="flex flex-col gap-8">
            {/* Top Selector Card */}
            <div className="glass-card p-6 max-w-md">
              <label className="text-xs uppercase tracking-wider text-gray-400 font-bold mb-2 block">Select Item for Analytics</label>
              {analyticsItems.length === 0 ? (
                <div className="text-gray-500 text-sm py-2">No transfer history recorded yet.</div>
              ) : (
                <select
                  value={selectedAnalyticsPart}
                  onChange={(e) => setSelectedAnalyticsPart(e.target.value)}
                  className="input-field"
                >
                  {analyticsItems.map((item) => (
                    <option key={item.part_number} value={item.part_number}>
                      {item.part_number} | {item.item_name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {analyticsLoading ? (
              <div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                <span>Loading analytics visualizations...</span>
              </div>
            ) : analyticsDetail ? (
              <div className="flex flex-col gap-8 animate-slide-in">
                {/* Metric Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="glass-card p-6 flex items-center gap-5">
                    <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                      <TrendingUp className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="text-xs font-bold uppercase tracking-wider text-gray-500">Total Transferred</div>
                      <div className="text-2xl font-mono font-extrabold text-white mt-1">{analyticsDetail.total_transferred} pcs</div>
                    </div>
                  </div>

                  <div className="glass-card p-6 flex items-center gap-5">
                    <div className="w-12 h-12 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400">
                      <Shuffle className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="text-xs font-bold uppercase tracking-wider text-gray-500">Total Transactions</div>
                      <div className="text-2xl font-mono font-extrabold text-white mt-1">{analyticsDetail.num_transfers} times</div>
                    </div>
                  </div>

                  <div className="glass-card p-6 flex items-center gap-5">
                    <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                      <Maximize2 className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="text-xs font-bold uppercase tracking-wider text-gray-500">Largest Transfer</div>
                      <div className="text-2xl font-mono font-extrabold text-white mt-1">{analyticsDetail.max_transfer} pcs</div>
                    </div>
                  </div>
                </div>

                {/* Recharts Charts Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Timeline Bar Chart */}
                  <div className="glass-card p-6 flex flex-col gap-4">
                    <h3 className="text-lg font-bold text-white m-0">📅 Quantity Transferred Over Time</h3>
                    <div className="h-80 w-full">
                      {analyticsDetail.timeline.length === 0 ? (
                        <div className="h-full flex items-center justify-center text-gray-500 text-sm">No timeline data available.</div>
                      ) : (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={analyticsDetail.timeline} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                            <XAxis dataKey="date" stroke="#94a3b8" fontSize={10} tickLine={false} />
                            <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} />
                            <Tooltip
                              contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff' }}
                              labelStyle={{ fontWeight: 'bold', color: '#818cf8' }}
                            />
                            <Bar dataKey="quantity" fill="#6366f1" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      )}
                    </div>
                  </div>

                  {/* Distribution Bar Chart */}
                  <div className="glass-card p-6 flex flex-col gap-4">
                    <h3 className="text-lg font-bold text-white m-0">🏢 Destination Warehouse Distribution</h3>
                    <div className="h-80 w-full">
                      {analyticsDetail.distribution.length === 0 ? (
                        <div className="h-full flex items-center justify-center text-gray-500 text-sm">No distribution data available.</div>
                      ) : (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={analyticsDetail.distribution} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                            <XAxis dataKey="destination" stroke="#94a3b8" fontSize={10} tickLine={false} />
                            <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} />
                            <Tooltip
                              contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff' }}
                              labelStyle={{ fontWeight: 'bold', color: '#34d399' }}
                            />
                            <Bar dataKey="quantity" fill="#34d399" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      )}
                    </div>
                  </div>
                </div>

                {/* Sub History Table */}
                <div className="glass-card overflow-hidden">
                  <div className="bg-white/2 border-b border-white/5 p-4">
                    <h3 className="text-base font-bold text-white m-0">📋 History Log for this Item</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-white/1 border-b border-white/5 text-gray-400">
                          <th className="p-3">Voucher</th>
                          <th className="p-3">Source</th>
                          <th className="p-3">Destination</th>
                          <th className="p-3 text-right">Qty</th>
                          <th className="p-3">Date Posted</th>
                        </tr>
                      </thead>
                      <tbody>
                        {analyticsDetail.history.map((hLog) => (
                          <tr key={hLog.id} className="border-b border-white/5 hover:bg-white/2">
                            <td className="p-3 font-bold text-white font-mono">{hLog.voucher_number}</td>
                            <td className="p-3 text-gray-400">
                              {hLog.from_warehouse} <span className="opacity-50">({hLog.from_bin})</span>
                            </td>
                            <td className="p-3 text-[#34d399]">
                              {hLog.to_warehouse} <span className="opacity-50">({hLog.to_bin})</span>
                            </td>
                            <td className="p-3 text-right font-mono font-bold text-indigo-300">{hLog.quantity}</td>
                            <td className="p-3 text-gray-500">{hLog.transfer_date}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
};

export default StockTransfer;
