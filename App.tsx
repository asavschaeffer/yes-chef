import React, { useState } from 'react';
import { ViewState, Ingredient, Recipe, ChatMessage, IngredientLocation } from './types';
import InventoryView from './components/InventoryView';
import ChefChat from './components/ChefChat';
import VisionScanner from './components/VisionScanner';
import LiveChef from './components/LiveChef';
import RecipeBook from './components/RecipeBook';
import { LayoutGrid, MessageSquareText, ScanLine, UtensilsCrossed } from 'lucide-react';
import { saveSessionAsRecipe } from './services/geminiService';

const App: React.FC = () => {
  const [view, setView] = useState<ViewState>('inventory');
  const [liveMode, setLiveMode] = useState(false);
  const [isSavingRecipe, setIsSavingRecipe] = useState(false);
  
  // State
  const [inventory, setInventory] = useState<Ingredient[]>([
    { id: '1', name: 'Heavy Cream', location: IngredientLocation.FRIDGE, quantity: 'Half carton', expiryDate: '2024-05-20' },
    { id: '2', name: 'Parmesan Cheese', location: IngredientLocation.FRIDGE, quantity: 'Block', expiryDate: '2024-06-15' },
    { id: '3', name: 'Arborio Rice', location: IngredientLocation.PANTRY, quantity: '1kg bag', expiryDate: '2025-01-01' },
    { id: '4', name: 'White Wine', location: IngredientLocation.FRIDGE, quantity: '1 bottle', expiryDate: '2024-12-12' },
    { id: '5', name: 'Chicken Stock', location: IngredientLocation.PANTRY, quantity: '2 cartons', expiryDate: '2024-08-01' },
  ]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);

  // Handlers
  const handleScanResults = (newIngs: Ingredient[]) => {
    setInventory(prev => [...newIngs, ...prev]);
    setView('inventory');
  };

  const handleInventoryUpdate = (action: 'add' | 'remove' | 'update', item: Partial<Ingredient>) => {
    if (action === 'add' && item.name) {
      setInventory(prev => [{
        id: `auto-${Date.now()}`,
        name: item.name!,
        quantity: item.quantity || '1',
        location: item.location || IngredientLocation.PANTRY,
        expiryDate: item.expiryDate || new Date(Date.now() + 86400000 * 14).toISOString().split('T')[0]
      } as Ingredient, ...prev]);
    } else if (action === 'remove' && item.name) {
      // Fuzzy removal
      setInventory(prev => {
        const index = prev.findIndex(i => i.name.toLowerCase().includes(item.name!.toLowerCase()));
        if (index !== -1) {
          const newInv = [...prev];
          newInv.splice(index, 1);
          return newInv;
        }
        return prev;
      });
    } else if (action === 'update' && item.name) {
      setInventory(prev => prev.map(i => {
        // Find best match (exact or partial)
        if (i.name.toLowerCase().includes(item.name!.toLowerCase()) || item.name!.toLowerCase().includes(i.name.toLowerCase())) {
          return {
            ...i,
            quantity: item.quantity || i.quantity,
            location: item.location || i.location,
            expiryDate: item.expiryDate || i.expiryDate
          };
        }
        return i;
      }));
    }
  };
  
  // Manual Inventory Edits
  const handleManualAddInventory = (item: Ingredient) => {
    setInventory(prev => [item, ...prev]);
  };
  
  const handleManualUpdateInventory = (item: Ingredient) => {
    setInventory(prev => prev.map(i => i.id === item.id ? item : i));
  };

  // Recipe Handlers
  const handleSaveRecipe = async () => {
    if(chatHistory.length < 2 || isSavingRecipe) return;
    
    setIsSavingRecipe(true);
    const historyText = chatHistory.map(m => `${m.sender}: ${m.text}`).join('\n');
    
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error("Recipe generation timed out")), 15000)
    );

    try {
      const recipe = await Promise.race([
        saveSessionAsRecipe(historyText),
        timeoutPromise
      ]) as Recipe;

      setRecipes(prev => [recipe, ...prev]);
      setTimeout(() => {
        setView('recipes');
        setIsSavingRecipe(false);
      }, 800);
    } catch (e) {
      console.error(e);
      alert("Could not generate recipe at this time. Please try again.");
      setIsSavingRecipe(false);
    }
  };

  const handleManualAddRecipe = (recipe: Recipe) => {
    setRecipes(prev => [recipe, ...prev]);
  };

  const handleManualUpdateRecipe = (recipe: Recipe) => {
    setRecipes(prev => prev.map(r => r.id === recipe.id ? recipe : r));
  };

  return (
    <div className="h-screen w-full bg-stone-50 flex flex-col md:flex-row overflow-hidden font-sans">
      
      {/* Mobile Nav Header */}
      <div className="md:hidden bg-white border-b border-stone-200 p-4 flex justify-between items-center z-20">
        <div className="flex items-center gap-2">
           <span className="font-serif font-bold text-xl text-stone-800">Yes Chef</span>
        </div>
      </div>

      {/* Sidebar (Desktop) */}
      <nav className="hidden md:flex flex-col w-64 bg-white border-r border-stone-200 h-full p-6">
        <div className="mb-10 flex items-center gap-3 px-2">
           <div className="w-8 h-8 bg-chef-800 rounded-lg flex items-center justify-center text-white font-serif font-bold text-lg">Y</div>
           <span className="font-serif font-bold text-2xl text-stone-800 tracking-tight">Yes Chef</span>
        </div>

        <div className="space-y-2 flex-1">
          <NavBtn active={view === 'inventory'} onClick={() => setView('inventory')} icon={<LayoutGrid size={20} />} label="Kitchen Stock" />
          <NavBtn active={view === 'chat'} onClick={() => setView('chat')} icon={<MessageSquareText size={20} />} label="Chef Assistant" />
          <NavBtn active={view === 'scan'} onClick={() => setView('scan')} icon={<ScanLine size={20} />} label="Scan Pantry" />
          <NavBtn active={view === 'recipes'} onClick={() => setView('recipes')} icon={<UtensilsCrossed size={20} />} label="Recipe Book" />
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 relative overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-0 md:p-6">
          {view === 'inventory' && (
            <InventoryView 
              inventory={inventory} 
              onRemove={id => setInventory(prev => prev.filter(i => i.id !== id))}
              onAdd={handleManualAddInventory}
              onUpdate={handleManualUpdateInventory}
              onScan={handleScanResults}
            />
          )}
          
          {view === 'chat' && (
            <div className="h-[calc(100vh-140px)] md:h-full">
               <ChefChat 
                 history={chatHistory} 
                 setHistory={setChatHistory} 
                 onSaveRecipe={handleSaveRecipe}
                 onLiveMode={() => setLiveMode(true)}
                 inventory={inventory}
                 recipes={recipes}
                 onUpdateInventory={handleInventoryUpdate}
                 isSavingRecipe={isSavingRecipe}
               />
            </div>
          )}
          
          {view === 'scan' && (
            <div className="h-full flex items-center justify-center">
              <VisionScanner onIngredientsFound={handleScanResults} />
            </div>
          )}

          {view === 'recipes' && (
            <RecipeBook 
              recipes={recipes}
              onAddRecipe={handleManualAddRecipe}
              onUpdateRecipe={handleManualUpdateRecipe}
            />
          )}
        </div>

        {/* Mobile Tab Bar */}
        <div className="md:hidden bg-white border-t border-stone-200 flex justify-around p-3 pb-6 z-20">
          <MobileNavBtn active={view === 'inventory'} onClick={() => setView('inventory')} icon={<LayoutGrid size={24} />} />
          <MobileNavBtn active={view === 'chat'} onClick={() => setView('chat')} icon={<MessageSquareText size={24} />} />
          <MobileNavBtn active={view === 'scan'} onClick={() => setView('scan')} icon={<ScanLine size={24} />} />
          <MobileNavBtn active={view === 'recipes'} onClick={() => setView('recipes')} icon={<UtensilsCrossed size={24} />} />
        </div>
      </main>

      {/* Live Overlay */}
      <LiveChef isActive={liveMode} onClose={() => setLiveMode(false)} />
    </div>
  );
};

const NavBtn = ({ active, onClick, icon, label }: any) => (
  <button 
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
      active 
        ? 'bg-chef-50 text-chef-900 shadow-sm ring-1 ring-chef-100' 
        : 'text-stone-500 hover:bg-stone-50 hover:text-stone-800'
    }`}
  >
    {React.cloneElement(icon, { size: 18, className: active ? 'text-chef-600' : 'text-stone-400' })}
    {label}
  </button>
);

const MobileNavBtn = ({ active, onClick, icon }: any) => (
  <button 
    onClick={onClick}
    className={`p-2 rounded-xl transition ${active ? 'bg-chef-50 text-chef-700' : 'text-stone-400'}`}
  >
    {icon}
  </button>
);

export default App;