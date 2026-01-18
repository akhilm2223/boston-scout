import './SearchBar.css';

interface SearchBarProps {
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  onSearchSubmit: () => void;
  isSearching: boolean;
}

export default function SearchBar({
  searchQuery,
  onSearchQueryChange,
  onSearchSubmit,
  isSearching,
}: SearchBarProps) {
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      onSearchSubmit();
    }
  };

  return (
    <div className="global-search-container">
      <div className="search-wrapper">
        <input
          type="text"
          className="global-search-input"
          placeholder="Ask for experiences... (e.g. 'romantic dinner' or 'jazz concert')"
          value={searchQuery}
          onChange={(e) => onSearchQueryChange(e.target.value)}
          onKeyPress={handleKeyPress}
        />
        <button
          className="global-search-btn"
          onClick={onSearchSubmit}
          disabled={isSearching}
        >
          {isSearching ? "..." : "→"}
        </button>
      </div>
    </div>
  );
}
