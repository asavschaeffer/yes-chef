import React, { useState } from 'react';
import { Camera, Upload, CheckCircle2, Loader2, ArrowRight } from 'lucide-react';
import { analyzeFridgeImage, blobToBase64 } from '../services/geminiService';
import { Ingredient } from '../types';

interface Props {
  onIngredientsFound: (ings: Ingredient[]) => void;
  variant?: 'full' | 'card';
}

const VisionScanner: React.FC<Props> = ({ onIngredientsFound, variant = 'full' }) => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Show preview
    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);
    setIsAnalyzing(true);

    try {
      const base64 = await blobToBase64(file);
      const ingredients = await analyzeFridgeImage(base64);
      onIngredientsFound(ingredients);
    } catch (err) {
      console.error(err);
      alert("Failed to analyze image. Please try again.");
    } finally {
      setIsAnalyzing(false);
      setPreview(null);
    }
  };

  // --- CARD VARIANT (Compact) ---
  if (variant === 'card') {
    return (
      <label className="group relative flex flex-col items-center justify-center p-6 h-full min-h-[180px] bg-stone-50 border-2 border-dashed border-stone-200 rounded-2xl hover:bg-stone-100 hover:border-chef-400 transition-all cursor-pointer overflow-hidden">
        
        {isAnalyzing ? (
          <div className="absolute inset-0 bg-white/90 z-10 flex flex-col items-center justify-center">
             <Loader2 className="animate-spin text-accent-500 mb-2" size={32} />
             <span className="text-xs font-bold text-stone-500 uppercase tracking-wide">Analyzing...</span>
          </div>
        ) : (
          <>
            <div className="mb-3 p-3 bg-white rounded-full shadow-sm group-hover:scale-110 transition-transform">
               <Camera size={24} className="text-chef-600" />
            </div>
            <h3 className="text-stone-700 font-semibold mb-1 text-center">Scan to Add</h3>
            <p className="text-xs text-stone-400 text-center max-w-[80%]">
              Take a photo of your pantry or receipt
            </p>
          </>
        )}
        
        {preview && (
          <div className="absolute inset-0 z-0 opacity-20">
            <img src={preview} alt="Scanning" className="w-full h-full object-cover" />
          </div>
        )}

        <input 
          type="file" 
          accept="image/*" 
          capture="environment" 
          className="hidden" 
          onChange={handleFileChange}
        />
      </label>
    );
  }

  // --- FULL VARIANT (Default) ---
  return (
    <div className="max-w-md mx-auto w-full p-6">
      <div className="bg-white rounded-3xl shadow-xl border border-stone-100 overflow-hidden text-center p-8">
        <div className="w-16 h-16 bg-chef-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <Camera size={32} className="text-chef-600" />
        </div>
        
        <h2 className="text-2xl font-serif font-bold text-stone-800 mb-2">Scan Your Pantry</h2>
        <p className="text-stone-500 mb-8 text-sm leading-relaxed">
          Take a photo of your fridge, pantry, or grocery receipt. 
          Gemini Vision will identify ingredients and expiry dates automatically.
        </p>

        {isAnalyzing ? (
          <div className="py-8 animate-pulse flex flex-col items-center">
            <Loader2 className="animate-spin text-accent-500 mb-4" size={40} />
            <p className="text-sm font-semibold text-stone-600">Analyzing Image...</p>
            <p className="text-xs text-stone-400 mt-1">Identifying items and estimating freshness</p>
          </div>
        ) : (
          <label className="relative block group cursor-pointer">
            <div className="absolute inset-0 bg-chef-600 rounded-xl blur opacity-20 group-hover:opacity-30 transition"></div>
            <div className="relative bg-white border-2 border-dashed border-chef-200 hover:border-chef-400 rounded-xl p-8 transition-colors flex flex-col items-center gap-3">
               <Upload size={24} className="text-chef-500" />
               <span className="font-semibold text-chef-700">Upload or Take Photo</span>
            </div>
            <input 
              type="file" 
              accept="image/*" 
              capture="environment" 
              className="hidden" 
              onChange={handleFileChange}
            />
          </label>
        )}

        <div className="mt-8 pt-6 border-t border-stone-100 text-left">
           <h3 className="text-xs font-bold uppercase tracking-wider text-stone-400 mb-3">Supported Scenarios</h3>
           <ul className="space-y-2 text-sm text-stone-600">
             <li className="flex items-center gap-2"><CheckCircle2 size={14} className="text-green-500" /> Open Fridge Shelves</li>
             <li className="flex items-center gap-2"><CheckCircle2 size={14} className="text-green-500" /> Pantry Shelves</li>
             <li className="flex items-center gap-2"><CheckCircle2 size={14} className="text-green-500" /> Produce Basket</li>
           </ul>
        </div>
      </div>
    </div>
  );
};

export default VisionScanner;