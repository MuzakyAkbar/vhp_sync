/**
 * Format a JS Date (or date string) to VHP's required m/d/yyyy format.
 */
export function toVhpDate(d) {
  const dt = d instanceof Date ? d : new Date(d);
  const mm = dt.getMonth() + 1;   // no leading zero
  const dd = dt.getDate();        // no leading zero
  const yyyy = dt.getFullYear();
  return `${mm}/${dd}/${yyyy}`;
}

/**
 * Returns { fromDate, toDate } in VHP format.
 * Start date selalu di-set ke 01 Januari 2026.
 */
export function getDateRange() {
  const to = new Date();
  to.setHours(0, 0, 0, 0);
  
  // Hardcode fromDate ke 01 Januari 2026 (Bulan di JS dimulai dari 0 = Januari)
  const from = new Date(2026, 0, 1); 
  
  return { fromDate: toVhpDate(from), toDate: toVhpDate(to) };
}

/**
 * Parse VHP date string (m/d/yyyy or mm/dd/yyyy) → ISO date string for Supabase.
 */
export function parseDate(str) {
  if (!str) return null;
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(str)) {
    const [mm, dd, yyyy] = str.split("/");
    return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
  }
  return str;
}