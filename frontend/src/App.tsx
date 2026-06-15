import { useState } from 'react';
import { Package, PlusSquare, ArrowLeftRight } from 'lucide-react';
import ViewInventory from './pages/ViewInventory';
import AddDeleteStock from './pages/AddDeleteStock';
import StockTransfer from './pages/StockTransfer';

function App() {
  const [activePage, setActivePage] = useState<'ViewInventory' | 'AddDeleteStock' | 'StockTransfer'>('ViewInventory');

  const menuItems = [
    {
      id: 'ViewInventory' as const,
      label: 'View Inventory',
      icon: <Package className="w-5 h-5" />,
    },
    {
      id: 'AddDeleteStock' as const,
      label: 'Add / Delete Stock Item',
      icon: <PlusSquare className="w-5 h-5" />,
    },
    {
      id: 'StockTransfer' as const,
      label: 'Stock Transfer Journal',
      icon: <ArrowLeftRight className="w-5 h-5" />,
    },
  ];

  return (
    <div className="flex min-h-screen bg-[#020617] text-[#f1f5f9]">
      {/* Sidebar Navigation */}
      <aside className="w-80 bg-[#0f172a]/95 border-r border-white/5 flex flex-col p-6 shadow-[4px_0_24px_rgba(0,0,0,0.5)] shrink-0">
        <div className="flex items-center gap-3 pb-6 border-b border-white/5 mb-8">
          <span className="text-3xl">📦</span>
          <div>
            <h1 className="text-lg font-extrabold tracking-tight text-white m-0">Inventory</h1>
            <p className="text-xs text-indigo-400 font-medium tracking-widest uppercase m-0">Management System</p>
          </div>
        </div>

        <nav className="flex-1 flex flex-col gap-2">
          {menuItems.map((item) => {
            const isActive = activePage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActivePage(item.id)}
                className={`flex items-center gap-4 px-4 py-3.5 rounded-xl border text-sm font-semibold transition-all duration-200 text-left ${
                  isActive
                    ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white border-transparent shadow-[0_4px_12px_rgba(99,102,241,0.35)]'
                    : 'bg-transparent text-[#cbd5e1] border-transparent hover:bg-white/5 hover:text-white'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-12 max-w-7xl mx-auto w-full">
        {activePage === 'ViewInventory' && <ViewInventory />}
        {activePage === 'AddDeleteStock' && <AddDeleteStock />}
        {activePage === 'StockTransfer' && <StockTransfer />}
      </main>
    </div>
  );
}

export default App;
