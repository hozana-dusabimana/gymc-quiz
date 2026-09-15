export function Footer({ dark = false }: { dark?: boolean }) {
  return (
    <footer
      className={`py-4 text-center text-[11px] font-medium ${
        dark ? 'text-slate-400/80' : 'text-slate-400 border-t border-slate-100'
      }`}
    >
      © {new Date().getFullYear()} Gisozi Youth Mass Choir Quiz · Designed by{' '}
      <span className={dark ? 'text-slate-200 font-bold' : 'text-slate-600 font-bold'}>Hozana</span>
    </footer>
  );
}
