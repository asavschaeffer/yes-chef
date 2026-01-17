import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage, Sender, Ingredient, IngredientLocation, Recipe } from '../types';
import { sendMessageToGemini, blobToBase64 } from '../services/geminiService';
import { Send, Loader2, Sparkles, Mic, Plus, Globe, BookOpen, X, Image as ImageIcon, Database, Refrigerator, ChefHat, Search, ArrowUpRight, ListChecks, ShoppingCart, Play, Clock, ArrowRight } from 'lucide-react';

interface Props {
  history: ChatMessage[];
  setHistory: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  inventory: Ingredient[];
  recipes?: Recipe[];
  onUpdateInventory: (action: 'add' | 'remove' | 'update', item: Partial<Ingredient>) => void;
  onSaveRecipe: () => void;
  onLiveMode: () => void;
  isSavingRecipe: boolean;
}

interface Suggestion {
  label: string;
  action: () => void;
  icon: React.ReactNode;
  disabled?: boolean;
}

const ChefChat: React.FC<Props> = ({ history, setHistory, inventory, recipes, onUpdateInventory, onSaveRecipe, onLiveMode, isSavingRecipe }) => {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('Thinking...');
  const [attachment, setAttachment] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history, isLoading]);

  // Loading text cycle effect
  useEffect(() => {
    if (!isLoading) return;
    const texts = ["Checking inventory...", "Reading recipes...", "Searching the web...", "Consulting the Chef..."];
    let i = 0;
    const interval = setInterval(() => {
      setLoadingText(texts[i % texts.length]);
      i++;
    }, 1500);
    return () => clearInterval(interval);
  }, [isLoading]);

  const handleSend = async (textOverride?: string) => {
    const textToSend = textOverride || input;
    if ((!textToSend.trim() && !attachment) || isLoading) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      text: textToSend,
      sender: Sender.USER,
      timestamp: Date.now(),
      image: attachment || undefined
    };

    setHistory(prev => [...prev, userMsg]);
    setInput('');
    setAttachment(null);
    setIsLoading(true);

    try {
      // Convert internal history to Gemini format
      const apiHistory = history.map(h => ({
        role: h.sender === Sender.USER ? 'user' : 'model',
        parts: [{ text: h.text }]
      }));

      const response = await sendMessageToGemini({
        history: apiHistory as any,
        message: userMsg.text,
        image: userMsg.image,
        inventory: inventory,
        recipes: recipes
      });

      // Handle any tool calls (Inventory Updates)
      if (response.toolCalls && response.toolCalls.length > 0) {
        for (const tool of response.toolCalls) {
          if (tool.name === 'update_inventory') {
            const { action, item_name, quantity, location, expiryDate } = tool.args;
            onUpdateInventory(action as 'add' | 'remove' | 'update', {
              name: item_name,
              quantity: quantity,
              location: (location as IngredientLocation),
              expiryDate: expiryDate
            });
          }
        }
      }

      const botMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        text: response.text || "I've updated your kitchen database.",
        sender: Sender.BOT,
        timestamp: Date.now(),
        sources: response.sources,
        traces: response.traces
      };

      setHistory(prev => [...prev, botMsg]);
    } catch (e) {
      console.error(e);
      setHistory(prev => [...prev, {
        id: Date.now().toString(),
        text: "Sorry, I had trouble connecting to the kitchen server.",
        sender: Sender.BOT,
        timestamp: Date.now()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const base64 = await blobToBase64(file);
        setAttachment(base64);
      } catch (err) {
        console.error("Failed to attach image", err);
      }
    }
  };

  const getIcon = (name: string) => {
    switch (name) {
      case 'Globe': return <Globe size={12} />;
      case 'Database': return <Database size={12} />;
      case 'Refrigerator': return <Refrigerator size={12} />;
      case 'BookOpen': return <BookOpen size={12} />;
      default: return <Sparkles size={12} />;
    }
  };

  const getColorClass = (color?: string) => {
    switch (color) {
      case 'blue': return 'bg-blue-50 text-blue-700 border-blue-100';
      case 'green': return 'bg-green-50 text-green-700 border-green-100';
      case 'orange': return 'bg-orange-50 text-orange-700 border-orange-100';
      case 'cyan': return 'bg-cyan-50 text-cyan-700 border-cyan-100';
      case 'stone': return 'bg-stone-100 text-stone-700 border-stone-200';
      case 'violet': return 'bg-violet-50 text-violet-700 border-violet-100';
      default: return 'bg-stone-50 text-stone-700 border-stone-100';
    }
  };

  // --- Context Engine: Determine Dynamic Suggestions ---
  const getContextualSuggestions = (): Suggestion[] => {
    // 1. Typing Mode: Prioritize search/check if user is typing
    if (input.length > 2) {
      return [
        { label: 'Search Web', action: () => handleSend(`Search the web for: ${input}`), icon: <Globe size={12} /> },
        { label: 'Check Inventory', action: () => handleSend(`Do I have ${input}?`), icon: <Refrigerator size={12} /> }
      ];
    }

    // 2. Analyze Last Message
    const lastMsg = history.length > 0 ? history[history.length - 1] : null;

    if (!lastMsg) {
      // Default Start State
      return [
        { label: "What do I have?", action: () => handleSend("What ingredients do I have in stock currently?"), icon: <Refrigerator size={12} /> },
        { label: "Suggest a dinner", action: () => handleSend("Suggest a dinner recipe based on my current inventory."), icon: <ChefHat size={12} /> },
        { label: "Identify ingredient", action: () => document.getElementById('chat-file-upload')?.click(), icon: <ImageIcon size={12} /> }
      ];
    }

    if (lastMsg.sender === Sender.BOT) {
      const text = lastMsg.text.toLowerCase();
      const suggestions: Suggestion[] = [];

      // A. Recipe Detected (Keywords: Ingredients AND Instructions)
      if (text.includes('ingredients') && (text.includes('instructions') || text.includes('method'))) {
        if (isSavingRecipe) {
           suggestions.push({ label: 'Saving...', action: () => {}, icon: <Loader2 size={12} className="animate-spin" />, disabled: true });
        } else {
           suggestions.push({ label: 'Save Recipe', action: onSaveRecipe, icon: <BookOpen size={12} /> });
        }
        suggestions.push({ label: 'Shopping List', action: () => handleSend("Compare the recipe ingredients with my inventory and create a shopping list for what I'm missing."), icon: <ListChecks size={12} />, disabled: isSavingRecipe });
        suggestions.push({ label: 'Start Cooking', action: () => handleSend("Let's cook! Walk me through the steps one by one."), icon: <Play size={12} />, disabled: isSavingRecipe });
        return suggestions;
      }

      // B. Inventory Listed
      if (text.includes('current inventory') || text.includes('in stock') || (text.includes('fridge') && text.includes('pantry'))) {
        suggestions.push({ label: 'Suggest Dinner', action: () => handleSend("Suggest a dinner recipe based on this inventory."), icon: <ChefHat size={12} /> });
        suggestions.push({ label: 'What expires soon?', action: () => handleSend("Which of these items expire soon and what should I make with them?"), icon: <Clock size={12} /> });
        return suggestions;
      }

      // C. Shopping List Created
      if (text.includes('shopping list') || text.includes('missing')) {
        suggestions.push({ label: 'Find Stores', action: () => handleSend("Where can I buy these items nearby?"), icon: <ShoppingCart size={12} /> });
        suggestions.push({ label: 'Added to Inventory', action: () => handleSend("I bought these items. Add them to my inventory."), icon: <Database size={12} /> });
        return suggestions;
      }
      
      // D. Generic Fallback (Continuation)
      suggestions.push({ label: 'Continue', action: () => handleSend("Tell me more."), icon: <ArrowRight size={12} /> });
      suggestions.push({ label: 'New Search', action: () => setInput(''), icon: <Search size={12} /> }); // Just clears to type
      
      return suggestions;
    }

    // Default (if last msg was user, usually waiting for reply, but if idle...)
    return [];
  };

  const suggestions = getContextualSuggestions();

  return (
    <div className="flex flex-col h-full max-w-4xl mx-auto w-full bg-white md:rounded-2xl md:shadow-xl md:border md:border-stone-200 overflow-hidden relative">
      
      {/* Chat Area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-6 bg-stone-50/50 pb-40">
        {history.length === 0 && (
          <div className="text-center text-stone-400 mt-20">
            <div className="w-16 h-16 bg-stone-100 rounded-full flex items-center justify-center mx-auto mb-4">
               <Sparkles size={32} className="text-stone-300" />
            </div>
            <h3 className="text-lg font-serif font-medium text-stone-600">Yes, Chef?</h3>
            <p className="text-sm">Ask "Do I have butter?" or "How do I make risotto?"</p>
          </div>
        )}
        
        {history.map(msg => (
          <div key={msg.id} className={`flex ${msg.sender === Sender.USER ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-2xl p-4 shadow-sm ${
              msg.sender === Sender.USER 
                ? 'bg-chef-700 text-white rounded-tr-none' 
                : 'bg-white text-stone-800 border border-stone-100 rounded-tl-none'
            }`}>
              {msg.image && (
                <div className="mb-3 rounded-lg overflow-hidden border border-white/20">
                  <img src={`data:image/jpeg;base64,${msg.image}`} alt="User upload" className="max-w-full h-auto max-h-60 object-cover" />
                </div>
              )}
              
              {/* Reasoning Traces (Contextual Chips in Output) */}
              {msg.traces && msg.traces.length > 0 && (
                <div className="mb-3 flex flex-wrap gap-2">
                  {msg.traces.map((trace, i) => (
                    <div 
                      key={i} 
                      title={trace.label}
                      className={`flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-semibold px-2 py-1 rounded-full border cursor-help transition-transform hover:scale-105 ${getColorClass(trace.color)}`}
                    >
                      {getIcon(trace.icon)} 
                      <span className="truncate max-w-[150px]">{trace.label}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="whitespace-pre-wrap text-sm leading-relaxed font-sans">{msg.text}</div>
              
              {/* Grounding Sources */}
              {msg.sources && msg.sources.length > 0 && (
                <div className="mt-3 pt-3 border-t border-stone-100">
                  <p className="text-xs font-bold text-stone-500 mb-1">Sources:</p>
                  <ul className="space-y-1">
                    {msg.sources.map((s, idx) => (
                      <li key={idx}>
                        <a href={s.uri} target="_blank" rel="noreferrer" className="text-xs text-blue-500 hover:underline flex items-center gap-1">
                           <ArrowUpRight size={10} /> {s.title}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        ))}
        
        {isLoading && (
          <div className="flex justify-start">
             <div className="bg-white px-4 py-3 rounded-2xl rounded-tl-none border border-stone-100 shadow-sm flex items-center gap-3">
              <Loader2 className="animate-spin text-chef-500" size={16} />
              <div className="flex flex-col">
                <span className="text-xs text-stone-500 font-medium">{loadingText}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input Area + Suggestions */}
      <div className="absolute bottom-0 left-0 right-0 bg-white border-t border-stone-200 p-4">
        
        {/* Suggestion Chips */}
        <div className="flex gap-2 mb-3 overflow-x-auto no-scrollbar py-1">
           {suggestions.map((s, idx) => (
             <button 
               key={idx}
               onClick={s.disabled ? undefined : s.action}
               disabled={s.disabled}
               className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all whitespace-nowrap shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-300 ${
                 s.disabled 
                   ? 'bg-stone-100 text-stone-400 border-stone-200 cursor-not-allowed' 
                   : 'bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100 hover:border-stone-300 active:scale-95'
               }`}
             >
               {s.icon} {s.label}
             </button>
           ))}
        </div>

        {/* Preview Attachment */}
        {attachment && (
          <div className="mb-2 inline-flex items-center gap-2 bg-stone-100 px-3 py-1 rounded-lg border border-stone-200">
             <ImageIcon size={14} className="text-stone-500" />
             <span className="text-xs text-stone-600">Image attached</span>
             <button onClick={() => setAttachment(null)} className="text-stone-400 hover:text-stone-600"><X size={14} /></button>
          </div>
        )}

        {/* Main Input Bar */}
        <div className="flex items-end gap-2">
          <div className="flex gap-2 pb-1">
             <label className="p-2.5 rounded-full text-stone-400 hover:bg-stone-100 hover:text-chef-600 cursor-pointer transition">
               <Plus size={22} />
               <input id="chat-file-upload" type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
             </label>
             <button 
               onClick={onLiveMode}
               className="p-2.5 rounded-full text-stone-400 hover:bg-stone-100 hover:text-chef-600 transition"
             >
               <Mic size={22} />
             </button>
          </div>
          
          <div className="flex-1 bg-stone-50 border border-stone-200 rounded-2xl focus-within:ring-2 focus-within:ring-chef-300 focus-within:bg-white transition flex items-center">
             <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about ingredients or recipes..."
              className="w-full bg-transparent border-none rounded-2xl px-4 py-3 focus:outline-none resize-none text-sm max-h-32"
              rows={1}
              style={{ minHeight: '46px' }}
            />
          </div>

          <button 
            onClick={() => handleSend()}
            disabled={(!input.trim() && !attachment) || isLoading}
            className="p-3 bg-chef-700 text-white rounded-full hover:bg-chef-800 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-sm mb-0.5"
          >
            <Send size={20} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChefChat;