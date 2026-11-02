/** Íconos de línea del menú del panel (24×24, heredan el color del texto). */
const icon = (paths) => `
  <svg class="nav-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor"
       stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>
`;

export const ICONS = {
  home: icon('<rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" />'),
  orders: icon('<path d="M21 8 12 3 3 8v8l9 5 9-5Z" /><path d="m3 8 9 5 9-5" /><path d="M12 13v8" />'),
  messages: icon('<rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" />'),
  reports: icon('<path d="M4 20V10" /><path d="M10 20V4" /><path d="M16 20v-7" /><path d="M22 20H2" />'),
  catalog: icon('<path d="M4 19.5V5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2.5Z" /><path d="M4 19.5A2 2 0 0 0 6 22h13v-3" />'),
  prices: icon('<path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8Z" /><circle cx="7.5" cy="7.5" r="1.5" />'),
  users: icon('<circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="M16 4.5a3.5 3.5 0 0 1 0 7" /><path d="M18 14a6.5 6.5 0 0 1 3.5 6" />'),
  chevron: icon('<path d="m9 6 6 6-6 6" />'),
  menu: icon('<path d="M4 6h16M4 12h16M4 18h16" />'),
};
