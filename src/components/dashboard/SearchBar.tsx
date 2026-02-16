import { useState, useRef, useEffect, useCallback } from 'react';
import { Search, Mic, MicOff, X, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface SearchBarProps {
  onSearch: (query: string) => void;
  onTagsExtracted: (tags: string[]) => void;
  isLoading?: boolean;
  placeholder?: string;
}

export function SearchBar({ onSearch, onTagsExtracted, isLoading, placeholder }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const recognitionRef = useRef<any>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      setSpeechSupported(true);
      const recognition = new SpeechRecognition();
      recognition.lang = 'pt-BR';
      recognition.continuous = false;
      recognition.interimResults = true;

      recognition.onresult = (event: any) => {
        const transcript = Array.from(event.results)
          .map((result: any) => result[0].transcript)
          .join('');
        setQuery(transcript);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.onerror = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }
  }, []);

  const toggleListening = useCallback(() => {
    if (!recognitionRef.current) return;
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      recognitionRef.current.start();
      setIsListening(true);
    }
  }, [isListening]);

  const extractTags = (text: string): string[] => {
    const keywords = ['ncm', 'cest', 'marca', 'categoria', 'sku', 'preço', 'estoque'];
    const tags: string[] = [];
    const lower = text.toLowerCase();

    // Extract known field keywords
    keywords.forEach(kw => {
      if (lower.includes(kw)) {
        tags.push(kw.toUpperCase());
      }
    });

    // Extract quoted phrases
    const quoted = text.match(/"([^"]+)"/g);
    if (quoted) {
      quoted.forEach(q => tags.push(q.replace(/"/g, '')));
    }

    // Extract remaining meaningful words (3+ chars, not stopwords)
    const stopwords = new Set(['de', 'do', 'da', 'dos', 'das', 'em', 'no', 'na', 'um', 'uma', 'para', 'por', 'com', 'sem', 'que', 'atualizar', 'corrigir', 'buscar', 'encontrar', 'mostrar', 'listar']);
    const words = text.split(/\s+/).filter(w => w.length >= 3 && !stopwords.has(w.toLowerCase()) && !keywords.includes(w.toLowerCase()));
    words.forEach(w => {
      if (!tags.some(t => t.toLowerCase() === w.toLowerCase())) {
        tags.push(w);
      }
    });

    return tags;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    const tags = extractTags(query);
    onTagsExtracted(tags);
    onSearch(query);
  };

  const handleClear = () => {
    setQuery('');
    onTagsExtracted([]);
    onSearch('');
    inputRef.current?.focus();
  };

  return (
    <form onSubmit={handleSubmit} className="relative">
      <div className={cn(
        "flex items-center gap-2 rounded-xl border bg-card px-4 py-2 shadow-sm transition-all",
        "focus-within:ring-2 focus-within:ring-ring focus-within:border-primary",
        isListening && "ring-2 ring-destructive/50 border-destructive"
      )}>
        <Search className="h-5 w-5 text-muted-foreground shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder || 'Buscar produtos, corrigir NCM, filtrar por marca...'}
          className="flex-1 bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground text-sm"
          disabled={isLoading}
        />
        {isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        {query && (
          <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={handleClear}>
            <X className="h-4 w-4" />
          </Button>
        )}
        {speechSupported && (
          <Button
            type="button"
            variant={isListening ? "destructive" : "ghost"}
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={toggleListening}
          >
            {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </Button>
        )}
      </div>
      {isListening && (
        <p className="text-xs text-destructive mt-1 ml-2 animate-pulse">
          🎤 Ouvindo... fale seu comando
        </p>
      )}
    </form>
  );
}
