import React, { useState } from 'react';
import { Ingredient, IngredientLocation } from '../types';
import { Trash2, Search, Plus, X, Edit2 } from 'lucide-react';
import VisionScanner from './VisionScanner';

interface Props {
  inventory: Ingredient[];
  onRemove: (id: string) => void;
  onAdd: (ing: Ingredient) => void;
  onUpdate: (ing: Ingredient) => void;
  onScan: (ings: Ingredient[]) => void;
}

const InventoryView: React.FC<Props> = ({ 
  inventory, 
  onRemove, 
  onAdd, 
  onUpdate, 
  onScan
}) => {
  const [filter, setFilter] = useState<string>('All');
  const [search, setSearch] = useState('');
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Ingredient | null>(null);
  
  // Form State
  const [formData, setFormData] = useState<Partial<Ingredient>>({
    name: '',
    quantity: '',
    location: IngredientLocation.PANTRY,
    expiryDate: ''
  });

  const handleOpenModal = (item?: Ingredient) => {
    if (item) {
      setEditingItem(item);
      setFormData(item);
    } else {
      setEditingItem(null);
      setFormData({
        name: '',
        quantity: '',
        location: IngredientLocation.PANTRY,
        expiryDate: new Date(Date.now() + 86400000 * 7).toISOString().split('T')[0]
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) return;

    if (editingItem) {
      onUpdate({ ...editingItem, ...formData } as Ingredient);
    } else {
      onAdd({
        ...formData,
        id: Date.now().toString(),
      } as Ingredient);
    }
    setIsModalOpen(false);
  };

  const filtered = inventory.filter(i => {
    const matchesLoc = filter === 'All' || i.location === filter;
    const matchesSearch = i.name.toLowerCase().includes(search.toLowerCase());
    return matchesLoc && matchesSearch;
  });

  const getExpiryColor = (date: string) => {
    if (!date) return 'text-stone-400 bg-stone-50';
    const days = (new Date(date).getTime() - new Date().getTime()) / (1000 * 3600 * 24);
    if (days < 0) return 'text-red-600 bg-red-50';
    if (days < 3) return 'text-orange-600 bg-orange-50';
    return 'text-green-600 bg-green-50';
  };

  return (
    <div className="h-full flex flex-col space-y-4 p-4 md:p-6 max-w-5xl mx-auto w-full relative">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-serif font-bold text-stone-800">Pantry & Fridge</h2>
          <p className="text-stone-500">Manage your kitchen stock</p>
        </div>
        <button 
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 bg-chef-700 text-white px-4 py-2 rounded-xl shadow-sm hover:bg-chef-800 transition"
        >
          <Plus size={18} /> Add Item
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
          <input 
            type="text" 
            placeholder="Search ingredients..." 
            className="w-full pl-10 pr-4 py-2 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-accent-500 bg-white"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 sm:pb-0 no-scrollbar">
          {['All', ...Object.values(IngredientLocation)].map(loc => (
            <button
              key={loc}
              onClick={() => setFilter(loc)}
              className={`px-4 py-2 rounded-xl whitespace-nowrap text-sm font-medium transition-colors ${
                filter === loc 
                  ? 'bg-stone-800 text-white' 
                  : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-50'
              }`}
            >
              {loc}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 overflow-y-auto pb-20 flex-1 content-start">
        {filtered.map(item => (
          <div 
            key={item.id} 
            onClick={() => handleOpenModal(item)}
            className="bg-white p-4 rounded-2xl shadow-sm border border-stone-100 flex justify-between items-center group hover:shadow-md transition-all cursor-pointer hover:border-chef-200"
          >
            <div>
              <h3 className="font-semibold text-stone-800 text-lg group-hover:text-chef-700 transition-colors">{item.name}</h3>
              <div className="flex items-center gap-2 text-sm mt-1">
                <span className="bg-stone-100 text-stone-600 px-2 py-0.5 rounded-md text-xs font-medium uppercase tracking-wide">
                  {item.location}
                </span>
                <span className="text-stone-400">•</span>
                <span className="text-stone-500">{item.quantity}</span>
              </div>
              <div className={`text-xs mt-2 px-2 py-1 rounded-md inline-block font-medium ${getExpiryColor(item.expiryDate)}`}>
                Exp: {item.expiryDate}
              </div>
            </div>
            <div className="flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
               <button className="p-2 text-stone-400 hover:text-chef-600 bg-stone-50 rounded-full">
                 <Edit2 size={16} />
               </button>
               <button 
                  onClick={(e) => { e.stopPropagation(); onRemove(item.id); }}
                  className="p-2 text-stone-400 hover:text-red-500 bg-stone-50 rounded-full"
                >
                  <Trash2 size={16} />
                </button>
            </div>
          </div>
        ))}
        
        {/* Helper text for empty searches, but hidden if inventory is truly empty so Scan Card takes focus */}
        {filtered.length === 0 && inventory.length > 0 && (
          <div className="col-span-full text-center py-12 text-stone-400">
            <p>No ingredients found matching "{search}"</p>
          </div>
        )}

        {/* Always visible Scan Card at the end */}
        <div className="h-full min-h-[150px]">
          <VisionScanner onIngredientsFound={onScan} variant="card" />
        </div>
      </div>

      {isModalOpen && (
        <Modal 
          isModalOpen={isModalOpen} 
          setIsModalOpen={setIsModalOpen} 
          handleSubmit={handleSubmit} 
          formData={formData} 
          setFormData={setFormData} 
          editingItem={editingItem} 
        />
      )}
    </div>
  );
};

// Extracted Modal Component to avoid duplication
const Modal = ({ isModalOpen, setIsModalOpen, handleSubmit, formData, setFormData, editingItem }: any) => (
  <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center p-4 z-50">
    <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
      <div className="px-6 py-4 border-b border-stone-100 flex justify-between items-center bg-stone-50">
        <h3 className="font-serif font-bold text-xl text-stone-800">
          {editingItem ? 'Edit Item' : 'Add Ingredient'}
        </h3>
        <button onClick={() => setIsModalOpen(false)} className="text-stone-400 hover:text-stone-600">
          <X size={20} />
        </button>
      </div>
      
      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        <div>
          <label className="block text-xs font-bold text-stone-500 uppercase tracking-wide mb-1">Name</label>
          <input 
            autoFocus
            type="text" 
            required
            className="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-chef-500"
            value={formData.name}
            onChange={(e: any) => setFormData({...formData, name: e.target.value})}
            placeholder="e.g. Milk"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-stone-500 uppercase tracking-wide mb-1">Quantity</label>
            <input 
              type="text" 
              className="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-chef-500"
              value={formData.quantity}
              onChange={(e: any) => setFormData({...formData, quantity: e.target.value})}
              placeholder="e.g. 1 liter"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-stone-500 uppercase tracking-wide mb-1">Location</label>
            <select 
              className="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-chef-500"
              value={formData.location}
              onChange={(e: any) => setFormData({...formData, location: e.target.value as IngredientLocation})}
            >
              {Object.values(IngredientLocation).map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-stone-500 uppercase tracking-wide mb-1">Expiry Date</label>
          <input 
            type="date" 
            className="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-chef-500"
            value={formData.expiryDate}
            onChange={(e: any) => setFormData({...formData, expiryDate: e.target.value})}
          />
        </div>

        <div className="pt-4 flex gap-3">
          <button 
            type="button"
            onClick={() => setIsModalOpen(false)}
            className="flex-1 py-3 rounded-xl border border-stone-200 text-stone-600 font-medium hover:bg-stone-50"
          >
            Cancel
          </button>
          <button 
            type="submit"
            className="flex-1 py-3 rounded-xl bg-chef-700 text-white font-medium hover:bg-chef-800 shadow-lg shadow-chef-700/20"
          >
            Save Item
          </button>
        </div>
      </form>
    </div>
  </div>
);

export default InventoryView;