export interface Verdict { result?: string; found?: string[] | string; reason?: string; scannedAt?: string }
export interface ScanRecord { tag: string; file?: string; sha256?: string; clamav?: Verdict; yara?: Verdict; prerelease?: boolean; audit?: { source?: { findings?: { rule?: string; path?: string }[] } } }
export interface Scans { stable?: ScanRecord; prerelease?: ScanRecord; releases?: ScanRecord[] }
export interface VirusTotalReport { state?: string; scannedAt?: string | number; stats?: Record<string, number> }
export interface MetaDefenderReport { state?: string; scannedAt?: string; flagged?: number; total?: number; dataId?: string }
export interface Stats { root?: boolean; fork?: string; store?: unknown; ai?: string[]; rust?: boolean; created?: string; warnings?: string[]; prereleaseWarnings?: string[] }
export interface App { id?: string; name: string; repo?: string; store?: boolean }
export interface External { virusTotal: VirusTotalReport | null; metaDefender: MetaDefenderReport | null }
// What background.ts answers a "deckyhub:lookup" message with.
export interface Lookup {
  app?: App | null;
  // The registry's other plugins by the same GitHub account (the registry has no author field of its own).
  more?: Pick<App, 'id' | 'name'>[];
  catalogAvailable: boolean;
  stats?: Stats | null;
  scans?: Scans | null;
  external?: Record<string, External>;
  virusTotalAvailable?: boolean;
  metaDefenderAvailable?: boolean;
  unavailable?: string[];
  stale?: boolean;
}
