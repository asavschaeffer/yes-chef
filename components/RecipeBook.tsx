import React, { useState } from 'react';
import { Recipe } from '../types';
import { Search, Plus, Clock, ChefHat, ArrowLeft, Edit, Share2, X, CheckCircle2 } from 'lucide-react';

interface Props {
  recipes: Recipe[];
  onAddRecipe: (r: Recipe) => void;
  onUpdateRecipe: (r: Recipe) => void;
}

const RecipeBook: React.FC<Props> = ({ recipes, onAddRecipe, onUpdateRecipe }) => {
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [isEditing, setIsEditing] = useState(false); // Mode for the modal (Add or Edit)
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form State
  const [formData, setFormData] = useState<Partial<Recipe>>({
    title: '',
    category: 'Dinner',
    ingredients: [],
    steps: [],
    notes: ''
  });
  // Raw text state for the textareas (newlines separated)
  const [rawIngredients, setRawIngredients] = useState('');
  const [rawSteps, setRawSteps] = useState('');

  // Derived Categories
  const categories = ['All', ...Array.from(new Set(recipes.map(r => r.category || 'Uncategorized')))];
  if (!categories.includes('Dinner')) categories.push('Dinner'); // Default option

  const filtered = recipes.filter(r => {
    const matchesSearch = r.title.toLowerCase().includes(search.toLowerCase());
    const matchesCat = categoryFilter === 'All' || (r.category || 'Uncategorized') === categoryFilter;
    return matchesSearch && matchesCat;
  });

  const handleOpenAdd = () => {
    setFormData({
      title: '',
      category: 'Dinner',
      ingredients: [],
      steps: [],
      notes: ''
    });
    setRawIngredients('');
    setRawSteps('');
    setSelectedRecipe(null);
    setIsEditing(false);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (r: Recipe) => {
    setFormData(r);
    setRawIngredients(r.ingredients.join('\n'));
    setRawSteps(r.steps.join('\n'));
    setIsEditing(true);
    setIsModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const finalRecipe: Recipe = {
      id: isEditing && selectedRecipe ? selectedRecipe.id : `manual-${Date.now()}`,
      dateAdded: isEditing && selectedRecipe ? selectedRecipe.dateAdded : new Date().toISOString(),
      title: formData.title || 'Untitled Recipe',
      category: formData.category || 'Uncategorized',
      notes: formData.notes || '',
      ingredients: rawIngredients.split('\n').filter(line => line.trim() !== ''),
      steps: rawSteps.split('\n').filter(line => line.trim() !== ''),
    };

    if (isEditing) {
      onUpdateRecipe(finalRecipe);
      setSelectedRecipe(finalRecipe); // Update view
    } else {
      onAddRecipe(finalRecipe);
    }
    setIsModalOpen(false);
  };

  // --- DETAIL VIEW ---
  if (selectedRecipe && !isModalOpen) {
    return (
      <div className="h-full flex flex-col bg-white overflow-hidden">
        {/* Detail Header */}
        <div className="border-b border-stone-100 p-4 flex items-center justify-between sticky top-0 bg-white z-10">
          <button 
            onClick={() => setSelectedRecipe(null)}
            className="flex items-center gap-2 text-stone-500 hover:text-stone-800 transition"
          >
            <ArrowLeft size={20} /> <span className="font-medium">Back to Books</span>
          </button>
          <div className="flex gap-2">
            <button 
              onClick={() => handleOpenEdit(selectedRecipe)}
              className="p-2 text-stone-500 hover:bg-stone-50 rounded-full"
            >
              <Edit size={20} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 max-w-4xl mx-auto w-full">
           <div className="mb-8 text-center">
              <span className="inline-block px-3 py-1 rounded-full bg-chef-50 text-chef-700 text-xs font-bold uppercase tracking-wider mb-3">
                {selectedRecipe.category || 'Recipe'}
              </span>
              <h1 className="text-4xl font-serif font-bold text-stone-800 mb-4">{selectedRecipe.title}</h1>
              <p className="text-stone-400 text-sm">Added on {new Date(selectedRecipe.dateAdded).toLocaleDateString()}</p>
           </div>

           <div className="grid md:grid-cols-2 gap-12">
             <div className="space-y-6">
               <h3 className="font-serif font-bold text-2xl text-stone-800 border-b-2 border-chef-100 pb-2">Ingredients</h3>
               <ul className="space-y-3">
                 {selectedRecipe.ingredients.map((ing, i) => (
                   <li key={i} className="flex items-start gap-3 text-stone-700">
                     <div className="mt-1 min-w-4 h-4 rounded border border-chef-300"></div>
                     <span className="leading-relaxed">{ing}</span>
                   </li>
                 ))}
               </ul>
             </div>

             <div className="space-y-6">
               <h3 className="font-serif font-bold text-2xl text-stone-800 border-b-2 border-chef-100 pb-2">Instructions</h3>
               <div className="space-y-6">
                 {selectedRecipe.steps.map((step, i) => (
                   <div key={i} className="flex gap-4">
                     <span className="flex-shrink-0 w-8 h-8 rounded-full bg-stone-100 text-stone-500 font-serif font-bold flex items-center justify-center">
                       {i + 1}
                     </span>
                     <p className="text-stone-700 leading-relaxed pt-1">{step}</p>
                   </div>
                 ))}
               </div>
             </div>
           </div>

           {selectedRecipe.notes && (
             <div className="mt-12 bg-yellow-50 p-6 rounded-2xl border border-yellow-100 text-stone-700 italic">
               <h4 className="font-bold text-yellow-800 mb-2 not-italic text-sm uppercase">Chef's Notes</h4>
               {selectedRecipe.notes}
             </div>
           )}
        </div>
      </div>
    );
  }

  // --- LIST VIEW ---
  return (
    <div className="h-full flex flex-col p-4 md:p-6 max-w-6xl mx-auto w-full relative">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-3xl font-serif font-bold text-stone-800">Recipe Book</h2>
          <p className="text-stone-500">Your collection of culinary creations</p>
        </div>
        <button 
          onClick={handleOpenAdd}
          className="flex items-center gap-2 bg-chef-700 text-white px-4 py-2 rounded-xl shadow-sm hover:bg-chef-800 transition"
        >
          <Plus size={18} /> Add Recipe
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
          <input 
            type="text" 
            placeholder="Search recipes..." 
            className="w-full pl-10 pr-4 py-2 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-accent-500 bg-white"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 sm:pb-0 no-scrollbar">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-4 py-2 rounded-xl whitespace-nowrap text-sm font-medium transition-colors ${
                categoryFilter === cat 
                  ? 'bg-stone-800 text-white' 
                  : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-50'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 overflow-y-auto pb-20">
        {filtered.map(r => (
          <div 
            key={r.id} 
            onClick={() => setSelectedRecipe(r)}
            className="bg-white p-6 rounded-2xl border border-stone-100 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all cursor-pointer group"
          >
            <div className="flex justify-between items-start mb-4">
              <span className="px-2 py-1 rounded bg-stone-100 text-stone-500 text-xs font-bold uppercase tracking-wide group-hover:bg-chef-50 group-hover:text-chef-700 transition-colors">
                {r.category || 'Recipe'}
              </span>
              <span className="text-stone-300 group-hover:text-stone-400">
                <ChefHat size={20} />
              </span>
            </div>
            <h3 className="text-xl font-bold font-serif text-stone-800 mb-2 line-clamp-2">{r.title}</h3>
            <div className="flex items-center gap-4 text-xs text-stone-500 mb-4">
               <span className="flex items-center gap-1"><Clock size={12} /> {new Date(r.dateAdded).toLocaleDateString()}</span>
               <span>{r.ingredients.length} Ingredients</span>
            </div>
            <p className="text-sm text-stone-600 line-clamp-3">
              {r.ingredients.join(', ')}
            </p>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="col-span-full py-20 text-center text-stone-400">
            <ChefHat size={48} className="mx-auto mb-4 opacity-20" />
            <p>No recipes found. Start cooking or add one manually!</p>
          </div>
        )}
      </div>

      {/* ADD / EDIT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
           <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
             <div className="px-6 py-4 border-b border-stone-100 flex justify-between items-center bg-stone-50">
                <h3 className="font-serif font-bold text-xl text-stone-800">
                  {isEditing ? 'Edit Recipe' : 'Add New Recipe'}
                </h3>
                <button onClick={() => setIsModalOpen(false)} className="text-stone-400 hover:text-stone-600">
                  <X size={20} />
                </button>
             </div>
             
             <div className="flex-1 overflow-y-auto p-6">
                <form id="recipeForm" onSubmit={handleSave} className="space-y-6">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                       <label className="block text-xs font-bold text-stone-500 uppercase tracking-wide mb-1">Recipe Title</label>
                       <input 
                         required
                         type="text" 
                         className="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-chef-500 text-lg font-serif"
                         value={formData.title}
                         onChange={e => setFormData({...formData, title: e.target.value})}
                         placeholder="e.g. Grandma's Apple Pie"
                       />
                    </div>
                    <div>
                       <label className="block text-xs font-bold text-stone-500 uppercase tracking-wide mb-1">Category</label>
                       <input 
                         type="text" 
                         className="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-chef-500"
                         value={formData.category}
                         onChange={e => setFormData({...formData, category: e.target.value})}
                         placeholder="e.g. Dessert"
                       />
                    </div>
                  </div>

                  <div>
                     <label className="block text-xs font-bold text-stone-500 uppercase tracking-wide mb-1">
                       Ingredients <span className="font-normal text-stone-400 lowercase">(one per line)</span>
                     </label>
                     <textarea 
                       className="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-chef-500 min-h-[150px]"
                       value={rawIngredients}
                       onChange={e => setRawIngredients(e.target.value)}
                       placeholder={"1 cup Flour\n2 Eggs\n1/2 cup Sugar"}
                     />
                  </div>

                  <div>
                     <label className="block text-xs font-bold text-stone-500 uppercase tracking-wide mb-1">
                       Instructions <span className="font-normal text-stone-400 lowercase">(one step per line)</span>
                     </label>
                     <textarea 
                       className="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-chef-500 min-h-[150px]"
                       value={rawSteps}
                       onChange={e => setRawSteps(e.target.value)}
                       placeholder={"Mix dry ingredients.\nAdd wet ingredients.\nBake at 350F for 30 mins."}
                     />
                  </div>

                  <div>
                     <label className="block text-xs font-bold text-stone-500 uppercase tracking-wide mb-1">Notes</label>
                     <textarea 
                       className="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-chef-500"
                       value={formData.notes}
                       onChange={e => setFormData({...formData, notes: e.target.value})}
                       placeholder="Any special tips?"
                     />
                  </div>
                </form>
             </div>

             <div className="p-4 border-t border-stone-100 bg-stone-50 flex gap-3">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-3 rounded-xl border border-stone-200 text-stone-600 font-medium hover:bg-stone-50"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  form="recipeForm"
                  className="flex-1 py-3 rounded-xl bg-chef-700 text-white font-medium hover:bg-chef-800 shadow-lg shadow-chef-700/20"
                >
                  Save Recipe
                </button>
             </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default RecipeBook;